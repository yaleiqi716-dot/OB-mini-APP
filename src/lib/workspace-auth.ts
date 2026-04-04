import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';

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
export async function withWorkspaceMember(req: NextRequest): Promise<WorkspaceMemberContext | NextResponse> {
  const auth = await withAuth(req);
  if (auth instanceof NextResponse) return auth;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: auth.userId, status: 'active' },
  });

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

// withWorkspaceOwner: ensures user is the owner of the workspace
export async function withWorkspaceOwner(req: NextRequest): Promise<WorkspaceOwnerContext | NextResponse> {
  const auth = await withAuth(req);
  if (auth instanceof NextResponse) return auth;

  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: auth.userId },
  });

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
