import type { MetadataRoute } from 'next';

// Next.js App Router convention: serves /robots.txt automatically.
// Must be allowed through middleware — see src/middleware.ts PUBLIC_PATHS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login'],
        disallow: [
          '/api/',
          '/agent',
          '/dashboard',
          '/workspace',
          '/settings',
          '/account',
          '/billing',
          '/profile',
          '/review',
          '/tasks',
          '/invite',
        ],
      },
    ],
    sitemap: 'https://orangebench.tech/sitemap.xml',
    host: 'https://orangebench.tech',
  };
}
