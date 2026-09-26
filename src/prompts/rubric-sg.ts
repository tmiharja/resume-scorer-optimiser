import type { Dimension } from "@/schemas/critique";

/**
 * Singapore / SEA resume rubric. Versioned: bump RUBRIC_VERSION whenever the
 * rules or weights change, so analytics rows stay comparable.
 */
export const RUBRIC_VERSION = "sg-2026.09.1";

/** Weights for the overall score (sum 100). The overall is computed in code, not by the LLM. */
export const DIMENSION_WEIGHTS: Record<Dimension, number> = {
  impact: 30,
  clarity: 20,
  structure: 15,
  ats: 20,
  sgConventions: 15,
};

/** A dimension with this many high-severity items can't score above the cap. */
export const SEVERITY_CAP = { highItems: 2, maxScore: 70 } as const;

export const SG_RUBRIC = `
<rubric version="${RUBRIC_VERSION}">
Score each dimension 0-100. 85+ strong, 70-84 good, 50-69 fair, below 50 needs work.

1. impact (Impact & quantification): bullets show results, not duties; numbers, scale, scope and outcomes where credible; strong action verbs; XYZ style ("Accomplished X, measured by Y, by doing Z").
2. clarity (Clarity & concision): specific, jargon-light, no filler ("responsible for", "various", "helped with"); bullets of 1-2 lines; consistent tense.
3. structure (Structure & formatting): logical section order (summary, experience, education, skills); reverse-chronological roles with dates; length. Singapore norms: 1-2 pages is right for most people; 3 pages is acceptable only for very senior profiles (director and above, or 15+ years); 4 pages is too long.
4. ats (ATS readiness): standard section headings, parseable dates, role-relevant keywords used naturally in context; no keyword dumps or hidden text.
5. sgConventions (Singapore-market conventions):
   - Must NOT include: photo, NRIC/FIN number, age or date of birth, marital status, race, religion. Each present item is a high-severity issue.
   - Expected or current salary should not be on the resume (medium severity).
   - Nationality/work authorisation only if relevant (e.g. to show PR/EP status for a foreign candidate); otherwise leave it out (low severity).
   - British/Singapore English spelling used consistently (colour, organise, programme); mixed spelling is a low/medium issue.
   - A concise professional summary of 2-4 lines is preferred.
   - Quantified impact is expected.

Severity guide: high = likely to cost interviews or breaches SG norms; medium = noticeably weakens the resume; low = polish.
A dimension with ${SEVERITY_CAP.highItems} or more high-severity items should score at most ${SEVERITY_CAP.maxScore}.
</rubric>`.trim();
