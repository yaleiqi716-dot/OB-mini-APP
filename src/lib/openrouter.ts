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
}

export interface OpenRouterResponse {
  content: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'your-openrouter-api-key-here') {
    throw new Error('OPENROUTER_API_KEY 未配置，请在 .env.local 中设置');
  }
  return key;
}

function getDefaultModel(): string {
  return process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-sonnet-4';
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();
  const model = options.model || getDefaultModel();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://orangebench.app',
      'X-Title': 'ORANGEBENCH',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter 调用失败 (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (!choice?.message?.content) {
    throw new Error('OpenRouter 返回了空响应');
  }

  return {
    content: choice.message.content,
    model: data.model || model,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0 },
  };
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  const model = options.model || getDefaultModel();

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://orangebench.app',
      'X-Title': 'ORANGEBENCH',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter 流式调用失败 (${res.status}): ${errorText}`);
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
