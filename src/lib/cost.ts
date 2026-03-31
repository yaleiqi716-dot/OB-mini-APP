import { TaskType } from '@/types/task';
import { AgentIntent } from '@/types/agent';

const COST_TABLE: Record<string, number> = {
  ppt: 20,
  email: 5,
  proposal: 15,
  website: 25,
  video: 30,
  unknown: 10,
  // Agent intent costs
  text: 10,
  search: 15,
  image: 25,
  avatar_video: 40,
  automation: 10,
  browser_task: 20,
};

export function estimateCost(type: TaskType | AgentIntent | string): number {
  return COST_TABLE[type] || 10;
}
