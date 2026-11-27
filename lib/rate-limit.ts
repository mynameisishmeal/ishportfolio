import { getDb } from './mongodb';

interface RateLimitBucket {
  hits: number[];
}

declare global {
  // eslint-disable-next-line no-var
  var __ishRateLimitStore: Map<string, RateLimitBucket> | undefined;
  // eslint-disable-next-line no-var
  var __ishRateLimitIndexPromise: Promise<void> | undefined;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}

const MAX_STORE_ENTRIES = 5000;

function getBucketMap(): Map<string, RateLimitBucket> {
  if (!globalThis.__ishRateLimitStore) {
    globalThis.__ishRateLimitStore = new Map<string, RateLimitBucket>();
  }
  return globalThis.__ishRateLimitStore;
}

export function getClientIp(request: Request): string {
  // Prefer platform-verified headers that clients cannot spoof on Vercel
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    const first = vercelForwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    // Use the rightmost proxy-appended IP to resist spoofed leading X-Forwarded-For values
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }

  return '127.0.0.1';
}

export async function checkPersistentRateLimit(options: {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  try {
    const db = await getDb();
    const col = db.collection<{ _id: string; count: number; expiresAt: Date }>('rate_limits');
    if (!globalThis.__ishRateLimitIndexPromise) {
      globalThis.__ishRateLimitIndexPromise = col
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
        .then(() => undefined)
        .catch(() => {
          globalThis.__ishRateLimitIndexPromise = undefined;
        });
    }
    await globalThis.__ishRateLimitIndexPromise;

    const now = Date.now();
    const windowId = Math.floor(now / options.windowMs);
    const resetAtMs = (windowId + 1) * options.windowMs;
    const docId = `${options.namespace}:${options.key}:${windowId}`;

    const doc = await col.findOneAndUpdate(
      { _id: docId },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(resetAtMs + 60_000) },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const count = doc?.count ?? 1;
    if (count > options.maxRequests) {
      return {
        allowed: false,
        limit: options.maxRequests,
        remaining: 0,
        resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      };
    }

    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: Math.max(0, options.maxRequests - count),
      resetAtMs,
      retryAfterSeconds: 0,
    };
  } catch {
    return checkRateLimit(options);
  }
}

export function checkRateLimit(options: {
  namespace: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): RateLimitResult {
  const store = getBucketMap();
  const now = Date.now();
  const cutoff = now - options.windowMs;
  const bucketKey = `${options.namespace}:${options.key}`;

  // Periodic bounded cleanup if many unique IPs hit the server
  if (store.size > MAX_STORE_ENTRIES) {
    for (const [k, b] of store.entries()) {
      const latest = b.hits[b.hits.length - 1] ?? 0;
      if (latest < now - 60 * 60 * 1000) {
        store.delete(k);
      }
      if (store.size <= MAX_STORE_ENTRIES * 0.8) break;
    }
  }

  const bucket = store.get(bucketKey) ?? { hits: [] };
  bucket.hits = bucket.hits.filter(ts => ts > cutoff);

  if (bucket.hits.length >= options.maxRequests) {
    const oldest = bucket.hits[0] ?? now;
    const resetAtMs = oldest + options.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    store.set(bucketKey, bucket);
    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAtMs,
      retryAfterSeconds,
    };
  }

  bucket.hits.push(now);
  store.set(bucketKey, bucket);

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: Math.max(0, options.maxRequests - bucket.hits.length),
    resetAtMs: now + options.windowMs,
    retryAfterSeconds: 0,
  };
}

export function checkMultiRateLimit(
  checks: Array<{
    namespace: string;
    key: string;
    maxRequests: number;
    windowMs: number;
  }>
): RateLimitResult {
  let worstRemaining: RateLimitResult | null = null;
  for (const check of checks) {
    const res = checkRateLimit(check);
    if (!res.allowed) return res;
    if (!worstRemaining || res.remaining < worstRemaining.remaining) {
      worstRemaining = res;
    }
  }
  return (
    worstRemaining ?? {
      allowed: true,
      limit: 1,
      remaining: 1,
      resetAtMs: Date.now(),
      retryAfterSeconds: 0,
    }
  );
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  };
  if (result.retryAfterSeconds > 0) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}

export function detectBotPayload(body: Record<string, unknown> | null | undefined): string | null {
  if (!body || typeof body !== 'object') return null;

  // Honeypot fields that real users never see or fill
  const trap = body.website ?? body.company ?? body._hp;
  if (typeof trap === 'string' && trap.trim().length > 0) {
    return 'Automated submission rejected.';
  }

  // Optional fill-time check (only triggered if client sent _startedAt and submitted faster than 450ms)
  if (typeof body._startedAt === 'number' && Number.isFinite(body._startedAt)) {
    const elapsed = Date.now() - body._startedAt;
    if (elapsed >= 0 && elapsed < 450) {
      return 'Submission sent too quickly. Please try again.';
    }
  }

  return null;
}
