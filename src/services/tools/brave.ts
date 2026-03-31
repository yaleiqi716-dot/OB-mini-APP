const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

function getApiKey(): string {
  const key = process.env.BRAVE_API_KEY;
  if (!key) {
    throw new Error('BRAVE_API_KEY 未配置');
  }
  return key;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(query: string, count = 5): Promise<SearchResult[]> {
  const apiKey = getApiKey();

  const url = `${BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${count}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[BRAVE] API error:', res.status, text.slice(0, 200));
    throw new Error(`搜索失败 (${res.status})`);
  }

  const data = await res.json();
  const results: SearchResult[] = (data.web?.results || [])
    .slice(0, count)
    .map((r: Record<string, unknown>) => ({
      title: String(r.title || ''),
      url: String(r.url || ''),
      description: String(r.description || ''),
    }));

  return results;
}
