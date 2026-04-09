import { prisma } from '@/lib/prisma';

// ── In-app notification creation ──
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  linkUrl?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body: body || null, linkUrl: linkUrl || null },
    });
  } catch (err) {
    console.error('[NOTIFICATION_CREATE_ERROR]', err);
  }
}

// Send WeCom webhook notification — never throws, never blocks business logic
async function sendWecom(webhookUrl: string, content: string): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content },
      }),
    });
  } catch (err) {
    console.error('[WECOM_NOTIFY_ERROR]', err);
  }
}

// Get workspace's webhook URL
async function getWebhookUrl(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { wecomWebhookUrl: true },
  });
  return ws?.wecomWebhookUrl || null;
}

// ── 4 notification events ──

// recipientUserId = who gets the in-app notification

// fireWebhooks is dynamically imported below to avoid a circular import
// risk if/when webhook code grows to import from wecom for any reason.

export async function notifyTaskAssigned(workspaceId: string, taskTitle: string, ownerName: string, taskId: string, recipientUserId?: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  const link = `${appUrl}/workspace/tasks/${taskId}`;
  // WeCom
  const url = await getWebhookUrl(workspaceId);
  if (url) await sendWecom(url, `## 新任务分配\n**${ownerName}** 分配了新任务\n> ${taskTitle}\n[查看任务](${link})`);
  // In-app
  if (recipientUserId) {
    await createNotification(recipientUserId, 'task_assigned', `${ownerName} 给你分配了新任务`, taskTitle, `/workspace/tasks/${taskId}`);
    // Outbound webhooks (Zapier / any HTTP receiver) — Phase 3.
    // Fire-and-forget; dispatcher catches all errors internally.
    const { fireWebhooks, payloads } = await import('./webhooks/dispatcher');
    fireWebhooks(
      recipientUserId,
      'task_assigned',
      payloads.taskAssigned({ workspaceId, taskId, taskTitle, ownerName, assigneeId: recipientUserId }),
    ).catch(() => {});
  }
}

export async function notifyTaskSubmitted(workspaceId: string, taskTitle: string, memberName: string, taskId: string, recipientUserId?: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  const link = `${appUrl}/workspace/tasks/${taskId}`;
  const url = await getWebhookUrl(workspaceId);
  if (url) await sendWecom(url, `## 待审核\n**${memberName}** 提交了任务交付物\n> ${taskTitle}\n[去审核](${link})`);
  if (recipientUserId) {
    await createNotification(recipientUserId, 'task_submitted', `${memberName} 提交了任务`, taskTitle, `/workspace/tasks/${taskId}`);
    const { fireWebhooks, payloads } = await import('./webhooks/dispatcher');
    fireWebhooks(
      recipientUserId,
      'task_submitted',
      payloads.taskSubmitted({ workspaceId, taskId, taskTitle, memberName, ownerId: recipientUserId }),
    ).catch(() => {});
  }
}

export async function notifyTaskRevision(workspaceId: string, taskTitle: string, feedbackPreview: string, taskId: string, recipientUserId?: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  const link = `${appUrl}/workspace/tasks/${taskId}`;
  const url = await getWebhookUrl(workspaceId);
  if (url) await sendWecom(url, `## 需要修改\n任务「${taskTitle}」被退回\n> ${feedbackPreview.slice(0, 80)}\n[查看详情](${link})`);
  if (recipientUserId) {
    await createNotification(recipientUserId, 'task_revision', `任务「${taskTitle}」被退回修改`, feedbackPreview.slice(0, 100), `/workspace/tasks/${taskId}`);
    const { fireWebhooks, payloads } = await import('./webhooks/dispatcher');
    fireWebhooks(
      recipientUserId,
      'task_revision',
      payloads.taskRevision({ workspaceId, taskId, taskTitle, feedbackPreview: feedbackPreview.slice(0, 200), assigneeId: recipientUserId }),
    ).catch(() => {});
  }
}

export async function notifyTaskCompleted(workspaceId: string, taskTitle: string, taskId: string, recipientUserId?: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  const link = `${appUrl}/workspace/tasks/${taskId}`;
  const url = await getWebhookUrl(workspaceId);
  if (url) await sendWecom(url, `## 任务完成\n任务「${taskTitle}」已通过审核并完成\n[查看结果](${link})`);
  if (recipientUserId) {
    await createNotification(recipientUserId, 'task_completed', `任务「${taskTitle}」已完成`, undefined, `/workspace/tasks/${taskId}`);
    const { fireWebhooks, payloads } = await import('./webhooks/dispatcher');
    fireWebhooks(
      recipientUserId,
      'task_completed',
      payloads.taskCompleted({ workspaceId, taskId, taskTitle, assigneeId: recipientUserId }),
    ).catch(() => {});
  }
}

export async function notifyInviteReceived(recipientEmail: string, workspaceName: string, inviterName: string, token: string): Promise<void> {
  // Find user by email to create in-app notification
  const user = await prisma.user.findUnique({ where: { email: recipientEmail }, select: { id: true } });
  if (user) {
    await createNotification(user.id, 'invite_received', `${inviterName} 邀请你加入工作区`, workspaceName, `/invite/${token}`);
  }
}
