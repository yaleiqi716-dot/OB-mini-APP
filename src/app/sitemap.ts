import type { MetadataRoute } from 'next';

// Next.js App Router convention: serves /sitemap.xml automatically.
// Must be allowed through middleware — see src/middleware.ts PUBLIC_PATHS.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://orangebench.tech';
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
