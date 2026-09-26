import { z } from "zod";
import { MAX_PAGES, MAX_VISIBLE_CHARS } from "@/ingest/limits";

export const ingestWarningKind = z.enum([
  "hidden_white_text",
  "invisible_render_mode",
  "tiny_font",
  "off_page_text",
  "keyword_stuffing",
  "photo_detected",
  "nric_detected",
  "page_count_long",
]);
export type IngestWarningKind = z.infer<typeof ingestWarningKind>;

/** Warnings that mean content was hidden from readers (and removed before scoring). */
export const HIDDEN_TEXT_KINDS = [
  "hidden_white_text",
  "invisible_render_mode",
  "tiny_font",
  "off_page_text",
] as const satisfies readonly IngestWarningKind[];

export const ingestWarning = z.object({
  kind: ingestWarningKind,
  page: z.number().int().min(1).max(MAX_PAGES),
  /** Short excerpt shown back to the user; NRICs are masked. */
  evidence: z.string().max(200),
});
export type IngestWarning = z.infer<typeof ingestWarning>;

export const sgPersonalDataHints = z.object({
  nric: z.boolean(),
  dateOfBirthOrAge: z.boolean(),
  maritalStatus: z.boolean(),
  race: z.boolean(),
  religion: z.boolean(),
  nationality: z.boolean(),
  expectedSalary: z.boolean(),
  workAuthorisation: z.boolean(),
  photoLikely: z.boolean(),
});

/** Output of the deterministic ingest step (PLAN.md §4.0). Lives in memory only. */
export const ingestReport = z.object({
  pageCount: z.number().int().min(1).max(MAX_PAGES),
  /** Text readers can see; hidden spans removed. This is all the LLM receives. */
  visibleText: z.string().max(MAX_VISIBLE_CHARS),
  visibleChars: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(ingestWarning).max(24),
  sgPersonalData: sgPersonalDataHints,
});
export type IngestReport = z.infer<typeof ingestReport>;
