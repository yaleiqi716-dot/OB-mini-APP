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

const websiteWorkflow: BaseWorkflow = {
  type: 'website',
  name: '网页设计',
  steps: [
    { id: 'clarify', name: '需求确认', description: '了解网页需求' },
    { id: 'design', name: '生成设计', description: '生成网页结构和设计' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;
    try {
      await updateTaskStep(taskId, 'clarify');
      await emitLog(taskId, '正在分析网页需求...');

      await updateTaskStatus(taskId, 'interacting');
      await requestInteraction(taskId, {
        id: generateId(),
        taskId,
        stepId: 'clarify_style',
        type: 'single_choice',
        question: '你希望网页的风格是？',
        options: [
          { label: '简约商务', value: 'minimal-business' },
          { label: '创意活泼', value: 'creative' },
          { label: '科技感', value: 'tech' },
          { label: '品牌展示', value: 'brand' },
        ],
      });
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;
    try {
      if (stepId === 'clarify_style') {
        await updateTaskStep(taskId, 'design');
        await updateTaskStatus(taskId, 'executing');
        await emitLog(taskId, '正在生成网页设计方案...');

        const result = await chatCompletion(
          [
            {
              role: 'system',
              content: `你是网页设计专家。根据需求生成网页设计方案。
返回 JSON：
{
  "title": "页面标题",
  "sections": [
    {"name": "区块名称", "type": "hero|features|cta|content|footer", "description": "区块描述", "elements": ["元素1", "元素2"]}
  ],
  "colorScheme": {"primary": "#hex", "secondary": "#hex", "accent": "#hex"},
  "summary": "设计概要"
}
只返回 JSON`,
            },
            { role: 'user', content: `需求：${input}\n风格：${value}` },
          ],
          { temperature: 0.6, jsonMode: true, maxTokens: 2048 }
        );

        const parsed = JSON.parse(result.content);
        await completeTask(taskId, { type: 'website', design: parsed });
        await emitLog(taskId, '网页设计方案生成完成');
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理失败');
    }
  },
};

registerWorkflow(websiteWorkflow);
export { websiteWorkflow };
