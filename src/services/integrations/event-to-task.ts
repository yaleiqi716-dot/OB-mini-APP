interface ExternalEvent {
  source: string;
  eventType: string;
  title?: string;
  payload: Record<string, unknown>;
}

export function eventToTaskInput(event: ExternalEvent): string {
  const { eventType, payload } = event;

  switch (eventType) {
    case 'gmail.new_email':
      return buildGmailDescription(payload);
    case 'form.submitted':
      return buildFormDescription(payload);
    case 'slack.mention':
      return buildSlackDescription(payload);
    default:
      return buildGenericDescription(event);
  }
}

function buildGmailDescription(payload: Record<string, unknown>): string {
  const from = payload.from || '未知发件人';
  const subject = payload.subject || '无主题';
  const body = payload.body || '';
  const bodyPreview = String(body).slice(0, 200);

  return `收到一封邮件，发件人：${from}，主题：《${subject}》。邮件内容：${bodyPreview}。请判断并处理此邮件。`;
}

function buildFormDescription(payload: Record<string, unknown>): string {
  const formName = payload.formName || payload.form_name || '未知表单';
  const entries = Object.entries(payload)
    .filter(([k]) => !['formName', 'form_name'].includes(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join('；');

  return `收到一个表单提交（${formName}），内容：${entries || '无详细内容'}。请整理内容并生成后续处理建议。`;
}

function buildSlackDescription(payload: Record<string, unknown>): string {
  const channel = payload.channel || '未知频道';
  const user = payload.user || payload.from || '某人';
  const text = payload.text || payload.message || '';

  return `Slack 频道 #${channel} 中 ${user} 提及了你，内容：「${text}」。请总结并决定是否需要行动。`;
}

function buildGenericDescription(event: ExternalEvent): string {
  const { source, eventType, title, payload } = event;
  const summary = title || eventType;
  const detail = Object.entries(payload)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 100)}`)
    .join('；');

  return `收到来自 ${source} 的事件「${summary}」，详情：${detail || '无'}。请分析并决定如何处理。`;
}
