# 商业规则第二轮交付：订阅生命周期

> 分支：`claude/url-driven-ui-sWSBQ`
> Commit：`a794612`
> 日期：2026-04-06

---

## 1. 修改文件列表

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 新增 6 字段 |
| `src/app/api/billing/subscription/route.ts` | 新增 |
| `src/services/billing.ts` | 重写 getOrCreateUser 周期检查 + 月度重置 |
| `src/app/api/billing/wechat-webhook/route.ts` | 订阅购买设 period + 重置积分 + 清 cancel 标记 |
| `src/app/account/page.tsx` | 新增订阅管理 UI |
| `docs/billing-ops-v1-2026-04-06.md` | 全面更新 |
| `docs/pricing-v1-2026-04-06.md` | 新增第二轮状态表 |

---

## 2. 主动取消订阅入口

- `/account` 套餐权益区块新增"取消订阅"按钮（付费用户可见）
- 点击后 confirm 弹窗确认 → POST `/api/billing/subscription` `{ action: 'cancel' }`
- 后端将 `cancelAtPeriodEnd = true`, `canceledAt = now()` 写入 User
- 页面显示"已设置到期取消 — 到期后将降为 Free"
- 支持"撤销取消"操作

---

## 3. 主动降级入口

- `/account` 套餐权益区块新增"降级套餐"按钮（Pro/Team 可见）
- 点击展开目标选择器：显示所有低于当前套餐的选项
- 选择后 confirm → POST `/api/billing/subscription` `{ action: 'downgrade', targetPlan }`
- 后端将 `pendingPlan` 写入 User
- 页面显示"已设置到期降级为 xxx"
- 支持"撤销降级"操作

支持的降级路径：

| 当前 | 可降级到 |
|------|---------|
| Pro | Basic, Free（取消） |
| Team | Pro, Basic, Free（取消） |
| Basic | Free（取消） |

---

## 4. 订阅积分月度清零

两个触发点：

1. **购买时**：webhook 将 `subscriptionCredits` 直接设为新额度（非累加），同时设 `subscriptionResetAt`
2. **访问时**：`getOrCreateUser()` 检测 `subscriptionResetAt !== currentPeriodStart` → 重置为 `PLAN_CONFIG[plan].monthlySubscriptionCredits`

防重复：`subscriptionResetAt` 字段记录上次重置日期。

---

## 5. 到期时三种分支处理

`getOrCreateUser()` 检测 `currentPeriodEnd < now` 时：

| 条件 | 行为 |
|------|------|
| `cancelAtPeriodEnd = true` | 降为 free, subscriptionCredits = 0, 清除所有订阅字段 |
| `pendingPlan` 非空 | plan = pendingPlan, subscriptionCredits = 0, 清除 pendingPlan |
| 均不满足 | 降为 free（用户未续费），subscriptionCredits = 0 |

所有分支：通用积分 / 新人赠送 / 奖励积分不受影响。

---

## 6. /account 增加的订阅管理信息

- 订阅状态区块：显示周期到期日、取消状态、降级状态
- "取消订阅"按钮（可撤销）
- "降级套餐"按钮 + 目标选择器（可撤销）
- "续费/升级"入口跳转 /billing
- 信息注："当前周期内仍可正常使用全部权益，通用积分不受影响"

---

## 7. Prisma schema 变更

新增 6 个字段到 User 模型：

```prisma
cancelAtPeriodEnd    Boolean  @default(false)   // 用户请求到期取消
canceledAt           DateTime?                  // 取消操作时间
pendingPlan          String?                    // 待降级目标套餐
currentPeriodStart   DateTime?                  // 当前计费周期起始
currentPeriodEnd     DateTime?                  // 当前计费周期结束
subscriptionResetAt  String   @default("")      // 订阅积分上次重置日期
```

---

## 8. 部署命令

```bash
npx prisma db push
# 或
npx prisma migrate dev --name subscription-lifecycle
```

---

## 9. billing-ops 文档补充内容

- 主动取消订阅规则（已实现）
- 主动降级规则（已实现）
- 订阅积分月度清零规则（已实现）
- 周期结束三分支逻辑
- 通用积分不受取消影响（明确说明）
- 数据结构说明
- 已实现 vs 规则说明汇总表

---

## 10. 已实现 vs 未来项

### 已真实实现

| 功能 | 位置 |
|------|------|
| 主动取消订阅 | `/account` 按钮 + `/api/billing/subscription` |
| 撤销取消订阅 | `/account` 按钮 |
| 主动降级套餐 | `/account` 降级选择器 + `/api/billing/subscription` |
| 撤销降级 | `/account` 按钮 |
| 订阅积分月度清零（不结转） | webhook + `getOrCreateUser()` |
| 到期三分支自动处理 | `getOrCreateUser()` |
| 续费清除取消/降级标记 | webhook |

### 仍为未来项

| 项目 | 状态 |
|------|------|
| 升级折算退款 | 未实现 |
| Team 按人计费支付流程 | 规则确认，未实现 |
| 奖励积分发放接口 | 字段预留，接口未实现 |
| 到期续费提醒 | 未实现 |
