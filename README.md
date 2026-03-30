# ORANGEBENCH

企业智能工作系统。以 AGENT 为唯一入口，用户输入自然语言或点击工作卡片，系统自动理解任务、生成结构、执行工作流。

## 架构

```
用户输入 → task-router（AI分类） → workflow（PPT / 邮件 / 方案 / 网页 / 视频）
                                        ↓
                                  task-manager（状态机 + 事件流）
                                        ↓
                                  SSE 实时推送 → 前端 TaskCanvas
```

### 系统分层

| 层 | 职责 | 文件 |
|---|---|---|
| 前端 | AGENT 单页面，任务列表 + 执行画布 + 交互面板 | `src/app/agent/page.tsx` |
| API | 任务创建 / 详情 / 交互 / 审批 / 发送 / SSE | `src/app/api/tasks/` |
| 路由 | AI 识别任务类型 | `src/services/task-router.ts` |
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
ZAPIER_WEBHOOK_SECRET=""
```

## 技术栈

- Next.js 14（App Router）
- TypeScript
- Tailwind CSS（暗色/亮色主题，橙色强调色）
- Prisma + SQLite
- SSE（Server-Sent Events 实时事件流）
- OpenRouter（统一 AI 模型接入）

## 项目结构

```
prisma/schema.prisma          # 数据模型（Task + TaskEvent）
src/
  app/
    agent/page.tsx             # AGENT 主页面（唯一入口）
    api/
      tasks/route.ts           # POST 创建任务 / GET 任务列表
      tasks/[taskId]/
        route.ts               # GET 任务详情（含完整事件）
        events/route.ts        # GET SSE 事件流
        interact/route.ts      # POST 提交交互
        approve-structure/     # POST 确认 PPT 结构
        send-email/            # POST 确认发送邮件
      router/route.ts          # POST 任务类型识别
      ai/route.ts              # POST OpenRouter 代理
      webhooks/zapier/         # POST Zapier webhook
  components/
    agent/                     # AgentInput, TaskCanvas, TaskList, WorkCard...
    interactions/              # SingleChoice, YesNo, FileUpload, Confirm, TextInput
    ui/                        # Button, Badge, Spinner, Input, Card, ThemeToggle
  services/
    task-manager.ts            # 任务 CRUD + 事件 + JSON 序列化边界
    task-router.ts             # AI 任务分类
    event-bus.ts               # 进程内事件总线
    workflows/                 # PPT / 邮件 / 方案 / 网页 / 视频
  hooks/                       # useSSE, useTheme
  types/                       # task, interaction, workflow, api
  lib/                         # prisma, openrouter, sse, utils, constants
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情（含事件） |
| GET | `/api/tasks/:id/events` | SSE 事件流 |
| POST | `/api/tasks/:id/interact` | 提交交互 |
| POST | `/api/tasks/:id/approve-structure` | 确认 PPT 结构 |
| POST | `/api/tasks/:id/send-email` | 确认发送邮件 |
| POST | `/api/router` | 任务类型识别 |
| POST | `/api/webhooks/zapier` | Zapier 入口 |

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
