const LEONARDO_API_URL = 'https://cloud.leonardo.ai/api/rest/v1';

function getApiKey(): string {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) {
    throw new Error('LEONARDO_API_KEY 未配置');
  }
  return key;
}

export interface ImageResult {
  generationId: string;
  imageUrl: string | null;
  status: string;
}

export async function generateImage(prompt: string, style?: string): Promise<ImageResult> {
  const apiKey = getApiKey();

  // Step 1: Create generation
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
      modelId: 'b24e16ff-06e3-43eb-8d33-4c8c0f877eb3', // Leonardo Creative
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    console.error('[LEONARDO] Create error:', createRes.status, text.slice(0, 200));
    throw new Error(`图片生成请求失败 (${createRes.status})`);
  }

  const createData = await createRes.json();
  const generationId = createData.sdGenerationJob?.generationId;
  if (!generationId) {
    throw new Error('Leonardo 未返回 generationId');
  }

  // Step 2: Poll for result (max 60s)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollRes = await fetch(`${LEONARDO_API_URL}/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const gen = pollData.generations_by_pk;

    if (gen?.status === 'COMPLETE' && gen.generated_images?.length > 0) {
      return {
        generationId,
        imageUrl: gen.generated_images[0].url,
        status: 'complete',
      };
    }
  }

  // Return pending if not done in 60s
  return {
    generationId,
    imageUrl: null,
    status: 'pending',
  };
}
