import { describe, expect, it } from "vitest";
import { parseEnv } from "@/env";

const PROD_OK = {
  VERCEL_ENV: "production",
  ANTHROPIC_API_KEY: "sk-ant-test",
  DATABASE_URL: "postgres://user:pass@example.neon.tech/db",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  IP_HASH_SALT: "x".repeat(32),
};

describe("parseEnv", () => {
  it("applies defaults in development with nothing set", () => {
    const env = parseEnv({});
    expect(env.isProduction).toBe(false);
    expect(env.MODEL_EXTRACTOR).toBe("claude-haiku-4-5");
    expect(env.MODEL_CRITIC).toBe("claude-haiku-4-5");
    expect(env.RATE_LIMIT_PER_DAY).toBe(5);
    expect(env.MONTHLY_BUDGET_USD).toBe(18);
    expect(env.LLM_MOCK).toBe(false);
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: "", RATE_LIMIT_PER_DAY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.RATE_LIMIT_PER_DAY).toBe(5);
  });

  it("allows switching the Critic and Rewriter to the mid-tier model", () => {
    const env = parseEnv({ MODEL_CRITIC: "claude-sonnet-5", MODEL_REWRITER: "claude-sonnet-5" });
    expect(env.MODEL_CRITIC).toBe("claude-sonnet-5");
    expect(env.MODEL_REWRITER).toBe("claude-sonnet-5");
  });

  it("rejects models without a verified price", () => {
    expect(() => parseEnv({ MODEL_CRITIC: "claude-unknown-1" })).toThrow(/MODEL_CRITIC/);
  });

  it("accepts a complete production config", () => {
    const env = parseEnv(PROD_OK);
    expect(env.isProduction).toBe(true);
    expect(env.redisUrl).toBe("https://example.upstash.io");
  });

  it("maps the Vercel Marketplace KV_* names to the Redis config", () => {
    const env = parseEnv({
      ...PROD_OK,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      KV_REST_API_URL: "https://kv.upstash.io",
      KV_REST_API_TOKEN: "kv-token",
    });
    expect(env.redisUrl).toBe("https://kv.upstash.io");
    expect(env.redisToken).toBe("kv-token");
  });

  it("reads the database URL from a Neon connection made with the prefix NEON", () => {
    const neon = "postgres://user:pass@neon-prefix.neon.tech/db";
    for (const name of ["NEON_URL", "NEON_DATABASE_URL"]) {
      const env = parseEnv({ ...PROD_OK, DATABASE_URL: undefined, [name]: neon });
      expect(env.DATABASE_URL).toBe(neon);
    }
  });

  it("prefers the NEON_* names over a leftover DATABASE_URL", () => {
    const neon = "postgres://user:pass@neon-prefix.neon.tech/db";
    expect(parseEnv({ ...PROD_OK, NEON_URL: neon }).DATABASE_URL).toBe(neon);
  });

  it("lists every missing production variable by name, never by value", () => {
    let message = "";
    try {
      parseEnv({ VERCEL_ENV: "production", ANTHROPIC_API_KEY: "sk-ant-secret" });
    } catch (e) {
      message = (e as Error).message;
    }
    for (const key of [
      "DATABASE_URL",
      "IP_HASH_SALT",
      "UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)",
      "UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)",
    ]) {
      expect(message).toContain(key);
    }
    expect(message).not.toContain("sk-ant-secret");
  });

  it("refuses the mocked LLM layer in production", () => {
    expect(() => parseEnv({ ...PROD_OK, LLM_MOCK: "1" })).toThrow(/LLM_MOCK/);
  });

  it("allows the mocked LLM layer outside production", () => {
    expect(parseEnv({ VERCEL_ENV: "preview", LLM_MOCK: "1" }).LLM_MOCK).toBe(true);
  });

  it("accepts RATE_LIMIT_PER_DAY=0 (limit off) and rejects negatives", () => {
    expect(parseEnv({ RATE_LIMIT_PER_DAY: "0" }).RATE_LIMIT_PER_DAY).toBe(0);
    expect(() => parseEnv({ RATE_LIMIT_PER_DAY: "-1" })).toThrow(/RATE_LIMIT_PER_DAY/);
  });

  it("rejects a short IP hash salt", () => {
    expect(() => parseEnv({ IP_HASH_SALT: "too-short" })).toThrow(/IP_HASH_SALT/);
  });
});
