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

export async function routeIntent(input: string): Promise<RouterDecision> {
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
