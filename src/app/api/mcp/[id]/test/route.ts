import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { probeServer } from '@/services/mcp/runtime';

export const runtime = 'nodejs';

// POST /api/mcp/[id]/test
//
// Probes the server: spawn subprocess, do initialize handshake, call
// listTools, tear down. Updates cachedTools on success. UI uses this
// for the "测试连接" button and shows the tool list inline.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const server = await prisma.mcpServer.findUnique({ where: { id: params.id } });
    if (!server) return NextResponse.json({ error: '不存在' }, { status: 404 });
    if (server.userId !== userId) return NextResponse.json({ error: '无权限' }, { status: 403 });

    try {
      const probe = await probeServer({
        id: server.id,
        userId: server.userId,
        name: server.name,
        kind: server.kind,
        transport: server.transport,
        command: server.command,
        args: server.args,
        endpoint: server.endpoint,
        configEncrypted: server.configEncrypted,
      });
      const toolNames = probe.tools.map(t => t.name);
      await prisma.mcpServer.update({
        where: { id: server.id },
        data: { cachedTools: JSON.stringify(toolNames) },
      });
      return NextResponse.json({
        success: true,
        durationMs: probe.durationMs,
        tools: probe.tools.map(t => ({
          name: t.name,
          description: t.description || null,
        })),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'probe failed';
      return NextResponse.json({ success: false, error: msg }, { status: 200 });
    }
  } catch (err) {
    console.error('[MCP_TEST_ERROR]', err);
    return NextResponse.json({ error: '测试失败' }, { status: 500 });
  }
}
