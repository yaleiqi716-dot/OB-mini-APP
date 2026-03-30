import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskStatus, emitLog, failTask } from '@/services/task-manager';

// Orchestrator interface for Manus-style execution
interface OrchestratorRequest {
  goal: string;
  constraints?: string[];
  tools?: string[];
  maxSteps?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: OrchestratorRequest = await req.json();

    if (!body.goal?.trim()) {
      return NextResponse.json({ error: '目标不能为空' }, { status: 400 });
    }

    // Create a task for the orchestrated execution
    const task = await createTask(body.goal.trim(), 'api');

    // For now, log and mark as pending until Manus integration is complete
    (async () => {
      try {
        await updateTaskStatus(task.id, 'understanding');
        await emitLog(task.id, '编排器已接收任务');
        await emitLog(task.id, `目标：${body.goal}`);
        if (body.constraints?.length) {
          await emitLog(task.id, `约束条件：${body.constraints.join('、')}`);
        }
        // TODO: Implement Manus orchestration loop
        // 1. Plan: Break down goal into steps
        // 2. Execute: Run each step using available tools
        // 3. Observe: Check results and adjust plan
        // 4. Loop until goal is achieved or max steps reached
        await failTask(task.id, '编排器功能正在开发中，请使用工作卡片触发具体任务');
      } catch (err) {
        await failTask(task.id, String(err));
      }
    })();

    return NextResponse.json(
      {
        taskId: task.id,
        status: 'accepted',
        message: '编排器接口已就绪，完整功能开发中',
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: '编排器调用失败', detail: String(error) },
      { status: 500 }
    );
  }
}
