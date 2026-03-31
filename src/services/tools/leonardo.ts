const LEONARDO_API_URL = 'https://cloud.leonardo.ai/api/rest/v1';

function getApiKey(): string {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) {
    throw new Error('LEONARDO_API_KEY 未配置');
  }
  return key;
}

export interface ImageCreateResult {
  generationId: string;
}

export interface ImagePollResult {
  status: 'processing' | 'complete' | 'failed';
  imageUrl: string | null;
  error?: string;
}

export async function createImage(prompt: string, style?: string): Promise<ImageCreateResult> {
  const apiKey = getApiKey();

  const createRes = await fetch(`${LEONARDO_API_URL}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: style ? `${prompt}, ${style} style` : prompt,
      num_images: 1,
      width: 1024,
      height: 1024,
      modelId: 'b24e16ff-06e3-43eb-8d33-4c8c0f877eb3',
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    console.error('[LEONARDO] Create error:', createRes.status, text.slice(0, 200));
    throw new Error(`图片生成请求失败 (${createRes.status})`);
  }

  const data = await createRes.json();
  const generationId = data.sdGenerationJob?.generationId;
  if (!generationId) {
    throw new Error('Leonardo 未返回 generationId');
  }

  return { generationId };
}

export async function pollImage(generationId: string): Promise<ImagePollResult> {
  const apiKey = getApiKey();

  const pollRes = await fetch(`${LEONARDO_API_URL}/generations/${generationId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!pollRes.ok) {
    return { status: 'processing', imageUrl: null };
  }

  const data = await pollRes.json();
  const gen = data.generations_by_pk;

  if (gen?.status === 'COMPLETE' && gen.generated_images?.length > 0) {
    return { status: 'complete', imageUrl: gen.generated_images[0].url };
  }

  if (gen?.status === 'FAILED') {
    return { status: 'failed', imageUrl: null, error: '图片生成失败' };
  }

  return { status: 'processing', imageUrl: null };
}
