import { Resend } from 'resend'
import nodemailer from 'nodemailer'

// Resend (primary)
async function sendViaResend(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const from = process.env.RESEND_FROM || 'ORANGEBENCH <noreply@orangebench.tech>'

  try {
    const resend = new Resend(apiKey)
    console.log(`[Mailer] Sending verification code via Resend, from=${from}, to=${email}`)
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: '\u60a8\u7684 ORANGEBENCH \u767b\u5f55\u9a8c\u8bc1\u7801',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111; margin-bottom: 8px;">\u767b\u5f55\u9a8c\u8bc1\u7801</h2>
          <p style="color: #555; margin-bottom: 24px;">\u60a8\u6b63\u5728\u767b\u5f55 ORANGEBENCH\uff0c\u9a8c\u8bc1\u7801\u6709\u6548\u671f 10 \u5206\u949f\u3002</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">\u5982\u679c\u60a8\u6ca1\u6709\u8bf7\u6c42\u6b64\u9a8c\u8bc1\u7801\uff0c\u8bf7\u5ffd\u7565\u6b64\u90ae\u4ef6\u3002</p>
        </div>
      `,
    })
    if (error) {
      console.error('[Mailer] Resend error:', error.message)
      return false
    }
    console.log('[Mailer] Resend OK ->', email)
    return true
  } catch (err) {
    console.error('[Mailer] Resend exception:', (err as Error).message)
    return false
  }
}

// SMTP (fallback)
async function sendViaSMTP(email: string, code: string): Promise<boolean> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return false

  try {
    const transport = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT,
      auth: { user, pass },
      tls: { servername: process.env.SMTP_TLS_SERVERNAME || undefined },
    })
    await transport.sendMail({
      from: process.env.SMTP_FROM || `ORANGEBENCH <${user}>`,
      to: email,
      subject: '\u60a8\u7684 ORANGEBENCH \u767b\u5f55\u9a8c\u8bc1\u7801',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #111; margin-bottom: 8px;">\u767b\u5f55\u9a8c\u8bc1\u7801</h2>
          <p style="color: #555; margin-bottom: 24px;">\u60a8\u6b63\u5728\u767b\u5f55 ORANGEBENCH\uff0c\u9a8c\u8bc1\u7801\u6709\u6548\u671f 10 \u5206\u949f\u3002</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">\u5982\u679c\u60a8\u6ca1\u6709\u8bf7\u6c42\u6b64\u9a8c\u8bc1\u7801\uff0c\u8bf7\u5ffd\u7565\u6b64\u90ae\u4ef6\u3002</p>
        </div>
      `,
    })
    console.log('[Mailer] SMTP OK ->', email)
    return true
  } catch (err) {
    console.error('[Mailer] SMTP error:', (err as Error).message)
    return false
  }
}

// Main: Resend first, SMTP fallback
export async function sendVerificationCode(email: string, code: string): Promise<boolean> {
  if (process.env.RESEND_API_KEY) {
    const ok = await sendViaResend(email, code)
    if (ok) return true
    console.warn('[Mailer] Resend failed, trying SMTP...')
  }
  if (process.env.SMTP_HOST) {
    return sendViaSMTP(email, code)
  }
  console.error('[Mailer] No mailer configured')
  return false
}

// General-purpose HTML email (for invites etc.)
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      const from = process.env.RESEND_FROM || 'ORANGEBENCH <noreply@orangebench.tech>'
      console.log(`[Mailer] Sending email via Resend, from=${from}, to=${to}, subject=${subject}`)
      const { error } = await resend.emails.send({ from, to: [to], subject, html })
      if (error) { console.error('[Mailer] Resend error:', error.message); return false }
      console.log('[Mailer] Email sent via Resend ->', to)
      return true
    } catch (err) { console.error('[Mailer] Resend exception:', (err as Error).message) }
  }
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && user && pass) {
    try {
      const transport = nodemailer.createTransport({
        host, port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_PORT === '465' || !process.env.SMTP_PORT,
        auth: { user, pass },
        tls: { servername: process.env.SMTP_TLS_SERVERNAME || undefined },
      })
      await transport.sendMail({
        from: process.env.SMTP_FROM || `ORANGEBENCH <${user}>`,
        to, subject, html,
      })
      console.log('[Mailer] Email sent via SMTP ->', to)
      return true
    } catch (err) { console.error('[Mailer] SMTP error:', (err as Error).message) }
  }
  console.error('[Mailer] No mailer configured for general email')
  return false
}
