export type AgentIntent =
  | 'text'
  | 'search'
  | 'image'
  | 'design'         // Local gstack design binary (sync, PNG output).
                     // Distinct from 'image' which routes to async Leonardo.
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
