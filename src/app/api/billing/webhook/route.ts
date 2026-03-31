import { NextResponse } from 'next/server';

// Legacy webhook endpoint — all payment callbacks go through /api/billing/wechat-webhook
export async function GET() {
  return NextResponse.json({ error: '请使用 /api/billing/wechat-webhook' }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: '请使用 /api/billing/wechat-webhook' }, { status: 410 });
}
