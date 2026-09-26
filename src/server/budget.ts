import type { Redis } from "@upstash/redis";

/**
 * Monthly spend circuit breaker (PLAN.md §11 Q3): the sum of real per-run
 * costs, per calendar month (UTC). Once it reaches MONTHLY_BUDGET_USD, new
 * analyses are refused until the 1st. The Anthropic Console spend limit is
 * the hard backstop behind this.
 */
export type BudgetStore = {
  spent(month: string): Promise<number>;
  add(month: string, usd: number): Promise<void>;
};

export const monthKey = (date = new Date()) => date.toISOString().slice(0, 7);

export function nextMonthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function upstashBudget(redis: Redis): BudgetStore {
  const key = (month: string) => `budget:${month}`;
  return {
    async spent(month) {
      return Number((await redis.get<string | number>(key(month))) ?? 0);
    },
    async add(month, usd) {
      if (!(usd > 0)) return;
      await redis.incrbyfloat(key(month), usd);
      await redis.expire(key(month), 60 * 60 * 24 * 40);
    },
  };
}

export function memoryBudget(): BudgetStore {
  const totals = new Map<string, number>();
  return {
    async spent(month) {
      return totals.get(month) ?? 0;
    },
    async add(month, usd) {
      if (usd > 0) totals.set(month, (totals.get(month) ?? 0) + usd);
    },
  };
}

export function capacityMessage(now = new Date()): string {
  const back = nextMonthStart(now).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `We've reached this month's capacity. The analyser will be back on ${back}.`;
}
