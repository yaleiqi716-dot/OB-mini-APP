# ORANGEBENCH

企业智能工作系统。以 AGENT 为唯一入口，用户输入自然语言或点击工作卡片，系统自动理解任务、生成结构、执行工作流。

## 快速启动

```bash
git clone <repo-url>
cd OB-mini-APP
npm install
cp .env.local.example .env.local   # 然后编辑填入你的 key
DATABASE_URL="file:./dev.db" npx prisma db push
npm run dev
```

访问 http://localhost:3000

### 环境变量

创建 `.env.local`：

```
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY="sk-or-v1-..."
OPENROUTER_DEFAULT_MODEL="anthropic/claude-sonnet-4"
WEBHOOK_SECRET="your-webhook-secret"
```

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | SQLite 数据库路径 |
| `OPENROUTER_API_KEY` | 是 | OpenRouter API 密钥 |
| `OPENROUTER_DEFAULT_MODEL` | 否 | 默认 AI 模型 |
| `WEBHOOK_SECRET` | 否 | 外部事件接入密钥 |

## 支持的工作流

| 类型 | 流程 | 状态 |
|---|---|---|
| **演示文稿** | 理解 → 生成结构 → 用户确认/调整 → 逐页生成 | 完整可用 |
| **邮件** | 理解 → 生成草稿 → 用户确认/修改 → 确认发送 | 完整可用 |
| **方案** | 理解 → 生成结构 → 用户确认/调整 → 逐章撰写 | 完整可用 |
| **网页** | 理解 → 确认风格 → 生成设计方案 | 基础可用 |
| **视频** | 理解 → 确认时长 → 生成脚本 | 基础可用 |

## 架构

```
用户输入 ──→ task-router（AI分类） → workflow → task-manager → SSE → 前端
外部事件 ──→ /api/events/ingest ──→ event-to-task → 同上链路
```

### 任务状态

```
pending → understanding → structuring → executing → completed
                              ↕              ↕
                         interacting     interacting
                              ↓
                           failed
```

### 审批链

所有需要用户确认的动作统一走 `approval_gate`：
- `POST /api/tasks/:id/approve` — `{ approvalType, action: "approve" | "reject" }`
- 审批逻辑在 workflow 内部（`handleApproval`），API 只做分发

## 技术栈

- Next.js 14（App Router）+ TypeScript
- Tailwind CSS（深色/浅色主题，橙色强调色）
- Prisma + SQLite
- SSE（Server-Sent Events）
- OpenRouter（统一 AI 模型接入）

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情（含完整事件） |
| GET | `/api/tasks/:id/events` | SSE 事件流 |
| POST | `/api/tasks/:id/interact` | 提交交互 |
| POST | `/api/tasks/:id/approve` | 统一审批（确认/拒绝） |
| POST | `/api/events/ingest` | 外部事件入口 |
| POST | `/api/router` | 任务类型识别 |

## 外部事件接入

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -H "x-ob-secret: your-webhook-secret" \
  -d '{
    "source": "zapier",
    "eventType": "gmail.new_email",
    "payload": {
      "from": "client@example.com",
      "subject": "关于合作方案",
      "body": "请下周给我一份方案和报价。"
    }
  }'
```

支持事件类型：`gmail.new_email` / `form.submitted` / `slack.mention` / 任意自定义

## 测试流程

### 演示文稿
1. 输入"帮我做一份融资路演PPT"
2. 等待 → 结构预览 → 点"继续生成"或"调整结构"
3. 逐页生成 → 查看完成结果
4. 刷新页面 → 侧栏点击历史任务 → 事件完整回放

### 邮件
1. 输入"帮我回复客户张总，说下周三给方案"
2. 等待 → 邮件预览 → "确认发送"或"继续修改"

### 方案
1. 输入"帮我写一份新产品上市策划方案"
2. 等待 → 方案结构 → 确认 → 逐章生成

### 并行任务
1. 创建 PPT 任务（进入结构阶段）
2. 不确认，直接输入"帮我写封邮件"
3. 侧栏同时显示两个任务，PPT 标记等待处理

### 外部触发
1. 用 curl 发送 webhook
2. 侧栏自动出现新任务（带来源标签）

## 项目结构

```
prisma/schema.prisma            # 数据模型
src/
  app/
    agent/page.tsx              # 主页面
    api/tasks/                  # 任务 API
    api/tasks/[taskId]/approve/ # 统一审批
    api/events/ingest/          # 外部事件
  components/agent/             # 前端组件
  services/
    task-manager.ts             # 任务管理 + JSON 序列化边界
    task-router.ts              # AI 任务分类
    workflows/                  # PPT / 邮件 / 方案 / 网页 / 视频
    integrations/               # 外部事件转换
  types/                        # 类型定义
  lib/                          # 工具库
```

## 交接说明

### 给 MANUS / 其他开发者

1. Clone 仓库，切到 `claude/agent-single-entry-lbjdD` 分支
2. `npm install && DATABASE_URL="file:./dev.db" npx prisma db push`
3. 在 `.env.local` 填入 `OPENROUTER_API_KEY`
4. `npm run dev`
5. 所有工作流均真实调用 AI，需要有效的 OpenRouter 密钥

### 构建生产版本

```bash
npm run build
npm start
```

### 数据库重置

```bash
DATABASE_URL="file:./dev.db" npx prisma db push --force-reset
```
