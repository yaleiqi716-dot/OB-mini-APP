const MANUS_DEFAULT_URL = 'https://api.manus.ai/v1';

function getConfig() {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    throw new Error('MANUS_API_KEY 未配置');
  }
  const apiUrl = process.env.MANUS_API_URL || MANUS_DEFAULT_URL;
  return { apiKey, apiUrl };
}

export interface ManusTaskParams {
  prompt: string;
  url?: string;
  context?: string;
}

export interface ManusCreateResult {
  taskId: string;
}

export interface ManusPollResult {
  status: 'processing' | 'complete' | 'failed';
  output: Record<string, unknown> | null;
  error?: string;
}

export async function createBrowserTask(params: ManusTaskParams): Promise<ManusCreateResult> {
  const { apiKey, apiUrl } = getConfig();

  const createRes = await fetch(`${apiUrl}/tasks`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'API_KEY': apiKey,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      ...(params.url ? { url: params.url } : {}),
      ...(params.context ? { context: params.context } : {}),
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    console.error('[MANUS] Create error:', createRes.status, text.slice(0, 200));
    throw new Error(`Manus 任务创建失败 (${createRes.status})`);
  }

  const data = await createRes.json();
  const taskId = data.task_id || data.id;
  if (!taskId) {
    throw new Error('Manus 未返回 task_id');
  }

  return { taskId };
}

export async function pollBrowserTask(taskId: string): Promise<ManusPollResult> {
  const { apiKey, apiUrl } = getConfig();

  const pollRes = await fetch(`${apiUrl}/tasks/${taskId}`, {
    headers: {
      'accept': 'application/json',
      'API_KEY': apiKey,
    },
  });

  if (!pollRes.ok) {
    return { status: 'processing', output: null };
  }

  const data = await pollRes.json();
  const status = data.status || data.state;

  if (status === 'completed' || status === 'done' || status === 'success') {
    return {
      status: 'complete',
      output: data.output || data.result || data,
    };
  }

  if (status === 'failed' || status === 'error') {
    return {
      status: 'failed',
      output: null,
      error: data.error || data.message || 'Manus 任务执行失败',
    };
  }

  return { status: 'processing', output: null };
}
