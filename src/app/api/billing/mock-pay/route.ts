import { NextRequest, NextResponse } from 'next/server';

// Mock payment: simulates WeChat callback for development
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: '缺少 orderId' }, { status: 400 });
  }

  // Call the wechat-webhook endpoint with mock data
  const webhookUrl = new URL('/api/billing/wechat-webhook', req.url);
  await fetch(webhookUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mock: true, orderId }),
  });

  // Redirect to tasks page
  return NextResponse.redirect(new URL('/billing', req.url));
}
