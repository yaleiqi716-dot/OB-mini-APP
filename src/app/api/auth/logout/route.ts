import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('ob-session')?.value

  if (token) {
    await deleteSession(token)
  }

  const response = NextResponse.json({ ok: true })

  // 清除所有认证 cookie
  response.cookies.set('ob-session', '', { maxAge: 0, path: '/' })
  response.cookies.set('ob-user-id', '', { maxAge: 0, path: '/' })

  return response
}
