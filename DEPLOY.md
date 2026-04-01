# OrangeBench 正式上线部署指南

## 当前版本状态

**Branch:** `ui/chatgpt-polish-agent`  
**最新 commit:** `5801669` — TypeScript 编译 ✅ 零错误

---

## 一、已完成功能清单

### 登录系统（P0 ✅）

| 功能 | 路由 | 状态 |
|------|------|------|
| 邮箱验证码发送 | `POST /api/auth/email-code` | ✅ 完成（开发模式打印到控制台，配置 SMTP 后真实发送） |
| 验证码验证登录 | `POST /api/auth/verify-code` | ✅ 完成（创建 Session，设置 `ob-session` cookie） |
| Google OAuth 登录 | `GET /api/auth/google` | ✅ 完成（配置 `GOOGLE_CLIENT_ID` 后启用） |
| 退出登录 | `POST /api/auth/logout` | ✅ 完成（清除 Session） |
| 获取当前用户 | `GET /api/auth/me` | ✅ 完成 |
| 登录页 UI | `/login` | ✅ 完成（Google 按钮 + 邮箱三步流程） |
| 中间件鉴权 | `src/middleware.ts` | ✅ 完成（未登录跳转 /login，API 返回 401） |

### 团队协作（P1 ✅）

| 功能 | 路由 | 状态 |
|------|------|------|
| 创建团队 | `POST /api/teams` | ✅ 完成 |
| 获取团队列表 | `GET /api/teams` | ✅ 完成 |
| 获取邀请链接 | `GET /api/teams/[id]/invite` | ✅ 完成 |
| 刷新邀请码 | `POST /api/teams/[id]/invite` | ✅ 完成 |
| 成员列表 | `GET /api/teams/[id]/members` | ✅ 完成 |
| 移除成员 | `DELETE /api/teams/[id]/members` | ✅ 完成 |
| 通过邀请码加入 | `GET/POST /api/teams/join` | ✅ 完成 |

### 支付系统（P1 ✅）

| 功能 | 路由 | 状态 |
|------|------|------|
| 创建微信支付订单 | `POST /api/billing/create-order` | ✅ 完成（Preview 模式返回 mock QR） |
| 支付 Webhook | `POST /api/billing/wechat-webhook` | ✅ 完成（签名验证 + 原子事务更新 credits/plan/expireAt） |
| 查询订单状态 | `GET /api/billing/status` | ✅ 完成 |
| 充值后重排队 | 内置于 webhook | ✅ 完成（blocked 任务自动恢复） |

---

## 二、启用真实服务（填入环境变量）

在生产服务器的 `.env` 文件中填入以下变量：

```env
# ── 数据库 ──────────────────────────────────────────────
DATABASE_URL="postgresql://user:pass@host:5432/orangebench"

# ── 会话加密 ─────────────────────────────────────────────
NEXTAUTH_SECRET="your-random-secret-32-chars-min"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# ── Google OAuth（填入后 Google 登录按钮自动启用）────────
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
# Google Console 回调地址：https://your-domain.com/api/auth/google

# ── SMTP 邮件（填入后验证码真实发送）────────────────────
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_USER="your@qq.com"
SMTP_PASS="your-smtp-password"
SMTP_FROM="ORANGEBENCH <noreply@orangebench.ai>"

# ── 微信支付（填入后支付真实扣款）──────────────────────
WECHAT_MCH_ID="1234567890"
WECHAT_APP_ID="wx1234567890abcdef"
WECHAT_API_V3_KEY="your-32-char-api-v3-key"
WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WECHAT_SERIAL_NO="your-serial-number"
WECHAT_NOTIFY_URL="https://your-domain.com/api/billing/wechat-webhook"

# ── OpenRouter AI（已有）────────────────────────────────
OPENROUTER_API_KEY="sk-or-xxx"
```

---

## 三、部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/yaleiqi716-dot/OB-mini-APP.git
cd OB-mini-APP

# 2. 安装依赖
pnpm install

# 3. 数据库迁移
npx prisma migrate deploy

# 4. 构建
pnpm build

# 5. 启动
pnpm start
```

---

## 四、上线验收清单

- [ ] 访问 `/login` 显示 Google 按钮 + 邮箱登录入口
- [ ] 邮箱验证码发送成功（查看服务器日志或邮箱）
- [ ] 登录后跳转 `/agent`，cookie 中有 `ob-session`
- [ ] 未登录访问 `/agent` 自动跳转 `/login`
- [ ] 创建团队，复制邀请链接，第二个账号点击链接加入
- [ ] 两个账号均可看到对方的任务（通过 assigneeId）
- [ ] 微信支付扫码后 credits 真实增加（需配置微信支付密钥）

---

## 五、已放弃功能（超出极简范围）

| 功能 | 原因 |
|------|------|
| 复杂 RBAC 权限系统 | 超出极简协作范围 |
| 微信/支付宝第三方登录 | 需要企业资质认证 |
| 忘记密码/重置密码 | 邮箱验证码已覆盖该场景 |
| 团队任务看板 UI | 后端 API 已就绪，前端 UI 待后续迭代 |
| 实时协作（WebSocket）| 超出当前版本范围 |
