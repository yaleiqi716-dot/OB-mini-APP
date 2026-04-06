import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser, PLAN_CONFIG } from '@/services/billing';

const PLAN_ORDER = ['free', 'basic', 'pro', 'team'];

function planRank(plan: string): number {
  const idx = PLAN_ORDER.indexOf(plan);
  return idx >= 0 ? idx : 0;
}

// GET: return current subscription status
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const user = await getOrCreateUser(userId);
    return NextResponse.json({
      plan: user.plan,
      expireAt: user.expireAt?.toISOString() || null,
      currentPeriodEnd: user.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      canceledAt: user.canceledAt?.toISOString() || null,
      pendingPlan: user.pendingPlan,
    });
  } catch {
    return NextResponse.json({ error: '获取订阅状态失败' }, { status: 500 });
  }
}

// POST: cancel or downgrade subscription
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const { action, targetPlan } = await req.json() as { action: string; targetPlan?: string };
    const user = await getOrCreateUser(userId);

    if (user.plan === 'free') {
      return NextResponse.json({ error: '当前为 Free 套餐，无需操作' }, { status: 400 });
    }

    // ── Cancel subscription ──
    if (action === 'cancel') {
      if (user.cancelAtPeriodEnd) {
        return NextResponse.json({ error: '已设置到期取消' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
          pendingPlan: null, // cancel overrides any pending downgrade
        },
      });
      return NextResponse.json({
        ok: true,
        message: '已设置到期取消订阅',
        effectiveDate: user.currentPeriodEnd?.toISOString() || user.expireAt?.toISOString() || null,
      });
    }

    // ── Undo cancel ──
    if (action === 'undo_cancel') {
      if (!user.cancelAtPeriodEnd) {
        return NextResponse.json({ error: '未设置取消' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
      return NextResponse.json({ ok: true, message: '已撤销取消订阅' });
    }

    // ── Downgrade ──
    if (action === 'downgrade') {
      if (!targetPlan || !PLAN_CONFIG[targetPlan]) {
        return NextResponse.json({ error: '目标套餐无效' }, { status: 400 });
      }
      if (planRank(targetPlan) >= planRank(user.plan)) {
        return NextResponse.json({ error: '目标套餐不低于当前套餐' }, { status: 400 });
      }
      if (user.cancelAtPeriodEnd) {
        return NextResponse.json({ error: '已设置到期取消，请先撤销取消再设置降级' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingPlan: targetPlan,
        },
      });
      return NextResponse.json({
        ok: true,
        message: `已设置到期后降级为 ${targetPlan}`,
        effectiveDate: user.currentPeriodEnd?.toISOString() || user.expireAt?.toISOString() || null,
      });
    }

    // ── Undo downgrade ──
    if (action === 'undo_downgrade') {
      if (!user.pendingPlan) {
        return NextResponse.json({ error: '未设置待降级' }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: userId },
        data: { pendingPlan: null },
      });
      return NextResponse.json({ ok: true, message: '已撤销待降级' });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
