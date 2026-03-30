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
  emitEvent,
  emitLog,
  getTaskContext,
  failTask,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

interface PPTContext {
  currentPhase: 'understanding' | 'structuring' | 'executing' | 'completed';
  structure: string[];
  slides: { index: number; title: string; content: string[]; notes: string }[];
}

const defaultPPTContext: PPTContext = {
  currentPhase: 'understanding',
  structure: [],
  slides: [],
};

const pptWorkflow: BaseWorkflow = {
  type: 'ppt',
  name: '演示文稿',
  steps: [
    { id: 'understanding', name: '理解需求', description: '分析演示文稿需求' },
    { id: 'structuring', name: '生成结构', description: '生成演示文稿结构' },
    { id: 'executing', name: '生成内容', description: '生成每一页的详细内容' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;

    try {
      await updateTaskStep(taskId, 'understanding');
      await updateTaskStatus(taskId, 'understanding');
      await emitLog(taskId, '正在理解你的需求...');

      const structure = await generateStructure(taskId, input);
      if (!structure) return;

      await enterStructuring(taskId, structure);
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;

    try {
      if (stepId === 'request_adjust_structure') {
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'adjust_structure',
          type: 'text_input',
          question: '你希望怎么调整这份结构？',
          placeholder: '例如：减少到6页，偏融资路演风格',
        });
      } else if (stepId === 'adjust_structure') {
        const hint = String(value || '');
        await updateTaskStatus(taskId, 'understanding');
        await emitLog(taskId, '正在根据反馈调整结构...');

        const taskContext = await getTaskContext(taskId);
        const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;

        const structure = await regenerateStructure(taskId, input, pptCtx.structure, hint);
        if (!structure) return;

        await enterStructuring(taskId, structure);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理交互失败');
    }
  },

  async handleApproval(ctx: WorkflowContext, approvalType: ApprovalType, action: ApprovalAction) {
    const { taskId, input } = ctx;

    if (approvalType !== 'use_structure') return;

    try {
      if (action === 'approve') {
        await emitEvent(taskId, 'approval_approved', { approvalType });
        await executePPTGeneration(taskId, input);

      } else if (action === 'reject') {
        await emitEvent(taskId, 'approval_rejected', { approvalType });
        await emitLog(taskId, '用户拒绝当前结构，重新生成...');

        await updateTaskStatus(taskId, 'understanding');
        const structure = await generateStructure(taskId, input);
        if (!structure) return;

        await enterStructuring(taskId, structure);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '审批处理失败');
    }
  },
};

async function generateStructure(taskId: string, input: string): Promise<string[] | null> {
  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是一个专业的演示文稿设计师。根据用户的描述，生成一份演示文稿的页面结构列表。

请以 JSON 格式返回：
{
  "structure": ["封面", "市场问题", "解决方案", "商业模式", "竞争优势", "融资计划", "总结"]
}

规则：
- 6-12页为宜
- 结构清晰、逻辑连贯
- 包含封面和总结页
- 只返回 JSON`,
      },
      { role: 'user', content: input },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 1024 }
  );

  const parsed = JSON.parse(result.content);
  const structure: string[] = parsed.structure || [];

  if (structure.length === 0) {
    await failTask(taskId, '无法生成演示文稿结构');
    return null;
  }

  return structure;
}

async function regenerateStructure(
  taskId: string, input: string, current: string[], hint: string
): Promise<string[] | null> {
  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是一个专业的演示文稿设计师。用户想要调整演示文稿的页面结构。

当前结构：${current.join('、')}

请以 JSON 格式返回：
{
  "structure": ["封面", "页面标题1", "页面标题2", "...", "总结"]
}

规则：
- 6-12页为宜
- 根据用户的调整要求修改
- 只返回 JSON`,
      },
      { role: 'user', content: `原始需求：${input}\n\n调整要求：${hint}` },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 1024 }
  );

  const parsed = JSON.parse(result.content);
  return parsed.structure || [];
}

async function enterStructuring(taskId: string, structure: string[]) {
  const pptCtx: PPTContext = { currentPhase: 'structuring', structure, slides: [] };
  await updateTaskContext(taskId, { ppt: pptCtx });

  await updateTaskStep(taskId, 'structuring');
  await updateTaskStatus(taskId, 'structuring');
  await emitLog(taskId, '结构已生成，等待确认...');

  await emitEvent(taskId, 'structure_generated', { structure });
  await emitEvent(taskId, 'approval_requested', { approvalType: 'use_structure' });

  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'approval_gate',
    type: 'confirm',
    question: '请确认演示文稿结构',
    detail: structure.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    detailData: {
      approvalType: 'use_structure',
      title: '确认结构',
      structure,
    },
  });
}

async function executePPTGeneration(taskId: string, input: string) {
  const taskContext = await getTaskContext(taskId);
  const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;
  const structure = pptCtx.structure;

  if (!structure || structure.length === 0) {
    await failTask(taskId, '缺少演示文稿结构');
    return;
  }

  await updateTaskStep(taskId, 'executing');
  await updateTaskStatus(taskId, 'executing');

  await emitEvent(taskId, 'execution_started', {
    message: '开始生成演示文稿内容',
    totalPages: structure.length,
  });

  await emitLog(taskId, '正在生成内容...');

  const slides: { index: number; title: string; content: string[]; notes: string }[] = [];

  for (let i = 0; i < structure.length; i++) {
    const pageTitle = structure[i];

    await emitEvent(taskId, 'step_update', {
      step: `page_${i + 1}`,
      text: `正在生成：${pageTitle}`,
      current: i + 1,
      total: structure.length,
    });

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `你是一个专业的演示文稿内容撰写者。根据页面标题生成详细内容。

请以 JSON 格式返回：
{
  "title": "页面标题",
  "content": ["内容要点1", "内容要点2", "内容要点3"],
  "notes": "演讲者备注（2-3句话）"
}

规则：
- 每个要点不超过30字
- 2-4个要点
- 只返回 JSON`,
        },
        {
          role: 'user',
          content: `演示文稿主题：${input}\n整体结构：${structure.join(' → ')}\n\n当前页面标题：${pageTitle}`,
        },
      ],
      { temperature: 0.6, jsonMode: true, maxTokens: 1024 }
    );

    const parsed = JSON.parse(result.content);
    const slide = {
      index: i,
      title: parsed.title || pageTitle,
      content: parsed.content || [pageTitle],
      notes: parsed.notes || '',
    };

    slides.push(slide);

    await emitEvent(taskId, 'step_update', {
      step: `page_${i + 1}`,
      text: `${pageTitle}已生成`,
      current: i + 1,
      total: structure.length,
    });
  }

  const finalResult = {
    type: 'ppt',
    title: structure[0] || '演示文稿',
    slideCount: slides.length,
    slides,
    structure,
  };

  await updateTaskContext(taskId, {
    ppt: { ...pptCtx, currentPhase: 'completed', slides },
  });

  await completeTask(
    taskId,
    finalResult,
    `演示文稿生成完成，共 ${slides.length} 页`
  );

  await emitLog(taskId, `演示文稿生成完成，共 ${slides.length} 页`);
}

registerWorkflow(pptWorkflow);
export { pptWorkflow, executePPTGeneration };
