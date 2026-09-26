import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Agent } from "@/llm/models";
import type { ModelId } from "@/llm/pricing";
import type { Dimension } from "@/schemas/critique";
import {
  ANALYSIS_STATUSES,
  INDUSTRIES,
  ROLE_FAMILIES,
  SENIORITIES,
  YOE_BUCKETS,
} from "@/schemas/enums";

/**
 * Anonymised analytics (PLAN.md §7). No direct identifiers: no names, contact
 * details, companies, schools, resume text or JD text. Categorical columns are
 * Postgres enums and numbers are range-checked, so free text can't leak in.
 */
export const regionEnum = pgEnum("region", ["SG"]);
export const roleFamilyEnum = pgEnum("role_family", ROLE_FAMILIES);
export const seniorityEnum = pgEnum("seniority", SENIORITIES);
export const industryEnum = pgEnum("industry", INDUSTRIES);
export const yoeBucketEnum = pgEnum("yoe_bucket", YOE_BUCKETS);
export const statusEnum = pgEnum("analysis_status", ANALYSIS_STATUSES);

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    region: regionEnum("region").notNull().default("SG"),
    // Null when the run stopped before the Extractor classified the resume.
    roleFamily: roleFamilyEnum("role_family"),
    seniority: seniorityEnum("seniority"),
    industry: industryEnum("industry"),
    yoeBucket: yoeBucketEnum("yoe_bucket"),
    pageCount: smallint("page_count").notNull(),
    overallScore: smallint("overall_score"),
    dimensionScores: jsonb("dimension_scores").$type<Record<Dimension, number>>(),
    jdProvided: boolean("jd_provided").notNull(),
    jdMatchScore: smallint("jd_match_score"),
    injectionFlagged: boolean("injection_flagged").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    models: jsonb("models").$type<Record<Agent, ModelId>>().notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    status: statusEnum("status").notNull(),
  },
  (t) => [
    check("page_count_range", sql`${t.pageCount} between 1 and 4`),
    check(
      "overall_score_range",
      sql`${t.overallScore} is null or ${t.overallScore} between 0 and 100`,
    ),
    check("jd_match_range", sql`${t.jdMatchScore} is null or ${t.jdMatchScore} between 0 and 100`),
    check(
      "rubric_version_format",
      sql`${t.rubricVersion} ~ '^[a-z]{2}-[0-9]{4}\\.[0-9]{2}\\.[0-9]+$'`,
    ),
  ],
);

export type NewAnalysis = typeof analyses.$inferInsert;
