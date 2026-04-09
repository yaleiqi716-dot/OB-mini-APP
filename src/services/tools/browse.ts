// P4c3 — gstack browse binary wrapper
//
// Thin spawn() wrapper around the compiled gstack browse binary at
// ~/.claude/skills/gstack/browse/dist/browse. Exposes a small, safe
// read-only subset of subcommands the agent is allowed to call:
//
//   goto       — navigate to a URL (whitelist-gated)
//   screenshot — capture viewport PNG to a path under /tmp/ob-browse/<taskId>/
//   snapshot   — accessibility tree text (JSON) — same tmp dir
//   text       — visible text of current page
//
// Intentionally NOT exposed yet:
//   click / fill / eval / upload / cookie-import (except internal) /
//   dialog-accept / stop / restart / js
//
// These are write-capable or arbitrary-JS-capable and need a separate
// design pass (P4c6+ adds curated "action" recipes per site).
//
// Security invariants enforced here, not by the agent:
//   1. Every URL passes findWhitelistedSite() or the call fails with
//      a 422-equivalent error BEFORE the binary is spawned.
//   2. Output paths are rooted under /tmp/ob-browse/<taskId>/ and
//      never accept absolute user-provided paths.
//   3. Credentials are injected via a cookie JSON tempfile with 0600
//      perms, passed to `cookie-import`, and unlinked before the
//      subcommand returns — success or failure path.
//   4. Subcommand wall-clock cap 20s (pageloads sometimes stall).
//   5. Per-user daily call cap (BROWSE_DAILY_LIMIT env, default 100)
//      checked BEFORE the spawn. The call is counted in BrowseUsage
//      on success only — failed/rejected calls don't burn quota.
//   6. stderr is captured but NEVER surfaced to the user verbatim
//      (can leak cookies if the binary logs them). We return a
//      redacted "浏览失败" + logged stderr to the worker console only.
//
// Worker process isolation: the plan doc's "per-task worker processes,
// not shared threads" requirement is partially satisfied by spawning
// a fresh gstack binary per subcommand. Full process-level isolation
// per task (separate Node workers) is a P4c6+ concern.

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';
import os from 'os';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _osUnused = os; // kept for future cross-platform use
import { prisma } from '@/lib/prisma';
import {
  BROWSE_WHITELIST,
  BrowseSiteId,
  findWhitelistedSite,
  describeWhitelistRejection,
} from './browse-whitelist';
import { resolvePlaintextCookies } from './browse-vault';

const BINARY_PATH =
  process.env.GSTACK_BROWSE_BINARY ||
  path.join(os.homedir(), '.claude/skills/gstack/browse/dist/browse');

const DEFAULT_DAILY_LIMIT = Number(process.env.BROWSE_DAILY_LIMIT || 100);
const SUBCOMMAND_TIMEOUT_MS = Number(process.env.BROWSE_TIMEOUT_MS || 20_000);
// NOTE: gstack browse binary enforces its own path-security whitelist that
// only allows /private/tmp (macOS canonical tmp) and the cwd. os.tmpdir()
// returns /var/folders/... on macOS which the binary REJECTS. Using /tmp
// directly works because it's a symlink to /private/tmp on Darwin and the
// standard tmp location on Linux. Override via BROWSE_TMP_ROOT for other
// platforms (Windows etc.).
const TMP_ROOT = process.env.BROWSE_TMP_ROOT || '/tmp/ob-browse';

// ---------- Types ----------

export interface BrowseRunContext {
  userId: string;
  taskId: string;          // used for output paths and audit
  credentialSiteId?: BrowseSiteId; // optional — triggers cookie injection
}

export interface BrowseResult {
  success: boolean;
  subcommand: string;
  url?: string;
  outputPath?: string;      // artifact path on disk
  text?: string;            // small text payloads returned inline
  errorMsg?: string;        // human-readable, safe to show user
  durationMs: number;
}

// ---------- Quota ----------

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function checkDailyQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const day = todayKey();
  const row = await prisma.browseUsage.findUnique({
    where: { userId_day: { userId, day } },
  }).catch(() => null);
  const used = row?.callCount ?? 0;
  return {
    allowed: used < DEFAULT_DAILY_LIMIT,
    used,
    limit: DEFAULT_DAILY_LIMIT,
  };
}

async function bumpQuota(userId: string): Promise<void> {
  const day = todayKey();
  await prisma.browseUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, callCount: 1 },
    update: { callCount: { increment: 1 } },
  }).catch(() => {});
}

// ---------- Spawn helper ----------

interface SpawnResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runBinary(args: string[], extraEnv: Record<string, string> = {}): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(BINARY_PATH, args, {
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`browse binary timed out after ${SUBCOMMAND_TIMEOUT_MS}ms`));
    }, SUBCOMMAND_TIMEOUT_MS);
    child.stdout.on('data', d => { stdout += d.toString('utf8'); });
    child.stderr.on('data', d => { stderr += d.toString('utf8'); });
    child.on('error', err => {
      clearTimeout(killTimer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(killTimer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

// ---------- Cookie injection ----------

/**
 * Writes the plaintext cookies to a 0600 tempfile, runs cookie-import on
 * it, unlinks the file. Caller must invoke BEFORE the actual subcommand
 * (goto/screenshot/etc) so the gstack binary's persistent browser state
 * has them loaded.
 *
 * The gstack browse binary maintains a persistent Chromium instance;
 * cookie-import loads into that session.
 */
async function injectCookies(plaintextCookiesJson: string): Promise<void> {
  await fs.mkdir(TMP_ROOT, { recursive: true, mode: 0o700 });
  const file = path.join(TMP_ROOT, `cookies-${randomBytes(8).toString('hex')}.json`);
  try {
    await fs.writeFile(file, plaintextCookiesJson, { mode: 0o600 });
    const res = await runBinary(['cookie-import', file]);
    if (res.code !== 0) {
      // Don't echo stderr — may contain cookie values
      console.error('[BROWSE_COOKIE_IMPORT_FAIL]', { code: res.code });
      throw new Error('cookie 注入失败');
    }
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

// ---------- Output paths ----------

async function ensureOutputDir(taskId: string): Promise<string> {
  const dir = path.join(TMP_ROOT, taskId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

// ---------- Public subcommand handlers ----------

/** Pre-flight checks every browse call shares. Throws on reject. */
async function preflight(
  ctx: BrowseRunContext,
  url: string,
): Promise<void> {
  if (!findWhitelistedSite(url)) {
    throw new Error(describeWhitelistRejection(url));
  }
  const quota = await checkDailyQuota(ctx.userId);
  if (!quota.allowed) {
    throw new Error(`浏览工具今日已用完 ${quota.used}/${quota.limit} 次额度,请明天再试`);
  }
  // Verify the binary exists and is executable early so the error is clear.
  await fs.access(BINARY_PATH, fs.constants.X_OK).catch(() => {
    throw new Error(
      `gstack browse 二进制未找到: ${BINARY_PATH} — 请检查 GSTACK_BROWSE_BINARY 环境变量`,
    );
  });
  // Inject cookies if the caller supplied a credentialSiteId
  if (ctx.credentialSiteId) {
    if (BROWSE_WHITELIST[ctx.credentialSiteId] === undefined) {
      throw new Error(`未知站点: ${ctx.credentialSiteId}`);
    }
    let cookiesPt = '';
    try {
      const resolved = await resolvePlaintextCookies(ctx.userId, ctx.credentialSiteId);
      cookiesPt = resolved.cookies;
      await injectCookies(cookiesPt);
    } finally {
      // Best-effort wipe the local reference. Not a real zero but
      // minimizes retention in the JS heap.
      cookiesPt = '';
    }
  }
}

export async function browseGoto(
  ctx: BrowseRunContext,
  url: string,
): Promise<BrowseResult> {
  const started = Date.now();
  try {
    await preflight(ctx, url);
    const res = await runBinary(['goto', url]);
    if (res.code !== 0) {
      console.error('[BROWSE_GOTO_FAIL]', { code: res.code, stderr: res.stderr.slice(0, 500) });
      return {
        success: false,
        subcommand: 'goto',
        url,
        errorMsg: '页面加载失败',
        durationMs: Date.now() - started,
      };
    }
    await bumpQuota(ctx.userId);
    return {
      success: true,
      subcommand: 'goto',
      url,
      text: res.stdout.slice(0, 2000),
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      success: false,
      subcommand: 'goto',
      url,
      errorMsg: err instanceof Error ? err.message : 'unknown error',
      durationMs: Date.now() - started,
    };
  }
}

export async function browseScreenshot(
  ctx: BrowseRunContext,
  url: string,
): Promise<BrowseResult> {
  const started = Date.now();
  try {
    await preflight(ctx, url);
    // Navigate first
    const g = await runBinary(['goto', url]);
    if (g.code !== 0) {
      console.error('[BROWSE_SCREENSHOT_GOTO_FAIL]', { code: g.code });
      return {
        success: false,
        subcommand: 'screenshot',
        url,
        errorMsg: '页面加载失败',
        durationMs: Date.now() - started,
      };
    }
    const dir = await ensureOutputDir(ctx.taskId);
    const outPath = path.join(dir, `shot-${Date.now()}.png`);
    // Binary expects the path as the final positional arg after --viewport.
    // Order matters: `screenshot --viewport <path>` is parsed as flag+positional.
    const s = await runBinary(['screenshot', '--viewport', outPath]);
    if (s.code !== 0) {
      // Safe to log stderr when no credentials are injected (ctx.credentialSiteId
      // undefined). With credentials, suppress to avoid cookie leakage.
      const stderrSnippet = ctx.credentialSiteId ? '(redacted)' : s.stderr.slice(0, 300);
      console.error('[BROWSE_SCREENSHOT_FAIL]', { code: s.code, stderr: stderrSnippet });
      return {
        success: false,
        subcommand: 'screenshot',
        url,
        errorMsg: '截图失败',
        durationMs: Date.now() - started,
      };
    }
    await bumpQuota(ctx.userId);
    return {
      success: true,
      subcommand: 'screenshot',
      url,
      outputPath: outPath,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      success: false,
      subcommand: 'screenshot',
      url,
      errorMsg: err instanceof Error ? err.message : 'unknown error',
      durationMs: Date.now() - started,
    };
  }
}

export async function browseSnapshot(
  ctx: BrowseRunContext,
  url: string,
): Promise<BrowseResult> {
  const started = Date.now();
  try {
    await preflight(ctx, url);
    const g = await runBinary(['goto', url]);
    if (g.code !== 0) {
      return {
        success: false,
        subcommand: 'snapshot',
        url,
        errorMsg: '页面加载失败',
        durationMs: Date.now() - started,
      };
    }
    const dir = await ensureOutputDir(ctx.taskId);
    const outPath = path.join(dir, `snap-${Date.now()}.txt`);
    const s = await runBinary(['snapshot', '-o', outPath]);
    if (s.code !== 0) {
      console.error('[BROWSE_SNAPSHOT_FAIL]', { code: s.code });
      return {
        success: false,
        subcommand: 'snapshot',
        url,
        errorMsg: '快照失败',
        durationMs: Date.now() - started,
      };
    }
    // Return the first 4KB inline for the agent to reason about
    const body = await fs.readFile(outPath, 'utf8').catch(() => '');
    await bumpQuota(ctx.userId);
    return {
      success: true,
      subcommand: 'snapshot',
      url,
      outputPath: outPath,
      text: body.slice(0, 4096),
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      success: false,
      subcommand: 'snapshot',
      url,
      errorMsg: err instanceof Error ? err.message : 'unknown error',
      durationMs: Date.now() - started,
    };
  }
}

export async function browseText(
  ctx: BrowseRunContext,
  url: string,
): Promise<BrowseResult> {
  const started = Date.now();
  try {
    await preflight(ctx, url);
    const g = await runBinary(['goto', url]);
    if (g.code !== 0) {
      return {
        success: false,
        subcommand: 'text',
        url,
        errorMsg: '页面加载失败',
        durationMs: Date.now() - started,
      };
    }
    const t = await runBinary(['text']);
    if (t.code !== 0) {
      return {
        success: false,
        subcommand: 'text',
        url,
        errorMsg: '文本抽取失败',
        durationMs: Date.now() - started,
      };
    }
    await bumpQuota(ctx.userId);
    return {
      success: true,
      subcommand: 'text',
      url,
      text: t.stdout.slice(0, 8192),
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      success: false,
      subcommand: 'text',
      url,
      errorMsg: err instanceof Error ? err.message : 'unknown error',
      durationMs: Date.now() - started,
    };
  }
}

// Registry for dispatcher — maps a tool name the agent emits to its handler.
export const BROWSE_TOOLS = {
  'browse.goto': browseGoto,
  'browse.screenshot': browseScreenshot,
  'browse.snapshot': browseSnapshot,
  'browse.text': browseText,
} as const;

export type BrowseToolName = keyof typeof BROWSE_TOOLS;
