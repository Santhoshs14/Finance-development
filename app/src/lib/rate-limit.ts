/**
 * Rate limiter with optional Vercel KV backing.
 *
 * Defaults to an in-memory `Map` (fine for single-instance dev). If
 * `KV_REST_API_URL` + `KV_REST_API_TOKEN` are present at runtime, the
 * limiter automatically switches to KV for distributed rate-limiting
 * across edge regions / serverless invocations.
 *
 * ⚠️ PRODUCTION / SERVERLESS: the in-memory fallback is PER-INSTANCE and
 * resets on cold start, so limits are effectively much weaker (each
 * serverless invocation may have its own counter). For real enforcement on
 * Vercel or any multi-instance host, set `KV_REST_API_URL` +
 * `KV_REST_API_TOKEN` so all instances share one counter.
 */
import { errors } from "@/lib/api-handler";

export interface RateLimitOptions {
  /** Unique key, e.g. `"user:abc"` or `"ip:1.2.3.4"`. */
  key: string;
  /** Max number of requests permitted within the window. */
  limit: number;
  /** Window size in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

const memory = new Map<string, { count: number; resetAt: number }>();

async function checkMemory({ key, limit, windowSec }: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    allowed: entry.count <= limit,
    remaining,
    retryAfter,
  };
}

async function checkKV(opts: RateLimitOptions): Promise<RateLimitResult> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return checkMemory(opts);

  const { key, limit, windowSec } = opts;
  // Atomic INCR + EXPIRE via pipeline
  const body = JSON.stringify([
    ["INCR", key],
    ["EXPIRE", key, windowSec, "NX"],
    ["TTL", key],
  ]);

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      // Edge-runtime safe — no NODE_OPTIONS dependency.
      cache: "no-store",
    });
    if (!res.ok) return checkMemory(opts);
    const json = (await res.json()) as { result?: Array<{ result: number }> };
    const count = json.result?.[0]?.result ?? 1;
    const ttl = json.result?.[2]?.result ?? windowSec;
    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      remaining,
      retryAfter: ttl > 0 ? ttl : windowSec,
    };
  } catch {
    return checkMemory(opts);
  }
}

const HAS_KV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  return HAS_KV ? checkKV(opts) : checkMemory(opts);
}

/** Throw a 429 HttpError if the request exceeds the limit. */
export async function rateLimitOrThrow(opts: RateLimitOptions): Promise<void> {
  const result = await rateLimit(opts);
  if (!result.allowed) {
    throw errors.tooManyRequests(
      "Too many requests. Please slow down.",
      result.retryAfter
    );
  }
}
