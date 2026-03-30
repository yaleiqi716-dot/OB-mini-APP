import { TaskType } from '@/types/task';

const COST_TABLE: Record<string, number> = {
  ppt: 20,
  email: 5,
  proposal: 15,
  website: 25,
  video: 30,
  unknown: 10,
};

export function estimateCost(type: TaskType | string): number {
  return COST_TABLE[type] || 10;
}
