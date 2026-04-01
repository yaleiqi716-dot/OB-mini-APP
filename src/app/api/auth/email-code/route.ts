import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOTP } from '@/lib/auth'
import { sendVerificationCode } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 })
    }

    // 清除旧的未使用验证码
    await prisma.verificationCode.deleteMany({
      where: { email, used: false },
    })

    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 分钟

    await prisma.verificationCode.create({
      data: { email, code, expiresAt },
    })

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
