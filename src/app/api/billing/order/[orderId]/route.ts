import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
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
      },
    });

    if (!order) {
      return NextResponse.json({ error: '订单不存在' }, { status: 404 });
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
