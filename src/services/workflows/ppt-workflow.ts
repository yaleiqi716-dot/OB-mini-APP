import { BaseWorkflow, WorkflowContext, registerWorkflow } from './base-workflow';
import { WorkflowStep } from '@/types/workflow';
import { chatCompletion } from '@/lib/openrouter';
import {
  updateTaskStatus,
  updateTaskContext,
  updateTaskStep,
  requestInteraction,
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
- 每一项是页面的标题
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
        return;
      }

      const pptCtx: PPTContext = {
        ...defaultPPTContext,
        currentPhase: 'structuring',
        structure,
      };
      await updateTaskContext(taskId, { ppt: pptCtx });

      await updateTaskStep(taskId, 'structuring');
      await updateTaskStatus(taskId, 'structuring');
      await emitLog(taskId, '结构已生成，等待确认...');

      await emitEvent(taskId, 'structure_generated', { structure });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '启动失败';
      await failTask(taskId, msg);
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;

    try {
      if (stepId === 'request_adjust_structure') {
        // User clicked "调整结构" — send a text_input interaction
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'adjust_structure',
          type: 'text_input',
          question: '你希望怎么调整这份结构？',
          placeholder: '例如：减少到6页，偏融资路演风格',
        });
      } else if (stepId === 'adjust_structure') {
        // User submitted adjustment text — re-generate structure
        const hint = String(value || '');
        await updateTaskStatus(taskId, 'understanding');
        await emitLog(taskId, '正在根据反馈调整结构...');

        const taskContext = await getTaskContext(taskId);
        const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;

        const result = await chatCompletion(
          [
            {
              role: 'system',
              content: `你是一个专业的演示文稿设计师。用户想要调整演示文稿的页面结构。

当前结构：${JSON.stringify(pptCtx.structure)}

请以 JSON 格式返回：
{
  "structure": ["封面", "页面标题1", "页面标题2", "...", "总结"]
}

规则：
- 6-12页为宜
- 结构清晰、逻辑连贯
- 根据用户的调整要求修改
- 只返回 JSON`,
            },
            {
              role: 'user',
              content: `原始需求：${input}\n\n调整要求：${hint}`,
            },
          ],
          { temperature: 0.5, jsonMode: true, maxTokens: 1024 }
        );

        const parsed = JSON.parse(result.content);
        const structure: string[] = parsed.structure || [];

        const updated: PPTContext = { ...pptCtx, currentPhase: 'structuring', structure };
        await updateTaskContext(taskId, { ppt: updated });

        await updateTaskStep(taskId, 'structuring');
        await updateTaskStatus(taskId, 'structuring');
        await emitLog(taskId, '结构已重新生成，等待确认...');

        await emitEvent(taskId, 'structure_generated', { structure });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '处理交互失败';
      await failTask(taskId, msg);
    }
  },
};

registerWorkflow(pptWorkflow);

export { pptWorkflow };

// Called by approve-structure after user confirms
export async function executePPTGeneration(taskId: string, input: string) {
  const taskContext = await getTaskContext(taskId);
  const pptCtx = (taskContext.ppt as PPTContext) || defaultPPTContext;
  const structure = pptCtx.structure;

  if (!structure || structure.length === 0) {
    await failTask(taskId, '缺少演示文稿结构');
    return;
  }

  await updateTaskStep(taskId, 'executing');

  // Single execution_started event — only here, not in approve-structure
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
  "content": ["内容要点1（一句话展开）", "内容要点2", "内容要点3"],
  "notes": "演讲者备注（2-3句话）"
}

规则：
- 内容要点简洁有力，适合展示
- 每个要点一句话，不超过30字
- 2-4个要点
- 备注是给演讲者看的补充说明
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

  const updatedCtx: PPTContext = {
    ...pptCtx,
    currentPhase: 'completed',
    slides,
  };
  await updateTaskContext(taskId, { ppt: updatedCtx });

  // Complete — single sequence: task_completed → status_change → artifact
  const { prisma } = await import('@/lib/prisma');
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      result: JSON.stringify(finalResult),
    },
  });

  await emitEvent(taskId, 'task_completed', {
    message: `演示文稿生成完成，共 ${slides.length} 页`,
    result: finalResult,
  });

  await emitEvent(taskId, 'status_change', { status: 'completed' });
  await emitEvent(taskId, 'artifact', { result: finalResult });

  await emitLog(taskId, `演示文稿生成完成，共 ${slides.length} 页`);
}
