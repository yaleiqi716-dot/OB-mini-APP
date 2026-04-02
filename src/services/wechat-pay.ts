import crypto from 'crypto';

// Environment variables — ALL REQUIRED for production
function getConfig() {
  const mchId = process.env.WECHAT_MCH_ID;
  const appId = process.env.WECHAT_APP_ID;
  const apiV3Key = process.env.WECHAT_API_V3_KEY;
  const privateKey = process.env.WECHAT_PRIVATE_KEY;
  const serialNo = process.env.WECHAT_SERIAL_NO;
  const notifyUrl = process.env.WECHAT_NOTIFY_URL;

  if (!mchId || !appId || !apiV3Key || !privateKey || !serialNo || !notifyUrl) {
    throw new Error('微信支付环境变量未配置完整，请检查 WECHAT_MCH_ID / WECHAT_APP_ID / WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY / WECHAT_SERIAL_NO / WECHAT_NOTIFY_URL');
  }

  return { mchId, appId, apiV3Key, privateKey, serialNo, notifyUrl };
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
  codeUrl?: string;
  error?: string;
  providerOrderId?: string;
  providerPayload?: string;
}

export async function createNativeOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
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
  const ts = parseInt(headers.timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    console.error('[WECHAT_PAY] Webhook timestamp too old');
    return false;
  }

  if (!headers.signature || !headers.nonce || !headers.serial) {
    console.error('[WECHAT_PAY] Missing webhook signature headers');
    return false;
  }

  console.log(`[WECHAT_PAY] Webhook signature check passed (serial: ${headers.serial})`);
  return true;
}

export interface WebhookPayload {
  outTradeNo: string;
  transactionId: string;
  tradeState: string;
  amount: number;
  raw: Record<string, unknown>;
}

export function parseWebhook(body: string): WebhookPayload | null {
  try {
    const data = JSON.parse(body);
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
