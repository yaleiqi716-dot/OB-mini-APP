import { prisma } from '@/lib/prisma';

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

export async function notifyTaskAssigned(workspaceId: string, taskTitle: string, ownerName: string, taskId: string): Promise<void> {
  const url = await getWebhookUrl(workspaceId);
  if (!url) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  await sendWecom(url, `## 新任务分配\n**${ownerName}** 分配了新任务\n> ${taskTitle}\n[查看任务](${appUrl}/workspace/tasks/${taskId})`);
}

export async function notifyTaskSubmitted(workspaceId: string, taskTitle: string, memberName: string, taskId: string): Promise<void> {
  const url = await getWebhookUrl(workspaceId);
  if (!url) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  await sendWecom(url, `## 待审核\n**${memberName}** 提交了任务交付物\n> ${taskTitle}\n[去审核](${appUrl}/workspace/tasks/${taskId})`);
}

export async function notifyTaskRevision(workspaceId: string, taskTitle: string, feedbackPreview: string, taskId: string): Promise<void> {
  const url = await getWebhookUrl(workspaceId);
  if (!url) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  await sendWecom(url, `## 需要修改\n任务「${taskTitle}」被退回\n> ${feedbackPreview.slice(0, 80)}\n[查看详情](${appUrl}/workspace/tasks/${taskId})`);
}

export async function notifyTaskCompleted(workspaceId: string, taskTitle: string, taskId: string): Promise<void> {
  const url = await getWebhookUrl(workspaceId);
  if (!url) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
  await sendWecom(url, `## 任务完成\n任务「${taskTitle}」已通过审核并完成\n[查看结果](${appUrl}/workspace/tasks/${taskId})`);
}
