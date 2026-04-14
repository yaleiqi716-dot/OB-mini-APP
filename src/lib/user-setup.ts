import { prisma } from '@/lib/prisma';

/**
 * Idempotent workspace bootstrap.
 *
 * Every user should have exactly one owned workspace from the moment their
 * account exists — otherwise UI flows like "创建团队任务" hit a 403
 * "未加入工作区" dead end with no actionable next step.
 *
 * Rules:
 *  - Safe to call multiple times — returns existing workspace if found.
 *  - Called from both signup paths (verify-code + Google OAuth) for new users.
 *  - Called as a backstop from withWorkspaceMember / GET /api/workspace so
 *    legacy users who signed up before this helper existed get a workspace
 *    the first time they hit any workspace-aware endpoint.
 *  - Workspace name defaults to "{displayName}'s Workspace" but gracefully
 *    falls back to "我的工作区" if displayName is empty.
 *
 * @returns the workspace id + whether it was newly created
 */
export async function ensureUserWorkspace(
  userId: string,
  displayName?: string | null,
): Promise<{ workspaceId: string; created: boolean }> {
  // Fast path: user already owns a workspace.
  const existingOwned = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (existingOwned) {
    // Defensive: make sure owner is also an active member (can get out of
    // sync if DB was hand-edited or an old migration left it inconsistent).
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: { workspaceId: existingOwned.id, userId },
      },
      create: {
        workspaceId: existingOwned.id,
        userId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      },
      update: {
        role: 'owner',
        status: 'active',
      },
    });
    return { workspaceId: existingOwned.id, created: false };
  }

  // Also fast path: user is already an active member of someone else's
  // workspace (e.g. invited teammate). Don't create a second one.
  const activeMembership = await prisma.workspaceMember.findFirst({
    where: { userId, status: 'active' },
    select: { workspaceId: true },
  });
  if (activeMembership) {
    return { workspaceId: activeMembership.workspaceId, created: false };
  }

  // Create the default workspace in one transaction.
  const name = buildDefaultWorkspaceName(displayName);
  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name, ownerId: userId },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      },
    });
    return ws;
  });

  return { workspaceId: workspace.id, created: true };
}

function buildDefaultWorkspaceName(displayName?: string | null): string {
  const trimmed = (displayName || '').trim();
  if (!trimmed) return '我的工作区';
  // If the name already contains CJK, use "{name} 的工作区"; otherwise
  // fall back to English "{name}'s Workspace".
  const hasCJK = /[\u4e00-\u9fff]/.test(trimmed);
  return hasCJK ? `${trimmed} 的工作区` : `${trimmed}'s Workspace`;
}
