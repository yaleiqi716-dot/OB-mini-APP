import { prisma } from './prisma'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SESSION_COOKIE = 'ob-session'
const SESSION_EXPIRE_DAYS = 30

// ─── Session 管理 ─────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRE_DAYS)

  const session = await prisma.session.create({
    data: { userId, expiresAt },
  })
  return session.token
}

export async function getSessionUser(req?: NextRequest) {
  let token: string | undefined

  if (req) {
    token = req.cookies.get(SESSION_COOKIE)?.value
    // fallback: legacy ob-user-id cookie (兼容旧版本)
    if (!token) {
      const legacyId = req.cookies.get('ob-user-id')?.value
      if (legacyId) {
        // 查找或创建对应用户
        const user = await prisma.user.findFirst({ where: { id: legacyId } })
        return user
      }
    }
  } else {
    const cookieStore = await cookies()
    token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) {
      const legacyId = cookieStore.get('ob-user-id')?.value
      if (legacyId) {
        const user = await prisma.user.findFirst({ where: { id: legacyId } })
        return user
      }
    }
  }

  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return session.user
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } })
}

// ─── 从请求中获取 userId（兼容新旧两种认证方式）────────────────────────────────

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const user = await getSessionUser(req)
  return user?.id ?? null
}

// ─── 生成 6 位验证码 ─────────────────────────────────────────────────────────

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
