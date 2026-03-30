import { BaseWorkflow, WorkflowContext, registerWorkflow } from './base-workflow';
import { WorkflowStep } from '@/types/workflow';
import { ApprovalType, ApprovalAction } from '@/types/interaction';
import { chatCompletion } from '@/lib/openrouter';
import {
  updateTaskStatus,
  updateTaskStep,
  requestInteraction,
  completeTask,
  failTask,
  emitLog,
} from '@/services/task-manager';
import { generateId } from '@/lib/utils';

const videoWorkflow: BaseWorkflow = {
  type: 'video',
  name: '视频脚本',
  steps: [
    { id: 'clarify', name: '需求确认', description: '了解视频需求' },
    { id: 'script', name: '生成脚本', description: '撰写视频脚本' },
  ] as WorkflowStep[],

  async start(ctx: WorkflowContext) {
    const { taskId, input } = ctx;
    try {
      await updateTaskStep(taskId, 'clarify');
      await emitLog(taskId, '正在分析视频需求...');

      await updateTaskStatus(taskId, 'interacting');
      await requestInteraction(taskId, {
        id: generateId(),
        taskId,
        stepId: 'clarify_duration',
        type: 'single_choice',
        question: '视频时长大概多长？',
        options: [
          { label: '短视频（1分钟以内）', value: 'short' },
          { label: '中等长度（3-5分钟）', value: 'medium' },
          { label: '长视频（10分钟以上）', value: 'long' },
        ],
      });
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '启动失败');
    }
  },

  async handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown) {
    const { taskId, input } = ctx;
    try {
      if (stepId === 'clarify_duration') {
        await updateTaskStep(taskId, 'script');
        await updateTaskStatus(taskId, 'executing');
        await emitLog(taskId, '正在生成视频脚本...');

        const result = await chatCompletion(
          [
            {
              role: 'system',
              content: `你是视频脚本撰写专家。根据需求生成视频脚本。
返回 JSON：
{
  "title": "视频标题",
  "duration": "预计时长",
  "scenes": [
    {"sceneNumber": 1, "description": "场景描述", "narration": "旁白/台词", "notes": "拍摄提示"}
  ],
  "summary": "脚本概要"
}
只返回 JSON`,
            },
            { role: 'user', content: `需求：${input}\n时长：${value}` },
          ],
          { temperature: 0.6, jsonMode: true, maxTokens: 3072 }
        );

        const parsed = JSON.parse(result.content);
        await completeTask(taskId, { type: 'video', script: parsed });
        await emitLog(taskId, '视频脚本生成完成');
      }
    } catch (error) {
      await failTask(taskId, error instanceof Error ? error.message : '处理失败');
    }
  },

  async handleApproval(_ctx: WorkflowContext, _approvalType: ApprovalType, _action: ApprovalAction) {},
};

registerWorkflow(videoWorkflow);
export { videoWorkflow };
