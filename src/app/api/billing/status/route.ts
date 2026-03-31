import { NextRequest, NextResponse } from 'next/server';
import { getUserStatus } from '@/services/billing';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const status = await getUserStatus(userId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: '获取额度失败' }, { status: 500 });
  }
}
