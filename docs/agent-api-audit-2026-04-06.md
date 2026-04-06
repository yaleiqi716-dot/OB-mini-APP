# ORANGEBENCH Agent 模型/API 接入审计

> 日期：2026-04-06
> 状态：审计完成

---

## 1. 默认模型与 Provider

| 项目 | 值 |
|------|---|
| **默认 Provider** | OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) |
| **默认模型** | `openai/gpt-4o`（通过 OpenRouter 代理） |
| **ChatGPT 是否真的接上** | **是** — 通过 OpenRouter 调用 OpenAI gpt-4o，是真实 API 调用 |
| **直连 OpenAI** | 否 — 全部经 OpenRouter 代理 |
| **Fallback** | 无 — OpenRouter 不可用时系统硬失败 |
| **环境变量** | `OPENROUTER_API_KEY`（必需）, `OPENROUTER_DEFAULT_MODEL`（可选，默认 openai/gpt-4o） |

---

## 2. 接入审计表

| 功能入口 | 目标模型 | 实际 Provider | 是否已通 | 问题 | 建议 |
|----------|---------|--------------|---------|------|------|
| Agent 意图路由 | gpt-4o | OpenRouter | ✅ 已通 | 无 fallback | - |
| Agent 文本生成 | gpt-4o | OpenRouter | ✅ 已通 | 无 fallback | - |
| Agent 搜索摘要 | gpt-4o | OpenRouter | ✅ 已通 | 依赖 Brave Search API | 确保 BRAVE_API_KEY 配置 |
| Email 工作流 | gpt-4o | OpenRouter | ✅ 已通 | - | - |
| PPT 工作流 | gpt-4o | OpenRouter | ✅ 已通 | 多轮调用（4-5 次） | - |
| Proposal 工作流 | gpt-4o | OpenRouter | ✅ 已通 | - | - |
| Website 工作流 | gpt-4o | OpenRouter | ✅ 已通 | - | - |
| Video 工作流（脚本） | gpt-4o | OpenRouter | ✅ 已通 | - | - |
| 图片生成 | Leonardo AI | Leonardo API | ✅ 已通 | 异步任务 | 确保 LEONARDO_API_KEY |
| 视频生成 | Minimax | Minimax API | ✅ 已通 | 异步任务 | 确保 MINIMAX_API_KEY |
| 数字人视频 | Akool | Akool API | ✅ 已通 | 异步任务 | 确保 AKOOL_API_KEY |
| 自动化 | Zapier | Zapier API | ✅ 已通 | 异步任务 | 确保 ZAPIER_WEBHOOK_URL |
| 浏览器任务 | Manus | Manus API | ✅ 已通 | 异步任务 | 确保 MANUS_API_KEY |
| Dashboard 摘要 | gpt-4o | OpenRouter | ✅ 已通 | 有 graceful fallback | 唯一有降级逻辑的入口 |
| 任务审核分析 | gpt-4o | OpenRouter | ✅ 已通 | - | - |

---

## 3. 调用链路说明

```
用户输入 → POST /api/tasks → Task(queued)
     ↓
Worker 轮询 → executeTask()
     ↓
Phase 1: routeIntent() → chatCompletion() [LLM #1: 意图分类]
     ↓
Phase 2: dispatch() or workflow.start()
     ↓
  ├─ text → chatCompletion() [LLM #2: 生成内容]
  ├─ search → braveSearch() + chatCompletion() [LLM #2: 摘要]
  ├─ image → Leonardo API [异步]
  ├─ video → Minimax API [异步]
  ├─ email → 2x chatCompletion() [LLM #2+#3]
  ├─ ppt → 4-5x chatCompletion() [结构+每页]
  └─ proposal → 多x chatCompletion() [各章节]
     ↓
completeTask() → SSE 推送到前端
```

---

## 4. 关键发现

### 正面
- OpenRouter 集成完整，19 个文件调用，覆盖所有任务类型
- 有超时控制（150s）和 AbortController
- 有 JSON 解析安全函数 `safeParseLLMJson`
- 有完整的错误日志标签（LLM_ERROR / LLM_TIMEOUT / LLM_EMPTY）
- Worker 有并发控制（最大 3）和死锁恢复

### 风险
- **单点依赖**：OpenRouter 挂则全部 LLM 任务失败，无 fallback
- **无重试**：API 调用失败即任务失败，无自动重试
- **无实际 token 成本追踪**：积分是硬编码估算，非按实际 token 计费
- **MODEL_MAP 未使用**：定义了 fast-model/balanced-model/smart-model 但从未路由，全部走默认模型

### 对 100-1000 用户的影响
- OpenRouter 有速率限制，高并发时可能被限流 → 表现为任务失败
- 150s 超时在 PPT 等多轮任务中可能不够
- 建议：监控 OpenRouter 的 429/500 错误率

---

## 5. 必需环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `OPENROUTER_API_KEY` | **必需** | OpenRouter API 密钥 |
| `OPENROUTER_DEFAULT_MODEL` | 可选 | 默认 `openai/gpt-4o` |
| `BRAVE_API_KEY` | 搜索功能需要 | Brave Search API |
| `LEONARDO_API_KEY` | 图片功能需要 | Leonardo AI |
| `MINIMAX_API_KEY` | 视频功能需要 | Minimax |
| `AKOOL_API_KEY` | 数字人视频需要 | Akool |
| `MANUS_API_KEY` | 浏览器任务需要 | Manus |
| `ZAPIER_WEBHOOK_URL` | 自动化需要 | Zapier |

---

## 6. 结论

**ChatGPT（gpt-4o）已真实接通**，通过 OpenRouter 代理调用。不是占位配置。所有 LLM 功能都走这条链路，代码质量可靠，但缺少 fallback 和重试机制。对 100-1000 用户规模，主要风险是 OpenRouter 速率限制和单点故障。
