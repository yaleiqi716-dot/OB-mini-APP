import { NextRequest, NextResponse } from 'next/server';
import { routeTask } from '@/services/task-router';

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();

    if (!input?.trim()) {
      return NextResponse.json({ error: '请输入内容' }, { status: 400 });
    }

    const result = await routeTask(input.trim());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: '路由失败', detail: String(error) },
      { status: 500 }
    );
  }
}
