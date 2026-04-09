import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { getPlanConfig } from '@/services/billing'
import { ensureUserWorkspace } from '@/lib/user-setup'

const SIGNUP_BONUS = 500;

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json()

    if (!email || !code) {
      return NextResponse.json({ error: '邮箱和验证码不能为空' }, { status: 400 })
    }

    // 查找有效验证码
    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 401 })
    }

    // 标记为已使用
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    })

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      const config = getPlanConfig('free');
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: true,
          name: email.split('@')[0],
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
    } else if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      })
    }

    // Every user needs a default workspace from day one, otherwise any
    // workspace-gated flow (e.g. "创建团队任务") dead-ends on 403.
    // Idempotent: no-op for returning users who already have one.
    try {
      await ensureUserWorkspace(user.id, user.name)
    } catch (e) {
      console.error('[auth/verify-code] ensureUserWorkspace failed', e)
      // Don't block login on workspace bootstrap failure — user can still
      // use non-workspace features, and the backstop in withWorkspaceMember
      // will retry on next workspace API call.
    }

    // 创建 session
    const token = await createSession(user.id)

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits + user.signupBonusCredits + user.dailyTrialCredits + user.subscriptionCredits + user.generalCredits + user.rewardCredits,
        signupBonusCredits: user.signupBonusCredits,
        dailyTrialCredits: user.dailyTrialCredits,
        subscriptionCredits: user.subscriptionCredits,
        generalCredits: user.generalCredits,
        rewardCredits: user.rewardCredits,
        plan: user.plan,
      },
    })

    // 设置 session cookie（30天）
    response.cookies.set('ob-session', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    // 同时设置 ob-user-id 兼容旧版 API
    response.cookies.set('ob-user-id', user.id, {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/verify-code]', err)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
