import { chatCompletion } from '@/lib/openrouter';
import { RouterDecision, AgentIntent } from '@/types/agent';

const ROUTER_SYSTEM_PROMPT = `你是 ORANGEBENCH 的总调度 AI。
你的职责是：
1. 理解用户需求
2. 判断应该使用哪种执行器
3. 只输出 JSON

任务类型判断规则：

- 如果是写作、总结、邮件、PPT、方案、汇总、翻译、分析、问答：
  → intent = "text"

- 如果需要最新资料、市场信息、公司信息、联网查询、实时数据：
  → intent = "search"

- 如果明确要生成 UI 设计稿、网站/App 界面、产品截图、功能页面、dashboard mockup、落地页设计：
  → intent = "design"

- 如果明确要生成插画、照片、海报、封面、艺术图、Logo、头像、表情包、写实图片：
  → intent = "image"

- 如果明确要生成普通视频、宣传视频、产品视频、动画视频：
  → intent = "video"

- 如果明确要生成数字人、克隆人、口播人物视频、Avatar 视频：
  → intent = "avatar_video"

- 如果明确要触发外部系统、表单、Gmail、Slack、CRM、自动化流程：
  → intent = "automation"

- 如果明确要打开网页、登录、抓取页面、执行浏览器操作：
  → intent = "browser_task"

重要原则：
- 只要能猜出大概意图，就直接执行，不要问。
- 只有完全不知道要做什么（输入是乱码或完全无意义）时，才设置 needsClarification = true。
- 如果必须问，只问 1 个最关键的问题。
- 邮件类任务：即使不知道收件人，也直接执行，让邮件工具自己处理。
- PPT/方案类：即使主题不完整，也直接执行。

toolPayload 填写执行该任务所需的参数，例如：
- text: { prompt: "..." }
- search: { query: "..." }
- image: { prompt: "...", style: "..." }
- design: { brief: "完整的设计 brief, 包括页面类型/风格/色彩/内容布局" }
- video: { topic: "...", duration: 30, style: "..." }
- avatar_video: { script: "...", avatarStyle: "..." }
- automation: { action: "...", target: "...", payload: {...} }
- browser_task: { url: "...", steps: ["..."] }

只返回 JSON，格式：
{
  "intent": "...",
  "reason": "...",
  "needsClarification": false,
  "questions": [],
  "toolPayload": {...}
}`;

const VALID_INTENTS: AgentIntent[] = ['text', 'search', 'image', 'design', 'video', 'avatar_video', 'automation', 'browser_task'];

// Keyword pre-filters — bypass the LLM router for high-confidence intents.
// Critical when the LLM provider is unavailable (no OPENROUTER_API_KEY in dev,
// upstream outage in prod): the LLM router falls back to 'text', which then
// fails again because handleText also needs the LLM. Pre-filtering high-
// confidence intents lets the design / image / search paths work independently.
//
// The patterns are intentionally narrow — only match when the request is
// unambiguously about the matched intent. Edge cases still go through the
// LLM router for proper classification.

// Design = UI/product/marketing mockups. Distinct from generic 'image' which
// is for illustrations / photos / logos.
const DESIGN_KEYWORDS = /(设计.*[图稿页屏]|UI.*(设计|mockup|稿|界面)|界面.*(设计|mockup|稿)|登录页|注册页|落地页|首页设计|landing\s*page|mockup|线框图|wireframe|dashboard.*设计|product screen|product mockup|app.*(界面|UI)|网页设计|页面设计)/i;

// Image = generic illustrations / photos / posters / logos.
// Skip if DESIGN already matched (UI mockup wins over generic image).
const IMAGE_KEYWORDS = /(画一张|画个|生成.*图片|生成.*海报|生成.*封面|生成.*logo|生成.*头像|海报设计|封面设计|插画|illustration|生成图)/i;

// Video = generation requests for video clips.
// Routes to handleVideo (Minimax video-01 backend, async via media-job-poller).
const VIDEO_KEYWORDS = /(生成.*视频|做.*视频|做.*短片|拍.*视频|视频脚本之外.*视频|宣传.*视频|短视频生成|generate.*video|create.*video|make.*video|short.*video|video.*clip)/i;

export async function routeIntent(input: string): Promise<RouterDecision> {
  // Pre-filter: design intent. Highest priority — UI/mockup specifics
  // beat generic image generation.
  if (DESIGN_KEYWORDS.test(input)) {
    return {
      intent: 'design',
      reason: '关键词匹配:UI/界面设计',
      needsClarification: false,
      questions: [],
      toolPayload: { brief: input },
    };
  }

  // Pre-filter: generic image intent.
  if (IMAGE_KEYWORDS.test(input)) {
    return {
      intent: 'image',
      reason: '关键词匹配:图像生成',
      needsClarification: false,
      questions: [],
      toolPayload: { prompt: input },
    };
  }

  // Pre-filter: video generation. Routes to handleVideo (Minimax backend).
  // Async via media-job-poller (~60-90s). The 'topic' field matches the
  // shape handleVideo destructures from toolPayload.
  if (VIDEO_KEYWORDS.test(input)) {
    return {
      intent: 'video',
      reason: '关键词匹配:视频生成',
      needsClarification: false,
      questions: [],
      toolPayload: { topic: input, duration: 6 },
    };
  }

  // Otherwise — fall through to the LLM-based router for nuanced classification.
  const result = await chatCompletion(
    [
      { role: 'system', content: ROUTER_SYSTEM_PROMPT },
      { role: 'user', content: input },
    ],
    { temperature: 0.1, jsonMode: true, maxTokens: 512 }
  );

  try {
    const parsed = JSON.parse(result.content);
    const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'text';

    return {
      intent,
      reason: String(parsed.reason || ''),
      needsClarification: Boolean(parsed.needsClarification),
      questions: Array.isArray(parsed.questions) ? parsed.questions.map(String) : [],
      toolPayload: (typeof parsed.toolPayload === 'object' && parsed.toolPayload !== null) ? parsed.toolPayload : { prompt: input },
    };
  } catch {
    console.error('[AGENT_ROUTER] Failed to parse:', result.content.slice(0, 200));
    return {
      intent: 'text',
      reason: 'JSON 解析失败，默认走文本处理',
      needsClarification: false,
      questions: [],
      toolPayload: { prompt: input },
    };
  }
}
