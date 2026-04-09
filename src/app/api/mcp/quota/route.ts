import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { checkMcpQuota } from '@/services/mcp/dispatcher';

export const runtime = 'nodejs';

// GET /api/mcp/quota
//   Daily MCP tool-call quota for the authenticated user. Separate
//   from browse quota and billing credits.
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const q = await checkMcpQuota(userId);
    return NextResponse.json({
      used: q.used,
      limit: q.limit,
      remaining: Math.max(0, q.limit - q.used),
      allowed: q.allowed,
    });
  } catch (err) {
    console.error('[MCP_QUOTA_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
