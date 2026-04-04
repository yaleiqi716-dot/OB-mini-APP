import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceOwner, isErrorResponse } from '@/lib/workspace-auth';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/mailer';
import { notifyInviteReceived } from '@/services/wecom';

// POST — Create invite (owner only)
export async function POST(req: NextRequest) {
  try {
    const ctx = await withWorkspaceOwner(req);
    if (isErrorResponse(ctx)) return ctx;

    const body = await req.json();
    const { email, role } = body as { email: string; role?: string };

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '请输入有效邮箱' }, { status: 400 });
    }

    // Check if already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.workspaceId, userId: existingUser.id, status: 'active' },
      });
      if (existingMember) {
        return NextResponse.json({ error: '该用户已是工作区成员' }, { status: 400 });
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.workspaceInvite.findFirst({
      where: { workspaceId: ctx.workspaceId, email, status: 'pending', expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      return NextResponse.json({ error: '已有未过期的邀请，请等待对方接受或撤销后重发' }, { status: 400 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: ctx.workspaceId,
        email,
        role: role || 'member',
        invitedBy: ctx.userId,
        token,
        status: 'pending',
        expiresAt,
      },
    });

    // Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orangebench.tech';
    const inviteUrl = `${appUrl}/invite/${token}`;
    const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { name: true } });
    const ownerUser = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } });
    const ownerName = ownerUser?.name || ownerUser?.email || '管理员';
    const workspaceName = workspace?.name || '工作区';

    await sendEmail(
      email,
      `${ownerName} 邀请你加入 ${workspaceName} — ORANGEBENCH`,
      `
      <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px;">
        <div style="margin-bottom: 24px;">
          <span style="color: #F97316; font-weight: 700; font-size: 18px;">ORANGE</span><span style="color: #171717; font-weight: 700; font-size: 18px;">BENCH</span>
        </div>
        <h2 style="color: #171717; font-size: 22px; font-weight: 600; margin: 0 0 8px;">你被邀请加入工作区</h2>
        <p style="color: #6B7280; font-size: 15px; margin: 0 0 24px; line-height: 1.6;">
          <strong>${ownerName}</strong> 邀请你加入工作区 <strong>${workspaceName}</strong>，角色为 ${role === 'owner' ? '管理员' : '成员'}。
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background: #F97316; color: #ffffff; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 12px; text-decoration: none;">
          接受邀请
        </a>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 32px; line-height: 1.6;">
          此邀请 7 天内有效。如果你没有预期收到此邮件，请忽略。
        </p>
      </div>
      `
    );

    // In-app notification for existing users
    notifyInviteReceived(email, workspaceName, ownerName, token).catch(() => {});

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[INVITE_CREATE_ERROR]', error);
    return NextResponse.json({ error: '邀请失败' }, { status: 500 });
  }
}

// GET — List pending invites for workspace (owner only)
export async function GET(req: NextRequest) {
  try {
    const ctx = await withWorkspaceOwner(req);
    if (isErrorResponse(ctx)) return ctx;

    const invites = await prisma.workspaceInvite.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(invites.map(i => ({
      id: i.id,
      token: i.token,
      email: i.email,
      role: i.role,
      status: i.status,
      expired: i.expiresAt < new Date() && i.status === 'pending',
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })));
  } catch (error) {
    console.error('[INVITE_LIST_ERROR]', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
