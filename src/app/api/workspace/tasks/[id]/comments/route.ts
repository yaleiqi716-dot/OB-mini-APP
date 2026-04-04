import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// GET — List comments for a workspace task
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    // Verify task exists and user has access
    const task = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: task.workspaceId, userId, status: 'active' },
    });
    if (!membership) return NextResponse.json({ error: '无权限' }, { status: 403 });

    const comments = await prisma.workspaceTaskComment.findMany({
      where: { workspaceTaskId: params.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Batch fetch user info for all comment authors
    const userIds = [...new Set(comments.map(c => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, { name: u.name, email: u.email }]));

    return NextResponse.json(comments.map(c => {
      const user = userMap.get(c.userId);
      return {
        id: c.id,
        userId: c.userId,
        userName: user?.name || user?.email || c.userId,
        content: c.content,
        createdAt: c.createdAt.toISOString(),
      };
    }));
  } catch (error) {
    console.error('[WS_COMMENTS_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST — Add a comment
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const task = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: task.workspaceId, userId, status: 'active' },
    });
    if (!membership) return NextResponse.json({ error: '无权限' }, { status: 403 });

    const body = await req.json();
    const { content } = body as { content?: string };

    if (!content || !content.trim()) {
      return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: '评论内容不能超过 2000 字' }, { status: 400 });
    }

    const comment = await prisma.workspaceTaskComment.create({
      data: {
        workspaceTaskId: params.id,
        userId,
        content: content.trim(),
      },
    });

    // Get user info for response
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    return NextResponse.json({
      id: comment.id,
      userId: comment.userId,
      userName: user?.name || user?.email || userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[WS_COMMENT_CREATE_ERROR]', error);
    return NextResponse.json({ error: '发送失败' }, { status: 500 });
  }
}
