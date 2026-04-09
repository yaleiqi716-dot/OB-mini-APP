import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import {
  getCatalogEntry,
  renderArgsTemplate,
  MCP_CATALOG,
} from '@/services/mcp/catalog';
import { encryptConfig, probeServer, McpConfigBlob } from '@/services/mcp/runtime';

export const runtime = 'nodejs';

// POST /api/mcp/install
//   Body: { kind, name?, config: {...}, autoProbe? }
//
// Installs a new MCP server for the authenticated user.
//
// Flow:
//   1. Look up catalog entry by kind
//   2. Validate required config fields
//   3. Encrypt config blob with MCP vault
//   4. Render argsTemplate using config values
//   5. For 'custom' kind: pull command + args + env from config fields
//   6. INSERT McpServer row
//   7. If autoProbe (default true): probeServer() to populate cachedTools
//      — errors here are surfaced but don't rollback the install
//   8. Return { id, name, kind, toolCount, probeError? }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const bodyText = await req.text();
    if (bodyText.length > 32 * 1024) {
      return NextResponse.json({ error: '请求体过大' }, { status: 413 });
    }
    let body: {
      kind?: string;
      name?: string;
      config?: Record<string, unknown>;
      autoProbe?: boolean;
    };
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
    }

    const entry = body.kind ? getCatalogEntry(body.kind) : null;
    if (!entry) {
      return NextResponse.json(
        { error: `未知的 kind '${body.kind}',可选: ${MCP_CATALOG.map(e => e.kind).join(', ')}` },
        { status: 400 },
      );
    }
    const config = (body.config && typeof body.config === 'object') ? body.config : {};

    // Required-field validation
    for (const field of entry.fields) {
      if (!field.required) continue;
      const val = config[field.name];
      if (typeof val !== 'string' || val.trim().length === 0) {
        return NextResponse.json(
          { error: `缺少必填字段: ${field.label}` },
          { status: 400 },
        );
      }
    }

    // Build the command + args that will be stored
    let command: string;
    let args: string;
    const configBlob: McpConfigBlob = {};

    if (entry.kind === 'custom') {
      // Pull command/args/env straight from config
      const cmdRaw = typeof config.command === 'string' ? config.command.trim() : '';
      const argsRaw = typeof config.args === 'string' ? config.args : '';
      const envJsonRaw = typeof config.envJson === 'string' ? config.envJson : '';
      if (!cmdRaw) {
        return NextResponse.json({ error: '自定义 MCP 必须填写命令' }, { status: 400 });
      }
      command = cmdRaw;
      args = argsRaw;
      if (envJsonRaw.trim()) {
        try {
          const parsed = JSON.parse(envJsonRaw);
          if (typeof parsed === 'object' && parsed !== null) {
            configBlob.env = Object.fromEntries(
              Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
            );
          }
        } catch {
          return NextResponse.json({ error: '环境变量必须是合法 JSON' }, { status: 400 });
        }
      }
    } else {
      command = entry.command;
      args = renderArgsTemplate(entry.argsTemplate, config);
      // Path/text fields don't need to live in the encrypted blob —
      // they're embedded in argsTemplate already. Only secrets
      // (apiKey/token-style fields) belong in configBlob.
      for (const field of entry.fields) {
        if (field.type === 'password' && typeof config[field.name] === 'string') {
          (configBlob as Record<string, unknown>)[field.name] = config[field.name];
        }
      }
    }

    const ciphertext = encryptConfig(configBlob);

    const created = await prisma.mcpServer.create({
      data: {
        userId,
        name: (body.name && body.name.trim()) || entry.label,
        kind: entry.kind,
        transport: 'stdio',
        command,
        args: args || null,
        configEncrypted: ciphertext,
        scopes: JSON.stringify(entry.scopes),
        enabled: true,
      },
    });

    // Auto-probe (default on) — populates cachedTools so the dispatcher
    // resolver works immediately. Probe failures don't rollback the
    // install; user can retry via /test.
    let probeError: string | null = null;
    let toolCount = 0;
    if (body.autoProbe !== false) {
      try {
        const probe = await probeServer({
          id: created.id,
          userId: created.userId,
          name: created.name,
          kind: created.kind,
          transport: created.transport,
          command: created.command,
          args: created.args,
          endpoint: created.endpoint,
          configEncrypted: created.configEncrypted,
        });
        const toolNames = probe.tools.map(t => t.name);
        toolCount = toolNames.length;
        await prisma.mcpServer.update({
          where: { id: created.id },
          data: { cachedTools: JSON.stringify(toolNames) },
        });
      } catch (err) {
        probeError = err instanceof Error ? err.message : 'probe failed';
        console.error('[MCP_INSTALL_PROBE_FAIL]', probeError);
      }
    }

    return NextResponse.json({
      id: created.id,
      name: created.name,
      kind: created.kind,
      enabled: true,
      toolCount,
      probeError,
    });
  } catch (err) {
    console.error('[MCP_INSTALL_ERROR]', err);
    return NextResponse.json({ error: '安装失败' }, { status: 500 });
  }
}
