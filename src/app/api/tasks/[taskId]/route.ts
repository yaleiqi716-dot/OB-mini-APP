import { NextRequest, NextResponse } from 'next/server';
import { getTaskFormatted } from '@/services/task-manager';

export async function GET(
  _req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const task = await getTaskFormatted(params.taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
  }
}
