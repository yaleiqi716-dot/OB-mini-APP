import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOTP } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/mailer'
import { rateLimit, getClientIp, rateLimitedResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 })
    }

    // Rate limit by IP and by email separately. IP limit stops a single attacker
    // from spamming many emails; email limit stops targeted mailbox flooding.
    const ip = getClientIp(req)
    const ipLimit = rateLimit(ip, { key: 'email-code:ip', max: 10, windowMs: 60 * 60 * 1000 })
    if (!ipLimit.ok) return rateLimitedResponse(ipLimit)

    const emailLimit = rateLimit(email.toLowerCase(), {
      key: 'email-code:email',
      max: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!emailLimit.ok) return rateLimitedResponse(emailLimit, '该邮箱发送验证码过于频繁，请稍后再试')

    // 清除旧的未使用验证码
    await prisma.verificationCode.deleteMany({
      where: { email, used: false },
    })

    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 分钟

    await prisma.verificationCode.create({
      data: { email, code, expiresAt },
    })

    // DEV ONLY: Do not ship to production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] 验证码已跳过发送，使用万能码 888888 登录 ${email}`)
      return NextResponse.json({ ok: true, message: '验证码已发送（开发模式）' })
    }

    const sent = await sendVerificationCode(email, code)

    if (!sent) {
      return NextResponse.json({ error: '验证码发送失败，请稍后重试' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: '验证码已发送' })
  } catch (err) {
    console.error('[auth/email-code]', err)
    return NextResponse.json({ error: '服务器错误' }, { status: 500 })
  }
}
