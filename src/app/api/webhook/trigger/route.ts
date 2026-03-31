import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits, getOrCreateUser } from '@/services/billing';
import { estimateCost } from '@/lib/cost';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

const PLAN_PRIORITY: Record<string, number> = { team: 3, pro: 2, basic: 1, free: 0 };

// ---- Event type → task type + input mapping ----

interface EventMapping {
  taskType: TaskType;
  buildInput: (data: Record<string, unknown>) => string;
}

const EVENT_MAP: Record<string, EventMapping> = {
  email_reply: {
    taskType: 'email',
    buildInput: (data) => {
      const from = data.from || '客户';
      const subject = data.subject || '';
      const body = String(data.body || data.content || '').slice(0, 200);
      return `帮我回复${from}的邮件，主题是"${subject}"，原文：${body}`;
    },
  },
  new_lead: {
    taskType: 'proposal',
    buildInput: (data) => {
      const name = data.name || data.company || '新客户';
      const need = data.need || data.description || '需求待确认';
      return `有一个新线索（${name}），需求：${need}，帮我生成一份初步方案`;
    },
  },
  report_request: {
    taskType: 'ppt',
    buildInput: (data) => {
      const topic = data.topic || data.title || '工作汇报';
      const detail = data.detail || data.description || '';
      return `帮我做一份${topic}的演示文稿${detail ? '，要求：' + detail : ''}`;
    },
  },
  meeting_summary: {
    taskType: 'email',
    buildInput: (data) => {
      const topic = data.topic || '会议';
      const attendees = data.attendees || '';
      return `帮我总结${topic}的要点并生成一封会议纪要邮件${attendees ? '，参会人：' + attendees : ''}`;
    },
  },
  content_request: {
    taskType: 'proposal',
    buildInput: (data) => {
      const topic = data.topic || data.title || '';
      return `帮我撰写一份关于${topic || '指定主题'}的内容方案`;
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && apiKey !== webhookSecret) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const body = await req.json();
    const { type, data, userId: bodyUserId, input: directInput } = body;

    if (!bodyUserId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    }
    const userId = bodyUserId;

    // Resolve task type and input from event mapping or direct fields
    let taskType: TaskType;
    let taskInput: string;

    const mapping = type ? EVENT_MAP[type] : null;

    if (mapping && data) {
      taskType = mapping.taskType;
      taskInput = mapping.buildInput(data as Record<string, unknown>);
    } else if (directInput?.trim()) {
      taskType = (type as TaskType) || 'unknown';
      taskInput = directInput.trim();
    } else if (type && data) {
      // Unknown event type — build generic input
      taskType = 'unknown';
      const detail = Object.entries(data as Record<string, unknown>)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join('；');
      taskInput = `处理外部事件 "${type}"：${detail || '无详情'}`;
    } else {
      return NextResponse.json({ error: '缺少 type+data 或 input' }, { status: 400 });
    }

    // Credits check
    const user = await getOrCreateUser(userId);
    const creditCheck = await checkCredits(userId, taskType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    // Create task
    const cost = estimateCost(taskType);
    const task = await createTask(taskInput, 'api', {
      userId,
      estimatedCost: cost,
    });

    const priority = PLAN_PRIORITY[user.plan] || 0;
    await prisma.task.update({ where: { id: task.id }, data: { priority } });
    await updateTaskStatus(task.id, 'queued');
    await emitLog(task.id, `外部事件触发：${type || 'direct'}`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      taskType,
      estimatedCost: cost,
    }, { status: 202 });
  } catch (error) {
    console.error('[WEBHOOK_TRIGGER_ERROR]', error);
    return NextResponse.json({ error: '触发失败' }, { status: 500 });
  }
}
