import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { listBrowseSites } from '@/services/tools/browse-whitelist';

export const runtime = 'nodejs';

// GET /api/browse/sites
//
// Returns the full browse whitelist catalog annotated with the current
// user's credential status per site. UI uses this to render the
// "connected / not connected" state in the site picker grid.
//
// Never returns ciphertext or cookie data — only the presence of a
// credential row and its metadata (label, lastUsedAt, expiresAt).
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const sites = listBrowseSites();
    const creds = await prisma.browseCredential.findMany({
      where: { userId },
      select: {
        id: true,
        siteId: true,
        label: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    const credBySite = new Map<string, typeof creds>();
    for (const c of creds) {
      const arr = credBySite.get(c.siteId) || [];
      arr.push(c);
      credBySite.set(c.siteId, arr);
    }

    return NextResponse.json(
      sites.map(s => ({
        id: s.id,
        label: s.label,
        description: s.description,
        loginUrl: s.loginUrl,
        hostnames: s.hostnames,
        capabilities: s.capabilities,
        actions: Object.keys(s.selectors),
        credentials: credBySite.get(s.id) || [],
      })),
    );
  } catch (err) {
    console.error('[BROWSE_SITES_LIST_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
