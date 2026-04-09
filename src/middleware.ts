import { NextRequest, NextResponse } from 'next/server'

// 不需要登录即可访问的路径
const PUBLIC_PATHS = [
  '/login',
  '/invite',
  '/demo', // Public product showcase — no login required.
  '/api/auth/email-code',
  '/api/auth/verify-code',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/workspace/invite/',
  '/_next',
  '/favicon.ico',
  '/icons',
  '/images',
  '/assets',
  // SEO / social sharing infrastructure — MUST be public
  '/robots.txt',
  '/sitemap.xml',
  '/icon',
  '/apple-icon',
  '/opengraph-image',
  '/twitter-image',
  '/manifest.webmanifest',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Root path is public — handled by src/app/page.tsx which does
  // smart routing (authed → /agent, unauth → /demo). We can't add
  // '/' to PUBLIC_PATHS because startsWith('/') matches every path.
  if (pathname === '/') {
    return NextResponse.next()
  }

  // 静态资源和公开路径直接放行
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 检查 session cookie（新版）、ob-user-id（旧版兼容）、x-user-id（内部调用）
  const sessionToken = req.cookies.get('ob-session')?.value
  const legacyUserId = req.cookies.get('ob-user-id')?.value
  const headerUserId = req.headers.get('x-user-id')

  if (!sessionToken && !legacyUserId && !headerUserId) {
    // 未登录：API 返回 401，页面跳转到 /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - _next/static（静态文件）
     * - _next/image（图片优化）
     * - favicon.ico
     * - robots.txt, sitemap.xml（SEO，必须对爬虫公开）
     * - icon, apple-icon, opengraph-image, twitter-image（App Router 生成的静态资源）
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|icon|apple-icon|opengraph-image|twitter-image|manifest\\.webmanifest).*)',
  ],
}
