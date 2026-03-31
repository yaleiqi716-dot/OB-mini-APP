const MINIMAX_API_URL = 'https://api.minimax.chat/v1';

function getApiKey(): string {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }
  return key;
}

export interface VideoResult {
  jobId: string;
  status: string;
  videoUrl: string | null;
}

export async function generateVideo(topic: string, duration: number, style?: string): Promise<VideoResult> {
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
      model: 'video-01',
      prompt,
    }),
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

  // Poll for result (max 120s)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`${MINIMAX_API_URL}/query/video_generation?task_id=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === 'Success' && pollData.file_id) {
      // Get download URL
      const fileRes = await fetch(`${MINIMAX_API_URL}/files/retrieve?file_id=${pollData.file_id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const fileData = await fileRes.json();

      return {
        jobId: taskId,
        status: 'complete',
        videoUrl: fileData.file?.download_url || null,
      };
    }

    if (pollData.status === 'Failed') {
      throw new Error('视频生成失败');
    }
  }

  return {
    jobId: taskId,
    status: 'processing',
    videoUrl: null,
  };
}
