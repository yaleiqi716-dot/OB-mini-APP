import { NextRequest, NextResponse } from 'next/server';
import { createTask, listTasks, formatTask, updateTaskType, updateTaskStatus, emitLog } from '@/services/task-manager';
import { routeTask } from '@/services/task-router';
import { getWorkflow } from '@/services/workflows';
import { CreateTaskRequest } from '@/types/api';
import { TaskType } from '@/types/task';

// Import workflows to ensure they're registered
import '@/services/workflows';

export async function POST(req: NextRequest) {
  try {
    const body: CreateTaskRequest = await req.json();

    if (!body.input?.trim()) {
      return NextResponse.json({ error: '请输入任务内容' }, { status: 400 });
    }

    const task = await createTask(body.input.trim(), body.source || 'agent');

    // Run routing and workflow in background
    processTask(task.id, body.input.trim(), body.type).catch(console.error);

    return NextResponse.json({
      taskId: task.id,
      type: task.type,
      status: task.status,
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    return NextResponse.json(
      { error: '创建任务失败', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tasks = await listTasks(50);
    const formatted = tasks.map(formatTask);
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json({ error: '获取任务列表失败' }, { status: 500 });
  }
}

async function processTask(taskId: string, input: string, presetType?: TaskType) {
  try {
    // Route the task
    await updateTaskStatus(taskId, 'understanding');
    await emitLog(taskId, '正在识别任务类型...');

    let taskType: TaskType;
    let title: string;

    if (presetType && presetType !== 'unknown') {
      taskType = presetType;
      title = input.slice(0, 50);
    } else {
      const routeResult = await routeTask(input);
      taskType = routeResult.type;
      title = routeResult.title;
    }

    await updateTaskType(taskId, taskType, title);
    await emitLog(taskId, `任务类型：${taskType}`);

    // Get and start workflow
    const workflow = getWorkflow(taskType);
    if (!workflow) {
      await emitLog(taskId, '暂不支持此类型的任务');
      const { failTask } = await import('@/services/task-manager');
      await failTask(taskId, `暂不支持 "${taskType}" 类型的任务`);
      return;
    }

    await workflow.start({
      taskId,
      input,
      context: {},
    });
  } catch (error) {
    console.error('处理任务失败:', error);
    const { failTask } = await import('@/services/task-manager');
    await failTask(taskId, error instanceof Error ? error.message : '处理失败');
  }
}
