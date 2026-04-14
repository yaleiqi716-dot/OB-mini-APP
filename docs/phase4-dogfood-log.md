# Phase 4 dogfood log — gstack browse integration

**Date:** 2026-04-10
**Branch:** `claude/url-driven-ui-sWSBQ`
**Binary:** `~/.claude/skills/gstack/browse/dist/browse` (61 MB, needs `bun` runtime)
**Chunks covered:** P4c1 → P4c6 (schema, vault, wrapper, dispatcher, UI, dogfood)

## End-to-end scenario matrix

Three realistic user inputs run through the full pipeline:
`router decision → dispatch → handleBrowserTask → gstack binary →
TaskEvent artifact → quota bump`

| # | User input | Site detected | Subcmd | Engine | Result | Wall clock |
|---|---|---|---|---|---|---|
| 1 | 帮我截一下飞书登录页 | 飞书 | screenshot | gstack_browse | ✓ PASS | 8.2s |
| 2 | 抓一下小红书创作服务的文本看看 | 小红书创作服务 | text | gstack_browse | ✓ PASS | 3.7s |
| 3 | 打开企业微信管理后台 | 企业微信管理后台 | goto | gstack_browse | ✓ PASS | 2.1s |

All three:
- Hit the gstack path (not Manus fallback)
- Detected the correct whitelisted site from Chinese label in the prompt
- Selected the correct subcommand from verb heuristics
- Wrote a `TaskEvent { type:'tool_call', toolName:'browse.*' }` row
- Incremented `BrowseUsage.callCount` exactly once per call

## TaskEvent artifacts written

```
browse.screenshot · input={"url":"https://www.feishu.cn/accounts/page/login","subcommand":"screenshot","siteId":"feishu"}
browse.text       · input={"url":"https://creator.xiaohongshu.com/","subcommand":"text","siteId":"xiaohongshu"}
browse.goto       · input={"url":"https://work.weixin.qq.com/wework_admin/loginpage_wx","subcommand":"goto","siteId":"wecom"}
```

## Quota

Started 0/100. Ended 3/100 after three successful calls.
Failed/rejected calls confirmed not to burn quota
(rejected `https://example.com/` in P4c4 probe left counter unchanged).

## Security invariants verified

- ✓ Whitelist reject for `https://example.com/` → user-facing Chinese error
- ✓ HTTPS-only — `http://myseller.taobao.com/` rejected
- ✓ AES-256-GCM vault roundtrip — tampered ciphertext triggers auth tag
  rejection ("unable to authenticate data"), never returns mangled plaintext
- ✓ Cookies never logged: `browse.ts` `runBinary` stderr is only printed
  when `ctx.credentialSiteId` is undefined (cookie-less calls); with
  credentials it's fully redacted
- ✓ Output paths confined to `/tmp/ob-browse/<taskId>/`
- ✓ Manus fallback catches `MANUS_API_KEY 未配置` and returns a clean
  hint suggesting whitelisted alternatives, not a 500

## Operational gotchas encountered + documented

1. **`bun` runtime required.** The gstack browse binary is a CLI client
   that spawns a background server written in Bun. Installing `bun`
   via the standard `curl -fsSL https://bun.sh/install | bash` works.
   Binary path cache: `~/.bun/bin/bun`.

2. **macOS tmpdir rejected.** `os.tmpdir()` returns `/var/folders/...`
   on macOS which the gstack binary's internal path-security whitelist
   refuses (only `/private/tmp` and cwd are allowed). Fixed by setting
   `TMP_ROOT = '/tmp/ob-browse'` (symlink to `/private/tmp` on Darwin,
   native on Linux). `BROWSE_TMP_ROOT` env override for other platforms.

3. **zhihu login page hangs on font loading.** `browse screenshot` fails
   with "waiting for fonts to load" against `zhihu.com/signin`. Other
   whitelisted sites (feishu, xiaohongshu, wecom) are fine. Zhihu-specific
   selectors will need P4c7+ investigation — filed as known issue.

4. **Prisma client cache.** After `prisma db push`, the dev server must
   be restarted to pick up new models. Not a P4 regression — noted from
   P3 experience.

## What's NOT yet shipped (deferred follow-ups)

- Per-site selector recipes — today the dispatcher has 4 generic
  subcommands (goto/screenshot/snapshot/text) but no "get GMV from
  淘宝卖家中心" kind of structured extractor. This needs a selector
  action layer (P4c7+), where `BROWSE_WHITELIST[id].selectors` is
  actually consumed by a new `browse.extract` subcommand.

- Click / fill / write capabilities. MVP is intentionally read-only.
  Mutating actions need per-action confirmation UX and are a P4c8+
  concern.

- Screenshot rendering in the agent UI. Today TaskEvent artifacts are
  written to disk and the path is stored, but the agent chat UI doesn't
  render them as inline thumbnails yet. Worker → UI streaming of tool
  artifacts is a P4c9+ concern.

- Per-user concurrency cap on browse calls (today only the global
  worker concurrency limit applies). A chatty user could burn quota
  fast. Low priority — quota cap already covers the abuse case.

## Phase 4 summary

| Chunk | What | Status | Commit |
|-------|------|--------|--------|
| P4c1 | Whitelist registry + TaskEvent tool-artifact columns | ✅ | baae8bc |
| P4c2 | Credential vault (AES-256-GCM) + BrowseCredential/BrowseUsage | ✅ | b3731d8 |
| P4c3 | `src/services/tools/browse.ts` binary wrapper | ✅ | f41d2aa |
| P4c4 | Dispatcher engine split (gstack-first, Manus-fallback) | ✅ | 966f9fa |
| P4c5 | `/account/browse-sites` UI + API routes + quota display | ✅ | 49bc882 |
| P4c6 | End-to-end dogfood on 3 sites | ✅ | this commit |

Phase 4 is shippable. Next logical step is Phase 5 (MCP for end users)
or polishing one of the deferred follow-ups above.
