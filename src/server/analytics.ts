import { z } from "zod";
import type { PipelineMeta } from "@/agents/orchestrator";
import type { Agent } from "@/llm/models";
import { MODEL_IDS } from "@/llm/pricing";
import { RUBRIC_VERSION } from "@/prompts/rubric-sg";
import type { Dimension } from "@/schemas/critique";
import { ANALYSIS_STATUSES, industry, roleFamily, seniority, yoeBucket } from "@/schemas/enums";

const score = z.number().int().min(0).max(100);
const model = z.enum(MODEL_IDS);

/**
 * The only fields that may ever reach the analytics table. `.strict()` rejects
 * anything else, and every value is an enum, number, boolean or fixed-format
 * string, so nothing from the resume or JD can be stored (PLAN.md §7).
 */
export const analyticsRow = z
  .object({
    region: z.literal("SG"),
    roleFamily: roleFamily.nullable(),
    seniority: seniority.nullable(),
    industry: industry.nullable(),
    yoeBucket: yoeBucket.nullable(),
    pageCount: z.number().int().min(1).max(4),
    overallScore: z.number().int().min(0).max(100).nullable(),
    dimensionScores: z
      .object({
        impact: score,
        clarity: score,
        structure: score,
        ats: score,
        sgConventions: score,
      } satisfies Record<Dimension, typeof score>)
      .strict()
      .nullable(),
    jdProvided: z.boolean(),
    jdMatchScore: z.number().int().min(0).max(100).nullable(),
    injectionFlagged: z.boolean(),
    rubricVersion: z.literal(RUBRIC_VERSION),
    models: z
      .object({
        extractor: model,
        critic: model,
        matcher: model,
        rewriter: model,
        verifier: model,
      } satisfies Record<Agent, typeof model>)
      .strict(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    /** numeric(10,6), passed to Postgres as a string. */
    costUsd: z.string().regex(/^\d{1,4}\.\d{6}$/),
    latencyMs: z.number().int().nonnegative(),
    status: z.enum(ANALYSIS_STATUSES),
  })
  .strict();
export type AnalyticsRow = z.infer<typeof analyticsRow>;

export const ANALYTICS_ALLOWLIST = Object.keys(analyticsRow.shape) as (keyof AnalyticsRow)[];

/** Pure: maps a run summary to an allowlisted row. Throws if anything is off. */
export function buildAnalyticsRow(meta: PipelineMeta): AnalyticsRow {
  return analyticsRow.parse({
    region: "SG",
    roleFamily: meta.derived?.roleFamily ?? null,
    seniority: meta.derived?.seniority ?? null,
    industry: meta.derived?.industry ?? null,
    yoeBucket: meta.derived?.yoeBucket ?? null,
    pageCount: meta.pageCount,
    overallScore: meta.overall,
    dimensionScores: meta.dimensionScores,
    jdProvided: meta.jdProvided,
    jdMatchScore: meta.jdMatchScore,
    injectionFlagged: meta.injectionFlagged,
    rubricVersion: meta.rubricVersion,
    models: meta.models,
    // Cached input is still input: count everything the run consumed.
    inputTokens: meta.usage.inputTokens + meta.usage.cacheReadTokens + meta.usage.cacheWriteTokens,
    outputTokens: meta.usage.outputTokens,
    costUsd: meta.costUsd.toFixed(6),
    latencyMs: Math.round(meta.latencyMs),
    status: meta.status,
  });
}

/** Inserts one row. A no-op without DATABASE_URL (local dev and tests). */
export async function recordAnalytics(
  row: AnalyticsRow,
  databaseUrl: string | undefined,
): Promise<void> {
  if (!databaseUrl) return;
  const [{ getDb }, { analyses }] = await Promise.all([
    import("@/db/client"),
    import("@/db/schema"),
  ]);
  await getDb(databaseUrl).insert(analyses).values(row);
}
