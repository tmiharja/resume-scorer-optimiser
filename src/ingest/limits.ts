/** Input limits (PLAN.md §3, §11 Q1). The upload cap sits below Vercel's 4.5 MB body limit. */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_PAGES = 4;
export const MAX_JD_CHARS = 8000;
/** Hard cap on text sent to the LLM (about 6k tokens); longer resumes are truncated. */
export const MAX_VISIBLE_CHARS = 24_000;
/** Multipart overhead allowance on top of the file and JD. */
export const MAX_REQUEST_BYTES = MAX_PDF_BYTES + MAX_JD_CHARS * 4 + 64 * 1024;
/** Upper bound on in-memory PDF parsing time. */
export const INGEST_TIMEOUT_MS = 15_000;

/** Heuristic thresholds (PLAN.md §4.0). Tunable; kept together so tests can reference them. */
export const HEURISTICS = {
  /** Effective font size (pt) below which text counts as hidden. */
  tinyFontPt: 4,
  /** Perceived brightness (0–1) at or above which text counts as white-on-white. */
  whiteBrightness: 0.94,
  /** Fill opacity at or below which text counts as invisible. */
  transparentAlpha: 0.1,
  /** Tolerance (pt) outside the page box before text counts as off-page. */
  offPageTolerancePt: 2,
  /** Minimum visible non-whitespace characters for a PDF to count as having text. */
  minTextChars: 200,
  /** Minimum drawn size (pt) for an image on page 1 to count as a likely photo. */
  photoMinPt: 60,
  /** Aspect ratio (w/h) range for a likely portrait photo. */
  photoAspect: [0.6, 1.4] as const,
  /** Keyword-list terms in one block that suggest stuffing. */
  keywordBlockTerms: 40,
  /** Times one keyword may repeat across keyword lists before it suggests stuffing. */
  keywordRepeats: 4,
  /** Characters of evidence shown per finding. */
  evidenceChars: 160,
} as const;
