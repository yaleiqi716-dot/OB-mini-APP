import { BaseWorkflow, WorkflowContext, registerWorkflow } from './base-workflow';
import { WorkflowStep } from '@/types/workflow';
import { chatCompletion } from '@/lib/openrouter';
import {
  updateTaskStatus,
  updateTaskContext,
  updateTaskStep,
  requestInteraction,
  completeTask,
  emitEvent,
  emitLog,
  getTaskContext,
  failTask,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

interface EmailContext {
  tone: string | null;
  draft: { subject: string; body: string } | null;
}

const emailWorkflow: BaseWorkflow = {
  type: 'email',
  name: '邮件撰写',
  steps: [
    { id: 'understanding', name: '理解需求', description: '分析邮件需求' },
    { id: 'drafting', name: '生成草稿', description: '撰写邮件内容' },
    { id: 'confirming', name: '确认发送', description: '确认邮件并发送' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;

    try {
      await updateTaskStep(taskId, 'understanding');
      await updateTaskStatus(taskId, 'understanding');
      await emitLog(taskId, '正在理解邮件需求...');

      const analysis = await chatCompletion(
        [
          {
            role: 'system',
            content: `你是邮件撰写助手。根据用户需求判断是否能直接撰写邮件。

如果需求已经比较明确（能判断出收件人角色和大致目的），返回：
{"ready": true}

如果关键信息明显缺失（完全不知道写给谁或什么目的），返回：
{"ready": false, "question": "一个简短的确认问题", "options": ["选项1", "选项2", "选项3"]}

规则：
- 只要能猜出大概意图就返回 ready: true
- 最多问 1 个问题
- 问题要简短、选项要具体
- 只返回 JSON`,
          },
          { role: 'user', content: input },
        ],
        { temperature: 0.2, jsonMode: true, maxTokens: 256 }
      );

      const parsed = JSON.parse(analysis.content);

      if (parsed.ready === false && parsed.question) {
        await updateTaskContext(taskId, { email: { tone: null, draft: null } });
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'clarify_tone',
          type: 'single_choice',
          question: parsed.question,
          options: (parsed.options || []).map((o: string) => ({ label: o, value: o })),
        });
      } else {
        await generateEmailDraft(taskId, input, null);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;

    try {
      if (stepId === 'clarify_tone') {
        await updateTaskContext(taskId, { email: { tone: String(value), draft: null } });
        await generateEmailDraft(taskId, input, String(value));

      } else if (stepId === 'revise_email_request') {
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'revise_email',
          type: 'text_input',
          question: '你希望我怎么调整这封邮件？',
          placeholder: '例如：语气更坚定一些，缩短到三段',
        });

      } else if (stepId === 'revise_email') {
        const hint = String(value || '');
        const context = await getTaskContext(taskId);
        const emailCtx = context.email as EmailContext | undefined;
        const currentDraft = emailCtx?.draft;

        await emitLog(taskId, '正在根据反馈调整邮件...');
        await generateEmailDraft(taskId, input, emailCtx?.tone || null, hint, currentDraft);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理失败');
    }
  },
};

async function generateEmailDraft(
  taskId: string,
  input: string,
  tone: string | null,
  revisionHint?: string,
  previousDraft?: { subject: string; body: string } | null
) {
  await updateTaskStep(taskId, 'drafting');
  await updateTaskStatus(taskId, 'executing');
  await emitLog(taskId, '正在撰写邮件...');

  let userPrompt = input;
  if (tone) userPrompt += `\n语气要求：${tone}`;
  if (revisionHint && previousDraft) {
    userPrompt += `\n\n当前草稿主题：${previousDraft.subject}\n当前草稿正文：${previousDraft.body}\n\n修改要求：${revisionHint}`;
  }

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是专业的商务邮件撰写助手。根据用户需求撰写邮件。

返回 JSON：
{
  "subject": "邮件主题",
  "body": "邮件正文（使用换行符分段，专业、简洁）"
}

规则：
- 邮件正文简洁专业
- 不超过 5 段
- 主题不超过 20 字
- 只返回 JSON`,
      },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.6, jsonMode: true, maxTokens: 2048 }
  );

  const parsed = JSON.parse(result.content);
  const draft = {
    subject: parsed.subject || '（未生成主题）',
    body: parsed.body || '（未生成正文）',
  };

  await updateTaskContext(taskId, { email: { tone, draft } });

  await emitEvent(taskId, 'step_update', {
    step: 'draft_complete',
    text: '邮件草稿已生成',
  });

  await emitLog(taskId, '邮件草稿已生成，等待确认发送...');

  // Use detailData for structured email data (no string parsing needed on frontend)
  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'confirm_send',
    type: 'confirm',
    question: '邮件草稿已就绪，请确认发送',
    detail: `主题：${draft.subject}\n\n${draft.body}`,
    detailData: { subject: draft.subject, body: draft.body },
  });
}

registerWorkflow(emailWorkflow);
export { emailWorkflow };
