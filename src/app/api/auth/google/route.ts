import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { getPlanConfig } from '@/services/billing'

const SIGNUP_BONUS = 500;

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Google OAuth 配置（在 .env 中设置）
// GOOGLE_CLIENT_ID=your_client_id
// GOOGLE_CLIENT_SECRET=your_client_secret
// NEXT_PUBLIC_APP_URL=https://your-domain.com

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// GET /api/auth/google?code=xxx  ← Google 回调
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      new URL('/login?error=google_cancelled', process.env.NEXT_PUBLIC_APP_URL || req.url)
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    // Google OAuth 未配置，重定向到登录页并提示
    return NextResponse.redirect(new URL('/login?error=google_not_configured', appUrl))
  }

  try {
    // 1. 用 code 换取 access_token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/auth/google`,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      throw new Error('获取 access_token 失败')
    }

    // 2. 获取用户信息
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userInfoRes.json()

    if (!googleUser.id || !googleUser.email) {
      throw new Error('获取 Google 用户信息失败')
    }

    // 3. 查找或创建用户
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.id },
          { email: googleUser.email },
        ],
      },
    })

    if (!user) {
      const config = getPlanConfig('free');
      user = await prisma.user.create({
        data: {
          googleId: googleUser.id,
          email: googleUser.email,
          emailVerified: true,
          name: googleUser.name || googleUser.email.split('@')[0],
          avatarUrl: googleUser.picture,
          credits: 0,
          signupBonusCredits: SIGNUP_BONUS,
          dailyTrialCredits: config.dailyTrialCredits,
          subscriptionCredits: 0,
          generalCredits: 0,
          rewardCredits: 0,
          dailyCreditsGrantedAt: today(),
          plan: 'free',
          dailyTaskCount: 0,
          dailyResetDate: today(),
        },
      })
    } else if (!user.googleId) {
      // 绑定 Google ID 到已有邮箱账号
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatarUrl: googleUser.picture || user.avatarUrl,
          emailVerified: true,
        },
      })
    }

    // 4. 创建 session
    const token = await createSession(user.id)

    // Honor redirect from state param or default to /agent
    const state = searchParams.get('state')
    let redirectTo = '/agent'
    if (state) {
      try {
        const decoded = JSON.parse(decodeURIComponent(state))
        if (decoded.redirect && decoded.redirect.startsWith('/')) redirectTo = decoded.redirect
      } catch { /* ignore malformed state */ }
    }
    const response = NextResponse.redirect(new URL(redirectTo, appUrl))

    response.cookies.set('ob-session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    response.cookies.set('ob-user-id', user.id, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/google]', err)
    return NextResponse.redirect(new URL('/login?error=google_failed', appUrl))
  }
}
