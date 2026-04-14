// P5c3 — MCP dispatcher
//
// Entry point for the agent runtime when it decides to call an MCP
// tool. Given (userId, toolName, args) it:
//   1. Checks the user's daily MCP quota
//   2. Looks up an enabled McpServer that exposes the tool (cachedTools
//      JSON first; re-probes on miss)
//   3. Spawns + invokes via invokeOne()
//   4. Writes McpUsageLog row (success or error)
//   5. Bumps McpUsage for successes
//   6. Returns a normalized DispatchResult-ish shape
//
// The dispatcher is intentionally one-shot: every call spawns a fresh
// subprocess. A later chunk can add a per-task connection cache that
// reuses open handles across multiple MCP calls in the same agent
// conversation.
//
// The AGENT itself doesn't pick the server — it just says "call tool
// X with args Y". This resolver does the (tool → server) lookup based
// on cachedTools, so multiple installed MCPs can coexist without
// conflicting. If two servers expose the same tool name, the one with
// more recent lastUsedAt wins.

import { prisma } from '@/lib/prisma';
import { invokeOne, McpServerRow } from './runtime';

const DEFAULT_DAILY_LIMIT = Number(process.env.MCP_DAILY_LIMIT || 100);

// ─── Types ───────────────────────────────────────────────────────────

export interface McpDispatchInput {
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface McpDispatchResult {
  success: boolean;
  serverId?: string;
  serverName?: string;
  toolName: string;
  content?: unknown;
  errorMsg?: string;
  durationMs: number;
}

// ─── Quota ───────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function checkMcpQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const row = await prisma.mcpUsage.findUnique({
    where: { userId_day: { userId, day: todayKey() } },
  }).catch(() => null);
  const used = row?.callCount ?? 0;
  return { allowed: used < DEFAULT_DAILY_LIMIT, used, limit: DEFAULT_DAILY_LIMIT };
}

async function bumpMcpQuota(userId: string): Promise<void> {
  await prisma.mcpUsage
    .upsert({
      where: { userId_day: { userId, day: todayKey() } },
      create: { userId, day: todayKey(), callCount: 1 },
      update: { callCount: { increment: 1 } },
    })
    .catch(() => {});
}

// ─── Resolver ────────────────────────────────────────────────────────

/**
 * Find an enabled MCP server owned by `userId` that exposes `toolName`.
 * Uses cachedTools JSON for the initial scan (O(n) over installed servers,
 * typically < 10). If no cached match, returns null — the caller can
 * choose to re-probe all servers, but MVP treats cache-miss as a
 * "tool not available" error.
 *
 * Tiebreak: most-recently-used server wins.
 */
export async function resolveServerForTool(
  userId: string,
  toolName: string,
): Promise<McpServerRow | null> {
  const servers = await prisma.mcpServer.findMany({
    where: { userId, enabled: true },
    orderBy: { lastUsedAt: 'desc' },
  });
  for (const s of servers) {
    if (!s.cachedTools) continue;
    try {
      const raw = JSON.parse(s.cachedTools);
      // Support both old format (string[]) and new format ({name,...}[])
      const names: string[] = Array.isArray(raw)
        ? raw.map((item: unknown) => typeof item === 'string' ? item : (item as { name?: string })?.name || '')
        : [];
      if (names.includes(toolName)) {
        return s as unknown as McpServerRow;
      }
    } catch {
      // Malformed cache — skip this server. Install flow will refresh it
      // next time the user visits the UI.
    }
  }
  return null;
}

// ─── Public dispatch entry ───────────────────────────────────────────

export async function dispatchMcpTool(
  input: McpDispatchInput,
): Promise<McpDispatchResult> {
  const started = Date.now();

  // 1. Quota
  const quota = await checkMcpQuota(input.userId);
  if (!quota.allowed) {
    const msg = `MCP 工具调用今日已用完 ${quota.used}/${quota.limit} 次额度`;
    await logUsage(null, input, 1, 0, msg);
    return {
      success: false,
      toolName: input.toolName,
      errorMsg: msg,
      durationMs: Date.now() - started,
    };
  }

  // 2. Resolve server
  const server = await resolveServerForTool(input.userId, input.toolName);
  if (!server) {
    const msg = `未找到提供工具 "${input.toolName}" 的 MCP 服务器,请先在 /account/ai-tools 中安装`;
    await logUsage(null, input, 1, Date.now() - started, msg);
    return {
      success: false,
      toolName: input.toolName,
      errorMsg: msg,
      durationMs: Date.now() - started,
    };
  }

  // 3. Invoke via one-shot spawn
  try {
    const res = await invokeOne(server, input.toolName, input.args);
    if (res.isError) {
      const errText = summarizeContent(res.content) || '工具调用返回错误';
      await logUsage(server.id, input, 1, res.durationMs, errText);
      return {
        success: false,
        serverId: server.id,
        serverName: server.name,
        toolName: input.toolName,
        errorMsg: errText,
        durationMs: res.durationMs,
      };
    }

    // 4. Persist audit row + bump quota + update server lastUsedAt
    await logUsage(server.id, input, 0, res.durationMs, null, res.content);
    await bumpMcpQuota(input.userId);
    await prisma.mcpServer
      .update({ where: { id: server.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return {
      success: true,
      serverId: server.id,
      serverName: server.name,
      toolName: input.toolName,
      content: res.content,
      durationMs: res.durationMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'MCP 调用失败';
    await logUsage(server.id, input, 1, Date.now() - started, msg);
    return {
      success: false,
      serverId: server.id,
      serverName: server.name,
      toolName: input.toolName,
      errorMsg: msg,
      durationMs: Date.now() - started,
    };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────

async function logUsage(
  mcpServerId: string | null,
  input: McpDispatchInput,
  statusCode: number,
  durationMs: number,
  errorMsg: string | null,
  output?: unknown,
): Promise<void> {
  if (!mcpServerId) {
    // Pre-resolution failures (quota / no server) still get logged
    // but without a serverId. We use a sentinel row.
    return;
  }
  await prisma.mcpUsageLog
    .create({
      data: {
        userId: input.userId,
        mcpServerId,
        toolName: input.toolName,
        input: JSON.stringify(input.args).slice(0, 4096),
        output: output !== undefined ? JSON.stringify(output).slice(0, 4096) : null,
        statusCode,
        errorMsg: errorMsg ? errorMsg.slice(0, 1024) : null,
        durationMs,
      },
    })
    .catch(err => {
      console.error('[MCP_LOG_FAIL]', err instanceof Error ? err.message : 'unknown');
    });
}

function summarizeContent(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 200);
  if (Array.isArray(content)) {
    // MCP content blocks are usually [{type:'text', text:'...'}]
    for (const block of content) {
      if (block && typeof block === 'object' && 'text' in block && typeof (block as { text: unknown }).text === 'string') {
        return ((block as { text: string }).text).slice(0, 200);
      }
    }
  }
  return '';
}
