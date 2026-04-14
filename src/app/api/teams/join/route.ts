import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auth'

// GET /api/teams/join?code=xxx - 通过邀请码加入团队（浏览器直接访问）
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  const code = req.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (!userId) {
    // 未登录，跳转到登录页，登录后再跳回
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', `/api/teams/join?code=${code}`)
    return NextResponse.redirect(loginUrl)
  }

  const team = await prisma.team.findUnique({ where: { inviteCode: code } })
  if (!team) {
    return NextResponse.redirect(new URL('/agent?error=invalid_invite', req.url))
  }

  // 检查是否已经是成员
  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId } },
  })

  if (!existing) {
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: 'member',
      },
    })
  }

  // 跳转到 agent 页面，带上成功提示
  return NextResponse.redirect(new URL(`/agent?joined=${team.id}`, req.url))
}

// POST /api/teams/join - 通过邀请码加入团队（API 调用）
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: '邀请码不能为空' }, { status: 400 })

  const team = await prisma.team.findUnique({ where: { inviteCode: code } })
  if (!team) return NextResponse.json({ error: '邀请码无效' }, { status: 404 })

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId } },
  })

  if (existing) {
    return NextResponse.json({ ok: true, message: '您已是该团队成员', team })
  }

  await prisma.teamMember.create({
    data: { teamId: team.id, userId, role: 'member' },
  })

  return NextResponse.json({ ok: true, message: '成功加入团队', team }, { status: 201 })
}
