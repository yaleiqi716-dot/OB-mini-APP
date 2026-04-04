import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { notifyTaskAssigned } from '@/services/wecom';

// GET — Task detail with linked agent tasks
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const task = await prisma.workspaceTask.findUnique({
      where: { id: params.id },
      include: {
        links: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Verify user is a member of this workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: task.workspaceId, userId, status: 'active' },
    });
    if (!membership) return NextResponse.json({ error: '无权限' }, { status: 403 });

    // Fetch linked agent tasks for display
    const agentTaskIds = task.links.map(l => l.agentTaskId);
    const agentTasks = agentTaskIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: agentTaskIds } },
          select: { id: true, title: true, status: true, input: true, result: true, createdAt: true, conversationId: true },
        })
      : [];

    // Parse JSON attachment fields
    let parsedAttachments = [];
    let parsedSubAttachments = [];
    try { if (task.attachments) parsedAttachments = JSON.parse(task.attachments); } catch {}
    try { if (task.submissionAttachments) parsedSubAttachments = JSON.parse(task.submissionAttachments); } catch {}

    return NextResponse.json({
      ...task,
      attachments: parsedAttachments,
      submissionAttachments: parsedSubAttachments,
      dueAt: task.dueAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      agentTasks: agentTasks.map(at => ({
        id: at.id,
        title: at.title,
        status: at.status,
        conversationId: at.conversationId,
        createdAt: at.createdAt.toISOString(),
        hasResult: !!at.result,
      })),
      links: task.links.map(l => ({
        id: l.id,
        agentTaskId: l.agentTaskId,
        conversationId: l.conversationId,
        purpose: l.purpose,
        submittedAt: l.submittedAt?.toISOString() || null,
      })),
      userRole: membership.role,
    });
  } catch (error) {
    console.error('[WS_TASK_DETAIL_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// PATCH — Update task (assign, change title, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const task = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Only owner can update tasks
    const workspace = await prisma.workspace.findUnique({ where: { id: task.workspaceId } });
    if (!workspace || workspace.ownerId !== userId) {
      return NextResponse.json({ error: '只有 Owner 可以修改任务' }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.attachments !== undefined) data.attachments = body.attachments ? JSON.stringify(body.attachments) : null;

    // Handle assignment
    if (body.assigneeId !== undefined) {
      if (body.assigneeId) {
        const member = await prisma.workspaceMember.findFirst({
          where: { workspaceId: task.workspaceId, userId: body.assigneeId, status: 'active' },
        });
        if (!member) return NextResponse.json({ error: '指派对象不是工作区成员' }, { status: 400 });
      }
      data.assigneeId = body.assigneeId || null;
      // Auto-transition to assigned if currently draft
      if (body.assigneeId && task.businessStatus === 'draft') {
        data.businessStatus = 'assigned';
      }
    }

    const updated = await prisma.workspaceTask.update({
      where: { id: params.id },
      data,
    });

    // Notify if newly assigned
    if (body.assigneeId && data.businessStatus === 'assigned') {
      const owner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      notifyTaskAssigned(task.workspaceId, task.title, owner?.name || owner?.email || '管理员', task.id).catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[WS_TASK_UPDATE_ERROR]', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
