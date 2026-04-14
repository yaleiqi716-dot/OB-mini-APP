// P5c1 — shared vault primitive
//
// Generalization of src/services/tools/browse-vault.ts to support
// multiple independent key namespaces. Browse cookies and MCP configs
// each have their own master key env var; compromising one namespace
// must NOT expose the other.
//
// Design:
// - One Vault instance per namespace (browse / mcp / future)
// - Each reads its own env var at instantiation, falls back to a
//   namespace-specific dev key in !production
// - AES-256-GCM identical to the browse-vault implementation
// - Ciphertext format: hex(iv || ciphertext || authTag) — same shape
//   so rows migrated between namespaces stay decryptable with the
//   right key
//
// Usage:
//   import { makeVault } from '@/lib/vault';
//   const mcpVault = makeVault('mcp', 'MCP_VAULT_KEY');
//   const ct = mcpVault.encrypt(plaintext);
//   const pt = mcpVault.decrypt(ct);

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export interface Vault {
  namespace: string;
  encrypt(plaintext: string): string;
  decrypt(hex: string): string;
  selfTest(): void;
}

/**
 * Build a vault for a named namespace.
 *
 * @param namespace  'browse' | 'mcp' | ... — used only for dev-key
 *                   derivation and error messages, not for persistence.
 * @param envVarName name of the env var holding the 64-hex master key
 *                   (e.g. 'MCP_VAULT_KEY')
 */
export function makeVault(namespace: string, envVarName: string): Vault {
  function getKey(): Buffer {
    const hex = process.env[envVarName];
    if (hex) {
      if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
        throw new Error(
          `${envVarName} must be 64 hex chars (32 bytes). ` +
            `Generate with: openssl rand -hex 32`,
        );
      }
      return Buffer.from(hex, 'hex');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `${envVarName} is required in production. ` +
          `Generate with: openssl rand -hex 32`,
      );
    }
    // Dev fallback: namespace-specific seed so browse/mcp/etc keys differ
    // across the local DB without forcing devs to set multiple env vars.
    const devSeed = `orangebench-${namespace}-vault-dev-seed-v1`;
    return createHash('sha256').update(devSeed).digest();
  }

  function encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error(`${namespace}.encrypt: plaintext must be a non-empty string`);
    }
    const key = getKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, tag]).toString('hex');
  }

  function decrypt(hex: string): string {
    if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex)) {
      throw new Error(`${namespace}.decrypt: ciphertext must be hex`);
    }
    const buf = Buffer.from(hex, 'hex');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      throw new Error(`${namespace}.decrypt: ciphertext too short`);
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const body = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    // .final() throws on auth tag mismatch
    const dec = Buffer.concat([decipher.update(body), decipher.final()]);
    return dec.toString('utf8');
  }

  function selfTest(): void {
    const sample = `${namespace}-vault-${Date.now()}`;
    const ct = encrypt(sample);
    const pt = decrypt(ct);
    if (pt !== sample) {
      throw new Error(`${namespace} vault self-test failed`);
    }
  }

  return { namespace, encrypt, decrypt, selfTest };
}
