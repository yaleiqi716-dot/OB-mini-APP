import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/mcp
//   List the authenticated user's installed MCP servers. Metadata only —
//   configEncrypted is NEVER returned. Includes derived fields:
//     toolCount   — parsed from cachedTools JSON
//     hasConfig   — boolean; UI shows "已配置" badge
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const servers = await prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        kind: true,
        transport: true,
        command: true,
        args: true,
        enabled: true,
        scopes: true,
        cachedTools: true,
        lastUsedAt: true,
        createdAt: true,
        configEncrypted: true,
      },
    });

    return NextResponse.json(
      servers.map(s => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        transport: s.transport,
        command: s.command,
        args: s.args,
        enabled: s.enabled,
        scopes: safeParseArray(s.scopes),
        tools: extractToolNames(s.cachedTools),
        toolCount: extractToolNames(s.cachedTools).length,
        hasConfig: s.configEncrypted.length > 0,
        lastUsedAt: s.lastUsedAt?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    console.error('[MCP_LIST_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

/** Extract tool names from cachedTools — supports both old string[] and new descriptor[] formats */
function extractToolNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: unknown) => typeof item === 'string' ? item : (item as { name?: string })?.name || '').filter(Boolean);
  } catch {
    return [];
  }
}

function safeParseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
