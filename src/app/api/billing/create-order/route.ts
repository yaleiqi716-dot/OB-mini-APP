import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/services/billing';
import { getProduct, formatAmount } from '@/lib/billing-config';
import { createNativeOrder } from '@/services/wechat-pay';

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { productCode } = body;

    const product = getProduct(productCode);
    if (!product) {
      return NextResponse.json({ error: '无效的商品' }, { status: 400 });
    }

    await getOrCreateUser(userId);

    // Create local order
    const order = await prisma.order.create({
      data: {
        userId,
        productType: product.type,
        productCode: product.code,
        amount: product.amount,
        credits: product.credits,
        currency: 'CNY',
        status: 'pending',
        provider: 'wechat',
      },
    });

    // Call WeChat Native pay
    const wxResult = await createNativeOrder({
      orderId: order.id,
      description: `ORANGEBENCH - ${product.label}`,
      amount: product.amount,
    });

    if (!wxResult.success) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'failed', providerPayload: wxResult.providerPayload || null },
      });
      return NextResponse.json({ error: wxResult.error || '创建支付失败' }, { status: 500 });
    }

    // Save provider data
    await prisma.order.update({
      where: { id: order.id },
      data: {
        providerOrderId: wxResult.providerOrderId || null,
        providerPayload: wxResult.providerPayload || null,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      productCode: product.code,
      amount: product.amount,
      amountLabel: formatAmount(product.amount),
      codeUrl: wxResult.codeUrl,
    });
  } catch (error) {
    console.error('[ORDER_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
  }
}

export async function GET() {
  const { ALL_PRODUCTS, formatAmount: fmt } = await import('@/lib/billing-config');
  return NextResponse.json({
    products: ALL_PRODUCTS.map(p => ({
      code: p.code,
      type: p.type,
      label: p.label,
      amount: p.amount,
      amountLabel: fmt(p.amount),
      credits: p.credits,
      ...(p.type === 'subscription' ? { plan: p.plan, durationDays: p.durationDays } : {}),
    })),
  });
}
