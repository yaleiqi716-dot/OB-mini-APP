import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/services/billing';

// Pricing tiers
const PRICING = [
  { id: 'tier_100', credits: 100, amount: 500, label: '100 额度 - ¥5' },
  { id: 'tier_500', credits: 500, amount: 2000, label: '500 额度 - ¥20' },
  { id: 'tier_2000', credits: 2000, amount: 6000, label: '2000 额度 - ¥60' },
];

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'demo-user';
    const body = await req.json();
    const tierId = body.tierId as string;
    const provider = (body.provider as string) || 'mock';

    const tier = PRICING.find((p) => p.id === tierId);
    if (!tier) {
      return NextResponse.json({ error: '无效的充值档位' }, { status: 400 });
    }

    await getOrCreateUser(userId);

    const order = await prisma.order.create({
      data: {
        userId,
        amount: tier.amount,
        credits: tier.credits,
        status: 'pending',
        provider,
      },
    });

    // For mock provider: return a simulated pay URL
    // Real implementation would call WeChat/Alipay/PayPal API here
    const payUrl = `/api/billing/webhook?orderId=${order.id}&mock=true`;

    return NextResponse.json({
      orderId: order.id,
      amount: tier.amount,
      credits: tier.credits,
      payUrl,
      pricing: PRICING,
    });
  } catch (error) {
    console.error('[ORDER_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
  }
}

// GET: return pricing tiers
export async function GET() {
  return NextResponse.json({ pricing: PRICING });
}
