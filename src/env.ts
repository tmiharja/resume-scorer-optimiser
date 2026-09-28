import { z } from "zod";
import { databaseUrl } from "@/db/url";
import { DEFAULT_MODEL, MODEL_IDS } from "@/llm/pricing";

const model = z.enum(MODEL_IDS).default(DEFAULT_MODEL);
const optionalUrl = z.url().optional();
const optionalString = z.string().min(1).optional();
const flag = z
  .enum(["0", "1", "true", "false"])
  .default("0")
  .transform((v) => v === "1" || v === "true");

const rawSchema = z.object({
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),

  ANTHROPIC_API_KEY: optionalString,
  MODEL_EXTRACTOR: model,
  MODEL_CRITIC: model,
  MODEL_MATCHER: model,
  MODEL_REWRITER: model,
  MODEL_VERIFIER: model,

  DATABASE_URL: optionalUrl,
  // Names from connecting Neon with the prefix NEON (see src/db/url.ts).
  NEON_URL: optionalUrl,
  NEON_DATABASE_URL: optionalUrl,

  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  // Names used by the Vercel Marketplace Upstash integration.
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: optionalString,

  IP_HASH_SALT: z.string().min(32, "IP_HASH_SALT must be at least 32 characters").optional(),
  RATE_LIMIT_PER_DAY: z.coerce.number().int().min(1).max(1000).default(5),
  MONTHLY_BUDGET_USD: z.coerce.number().positive().max(1000).default(18),

  LLM_MOCK: flag,
});

/** Required in production only; dev and tests fall back to mocks / no-ops. Values are the names to set. */
const PRODUCTION_REQUIRED = {
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  DATABASE_URL: "DATABASE_URL (or NEON_URL, from connecting Neon with the prefix NEON)",
  IP_HASH_SALT: "IP_HASH_SALT",
  redisUrl: "UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)",
  redisToken: "UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)",
} as const;

const envSchema = rawSchema
  .transform(
    ({
      UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN,
      KV_REST_API_URL,
      KV_REST_API_TOKEN,
      DATABASE_URL,
      NEON_URL,
      NEON_DATABASE_URL,
      ...rest
    }) => ({
      ...rest,
      DATABASE_URL: databaseUrl({ NEON_URL, NEON_DATABASE_URL, DATABASE_URL }),
      redisUrl: UPSTASH_REDIS_REST_URL ?? KV_REST_API_URL,
      redisToken: UPSTASH_REDIS_REST_TOKEN ?? KV_REST_API_TOKEN,
      isProduction: rest.VERCEL_ENV === "production",
    }),
  )
  .superRefine((env, ctx) => {
    if (!env.isProduction) return;
    if (env.LLM_MOCK) {
      ctx.addIssue({
        code: "custom",
        path: ["LLM_MOCK"],
        message: "LLM_MOCK must not be enabled in production",
      });
    }
    for (const [key, name] of Object.entries(PRODUCTION_REQUIRED)) {
      if (!env[key as keyof typeof PRODUCTION_REQUIRED]) {
        ctx.addIssue({ code: "custom", path: [], message: `${name} is required in production` });
      }
    }
  });

export type Env = z.output<typeof envSchema>;

/**
 * Validates an environment record. Throws with every problem listed (names only,
 * never values), so a misconfigured deployment fails fast and legibly.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings (common in .env files) as unset.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ""),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map(
      (i) => `  - ${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Server-only accessor. Parsed lazily so `next build` doesn't need runtime secrets. */
export function getEnv(): Env {
  if (typeof window !== "undefined") {
    throw new Error("getEnv() must only be called on the server");
  }
  cached ??= parseEnv(process.env);
  return cached;
}
