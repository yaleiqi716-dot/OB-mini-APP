import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateQuota } from '@/services/billing';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || req.cookies.get('ob-user-id')?.value || 'default-user';
    const quota = await getOrCreateQuota(userId);

    return NextResponse.json({
      credits: quota.credits,
      dailyTaskCount: quota.dailyTaskCount,
      dailyLimit: 3,
    });
  } catch (error) {
    return NextResponse.json({ error: '获取额度失败' }, { status: 500 });
  }
}
