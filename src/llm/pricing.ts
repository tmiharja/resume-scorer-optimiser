/**
 * Anthropic API list prices in USD per million tokens.
 * Verified against platform.claude.com/docs/en/about-claude/pricing on 2026-09-25.
 * Only models listed here can be configured per agent (see src/env.ts), so the
 * cost of every run is always computable.
 */
export const MODEL_PRICING = {
  "claude-haiku-4-5": { input: 1, cacheWrite5m: 1.25, cacheRead: 0.1, output: 5 },
  "claude-sonnet-5": { input: 2, cacheWrite5m: 2.5, cacheRead: 0.2, output: 10 },
} as const satisfies Record<string, ModelPrice>;

export type ModelPrice = {
  input: number;
  cacheWrite5m: number;
  cacheRead: number;
  output: number;
};

export type ModelId = keyof typeof MODEL_PRICING;

export const MODEL_IDS = Object.keys(MODEL_PRICING) as [ModelId, ...ModelId[]];

export const DEFAULT_MODEL: ModelId = "claude-haiku-4-5";

export type TokenUsage = {
  /** Uncached input tokens. */
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
};

/** Cost of one call in USD. */
export function costUsd(model: ModelId, usage: TokenUsage): number {
  const p = MODEL_PRICING[model];
  const total =
    usage.inputTokens * p.input +
    usage.cacheWriteTokens * p.cacheWrite5m +
    usage.cacheReadTokens * p.cacheRead +
    usage.outputTokens * p.output;
  return total / 1_000_000;
}
