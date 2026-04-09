import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

// GET /api/quota/video — current user's video generation quota usage today.
// Counts Task rows where externalEngine='minimax' (the only video provider
// currently wired) created since 02:00 local-equivalent (which is when
// Minimax's daily quota window also resets per the user's plan dashboard).
//
// Returns:
//   {
//     used:      <count of video tasks since the last 02:00 boundary>,
//     limit:     <daily limit, configurable via MINIMAX_DAILY_VIDEO_LIMIT env>,
//     remaining: limit - used (clamped to >= 0),
//     resetsAt:  ISO timestamp of next 02:00 boundary,
//   }
//
// Auth: required. Read from session cookie.
//
// Note: this is an APPROXIMATION of the user's actual Minimax quota.
// Minimax tracks quota server-side and is the source of truth — but
// querying their quota API per page load is wasteful. Counting our own
// task rows gives a "since OB started" view that's accurate as long as
// the user only generates videos through OrangeBench.

// 02:00 boundary aligns with Minimax's plan dashboard reset window.
// Tasks created from 02:00 today through 02:00 tomorrow count toward today.
function startOfQuotaWindow(now: Date): Date {
  const d = new Date(now);
  // Get current hour in user's local timezone (we use server local — same as
  // Minimax for users physically near Asia time zones; close enough)
  const h = d.getHours();
  if (h < 2) {
    // Before 2am — quota window started at 2am yesterday
    d.setDate(d.getDate() - 1);
  }
  d.setHours(2, 0, 0, 0);
  return d;
}

function nextQuotaReset(now: Date): Date {
  const start = startOfQuotaWindow(now);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return next;
}

const DAILY_LIMIT = Number(process.env.MINIMAX_DAILY_VIDEO_LIMIT || '3');

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const now = new Date();
    const windowStart = startOfQuotaWindow(now);

    const used = await prisma.task.count({
      where: {
        userId,
        externalEngine: 'minimax',
        createdAt: { gte: windowStart },
      },
    });

    return NextResponse.json({
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetsAt: nextQuotaReset(now).toISOString(),
    });
  } catch (err) {
    console.error('[QUOTA_VIDEO_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
