import { Redis } from "@upstash/redis";
import type { Env } from "@/env";
import { type BudgetStore, memoryBudget, upstashBudget } from "./budget";
import { type Limiter, memoryLimiter, upstashLimiter } from "./ratelimit";

export type Guards = { limiter: Limiter; budget: BudgetStore; salt: string };

let cached: { key: string; guards: Guards } | undefined;

/**
 * Rate limiter and budget store: Upstash in production (env validation makes
 * it required there), in-memory locally so dev and tests need no services.
 */
export function getGuards(env: Env): Guards {
  const key = [env.redisUrl, env.RATE_LIMIT_PER_DAY].join("|");
  if (cached?.key === key) return cached.guards;
  const salt = env.IP_HASH_SALT ?? "local-dev-salt-not-for-production";
  const guards: Guards =
    env.redisUrl && env.redisToken
      ? (() => {
          const redis = new Redis({ url: env.redisUrl, token: env.redisToken });
          return {
            limiter: upstashLimiter(redis, env.RATE_LIMIT_PER_DAY),
            budget: upstashBudget(redis),
            salt,
          };
        })()
      : { limiter: memoryLimiter(env.RATE_LIMIT_PER_DAY), budget: memoryBudget(), salt };
  cached = { key, guards };
  return guards;
}

/** Tests only: drop in-memory limiter and budget state. */
export function resetGuardsForTests() {
  cached = undefined;
}
