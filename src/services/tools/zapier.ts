function getWebhookUrl(): string {
  const url = process.env.ZAPIER_WEBHOOK_URL;
  if (!url) {
    throw new Error('ZAPIER_WEBHOOK_URL 未配置');
  }
  return url;
}

export interface AutomationResult {
  status: string;
  response: Record<string, unknown>;
}

export async function triggerAutomation(action: string, payload: Record<string, unknown>): Promise<AutomationResult> {
  const webhookUrl = getWebhookUrl();

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ...payload,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[ZAPIER] Webhook error:', res.status, text.slice(0, 200));
    throw new Error(`自动化触发失败 (${res.status})`);
  }

  let response: Record<string, unknown> = {};
  try {
    response = await res.json();
  } catch {
    response = { raw: await res.text().catch(() => 'ok') };
  }

  return {
    status: 'triggered',
    response,
  };
}
