import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addCredits, getOrCreateUser } from '@/services/billing';
import { updateTaskStatus, emitLog } from '@/services/task-manager';
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

    const valid = verifyWebhookSignature({ timestamp, nonce, signature, serial }, body);
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

    // Find local order
    const order = await prisma.order.findUnique({ where: { id: payload.outTradeNo } });
    if (!order) {
      console.error(`[WECHAT_WEBHOOK] Order not found: ${payload.outTradeNo}`);
      return NextResponse.json({ code: 'FAIL', message: '订单不存在' }, { status: 404 });
    }

    // Idempotent: already paid
    if (order.status === 'paid') {
      return NextResponse.json({ code: 'SUCCESS', message: 'OK' });
    }

    // Update order
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        providerOrderId: payload.transactionId,
        providerPayload: JSON.stringify(payload.raw),
      },
    });

    // Fulfill based on product type
    const product = getProduct(order.productCode);

    if (order.productType === 'subscription' && product && product.type === 'subscription') {
      const subProduct = product as SubscriptionProduct;
      const now = new Date();
      const user = await getOrCreateUser(order.userId);

      // Extend from current expiry or from now
      const baseDate = user.expireAt && user.expireAt > now ? user.expireAt : now;
      const expireAt = new Date(baseDate);
      expireAt.setDate(expireAt.getDate() + subProduct.durationDays);

      await prisma.user.update({
        where: { id: order.userId },
        data: {
          plan: subProduct.plan,
          expireAt,
          credits: user.credits + subProduct.credits,
        },
      });

      console.log(`[WECHAT_WEBHOOK] Subscription activated: ${order.userId} → ${subProduct.plan}, +${subProduct.credits} credits, expires ${expireAt.toISOString()}`);
    } else {
      // Credits purchase
      await addCredits(order.userId, order.credits);
      console.log(`[WECHAT_WEBHOOK] Credits added: ${order.userId} +${order.credits}`);
    }

    // Requeue blocked tasks
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
