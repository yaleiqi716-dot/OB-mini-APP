const MANUS_DEFAULT_URL = 'https://api.manus.im/v1';

function getConfig() {
  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    throw new Error('MANUS_API_KEY 未配置');
  }
  const apiUrl = process.env.MANUS_API_URL || MANUS_DEFAULT_URL;
  return { apiKey, apiUrl };
}

export interface ManusTaskParams {
  instruction: string;
  url?: string;
  context?: string;
}

export interface ManusResult {
  taskId: string;
  status: string;
  output: Record<string, unknown> | null;
}

export async function executeBrowserTask(params: ManusTaskParams): Promise<ManusResult> {
  const { apiKey, apiUrl } = getConfig();

  // Step 1: Create task
  const createRes = await fetch(`${apiUrl}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      instruction: params.instruction,
      ...(params.url ? { url: params.url } : {}),
      ...(params.context ? { context: params.context } : {}),
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    console.error('[MANUS] Create error:', createRes.status, text.slice(0, 200));
    throw new Error(`Manus 任务创建失败 (${createRes.status})`);
  }

  const createData = await createRes.json();
  const taskId = createData.task_id || createData.id;
  if (!taskId) {
    throw new Error('Manus 未返回 task_id');
  }

  // Step 2: Poll for result (max 120s)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`${apiUrl}/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const status = pollData.status || pollData.state;

    if (status === 'completed' || status === 'done' || status === 'success') {
      return {
        taskId,
        status: 'complete',
        output: pollData.output || pollData.result || pollData,
      };
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(pollData.error || pollData.message || 'Manus 任务执行失败');
    }
  }

  // Still running after 120s — return pending
  return {
    taskId,
    status: 'processing',
    output: null,
  };
}
