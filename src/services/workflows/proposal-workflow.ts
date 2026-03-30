import { BaseWorkflow, WorkflowContext, registerWorkflow } from './base-workflow';
import { WorkflowStep } from '@/types/workflow';
import { ApprovalType, ApprovalAction } from '@/types/interaction';
import { chatCompletion } from '@/lib/openrouter';
import {
  updateTaskStatus,
  updateTaskContext,
  updateTaskStep,
  requestInteraction,
  completeTask,
  failTask,
  emitEvent,
  emitLog,
  getTaskContext,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

const proposalWorkflow: BaseWorkflow = {
  type: 'proposal',
  name: '方案策划',
  steps: [
    { id: 'clarify', name: '需求确认', description: '了解方案需求' },
    { id: 'structure', name: '生成框架', description: '生成方案结构' },
    { id: 'execute', name: '生成内容', description: '撰写详细内容' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;
    try {
      await updateTaskStep(taskId, 'clarify');
      await emitLog(taskId, '正在分析策划需求...');

      const result = await chatCompletion(
        [
          {
            role: 'system',
            content: `你是方案策划专家。根据用户需求生成一个关键确认问题。
返回 JSON：
{
  "question": "问题",
  "options": ["选项1", "选项2", "选项3"]
}
只返回 JSON`,
          },
          { role: 'user', content: input },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 256 }
      );

      const parsed = JSON.parse(result.content);
      await updateTaskContext(taskId, { proposal: { clarifications: [] } });
      await updateTaskStatus(taskId, 'interacting');
      await requestInteraction(taskId, {
        id: generateId(),
        taskId,
        stepId: 'clarify_scope',
        type: 'single_choice',
        question: parsed.question,
        options: parsed.options.map((o: string) => ({ label: o, value: o })),
      });
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;
    try {
      if (stepId === 'clarify_scope') {
        await updateTaskContext(taskId, { proposal: { scope: value } });
        await generateProposal(taskId, input, String(value));
      } else if (stepId === 'confirm_proposal') {
        if (value === true || value === 'yes') {
          const context = await getTaskContext(taskId);
          const draft = (context.proposal as Record<string, unknown>)?.content;
          await completeTask(taskId, { type: 'proposal', content: draft });
          await emitLog(taskId, '方案生成完成');
        } else {
          const context = await getTaskContext(taskId);
          const scope = (context.proposal as Record<string, unknown>)?.scope;
          await emitLog(taskId, '正在重新生成...');
          await generateProposal(taskId, input, String(scope));
        }
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理失败');
    }
  },

  async handleApproval(_ctx: WorkflowContext, _approvalType: ApprovalType, _action: ApprovalAction) {},
};

async function generateProposal(taskId: string, input: string, scope: string) {
  await updateTaskStep(taskId, 'execute');
  await updateTaskStatus(taskId, 'executing');
  await emitLog(taskId, '正在撰写方案...');

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是方案策划专家。根据需求撰写完整方案。
返回 JSON：
{
  "title": "方案标题",
  "sections": [
    {"heading": "章节标题", "content": "章节内容（详细）"}
  ],
  "summary": "方案概要"
}
要求：方案完整、专业、可执行。4-8个章节。
只返回 JSON`,
      },
      { role: 'user', content: `需求：${input}\n补充：${scope}` },
    ],
    { temperature: 0.6, jsonMode: true, maxTokens: 4096 }
  );

  const parsed = JSON.parse(result.content);
  await updateTaskContext(taskId, { proposal: { scope, content: parsed } });

  const detail = parsed.sections
    .map((s: { heading: string; content: string }) => `【${s.heading}】\n${s.content}`)
    .join('\n\n');

  await emitEvent(taskId, 'step_complete', { step: 'execute', data: parsed });
  await updateTaskStatus(taskId, 'interacting');
  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'confirm_proposal',
    type: 'confirm',
    question: `请确认方案：${parsed.title}`,
    detail,
  });
}

registerWorkflow(proposalWorkflow);
export { proposalWorkflow };
