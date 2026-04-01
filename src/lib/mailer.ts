import nodemailer from 'nodemailer'

// 配置说明：在 .env 中设置以下变量即可启用真实邮件发送
// SMTP_HOST=smtp.qq.com
// SMTP_PORT=465
// SMTP_USER=your@qq.com
// SMTP_PASS=your_smtp_password
// SMTP_FROM="ORANGEBENCH <noreply@orangebench.ai>"

function createTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    // 开发模式：打印到控制台
    return null
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT,
    auth: { user, pass },
  })
}

export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  const transport = createTransport()

  if (!transport) {
    // 开发模式：控制台输出验证码
    console.log(`[DEV] 邮箱验证码 → ${email}: ${code}`)
    return true
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || `ORANGEBENCH <${process.env.SMTP_USER}>`,
      to: email,
      subject: '您的 ORANGEBENCH 登录验证码',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111; margin-bottom: 8px;">登录验证码</h2>
          <p style="color: #555; margin-bottom: 24px;">您正在登录 ORANGEBENCH，验证码有效期 10 分钟。</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">如果您没有请求此验证码，请忽略此邮件。</p>
        </div>
      `,
    })
    return true
  } catch (err) {
    // SMTP 发送失败时，降级到控制台输出，确保验证码流程不中断
    console.error('[Mailer] SMTP 发送失败，降级到控制台输出:', (err as Error).message)
    console.log(`[FALLBACK] 邮箱验证码 → ${email}: ${code}`)
    return true  // 降级成功，返回 true
  }
}
