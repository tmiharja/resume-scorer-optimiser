import { z } from "zod";
import { DIMENSIONS, SECTIONS, severity } from "./critique";
import { ingestWarning } from "./ingest";

export const scoreBand = z.enum(["needs_work", "fair", "good", "strong"]);
export type ScoreBand = z.infer<typeof scoreBand>;

export const resultFeedbackItem = z.object({
  severity,
  section: z.enum(SECTIONS),
  issue: z.string(),
  fix: z.string(),
  /** e.g. "Experience · Data Analyst, Northwind Retail · bullet 1" */
  citation: z.string().nullable(),
  /** The original bullet, when the item cites one. */
  quote: z.string().nullable(),
});

export const resultDimension = z.object({
  key: z.enum(DIMENSIONS),
  label: z.string(),
  score: z.number().int().min(0).max(100),
  items: z.array(resultFeedbackItem),
});

export const resultRewrite = z.object({
  bulletId: z.string(),
  /** "Role, Company" the bullet belongs to. */
  context: z.string(),
  original: z.string(),
  suggested: z.string(),
  /** Placeholders the user must fill, e.g. "[X%]". */
  placeholders: z.array(z.string()),
  rationale: z.string(),
});

/** The final payload streamed to the browser (the `result` SSE event). */
export const analysisResult = z.object({
  status: z.enum(["success", "partial"]),
  rubricVersion: z.string(),
  overall: z.number().int().min(0).max(100),
  band: scoreBand,
  verdict: z.string(),
  strongest: z.enum(DIMENSIONS),
  weakest: z.enum(DIMENSIONS),
  dimensions: z.array(resultDimension),
  jdProvided: z.boolean(),
  jdMatch: z
    .object({
      matchScore: z.number().int().min(0).max(100),
      summary: z.string(),
      matchedKeywords: z.array(z.string()),
      missingKeywords: z.array(z.string()),
      experienceGaps: z.array(z.string()),
      tailoringPriorities: z.array(z.string()),
    })
    .nullable(),
  rewrites: z
    .object({
      /** false when the Verifier step failed and only the code fact-guard ran. */
      verified: z.boolean(),
      items: z.array(resultRewrite),
      /** Rewrites removed because they added facts not in the resume. */
      droppedCount: z.number().int().nonnegative(),
    })
    .nullable(),
  warnings: z.array(ingestWarning),
  injection: z.object({ suspected: z.boolean(), evidence: z.array(z.string()) }),
  /** Plain-English notes about parts that couldn't be completed. */
  notices: z.array(z.string()),
});
export type AnalysisResult = z.infer<typeof analysisResult>;
