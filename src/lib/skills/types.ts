// Skill role types — a "role" is an AI colleague persona backed by a
// markdown file in src/skills/agency-agents/. Each role file has YAML
// frontmatter (name, description, color) and a markdown body that IS
// the system prompt used when the role is active.

export type SkillRoleDepartment =
  | 'marketing'
  | 'design'
  | 'sales'
  | 'hr'
  | 'product'
  | 'project-management'
  | 'support'
  | 'specialized'
  | 'finance'
  | 'legal'
  | 'engineering'
  | 'paid-media'
  | 'supply-chain'
  | 'testing'
  | 'game-development'
  | 'spatial-computing'
  | 'academic'
  | 'strategy';

// User-facing department labels (Chinese, for the picker UI).
export const DEPARTMENT_LABELS: Record<SkillRoleDepartment, string> = {
  marketing: '营销 · 内容',
  design: '设计 · 品牌',
  sales: '销售 · 客户',
  hr: '人力 · 招聘',
  product: '产品',
  'project-management': '项目管理',
  support: '数据 · 报告',
  specialized: '流程 · 专项',
  finance: '财务',
  legal: '法务',
  engineering: '工程',
  'paid-media': '付费媒体',
  'supply-chain': '供应链',
  testing: '测试',
  'game-development': '游戏',
  'spatial-computing': '空间计算',
  academic: '学术',
  strategy: '战略',
};

export interface SkillRoleMeta {
  // Stable id — derived from filename without .md extension.
  // Example: 'marketing-xiaohongshu-operator'
  id: string;
  // Department bucket.
  department: SkillRoleDepartment;
  // Human name from YAML frontmatter (Chinese). Example: '小红书运营专家'
  name: string;
  // One-line Chinese description from YAML frontmatter.
  description: string;
  // Optional accent color hint from frontmatter. We don't render it
  // directly (design tokens win) but surface it for future theming.
  color?: string;
}

export interface SkillRole extends SkillRoleMeta {
  // Full markdown body — becomes the system prompt when the role is active.
  // NOT sent to the picker UI (too large); only read when a task is created.
  systemPrompt: string;
}
