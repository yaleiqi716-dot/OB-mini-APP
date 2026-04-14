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

// Default model — verified working with the user's Token Plan as of 2026-04.
// Override via MINIMAX_VIDEO_MODEL env var if your plan provides a different model.
// IMPORTANT: 'MiniMax-Hailuo-2.3-Fast' returns "does not support Text-to-Video mode" —
// the Fast variant is image-to-video only. The non-Fast model is the T2V one.
const DEFAULT_MODEL = process.env.MINIMAX_VIDEO_MODEL || 'MiniMax-Hailuo-2.3';

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
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt,
      // 6s + 768P is the only combo most plans support for Hailuo-2.3.
      // Don't expose duration/resolution to caller until we have multi-tier support.
      duration: 6,
      resolution: '768P',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[MINIMAX] Create error:', res.status, text.slice(0, 200));
    throw new Error(`视频生成请求失败 (${res.status})`);
  }

  const data = await res.json();
  // Minimax wraps responses in base_resp. status_code 0 = success.
  // Plan/auth errors come back as 200 OK with base_resp.status_code !== 0.
  if (data.base_resp && typeof data.base_resp.status_code === 'number' && data.base_resp.status_code !== 0) {
    const msg = data.base_resp.status_msg || '未知错误';
    console.error('[MINIMAX] base_resp error:', data.base_resp.status_code, msg);
    throw new Error(`Minimax 拒绝请求 (${data.base_resp.status_code}): ${msg}`);
  }
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
