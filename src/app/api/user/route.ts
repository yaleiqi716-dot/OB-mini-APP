import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/services/billing';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'demo-user';
    const user = await getOrCreateUser(userId);

    return NextResponse.json({
      id: user.id,
      credits: user.credits,
      plan: user.plan,
    });
  } catch (error) {
    return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
