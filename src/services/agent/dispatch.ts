import { RouterDecision, DispatchResult } from '@/types/agent';
import { chatCompletion, chatCompletionWithTools, LLMError, Tool, ChatMessage } from '@/lib/openrouter';
import { dispatchMcpTool } from '@/services/mcp/dispatcher';
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
// P4c4 — gstack browse integration for whitelisted sites.
// When the agent asks to browse a known-safe Chinese platform, we prefer
// the local gstack binary (sync, cheap, ~2-6s) over Manus (async, expensive,
// 30s+). Unknown hosts still fall through to Manus.
import {
  findWhitelistedSite,
  BrowseSiteId,
  BROWSE_WHITELIST,
} from '@/services/tools/browse-whitelist';
import {
  browseGoto,
  browseScreenshot,
  browseSnapshot,
  browseText,
  checkDailyQuota,
  BrowseRunContext,
} from '@/services/tools/browse';
import { prisma } from '@/lib/prisma';

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

/**
 * Optional execution context threaded through from the worker. Browser
 * tool calls (P4c4) need userId for quota + credential resolution, and
 * taskId for output paths and TaskEvent artifact tracking. Other handlers
 * currently ignore this.
 */
export interface DispatchCtx {
  userId?: string;
  taskId?: string;
}

export async function dispatch(
  decision: RouterDecision,
  originalInput: string,
  ctx: DispatchCtx = {},
): Promise<DispatchResult> {
  const { intent, toolPayload } = decision;

  try {
    switch (intent) {
      case 'text':
        return await handleText(toolPayload, originalInput, ctx);

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
        return await handleBrowserTask(toolPayload, originalInput, ctx);

      default:
        return await handleText(toolPayload, originalInput, ctx);
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

async function handleText(
  payload: Record<string, unknown>,
  originalInput: string,
  ctx: DispatchCtx = {},
): Promise<DispatchResult> {
  const prompt = String(payload.prompt || originalInput);

  // ── P5.1b — MCP tool-use loop ──────────────────────────────────────
  // If the user has installed + enabled MCP servers, expose their tools
  // to the LLM as function definitions. The LLM can then decide to call
  // them mid-conversation. We run a loop (max 5 rounds) until the LLM
  // returns final text content instead of tool_calls.
  //
  // If the user has no MCP tools, we fall back to the plain chatCompletion
  // path (no overhead, same behavior as before P5.1).

  const mcpTools = ctx.userId ? await loadUserMcpTools(ctx.userId) : [];

  if (mcpTools.length > 0) {
    return await handleTextWithMcpTools(prompt, mcpTools, ctx);
  }

  // ── Plain text path (no MCP tools) ─────────────────────────────────
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

// ── MCP tool helpers ─────────────────────────────────────────────────

const MAX_TOOL_ROUNDS = 5;

/** Load all enabled MCP tools for a user as LLM function definitions.
 *  cachedTools stores full descriptors: [{name, description?, inputSchema?}, ...] */
async function loadUserMcpTools(userId: string): Promise<Tool[]> {
  const servers = await prisma.mcpServer.findMany({
    where: { userId, enabled: true },
    select: { cachedTools: true, name: true },
  });
  const tools: Tool[] = [];
  for (const srv of servers) {
    if (!srv.cachedTools) continue;
    try {
      const raw = JSON.parse(srv.cachedTools);
      // Support both old format (string[]) and new format ({name,description?,inputSchema?}[])
      const descriptors: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> =
        Array.isArray(raw)
          ? raw.map((item: unknown) =>
              typeof item === 'string'
                ? { name: item }
                : (item as { name: string; description?: string; inputSchema?: Record<string, unknown> }),
            )
          : [];
      for (const desc of descriptors) {
        tools.push({
          type: 'function',
          function: {
            name: desc.name,
            description: desc.description || `[MCP: ${srv.name}] 工具 "${desc.name}"`,
            parameters: desc.inputSchema || {
              type: 'object',
              properties: {},
              additionalProperties: true,
            },
          },
        });
      }
    } catch {
      // malformed cachedTools — skip
    }
  }
  return tools;
}

/** Text handler with MCP tool-use loop. */
async function handleTextWithMcpTools(
  prompt: string,
  mcpTools: Tool[],
  ctx: DispatchCtx,
): Promise<DispatchResult> {
  const toolNameList = mcpTools.map(t => t.function.name).join(', ');
  const systemPrompt =
    '你是 ORANGEBENCH 的专业工作助手。你可以调用以下工具来完成用户的请求:\n' +
    `可用工具: ${toolNameList}\n\n` +
    '规则:\n' +
    '- 如果你需要工具才能完成任务,直接调用,不要问用户。\n' +
    '- 工具返回结果后,基于结果给出完整回答。\n' +
    '- 如果不需要工具,直接回答。\n' +
    '- 用中文回复。';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const toolCallLog: Array<{ tool: string; args: Record<string, unknown>; result: string; ms: number }> = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await chatCompletionWithTools(messages, mcpTools, {
      temperature: 0.6,
      maxTokens: 4096,
    });

    if (!response.needsToolExecution) {
      // LLM returned final text — done
      return {
        success: true,
        intent: 'text',
        engine: 'chatgpt+mcp',
        data: {
          type: 'direct',
          content: response.content || '(无内容)',
          mcpToolCalls: toolCallLog.length > 0 ? toolCallLog : undefined,
        },
        message: '已完成',
      };
    }

    // Append the assistant message with tool_calls to conversation
    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls,
    });

    // Execute each tool call via MCP dispatcher
    for (const tc of response.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }

      console.log(`[MCP_TOOL_CALL] round=${round} tool=${tc.function.name} args=${JSON.stringify(args).slice(0, 200)}`);

      let resultText: string;
      let durationMs = 0;
      if (ctx.userId) {
        const mcpResult = await dispatchMcpTool({
          userId: ctx.userId,
          toolName: tc.function.name,
          args,
        });
        durationMs = mcpResult.durationMs;
        if (mcpResult.success) {
          // Extract text from MCP content blocks
          resultText = extractMcpText(mcpResult.content);
        } else {
          resultText = `错误: ${mcpResult.errorMsg || '调用失败'}`;
        }
      } else {
        resultText = '错误: 无法确认用户身份';
      }

      toolCallLog.push({ tool: tc.function.name, args, result: resultText.slice(0, 500), ms: durationMs });

      // Append tool result message
      messages.push({
        role: 'tool',
        content: resultText,
        tool_call_id: tc.id,
      });
    }
  }

  // Hit max rounds — return whatever we have
  const lastContent = messages.filter(m => m.role === 'assistant' && m.content).pop()?.content;
  return {
    success: true,
    intent: 'text',
    engine: 'chatgpt+mcp',
    data: {
      type: 'direct',
      content: lastContent || '(工具调用轮数已达上限)',
      mcpToolCalls: toolCallLog,
    },
    message: '已完成',
  };
}

/** Extract text from MCP content blocks (array of {type:'text', text:'...'} etc.) */
function extractMcpText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block: unknown) => {
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text: unknown }).text);
        }
        return JSON.stringify(block);
      })
      .join('\n');
  }
  return JSON.stringify(content);
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

// P4c4 — extracted helpers + dual-engine dispatch.
//
// Engine selection for browser_task intent:
//   1. If payload has an explicit URL and it's whitelisted → gstack (sync)
//   2. If input text names a whitelisted site by label (e.g. "拉一下
//      淘宝卖家中心") → gstack (sync), use the site's login URL
//   3. Else → Manus (async, existing behavior)
//
// The key design principle: gstack is cheap and fast but restricted;
// Manus is expensive but fully general. Users on whitelisted sites get
// a 10x cost/latency improvement without changing how they phrase things.

function extractUrl(input: string): string | null {
  const m = input.match(/https?:\/\/[^\s\u4e00-\u9fff]+/);
  return m ? m[0] : null;
}

function detectSiteFromText(text: string): BrowseSiteId | null {
  const lower = text.toLowerCase();
  for (const [id, site] of Object.entries(BROWSE_WHITELIST)) {
    // Match by Chinese label or hostname root
    if (text.includes(site.label)) return id as BrowseSiteId;
    const hostRoot = site.hostnames[0].split('.').slice(-2).join('.');
    if (lower.includes(hostRoot)) return id as BrowseSiteId;
  }
  return null;
}

function detectSubcommand(input: string): 'screenshot' | 'snapshot' | 'text' | 'goto' {
  // 截图/截一下/拍照 → screenshot; "截" as a standalone verb near 图/屏/页 counts
  if (/截图|截一|拍照|拍一张|截屏|screenshot|shot/i.test(input)) return 'screenshot';
  if (/结构|元素|snapshot|可访问|树/i.test(input)) return 'snapshot';
  if (/文本|正文|内容|抓.*(字|文)|text/i.test(input)) return 'text';
  return 'goto';
}

async function recordToolArtifact(
  taskId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolOutput: string,
): Promise<void> {
  await prisma.taskEvent
    .create({
      data: {
        taskId,
        type: 'tool_call',
        data: JSON.stringify({ toolName, result: toolOutput.slice(0, 200) }),
        toolName,
        toolInput: JSON.stringify(toolInput).slice(0, 4096),
        toolOutput: toolOutput.slice(0, 8192),
      },
    })
    .catch(err => {
      console.error('[DISPATCH_TOOL_ARTIFACT_FAIL]', err);
    });
}

async function handleBrowserTask(
  payload: Record<string, unknown>,
  originalInput: string,
  ctx: DispatchCtx,
): Promise<DispatchResult> {
  const prompt = String(payload.instruction || payload.task || payload.prompt || originalInput);
  const explicitUrl = payload.url ? String(payload.url) : undefined;
  const context = payload.context ? String(payload.context) : undefined;

  // ── Engine selection ─────────────────────────────────────────────────
  // 1. Explicit URL in payload
  let targetUrl: string | undefined = explicitUrl;
  let targetSite = targetUrl ? findWhitelistedSite(targetUrl) : null;

  // 2. URL embedded in the prompt
  if (!targetSite) {
    const urlInPrompt = extractUrl(prompt);
    if (urlInPrompt) {
      const site = findWhitelistedSite(urlInPrompt);
      if (site) {
        targetUrl = urlInPrompt;
        targetSite = site;
      }
    }
  }

  // 3. Site referenced by Chinese label or hostname root
  if (!targetSite) {
    const siteId = detectSiteFromText(prompt);
    if (siteId) {
      targetSite = BROWSE_WHITELIST[siteId];
      targetUrl = targetUrl || targetSite.loginUrl;
    }
  }

  // ── Path A: gstack browse (sync) ─────────────────────────────────────
  if (targetSite && targetUrl && ctx.userId && ctx.taskId) {
    // Quota gate BEFORE we spend compute on selector dispatch
    const quota = await checkDailyQuota(ctx.userId);
    if (!quota.allowed) {
      return {
        success: false,
        intent: 'browser_task',
        engine: 'gstack_browse',
        data: {
          type: 'browser_task',
          error: `浏览工具今日已用完 ${quota.used}/${quota.limit} 次额度,请明天再试`,
        },
        message: `浏览工具今日已用完 ${quota.used}/${quota.limit} 次额度`,
      };
    }

    // Only attach credentialSiteId if the user actually has a stored
    // credential for this site. Public pages (login landing, marketing)
    // don't need cookies — we shouldn't fail them just because the
    // user hasn't set up login yet. If a credential exists, attaching
    // it lets the browse wrapper inject cookies via the vault.
    const hasCred = await prisma.browseCredential
      .findFirst({ where: { userId: ctx.userId, siteId: targetSite.id }, select: { id: true } })
      .catch(() => null);
    const runCtx: BrowseRunContext = {
      userId: ctx.userId,
      taskId: ctx.taskId,
      credentialSiteId: hasCred ? targetSite.id : undefined,
    };
    const subcmd = detectSubcommand(prompt);
    let res;
    switch (subcmd) {
      case 'screenshot':
        res = await browseScreenshot(runCtx, targetUrl);
        break;
      case 'snapshot':
        res = await browseSnapshot(runCtx, targetUrl);
        break;
      case 'text':
        res = await browseText(runCtx, targetUrl);
        break;
      default:
        res = await browseGoto(runCtx, targetUrl);
    }

    const toolName = `browse.${res.subcommand}`;
    if (res.success) {
      await recordToolArtifact(
        ctx.taskId,
        toolName,
        { url: targetUrl, subcommand: res.subcommand, siteId: targetSite.id },
        JSON.stringify({ outputPath: res.outputPath, textLen: res.text?.length ?? 0 }),
      );
      return {
        success: true,
        intent: 'browser_task',
        engine: 'gstack_browse',
        data: {
          type: 'browser_task',
          tool: toolName,
          subcommand: res.subcommand,
          url: targetUrl,
          site: targetSite.label,
          siteId: targetSite.id,
          outputPath: res.outputPath,
          text: res.text,
          durationMs: res.durationMs,
        },
        message: `已用浏览工具访问 ${targetSite.label}(${(res.durationMs / 1000).toFixed(1)}s)`,
      };
    }
    // gstack failure: surface a clean message WITHOUT falling through
    // to Manus. Falling through would double-charge the user and hide
    // the real failure. If Manus is desired, the user retries with
    // a non-whitelist URL.
    await recordToolArtifact(
      ctx.taskId,
      toolName,
      { url: targetUrl, subcommand: res.subcommand, siteId: targetSite.id },
      JSON.stringify({ error: res.errorMsg, durationMs: res.durationMs }),
    );
    return {
      success: false,
      intent: 'browser_task',
      engine: 'gstack_browse',
      data: {
        type: 'browser_task',
        error: res.errorMsg || '浏览失败',
        site: targetSite.label,
        siteId: targetSite.id,
      },
      message: res.errorMsg || '浏览失败',
    };
  }

  // ── Path B: Manus (async) ───────────────────────────────────────────
  // Either no whitelisted site matched, or we lack ctx (old call sites).
  // Wrap Manus in its own try/catch so "MANUS_API_KEY 未配置" or other
  // config failures surface as a clean user-facing message, not a 500.
  try {
    const result = await createBrowserTask({ prompt, url: explicitUrl, context });
    return {
      success: true,
      intent: 'browser_task',
      engine: 'manus',
      data: { type: 'browser_task', _async: true, jobId: result.taskId },
      message: '浏览器任务已启动...',
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : '浏览器任务启动失败';
    // Suggest a whitelisted-site-specific hint if the user seemed to
    // want something we can actually do.
    const hint = Object.values(BROWSE_WHITELIST)
      .slice(0, 3)
      .map(s => s.label)
      .join('、');
    return {
      success: false,
      intent: 'browser_task',
      engine: 'manus',
      data: { type: 'browser_task', error: errMsg },
      message: `通用浏览暂不可用(${errMsg})。如果你要访问 ${hint} 等站点,可以直接告诉我,我会使用本地浏览工具。`,
    };
  }
}
