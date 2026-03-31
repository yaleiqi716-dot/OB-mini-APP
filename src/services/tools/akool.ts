const AKOOL_API_URL = 'https://openapi.akool.com/api/open/v3';

function getApiKey(): string {
  const key = process.env.AKOOL_API_KEY;
  if (!key) {
    throw new Error('AKOOL_API_KEY 未配置');
  }
  return key;
}

export interface AvatarVideoResult {
  jobId: string;
  status: string;
  videoUrl: string | null;
}

export async function generateAvatarVideo(script: string, avatarStyle: string): Promise<AvatarVideoResult> {
  const apiKey = getApiKey();

  const res = await fetch(`${AKOOL_API_URL}/video/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input_text: script,
      avatar_style: avatarStyle,
      language: 'zh',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[AKOOL] Create error:', res.status, text.slice(0, 200));
    throw new Error(`数字人视频生成请求失败 (${res.status})`);
  }

  const data = await res.json();
  const jobId = data._id || data.job_id || data.id;
  if (!jobId) {
    throw new Error('Akool 未返回 jobId');
  }

  // Poll for result (max 120s)
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`${AKOOL_API_URL}/video/detail?id=${jobId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();

    if (pollData.status === 3 && pollData.video_url) {
      return {
        jobId,
        status: 'complete',
        videoUrl: pollData.video_url,
      };
    }

    if (pollData.status === 4) {
      throw new Error('数字人视频生成失败');
    }
  }

  return {
    jobId,
    status: 'processing',
    videoUrl: null,
  };
}
