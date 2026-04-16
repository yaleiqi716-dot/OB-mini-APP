# Skills & Roles Reference

## Overview

- Roles are "AI 同事" — each has a system prompt that shapes the agent's behavior
- Stored as markdown files in `src/skills/agency-agents/`
- YAML frontmatter: name, description, color
- Markdown body: system prompt (injected before user input at task creation)
- Total: **20 starter roles** across **8 departments**

## API

- `GET /api/skills` — public, no auth required
- `GET /api/skills?flat=1` — flat array (no department grouping)
- `GET /api/skills?q=<query>` — search by name/description

## Relationship Model

```
Department (1) ──→ (N) Role
Conversation (1) ──→ (0..1) Role (pinned via skillRoleId)
```

- One role per conversation (exclusive, not combinable)
- Switching role mid-conversation updates the conversation record
- Role affects ALL subsequent tasks in that conversation

## Departments & Roles (20 total)

### 营销 · 内容 (marketing) — 4 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `marketing/marketing-xiaohongshu-operator` | 小红书运营专家 | 小红书内容策划与运营 |
| `marketing/marketing-wechat-operator` | 微信公众号运营 | 公众号内容策划与排版 |
| `marketing/marketing-douyin-strategist` | 抖音策略师 | 抖音短视频内容策略 |
| `marketing/marketing-content-creator` | 内容创作者 | 通用内容创作与文案 |

### 设计 · 品牌 (design) — 4 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `design/design-brand-guardian` | 品牌管家 | 品牌一致性维护 |
| `design/design-ui-designer` | UI 设计师 | 界面设计建议 |
| `design/design-image-prompt-engineer` | 图片 Prompt 工程师 | AI 图片生成提示词优化 |
| `design/design-visual-storyteller` | 视觉叙事师 | 视觉内容策划 |

### 销售 · 客户 (sales) — 2 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `sales/sales-coach` | 销售教练 | 销售策略与话术指导 |
| `sales/sales-proposal-strategist` | 方案策略师 | 商业提案策划 |

### 流程 · 专项 (specialized) — 2 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `specialized/specialized-meeting-assistant` | 会议助手 | 会议纪要与行动项 |
| `specialized/specialized-workflow-architect` | 工作流架构师 | 流程设计与优化 |

### 数据 · 报告 (support) — 2 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `support/support-analytics-reporter` | 数据分析员 | 数据报告与分析 |
| `support/support-executive-summary-generator` | 摘要生成器 | 高管简报生成 |

### 产品 (product) — 3 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `product/product-feedback-synthesizer` | 反馈综合器 | 用户反馈分析与归纳 |
| `product/product-manager` | 产品经理 | 产品规划与需求分析 |
| `product/product-sprint-prioritizer` | 迭代排期师 | Sprint 任务优先级排列 |

### 人力 · 招聘 (hr) — 2 roles

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `hr/hr-recruiter` | 招聘专家 | 招聘文案与流程 |
| `hr/hr-performance-reviewer` | 绩效评审员 | 绩效评估与反馈 |

### 项目管理 (project-management) — 1 role

| Role ID | Chinese Name | Description |
|---------|-------------|-------------|
| `project-management/project-manager-senior` | 高级项目经理 | 项目规划与执行管理 |

## UI Components

### SkillRolePicker (single-select)

- Trigger: toolbar dropdown in AgentInput
- Layout: 2-level hierarchy (department → roles)
- Search: inline text input filters by name/description
- Keyboard: ESC closes
- Selection: updates `skillRoleId` state → sent with task submission

### SkillRoleMultiPicker (multi-select, unused)

- Chip-style grid layout
- Max 3 selections
- Currently NOT imported by agent/page.tsx — candidate for deletion
