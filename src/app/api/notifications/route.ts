import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET /api/notifications — list recent notifications
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('[NOTIFICATIONS_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
