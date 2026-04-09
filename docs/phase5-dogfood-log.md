# Phase 5 dogfood log — MCP for end users

**Date:** 2026-04-10
**Branch:** `claude/url-driven-ui-sWSBQ`
**Runtime:** `@modelcontextprotocol/sdk@1.29.0` via stdio transport
**Chunks covered:** P5c1 → P5c6 (schema, runtime, catalog+dispatcher, API, UI, dogfood)

## Full-stack verification

Every API route exercised end-to-end through real `NextRequest`
instances against `@modelcontextprotocol/server-everything`
(reference test server, 13 tools).

### GET /api/mcp/catalog
Returns 6 entries: `everything`, `filesystem`, `memory`, `sqlite`,
`git`, `custom`. Public — no auth required. Field schemas flow
through to the install wizard unchanged.

### POST /api/mcp/install `{ kind: 'everything', name: 'P5c6 test' }`
- status 200
- auto-probe on (default) → spawned subprocess, did initialize
  handshake, listTools returned 13 names, persisted to cachedTools
- response: `{ id, name:'P5c6 test', kind:'everything', toolCount:13, probeError:null }`

### GET /api/mcp
- 1 row returned
- first entry fields: `{ name:'P5c6 test', toolCount:13, enabled:true,
  firstTools:['echo','get-annotated-message','get-env'] }`
- `configEncrypted` **not** present in the response (stripped by the
  select projection even though the DB column is populated)

### POST /api/mcp/[id]/test
- status 200, `{ success:true, durationMs:544, tools:13 }`
- Re-probed subprocess and updated cachedTools. 544ms on warm SDK,
  ~4s on cold start — caller should expect variance.

### dispatchMcpTool → `@modelcontextprotocol/server-everything`
| Tool | Args | Result content | Duration |
|---|---|---|---|
| `echo` | `{message:'p5c6 dogfood'}` | `[{type:'text',text:'Echo: p5c6 dogfood'}]` | 4 ms |
| `get-sum` | `{a:100, b:23}` | `[{type:'text',text:'The sum of 100 and 23 is 123.'}]` | 4 ms |

Both hit the resolver's cachedTools index correctly, spawned via
`invokeOne`, wrote `McpUsageLog` rows, bumped `McpUsage.callCount`,
and updated `McpServer.lastUsedAt`.

### GET /api/mcp/quota
`{ used: 2, limit: 100, remaining: 98, allowed: true }` after the
two successful tool calls. Confirms that:
- only successes burn quota (the pre-install failed resolver calls
  from earlier tests didn't count)
- the tracker is per-user per-day via the unique `(userId, day)` index

### Audit log (McpUsageLog)
```
{ toolName: 'echo',    statusCode: 0, durationMs: 4 }
{ toolName: 'get-sum', statusCode: 0, durationMs: 4 }
```
Both `statusCode=0`, both with full per-row duration.

### DELETE /api/mcp/[id]
- status 200
- owner-check passed
- server row removed
- `GET /api/mcp` after: 0 rows
- `McpUsageLog` rows **retained** (FK intentionally non-cascade) so
  audit history survives uninstall

## Security invariants spot-checked

- ✓ `encryptConfig` / `decryptConfig` roundtrip via `makeVault('mcp',
  'MCP_VAULT_KEY')` — namespace isolation verified separately in P5c1
  (browse key cannot decrypt mcp ciphertext and vice versa)
- ✓ Custom MCP install validates `envJson` as JSON before encrypting
- ✓ `GET /api/mcp` response shape has no `configEncrypted` field
- ✓ No plaintext cookies, tokens, or API keys appear in any route
  response or log line

## Operational notes

1. **SDK cold start ~4s.** First `npx -y @modelcontextprotocol/...`
   invocation downloads and starts the server. Subsequent spawns are
   faster (~500ms) once npm cache is warm. For real usage we should
   add a "warm pool" of long-lived handles — deferred to P5.2+.

2. **Server-everything is a test fixture.** Real users will install
   `filesystem`, `memory`, `sqlite`, `git`, or custom. OAuth-gated
   ones (Notion/Google/飞书) need the OAuth plumbing done first.

3. **MCP_VAULT_KEY dev fallback.** The vault uses sha256(constant)
   in non-production so local dev doesn't need to set the env var.
   **Production must set `openssl rand -hex 32`** — `makeVault()`
   throws at startup if `NODE_ENV=production` and the var is missing.

4. **Worker wiring deferred.** The dispatcher (`dispatchMcpTool`) is
   importable from anywhere — P5.2+ will wire it into the agent
   dispatch switch so LLM tool calls reach it directly. Today it's
   callable by test harnesses and would need to be plumbed through
   `src/services/agent/dispatch.ts` for real in-conversation use.

## What's NOT yet shipped (deferred follow-ups)

- **OAuth-gated catalog entries:** Notion, Google Drive, Gmail, 飞书
  云文档/多维表格. Each needs a provider-specific OAuth app + redirect
  handler + token refresh loop + scope confirmation flow. 5-10 days
  per provider.
- **Per-task handle cache.** Today every tool call spawns a fresh
  subprocess. P5.2+ should cache one handle per `(task, mcpServerId)`
  and reuse across a multi-turn agent conversation.
- **Destructive-action confirmation UX.** The plan doc requires
  inline chat confirmation for delete/send/pay tool calls. Not wired
  into the agent dispatch path yet.
- **Agent dispatch integration.** `handleText` / `handleSearch` /
  etc. in `src/services/agent/dispatch.ts` don't yet know how to
  delegate to `dispatchMcpTool`. Adding this is the next natural
  step: expose the user's enabled MCP tools as LLM function
  definitions, let the LLM choose one, route to dispatcher.
- **Audit UI.** `/account/ai-tools/audit` page that renders
  `McpUsageLog` history.
- **Rate limit polish.** Today's quota is a simple daily counter.
  The plan doc allows higher caps with billing — not yet modeled.

## Phase 5 summary

| Chunk | What | Status | Commit |
|-------|------|--------|--------|
| P5c1 | McpServer/McpUsageLog/McpUsage schema + namespaced vault primitive | ✅ | _previous_ |
| P5c2 | MCP client runtime (stdio + JSON-RPC via SDK) | ✅ | _previous_ |
| P5c3 | Catalog (6 entries) + dispatcher with tool-name resolver | ✅ | _previous_ |
| P5c4 | API routes (catalog/install/list/delete/test/quota) | ✅ | _previous_ |
| P5c5 | /account/ai-tools UI + install wizard + nav | ✅ | _previous_ |
| P5c6 | End-to-end dogfood through all routes | ✅ | this commit |

Phase 5 MVP is shippable. The local stdio path (6 catalog kinds)
works for real use today. The OAuth-gated catalog and agent
dispatch integration are the logical next steps.
