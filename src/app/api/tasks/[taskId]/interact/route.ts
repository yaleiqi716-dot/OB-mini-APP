import { NextRequest, NextResponse } from 'next/server';
import { getTask, emitEvent, updateTaskStatus, updateTaskContext, emitLog, emitThinking, completeTask } from '@/services/task-manager';
import { getWorkflow } from '@/services/workflows';
import { InteractionSubmitRequest } from '@/types/api';
import { TaskType } from '@/types/task';
import '@/services/workflows';

export async function POST(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;
    const body: InteractionSubmitRequest = await req.json();
    const task = await getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    if (task.status !== 'interacting' && task.status !== 'structuring') {
      return NextResponse.json({ error: '任务当前不在交互状态' }, { status: 400 });
    }

    await emitEvent(taskId, 'interaction_response', {
      stepId: body.stepId,
      value: body.value as Record<string, unknown>,
    });

    // Special case: agent_clarification — resume the main execution chain
    // This stepId is produced by worker.ts Router phase when needsClarification=true.
    // task.type is still 'unknown' so no workflow exists — we must re-run dispatch.
    if (body.stepId === 'agent_clarification') {
      handleAgentClarificationResume(taskId, task.input, String(body.value || '')).catch(console.error);
      return NextResponse.json({ success: true });
    }

    const workflow = getWorkflow(task.type as TaskType);
    if (!workflow) {
      return NextResponse.json({ error: '未找到对应的工作流' }, { status: 400 });
    }
    workflow
      .handleInteraction({ taskId, input: task.input, context: {} }, body.stepId, body.value)
      .catch(console.error);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('提交交互失败:', error);
    return NextResponse.json({ error: '提交交互失败', detail: String(error) }, { status: 500 });
  }
}

async function handleAgentClarificationResume(taskId: string, originalInput: string, clarification: string) {
  try {
    const { routeIntent } = await import('@/services/agent/router');
    const { dispatch, ASYNC_INTENTS } = await import('@/services/agent/dispatch');
    const { estimateCost } = await import('@/lib/cost');
    const { prisma } = await import('@/lib/prisma');
    const { updateTaskType } = await import('@/services/task-manager');

    await updateTaskStatus(taskId, 'understanding');
    await emitLog(taskId, '收到补充信息，继续分析...');
    await emitThinking(taskId, '好，根据你补充的信息，我重新帮你规划一下...');

    const enrichedInput = clarification
      ? `${originalInput}\n补充信息：${clarification}`
      : originalInput;

    const decision = await routeIntent(enrichedInput);
    await updateTaskContext(taskId, {
      agentIntent: decision.intent,
      agentReason: decision.reason,
      clarificationReceived: clarification,
    });

    const intentType = decision.intent;
    const cost = estimateCost(intentType);
    await prisma.task.update({ where: { id: taskId }, data: { estimatedCost: cost } });
    const title = enrichedInput.slice(0, 50);
    await updateTaskType(taskId, 'unknown' as TaskType, title);
    await updateTaskContext(taskId, { executionStrategy: 'agent_dispatch', engine: intentType });
    await emitLog(taskId, `执行方式：${intentType}`);
    await updateTaskStatus(taskId, 'executing');
    await emitThinking(taskId, '正在执行任务...');

    const result = await dispatch(decision, enrichedInput);
    if (!result.success) {
      const { failTask } = await import('@/services/task-manager');
      await failTask(taskId, result.message || '执行失败');
      return;
    }

    const isAsync = ASYNC_INTENTS.has(intentType) && result.data._async;
    if (isAsync) {
      const jobId = String(result.data.jobId || '');
      await prisma.task.update({
        where: { id: taskId },
        data: { externalJobId: jobId, externalEngine: result.engine },
      });
      await emitLog(taskId, result.message);
      return;
    }

    await completeTask(taskId, result.data, result.message);
  } catch (error) {
    console.error('[INTERACT] agent_clarification resume failed:', error);
    const { failTask } = await import('@/services/task-manager');
    await failTask(taskId, error instanceof Error ? error.message : '继续执行失败');
  }
}
