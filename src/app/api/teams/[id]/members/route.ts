import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auth'

// GET /api/teams/[id]/members - 获取成员列表
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  // 验证是否为团队成员
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: params.id, userId } },
  })
  if (!membership) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const members = await prisma.teamMember.findMany({
    where: { teamId: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({ members })
}

// DELETE /api/teams/[id]/members - 移除成员（owner 操作）
export async function DELETE(
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

  const { memberId } = await req.json()
  if (!memberId) return NextResponse.json({ error: '缺少 memberId' }, { status: 400 })

  // 不能移除 owner 自己
  if (memberId === userId) {
    return NextResponse.json({ error: '不能移除团队创建者' }, { status: 400 })
  }

  await prisma.teamMember.deleteMany({
    where: { teamId: params.id, userId: memberId },
  })

  return NextResponse.json({ ok: true })
}
