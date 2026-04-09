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
      include: {
        _count: { select: { comments: true } },
      },
    });

    // Batch fetch assignee names
    const assigneeIds = Array.from(new Set(tasks.map(t => t.assigneeId).filter(Boolean) as string[]));
    const users = assigneeIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = new Map(users.map(u => [u.id, u.name || u.email || u.id]));

    return NextResponse.json(tasks.map(t => {
      let attachmentCount = 0;
      try { if (t.attachments) attachmentCount = JSON.parse(t.attachments).length; } catch {}
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        businessStatus: t.businessStatus,
        priority: t.priority,
        createdBy: t.createdBy,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeId ? userMap.get(t.assigneeId) || null : null,
        dueAt: t.dueAt?.toISOString() || null,
        feedback: t.feedback,
        submissionSummary: t.submissionSummary,
        attachmentCount,
        commentCount: t._count.comments,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    }));
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
    const { title, description, priority: rawPriority, assigneeId, dueAt, attachments, preferredSkillRoles } = body;

    if (!title || !title.trim()) return NextResponse.json({ error: '请输入任务标题' }, { status: 400 });

    // Defensive: preferredSkillRoles must be an array of non-empty strings.
    // Silently ignore anything else so a bad client can't corrupt the row.
    let normalizedPreferredRoles: string[] | null = null;
    if (Array.isArray(preferredSkillRoles)) {
      const clean = preferredSkillRoles
        .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x: string) => x.trim())
        .slice(0, 5); // cap at 5 even if client sends more
      if (clean.length > 0) normalizedPreferredRoles = clean;
    }

    // Coerce priority to Int 0-3. Schema is Int, but be defensive: accept
    // numbers, numeric strings, and common label strings from any client.
    // Anything unrecognizable → 400, never 500.
    const priority = coercePriority(rawPriority);
    if (priority === null) {
      return NextResponse.json(
        { error: '优先级只接受 0-3 或 low/normal/medium/high/urgent' },
        { status: 400 },
      );
    }

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
        priority,
        createdBy: ctx.userId,
        assigneeId: assigneeId || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        preferredSkillRoles: normalizedPreferredRoles ? JSON.stringify(normalizedPreferredRoles) : null,
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

/**
 * Coerce a priority input to Int 0-3.
 *
 * The Prisma schema is Int, but we accept loose input from clients:
 *  - number 0/1/2/3                          → as-is
 *  - numeric string "0" / "1" / "2" / "3"    → parsed
 *  - label string low/normal/medium/high/urgent (case-insensitive)
 *  - undefined / null                        → 0 (default)
 *
 * Returns null for unrecognized input so the caller can emit a clear
 * 400 instead of crashing Prisma with a 500.
 */
function coercePriority(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    // Numeric string
    if (/^[0-3]$/.test(trimmed)) return Number(trimmed);
    // Label aliases
    const labelMap: Record<string, number> = {
      low: 0, '低': 0,
      normal: 0, '普通': 0,
      medium: 1, mid: 1, '中': 1,
      high: 2, '高': 2,
      urgent: 3, critical: 3, '紧急': 3,
    };
    if (trimmed in labelMap) return labelMap[trimmed];
  }
  return null;
}
