import { TaskType } from './task';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
}

export interface WorkflowResult {
  success: boolean;
  artifacts?: unknown[];
  error?: string;
}

export interface WorkflowDefinition {
  type: TaskType;
  name: string;
  description: string;
  steps: WorkflowStep[];
}
