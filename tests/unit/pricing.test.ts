import { describe, expect, it } from "vitest";
import { costUsd } from "@/llm/pricing";

describe("costUsd", () => {
  it("prices a typical Haiku call", () => {
    // 3,300 in / 1,800 out on Haiku 4.5 ($1 / $5 per MTok) = $0.0123
    const cost = costUsd("claude-haiku-4-5", {
      inputTokens: 3300,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 1800,
    });
    expect(cost).toBeCloseTo(0.0123, 6);
  });

  it("prices cache writes at 1.25x and reads at 0.1x input", () => {
    const cost = costUsd("claude-sonnet-5", {
      inputTokens: 0,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(2.5 + 0.2, 6);
  });
});
