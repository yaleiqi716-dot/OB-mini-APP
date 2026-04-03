import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET — Validate invite token (public — no auth required)
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: params.token },
      include: { workspace: { select: { name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ valid: false, reason: 'not_found' });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ valid: false, reason: invite.status });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'expired' });
    }

    return NextResponse.json({
      valid: true,
      workspaceName: invite.workspace.name,
      email: invite.email,
      role: invite.role,
    });
  } catch (error) {
    console.error('[INVITE_VALIDATE_ERROR]', error);
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
