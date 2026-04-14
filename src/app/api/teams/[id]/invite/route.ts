import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auth'

// GET /api/teams/[id]/invite - 获取邀请链接（刷新 inviteCode）
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const team = await prisma.team.findUnique({ where: { id: params.id } })
  if (!team) return NextResponse.json({ error: '团队不存在' }, { status: 404 })

  // 只有 owner 可以获取邀请链接
  if (team.ownerId !== userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteLink = `${appUrl}/api/teams/join?code=${team.inviteCode}`

  return NextResponse.json({ inviteCode: team.inviteCode, inviteLink })
}

// POST /api/teams/[id]/invite - 刷新邀请码
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const team = await prisma.team.findUnique({ where: { id: params.id } })
  if (!team) return NextResponse.json({ error: '团队不存在' }, { status: 404 })

  if (team.ownerId !== userId) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  // 生成新邀请码
  const { randomUUID } = await import('crypto')
  const newCode = randomUUID()

  const updated = await prisma.team.update({
    where: { id: params.id },
    data: { inviteCode: newCode },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteLink = `${appUrl}/api/teams/join?code=${updated.inviteCode}`

  return NextResponse.json({ inviteCode: updated.inviteCode, inviteLink })
}
