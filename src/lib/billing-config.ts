// ORANGEBENCH 订阅方案 v1 — 2026-04-06
// All prices in fen (分), 1元 = 100分
// Single source of truth for billing display + API

// ── Subscription Plans ──

export interface SubscriptionProduct {
  code: string;
  type: 'subscription';
  label: string;
  plan: string;
  amount: number;                    // fen
  credits: number;                   // 每月订阅积分
  dailyTrialCredits: number;         // 每日体验赠额
  durationDays: number;
  concurrency: number;
  scheduledTasks: number;
  features: string[];
  description: string;
  recommended?: boolean;
  teamPerSeat?: boolean;
}

export interface CreditsProduct {
  code: string;
  type: 'credits';
  label: string;
  amount: number;                    // fen
  baseCredits: number;
  bonusCredits: number;
  totalCredits: number;
  displayLabel: string;
}

export type Product = SubscriptionProduct | CreditsProduct;

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  {
    code: 'basic_monthly',
    type: 'subscription',
    label: 'Basic',
    plan: 'basic',
    amount: 3900,
    credits: 2000,
    dailyTrialCredits: 60,
    durationDays: 30,
    concurrency: 3,
    scheduledTasks: 5,
    features: ['标准 Agent 任务', '基础工作区协作'],
    description: '适合开始日常使用的个人用户',
  },
  {
    code: 'pro_monthly',
    type: 'subscription',
    label: 'Pro',
    plan: 'pro',
    amount: 8900,
    credits: 5500,
    dailyTrialCredits: 120,
    durationDays: 30,
    concurrency: 10,
    scheduledTasks: 15,
    features: ['高级研究', '深度汇报 / PPT', '更强 Agent 模式', '完整工作区协作', 'Cloud Browser 基础配额'],
    description: '适合高频工作流与深度执行需求',
    recommended: true,
  },
  {
    code: 'team_monthly',
    type: 'subscription',
    label: 'Team',
    plan: 'team',
    amount: 19900,
    credits: 6000,
    dailyTrialCredits: 120,
    durationDays: 30,
    concurrency: 10,
    scheduledTasks: 15,
    features: ['完整团队协作能力', '成员邀请 / 分配 / 审核', '评论 / 通知', '管理员视角', '团队共享积分池'],
    description: '适合老板和团队协作闭环',
    teamPerSeat: true,
  },
];

export const CREDITS_PRODUCTS: CreditsProduct[] = [
  {
    code: 'credits_1500',
    type: 'credits',
    label: '通用积分包',
    amount: 1900,
    baseCredits: 1500,
    bonusCredits: 0,
    totalCredits: 1500,
    displayLabel: '1,500 通用积分',
  },
  {
    code: 'credits_5500',
    type: 'credits',
    label: '通用积分包',
    amount: 5900,
    baseCredits: 5000,
    bonusCredits: 500,
    totalCredits: 5500,
    displayLabel: '5,000 + 赠 500 通用积分',
  },
  {
    code: 'credits_20000',
    type: 'credits',
    label: '通用积分包',
    amount: 19900,
    baseCredits: 18000,
    bonusCredits: 2000,
    totalCredits: 20000,
    displayLabel: '18,000 + 赠 2,000 通用积分',
  },
];

export const ALL_PRODUCTS: Product[] = [...SUBSCRIPTION_PRODUCTS, ...CREDITS_PRODUCTS];

export function getProduct(code: string): Product | undefined {
  return ALL_PRODUCTS.find(p => p.code === code);
}

export function formatAmount(fen: number): string {
  return `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : 2)}`;
}

// ── Free tier (not a purchasable product) ──
export const FREE_TIER = {
  plan: 'free',
  label: 'Free',
  signupBonusCredits: 500,
  dailyTrialCredits: 120,
  concurrency: 1,
  scheduledTasks: 2,
  features: ['Lite / 轻任务体验', '可加入 1 个工作区'],
  description: '先体验 ORANGEBENCH 的基础能力',
};

// ── Credit consumption order ──
// 每日体验赠额 → 新人赠送 → 订阅积分 → 通用积分
