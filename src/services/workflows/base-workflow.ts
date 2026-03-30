import { TaskType } from '@/types/task';
import { WorkflowStep } from '@/types/workflow';

export interface WorkflowContext {
  taskId: string;
  input: string;
  context: Record<string, unknown>;
}

export interface BaseWorkflow {
  type: TaskType;
  name: string;
  steps: WorkflowStep[];
  start(ctx: WorkflowContext): Promise<void>;
  handleInteraction(ctx: WorkflowContext, stepId: string, value: unknown): Promise<void>;
}

const workflowRegistry = new Map<TaskType, BaseWorkflow>();

export function registerWorkflow(workflow: BaseWorkflow) {
  workflowRegistry.set(workflow.type, workflow);
}

export function getWorkflow(type: TaskType): BaseWorkflow | undefined {
  return workflowRegistry.get(type);
}

export function getAllWorkflows(): BaseWorkflow[] {
  return Array.from(workflowRegistry.values());
}
