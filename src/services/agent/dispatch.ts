import { RouterDecision, DispatchResult } from '@/types/agent';
import { chatCompletion, LLMError } from '@/lib/openrouter';
import { braveSearch } from '@/services/tools/brave';
import { createImage } from '@/services/tools/leonardo';
import { generateImageViaOpenRouter } from '@/services/tools/openrouter-image';
// generateDesignImage (gstack design binary) is kept in the repo as a
// dormant alternative for when OPENAI_API_KEY is available — see
// src/services/tools/design.ts and handleDesign below.
import { createVideo } from '@/services/tools/minimax';
import { createAvatarVideo } from '@/services/tools/akool';
import { triggerAutomation } from '@/services/tools/zapier';
import { createBrowserTask } from '@/services/tools/manus';

// Async intents: these only create a job and return immediately.
// The media-job-poller picks up results later.
// NOTE: 'design' was async in T2b (Leonardo) but is now SYNC in T2d
// (OpenRouter image gen completes in ~8s). Keep it out of this set so
// the worker treats handleDesign's response as a final result, not a job.
export const ASYNC_INTENTS = new Set(['image', 'video', 'avatar_video', 'browser_task']);

export interface AsyncJobInfo {
  engine: string;
  jobId: string;
}

export async function dispatch(decision: RouterDecision, originalInput: string): Promise<DispatchResult> {
  const { intent, toolPayload } = decision;

  try {
    switch (intent) {
      case 'text':
        return await handleText(toolPayload, originalInput);

      case 'search':
        return await handleSearch(toolPayload, originalInput);

      case 'image':
        return await handleImage(toolPayload);

      case 'design':
        return await handleDesign(toolPayload, originalInput);

      case 'video':
        return await handleVideo(toolPayload);

      case 'avatar_video':
        return await handleAvatarVideo(toolPayload);

      case 'automation':
        return await handleAutomation(toolPayload);

      case 'browser_task':
        return await handleBrowserTask(toolPayload, originalInput);

      default:
        return await handleText(toolPayload, originalInput);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '执行失败';
    console.error(`[DISPATCH] ${intent} failed:`, err);
    // If this is a structured LLM error, propagate the code so the UI can
    // render an actionable, bucketed message instead of "当前能力暂不可用".
    const errorCode = err instanceof LLMError ? err.code : undefined;
    return {
      success: false,
      intent,
      engine: intent,
      data: { error: message, errorCode },
      message,
    };
  }
}

// ---- Synchronous handlers (complete in worker) ----

async function handleText(payload: Record<string, unknown>, originalInput: string): Promise<DispatchResult> {
  const prompt = String(payload.prompt || originalInput);
  const result = await chatCompletion(
    [
      { role: 'system', content: '你是一个专业的工作助手。根据用户需求直接给出完整、实用的回答。内容完整、专业、简洁。' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.6, maxTokens: 4096 }
  );

  return {
    success: true,
    intent: 'text',
    engine: 'chatgpt',
    data: { type: 'direct', content: result.content },
    message: '已完成',
  };
}

async function handleSearch(payload: Record<string, unknown>, originalInput: string): Promise<DispatchResult> {
  const query = String(payload.query || originalInput);
  const searchResults = await braveSearch(query);

  const context = searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\n${r.url}`).join('\n\n');
  const summary = await chatCompletion(
    [
      { role: 'system', content: '你是一个专业的研究助手。基于搜索结果，给用户一个清晰、准确、有结构的总结。引用来源时标注序号。' },
      { role: 'user', content: `用户问题：${query}\n\n搜索结果：\n${context}` },
    ],
    { temperature: 0.4, maxTokens: 4096 }
  );

  return {
    success: true,
    intent: 'search',
    engine: 'brave+chatgpt',
    data: { type: 'search', content: summary.content, sources: searchResults },
    message: '搜索并总结完成',
  };
}

async function handleAutomation(payload: Record<string, unknown>): Promise<DispatchResult> {
  const action = String(payload.action || '');
  const result = await triggerAutomation(action, payload);

  return {
    success: true,
    intent: 'automation',
    engine: 'zapier',
    data: { type: 'automation', ...result },
    message: '自动化操作已触发',
  };
}

// ---- Async handlers (create job only, return immediately) ----

async function handleImage(payload: Record<string, unknown>): Promise<DispatchResult> {
  const prompt = String(payload.prompt || '');
  const style = String(payload.style || '');
  const result = await createImage(prompt, style);

  return {
    success: true,
    intent: 'image',
    engine: 'leonardo',
    data: { type: 'image', _async: true, jobId: result.generationId },
    message: '图片正在生成中...',
  };
}

// Design mockup generation via OpenRouter (gemini-2.5-flash-image / gpt-5-image).
//
// SYNCHRONOUS — completes in ~8-15 seconds, well within the worker
// per-task budget. No externalJobId, no poller, same response shape
// as handleText: { success, data: { type: 'image', imageUrl } }.
//
// History:
//   T2  (gstack binary)    — needed OPENAI_API_KEY, not available
//   T2b (Leonardo, async)  — TCP-blocked from this network, dead
//   T2d (OpenRouter, sync) — works perfectly, single key, fastest path
//
// All three wrappers stay in the repo. handleDesign points at the
// OpenRouter one because that's the path the user's environment can
// actually use. To swap providers, change the import + the call below;
// nothing else in the dispatch / router / UI / worker / poller cares.
//
// Default model: google/gemini-2.5-flash-image (per OPENROUTER_IMAGE_MODEL
// env var). Alternatives: openai/gpt-5-image. Both verified via probe.
async function handleDesign(
  payload: Record<string, unknown>,
  originalInput: string,
): Promise<DispatchResult> {
  const brief = String(payload.brief || payload.prompt || originalInput);

  // Prepend UI-specific style cues so the multimodal model knows to
  // produce interface-shaped output, not generic illustrations.
  const designPrompt = `Generate a UI design mockup image. ${brief}. Style: clean modern interface, professional layout, high fidelity, product screenshot style, flat design.`;

  const result = await generateImageViaOpenRouter(designPrompt);

  if (!result.success) {
    // Bucket the wrapper's errorCode into LLMError so the existing
    // P0-1b actionable-error pipeline (handleText shares it) renders
    // a clean message in TaskCanvas instead of "当前能力暂不可用".
    const llmCode =
      result.errorCode === 'no_key'
        ? 'LLM_AUTH'
        : result.errorCode === 'no_credits'
          ? 'LLM_QUOTA'
          : result.errorCode === 'rate_limited'
            ? 'LLM_RATE_LIMIT'
            : result.errorCode === 'network'
              ? 'LLM_UPSTREAM'
              : 'LLM_UNKNOWN';
    throw new LLMError(
      llmCode,
      result.error || '图像生成失败',
      undefined,
      result.errorCode,
    );
  }

  return {
    success: true,
    intent: 'design',
    engine: 'openrouter-image',
    data: {
      type: 'image',
      imageUrl: result.imageUrl,
      prompt: brief,
      model: result.model,
    },
    message: '设计稿已生成',
  };
}

async function handleVideo(payload: Record<string, unknown>): Promise<DispatchResult> {
  const topic = String(payload.topic || payload.prompt || '');
  const duration = Number(payload.duration) || 30;
  const style = String(payload.style || '');
  const result = await createVideo(topic, duration, style);

  return {
    success: true,
    intent: 'video',
    engine: 'minimax',
    data: { type: 'video', _async: true, jobId: result.jobId },
    message: '视频正在生成中...',
  };
}

async function handleAvatarVideo(payload: Record<string, unknown>): Promise<DispatchResult> {
  const script = String(payload.script || payload.prompt || '');
  const avatarStyle = String(payload.avatarStyle || 'professional');
  const result = await createAvatarVideo(script, avatarStyle);

  return {
    success: true,
    intent: 'avatar_video',
    engine: 'akool',
    data: { type: 'avatar_video', _async: true, jobId: result.jobId },
    message: '数字人视频正在生成中...',
  };
}

async function handleBrowserTask(payload: Record<string, unknown>, originalInput: string): Promise<DispatchResult> {
  const prompt = String(payload.instruction || payload.task || payload.prompt || originalInput);
  const url = payload.url ? String(payload.url) : undefined;
  const context = payload.context ? String(payload.context) : undefined;
  const result = await createBrowserTask({ prompt, url, context });

  return {
    success: true,
    intent: 'browser_task',
    engine: 'manus',
    data: { type: 'browser_task', _async: true, jobId: result.taskId },
    message: '浏览器任务已启动...',
  };
}
