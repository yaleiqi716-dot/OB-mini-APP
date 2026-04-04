import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// POST /api/notifications/mark-read
// body: { id?: string } — mark single, or omit id to mark all
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { id } = body as { id?: string };

    if (id) {
      // Mark single notification
      await prisma.notification.updateMany({
        where: { id, userId, read: false },
        data: { read: true },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[NOTIFICATIONS_MARK_READ_ERROR]', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
