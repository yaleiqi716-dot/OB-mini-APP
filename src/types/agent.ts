export type AgentIntent =
  | 'text'
  | 'search'
  | 'image'
  | 'video'
  | 'avatar_video'
  | 'automation'
  | 'browser_task';

export interface RouterDecision {
  intent: AgentIntent;
  reason: string;
  needsClarification: boolean;
  questions: string[];
  toolPayload: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  intent: AgentIntent;
  engine: string;
  data: Record<string, unknown>;
  message: string;
}
