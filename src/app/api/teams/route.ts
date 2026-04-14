import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auth'

// GET /api/teams - 获取当前用户的团队列表
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  })

  const teams = memberships.map(m => ({
    ...m.team,
    myRole: m.role,
  }))

  return NextResponse.json({ teams })
}

// POST /api/teams - 创建新团队
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: '团队名称不能为空' }, { status: 400 })
  }

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      ownerId: userId,
      members: {
        create: {
          userId,
          role: 'owner',
        },
      },
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  })

  return NextResponse.json({ team }, { status: 201 })
}
