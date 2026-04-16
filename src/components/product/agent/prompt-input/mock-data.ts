// Part of OrangeBench product internal design system

export const MOCK_ROLES = [
  { id: "writer", name: "文案策划", dept: "市场营销", icon: "PenLine", desc: "擅长营销文案、品牌故事" },
  { id: "analyst", name: "数据分析师", dept: "数据", icon: "BarChart3", desc: "业务数据分析、报告生成" },
  { id: "designer", name: "产品设计师", dept: "产品", icon: "Palette", desc: "产品方案、用户体验设计" },
  { id: "pm", name: "项目经理", dept: "运营", icon: "ListChecks", desc: "项目规划、进度管理" },
  { id: "dev", name: "全栈工程师", dept: "技术", icon: "Code2", desc: "代码实现、技术方案" },
  { id: "sales", name: "销售顾问", dept: "销售", icon: "HandshakeIcon", desc: "客户跟进、商务邮件" },
  { id: "hr", name: "HR 顾问", dept: "人事", icon: "Users", desc: "招聘 JD、员工沟通" },
  { id: "finance", name: "财务顾问", dept: "财务", icon: "Calculator", desc: "预算、财务分析" },
] as const;

export const MOCK_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", desc: "平衡性能与速度", tier: "pro" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "快速响应", tier: "free" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", desc: "长文理解、代码", tier: "pro" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", desc: "最强推理", tier: "pro" },
  { id: "grok-4", name: "Grok 4", desc: "实时信息", tier: "pro" },
] as const;

export const PLACEHOLDER_EXAMPLES = [
  "比如：写一份行业调研报告、整理季度 PPT、帮我跟进客户邮件...",
  "比如：分析上季度销售数据、生成产品发布文案、制定月度工作计划...",
  "比如：把会议纪要整理成行动项、写一份竞品分析报告、设计一个 Landing Page...",
  "比如：起草商务合作邮件、总结一篇论文要点、做一份项目周报...",
  "比如：创作小红书营销文案、规划一次用户访谈、整理客户反馈分类...",
  "比如：生成产品演示 PPT、写一份招聘 JD、翻译并润色一篇英文文档...",
] as const;
