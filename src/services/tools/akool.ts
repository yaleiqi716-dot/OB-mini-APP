const AKOOL_API_URL = 'https://openapi.akool.com/api/open/v3';

function getApiKey(): string {
  const key = process.env.AKOOL_API_KEY;
  if (!key) {
    throw new Error('AKOOL_API_KEY 未配置');
  }
  return key;
}

export interface AvatarCreateResult {
  jobId: string;
}

export interface AvatarPollResult {
  status: 'processing' | 'complete' | 'failed';
  videoUrl: string | null;
  error?: string;
}

export async function createAvatarVideo(script: string, avatarStyle: string): Promise<AvatarCreateResult> {
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

  return { jobId };
}

export async function pollAvatarVideo(jobId: string): Promise<AvatarPollResult> {
  const apiKey = getApiKey();

  const pollRes = await fetch(`${AKOOL_API_URL}/video/detail?id=${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!pollRes.ok) {
    return { status: 'processing', videoUrl: null };
  }

  const data = await pollRes.json();

  if (data.status === 3 && data.video_url) {
    return { status: 'complete', videoUrl: data.video_url };
  }

  if (data.status === 4) {
    return { status: 'failed', videoUrl: null, error: '数字人视频生成失败' };
  }

  return { status: 'processing', videoUrl: null };
}
