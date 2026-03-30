import { NextRequest, NextResponse } from 'next/server';
import { getTask } from '@/services/task-manager';
import { parseJSON } from '@/lib/utils';

export async function GET(
  _req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const task = await getTask(params.taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json({
      ...task,
      context: parseJSON(task.context, {}),
      result: task.result ? parseJSON(task.result, null) : null,
      events: task.events.map((e) => ({
        ...e,
        data: parseJSON(e.data, {}),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: '获取任务失败' }, { status: 500 });
  }
}
