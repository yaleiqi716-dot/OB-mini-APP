import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { checkDailyQuota } from '@/services/tools/browse';

export const runtime = 'nodejs';

// GET /api/browse/quota
//   Returns the user's daily browse tool quota usage for display in
//   the AgentInput toolbar and the /account/browse-sites header.
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const q = await checkDailyQuota(userId);
    return NextResponse.json({
      used: q.used,
      limit: q.limit,
      remaining: Math.max(0, q.limit - q.used),
      allowed: q.allowed,
    });
  } catch (err) {
    console.error('[BROWSE_QUOTA_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
