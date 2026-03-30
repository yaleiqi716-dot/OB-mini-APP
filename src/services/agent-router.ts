import { TaskType } from '@/types/task';
import { routeTask as classifyTask } from '@/services/task-router';

// ---- Execution Strategy ----

export type ExecutionStrategy = 'workflow' | 'direct';

const STRATEGY_MAP: Record<string, ExecutionStrategy> = {
  ppt: 'workflow',
  email: 'workflow',
  proposal: 'workflow',
  website: 'workflow',
  video: 'workflow',
  unknown: 'direct',
};

export function selectExecutionStrategy(taskType: TaskType | string): ExecutionStrategy {
  return STRATEGY_MAP[taskType] || 'direct';
}

// ---- Model Selection ----
// Abstract model names — not tied to any specific provider

const MODEL_MAP: Record<string, string> = {
  email: 'fast-model',
  ppt: 'balanced-model',
  proposal: 'smart-model',
  website: 'balanced-model',
  video: 'smart-model',
  unknown: 'default-model',
};

export function selectModel(taskType: TaskType | string): string {
  return MODEL_MAP[taskType] || 'default-model';
}

// ---- Unified Router ----

export interface RouteResult {
  taskType: TaskType;
  title: string;
  strategy: ExecutionStrategy;
  model: string;
}

export async function routeAndPlan(
  input: string,
  presetType?: TaskType
): Promise<RouteResult> {
  let taskType: TaskType;
  let title: string;

  if (presetType && presetType !== 'unknown') {
    taskType = presetType;
    title = input.slice(0, 50);
  } else {
    const result = await classifyTask(input);
    taskType = result.type;
    title = result.title;
  }

  return {
    taskType,
    title,
    strategy: selectExecutionStrategy(taskType),
    model: selectModel(taskType),
  };
}
