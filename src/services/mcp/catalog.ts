// P5c3 — MVP catalog of installable MCP servers
//
// All entries here use stdio transport + no OAuth. OAuth-gated MCPs
// (Notion / Google / 飞书) come in P5.2+ once the per-provider OAuth
// plumbing is designed.
//
// Each entry is a "recipe" the install wizard turns into an McpServer
// row. The user sees the entries in /account/ai-tools under "可安装".

export type McpCatalogKind =
  | 'everything'   // reference test server — echoes, math, etc
  | 'filesystem'   // read/write a scoped directory
  | 'memory'       // in-memory knowledge graph (persists for session)
  | 'sqlite'       // query a user-specified sqlite db
  | 'git'          // read-only git ops on a repo
  | 'custom';      // escape hatch — user specifies command/args manually

export interface McpCatalogField {
  name: string;          // config blob key (stored in configEncrypted)
  label: string;         // UI label (zh-CN)
  placeholder?: string;
  required: boolean;
  type: 'text' | 'path' | 'password';
  help?: string;
}

export interface McpCatalogEntry {
  kind: McpCatalogKind;
  label: string;            // 用户可见名称
  description: string;      // 两三句说明
  tagline: string;          // 一行 slogan
  command: string;          // npx / uvx / path
  // Args can reference config fields with {{fieldName}} placeholders.
  // The install flow substitutes them before persisting args.
  argsTemplate: string;
  scopes: ('read' | 'write' | 'admin')[];
  // Fields the install wizard renders
  fields: McpCatalogField[];
  // Warning shown at install confirm — e.g. "will have access to your
  // filesystem under this dir"
  confirmWarning?: string;
  // Icon emoji shown in the list (MVP — replace with proper icons later)
  icon: string;
}

export const MCP_CATALOG: McpCatalogEntry[] = [
  {
    kind: 'everything',
    label: 'Everything (参考示例)',
    tagline: '官方测试服务器 — 13 个示例工具',
    description:
      '用于验证 MCP 集成是否工作。提供 echo、数学、环境变量查看等示例工具。强烈建议首次安装 MCP 时先试试它。',
    command: 'npx',
    argsTemplate: '-y @modelcontextprotocol/server-everything',
    scopes: ['read'],
    fields: [],
    icon: '🧪',
  },
  {
    kind: 'filesystem',
    label: '本地文件系统',
    tagline: '让 agent 读写指定目录',
    description:
      '允许 agent 读取、写入、搜索你指定的本地目录。强烈建议只挂载专门的工作目录 (如 ~/Documents/ob-sandbox),不要挂载整个 home 或根目录。',
    command: 'npx',
    argsTemplate: '-y @modelcontextprotocol/server-filesystem {{path}}',
    scopes: ['read', 'write'],
    fields: [
      {
        name: 'path',
        label: '允许访问的目录',
        placeholder: '/Users/you/Documents/ob-sandbox',
        required: true,
        type: 'path',
        help: '绝对路径。agent 只能访问此目录内的文件,无法访问外部。',
      },
    ],
    confirmWarning:
      'agent 将能够读写此目录中的所有文件。如要收回权限,随时可以在此页禁用或删除。',
    icon: '📁',
  },
  {
    kind: 'memory',
    label: '记忆知识图谱',
    tagline: '让 agent 记住跨对话的结构化知识',
    description:
      '一个轻量级知识图谱服务器,agent 可以把对话中提到的实体、关系、事实写进去,下次对话时再读出来。适合做长期记忆、客户档案、项目上下文管理。',
    command: 'npx',
    argsTemplate: '-y @modelcontextprotocol/server-memory',
    scopes: ['read', 'write'],
    fields: [],
    icon: '🧠',
  },
  {
    kind: 'sqlite',
    label: 'SQLite 数据库',
    tagline: '让 agent 查询你的 SQLite 数据库',
    description:
      '允许 agent 对指定的 SQLite 数据库文件执行 SELECT 查询。只读模式 — 不支持 INSERT/UPDATE/DELETE。',
    command: 'uvx',
    argsTemplate: 'mcp-server-sqlite --db-path {{dbPath}}',
    scopes: ['read'],
    fields: [
      {
        name: 'dbPath',
        label: '数据库文件路径',
        placeholder: '/Users/you/data/mydb.sqlite',
        required: true,
        type: 'path',
      },
    ],
    confirmWarning: 'agent 将能查询此数据库的所有表。',
    icon: '🗄',
  },
  {
    kind: 'git',
    label: 'Git 仓库',
    tagline: '让 agent 查看 git 历史、blame、diff',
    description:
      '只读的 git 操作: log、show、diff、blame、branch。适合让 agent 帮你审查代码历史、找到谁改了某一行、对比分支。',
    command: 'uvx',
    argsTemplate: 'mcp-server-git --repository {{repoPath}}',
    scopes: ['read'],
    fields: [
      {
        name: 'repoPath',
        label: '仓库路径',
        placeholder: '/Users/you/code/myrepo',
        required: true,
        type: 'path',
      },
    ],
    icon: '🌿',
  },
  {
    kind: 'custom',
    label: '自定义 MCP 服务器',
    tagline: '⚠️ 高级用户 — 自行指定命令和参数',
    description:
      '安装任意符合 MCP 协议的服务器。安全责任由你自己承担 — ORANGEBENCH 不会审查自定义命令的安全性。建议只用于内部私有 MCP 或你信任的开源项目。',
    command: '',
    argsTemplate: '',
    scopes: ['read'],
    fields: [
      {
        name: 'command',
        label: '可执行命令',
        placeholder: 'npx / uvx / /path/to/binary',
        required: true,
        type: 'text',
      },
      {
        name: 'args',
        label: '命令参数',
        placeholder: '-y some-mcp-server --flag value',
        required: false,
        type: 'text',
      },
      {
        name: 'envJson',
        label: '环境变量 (JSON)',
        placeholder: '{"API_KEY":"...","BASE_URL":"..."}',
        required: false,
        type: 'password',
        help: '可选。作为 JSON 对象写入,将被加密后传给子进程。',
      },
    ],
    confirmWarning:
      '你将运行任意代码。请确保命令来自你信任的源。ORANGEBENCH 不对自定义 MCP 的行为负责。',
    icon: '🔧',
  },
];

/** Look up a catalog entry by kind. Returns null if not found. */
export function getCatalogEntry(kind: string): McpCatalogEntry | null {
  return MCP_CATALOG.find(e => e.kind === kind) || null;
}

/**
 * Render an argsTemplate by substituting {{field}} placeholders with
 * values from the user-submitted config. Returns the rendered string.
 *
 * Missing fields are left as empty strings rather than throwing —
 * required-field enforcement happens at the API layer before this
 * is called.
 */
export function renderArgsTemplate(
  template: string,
  config: Record<string, unknown>,
): string {
  return template.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, key: string) => {
    const val = config[key];
    return typeof val === 'string' ? val : '';
  });
}
