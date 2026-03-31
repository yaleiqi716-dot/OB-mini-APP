import { TaskType, TaskSource } from './task';

export interface CreateTaskRequest {
  input: string;
  type?: TaskType;
  source?: TaskSource;
  metadata?: Record<string, string>;
  assigneeId?: string;
  parentTaskId?: string;
}

export interface CreateTaskResponse {
  taskId: string;
  type: TaskType;
  status: string;
}

export interface RouterResponse {
  type: TaskType;
  confidence: number;
  title: string;
}

export interface InteractionSubmitRequest {
  interactionId: string;
  stepId: string;
  value: unknown;
}

export interface ApiError {
  error: string;
  detail?: string;
}
