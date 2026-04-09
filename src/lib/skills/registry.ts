import type { SkillRoleMeta } from './types';
import { loadRole, loadRoleMeta } from './loader';

// The 20 "starter" roles curated for OrangeBench MVP.
// These map to the ICP pain points surfaced in the PM audit:
//   - Daily content (Xiaohongshu / WeChat / Douyin copy)
//   - Weekly ops reports and exec decisions
//   - Sales follow-up + meeting notes + client proposals
//   - HR (JDs, interview, performance)
//   - Brand / visual / IP work
//   - Process architecture
//
// NOTE: ids are '{department}/{filename-without-.md}'.
// Do not change these ids once they ship — Conversation.skillRoleId
// stores them and changing ids would orphan existing conversations.
export const STARTER_ROLE_IDS: readonly string[] = [
  // 内容 · 营销 (5)
  'marketing/marketing-xiaohongshu-operator',
  'marketing/marketing-wechat-operator',
  'marketing/marketing-douyin-strategist',
  'marketing/marketing-content-creator',
  'design/design-brand-guardian',

  // 数据 · 报告 (3)
  'support/support-analytics-reporter',
  'support/support-executive-summary-generator',
  'product/product-feedback-synthesizer',

  // 销售 · 客户 (3)
  'sales/sales-coach',
  'specialized/specialized-meeting-assistant',
  'sales/sales-proposal-strategist',

  // 人力 · 招聘 (2)
  'hr/hr-recruiter',
  'hr/hr-performance-reviewer',

  // 设计 · 视觉 (3)
  'design/design-ui-designer',
  'design/design-image-prompt-engineer',
  'design/design-visual-storyteller',

  // 项目 · 流程 (2)
  'project-management/project-manager-senior',
  'specialized/specialized-workflow-architect',

  // 产品 (2)
  'product/product-manager',
  'product/product-sprint-prioritizer',
] as const;

// In-memory cache of role metadata. Lives for the process lifetime.
// Invalidated on server restart; source files are vendored in the
// repo so they don't change without a redeploy.
let _metaCache: SkillRoleMeta[] | null = null;
let _loadingPromise: Promise<SkillRoleMeta[]> | null = null;

// Load all 20 starter role metadata entries. Cached after first call.
// Concurrent callers share a single in-flight load.
export async function listStarterRoles(): Promise<SkillRoleMeta[]> {
  if (_metaCache) return _metaCache;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    const results = await Promise.all(STARTER_ROLE_IDS.map(id => loadRoleMeta(id)));
    const valid = results.filter((r): r is SkillRoleMeta => r !== null);
    _metaCache = valid;
    _loadingPromise = null;
    return valid;
  })();

  return _loadingPromise;
}

// Look up a single role by id. Returns null if not found.
// Unlike listStarterRoles(), this one always loads the full body
// (systemPrompt) because it's called from the task creation path
// where we need the prompt to inject.
export async function getRoleById(id: string) {
  // Guard against arbitrary ids from user input — only starters allowed.
  if (!STARTER_ROLE_IDS.includes(id)) return null;
  return loadRole(id);
}

// Search roles by name or description (case-insensitive, substring match).
// Used by the picker UI when the user types in the search box.
export async function searchRoles(query: string): Promise<SkillRoleMeta[]> {
  const all = await listStarterRoles();
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter(
    r =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q),
  );
}

// Group roles by department for the picker's section layout.
// Preserves department order as defined in STARTER_ROLE_IDS
// (first department appearance wins).
export async function groupRolesByDepartment(): Promise<
  Array<{ department: string; roles: SkillRoleMeta[] }>
> {
  const all = await listStarterRoles();
  const groups = new Map<string, SkillRoleMeta[]>();
  for (const role of all) {
    if (!groups.has(role.department)) groups.set(role.department, []);
    groups.get(role.department)!.push(role);
  }
  return Array.from(groups.entries()).map(([department, roles]) => ({
    department,
    roles,
  }));
}
