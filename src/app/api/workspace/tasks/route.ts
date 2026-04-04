import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceMember, isErrorResponse } from '@/lib/workspace-auth';
import { notifyTaskAssigned } from '@/services/wecom';

// GET — List workspace tasks (filterable by status)
export async function GET(req: NextRequest) {
  try {
    const ctx = await withWorkspaceMember(req);
    if (isErrorResponse(ctx)) return ctx;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');

    const where: Record<string, unknown> = { workspaceId: ctx.workspaceId };
    if (status) where.businessStatus = status;
    if (assignee === 'me') where.assigneeId = ctx.userId;

    const tasks = await prisma.workspaceTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });

    return NextResponse.json(tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      businessStatus: t.businessStatus,
      priority: t.priority,
      createdBy: t.createdBy,
      assigneeId: t.assigneeId,
      dueAt: t.dueAt?.toISOString() || null,
      feedback: t.feedback,
      submissionSummary: t.submissionSummary,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })));
  } catch (error) {
    console.error('[WS_TASKS_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST — Create workspace task (owner only)
export async function POST(req: NextRequest) {
  try {
    const ctx = await withWorkspaceMember(req);
    if (isErrorResponse(ctx)) return ctx;
    if (ctx.role !== 'owner') return NextResponse.json({ error: '只有 Owner 可以创建任务' }, { status: 403 });

    const body = await req.json();
    const { title, description, priority, assigneeId, dueAt, attachments } = body;

    if (!title || !title.trim()) return NextResponse.json({ error: '请输入任务标题' }, { status: 400 });

    // Validate assignee is a workspace member
    if (assigneeId) {
      const assigneeMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.workspaceId, userId: assigneeId, status: 'active' },
      });
      if (!assigneeMember) return NextResponse.json({ error: '指派对象不是工作区成员' }, { status: 400 });
    }

    const task = await prisma.workspaceTask.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 0,
        createdBy: ctx.userId,
        assigneeId: assigneeId || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        businessStatus: assigneeId ? 'assigned' : 'draft',
      },
    });

    // Notify via WeCom if assigned
    if (assigneeId && task.id) {
      const owner = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } });
      notifyTaskAssigned(ctx.workspaceId, title, owner?.name || owner?.email || '管理员', task.id, assigneeId).catch(() => {});
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[WS_TASK_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
