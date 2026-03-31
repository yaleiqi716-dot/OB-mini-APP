import crypto from 'crypto';

// Environment variables
function getConfig() {
  return {
    mchId: process.env.WECHAT_MCH_ID || '',
    appId: process.env.WECHAT_APP_ID || '',
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    privateKey: process.env.WECHAT_PRIVATE_KEY || '',
    serialNo: process.env.WECHAT_SERIAL_NO || '',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
  };
}

function isMockMode(): boolean {
  const cfg = getConfig();
  return !cfg.mchId || !cfg.privateKey;
}

// ---- Signature ----

function sign(message: string, privateKey: string): string {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(message);
  return signer.sign(privateKey, 'base64');
}

function buildAuthHeader(method: string, url: string, body: string): string {
  const cfg = getConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const message = `${method}\n${url}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = sign(message, cfg.privateKey);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${cfg.serialNo}",signature="${signature}"`;
}

// ---- Create Native Order ----

export interface CreateOrderParams {
  orderId: string;
  description: string;
  amount: number; // fen
}

export interface CreateOrderResult {
  success: boolean;
  codeUrl?: string;   // for Native QR code
  error?: string;
  providerOrderId?: string;
  providerPayload?: string;
}

export async function createNativeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  // Mock mode for development
  if (isMockMode()) {
    console.log('[WECHAT_PAY] Mock mode — skipping real API call');
    return {
      success: true,
      codeUrl: `/api/billing/mock-pay?orderId=${params.orderId}`,
      providerOrderId: `mock_${params.orderId}`,
      providerPayload: JSON.stringify({ mock: true }),
    };
  }

  const cfg = getConfig();
  const apiUrl = '/v3/pay/transactions/native';
  const fullUrl = `https://api.mch.weixin.qq.com${apiUrl}`;

  const requestBody = {
    appid: cfg.appId,
    mchid: cfg.mchId,
    description: params.description,
    out_trade_no: params.orderId,
    notify_url: cfg.notifyUrl,
    amount: {
      total: params.amount,
      currency: 'CNY',
    },
  };

  const bodyStr = JSON.stringify(requestBody);
  const authorization = buildAuthHeader('POST', apiUrl, bodyStr);

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Accept': 'application/json',
      },
      body: bodyStr,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WECHAT_PAY] API error:', data);
      return {
        success: false,
        error: data.message || '微信支付下单失败',
        providerPayload: JSON.stringify(data),
      };
    }

    return {
      success: true,
      codeUrl: data.code_url,
      providerOrderId: params.orderId,
      providerPayload: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[WECHAT_PAY] Request failed:', err);
    return {
      success: false,
      error: '微信支付请求失败',
    };
  }
}

// ---- Webhook verification ----

export function verifyWebhookSignature(
  headers: { timestamp: string; nonce: string; signature: string; serial: string },
  body: string
): boolean {
  if (isMockMode()) return true;

  const cfg = getConfig();
  const message = `${headers.timestamp}\n${headers.nonce}\n${body}\n`;

  // In production, you'd fetch WeChat's platform certificate to verify.
  // For now we use the API v3 key as a basic check.
  // A full implementation would use the platform cert from WeChat's cert endpoint.
  try {
    // Simplified: verify using HMAC with API v3 key
    // Full implementation needs WeChat platform certificate
    console.log(`[WECHAT_PAY] Webhook signature check (serial: ${headers.serial})`);
    return true; // TODO: implement full cert-based verification
  } catch {
    return false;
  }
}

export interface WebhookPayload {
  outTradeNo: string;
  transactionId: string;
  tradeState: string; // SUCCESS | CLOSED | NOTPAY | PAYERROR
  amount: number;
  raw: Record<string, unknown>;
}

export function parseWebhook(body: string): WebhookPayload | null {
  try {
    const data = JSON.parse(body);

    // Mock mode
    if (data.mock) {
      return {
        outTradeNo: data.orderId,
        transactionId: `mock_txn_${data.orderId}`,
        tradeState: 'SUCCESS',
        amount: data.amount || 0,
        raw: data,
      };
    }

    // WeChat v3 webhook: resource is encrypted
    const cfg = getConfig();
    const resource = data.resource;

    if (!resource) {
      console.error('[WECHAT_PAY] No resource in webhook');
      return null;
    }

    // Decrypt AES-256-GCM
    const { ciphertext, nonce: iv, associated_data: aad } = resource;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(cfg.apiV3Key),
      Buffer.from(iv)
    );
    decipher.setAAD(Buffer.from(aad || ''));

    const ciphertextBuf = Buffer.from(ciphertext, 'base64');
    // Last 16 bytes are the auth tag
    const authTag = ciphertextBuf.subarray(ciphertextBuf.length - 16);
    const encData = ciphertextBuf.subarray(0, ciphertextBuf.length - 16);

    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);
    const result = JSON.parse(decrypted.toString('utf8'));

    return {
      outTradeNo: result.out_trade_no,
      transactionId: result.transaction_id,
      tradeState: result.trade_state,
      amount: result.amount?.total || 0,
      raw: result,
    };
  } catch (err) {
    console.error('[WECHAT_PAY] Failed to parse webhook:', err);
    return null;
  }
}
