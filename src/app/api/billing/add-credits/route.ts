import { NextResponse } from 'next/server';

// SECURITY: This endpoint is permanently disabled for all users.
// Credits are only added via the wechat-webhook route after verified payment.
// If admin credit adjustment is needed in the future, implement a separate
// admin-authenticated endpoint with proper RBAC.
export async function POST() {
  return NextResponse.json(
    { error: '此接口已关闭，请通过正常支付流程充值' },
    { status: 403 }
  );
}
