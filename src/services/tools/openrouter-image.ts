import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// OpenRouter image generation wrapper.
// Calls /v1/chat/completions with multimodal-capable image gen models
// (google/gemini-2.5-flash-image, openai/gpt-5-image, etc) and saves the
// returned image to <cwd>/generated/<uuid>.png so it can be served via
// /api/designs/<filename>.
//
// Why synchronous (vs Leonardo's async pattern):
//   OpenRouter image gen typically completes in 6-15 seconds — well
//   within the worker's per-task budget. No need for externalJobId
//   tracking, no poller, no extra DB writes. Same shape as handleText.
//
// Discovered via probe (src/app/api/dev-probe/openrouter-image deleted
// after verification):
//   choices[0].message.images[0] = { type, image_url: { url } }
//   url is either "data:image/png;base64,..." (Gemini) or "https://..." (some providers)
//
// Models user requested:
//   - google/gemini-2.5-flash-image  (default — fast, multimodal, ~8s)
//   - openai/gpt-5-image             (alternative — pricier, possibly higher fidelity)
//
// Default model is configurable via OPENROUTER_IMAGE_MODEL env var.

const GENERATED_DIR = join(process.cwd(), 'generated');
const DEFAULT_MODEL = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image';
const REQUEST_TIMEOUT_MS = 60_000;

export interface OpenRouterImageResult {
  success: boolean;
  imageUrl?: string;     // server-relative path, e.g. '/api/designs/<uuid>.png'
  imagePath?: string;    // absolute filesystem path
  model?: string;        // echo of which model produced the image
  error?: string;
  errorCode?: string;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      images?: Array<{
        type?: string;
        image_url?: { url?: string } | string;
      }>;
    };
  }>;
  model?: string;
  error?: { message?: string; code?: string | number };
}

// Decode 'data:image/<fmt>;base64,<payload>' into a Buffer.
// Returns null if the URL isn't a data URL.
function decodeDataUrl(url: string): Buffer | null {
  const m = url.match(/^data:image\/[a-z]+;base64,(.+)$/i);
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
}

// Fetch a remote image URL and return its bytes. 30s timeout.
async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30_000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    return Buffer.from(buf);
  } catch {
    return null;
  }
}

// Bucket OpenRouter / upstream errors into actionable user-facing messages.
function classifyError(status: number, body: string): { code: string; message: string } {
  if (status === 401 || status === 403) {
    return { code: 'no_key', message: 'OpenRouter API key 无效或未配置。请检查 .env.local。' };
  }
  if (status === 402) {
    return { code: 'no_credits', message: 'OpenRouter 账户余额不足,请充值。' };
  }
  if (status === 429) {
    return { code: 'rate_limited', message: '请求太频繁,30 秒后再试。' };
  }
  const lower = body.toLowerCase();
  if (lower.includes('content policy') || lower.includes('safety') || lower.includes('moderation') || lower.includes('blocked')) {
    return { code: 'content_policy', message: '该内容无法生成图像 (触发安全策略)。请换个描述再试。' };
  }
  if (lower.includes('model not found') || lower.includes('invalid model')) {
    return { code: 'model_not_found', message: '指定的模型在 OpenRouter 上不可用,请更新 OPENROUTER_IMAGE_MODEL。' };
  }
  if (status >= 500) {
    return { code: 'upstream', message: 'OpenRouter 上游服务异常,请稍后重试。' };
  }
  return { code: 'unknown', message: body.trim().slice(0, 200) || '图像生成失败,请稍后重试。' };
}

export async function generateImageViaOpenRouter(
  brief: string,
  options?: { model?: string },
): Promise<OpenRouterImageResult> {
  if (!brief || !brief.trim()) {
    return { success: false, error: '缺少生成描述', errorCode: 'invalid_input' };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'OpenRouter API key 未配置 (.env.local 缺少 OPENROUTER_API_KEY)',
      errorCode: 'no_key',
    };
  }

  const model = options?.model || DEFAULT_MODEL;

  const ctrl = new AbortController();
  const timeoutHandle = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // Per OpenRouter best practice — these headers help with rate limiting
        // and analytics. Not secrets.
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'OrangeBench',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: brief.trim() }],
        // CRITICAL: tell the model we want image output. Without this,
        // multimodal models default to text-only.
        modalities: ['image', 'text'],
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const message = err instanceof Error && err.name === 'AbortError'
      ? '图像生成超时,请稍后重试'
      : err instanceof Error
        ? `网络错误: ${err.message}`
        : '网络错误';
    return { success: false, error: message, errorCode: 'network' };
  }
  clearTimeout(timeoutHandle);

  const rawText = await response.text();
  let parsed: OpenRouterChatResponse;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      success: false,
      error: 'OpenRouter 返回了无法解析的响应',
      errorCode: 'parse_error',
    };
  }

  if (!response.ok || parsed.error) {
    const upstream = parsed.error?.message || rawText;
    const { code, message } = classifyError(response.status, upstream);
    return { success: false, error: message, errorCode: code };
  }

  // Pull the first image out of choices[0].message.images.
  const images = parsed.choices?.[0]?.message?.images;
  if (!Array.isArray(images) || images.length === 0) {
    return {
      success: false,
      error: '模型未返回图像 (可能是 prompt 触发了拒绝或模型不支持图像生成)',
      errorCode: 'no_image_in_response',
    };
  }

  const first = images[0];
  // image_url can be either { url: string } or a bare string — handle both.
  const url =
    typeof first.image_url === 'string'
      ? first.image_url
      : first.image_url?.url;
  if (!url) {
    return {
      success: false,
      error: '响应中缺少图像 URL',
      errorCode: 'malformed_response',
    };
  }

  // Resolve to bytes — either decode the data URL or fetch the remote URL.
  let imageBytes: Buffer | null;
  if (url.startsWith('data:image/')) {
    imageBytes = decodeDataUrl(url);
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    imageBytes = await fetchRemoteImage(url);
  } else {
    imageBytes = null;
  }

  if (!imageBytes || imageBytes.length === 0) {
    return {
      success: false,
      error: '图像数据为空或解码失败',
      errorCode: 'empty_image',
    };
  }

  // Save to generated/ — same path scheme as the gstack design wrapper
  // so the existing /api/designs/[filename] route serves it without changes.
  await mkdir(GENERATED_DIR, { recursive: true });
  const filename = `${randomUUID()}.png`;
  const filepath = join(GENERATED_DIR, filename);
  await writeFile(filepath, new Uint8Array(imageBytes));

  return {
    success: true,
    imageUrl: `/api/designs/${filename}`,
    imagePath: filepath,
    model: parsed.model || model,
  };
}
