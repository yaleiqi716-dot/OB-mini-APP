import { BaseWorkflow, WorkflowContext, registerWorkflow } from './base-workflow';
import { WorkflowStep } from '@/types/workflow';
import { chatCompletion } from '@/lib/openrouter';
import {
  updateTaskStatus,
  updateTaskContext,
  updateTaskStep,
  requestInteraction,
  completeTask,
  failTask,
  emitLog,
  getTaskContext,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

const emailWorkflow: BaseWorkflow = {
  type: 'email',
  name: '邮件撰写',
  steps: [
    { id: 'clarify', name: '确认需求', description: '了解邮件类型和场景' },
    { id: 'draft', name: '生成草稿', description: '撰写邮件内容' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;
    try {
      await updateTaskStep(taskId, 'clarify');
      await emitLog(taskId, '正在分析邮件需求...');

      const result = await chatCompletion(
        [
          {
            role: 'system',
            content: `你是邮件撰写助手。根据用户需求，判断是否需要确认信息。
如果需求已经明确（包含收件人角色、目的），返回：{"needsClarification": false}
如果需要确认，返回：
{
  "needsClarification": true,
  "question": "确认问题",
  "options": ["选项1", "选项2", "选项3"]
}
只返回 JSON`,
          },
          { role: 'user', content: input },
        ],
        { temperature: 0.2, jsonMode: true, maxTokens: 256 }
      );

      const parsed = JSON.parse(result.content);

      if (parsed.needsClarification) {
        await updateTaskContext(taskId, { email: { tone: null } });
        await updateTaskStatus(taskId, 'interacting');
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'clarify_tone',
          type: 'single_choice',
          question: parsed.question,
          options: parsed.options.map((o: string) => ({ label: o, value: o })),
        });
      } else {
        await generateEmail(taskId, input, null);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;
    try {
      if (stepId === 'clarify_tone') {
        await updateTaskContext(taskId, { email: { tone: value } });
        await generateEmail(taskId, input, String(value));
      } else if (stepId === 'confirm_email') {
        if (value === true || value === 'yes') {
          const context = await getTaskContext(taskId);
          const draft = (context.email as Record<string, unknown>)?.draft;
          await completeTask(taskId, { type: 'email', content: draft });
          await emitLog(taskId, '邮件已生成完成');
        } else {
          await emitLog(taskId, '正在重新生成...');
          const context = await getTaskContext(taskId);
          const tone = (context.email as Record<string, unknown>)?.tone;
          await generateEmail(taskId, input, tone ? String(tone) : null);
        }
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理失败');
    }
  },
};

async function generateEmail(taskId: string, input: string, tone: string | null) {
  await updateTaskStep(taskId, 'draft');
  await updateTaskStatus(taskId, 'executing');
  await emitLog(taskId, '正在撰写邮件...');

  const toneHint = tone ? `\n语气要求：${tone}` : '';

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是专业的商务邮件撰写助手。根据用户需求撰写邮件。
返回 JSON：
{
  "subject": "邮件主题",
  "body": "邮件正文（使用换行符分段）",
  "summary": "一句话概要"
}
只返回 JSON`,
      },
      { role: 'user', content: input + toneHint },
    ],
    { temperature: 0.6, jsonMode: true, maxTokens: 2048 }
  );

  const parsed = JSON.parse(result.content);
  await updateTaskContext(taskId, { email: { tone, draft: parsed } });

  await updateTaskStatus(taskId, 'interacting');
  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'confirm_email',
    type: 'confirm',
    question: '请确认以下邮件内容',
    detail: `主题：${parsed.subject}\n\n${parsed.body}`,
  });
}

registerWorkflow(emailWorkflow);
export { emailWorkflow };
