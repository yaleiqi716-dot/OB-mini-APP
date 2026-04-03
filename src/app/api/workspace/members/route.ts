import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET — List workspace members
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId, status: 'active' },
    });
    if (!membership) return NextResponse.json({ error: '未加入工作区' }, { status: 403 });

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: membership.workspaceId, status: 'active' },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json(members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt?.toISOString(),
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
    })));
  } catch (error) {
    console.error('[WORKSPACE_MEMBERS_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
