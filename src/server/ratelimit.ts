import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

export type LimitResult = { success: boolean; remaining: number; /** ms epoch */ reset: number };
export type Limiter = { limit(key: string): Promise<LimitResult> };

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The client IP as seen by Vercel's edge (first x-forwarded-for entry). Only
 * ever used to derive a salted hash; it's never stored or logged.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** HMAC-SHA256 of the IP with a server-side salt: stable per visitor, not reversible without the salt. */
export function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

/** Sliding window in Upstash Redis (production). Upstash analytics is off: it would store identifiers. */
export function upstashLimiter(redis: Redis, perDay: number): Limiter {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(perDay, "24 h"),
    prefix: "rl:analyze",
    analytics: false,
  });
  return {
    async limit(key) {
      const { success, remaining, reset } = await ratelimit.limit(key);
      return { success, remaining, reset };
    },
  };
}

/** No per-visitor limit (RATE_LIMIT_PER_DAY=0). */
export const noLimit: Limiter = {
  async limit() {
    return { success: true, remaining: Number.POSITIVE_INFINITY, reset: Date.now() };
  },
};

/** In-process sliding window for local dev and tests (not shared across instances). */
export function memoryLimiter(perDay: number, now: () => number = Date.now): Limiter {
  const hits = new Map<string, number[]>();
  return {
    async limit(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => at > t - WINDOW_MS);
      const success = recent.length < perDay;
      if (success) recent.push(t);
      hits.set(key, recent);
      const oldest = recent[0] ?? t;
      return { success, remaining: Math.max(0, perDay - recent.length), reset: oldest + WINDOW_MS };
    },
  };
}
