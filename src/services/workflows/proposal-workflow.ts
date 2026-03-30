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

interface ProposalContext {
  currentPhase: 'understanding' | 'structuring' | 'executing' | 'completed';
  structure: string[];
  content: { title: string; sections: { heading: string; content: string }[]; summary: string } | null;
}

const defaultProposalContext: ProposalContext = {
  currentPhase: 'understanding',
  structure: [],
  content: null,
};

const proposalWorkflow: BaseWorkflow = {
  type: 'proposal',
  name: '方案策划',
  steps: [
    { id: 'understanding', name: '理解需求', description: '分析方案需求' },
    { id: 'structuring', name: '生成框架', description: '生成方案结构' },
    { id: 'executing', name: '生成内容', description: '撰写详细内容' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;

    try {
      await updateTaskStep(taskId, 'understanding');
      await updateTaskStatus(taskId, 'understanding');
      await emitLog(taskId, '正在理解方案需求...');

      const structure = await generateProposalStructure(taskId, input);
      if (!structure) return;

      await enterStructuring(taskId, structure);
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;

    try {
      if (stepId === 'request_adjust_proposal_structure') {
        await requestInteraction(taskId, {
          id: generateId(),
          taskId,
          stepId: 'adjust_proposal_structure',
          type: 'text_input',
          question: '你希望怎么调整这份方案结构？',
          placeholder: '例如：增加预算章节，去掉风险分析',
        });

      } else if (stepId === 'adjust_proposal_structure') {
        const hint = String(value || '');
        await updateTaskStatus(taskId, 'understanding');
        await emitLog(taskId, '正在根据反馈调整方案结构...');

        const taskContext = await getTaskContext(taskId);
        const proposalCtx = (taskContext.proposal as ProposalContext) || defaultProposalContext;

        const structure = await regenerateProposalStructure(taskId, input, proposalCtx.structure, hint);
        if (!structure) return;

        await enterStructuring(taskId, structure);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理交互失败');
    }
  },

  async handleApproval(ctx: WorkflowContext, approvalType: ApprovalType, action: ApprovalAction) {
    const { taskId, input } = ctx;

    if (approvalType !== 'use_proposal_structure') return;

    try {
      if (action === 'approve') {
        await emitEvent(taskId, 'approval_approved', { approvalType });
        await executeProposalGeneration(taskId, input);

      } else if (action === 'reject') {
        await emitEvent(taskId, 'approval_rejected', { approvalType });
        await emitLog(taskId, '用户拒绝当前结构，重新生成...');

        await updateTaskStatus(taskId, 'understanding');
        const structure = await generateProposalStructure(taskId, input);
        if (!structure) return;

        await enterStructuring(taskId, structure);
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '审批处理失败');
    }
  },
};

async function generateProposalStructure(taskId: string, input: string): Promise<string[] | null> {
  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是方案策划专家。根据用户需求生成方案的章节结构列表。

请以 JSON 格式返回：
{
  "structure": ["项目背景", "目标与范围", "核心策略", "执行计划", "时间安排", "预算估算", "风险与建议", "总结"]
}

规则：
- 5-10个章节为宜
- 结构清晰、逻辑连贯
- 适合商务或项目方案
- 只返回 JSON`,
      },
      { role: 'user', content: input },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 512 }
  );

  const parsed = JSON.parse(result.content);
  const structure: string[] = parsed.structure || [];

  if (structure.length === 0) {
    await failTask(taskId, '无法生成方案结构');
    return null;
  }

  return structure;
}

async function regenerateProposalStructure(
  taskId: string, input: string, current: string[], hint: string
): Promise<string[] | null> {
  const result = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是方案策划专家。用户想要调整方案的章节结构。

当前结构：${current.join('、')}

请以 JSON 格式返回：
{
  "structure": ["章节1", "章节2", "..."]
}

规则：
- 5-10个章节为宜
- 根据用户调整要求修改
- 只返回 JSON`,
      },
      { role: 'user', content: `原始需求：${input}\n\n调整要求：${hint}` },
    ],
    { temperature: 0.5, jsonMode: true, maxTokens: 512 }
  );

  const parsed = JSON.parse(result.content);
  return parsed.structure || [];
}

async function enterStructuring(taskId: string, structure: string[]) {
  const proposalCtx: ProposalContext = { currentPhase: 'structuring', structure, content: null };
  await updateTaskContext(taskId, { proposal: proposalCtx });

  await updateTaskStep(taskId, 'structuring');
  await updateTaskStatus(taskId, 'structuring');
  await emitLog(taskId, '方案结构已生成，等待确认...');

  await emitEvent(taskId, 'structure_generated', { structure });
  await emitEvent(taskId, 'approval_requested', { approvalType: 'use_proposal_structure' });

  await requestInteraction(taskId, {
    id: generateId(),
    taskId,
    stepId: 'approval_gate',
    type: 'confirm',
    question: '请确认方案结构',
    detail: structure.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    detailData: {
      approvalType: 'use_proposal_structure',
      title: '确认方案结构',
      structure,
    },
  });
}

async function executeProposalGeneration(taskId: string, input: string) {
  const taskContext = await getTaskContext(taskId);
  const proposalCtx = (taskContext.proposal as ProposalContext) || defaultProposalContext;
  const structure = proposalCtx.structure;

  if (!structure || structure.length === 0) {
    await failTask(taskId, '缺少方案结构');
    return;
  }

  await updateTaskStep(taskId, 'executing');
  await updateTaskStatus(taskId, 'executing');

  await emitEvent(taskId, 'execution_started', {
    message: '开始生成方案内容',
    totalSections: structure.length,
  });

  await emitLog(taskId, '正在撰写方案...');

  const sections: { heading: string; content: string }[] = [];

  for (let i = 0; i < structure.length; i++) {
    const heading = structure[i];

    await emitEvent(taskId, 'step_update', {
      step: `section_${i + 1}`,
      text: `正在撰写：${heading}`,
      current: i + 1,
      total: structure.length,
    });

    const result = await chatCompletion(
      [
        {
          role: 'system',
          content: `你是方案策划专家。根据章节标题撰写该章节的详细内容。

请以 JSON 格式返回：
{
  "heading": "章节标题",
  "content": "章节内容（3-5段，专业详实）"
}

规则：
- 内容专业、可执行
- 适合商务方案
- 只返回 JSON`,
        },
        {
          role: 'user',
          content: `方案主题：${input}\n整体结构：${structure.join(' → ')}\n\n当前章节：${heading}`,
        },
      ],
      { temperature: 0.6, jsonMode: true, maxTokens: 2048 }
    );

    const parsed = JSON.parse(result.content);
    sections.push({
      heading: parsed.heading || heading,
      content: parsed.content || heading,
    });

    await emitEvent(taskId, 'step_update', {
      step: `section_${i + 1}`,
      text: `${heading}已完成`,
      current: i + 1,
      total: structure.length,
    });
  }

  const finalResult = {
    type: 'proposal',
    title: `${input.slice(0, 30)} — 策划方案`,
    sections,
    summary: `共 ${sections.length} 个章节`,
    structure,
  };

  await updateTaskContext(taskId, {
    proposal: { ...proposalCtx, currentPhase: 'completed', content: finalResult },
  });

  await completeTask(
    taskId,
    finalResult,
    `方案生成完成，共 ${sections.length} 个章节`
  );

  await emitLog(taskId, `方案生成完成，共 ${sections.length} 个章节`);
}

registerWorkflow(proposalWorkflow);
export { proposalWorkflow };
