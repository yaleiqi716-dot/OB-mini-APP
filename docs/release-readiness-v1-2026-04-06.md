# ORANGEBENCH 正式放量 Readiness v1

> 日期：2026-04-06
> 适用 commit：`90ebf17`
> 分支：`claude/url-driven-ui-sWSBQ`

---

## A. 当前版本基线

| 项目 | 值 |
|------|---|
| 推荐发布 commit | `90ebf17` |
| 分支 | `claude/url-driven-ui-sWSBQ` |
| 主站域名 | orangebench.tech |
| 主站服务器 | 大陆节点（具体 IP 由运维确认） |
| SG Gateway | `207.148.70.106:3100` |
| 邮件发信域名 | `noreply@orangebench.tech`（Resend） |
| 默认 LLM 出口 | SG Gateway → OpenRouter → openai/gpt-4o |
| 数据库 | SQLite（Prisma 5.22） |
| 框架 | Next.js 14.2 / React 18 |

---

## B. 当前已具备的可放量能力

### 1. 登录与身份

| 能力 | 状态 | 验证 |
|------|------|------|
| 邮箱验证码登录 | ✅ 可用 | Resend 发信 + 10 分钟验证码 |
| Google OAuth 登录 | ✅ 代码就绪 | 需线上配置 GOOGLE_CLIENT_ID/SECRET |
| 新用户完整积分初始化 | ✅ 可用 | 邮箱 + Google 两条链路都已对齐 |
| redirect 回跳 | ✅ 可用 | 登录后跳回原页面 / 邀请页 |
| ob-session 主认证 | ✅ 可用 | 30 天有效期 |
| x-user-id / ob-user-id 兼容 | ✅ 可用 | middleware + route 三种方式一致 |

### 2. Agent

| 能力 | 状态 |
|------|------|
| 创建任务 | ✅ 可用 |
| 恢复历史会话 | ✅ 可用 |
| 附件上传 | ✅ 可用 |
| 执行态 SSE 进入 | ✅ 可用 |
| 意图路由（text/search/image/video/automation/browser） | ✅ 可用 |
| Email / PPT / Proposal 工作流 | ✅ 可用 |
| SG Gateway → OpenRouter → gpt-4o | ✅ 已验证 |
| 任务失败错误提示 | ✅ 可用（taskLoadError + retry） |
| 积分不足拦截 | ✅ 可用 |
| Worker 并发控制 + 死锁恢复 | ✅ 可用 |

### 3. Workspace

| 能力 | 状态 |
|------|------|
| 创建工作区 | ✅ 可用 |
| 邀请成员（邮件 + 链接） | ✅ 可用 |
| 加入工作区 | ✅ 可用 |
| 任务创建 → 分配 → 提交 → 审核 → 完成 | ✅ 可用 |
| Revision 修改流程 | ✅ 可用 |
| 评论 | ✅ 可用 |
| 通知（站内 + WeCom） | ✅ 可用 |
| 权限隔离（withAuth / withWorkspaceMember / withWorkspaceOwner） | ✅ 可用 |

### 4. Billing / Account

| 能力 | 状态 |
|------|------|
| 套餐展示（Basic / Pro / Team） | ✅ 可用 |
| 通用积分包（1500 / 5500 / 20000） | ✅ 可用 |
| 微信 Native Pay 下单 | ✅ 可用 |
| Webhook 到账（幂等事务） | ✅ 可用 |
| 最近订单展示 | ✅ 可用 |
| 购买成功 / 失败详细反馈 | ✅ 可用 |
| 取消订阅（到期后生效） | ✅ 可用 |
| 降级订阅（到期后生效） | ✅ 可用 |
| 撤销取消 / 降级 | ✅ 可用 |
| 订阅积分月度清零（不结转） | ✅ 可用 |
| 到期三分支处理（cancel / downgrade / expire） | ✅ 可用 |
| 续费清除 cancel/downgrade 标记 | ✅ 可用 |

### 5. 积分系统

| 能力 | 状态 |
|------|------|
| 新人赠送 500 | ✅ 可用 |
| 每日体验赠额（Free 120 / Basic 60 / Pro 120 / Team 120） | ✅ 可用 |
| 5 桶分账（daily / signup / subscription / general / reward） | ✅ 可用 |
| 五级消耗顺序 | ✅ 可用 |
| legacy credits 兼容（第 6 级） | ✅ 可用 |
| 积分桶余额展示 | ✅ 可用 |
| 套餐权益展示 | ✅ 可用 |

---

## C. 未完成但不阻断放量的项

| 项目 | 为什么不阻断 | 后续阶段 |
|------|-------------|---------|
| 奖励积分发放接口 | 字段预留，Free/Basic/Pro 用户不涉及 | P2 |
| 奖励积分转赠 | 未来 Team 高级功能 | P3 |
| 奖励积分折现 | 未来 Team 高级功能 | P3 |
| Team 按人数动态计费 | 当前 Team 可单人购买，后续做按席位扣费 | P2 |
| 升级折算退款 | 用户可直接购买新套餐，不退差价 | P2 |
| 到期续费提醒 | 到期自动降级，不丢通用积分 | P2 |
| 发票 / 退款系统 | 初期人工处理 | P3 |
| 积分流水账单 | 用户可看余额和订单，暂不需逐笔流水 | P2 |
| 技术失败返还自动化 | FAQ 已说明会返还，初期人工处理 | P2 |
| 每日赠额轻任务分流 | 当前统一先扣 dailyTrial，不影响体验 | P3 |
| 订阅积分月度清零依赖访问触发 | getOrCreateUser 懒触发，不访问不重置，无实际影响 | 可加 cron |

---

## D. 正式放量前必须确认的环境项

### 环境变量

| 变量 | 检查方式 | 必需 |
|------|---------|------|
| `DATABASE_URL` | `grep DATABASE_URL .env` 确认路径存在 | ✅ |
| `OPENROUTER_API_KEY` | `curl` 测试 SG gateway 转发是否返回正常响应 | ✅ |
| `LLM_GATEWAY_URL` | 确认值为 `http://207.148.70.106:3100/v1/chat/completions` | ✅（大陆部署） |
| `LLM_GATEWAY_KEY` | 与 SG 服务器 `OB_INTERNAL_KEY` 一致 | ✅（大陆部署） |
| `RESEND_API_KEY` | 发一封测试验证码邮件，看日志 `[Mailer] Resend OK` | ✅ |
| `RESEND_FROM` | 确认为 `ORANGEBENCH <noreply@orangebench.tech>` 或留空用默认 | 可选 |
| `GOOGLE_CLIENT_ID` | 确认与 Google Console 一致 | ✅（启用 Google 登录时） |
| `GOOGLE_CLIENT_SECRET` | 同上 | ✅（启用 Google 登录时） |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 同 GOOGLE_CLIENT_ID | ✅（启用 Google 登录时） |
| `NEXT_PUBLIC_APP_URL` | 确认为线上域名 `https://orangebench.tech` | ✅ |
| `WECHAT_MCH_ID` | 微信商户后台核对 | ✅ |
| `WECHAT_APP_ID` | 同上 | ✅ |
| `WECHAT_API_KEY_V3` | 同上 | ✅ |
| `WECHAT_CERT_SERIAL` | 同上 | ✅ |
| `WECHAT_PRIVATE_KEY` | 同上 | ✅ |
| `WECHAT_NOTIFY_URL` | 确认为 `https://orangebench.tech/api/billing/wechat-webhook` | ✅ |

### 第三方平台

| 平台 | 检查方式 |
|------|---------|
| Resend 域名验证 | Resend 控制台 → Domains → orangebench.tech 显示 Verified |
| Google Console redirect URI | 确认包含 `https://orangebench.tech/api/auth/google` |
| OpenRouter 账户 | 登录 openrouter.ai 确认余额充足、API key 有效 |
| 微信支付回调 | 确认 notify_url 指向线上域名 |
| SG Gateway 服务 | `curl http://207.148.70.106:3100/health` 返回 `{"ok":true}` |

### 基础设施

| 项目 | 检查方式 |
|------|---------|
| 主站 PM2 | `pm2 list` 确认进程运行中 |
| SG Gateway PM2 | SSH 到 SG → `pm2 list` 确认 ob-llm-gateway 运行中 |
| Nginx | `nginx -t && systemctl status nginx` |
| 磁盘空间 | `df -h` 确认 > 2GB 可用 |
| 内存 | `free -h` 确认可用内存 > 512MB |
| git fetch TLS | 如仍有问题，改用本地打 patch 上传方式部署 |
| Prisma schema | 确认已执行 `npx prisma db push`（本版本有 6 个新字段） |

---

## E. 放量当天操作顺序

### 准备阶段（放量前 1 小时）

```
1. 确认推荐发布 commit
   git log --oneline -1
   # 期望: 90ebf17

2. 同步代码到主站
   git pull origin claude/url-driven-ui-sWSBQ
   # 如 TLS 失败: 本地 git archive | scp 上传

3. 安装依赖
   npm install

4. 推送 schema 变更
   npx prisma db push
   # 确认: "Your database is now in sync"

5. 构建
   npm run build
   # 确认: 无编译错误

6. 重启主站
   pm2 restart orangebench
   pm2 logs orangebench --lines 20
   # 确认: 无启动错误
```

### 验证阶段（放量前 30 分钟）

```
7. 验证 SG Gateway
   curl http://207.148.70.106:3100/health
   # 期望: {"ok":true,"mode":"sg-llm-gateway"}

8. 验证邮件发送
   # 用测试邮箱走一遍 /login → 发验证码
   # 查日志: pm2 logs orangebench | grep "[Mailer]"
   # 期望: [Mailer] Sending verification code via Resend, from=ORANGEBENCH <noreply@orangebench.tech>

9. 验证登录链路
   # 完成验证码登录，确认跳转到 /agent
   # 检查 cookie: ob-session 和 ob-user-id 都存在

10. 验证 Google 登录（如已配置）
    # 点击 Google 登录按钮，完成 OAuth
    # 确认跳转回 /agent

11. 验证 Agent 创建任务
    # 输入 "写一封感谢邮件" → 确认任务进入执行态
    # 查日志: pm2 logs orangebench | grep "[WORKER]"
    # 确认出现 "(via gateway)" 标记

12. 验证支付下单
    # 进入 /billing → 点击购买通用积分包
    # 确认 QR 码显示
    # (可选) 用测试账号完成支付验证到账

13. 验证 /account
    # 确认积分桶余额、套餐权益、最近订单都正确显示
```

### 放量阶段

```
14. 打开日志监控窗口
    # 终端 1: pm2 logs orangebench --lines 0
    # 终端 2 (SG): pm2 logs ob-llm-gateway --lines 0

15. 开始放量
    # 通知首批用户注册

16. 前 1 小时重点盯
    - 注册验证码是否正常发出（grep "[Mailer]"）
    - 任务是否正常执行（grep "[WORKER]"）
    - LLM 是否有错误（grep "[LLM_ERROR]" 或 "[LLM_TIMEOUT]"）
    - 支付是否有异常（grep "[WECHAT_WEBHOOK]"）
    - 是否有 401/500 错误（grep "status: 401" 或 "status: 500"）
```

---

## F. 首日 / 首周观察指标

### 首日必须盯

| 指标 | 观察方式 | 预警阈值 |
|------|---------|---------|
| 注册成功率 | `SELECT COUNT(*) FROM User WHERE createdAt > today` vs VerificationCode 发送数 | < 90% |
| 登录成功率 | Session 创建数 vs 验证码验证数 | < 95% |
| 邀请加入率 | `SELECT status, COUNT(*) FROM WorkspaceInvite GROUP BY status` | 首日观察 |
| 任务创建率 | `SELECT COUNT(*) FROM Task WHERE createdAt > today` | 首日观察 |
| 任务成功率 | `SELECT status, COUNT(*) FROM Task WHERE createdAt > today GROUP BY status` | 失败 > 30% |
| LLM 错误率 | `pm2 logs orangebench \| grep -c "LLM_ERROR"` | > 10/小时 |
| LLM 超时率 | `pm2 logs orangebench \| grep -c "LLM_TIMEOUT"` | > 5/小时 |
| 支付成功率 | `SELECT status, COUNT(*) FROM "Order" WHERE createdAt > today GROUP BY status` | paid/total < 80% |
| 到账一致性 | Order(paid) 数 vs User 积分增量 | 不一致 = P0 |
| HTTP 错误 | `pm2 logs \| grep -c "status: 5"` | > 20/小时 |
| 401 频率 | `pm2 logs \| grep -c "未登录"` | > 10/小时（排除爬虫） |

### 首周持续观察

| 指标 | 观察方式 |
|------|---------|
| 任务完成率 | Task status=completed / total |
| Workspace 闭环率 | WorkspaceTask businessStatus=completed / total |
| 用户积分理解 | 客服反馈收集 |
| 订阅购买转化 | Order(productType=subscription, status=paid) / 活跃用户 |
| 积分包购买 | Order(productType=credits, status=paid) 总量 |
| FAQ 高频问题 | 客服记录 top 5 |
| 每日活跃 | 每日创建任务的独立 userId 数 |
| 订阅续费率 | 到期用户中续费比例（第 4 周可观察） |

---

## G. 回滚与故障应对方案

### G1. 主站发布后异常

| 项目 | 内容 |
|------|------|
| 用户影响 | 全站不可用 |
| 临时缓解 | `pm2 restart orangebench` 重启 |
| 排查 | `pm2 logs orangebench --err --lines 50` 看错误栈 |
| 回滚 | `git checkout <上一个稳定commit> && npm run build && pm2 restart orangebench` |
| 上一个稳定 commit | `65f08d9`（SG gateway + 邮件域名收口） |

### G2. SG Gateway 异常

| 项目 | 内容 |
|------|------|
| 用户影响 | Agent 任务全部失败，其他功能不受影响 |
| 临时缓解 | SSH 到 SG → `pm2 restart ob-llm-gateway` |
| 回退直连 | 主站 .env 注释 `LLM_GATEWAY_URL` → `pm2 restart orangebench`（仅限 SG 不可恢复时） |
| 排查 | `pm2 logs ob-llm-gateway` + `curl http://207.148.70.106:3100/health` |

### G3. 邮件发送异常

| 项目 | 内容 |
|------|------|
| 用户影响 | 无法收到验证码，无法登录（新用户） |
| 临时缓解 | 确认 RESEND_API_KEY 有效；Resend 控制台检查域名状态 |
| SMTP 回退 | 配置 SMTP_HOST/SMTP_USER/SMTP_PASS 启用 SMTP 备用通道 |
| 排查 | `pm2 logs orangebench \| grep "[Mailer]"` 看具体错误 |
| 用户沟通 | "验证码邮件可能有延迟，请检查垃圾箱" |

### G4. OpenRouter / LLM 异常

| 项目 | 内容 |
|------|------|
| 用户影响 | Agent 任务失败，显示"AI 调用失败" |
| 临时缓解 | 检查 OpenRouter 状态页 (status.openrouter.ai) |
| 排查 | `pm2 logs \| grep "LLM_ERROR"` 看 HTTP 状态码 |
| 429 限流 | 等待或升级 OpenRouter 额度 |
| 502/503 | OpenRouter 侧故障，等待恢复 |
| 用户沟通 | "AI 服务暂时繁忙，请稍后重试" |

### G5. 微信支付 Webhook 异常

| 项目 | 内容 |
|------|------|
| 用户影响 | 支付成功但积分未到账 |
| 临时缓解 | 查 Order 表：`SELECT * FROM "Order" WHERE status='pending' AND createdAt > today` |
| 排查 | `pm2 logs \| grep "WECHAT_WEBHOOK"` 看是否收到回调 |
| 手动补单 | 通过微信商户后台确认交易后，手动更新 Order + User 积分 |
| 用户沟通 | "您的支付正在处理中，请稍候。如 5 分钟后仍未到账请联系客服" |

### G6. Google 登录异常

| 项目 | 内容 |
|------|------|
| 用户影响 | Google 登录按钮点击后报错 |
| 临时缓解 | 用户可改用邮箱验证码登录 |
| 排查 | 1) NEXT_PUBLIC_GOOGLE_CLIENT_ID 是否配置 2) Google Console redirect URI 是否匹配 |
| 临时禁用 | 清空 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 环境变量，前端按钮自动显示"暂未配置" |
| 不需要回滚代码 | 邮箱登录不受影响 |

### 通用回滚步骤

```bash
# 1. 回滚到上一个稳定 commit
git checkout 65f08d9

# 2. 重新构建
npm run build

# 3. 重启
pm2 restart orangebench

# 4. 验证
curl -I https://orangebench.tech
pm2 logs orangebench --lines 10
```

---

## H. 最终放量判断

### 结论：可以正式放量

当前版本（`90ebf17`）已具备正式放量条件：

1. **核心链路全通**：登录 → Agent → Workspace → Billing → 订阅生命周期，所有主链路已验证通过
2. **LLM 出口已解决**：SG Gateway 已部署并验证，大陆访问 ChatGPT 不再受限
3. **邮件发信已收口**：orangebench.tech 域名已验证，验证码可正常发送
4. **认证一致性已修复**：middleware / route / auth 三层 userId 解析完全一致
5. **商业闭环已建立**：用户能看懂积分、能购买、能管理订阅
6. **故障可恢复**：有明确的回滚路径和故障排查方案

### 建议起步范围

**第 1 周**：50-100 名用户
- 优先邀请有真实办公任务需求的用户
- 包含 2-3 个小团队验证 Workspace 协作
- 至少 3-5 名用户走一遍真实付费流程

**第 2 周**：根据第 1 周数据决定
- 如果核心指标正常（任务成功率 > 80%，支付到账 100%，无数据一致性问题），可扩至 200-500 人
- 如果发现阻断问题，先修再扩

### 放量前的最后 3 个检查

1. **环境变量全部配齐**（参照 D 章节逐项确认）
2. **SG Gateway 健康**（`curl health` 返回 ok）
3. **测试账号跑完一遍全链路**（注册 → 创建任务 → 购买 → 取消订阅）

以上三项确认后，即可开始放量。
