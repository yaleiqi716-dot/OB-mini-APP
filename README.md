# ORANGEBENCH

企业智能工作系统。以 AGENT 为唯一入口，用户输入自然语言或点击工作卡片，系统自动理解任务、生成结构、执行工作流。支持通过 Webhook 外部触发任务。

## 架构

```
用户输入 ──→ task-router（AI分类） → workflow → task-manager → SSE → 前端
外部事件 ──→ events/ingest ──────→ event-to-task → 同上链路
```

### 系统分层

| 层 | 职责 | 文件 |
|---|---|---|
| 前端 | AGENT 单页面，任务列表 + 执行画布 + 交互面板 | `src/app/agent/page.tsx` |
| API | 任务创建 / 详情 / 交互 / 审批 / 发送 / SSE | `src/app/api/tasks/` |
| 外部入口 | Webhook 事件接入 | `src/app/api/events/ingest/` |
| 路由 | AI 识别任务类型 | `src/services/task-router.ts` |
| 事件转换 | 外部事件 → 任务描述 | `src/services/integrations/event-to-task.ts` |
| 工作流 | PPT / 邮件 / 方案 / 网页 / 视频 | `src/services/workflows/` |
| 任务管理 | 状态机 + 事件发布 + JSON序列化边界 | `src/services/task-manager.ts` |
| 数据 | Prisma + SQLite | `prisma/schema.prisma` |
| AI | OpenRouter 统一模型入口 | `src/lib/openrouter.ts` |

### 任务状态

```
pending → understanding → structuring → executing → completed
                              ↕              ↕
                         interacting     interacting
                              ↓
                           failed
```

### 已实现工作流

- **PPT**：理解 → 生成结构 → 用户确认/调整 → 逐页生成内容
- **邮件**：理解 → 生成草稿 → 用户确认发送/修改 → 确认完成
- **方案**：理解 → 确认范围 → 生成方案 → 确认
- **网页**：理解 → 确认风格 → 生成设计方案
- **视频**：理解 → 确认时长 → 生成脚本

## 环境启动

```bash
npm install
DATABASE_URL="file:./dev.db" npx prisma db push
npm run dev
```

访问 http://localhost:3000

### 环境变量

在项目根目录创建 `.env.local`：

```
DATABASE_URL="file:./dev.db"
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_DEFAULT_MODEL="anthropic/claude-sonnet-4"
WEBHOOK_SECRET="your-webhook-secret"
```

## 技术栈

- Next.js 14（App Router）
- TypeScript
- Tailwind CSS（暗色/亮色主题，橙色强调色）
- Prisma + SQLite
- SSE（Server-Sent Events 实时事件流）
- OpenRouter（统一 AI 模型接入）

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/tasks` | 创建任务（AGENT 入口） |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情（含事件） |
| GET | `/api/tasks/:id/events` | SSE 事件流 |
| POST | `/api/tasks/:id/interact` | 提交交互 |
| POST | `/api/tasks/:id/approve-structure` | 确认 PPT 结构 |
| POST | `/api/tasks/:id/send-email` | 确认发送邮件 |
| POST | `/api/events/ingest` | 外部事件入口（Webhook） |
| POST | `/api/router` | 任务类型识别 |
| POST | `/api/webhooks/zapier` | Zapier 入口（旧版） |

## 外部事件接入（Webhook）

### 配置

在 `.env.local` 中设置：

```
WEBHOOK_SECRET="your-secret-key-here"
```

### 调用方式

```bash
curl -X POST http://localhost:3000/api/events/ingest \
  -H "Content-Type: application/json" \
  -H "x-ob-secret: your-secret-key-here" \
  -d '{
    "source": "zapier",
    "eventType": "gmail.new_email",
    "userId": "demo-user",
    "spaceId": "default",
    "title": "客户来信",
    "payload": {
      "from": "client@example.com",
      "subject": "关于合作方案",
      "body": "请下周给我一份方案和报价。"
    }
  }'
```

### 支持的事件类型

| eventType | 说明 | payload 字段 |
|---|---|---|
| `gmail.new_email` | 收到新邮件 | from, subject, body |
| `form.submitted` | 表单提交 | formName, 其他表单字段 |
| `slack.mention` | Slack 提及 | channel, user, text |
| 其他任意值 | 通用事件 | 任意键值对 |

### 返回格式

```json
{
  "success": true,
  "taskId": "clxxx..."
}
```

外部创建的任务会自动进入 AI 分类 → 工作流执行链路，在 AGENT 页面侧栏实时出现，标记为 Zapier 或 API 来源。

## 验证流程

### PPT 流程
1. 输入"帮我做一份融资路演PPT"
2. 等待 understanding → structuring → 结构预览卡片
3. 点"调整结构" → 输入调整意见 → 提交
4. 看到新结构 → 点"继续生成"
5. 观察逐页生成 → completed
6. 刷新页面 → 侧栏点击任务 → 事件完整回放

### 邮件流程
1. 输入"帮我回复客户张总，说下周三给方案"
2. 等待生成邮件草稿 → 邮件预览卡
3. 点"继续修改" → 输入修改意见 → 提交
4. 看到新草稿 → 点"确认发送" → completed

### Webhook 外部触发
1. 用 curl 发送上面的测试请求
2. 在 AGENT 页面侧栏看到新任务出现（带 Zapier 标签）
3. 点击查看任务执行过程
