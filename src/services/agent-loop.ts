import { chatCompletion } from '@/lib/openrouter';
import { prisma } from '@/lib/prisma';
import {
  createTask, updateTaskStatus, updateTaskContext,
  emitLog, emitThinking, emitEvent, completeTask,
} from './task-manager';
import { getWorkflow } from './workflows';
import { selectExecutionStrategy } from './agent-router';
import { estimateCost } from '@/lib/cost';
import { TaskType } from '@/types/task';

import './workflows';

const MAX_ITERATIONS = 5;

interface AgentAction {
  action: 'create_task' | 'revise' | 'complete';
  type?: string;
  input?: string;
  reason?: string;
  result?: string;
}

const AGENT_PROMPT = `你是任务执行Agent。你的职责是分析用户需求，决定下一步行动，并持续推进直到完成。

当前系统支持的任务类型：ppt / email / proposal / website / video

你必须返回JSON，格式如下：

如果需要创建新任务：
{"action":"create_task","type":"email","input":"具体任务描述","reason":"为什么需要这个任务"}

如果需要修正之前的输出：
{"action":"revise","type":"email","input":"修改要求","reason":"为什么需要修改"}

如果所有工作已完成：
{"action":"complete","reason":"完成原因","result":"最终总结"}

规则：
- 每次只返回一个action
- 优先执行最重要的任务
- 能一步完成就不要拆多步
- 只返回JSON`;

export async function runAgentLoop(
  parentTaskId: string,
  input: string,
  userId?: string
): Promise<void> {
  let iteration = 0;
  const history: { action: string; result: string }[] = [];

  await emitThinking(parentTaskId, '我来帮你规划一下整体方案...');

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    await emitLog(parentTaskId, `第 ${iteration} 轮决策...`);

    // Build context from history
    const historyText = history.length > 0
      ? '\n\n已完成的步骤：\n' + history.map((h, i) => `${i + 1}. ${h.action}: ${h.result}`).join('\n')
      : '';

    // Ask LLM for next action
    const response = await chatCompletion(
      [
        { role: 'system', content: AGENT_PROMPT },
        { role: 'user', content: `用户需求：${input}${historyText}\n\n请决定下一步行动：` },
      ],
      { temperature: 0.2, jsonMode: true, maxTokens: 512 }
    );

    let action: AgentAction;
    try {
      action = JSON.parse(response.content);
    } catch {
      console.error('[AGENT_LOOP] Failed to parse action:', response.content);
      break;
    }

    await emitThinking(parentTaskId, action.reason || '正在推进...');

    if (action.action === 'complete') {
      await emitLog(parentTaskId, action.reason || '所有任务已完成');
      await completeTask(parentTaskId, {
        type: 'agent_loop',
        summary: action.result || action.reason || '已完成',
        iterations: iteration,
        history,
      }, action.reason || '已帮你完成全部工作');
      return;
    }

    if (action.action === 'create_task' && action.type && action.input) {
      const taskType = action.type as TaskType;
      const strategy = selectExecutionStrategy(taskType);

      if (strategy === 'workflow') {
        const workflow = getWorkflow(taskType);
        if (workflow) {
          // Create and execute sub-task inline
          const subTask = await createTask(action.input, 'api', {
            userId,
            estimatedCost: estimateCost(taskType),
          });
          await prisma.task.update({
            where: { id: subTask.id },
            data: { type: taskType, title: action.input.slice(0, 50) },
          });
          await updateTaskStatus(subTask.id, 'queued');

          await emitEvent(parentTaskId, 'step_update', {
            step: `subtask_${iteration}`,
            text: `创建子任务：${action.input.slice(0, 40)}`,
            current: iteration,
            total: MAX_ITERATIONS,
          });

          history.push({ action: `create_task(${taskType})`, result: `子任务已创建：${subTask.id}` });
          continue;
        }
      }

      // Direct execution for unsupported types
      const directResult = await chatCompletion(
        [
          { role: 'system', content: '你是专业助手，直接完成用户的请求。' },
          { role: 'user', content: action.input },
        ],
        { temperature: 0.6, maxTokens: 2048 }
      );

      history.push({ action: `direct(${action.type})`, result: directResult.content.slice(0, 100) });
      continue;
    }

    if (action.action === 'revise' && action.input) {
      history.push({ action: 'revise', result: action.input.slice(0, 100) });
      continue;
    }

    // Unknown action — stop
    break;
  }

  // Max iterations reached
  await completeTask(parentTaskId, {
    type: 'agent_loop',
    summary: '已完成可执行的步骤',
    iterations: iteration,
    history,
  }, '已帮你推进到当前阶段');
}
