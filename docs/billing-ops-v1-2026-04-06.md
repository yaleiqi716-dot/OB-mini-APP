# ORANGEBENCH 计费运营规则 v1

> 日期：2026-04-06
> 状态：核心订阅生命周期已实现（取消 / 降级 / 月度清零）；
> 购买反馈、订单记录、积分展示已落地前端。
> Team 按人计费和奖励积分发放仍为规则说明。

---

## 1. 购买成功 / 失败反馈策略

### 已实现

| 场景 | 反馈方式 | 内容 |
|------|----------|------|
| 订阅支付成功 | QR Modal 成功态 + Toast | 显示套餐名、到账订阅积分数、每日体验赠额 |
| 通用积分包支付成功 | QR Modal 成功态 + Toast | 显示到账通用积分数（含赠送明细） |
| 支付失败/超时 | QR Modal 失败态 + Toast | 显示具体商品名 + "未完成支付，请重试" |
| 取消支付 | 关闭 QR Modal | 无额外提示 |

### 流程

1. 用户点击订阅/购买 → 前端 POST `/api/billing/create-order` → 创建 Order（pending）
2. 返回微信支付二维码 → 前端 QRModal 展示 + 开始轮询
3. 用户扫码支付 → 微信 webhook → 后端验签 + 幂等写入 → Order 状态 → paid
4. 前端轮询 `/api/billing/order/:id` → 检测到 paid → QRModal 成功态（展示商品信息）
5. 1 秒后自动关闭 + Toast 提示 + 刷新用户状态

### 积分到账对应关系

| 商品类型 | 到账字段 |
|----------|----------|
| 订阅（basic/pro/team） | `subscriptionCredits` = 对应额度（重置，不叠加）, `plan` 更新, `expireAt` 延长, `currentPeriodStart/End` 设置 |
| 通用积分包 | `generalCredits` += 对应额度 |

### 订阅购买时的附加行为

购买订阅时，webhook 会同时：
- 设置 `currentPeriodStart` / `currentPeriodEnd`（30 天周期）
- **重置** `subscriptionCredits`（不叠加旧余额）
- 清除 `cancelAtPeriodEnd` / `canceledAt` / `pendingPlan`（续费清除取消/降级标记）
- 设置 `subscriptionResetAt`（防止重复重置）

---

## 2. 订单记录展示策略

### 已实现

- 数据来源：`/api/billing/orders`（读取 Order 表，最近 20 条）
- 展示位置：`/account` 页"最近订单"区块
- 展示字段：时间、商品名称、类型（订阅/通用积分包）、金额、状态
- 状态映射：已完成 / 待支付 / 失败 / 已取消

---

## 3. 升级订阅规则

> **状态：购买即升级已实现，折算退款未实现**

### 规则

1. **即时生效**：用户购买更高级套餐后，新套餐立即生效
2. **积分重置**：新套餐的订阅积分全额发放（覆盖旧余额）
3. **到期时间**：从购买日起算 30 天
4. **每日体验赠额**：按新套餐标准发放
5. **取消/降级标记**：购买即清除

### 当前实现

- webhook 收到支付后：更新 plan、重置 subscriptionCredits、设置 period、延长 expireAt
- **未实现**：旧套餐剩余天数折算退款

---

## 4. 主动降级订阅规则

> **状态：已实现**

### 规则

1. **到期后生效**：降级不立即执行，当前周期内继续享受原权益
2. **落库字段**：`pendingPlan` 记录目标套餐
3. **到期时执行**：`getOrCreateUser()` 检测 `currentPeriodEnd < now` 时，将 plan 切换为 `pendingPlan`
4. **订阅积分处理**：到期时清零，新积分需等用户为新套餐付款后发放
5. **通用积分不受影响**
6. **每日体验赠额**：降级后按新套餐标准发放

### 已实现

- `/api/billing/subscription` POST `{ action: 'downgrade', targetPlan: 'basic' }`
- `/account` 页"降级套餐"按钮（Pro/Team 可用）
- 降级目标选择器（Free/Basic/Pro，低于当前套餐的选项）
- 已设置降级时展示"已设置到期降级为 xxx"状态
- 可撤销降级（`undo_downgrade`）
- 到期时 `getOrCreateUser` 自动执行降级

### 支持的降级路径

| 当前 | 可降级到 |
|------|---------|
| Pro | Basic, Free（取消） |
| Team | Pro, Basic, Free（取消） |
| Basic | Free（取消） |

---

## 5. 主动取消订阅规则

> **状态：已实现**

### 规则

1. **到期后生效**：取消订阅 = 到期后降为 Free，当前周期内权益不变
2. **落库字段**：`cancelAtPeriodEnd = true`, `canceledAt = now()`
3. **到期时执行**：`getOrCreateUser()` 检测后降为 free
4. **已发放积分不回收**：
   - 订阅积分：当前周期内可用，到期后清零
   - 通用积分：不受影响
   - 新人赠送：不受影响
   - 奖励积分：不受影响
5. **每日体验赠额**：取消后恢复为 Free 标准（120/日）
6. **续费即取消取消**：用户在到期前续费，cancel 标记自动清除

### 已实现

- `/api/billing/subscription` POST `{ action: 'cancel' }`
- `/account` 页"取消订阅"按钮（付费套餐可见）
- 取消后展示"已设置到期取消 — 到期后将降为 Free"
- 可撤销取消（`undo_cancel`）
- 到期时 `getOrCreateUser` 自动降级 + 清零 subscriptionCredits

---

## 6. 订阅积分月度清零

> **状态：已实现**

### 规则

1. 订阅积分按月发放，**不结转**
2. 每个新周期开始时，`subscriptionCredits` 重置为当前套餐月度额度
3. 不叠加上月未用完余额
4. 不影响 generalCredits / rewardCredits / signupBonusCredits / dailyTrialCredits

### 实现机制

1. **购买时重置**：webhook 将 subscriptionCredits 直接设为新额度（不累加）
2. **周期开始时重置**：`getOrCreateUser()` 检测 `subscriptionResetAt !== currentPeriodStart` 时，重置为 `PLAN_CONFIG[plan].monthlySubscriptionCredits`
3. **防重复**：`subscriptionResetAt` 字段记录上次重置日期
4. **取消后清零**：到期 + cancelAtPeriodEnd 时，subscriptionCredits 置为 0
5. **降级后清零**：到期 + pendingPlan 时，subscriptionCredits 置为 0（新积分需付款后发放）

### 相关字段

| 字段 | 用途 |
|------|------|
| `subscriptionCredits` | 当前订阅积分余额 |
| `subscriptionResetAt` | 上次重置日期（防重复） |
| `currentPeriodStart` | 当前周期起始 |
| `currentPeriodEnd` | 当前周期结束 |

---

## 7. 周期结束时的三种分支

`getOrCreateUser()` 在检测到 `currentPeriodEnd < now` 时，按优先级处理：

| 优先级 | 条件 | 行为 |
|--------|------|------|
| 1 | `cancelAtPeriodEnd = true` | 降为 free, 清零 subscriptionCredits, 清除所有订阅字段 |
| 2 | `pendingPlan` 非空 | 切换到目标 plan, 清零 subscriptionCredits, 清除 pendingPlan |
| 3 | 以上都不满足 | 降为 free（用户未续费） |

所有分支共同行为：
- 通用积分不受影响
- 新人赠送不受影响
- 奖励积分不受影响
- 每日体验赠额按新套餐标准刷新

---

## 8. 通用积分与订阅中断的关系

### 规则（已实现）

1. **通用积分不受订阅状态影响**：购买的通用积分始终可用
2. **订阅中断后**，积分消耗仍按五级优先级：
   - 每日体验赠额 → 新人赠送 → 订阅积分（若有剩余）→ 通用积分 → 奖励积分
3. **订阅积分到期清零**：已实现
4. **通用积分无有效期**：只要账户存在，通用积分持续可用

---

## 9. Team 席位变更规则

> **状态：规则说明，未实现自动化**

### 规则

1. **按人计费**：Team 套餐 ¥199/人/月
2. **每位成员独立积分**：6,000 订阅积分/人/月 + 120 每日体验赠额/人/日
3. **增加成员**：新成员加入后，按剩余天数折算首月费用
4. **移除成员**：剩余订阅积分不转移，已分配奖励积分不回收
5. **奖励积分**：由老板/管理员发放，不可转赠、不可折现（当前阶段）

### 当前实现

- Team 套餐购买已可用
- 工作区邀请/成员管理已实现
- **未实现**：按成员数计费的支付流程
- **未实现**：成员增减时的积分和费用调整
- **未实现**：奖励积分发放接口
- **未实现**：管理员积分查看面板

---

## 10. 数据结构（User 订阅相关字段）

```prisma
plan                 String   @default("free")
expireAt             DateTime?
cancelAtPeriodEnd    Boolean  @default(false)   // 用户请求到期取消
canceledAt           DateTime?                  // 取消操作时间
pendingPlan          String?                    // 待降级目标套餐
currentPeriodStart   DateTime?                  // 当前计费周期起始
currentPeriodEnd     DateTime?                  // 当前计费周期结束
subscriptionResetAt  String   @default("")      // 订阅积分上次重置日期
subscriptionCredits  Int      @default(0)       // 订阅积分余额
```

---

## 11. 已实现 vs 规则说明 汇总

### 已实现（前端 + 后端）

| 功能 | 位置 |
|------|------|
| 积分桶余额展示（5 桶 + legacy） | `/account` 积分明细区块 |
| 总可用积分 | `/account` 顶部卡片 |
| 当前套餐 + 权益展示 | `/account` 套餐权益区块 |
| 最近订单记录 | `/account` 最近订单区块 |
| 购买成功/失败详细反馈 | `/billing` QRModal + Toast |
| 主动取消订阅 | `/account` 按钮 + `/api/billing/subscription` |
| 撤销取消订阅 | `/account` 按钮 |
| 主动降级套餐 | `/account` 按钮 + 目标选择器 |
| 撤销降级 | `/account` 按钮 |
| 订阅积分月度清零（不结转） | 后端 `getOrCreateUser()` + webhook |
| 到期自动降级（3 分支） | 后端 `getOrCreateUser()` |
| 续费清除取消/降级标记 | 后端 webhook |
| 五级积分消耗 | 后端 `chargeCredits()` |
| 每日体验赠额自动刷新 | 后端 `getOrCreateUser()` |

### 规则说明（未实现自动化）

| 规则 | 状态 |
|------|------|
| 升级折算退款 | 未实现 |
| Team 按人计费 + 成员增减 | 规则确认，支付流程未实现 |
| 奖励积分发放 | 字段预留，接口未实现 |
| 到期前续费提醒 | 未实现 |
