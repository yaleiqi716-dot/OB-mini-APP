import { chatCompletion } from '@/lib/openrouter';
import { TaskType } from '@/types/task';
import { RouterResponse } from '@/types/api';

const ROUTER_SYSTEM_PROMPT = `你是一个任务分类器。根据用户的输入，判断任务类型。

可选类型：
- ppt: 制作演示文稿、PPT、幻灯片
- website: 设计网页、着陆页、网站
- video: 制作视频脚本、拍摄脚本、分镜
- email: 写邮件、回复邮件、商务邮件
- proposal: 写方案、策划、计划书

请以 JSON 格式返回：
{
  "type": "ppt" | "website" | "video" | "email" | "proposal" | "unknown",
  "confidence": 0.0 到 1.0 之间的数值,
  "title": "简短的任务标题（不超过20字）"
}

如果无法判断类型，返回 "unknown"。
只返回 JSON，不要有其他文字。`;

export async function routeTask(input: string): Promise<RouterResponse> {
  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: input },
      ],
      { temperature: 0.1, jsonMode: true, maxTokens: 256 }
    );

    const parsed = JSON.parse(result.content);
    return {
      type: validateTaskType(parsed.type),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      title: String(parsed.title || '').slice(0, 50) || '新任务',
    };
  } catch (error) {
    console.error('任务路由失败:', error);
    return {
      type: 'unknown',
      confidence: 0,
      title: '新任务',
    };
  }
}

function validateTaskType(type: string): TaskType {
  const valid: TaskType[] = ['ppt', 'website', 'video', 'email', 'proposal'];
  return valid.includes(type as TaskType) ? (type as TaskType) : 'unknown';
}
