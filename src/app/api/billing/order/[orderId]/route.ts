import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addCredits } from '@/services/billing';

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        status: true,
        productCode: true,
        productType: true,
        amount: true,
        credits: true,
        paidAt: true,
        userId: true,
        providerPayload: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
    }

    // Preview mode: auto-complete pending orders that were created with mock provider
    if (order.status === 'pending' && order.providerPayload) {
      try {
        const payload = JSON.parse(order.providerPayload as string);
        if (payload.preview === true && order.userId) {
          // Mark order as paid
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'paid',
              paidAt: new Date(),
            },
          });

          // Add credits to user
          if (order.credits && order.credits > 0) {
            await addCredits(order.userId, order.credits);
          }

          // If subscription, update plan
          if (order.productType === 'subscription' && order.productCode) {
            const planMap: Record<string, string> = {
              basic_monthly: 'basic',
              pro_monthly: 'pro',
              team_monthly: 'team',
            };
            const newPlan = planMap[order.productCode];
            if (newPlan) {
              const now = new Date();
              const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              await prisma.user.update({
                where: { id: order.userId },
                data: { plan: newPlan, expireAt: expiry },
              });
            }
          }

          console.log(`[BILLING] Preview order ${order.id} auto-completed, credits: ${order.credits}`);

          return NextResponse.json({
            id: order.id,
            status: 'paid',
            productCode: order.productCode,
            productType: order.productType,
            amount: order.amount,
            credits: order.credits,
            paidAt: new Date().toISOString(),
          });
        }
      } catch {
        // ignore parse errors, fall through to normal response
      }
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
      productCode: order.productCode,
      productType: order.productType,
      amount: order.amount,
      credits: order.credits,
      paidAt: order.paidAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('[ORDER_QUERY_ERROR]', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
