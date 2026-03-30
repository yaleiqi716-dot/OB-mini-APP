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
  emitEvent,
  emitLog,
  getTaskContext,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

interface PPTContext {
  currentPhase: 'clarify' | 'outline' | 'execute';
  clarifications: { question: string; answer: string }[];
  pendingQuestions: { question: string; options: string[] }[];
  questionIndex: number;
  outline: { slideIndex: number; title: string; keyPoints: string[] }[];
  slides: { index: number; title: string; content: string[]; notes: string }[];
}

const defaultPPTContext: PPTContext = {
  currentPhase: 'clarify',
  clarifications: [],
  pendingQuestions: [],
  questionIndex: 0,
  outline: [],
  slides: [],
};

const pptWorkflow: BaseWorkflow = {
  type: 'ppt',
  name: '演示文稿',
  steps: [
    { id: 'clarify', name: '需求确认', description: '了解演示文稿的具体需求' },
    { id: 'outline', name: '生成大纲', description: '生成演示文稿结构' },
    { id: 'execute', name: '生成内容', description: '生成每一页的详细内容' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;

    try {
      await updateTaskStep(taskId, 'clarify');
      await emitLog(taskId, '正在分析你的需求...');

      // Generate clarification questions via AI
      const result = await chatCompletion(
        [
          {
            role: 'system',
            content: `你是一个专业的演示文稿设计师。用户想要制作一份演示文稿。
根据用户的描述，生成1-2个关键的确认问题，帮助你更好地理解需求。

请以 JSON 格式返回：
{
  "questions": [
    {
      "question": "问题内容",
      "options": ["选项1", "选项2", "选项3"]
    }
  ]
}

规则：
- 最多2个问题
- 每个问题2-4个选项
- 问题要具体、有针对性
- 不要问过于宽泛的问题
- 只返回 JSON`,
          },
          { role: 'user', content: input },
        ],
        { temperature: 0.3, jsonMode: true, maxTokens: 512 }
      );

      const parsed = JSON.parse(result.content);
      const questions = parsed.questions || [];

      if (questions.length === 0) {
        // No questions needed, go directly to outline
        const pptCtx: PPTContext = { ...defaultPPTContext, currentPhase: 'outline', clarifications: [] };
        await updateTaskContext(taskId, { ppt: pptCtx });
        await generateOutline(taskId, input, []);
        return;
      }

      const pptCtx: PPTContext = {
        ...defaultPPTContext,
        pendingQuestions: questions,
        questionIndex: 0,
      };
      await updateTaskContext(taskId, { ppt: pptCtx });

      // Ask first question
      await askQuestion(taskId, questions[0], 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '启动失败';
      await failTask(taskId, msg);
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;
    const taskContext = await getTaskContext(taskId);
    const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;

    try {
      if (stepId.startsWith('question_')) {
        // Handle clarification answer
        const qIndex = pptCtx.questionIndex;
        const currentQ = pptCtx.pendingQuestions[qIndex];

        const updatedClarifications = [
          ...pptCtx.clarifications,
          { question: currentQ.question, answer: String(value) },
        ];

        const nextIndex = qIndex + 1;

        if (nextIndex < pptCtx.pendingQuestions.length) {
          // Ask next question
          const updated: PPTContext = {
            ...pptCtx,
            clarifications: updatedClarifications,
            questionIndex: nextIndex,
          };
          await updateTaskContext(taskId, { ppt: updated });
          await askQuestion(taskId, pptCtx.pendingQuestions[nextIndex], nextIndex);
        } else {
          // All questions answered, generate outline
          const updated: PPTContext = {
            ...pptCtx,
            clarifications: updatedClarifications,
            currentPhase: 'outline',
          };
          await updateTaskContext(taskId, { ppt: updated });
          await emitLog(taskId, '需求确认完成，正在生成大纲...');
          await generateOutline(taskId, input, updatedClarifications);
        }
      } else if (stepId === 'confirm_outline') {
        if (value === true || value === 'yes') {
          // Outline confirmed, start generating content
          const updated: PPTContext = { ...pptCtx, currentPhase: 'execute' };
          await updateTaskContext(taskId, { ppt: updated });
          await emitLog(taskId, '大纲确认，开始生成内容...');
          await generateSlides(taskId, input, pptCtx);
        } else {
          // User rejected, allow modification (for now restart outline)
          await emitLog(taskId, '正在重新生成大纲...');
          await generateOutline(taskId, input, pptCtx.clarifications);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '处理交互失败';
      await failTask(taskId, msg);
    }
  },
};

async function askQuestion(
  taskId: string,
  q: { question: string; options: string[] },
  index: number
) {
  await updateTaskStatus(taskId, 'interacting');
  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: `question_${index}`,
    type: 'single_choice',
    question: q.question,
    options: q.options.map((opt, i) => ({ label: opt, value: opt })),
  });
}

async function generateOutline(
  taskId: string,
  input: string,
  clarifications: { question: string; answer: string }[]
) {
  await updateTaskStep(taskId, 'outline');
  await updateTaskStatus(taskId, 'executing');

  const clarificationText = clarifications.length > 0
    ? '\n\n补充信息：\n' + clarifications.map(c => `问：${c.question}\n答：${c.answer}`).join('\n')
    : '';

  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是一个专业的演示文稿设计师。根据用户的需求生成演示文稿大纲。

请以 JSON 格式返回：
{
  "outline": [
    {
      "slideIndex": 0,
      "title": "页面标题",
      "keyPoints": ["要点1", "要点2", "要点3"]
    }
  ]
}

规则：
- 6-12页为宜
- 结构清晰、逻辑连贯
- 每页2-4个要点
- 包含封面和总结页
- 只返回 JSON`,
      },
      { role: 'user', content: input + clarificationText },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 2048 }
  );

  const parsed = JSON.parse(result.content);
  const outline = parsed.outline || [];

  const taskContext = await getTaskContext(taskId);
  const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;
  const updated: PPTContext = { ...pptCtx, outline };
  await updateTaskContext(taskId, { ppt: updated });

  await emitEvent(taskId, 'step_complete', {
    step: 'outline',
    data: outline,
  });

  // Ask user to confirm outline
  const outlineText = outline
    .map((s: { slideIndex: number; title: string; keyPoints: string[] }) =>
      `第${s.slideIndex + 1}页：${s.title}\n${s.keyPoints.map((p: string) => `  · ${p}`).join('\n')}`
    )
    .join('\n\n');

  await updateTaskStatus(taskId, 'interacting');
  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'confirm_outline',
    type: 'confirm',
    question: '请确认以下演示文稿大纲',
    detail: outlineText,
  });
}

async function generateSlides(
  taskId: string,
  input: string,
  pptCtx: PPTContext
) {
  await updateTaskStep(taskId, 'execute');
  await updateTaskStatus(taskId, 'executing');

  const slides: { index: number; title: string; content: string[]; notes: string }[] = [];

  for (const page of pptCtx.outline) {
    await emitLog(taskId, `正在生成第 ${page.slideIndex + 1} 页：${page.title}`);

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `你是一个专业的演示文稿内容撰写者。根据页面大纲生成详细内容。

请以 JSON 格式返回：
{
  "title": "页面标题",
  "content": ["内容要点1（一句话展开）", "内容要点2", "内容要点3"],
  "notes": "演讲者备注（2-3句话）"
}

规则：
- 内容要点简洁有力，适合展示
- 每个要点一句话，不超过30字
- 备注是给演讲者看的补充说明
- 只返回 JSON`,
        },
        {
          role: 'user',
          content: `演示文稿主题：${input}\n\n当前页面：\n标题：${page.title}\n要点：${page.keyPoints.join('、')}`,
        },
      ],
      { temperature: 0.6, jsonMode: true, maxTokens: 1024 }
    );

    const parsed = JSON.parse(result.content);
    const slide = {
      index: page.slideIndex,
      title: parsed.title || page.title,
      content: parsed.content || page.keyPoints,
      notes: parsed.notes || '',
    };

    slides.push(slide);

    await emitEvent(taskId, 'step_complete', {
      step: `slide_${page.slideIndex}`,
      data: slide,
    });
  }

  // Complete the task
  const finalResult = {
    type: 'ppt',
    title: pptCtx.outline[0]?.title || '演示文稿',
    slideCount: slides.length,
    slides,
    outline: pptCtx.outline,
  };

  await completeTask(taskId, finalResult);
  await emitLog(taskId, `演示文稿生成完成，共 ${slides.length} 页`);
}

// Register
registerWorkflow(pptWorkflow);

export { pptWorkflow };
