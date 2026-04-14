// Unified Skills Catalog
//
// Merges Webhook / Browse / MCP into one catalog that the /account/skills
// page renders. The UI doesn't need to know the underlying technology;
// it just shows brand cards with connection badges. The install handler
// dispatches to the right backend based on `type`.

export type SkillCategory = 'notification' | 'data' | 'ai-tool' | 'automation' | 'dev';
export type SkillType = 'webhook' | 'browse' | 'mcp';
export type ConnectionMethod = 'oauth' | 'api_key' | 'webhook_url' | 'builtin' | 'cookie' | 'custom';

export interface CatalogField {
  name: string;
  label: string;
  placeholder?: string;
  required: boolean;
  type: 'text' | 'path' | 'password' | 'url' | 'select';
  options?: { value: string; label: string }[];
  help?: string;
}

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  type: SkillType;
  connectionMethod: ConnectionMethod;
  icon: string;                // maps to SkillIcon skillId
  preInstalled?: boolean;
  oauthProvider?: string;      // future OAuth provider id
  fields: CatalogField[];
  confirmWarning?: string;
  tags: string[];
  // Webhook-specific
  webhookKind?: string;        // 'feishu' | 'dingtalk' | 'wecom' | 'generic'
  webhookEvents?: string[];    // default event subscriptions
  // MCP-specific
  mcpCommand?: string;
  mcpArgsTemplate?: string;
  mcpScopes?: string[];
  // Browse-specific
  browseSiteId?: string;
}

export const CONNECTION_METHOD_LABELS: Record<ConnectionMethod, { label: string; color: string }> = {
  oauth: { label: 'OAuth · 一键', color: '#C9B89E' },
  api_key: { label: 'API Key', color: '#D4A017' },
  webhook_url: { label: 'Webhook', color: '#6B7280' },
  builtin: { label: '内置 · 免费', color: '#8A8A90' },
  cookie: { label: '浏览器登录', color: '#FF5A1F' },
  custom: { label: '⚠️ 高级', color: '#E4483D' },
};

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  notification: '通知推送',
  data: '数据抓取',
  'ai-tool': 'AI 工具',
  automation: '自动化',
  dev: '开发者',
};

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  // ─── Notification (Webhook outbound) ────────────────────────────────
  {
    id: 'feishu-webhook',
    name: '飞书',
    description: '任务状态变更时发送飞书机器人消息,支持富文本卡片和交互按钮。',
    category: 'notification',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'feishu',
    webhookKind: 'feishu',
    webhookEvents: ['task_completed', 'task_submitted'],
    fields: [
      { name: 'url', label: 'Webhook URL', placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: '飞书通知', required: true, type: 'text' },
    ],
    tags: ['飞书', 'lark', '通知', '消息'],
  },
  {
    id: 'dingtalk-webhook',
    name: '钉钉',
    description: '任务状态变更时发送钉钉群机器人消息,支持 Markdown 格式。',
    category: 'notification',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'dingtalk',
    webhookKind: 'dingtalk',
    webhookEvents: ['task_completed', 'task_submitted'],
    fields: [
      { name: 'url', label: 'Webhook URL', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=xxx', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: '钉钉通知', required: true, type: 'text' },
    ],
    tags: ['钉钉', 'dingtalk', '通知'],
  },
  {
    id: 'wecom-webhook',
    name: '企业微信',
    description: '任务状态变更时发送企业微信群机器人消息。',
    category: 'notification',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'wecom',
    webhookKind: 'wecom',
    webhookEvents: ['task_completed', 'task_submitted'],
    fields: [
      { name: 'url', label: 'Webhook URL', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: '企微通知', required: true, type: 'text' },
    ],
    tags: ['企微', '企业微信', 'wecom', '通知'],
  },
  {
    id: 'slack-webhook',
    name: 'Slack',
    description: '通过 Zapier 或直接 Webhook URL 把任务通知发到 Slack 频道。',
    category: 'notification',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'slack',
    webhookKind: 'generic',
    webhookEvents: ['task_completed'],
    fields: [
      { name: 'url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/xxx/xxx/xxx', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: 'Slack 通知', required: true, type: 'text' },
    ],
    tags: ['slack', '通知', '海外'],
  },
  {
    id: 'zapier-webhook',
    name: 'Zapier',
    description: '连接 Zapier 的 5000+ 应用。当 OB 里发生事件时,触发你的 Zapier Zap。',
    category: 'automation',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'zapier',
    webhookKind: 'generic',
    webhookEvents: ['task_completed', 'task_submitted', 'task_assigned', 'task_revision'],
    fields: [
      { name: 'url', label: 'Zapier Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/xxx/xxx/', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: 'Zapier 触发器', required: true, type: 'text' },
    ],
    tags: ['zapier', '自动化', 'integration'],
  },
  {
    id: 'custom-webhook',
    name: '自定义 Webhook',
    description: '发送 JSON payload 到任意 HTTPS 端点。适合对接内部系统、n8n、自建服务。',
    category: 'automation',
    type: 'webhook',
    connectionMethod: 'webhook_url',
    icon: 'custom_webhook',
    webhookKind: 'generic',
    fields: [
      { name: 'url', label: 'URL', placeholder: 'https://your-server.com/webhook', required: true, type: 'url' },
      { name: 'name', label: '名称', placeholder: '自定义端点', required: true, type: 'text' },
    ],
    tags: ['webhook', '自定义', 'n8n', 'http'],
  },

  // ─── Data (Browse whitelisted sites) ─────────────────────────────
  {
    id: 'taobao-browse',
    name: '淘宝卖家中心',
    description: '抓本周/本月 GMV、订单数、退款率等卖家核心指标。只读。',
    category: 'data',
    type: 'browse',
    connectionMethod: 'cookie',
    icon: 'taobao_seller',
    browseSiteId: 'taobao_seller',
    fields: [
      { name: 'label', label: '账号备注', placeholder: '主号 / 测试号', required: true, type: 'text' },
      { name: 'cookies', label: 'Cookie JSON', placeholder: '[{"name":"session",...}]', required: true, type: 'password', help: '从浏览器 DevTools → Application → Cookies 导出' },
    ],
    tags: ['淘宝', 'taobao', '电商', '数据'],
  },
  {
    id: 'douyin-browse',
    name: '抖音创作者中心',
    description: '拉取视频播放量、粉丝增长、互动率、直播数据。只读。',
    category: 'data',
    type: 'browse',
    connectionMethod: 'cookie',
    icon: 'douyin_creator',
    browseSiteId: 'douyin_creator',
    fields: [
      { name: 'label', label: '账号备注', placeholder: '主号', required: true, type: 'text' },
      { name: 'cookies', label: 'Cookie JSON', required: true, type: 'password' },
    ],
    tags: ['抖音', 'douyin', '短视频', '数据'],
  },
  {
    id: 'wechat-mp-browse',
    name: '微信公众号后台',
    description: '抓推文阅读量、在看、分享数、粉丝增长。只读。',
    category: 'data',
    type: 'browse',
    connectionMethod: 'cookie',
    icon: 'wechat_mp',
    browseSiteId: 'wechat_mp',
    fields: [
      { name: 'label', label: '账号备注', required: true, type: 'text' },
      { name: 'cookies', label: 'Cookie JSON', required: true, type: 'password' },
    ],
    tags: ['公众号', '微信', 'wechat', '数据'],
  },
  {
    id: 'xiaohongshu-browse',
    name: '小红书创作服务',
    description: '拉取笔记阅读量、互动率、粉丝画像。只读。',
    category: 'data',
    type: 'browse',
    connectionMethod: 'cookie',
    icon: 'xiaohongshu',
    browseSiteId: 'xiaohongshu',
    fields: [
      { name: 'label', label: '账号备注', required: true, type: 'text' },
      { name: 'cookies', label: 'Cookie JSON', required: true, type: 'password' },
    ],
    tags: ['小红书', 'xhs', '种草', '数据'],
  },
  {
    id: 'bilibili-browse',
    name: 'B 站创作中心',
    description: '读取视频播放、硬币、充电、粉丝互动数据。',
    category: 'data',
    type: 'browse',
    connectionMethod: 'cookie',
    icon: 'bilibili',
    browseSiteId: 'bilibili',
    fields: [
      { name: 'label', label: '账号备注', required: true, type: 'text' },
      { name: 'cookies', label: 'Cookie JSON', required: true, type: 'password' },
    ],
    tags: ['b站', 'bilibili', '视频', '数据'],
  },

  // ─── AI Tools (MCP) ────────────────────────────────────────────────
  {
    id: 'memory-mcp',
    name: '记忆知识图谱',
    description: '让 Agent 记住跨对话的结构化知识 — 客户档案、项目上下文、学习笔记。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'builtin',
    icon: 'memory',
    preInstalled: true,
    mcpCommand: 'npx',
    mcpArgsTemplate: '-y @modelcontextprotocol/server-memory',
    mcpScopes: ['read', 'write'],
    fields: [],
    tags: ['记忆', '知识图谱', 'memory', '内置'],
  },
  {
    id: 'filesystem-mcp',
    name: '本地文件系统',
    description: '让 Agent 读写你指定的本地目录。只挂载专用工作目录,不要挂整个 home。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'builtin',
    icon: 'filesystem',
    mcpCommand: 'npx',
    mcpArgsTemplate: '-y @modelcontextprotocol/server-filesystem {{path}}',
    mcpScopes: ['read', 'write'],
    fields: [
      { name: 'path', label: '允许访问的目录', placeholder: '/Users/you/Documents/ob-sandbox', required: true, type: 'path', help: '绝对路径。Agent 只能操作此目录内的文件。' },
    ],
    confirmWarning: 'Agent 将能读写此目录内的所有文件。',
    tags: ['文件', '文件系统', 'filesystem', '本地'],
  },
  {
    id: 'sqlite-mcp',
    name: 'SQLite 数据库',
    description: '让 Agent 对指定的 SQLite 数据库执行查询。只读模式。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'api_key',
    icon: 'sqlite',
    mcpCommand: 'uvx',
    mcpArgsTemplate: 'mcp-server-sqlite --db-path {{dbPath}}',
    mcpScopes: ['read'],
    fields: [
      { name: 'dbPath', label: '数据库文件路径', placeholder: '/path/to/mydb.sqlite', required: true, type: 'path' },
    ],
    tags: ['sqlite', '数据库', 'database', '查询'],
  },
  {
    id: 'git-mcp',
    name: 'Git 仓库',
    description: '让 Agent 查看 git 历史、blame、diff。只读。',
    category: 'dev',
    type: 'mcp',
    connectionMethod: 'builtin',
    icon: 'git',
    mcpCommand: 'uvx',
    mcpArgsTemplate: 'mcp-server-git --repository {{repoPath}}',
    mcpScopes: ['read'],
    fields: [
      { name: 'repoPath', label: '仓库路径', placeholder: '/Users/you/code/myrepo', required: true, type: 'path' },
    ],
    tags: ['git', '代码', '版本控制', '开发'],
  },
  {
    id: 'everything-mcp',
    name: 'Everything (测试)',
    description: '官方 MCP 测试服务器,13 个示例工具 (echo/数学/环境变量)。首次使用 MCP 先装它验证。',
    category: 'dev',
    type: 'mcp',
    connectionMethod: 'builtin',
    icon: 'everything',
    preInstalled: true,
    mcpCommand: 'npx',
    mcpArgsTemplate: '-y @modelcontextprotocol/server-everything',
    mcpScopes: ['read'],
    fields: [],
    tags: ['测试', 'everything', 'test', 'mcp'],
  },
  {
    id: 'notion-mcp',
    name: 'Notion',
    description: '让 Agent 读写你的 Notion 页面和数据库。需要 OAuth 授权。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'oauth',
    icon: 'notion',
    oauthProvider: 'notion',
    mcpCommand: 'npx',
    mcpArgsTemplate: '-y @modelcontextprotocol/server-notion',
    mcpScopes: ['read', 'write'],
    fields: [
      { name: 'apiKey', label: 'Notion Integration Token', placeholder: 'ntn_xxx', required: true, type: 'password', help: '在 notion.so/my-integrations 创建 Internal Integration 获取' },
    ],
    tags: ['notion', '文档', '知识库'],
  },
  {
    id: 'google-drive-mcp',
    name: 'Google Drive',
    description: '让 Agent 读写你的 Google Drive 文件。需要 OAuth 授权。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'oauth',
    icon: 'google_drive',
    oauthProvider: 'google',
    mcpScopes: ['read', 'write'],
    fields: [],
    tags: ['google', 'drive', '文件', '云盘'],
  },
  {
    id: 'gmail-mcp',
    name: 'Gmail',
    description: '让 Agent 读取和发送邮件。需要 OAuth 授权。',
    category: 'ai-tool',
    type: 'mcp',
    connectionMethod: 'oauth',
    icon: 'gmail',
    oauthProvider: 'google',
    mcpScopes: ['read', 'write'],
    fields: [],
    tags: ['gmail', '邮件', 'email'],
  },
  {
    id: 'custom-mcp',
    name: '自定义 MCP 服务器',
    description: '安装任意 MCP 协议服务器。安全责任由你自担。',
    category: 'dev',
    type: 'mcp',
    connectionMethod: 'custom',
    icon: 'custom_mcp',
    fields: [
      { name: 'command', label: '可执行命令', placeholder: 'npx / uvx / /path/to/binary', required: true, type: 'text' },
      { name: 'args', label: '命令参数', required: false, type: 'text' },
      { name: 'envJson', label: '环境变量 (JSON)', placeholder: '{"API_KEY":"..."}', required: false, type: 'password' },
    ],
    confirmWarning: '你将运行任意代码。请确保命令来自你信任的源。',
    tags: ['自定义', 'mcp', '高级'],
  },
];

/** Lookup by ID */
export function getSkillEntry(id: string): SkillCatalogEntry | undefined {
  return SKILL_CATALOG.find(e => e.id === id);
}

/** Filter by category */
export function getSkillsByCategory(cat: SkillCategory): SkillCatalogEntry[] {
  return SKILL_CATALOG.filter(e => e.category === cat);
}

/** Get pre-installed skill IDs */
export function getPreInstalledSkills(): SkillCatalogEntry[] {
  return SKILL_CATALOG.filter(e => e.preInstalled);
}
