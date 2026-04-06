export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  if (!key || key === 'your-openrouter-api-key-here') {
    throw new Error('OPENROUTER_API_KEY 未配置，请在 .env.local 中设置');
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
      console.error('[LLM_ERROR]', res.status, errorText.slice(0, 200), isGatewayMode() ? '(via gateway)' : '(direct)');
      throw new Error(`AI 调用失败 (${res.status})`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      console.error('[LLM_EMPTY]', data);
      throw new Error('AI 返回了空响应');
    }

    return {
      content: choice.message.content,
      model: data.model || model,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('[LLM_TIMEOUT]', timeoutMs, 'ms', isGatewayMode() ? '(via gateway)' : '(direct)');
      throw new Error('AI 响应超时，请重试');
    }
    throw error;
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
