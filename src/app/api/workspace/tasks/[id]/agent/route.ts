import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, isErrorResponse } from '@/lib/workspace-auth';
import { getRoleById } from '@/lib/skills/registry';

// POST — Create a linked Agent task for this workspace task
// Body: { skillRoleId?: string }
//   When skillRoleId is provided, the new conversation is pinned to that
//   AI colleague persona and the role's system prompt is prepended to the
//   task input (same contract as POST /api/tasks). Usually set when the
//   assignee clicks a suggested-role chip on the task detail page; the
//   suggested chips come from workspaceTask.preferredSkillRoles.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await withAuth(req);
    if (isErrorResponse(ctx)) return ctx;

    // Parse optional body — some callers still POST with no body (the plain
    // "用 Agent 执行" button). Treat parse failure as {}.
    let skillRoleId: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body.skillRoleId === 'string' && body.skillRoleId.trim()) {
        skillRoleId = body.skillRoleId.trim();
      }
    } catch {
      // no body, no skill role — that's fine
    }

    const wsTask = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!wsTask) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Only assignee can create agent tasks
    if (wsTask.assigneeId !== ctx.userId) {
      return NextResponse.json({ error: '只有任务负责人可以使用 Agent' }, { status: 403 });
    }

    // Must be in workable state
    if (!['assigned', 'in_progress', 'revision'].includes(wsTask.businessStatus)) {
      return NextResponse.json({ error: `当前状态 ${wsTask.businessStatus} 不允许执行` }, { status: 400 });
    }

    // Build the workspace-task context preamble (same shape as before,
    // always included regardless of skillRoleId).
    const wsContextParts = [
      `【工作区任务】${wsTask.title}`,
      wsTask.description ? `【任务描述】${wsTask.description}` : '',
      wsTask.feedback ? `【修改意见】${wsTask.feedback}` : '',
      wsTask.dueAt ? `【截止时间】${wsTask.dueAt.toISOString().split('T')[0]}` : '',
      '【当前指令】请根据以上任务要求执行',
    ].filter(Boolean).join('\n');

    // If a skill role is requested, prepend the persona preamble.
    // This mirrors the injection logic in /api/tasks/route.ts so that
    // workspace-launched agent tasks and direct /agent tasks get the
    // same role treatment. The worker's title-derivation logic will
    // strip '【用户任务】' and use that as the task.title.
    let finalInput = wsContextParts;
    if (skillRoleId) {
      const role = await getRoleById(skillRoleId);
      if (role) {
        const personaBody =
          role.systemPrompt.length > 1200
            ? role.systemPrompt.slice(0, 1200) + '\n...(已截断)'
            : role.systemPrompt;
        finalInput = `【AI 同事角色】${role.name}\n${personaBody}\n\n---\n\n【用户任务】${wsContextParts}`;
      } else {
        // Invalid role id — silently fall through to plain context.
        skillRoleId = null;
      }
    }

    // Determine purpose
    const purpose = wsTask.businessStatus === 'revision' ? 'revision' : 'draft';

    // Create conversation for this workspace task. Pin the skill role if
    // one was selected — the conversation's picker will now show this role
    // as active, and subsequent tasks in the same conversation will reuse it.
    const conversation = await prisma.conversation.create({
      data: {
        userId: ctx.userId,
        workspaceId: wsTask.workspaceId,
        title: wsTask.title,
        skillRoleId: skillRoleId,
      },
    });

    // Create agent task via DB (worker will pick it up).
    // input = (optional persona preamble) + workspace context. Worker will
    // strip the persona preamble when deriving the task title.
    const agentTask = await prisma.task.create({
      data: {
        type: 'unknown',
        status: 'queued',
        title: wsTask.title,
        input: finalInput,
        source: 'agent',
        userId: ctx.userId,
        conversationId: conversation.id,
        workspaceTaskId: wsTask.id,
        priority: wsTask.priority,
      },
    });

    // Create the link
    await prisma.workspaceTaskLink.create({
      data: {
        workspaceTaskId: wsTask.id,
        agentTaskId: agentTask.id,
        conversationId: conversation.id,
        purpose,
      },
    });

    // Auto-transition to in_progress if currently assigned or revision
    if (wsTask.businessStatus === 'assigned' || wsTask.businessStatus === 'revision') {
      await prisma.workspaceTask.update({
        where: { id: wsTask.id },
        data: { businessStatus: 'in_progress' },
      });
    }

    return NextResponse.json({
      success: true,
      agentTaskId: agentTask.id,
      conversationId: conversation.id,
      redirectUrl: `/agent?conversationId=${conversation.id}`,
    });
  } catch (error) {
    console.error('[WS_TASK_AGENT_ERROR]', error);
    return NextResponse.json({ error: '创建 Agent 任务失败' }, { status: 500 });
  }
}
