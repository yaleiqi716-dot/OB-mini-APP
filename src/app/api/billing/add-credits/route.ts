import { NextRequest, NextResponse } from 'next/server';
import { addCredits, getUserStatus } from '@/services/billing';

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'default-user';
    const body = await req.json().catch(() => ({}));
    const amount = typeof body.amount === 'number' ? body.amount : 100;

    await addCredits(userId, amount);
    const status = await getUserStatus(userId);

    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    return NextResponse.json({ error: '充值失败' }, { status: 500 });
  }
}
