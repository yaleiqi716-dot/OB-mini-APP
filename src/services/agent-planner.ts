import { chatCompletion } from '@/lib/openrouter';
import { TaskType } from '@/types/task';

export interface PlannedTask {
  type: TaskType;
  input: string;
}

export interface AgentPlan {
  tasks: PlannedTask[];
}

const PLANNER_PROMPT = `你是任务调度AI。

你的职责：
- 分析用户需求
- 拆成一个或多个可执行的子任务
- 每个任务指定类型和具体描述

支持的任务类型：
- ppt: 制作演示文稿
- email: 撰写邮件
- proposal: 撰写方案
- website: 设计网页
- video: 制作视频脚本

规则：
- 如果用户需求简单，返回 1 个任务即可
- 如果需求包含多个步骤，拆成多个子任务
- 保持任务执行的合理顺序
- 每个子任务的 input 必须具体、独立、可直接执行
- 只返回 JSON

返回格式：
{
  "tasks": [
    { "type": "ppt", "input": "具体任务描述" },
    { "type": "email", "input": "具体任务描述" }
  ]
}`;

export async function planTasks(input: string): Promise<AgentPlan> {
  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: input },
      ],
      { temperature: 0.2, jsonMode: true, maxTokens: 1024 }
    );

    const parsed = JSON.parse(result.content);
    const tasks: PlannedTask[] = (parsed.tasks || [])
      .filter((t: Record<string, unknown>) => t.type && t.input)
      .map((t: Record<string, unknown>) => ({
        type: validateType(String(t.type)),
        input: String(t.input),
      }));

    if (tasks.length === 0) {
      return { tasks: [{ type: 'unknown', input }] };
    }

    return { tasks };
  } catch (error) {
    console.error('[PLANNER_ERROR]', error);
    return { tasks: [{ type: 'unknown', input }] };
  }
}

function validateType(type: string): TaskType {
  const valid: TaskType[] = ['ppt', 'email', 'proposal', 'website', 'video'];
  return valid.includes(type as TaskType) ? (type as TaskType) : 'unknown';
}
