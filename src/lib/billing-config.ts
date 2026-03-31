// Unified billing product configuration
// All prices in fen (分), 1元 = 100分

export interface SubscriptionProduct {
  code: string;
  type: 'subscription';
  label: string;
  plan: string;          // basic | pro | team
  amount: number;        // fen
  credits: number;       // credits included
  durationDays: number;
}

export interface CreditsProduct {
  code: string;
  type: 'credits';
  label: string;
  amount: number;        // fen
  credits: number;
}

export type Product = SubscriptionProduct | CreditsProduct;

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  { code: 'basic_monthly', type: 'subscription', label: 'Basic 月付', plan: 'basic', amount: 3900, credits: 1000, durationDays: 30 },
  { code: 'pro_monthly', type: 'subscription', label: 'Pro 月付', plan: 'pro', amount: 9900, credits: 5000, durationDays: 30 },
  { code: 'team_monthly', type: 'subscription', label: 'Team 月付', plan: 'team', amount: 29900, credits: 20000, durationDays: 30 },
];

export const CREDITS_PRODUCTS: CreditsProduct[] = [
  { code: 'credits_100', type: 'credits', label: '100 额度', amount: 1900, credits: 100 },
  { code: 'credits_500', type: 'credits', label: '500 额度', amount: 7900, credits: 500 },
  { code: 'credits_2000', type: 'credits', label: '2000 额度', amount: 19900, credits: 2000 },
];

export const ALL_PRODUCTS: Product[] = [...SUBSCRIPTION_PRODUCTS, ...CREDITS_PRODUCTS];

export function getProduct(code: string): Product | undefined {
  return ALL_PRODUCTS.find(p => p.code === code);
}

export function formatAmount(fen: number): string {
  return `¥${(fen / 100).toFixed(fen % 100 === 0 ? 0 : 2)}`;
}
