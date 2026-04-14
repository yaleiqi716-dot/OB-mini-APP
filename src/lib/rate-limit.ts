/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Use for lightweight protection against brute force / spam on endpoints that
 * are reachable without auth (e.g. email code sending, invite token lookup).
 *
 * NOTE: this is per-process. Behind a multi-instance deploy (e.g. PM2 cluster
 * or k8s replicas), each replica has its own counters. For stronger guarantees
 * move to Redis. For our single-instance deploy this is sufficient.
 */

import { NextRequest, NextResponse } from 'next/server'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Periodically prune expired buckets to cap memory. Single timer per process.
let pruneTimer: NodeJS.Timeout | null = null
function ensurePrune() {
  if (pruneTimer) return
  pruneTimer = setInterval(() => {
    const now = Date.now()
    // Avoid for-of on Map to stay compatible with the project's TS target.
    const expiredKeys: string[] = []
    buckets.forEach((b, k) => {
      if (b.resetAt <= now) expiredKeys.push(k)
    })
    for (let i = 0; i < expiredKeys.length; i++) buckets.delete(expiredKeys[i])
  }, 60_000)
  // Allow process to exit cleanly in tests / scripts
  if (typeof pruneTimer.unref === 'function') pruneTimer.unref()
}

export interface RateLimitOptions {
  /** Bucket scope — e.g. 'email-code', 'invite-validate' */
  key: string
  /** Max requests allowed within the window */
  max: number
  /** Window duration in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
  retryAfterSec: number
}

/**
 * Check rate limit for a given (scope, identifier) pair.
 * Returns `ok: false` if the limit is exceeded.
 */
export function rateLimit(identifier: string, opts: RateLimitOptions): RateLimitResult {
  ensurePrune()
  const now = Date.now()
  const bucketKey = `${opts.key}:${identifier}`
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs
    buckets.set(bucketKey, { count: 1, resetAt })
    return { ok: true, remaining: opts.max - 1, resetAt, retryAfterSec: 0 }
  }

  if (existing.count >= opts.max) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    ok: true,
    remaining: opts.max - existing.count,
    resetAt: existing.resetAt,
    retryAfterSec: 0,
  }
}

/**
 * Best-effort client IP extraction from Next.js request headers.
 * Falls back to 'unknown' — do NOT use this for security decisions,
 * only for bucketing rate-limit counters.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    // First entry is the original client; later entries are proxies
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Helper: build a standardized 429 response with Retry-After header.
 */
export function rateLimitedResponse(result: RateLimitResult, message = '请求过于频繁，请稍后再试') {
  return NextResponse.json(
    { error: message, retryAfterSec: result.retryAfterSec },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}
