import { z } from "zod";
import { analysisResult } from "./result";
import { ingestWarning } from "./ingest";

export const STEPS = ["parse", "extract", "critique", "match", "rewrite", "verify"] as const;
export const step = z.enum(STEPS);
export type Step = z.infer<typeof step>;

export const errorCode = z.enum([
  "not_resume",
  "extract_failed",
  "critique_failed",
  "timeout",
  "cancelled",
  "internal",
]);
export type PipelineErrorCode = z.infer<typeof errorCode>;

/** Server-sent events on POST /api/analyze (PLAN.md §3). */
export const analysisEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("step"),
    step,
    status: z.enum(["started", "done", "error", "skipped"]),
    /** Milliseconds since the request started. */
    t: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("warning"), warning: ingestWarning }),
  z.object({ type: z.literal("result"), result: analysisResult }),
  z.object({ type: z.literal("error"), code: errorCode, message: z.string() }),
]);
export type AnalysisEvent = z.infer<typeof analysisEvent>;
