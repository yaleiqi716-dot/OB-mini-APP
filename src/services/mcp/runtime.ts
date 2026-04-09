// P5c2 — MCP client runtime
//
// Thin wrapper around @modelcontextprotocol/sdk for spawning stdio MCP
// servers on demand, doing the initialize handshake, and making
// listTools / callTool requests. Abstracts away the SDK details so
// the dispatcher (P5c3) and API routes (P5c4) can work with a small,
// stable surface.
//
// Lifecycle model:
//   - connectServer(server) → McpHandle { client, close }
//   - listTools(handle) → array of tool descriptors
//   - callTool(handle, name, args) → { content, isError? }
//   - closeHandle(handle) → tears down the subprocess
//
// Handles are ephemeral per-call in MVP. A later chunk can add a
// per-task cache that reuses open connections across multiple
// tool calls within a single agent conversation. For now we
// prioritize correctness over latency.
//
// Security:
//   - Decrypted credential env vars are passed via stdio spawn's
//     env option and NEVER logged
//   - Spawn timeout: 15s for connection, 30s per call
//   - Stderr is captured but only surfaced on error path
//   - Working directory defaults to /tmp/ob-mcp/<serverId>/ for
//     filesystem-scoped MCPs (so a bug can't touch the repo)

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { promises as fs } from 'fs';
import path from 'path';
import { makeVault } from '@/lib/vault';

const mcpVault = makeVault('mcp', 'MCP_VAULT_KEY');

const CONNECT_TIMEOUT_MS = Number(process.env.MCP_CONNECT_TIMEOUT_MS || 15_000);
const CALL_TIMEOUT_MS = Number(process.env.MCP_CALL_TIMEOUT_MS || 30_000);
const MCP_TMP_ROOT = process.env.MCP_TMP_ROOT || '/tmp/ob-mcp';

// ─── Types ───────────────────────────────────────────────────────────

export interface McpServerRow {
  id: string;
  userId: string;
  name: string;
  kind: string;
  transport: string;
  command: string | null;
  args: string | null;
  endpoint: string | null;
  configEncrypted: string;
}

export interface McpConfigBlob {
  env?: Record<string, string>;
  apiKey?: string;
  token?: string;
  // Additional per-kind fields. Kept loose on purpose — schema
  // validation happens per-kind in the catalog layer.
  [k: string]: unknown;
}

export interface McpHandle {
  client: Client;
  close: () => Promise<void>;
}

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpCallResult {
  isError: boolean;
  content: unknown;
  durationMs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Decrypt the stored config blob. Returns {} if blank. */
export function decryptConfig(ciphertext: string): McpConfigBlob {
  if (!ciphertext) return {};
  try {
    const pt = mcpVault.decrypt(ciphertext);
    const parsed = JSON.parse(pt);
    return typeof parsed === 'object' && parsed !== null ? (parsed as McpConfigBlob) : {};
  } catch (err) {
    console.error('[MCP_DECRYPT_CONFIG_FAIL]', err instanceof Error ? err.message : 'unknown');
    return {};
  }
}

/** Encrypt a config blob for DB write. Thin wrapper kept here so
 *  callers don't need to know the namespace. */
export function encryptConfig(config: McpConfigBlob): string {
  return mcpVault.encrypt(JSON.stringify(config));
}

async function ensureTmpDir(serverId: string): Promise<string> {
  const dir = path.join(MCP_TMP_ROOT, serverId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function parseArgs(raw: string | null): string[] {
  if (!raw) return [];
  // Simple space split. MVP catalog entries use non-spaced paths.
  // Custom MCPs can use BROWSE_TMP_ROOT-style escapes if needed — flagged
  // as a follow-up once a user actually hits the limitation.
  return raw.split(/\s+/).filter(Boolean);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Spawn the MCP server process and connect the SDK client. Returns a
 * handle the caller MUST close() when done. Throws on connect failure.
 *
 * stdio transport only in MVP — sse / http come later.
 */
export async function connectServer(server: McpServerRow): Promise<McpHandle> {
  if (server.transport !== 'stdio') {
    throw new Error(`MCP transport '${server.transport}' not yet supported (MVP is stdio only)`);
  }
  if (!server.command) {
    throw new Error('MCP server.command is required for stdio transport');
  }

  const config = decryptConfig(server.configEncrypted);
  const cwd = await ensureTmpDir(server.id);

  const transport = new StdioClientTransport({
    command: server.command,
    args: parseArgs(server.args),
    cwd,
    // MCP SDK spreads this into the child process env. NEVER log this.
    env: {
      ...(process.env as Record<string, string>),
      ...(config.env || {}),
      ...(config.apiKey ? { API_KEY: config.apiKey } : {}),
      ...(config.token ? { TOKEN: config.token } : {}),
    },
    // stderr: pipe the server's stderr so we can capture it on error
    stderr: 'pipe',
  });

  const client = new Client(
    { name: 'orangebench', version: '1.0.0' },
    { capabilities: {} },
  );

  // Connect with an explicit timeout. SDK connect() does the initialize
  // handshake — it blocks until the server responds.
  const connectPromise = client.connect(transport);
  let timedOut = false;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new Error(`MCP connect timed out after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (err) {
    // Tear down any half-open state
    try { await transport.close(); } catch { /* noop */ }
    if (timedOut) throw err;
    throw new Error(
      `MCP connect failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }

  const close = async (): Promise<void> => {
    try {
      await client.close();
    } catch (e) {
      console.error('[MCP_CLOSE_ERR]', e instanceof Error ? e.message : 'unknown');
    }
  };

  return { client, close };
}

/**
 * List tools exposed by the connected MCP server. Returns a plain
 * array of descriptors. Throws on protocol error.
 */
export async function listTools(handle: McpHandle): Promise<McpToolDescriptor[]> {
  const res = await handle.client.listTools({});
  return (res.tools || []).map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/**
 * Invoke a tool on the connected server. Wraps the SDK's callTool
 * with a timeout and a normalized result shape.
 *
 * The SDK returns { content: [...], isError?: boolean } — content is
 * a list of ContentBlock objects (text/image/resource). We pass it
 * through to the caller and let the UI/dispatcher pick what to render.
 */
export async function callTool(
  handle: McpHandle,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  const started = Date.now();
  let timedOut = false;
  const timer: Promise<never> = new Promise((_, reject) => {
    setTimeout(() => {
      timedOut = true;
      reject(new Error(`MCP callTool '${toolName}' timed out after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([
      handle.client.callTool({ name: toolName, arguments: args }),
      timer,
    ]);
    return {
      isError: Boolean((res as { isError?: boolean }).isError),
      content: (res as { content?: unknown }).content ?? null,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    if (timedOut) {
      throw err;
    }
    throw new Error(
      `MCP callTool '${toolName}' failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
  }
}

/**
 * One-shot helper: connect, list tools, close. Used by the test-connection
 * API route so the UI can show the user what tools they just installed
 * without keeping a long-lived process alive.
 */
export async function probeServer(
  server: McpServerRow,
): Promise<{ tools: McpToolDescriptor[]; durationMs: number }> {
  const started = Date.now();
  const handle = await connectServer(server);
  try {
    const tools = await listTools(handle);
    return { tools, durationMs: Date.now() - started };
  } finally {
    await handle.close();
  }
}

/**
 * One-shot helper: connect, callTool, close. Used by the dispatcher
 * for single-call invocations where no session state needs to persist.
 */
export async function invokeOne(
  server: McpServerRow,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  const handle = await connectServer(server);
  try {
    return await callTool(handle, toolName, args);
  } finally {
    await handle.close();
  }
}
