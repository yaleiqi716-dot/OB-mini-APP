export type TaskType = 'ppt' | 'website' | 'video' | 'email' | 'proposal' | 'unknown';

// 正式状态集合（与 prisma/schema.prisma 注释、VALID_STATUS_TRANSITIONS、Badge 保持一致）
export type TaskStatus =
  | 'pending'        // 初始状态，刚创建
  | 'queued'         // 已入队列，等待 Worker 处理
  | 'understanding'  // AI 正在理解需求 / 路由
  | 'structuring'    // 已生成结构，等待用户确认
  | 'interacting'    // 需要用户交互（单选 / 文本输入 / 确认）
  | 'executing'      // 正在执行生成
  | 'blocked'        // 余额不足，等待充值
  | 'completed'      // 任务完成
  | 'failed';        // 任务失败

export type TaskSource = 'agent' | 'zapier' | 'api';

export type TaskEventType =
  | 'status_change'
  | 'ai_response'
  | 'interaction_request'
  | 'interaction_response'
  | 'step_complete'
  | 'step_update'
  | 'structure_generated'
  | 'execution_started'
  | 'task_completed'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'thinking'
  | 'insufficient_credits'
  | 'payment_required'
  | 'artifact'
  | 'error'
  | 'log';

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  input: string;
  context: Record<string, unknown>;
  currentStep: string;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  type: TaskEventType;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface TaskWithEvents extends Task {
  events: TaskEvent[];
}
