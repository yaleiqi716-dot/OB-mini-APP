import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

// POST — Create a linked Agent task for this workspace task
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const wsTask = await prisma.workspaceTask.findUnique({ where: { id: params.id } });
    if (!wsTask) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

    // Only assignee can create agent tasks
    if (wsTask.assigneeId !== userId) {
      return NextResponse.json({ error: '只有任务负责人可以使用 Agent' }, { status: 403 });
    }

    // Must be in workable state
    if (!['assigned', 'in_progress', 'revision'].includes(wsTask.businessStatus)) {
      return NextResponse.json({ error: `当前状态 ${wsTask.businessStatus} 不允许执行` }, { status: 400 });
    }

    // Build context from workspace task
    const contextParts = [
      `【工作区任务】${wsTask.title}`,
      wsTask.description ? `【任务描述】${wsTask.description}` : '',
      wsTask.feedback ? `【修改意见】${wsTask.feedback}` : '',
      wsTask.dueAt ? `【截止时间】${wsTask.dueAt.toISOString().split('T')[0]}` : '',
      '【当前指令】请根据以上任务要求执行',
    ].filter(Boolean).join('\n');

    // Determine purpose
    const purpose = wsTask.businessStatus === 'revision' ? 'revision' : 'draft';

    // Create conversation for this workspace task
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        workspaceId: wsTask.workspaceId,
        title: wsTask.title,
      },
    });

    // Create agent task via DB (worker will pick it up)
    const agentTask = await prisma.task.create({
      data: {
        type: 'unknown',
        status: 'queued',
        title: wsTask.title,
        input: contextParts,
        source: 'agent',
        userId,
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

    // Auto-transition to in_progress if currently assigned
    if (wsTask.businessStatus === 'assigned') {
      await prisma.workspaceTask.update({
        where: { id: wsTask.id },
        data: { businessStatus: 'in_progress' },
      });
    }
    // revision stays as revision until member submits again

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
