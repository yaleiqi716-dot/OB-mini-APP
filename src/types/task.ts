export type TaskType = 'ppt' | 'website' | 'video' | 'email' | 'proposal' | 'unknown';

export type TaskStatus = 'pending' | 'understanding' | 'structuring' | 'interacting' | 'executing' | 'completed' | 'failed';

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
  result: unknown | null;
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
