import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth';
import { SKILL_CATALOG } from '@/services/skills/catalog';

export const runtime = 'nodejs';

// GET /api/skills/hub
//
// Aggregated view of all connected skills for the authenticated user.
// Merges three data sources (WebhookEndpoint, BrowseCredential, McpServer)
// into a unified shape the Skills Hub page renders.

interface ConnectedSkill {
  instanceId: string;
  skillId: string;
  name: string;
  type: 'webhook' | 'browse' | 'mcp';
  status: 'active' | 'disabled' | 'error';
  icon: string;
  connectionMethod: string;
  toolCount?: number;
  lastUsedAt?: string | null;
  failureCount?: number;
  webhookUrl?: string;
  browseSiteId?: string;
  expiresAt?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const [webhooks, browseCreds, mcpServers, browseUsage, mcpUsage] = await Promise.all([
      prisma.webhookEndpoint.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.browseCredential.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.mcpServer.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.browseUsage.findFirst({ where: { userId, day: todayKey() }, select: { callCount: true } }).catch(() => null),
      prisma.mcpUsage.findFirst({ where: { userId, day: todayKey() }, select: { callCount: true } }).catch(() => null),
    ]);

    const connected: ConnectedSkill[] = [];

    // Webhooks
    const whKindMap: Record<string, string> = { feishu: 'feishu-webhook', dingtalk: 'dingtalk-webhook', wecom: 'wecom-webhook', generic: 'custom-webhook' };
    for (const wh of webhooks) {
      const skillId = whKindMap[wh.kind] || 'custom-webhook';
      const cat = SKILL_CATALOG.find(e => e.id === skillId);
      connected.push({
        instanceId: wh.id, skillId, name: wh.name, type: 'webhook',
        status: wh.active ? 'active' : 'disabled',
        icon: cat?.icon || 'custom_webhook',
        connectionMethod: 'webhook_url',
        lastUsedAt: wh.lastFiredAt?.toISOString() || null,
        failureCount: wh.failureCount,
        webhookUrl: maskUrl(wh.url),
      });
    }

    // Browse credentials
    for (const bc of browseCreds) {
      const skillId = `${bc.siteId}-browse`;
      const cat = SKILL_CATALOG.find(e => e.id === skillId);
      connected.push({
        instanceId: bc.id, skillId, name: cat?.name || bc.siteId, type: 'browse',
        status: 'active', icon: cat?.icon || bc.siteId,
        connectionMethod: 'cookie',
        lastUsedAt: bc.lastUsedAt?.toISOString() || null,
        browseSiteId: bc.siteId,
        expiresAt: bc.expiresAt?.toISOString() || null,
      });
    }

    // MCP servers
    for (const ms of mcpServers) {
      const skillId = `${ms.kind}-mcp`;
      const cat = SKILL_CATALOG.find(e => e.id === skillId);
      connected.push({
        instanceId: ms.id, skillId, name: ms.name, type: 'mcp',
        status: ms.enabled ? 'active' : 'disabled',
        icon: cat?.icon || 'mcp',
        connectionMethod: cat?.connectionMethod || 'builtin',
        toolCount: extractToolCount(ms.cachedTools),
        lastUsedAt: ms.lastUsedAt?.toISOString() || null,
      });
    }

    return NextResponse.json({
      connected,
      quota: {
        browse: { used: browseUsage?.callCount ?? 0, limit: Number(process.env.BROWSE_DAILY_LIMIT || 100) },
        mcp: { used: mcpUsage?.callCount ?? 0, limit: Number(process.env.MCP_DAILY_LIMIT || 100) },
      },
    });
  } catch (err) {
    console.error('[SKILLS_HUB_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function maskUrl(url: string): string {
  try { const u = new URL(url); const p = u.pathname; return p.length > 12 ? `${u.origin}/${p.slice(1, 7)}...${p.slice(-6)}` : `${u.origin}${p}`; } catch { return '***'; }
}

function extractToolCount(raw: string | null): number {
  if (!raw) return 0;
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
}
