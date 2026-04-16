# Task Types Reference

## Submission Types (5 + fallback)

All tasks are submitted via `POST /api/tasks` with an `input` (string) + optional `type`.

| Type ID | Chinese Name | Icon | Description |
|---------|-------------|------|-------------|
| `ppt` | 演示文稿 | chart | 自动生成 PPT 幻灯片 |
| `email` | 邮件撰写 | mail | 起草商务邮件 |
| `proposal` | 方案策划 | file | 生成项目方案/报告 |
| `website` | 网站页面 | globe | 网页内容生成 |
| `video` | 视频脚本 | video | 视频脚本/AI 视频生成 |
| `unknown` | 智能识别 | — | 默认值，由 agent router 自动分类 |

### 通用提交参数

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `input` | string | Yes | — | 任务描述，自然语言 |
| `type` | TaskType | No | `'unknown'` | 任务类型，省略时自动识别 |
| `conversationId` | string | No | — | 已有会话 ID，省略则创建新会话 |
| `skillRoleId` | string | No | — | AI 角色 ID（从 /api/skills 获取） |
| `attachments` | Array | No | — | 文件附件列表 |
| `source` | TaskSource | No | `'agent'` | 来源：agent / zapier / api |

### 附件格式

```typescript
{ id: string; name: string; size: number; type?: string }
```

所有类型均支持附件。上传通过 `POST /api/upload`（最大 10MB）。

### Skill/Role 选择

所有类型均可选。选择后 role 的 system prompt 会被注入到 input 前面，影响 AI 的行为和输出风格。

### 费用

每次任务消耗 credits，具体数量由后端根据类型和模型动态计算。`task_completed` 事件中返回 `cost` 字段。

---

## 结果类型 (11 种)

TaskCanvas 根据 `result.type` 渲染不同的结果视图。

| Result Type | Chinese Name | Trigger | Key Data Fields | User Actions |
|-------------|-------------|---------|-----------------|--------------|
| `ppt` | 演示文稿 | `result.slides` exists | `slides[].title, content[], notes` | 复制、导出、优化 |
| `email` | 邮件 | `result.content` exists | `content.subject, content.body` | 复制、发送确认、修改 |
| `proposal` | 方案 | `result.sections` exists | `title, summary, sections[].heading+content` | 复制、导出 |
| `agent_loop` | 多轮推进 | `result.type === 'agent_loop'` | `summary, iterations, history[]` | 查看历史 |
| `orchestrator` | 任务编排 | `result.plan` exists | `plan[].type+input` | 查看子任务 |
| `text` | 文本 | `result.text` exists | `text / content / message` | 复制、导出 |
| `direct` | 直接回复 | `result.type === 'direct'` | `content` | 复制 |
| `image` | 图片 | `imageUrl` / `images[]` exists | `images[], imageUrl` | 打开原图、下载 |
| `video` | 视频 | `videoUrl` exists | `videoUrl, coverUrl` | 播放、下载 |
| `fallback` | 兜底 | None of above match | `content / summary / text` | 复制 |
| `locked preview` | 锁定预览 | `result._preview === true` | `_unlockCost` | 解锁（付费） |

---

## 任务状态机 (9 状态)

```
pending → queued → understanding → structuring → interacting → executing → completed
                                                     ↑                  ↓
                                                     └──────────────── failed
                                                                        ↓
                                                                     blocked
```

| Status | Chinese | Description |
|--------|---------|-------------|
| `pending` | 已创建 | 刚提交，等待入队 |
| `queued` | 排队中 | 在队列中等待 worker |
| `understanding` | 理解中 | AI 分析需求和意图 |
| `structuring` | 规划中 | 生成结构/大纲 |
| `interacting` | 等待确认 | 需要用户输入或审批 |
| `executing` | 执行中 | 正在生成内容 |
| `completed` | 已完成 | 任务成功完成 |
| `failed` | 失败 | 任务执行失败 |
| `blocked` | 已暂停 | 额度不足 |

---

## 交互类型 (4 种)

当 status === 'interacting' 时触发：

| Interaction Type | Description | User Input |
|-----------------|-------------|------------|
| `confirm` | 审批确认（邮件发送/结构确认） | 确认/拒绝/修改 |
| `text_input` | 文本补充（AI 追问） | 自由文本 |
| `single_choice` | 单选（选项卡） | 点击选项 |
| `yes_no` | 是/否 | 点击按钮 |

### 审批类型 (ApprovalType)

| ApprovalType | Trigger | Actions |
|-------------|---------|---------|
| `send_email` | 邮件写好后 | 确认发送 / 继续修改 / 重新生成 |
| `use_structure` | PPT 结构生成后 | 继续生成 / 调整结构 / 重新生成 |
| `use_proposal_structure` | 方案结构生成后 | 继续生成 / 调整结构 / 重新生成 |
