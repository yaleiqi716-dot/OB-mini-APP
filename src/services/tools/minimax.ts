const MINIMAX_API_URL = 'https://api.minimax.chat/v1';

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }
  return key;
}

export interface VideoCreateResult {
  jobId: string;
}

export interface VideoPollResult {
  status: 'processing' | 'complete' | 'failed';
  videoUrl: string | null;
  error?: string;
}

export async function createVideo(topic: string, duration: number, style?: string): Promise<VideoCreateResult> {
  const apiKey = getApiKey();

  const prompt = style
    ? `制作一个关于"${topic}"的${style}风格视频，时长约${duration}秒`
    : `制作一个关于"${topic}"的视频，时长约${duration}秒`;

  const res = await fetch(`${MINIMAX_API_URL}/video_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'video-01', prompt }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[MINIMAX] Create error:', res.status, text.slice(0, 200));
    throw new Error(`视频生成请求失败 (${res.status})`);
  }

  const data = await res.json();
  const taskId = data.task_id;
  if (!taskId) {
    throw new Error('Minimax 未返回 task_id');
  }

  return { jobId: taskId };
}

export async function pollVideo(jobId: string): Promise<VideoPollResult> {
  const apiKey = getApiKey();

  const pollRes = await fetch(`${MINIMAX_API_URL}/query/video_generation?task_id=${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!pollRes.ok) {
    return { status: 'processing', videoUrl: null };
  }

  const data = await pollRes.json();

  if (data.status === 'Success' && data.file_id) {
    const fileRes = await fetch(`${MINIMAX_API_URL}/files/retrieve?file_id=${data.file_id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const fileData = await fileRes.json();
    return {
      status: 'complete',
      videoUrl: fileData.file?.download_url || null,
    };
  }

  if (data.status === 'Failed') {
    return { status: 'failed', videoUrl: null, error: '视频生成失败' };
  }

  return { status: 'processing', videoUrl: null };
}
