import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreateUser } from '@/services/billing';
import { emitLog } from '@/services/task-manager';
import { verifyWebhookSignature, parseWebhook } from '@/services/wechat-pay';
import { getProduct, SubscriptionProduct } from '@/lib/billing-config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    // Verify signature
    const timestamp = req.headers.get('wechatpay-timestamp') || '';
    const nonce = req.headers.get('wechatpay-nonce') || '';
    const signature = req.headers.get('wechatpay-signature') || '';
    const serial = req.headers.get('wechatpay-serial') || '';

    const valid = await verifyWebhookSignature({ timestamp, nonce, signature, serial }, body);
    if (!valid) {
      return NextResponse.json({ code: 'FAIL', message: '签名验证失败' }, { status: 401 });
    }

    // Parse payment result
    const payload = parseWebhook(body);
    if (!payload) {
      return NextResponse.json({ code: 'FAIL', message: '解析失败' }, { status: 400 });
    }

    if (payload.tradeState !== 'SUCCESS') {
      console.log(`[WECHAT_WEBHOOK] Non-success state: ${payload.tradeState} for ${payload.outTradeNo}`);
      return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
    }

    // Find local order by outTradeNo (which is our order.id used as out_trade_no)
    // Also try providerOrderId for callbacks that come with transactionId
    let order = await prisma.order.findFirst({
      where: { providerOrderId: payload.transactionId },
    });
    if (!order) {
      // Fallback: outTradeNo is our local order ID (set during createNativeOrder)
      order = await prisma.order.findUnique({ where: { id: payload.outTradeNo } });
    }
    if (!order) {
      console.error(`[WECHAT_WEBHOOK] Order not found: outTradeNo=${payload.outTradeNo}, txnId=${payload.transactionId}`);
      return NextResponse.json({ code: 'FAIL', message: '订单不存在' }, { status: 404 });
    }

    // Idempotent: already paid — do NOT process again
    if (order.status === 'paid') {
      return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
    }

    // Atomic transaction: idempotency gate + fulfill in one go
    const product = getProduct(order.productCode);

    const result = await prisma.$transaction(async (tx) => {
      // Re-read order inside transaction to prevent concurrent double-credit
      const freshOrder = await tx.order.findUnique({ where: { id: order!.id } });
      if (!freshOrder || freshOrder.status === 'paid') {
        // Another webhook already processed this — idempotent exit
        return { alreadyPaid: true };
      }

      // 1. Mark order as paid FIRST (this is the idempotency gate)
      await tx.order.update({
        where: { id: order!.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          providerOrderId: payload.transactionId,
          providerPayload: JSON.stringify(payload.raw),
        },
      });

      // 2. Fulfill: update user credits/plan/expireAt
      const user = await getOrCreateUser(order!.userId);

      if (order!.productType === 'subscription' && product && product.type === 'subscription') {
        const subProduct = product as SubscriptionProduct;
        const now = new Date();
        const baseDate = user.expireAt && user.expireAt > now ? user.expireAt : now;
        const expireAt = new Date(baseDate);
        expireAt.setDate(expireAt.getDate() + subProduct.durationDays);

        await tx.user.update({
          where: { id: order!.userId },
          data: {
            plan: subProduct.plan,
            expireAt,
            subscriptionCredits: (user.subscriptionCredits || 0) + subProduct.credits,
          },
        });

        console.log(`[WECHAT_WEBHOOK] Subscription: ${order!.userId} → ${subProduct.plan}, +${subProduct.credits}cr, expires ${expireAt.toISOString()}`);
      } else {
        // Credits purchase
        await tx.user.update({
          where: { id: order!.userId },
          data: { generalCredits: (user.generalCredits || 0) + order!.credits },
        });

        console.log(`[WECHAT_WEBHOOK] Credits: ${order!.userId} +${order!.credits}`);
      }

      return { alreadyPaid: false };
    });

    // If already processed by concurrent webhook, return success
    if (result.alreadyPaid) {
      return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
    }

    // Requeue blocked tasks (outside transaction — best effort)
    await requeueBlockedTasks(order.userId);

    return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
  } catch (error) {
    console.error('[WECHAT_WEBHOOK_ERROR]', error);
    return NextResponse.json({ code: 'FAIL', message: '处理失败' }, { status: 500 });
  }
}

async function requeueBlockedTasks(userId: string) {
  const blockedTasks = await prisma.task.findMany({
    where: {
      userId,
      OR: [
        { status: 'blocked' },
        { status: 'failed', errorMessage: { contains: '额度不足' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  for (const task of blockedTasks) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'queued',
          errorMessage: null,
          charged: false,
          cost: 0,
          isExecuting: false,
          processing: false,
        },
      });
      await emitLog(task.id, '充值成功，任务已恢复执行');
      console.log(`[WECHAT_WEBHOOK] Requeued task ${task.id}`);
    } catch (err) {
      console.error(`[WECHAT_WEBHOOK] Failed to requeue ${task.id}:`, err);
    }
  }
}
