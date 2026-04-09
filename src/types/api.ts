import { TaskType, TaskSource } from './task';

export interface CreateTaskRequest {
  input: string;
  type?: TaskType;
  source?: TaskSource;
  metadata?: Record<string, string>;
  assigneeId?: string;
  parentTaskId?: string;
  conversationId?: string;
  attachments?: Array<{ id: string; name: string; size: number; type?: string }>;
  // Optional: AI colleague persona to activate for this task.
  // If omitted and conversation already has one, the existing role persists.
  // If provided, pins the conversation to this role (switches mid-chat if different).
  // See src/lib/skills/registry.ts STARTER_ROLE_IDS for valid values.
  skillRoleId?: string;
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
