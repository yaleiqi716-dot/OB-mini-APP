import { NextRequest, NextResponse } from 'next/server';
import { createTask, updateTaskStatus, emitLog } from '@/services/task-manager';
import { checkCredits, getOrCreateUser } from '@/services/billing';
import { estimateCost } from '@/lib/cost';
import { prisma } from '@/lib/prisma';
import { TaskType } from '@/types/task';

// ---- Event type → task type mapping ----

const EVENT_TYPE_MAP: Record<string, TaskType> = {
  'email_received': 'email',
  'gmail.new_email': 'email',
  'email_reply': 'email',
  'new_lead': 'proposal',
  'form.submitted': 'proposal',
  'report_request': 'ppt',
  'meeting_summary': 'email',
  'slack.mention': 'unknown',
  'content_request': 'proposal',
};

function buildTaskInput(eventType: string, payload: Record<string, unknown>, title?: string): string {
  const type = EVENT_TYPE_MAP[eventType];

  if (type === 'email') {
    const from = payload.from || payload.sender || '发件人';
    const subject = payload.subject || title || '无主题';
    const body = String(payload.body || payload.content || '').slice(0, 200);
    return `收到一封邮件，发件人：${from}，主题：${subject}。内容：${body}。请帮我处理并回复。`;
  }

  if (type === 'proposal') {
    const name = payload.name || payload.company || title || '新客户';
    const need = payload.need || payload.description || payload.message || '';
    return `有新的业务机会（${name}），${need ? '需求：' + need + '，' : ''}请帮我生成一份方案。`;
  }

  if (type === 'ppt') {
    const topic = payload.topic || payload.title || title || '工作汇报';
    const detail = payload.detail || payload.description || '';
    return `帮我做一份关于"${topic}"的演示文稿${detail ? '，要求：' + detail : ''}`;
  }

  // Generic fallback
  const detail = Object.entries(payload)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
    .join('；');
  return `收到外部事件"${title || eventType}"：${detail || '无详情'}。请分析并处理。`;
}

const PLAN_PRIORITY: Record<string, number> = { team: 3, pro: 2, basic: 1, free: 0 };

export async function POST(req: NextRequest) {
  try {
    // Auth
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-ob-secret') || req.headers.get('x-api-key');
      if (provided !== secret) {
        return NextResponse.json({ error: '认证失败' }, { status: 401 });
      }
    }

    const body = await req.json();
    const { type, eventType, payload, userId: bodyUserId, title } = body;

    const evtType = type || eventType;
    if (!evtType || !payload) {
      return NextResponse.json({ error: '缺少 type 和 payload' }, { status: 400 });
    }

    if (!bodyUserId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    }
    const userId = bodyUserId;
    const taskType = EVENT_TYPE_MAP[evtType] || 'unknown';
    const taskInput = buildTaskInput(evtType, payload as Record<string, unknown>, title);

    // Credits check
    const user = await getOrCreateUser(userId);
    const creditCheck = await checkCredits(userId, taskType);
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 403 });
    }

    // Create + queue (worker handles execution)
    const cost = estimateCost(taskType);
    const task = await createTask(taskInput, 'api', {
      userId,
      estimatedCost: cost,
    });

    const priority = PLAN_PRIORITY[user.plan] || 0;
    await prisma.task.update({
      where: { id: task.id },
      data: { type: taskType, title: (title || evtType).slice(0, 50), priority },
    });
    await updateTaskStatus(task.id, 'queued');
    await emitLog(task.id, `外部事件触发：${evtType}`);

    return NextResponse.json({
      success: true,
      taskId: task.id,
      taskType,
      estimatedCost: cost,
    }, { status: 202 });
  } catch (error) {
    console.error('[INGEST_ERROR]', error);
    return NextResponse.json({ error: '处理事件失败' }, { status: 500 });
  }
}
