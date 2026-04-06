# 新加坡 LLM Gateway 方案 v1

> 日期：2026-04-06
> 状态：主站代码已支持 gateway 模式切换，SG 节点待部署

---

## 1. 问题

大陆服务器直连 OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) 受区域限制，导致：
- API 请求被阻断或超时
- Agent 任务执行失败
- 用户体验为"永久 loading"

## 2. 方案

将 LLM 请求通过新加坡节点转发，大陆主站不再直连 OpenRouter。

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│  大陆主站     │ ──────→ │  SG LLM Gateway  │ ──────→ │  OpenRouter  │
│  Web/API/DB  │  HTTP   │  207.148.70.106   │  HTTPS  │  (gpt-4o)   │
│              │         │  :3100            │         │              │
└──────────────┘         └──────────────────┘         └──────────────┘
```

### 主站职责（大陆）
- Web 前端
- 登录 / 认证
- Workspace / Billing / 用户数据
- 任务调度（Worker）
- 调用 SG Gateway 执行 LLM 请求

### SG 节点职责
- 接收主站 LLM 请求
- 转发到 OpenRouter
- 返回响应（支持 streaming）
- 内部鉴权（X-OB-Internal-Key）

---

## 3. 主站代码切换

### 控制文件
`src/lib/openrouter.ts`

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `LLM_GATEWAY_URL` | SG Gateway 地址。不配则直连 OpenRouter | `http://207.148.70.106:3100/v1/chat/completions` |
| `LLM_GATEWAY_KEY` | 内部鉴权 key（传 X-OB-Internal-Key header） | `ob-sg-xxx-your-secret` |
| `OPENROUTER_API_KEY` | OpenRouter API key（始终需要，gateway 也用它调 OpenRouter） | `sk-or-xxx` |

### 判断逻辑

```
if (process.env.LLM_GATEWAY_URL) {
  → Gateway 模式：请求发到 LLM_GATEWAY_URL
  → 附加 X-OB-Internal-Key header（如果 LLM_GATEWAY_KEY 有值）
} else {
  → 直连模式：请求发到 https://openrouter.ai/api/v1/chat/completions
}
```

两种模式下 `Authorization: Bearer <OPENROUTER_API_KEY>` 都会发送。

### 切换方式

```bash
# 启用 SG Gateway（在主站 .env 中加）
LLM_GATEWAY_URL="http://207.148.70.106:3100/v1/chat/completions"
LLM_GATEWAY_KEY="ob-sg-xxx-your-secret"

# 回退直连（删掉或注释）
# LLM_GATEWAY_URL=
```

重启主站即生效，无需改代码。

---

## 4. SG Gateway 最小部署方案

### 4.1 技术选型

最小方案：一个 Node.js HTTP 服务，纯透传请求到 OpenRouter。

### 4.2 部署步骤

```bash
# SSH 到 SG 服务器
ssh root@207.148.70.106

# 创建目录
mkdir -p /opt/ob-llm-gateway && cd /opt/ob-llm-gateway

# 创建 gateway 服务
cat > server.js << 'GATEWAY_EOF'
const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3100;
const INTERNAL_KEY = process.env.OB_INTERNAL_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const server = http.createServer((req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: 'sg-llm-gateway' }));
    return;
  }

  // Only accept POST to /v1/chat/completions
  if (req.method !== 'POST' || !req.url.startsWith('/v1/chat/completions')) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Internal auth check
  if (INTERNAL_KEY && req.headers['x-ob-internal-key'] !== INTERNAL_KEY) {
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const target = new URL(OPENROUTER_URL);
    const options = {
      hostname: target.hostname,
      port: 443,
      path: target.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers['authorization'] || '',
        'HTTP-Referer': req.headers['http-referer'] || 'https://orangebench.tech',
        'X-Title': 'ORANGEBENCH',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[GATEWAY_ERROR]', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Gateway error: ' + err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();

    console.log(`[GATEWAY] ${new Date().toISOString()} POST /v1/chat/completions -> OpenRouter`);
  });
});

server.listen(PORT, () => {
  console.log(`[OB-LLM-GATEWAY] Running on port ${PORT}`);
  console.log(`[OB-LLM-GATEWAY] Internal auth: ${INTERNAL_KEY ? 'ENABLED' : 'DISABLED (warning!)'}`);
});
GATEWAY_EOF

# 创建 .env
cat > .env << 'ENV_EOF'
PORT=3100
OB_INTERNAL_KEY=ob-sg-change-this-to-a-real-secret
ENV_EOF

# 安装 Node.js（如果没有）
# apt install -y nodejs npm

# 用 PM2 运行
npm install -g pm2
pm2 start server.js --name ob-llm-gateway --env-file .env
pm2 save
pm2 startup
```

### 4.3 环境变量（SG 服务器）

| 变量 | 说明 |
|------|------|
| `PORT` | 监听端口，默认 3100 |
| `OB_INTERNAL_KEY` | 内部鉴权 key，与主站 `LLM_GATEWAY_KEY` 一致 |

### 4.4 端口与防火墙

```bash
# 只允许大陆主站 IP 访问 3100 端口
ufw allow from <大陆主站IP> to any port 3100
ufw deny 3100
```

或使用 iptables：
```bash
iptables -A INPUT -p tcp --dport 3100 -s <大陆主站IP> -j ACCEPT
iptables -A INPUT -p tcp --dport 3100 -j DROP
```

---

## 5. 最小鉴权方案

| 层 | 机制 | 说明 |
|----|------|------|
| 网络层 | IP 白名单 | 防火墙只允许大陆主站 IP |
| 应用层 | X-OB-Internal-Key | 请求必须携带正确的 key |

两层同时启用。即使 IP 被伪造，没有 key 也无法调用。

---

## 6. 验证方法

### 6.1 验证 Gateway 健康

```bash
curl http://207.148.70.106:3100/health
# 期望: {"ok":true,"mode":"sg-llm-gateway"}
```

### 6.2 验证 LLM 转发

```bash
curl -X POST http://207.148.70.106:3100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-or-your-key" \
  -H "X-OB-Internal-Key: ob-sg-your-secret" \
  -d '{"model":"openai/gpt-4o","messages":[{"role":"user","content":"ping"}],"max_tokens":10}'
# 期望: 返回 OpenRouter 的正常响应
```

### 6.3 验证主站接通

在主站 .env 中配置 `LLM_GATEWAY_URL` 和 `LLM_GATEWAY_KEY`，重启后：
- 创建一个 Agent 任务
- 查看日志是否出现 `(via gateway)` 标记
- 任务是否正常完成

---

## 7. 当前完成状态

| 项目 | 状态 |
|------|------|
| 主站代码支持 gateway 模式 | ✅ 已完成 |
| `LLM_GATEWAY_URL` 环境变量 | ✅ 已支持 |
| `LLM_GATEWAY_KEY` 鉴权 header | ✅ 已支持 |
| 日志标记 direct vs gateway | ✅ 已支持 |
| streaming 支持 | ✅ 已支持（gateway 透传 stream） |
| SG 服务器 gateway 部署 | ⏳ 待执行 |
| 防火墙 IP 白名单 | ⏳ 待执行 |
| 主站 .env 配置 gateway | ⏳ 待执行 |
| 端到端验证 | ⏳ 待执行 |

---

## 8. 后续可扩展

- 多 provider 路由（OpenRouter / Claude / 其他）
- 请求日志与监控
- 速率限制
- 缓存层
- 多区域 gateway（美西、欧洲等）

当前阶段不做，先把最小转发跑通。
