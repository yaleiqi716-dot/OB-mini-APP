export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  // For assistant messages that include tool calls
  tool_calls?: ToolCall[];
  // For tool-result messages
  tool_call_id?: string;
}

// ── Tool-use types (OpenAI-compatible) ──────────────────────────────

export interface ToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>; // JSON Schema
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string }; // arguments is JSON string
}

export interface ToolUseResponse {
  /** If the model returned text content (final answer) */
  content: string | null;
  /** If the model wants to call tool(s) instead */
  toolCalls: ToolCall[];
  /** Whether this response requires tool execution before we can get content */
  needsToolExecution: boolean;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stream?: boolean;
  timeoutMs?: number;
}

export interface OpenRouterResponse {
  content: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Structured LLM error codes. The UI uses these to show user-friendly,
 * actionable error messages instead of "当前能力暂不可用 联系管理员".
 *
 * AUTH      — 401/403 from provider. Usually missing/invalid API key.
 *             User action: none (this is our bug, show "we're on it").
 * RATE_LIMIT — 429 from provider. Provider side throttling.
 *             User action: wait ~30s, retry.
 * QUOTA     — provider reports we're out of credits.
 *             User action: none (admin action needed).
 * UPSTREAM  — 500/502/503/504 from provider. Provider outage.
 *             User action: wait a minute, retry.
 * TIMEOUT   — our AbortController fired before provider responded.
 *             User action: retry (often just a slow tail response).
 * EMPTY     — provider returned 200 but no content in the completion.
 *             User action: retry; if persists, rephrase prompt.
 * UNKNOWN   — anything else (DNS, fetch error, parse error).
 *             User action: retry; if persists, contact support.
 */
export type LLMErrorCode =
  | 'LLM_AUTH'
  | 'LLM_RATE_LIMIT'
  | 'LLM_QUOTA'
  | 'LLM_UPSTREAM'
  | 'LLM_TIMEOUT'
  | 'LLM_EMPTY'
  | 'LLM_UNKNOWN';

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status?: number;
  readonly upstreamMessage?: string;

  constructor(code: LLMErrorCode, message: string, status?: number, upstreamMessage?: string) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.status = status;
    this.upstreamMessage = upstreamMessage;
  }
}

/**
 * Classify an HTTP status + error body into a structured LLMErrorCode.
 * Called from both the direct and gateway code paths.
 */
function classifyHttpError(status: number, body: string): LLMErrorCode {
  if (status === 401 || status === 403) return 'LLM_AUTH';
  if (status === 429) return 'LLM_RATE_LIMIT';
  if (status === 402) return 'LLM_QUOTA';
  if (status >= 500 && status <= 599) return 'LLM_UPSTREAM';
  // Some providers return 400 with "insufficient_quota" or similar — check body.
  const lower = body.toLowerCase();
  if (lower.includes('insufficient_quota') || lower.includes('quota') || lower.includes('credit')) {
    return 'LLM_QUOTA';
  }
  if (lower.includes('rate') || lower.includes('too many')) return 'LLM_RATE_LIMIT';
  return 'LLM_UNKNOWN';
}

// ── LLM endpoint resolution ──
// Mode 1 (direct):  call OpenRouter directly (default)
// Mode 2 (gateway): call SG gateway which proxies to OpenRouter
//
// Set LLM_GATEWAY_URL to enable gateway mode, e.g.:
//   LLM_GATEWAY_URL=http://207.148.70.106:3100/v1/chat/completions
// Set LLM_GATEWAY_KEY for internal auth header (X-OB-Internal-Key)

const OPENROUTER_DIRECT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 150_000; // 150 seconds

function getLLMEndpoint(): string {
  return process.env.LLM_GATEWAY_URL || OPENROUTER_DIRECT_URL;
}

function isGatewayMode(): boolean {
  return !!process.env.LLM_GATEWAY_URL;
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  // Treat placeholder keys as "not configured" — they'd 401 at the provider
  // anyway, but this gives us a clean AUTH error one layer earlier.
  const placeholderPatterns = [
    'your-openrouter-api-key-here',
    'sk-or-v1-placeholder',
    'placeholder',
  ];
  if (!key || placeholderPatterns.some((p) => key.toLowerCase().includes(p))) {
    throw new LLMError(
      'LLM_AUTH',
      'OPENROUTER_API_KEY 未配置',
      undefined,
      'Set OPENROUTER_API_KEY in .env.local (dev) or production env (prod).',
    );
  }
  return key;
}

function getDefaultModel(): string {
  return process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o';
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
    'HTTP-Referer': 'https://orangebench.tech',
    'X-Title': 'ORANGEBENCH',
  };

  // Add internal auth key when using gateway
  const gatewayKey = process.env.LLM_GATEWAY_KEY;
  if (isGatewayMode() && gatewayKey) {
    headers['X-OB-Internal-Key'] = gatewayKey;
  }

  return headers;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<OpenRouterResponse> {
  const model = options.model || getDefaultModel();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = getLLMEndpoint();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  // Timeout via AbortController
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      const code = classifyHttpError(res.status, errorText);
      console.error(
        '[LLM_ERROR]',
        code,
        res.status,
        errorText.slice(0, 200),
        isGatewayMode() ? '(via gateway)' : '(direct)',
      );
      throw new LLMError(
        code,
        `AI 调用失败 (${res.status})`,
        res.status,
        errorText.slice(0, 300),
      );
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      console.error('[LLM_ERROR]', 'LLM_EMPTY', JSON.stringify(data).slice(0, 200));
      throw new LLMError('LLM_EMPTY', 'AI 返回了空响应');
    }

    return {
      content: choice.message.content,
      model: data.model || model,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[LLM_ERROR]', 'LLM_TIMEOUT', `${timeoutMs}ms`, isGatewayMode() ? '(via gateway)' : '(direct)');
      throw new LLMError('LLM_TIMEOUT', 'AI 响应超时');
    }
    // Already an LLMError? Let it propagate unchanged.
    if (error instanceof LLMError) throw error;
    // Network / DNS / unexpected — classify as UNKNOWN but preserve detail.
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[LLM_ERROR]', 'LLM_UNKNOWN', msg.slice(0, 200), isGatewayMode() ? '(via gateway)' : '(direct)');
    throw new LLMError('LLM_UNKNOWN', `AI 调用失败: ${msg.slice(0, 120)}`);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Tool-use completion ──────────────────────────────────────────────
//
// P5.1a — like chatCompletion but accepts tools[] and returns tool_calls
// when the model decides to use one. This is the primitive that lets the
// agent call MCP tools mid-conversation.
//
// OpenRouter supports the OpenAI-compatible tools API on models that
// have tool-use capability. The default model (gpt-4o or similar)
// supports it. If a model doesn't, it ignores the tools field and
// returns content only — which is fine, we treat that as "no tools used".

export async function chatCompletionWithTools(
  messages: ChatMessage[],
  tools: Tool[],
  options: OpenRouterOptions = {},
): Promise<ToolUseResponse> {
  const model = options.model || getDefaultModel();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = getLLMEndpoint();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    tools: tools.length > 0 ? tools : undefined,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      const code = classifyHttpError(res.status, errorText);
      throw new LLMError(code, `AI 调用失败 (${res.status})`, res.status, errorText.slice(0, 300));
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    // Case 1: model returned tool_calls
    const toolCalls: ToolCall[] = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
    if (toolCalls.length > 0) {
      return {
        content: msg?.content || null,
        toolCalls,
        needsToolExecution: true,
        model: data.model || model,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
      };
    }

    // Case 2: model returned content (no tool calls)
    return {
      content: msg?.content || null,
      toolCalls: [],
      needsToolExecution: false,
      model: data.model || model,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LLMError('LLM_TIMEOUT', 'AI 响应超时');
    }
    if (error instanceof LLMError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new LLMError('LLM_UNKNOWN', `AI 调用失败: ${msg.slice(0, 120)}`);
  } finally {
    clearTimeout(timeout);
  }
}

// Safe JSON parse for LLM responses — returns fallback on failure
export function safeParseLLMJson<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content);
  } catch {
    console.error('[LLM_JSON_PARSE_ERROR]', content.slice(0, 200));
    return fallback;
  }
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): AsyncGenerator<string, void, unknown> {
  const model = options.model || getDefaultModel();
  const endpoint = getLLMEndpoint();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI 流式调用失败 (${res.status}): ${errorText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('无法获取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Skip malformed chunks
      }
    }
  }
}
