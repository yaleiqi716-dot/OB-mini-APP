import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { ensureUserWorkspace } from '@/lib/user-setup';

// Auth context returned by middleware helpers
export interface AuthContext {
  userId: string;
}

export interface WorkspaceMemberContext extends AuthContext {
  workspaceId: string;
  membershipId: string;
  role: string; // 'owner' | 'member'
}

export interface WorkspaceOwnerContext extends AuthContext {
  workspaceId: string;
}

// withAuth: ensures user is logged in, returns userId
export async function withAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  return { userId };
}

// withWorkspaceMember: ensures user is an active member of a workspace
// Returns workspace ID + role for further authorization
// Self-healing: if a legacy user has no workspace, we bootstrap a default
// one on the spot rather than 403'ing with an unactionable "未加入工作区".
export async function withWorkspaceMember(req: NextRequest): Promise<WorkspaceMemberContext | NextResponse> {
  const auth = await withAuth(req);
  if (auth instanceof NextResponse) return auth;

  let membership = await prisma.workspaceMember.findFirst({
    where: { userId: auth.userId, status: 'active' },
  });

  if (!membership) {
    // Legacy user (pre-ensureUserWorkspace). Bootstrap a default workspace
    // inline so every workspace-aware endpoint is self-healing.
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true },
      });
      await ensureUserWorkspace(auth.userId, user?.name);
      membership = await prisma.workspaceMember.findFirst({
        where: { userId: auth.userId, status: 'active' },
      });
    } catch (e) {
      console.error('[withWorkspaceMember] ensureUserWorkspace failed', e);
    }
  }

  if (!membership) {
    return NextResponse.json({ error: '未加入工作区' }, { status: 403 });
  }

  return {
    userId: auth.userId,
    workspaceId: membership.workspaceId,
    membershipId: membership.id,
    role: membership.role,
  };
}

// withWorkspaceOwner: ensures user is the owner of a workspace
// Self-healing: bootstraps a default workspace for legacy users who own none.
export async function withWorkspaceOwner(req: NextRequest): Promise<WorkspaceOwnerContext | NextResponse> {
  const auth = await withAuth(req);
  if (auth instanceof NextResponse) return auth;

  let workspace = await prisma.workspace.findFirst({
    where: { ownerId: auth.userId },
  });

  if (!workspace) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { name: true },
      });
      await ensureUserWorkspace(auth.userId, user?.name);
      workspace = await prisma.workspace.findFirst({
        where: { ownerId: auth.userId },
      });
    } catch (e) {
      console.error('[withWorkspaceOwner] ensureUserWorkspace failed', e);
    }
  }

  if (!workspace) {
    return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 403 });
  }

  return {
    userId: auth.userId,
    workspaceId: workspace.id,
  };
}

// Helper: check if a result is an error response
export function isErrorResponse(result: unknown): result is NextResponse {
  return result instanceof NextResponse;
}
