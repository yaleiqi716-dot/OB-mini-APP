import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { BROWSE_WHITELIST, BrowseSiteId } from '@/services/tools/browse-whitelist';
import { storeCredential, listCredentials } from '@/services/tools/browse-vault';

export const runtime = 'nodejs';

// GET /api/browse/credentials
//   Returns metadata-only list of the user's stored browse credentials.
//   Never returns ciphertext or plaintext cookies.
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const rows = await listCredentials(userId);
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[BROWSE_CRED_LIST_ERROR]', err);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST /api/browse/credentials
//   Body: { siteId, label, cookies, expiresAt? }
//   cookies = raw cookie JSON (the format gstack cookie-import accepts) OR
//             Netscape cookie file text. We don't validate the shape here;
//             the browse runtime will fail on first use if it's malformed.
//
//   The plaintext cookie value is encrypted by the vault BEFORE the DB
//   write. Request body length is capped at 256KB — cookies can be
//   surprisingly large (Cloudflare can issue 20+ cookies on big sites).
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const bodyText = await req.text();
    if (bodyText.length > 256 * 1024) {
      return NextResponse.json({ error: 'cookies 过大(>256KB)' }, { status: 413 });
    }
    let body: {
      siteId?: string;
      label?: string;
      cookies?: string;
      expiresAt?: string;
    };
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
    }

    if (!body.siteId || !(body.siteId in BROWSE_WHITELIST)) {
      return NextResponse.json({ error: '未知的站点' }, { status: 400 });
    }
    if (!body.cookies || typeof body.cookies !== 'string' || body.cookies.length === 0) {
      return NextResponse.json({ error: '缺少 cookies 字段' }, { status: 400 });
    }
    if (!body.label || typeof body.label !== 'string') {
      return NextResponse.json({ error: '请填写凭证备注' }, { status: 400 });
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: 'expiresAt 格式无效' }, { status: 400 });
    }

    const result = await storeCredential({
      userId,
      siteId: body.siteId as BrowseSiteId,
      label: body.label,
      plaintextCookies: body.cookies,
      expiresAt,
    });

    return NextResponse.json({ id: result.id, success: true });
  } catch (err) {
    console.error('[BROWSE_CRED_CREATE_ERROR]', err);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
