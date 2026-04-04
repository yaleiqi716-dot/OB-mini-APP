import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withWorkspaceOwner, isErrorResponse } from '@/lib/workspace-auth';

// POST — Create workspace (auto-adds owner as member)
export async function POST(req: NextRequest) {
  try {
    const ctx = await withAuth(req);
    if (isErrorResponse(ctx)) return ctx;

    const body = await req.json();
    const { name } = body;
    if (!name || !name.trim()) return NextResponse.json({ error: '请输入工作区名称' }, { status: 400 });

    // Check if user already has a workspace (MVP: one per user)
    const existing = await prisma.workspace.findFirst({ where: { ownerId: ctx.userId } });
    if (existing) return NextResponse.json({ error: '已有工作区，MVP 版本每用户限一个' }, { status: 400 });

    const workspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: { name: name.trim(), ownerId: ctx.userId },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: ctx.userId, role: 'owner', status: 'active', joinedAt: new Date() },
      });
      return ws;
    });

    return NextResponse.json(workspace);
  } catch (error) {
    console.error('[WORKSPACE_CREATE_ERROR]', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

// GET — Get current user's workspace
export async function GET(req: NextRequest) {
  try {
    const ctx = await withAuth(req);
    if (isErrorResponse(ctx)) return ctx;

    // Find workspace where user is a member
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: ctx.userId, status: 'active' },
      include: {
        workspace: {
          include: {
            _count: { select: { members: { where: { status: 'active' } }, tasks: true } },
          },
        },
      },
    });

    if (!membership) return NextResponse.json(null);

    return NextResponse.json({
      ...membership.workspace,
      role: membership.role,
      memberCount: membership.workspace._count.members,
      taskCount: membership.workspace._count.tasks,
    });
  } catch (error) {
    console.error('[WORKSPACE_GET_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// PATCH — Update workspace settings
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await withWorkspaceOwner(req);
    if (isErrorResponse(ctx)) return ctx;

    const body = await req.json();
    const { name, wecomWebhookUrl } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (wecomWebhookUrl !== undefined) data.wecomWebhookUrl = wecomWebhookUrl || null;

    const updated = await prisma.workspace.update({
      where: { id: ctx.workspaceId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[WORKSPACE_UPDATE_ERROR]', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
