// P4c2 — gstack browse credential vault
//
// Encrypted-at-rest store for per-user per-site session cookies used by
// the gstack browse binary. Design goals:
//
// 1. AES-256-GCM authenticated encryption. Reject on auth tag mismatch —
//    never surface mangled plaintext to the browse runtime.
// 2. Key from env only (BROWSE_VAULT_KEY = 64-hex = 32 bytes). Never
//    from DB, never from user input, never rotated inside a request.
// 3. Dev-mode ergonomics: if BROWSE_VAULT_KEY is missing and NODE_ENV
//    !== 'production', fall back to a deterministic dev key derived
//    from a well-known constant so local dev doesn't explode. Production
//    absolutely must set the env var — startProd() check in index.ts
//    (added in P4c5 when the vault routes go live) will assert.
// 4. Plaintext lifetime minimization: the decrypt fn returns a string
//    and the caller is expected to wipe the reference ASAP. We cannot
//    truly zero memory in a GC'd runtime, but we avoid caching.
// 5. Never log plaintext, never include it in error messages.
//
// Ciphertext format (hex):
//   iv (12 bytes) || ciphertext (n bytes) || authTag (16 bytes)
// All encoded as one hex string. 12-byte IV is the NIST-recommended
// length for GCM.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getMasterKey(): Buffer {
  const hex = process.env.BROWSE_VAULT_KEY;
  if (hex) {
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'BROWSE_VAULT_KEY must be 64 hex chars (32 bytes). Generate with: ' +
          'openssl rand -hex 32',
      );
    }
    return Buffer.from(hex, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BROWSE_VAULT_KEY is required in production. Generate with: openssl rand -hex 32',
    );
  }
  // Dev fallback: derive a deterministic key from a well-known constant so
  // the local dev DB remains decryptable across restarts without forcing
  // every developer to set an env var. NEVER ship this path to prod —
  // the check above ensures it's impossible.
  const devSeed = 'orangebench-browse-vault-dev-seed-v1';
  return createHash('sha256').update(devSeed).digest();
}

/** Encrypt a plaintext string and return hex ciphertext. */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSecret: plaintext must be a non-empty string');
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_LEN) {
    throw new Error('encryptSecret: unexpected auth tag length');
  }
  return Buffer.concat([iv, enc, tag]).toString('hex');
}

/**
 * Decrypt hex ciphertext back to plaintext. Throws on auth tag mismatch
 * or malformed input — never returns mangled plaintext.
 */
export function decryptSecret(hex: string): string {
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error('decryptSecret: ciphertext must be hex');
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('decryptSecret: ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const body = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const key = getMasterKey();
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws on auth tag mismatch — this is the authenticity check.
  const dec = Buffer.concat([decipher.update(body), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Self-test helper for boot-time sanity. Not exported as a route — only
 * callable from server code. Roundtrips a known plaintext; throws if
 * the vault is misconfigured. Safe to run repeatedly.
 */
export function vaultSelfTest(): void {
  const sample = 'orangebench-vault-' + Date.now();
  const ct = encryptSecret(sample);
  const pt = decryptSecret(ct);
  if (pt !== sample) {
    throw new Error('BrowseVault self-test failed: roundtrip mismatch');
  }
}

// ---------- Persistence wrappers (thin prisma shim) ----------
// These live here rather than in a separate service file so the encryption
// boundary is one module — nothing outside this file touches plaintext
// more than necessary.

import { prisma } from '@/lib/prisma';
import { BROWSE_WHITELIST, BrowseSiteId } from './browse-whitelist';

export interface StoreCredentialInput {
  userId: string;
  siteId: BrowseSiteId;
  label: string;
  plaintextCookies: string; // raw cookies blob (JSON or Netscape format)
  expiresAt?: Date;
}

/** Create or replace a credential row. Plaintext encrypted before DB write. */
export async function storeCredential(input: StoreCredentialInput): Promise<{ id: string }> {
  if (!BROWSE_WHITELIST[input.siteId]) {
    throw new Error(`storeCredential: unknown siteId ${input.siteId}`);
  }
  const ciphertext = encryptSecret(input.plaintextCookies);
  const row = await prisma.browseCredential.create({
    data: {
      userId: input.userId,
      siteId: input.siteId,
      label: input.label.trim().slice(0, 100) || '默认',
      ciphertext,
      keyVersion: 1,
      expiresAt: input.expiresAt,
    },
  });
  return { id: row.id };
}

/** List a user's credential rows WITHOUT plaintext. */
export async function listCredentials(userId: string) {
  const rows = await prisma.browseCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      siteId: true,
      label: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows;
}

/** Delete a credential (owner-check required at API layer). */
export async function deleteCredential(id: string): Promise<void> {
  await prisma.browseCredential.delete({ where: { id } });
}

/**
 * Resolve cookies for a (user, siteId) pair. Returns decrypted plaintext —
 * callers MUST treat the return value as ultra-sensitive and wipe the
 * reference ASAP. Writes lastUsedAt. Throws if no row exists.
 *
 * Prefers the most-recently-updated row if the user has multiple credentials
 * for the same site (e.g. 主号/测试号 — MVP uses most-recent, P4c5 UI will
 * let users pick explicitly via credentialId).
 */
export async function resolvePlaintextCookies(
  userId: string,
  siteId: BrowseSiteId,
): Promise<{ id: string; cookies: string; expiresAt: Date | null }> {
  const row = await prisma.browseCredential.findFirst({
    where: { userId, siteId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!row) {
    throw new Error(`未找到 ${siteId} 的凭证 — 请先在设置 > 浏览站点中添加`);
  }
  // Update lastUsedAt best-effort (don't fail the resolve if the update breaks)
  prisma.browseCredential
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return {
    id: row.id,
    cookies: decryptSecret(row.ciphertext),
    expiresAt: row.expiresAt,
  };
}
