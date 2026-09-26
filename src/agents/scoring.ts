import { DIMENSION_WEIGHTS, SEVERITY_CAP } from "@/prompts/rubric-sg";
import { type CritiqueOutput, DIMENSIONS, type Dimension } from "@/schemas/critique";
import type { ScoreBand } from "@/schemas/result";
import type { VerifyOutput } from "@/schemas/verify";

export type DimensionScores = Record<Dimension, number>;

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Final dimension scores: the Critic's scores, plus the Verifier's
 * consistency adjustments (at most ±10 in total per dimension), then the
 * rubric's severity cap (2+ high-severity items → at most 70).
 */
export function finalScores(
  critique: CritiqueOutput,
  adjustments: VerifyOutput["scoreAdjustments"] = [],
): DimensionScores {
  const scores = {} as DimensionScores;
  for (const d of DIMENSIONS) {
    const delta = adjustments.filter((a) => a.dimension === d).reduce((sum, a) => sum + a.delta, 0);
    let score = clamp(critique.dimensions[d].score + Math.max(-10, Math.min(10, delta)));
    const highs = critique.dimensions[d].items.filter((i) => i.severity === "high").length;
    if (highs >= SEVERITY_CAP.highItems) score = Math.min(score, SEVERITY_CAP.maxScore);
    scores[d] = score;
  }
  return scores;
}

/** Weighted mean of the dimension scores, computed in code (not by the LLM). */
export function overallScore(scores: DimensionScores): number {
  const total = DIMENSIONS.reduce((sum, d) => sum + scores[d] * DIMENSION_WEIGHTS[d], 0);
  const weights = DIMENSIONS.reduce((sum, d) => sum + DIMENSION_WEIGHTS[d], 0);
  return clamp(total / weights);
}

export function scoreBand(overall: number): ScoreBand {
  if (overall >= 85) return "strong";
  if (overall >= 70) return "good";
  if (overall >= 50) return "fair";
  return "needs_work";
}

export const VERDICTS: Record<ScoreBand, string> = {
  strong: "Strong. Just some polish left.",
  good: "Good. A few fixes from strong.",
  fair: "Fair. Some clear fixes will lift it.",
  needs_work: "Needs work. Start with the high-priority fixes.",
};

/** Strongest and weakest dimensions (ties go to rubric order). */
export function extremes(scores: DimensionScores): { strongest: Dimension; weakest: Dimension } {
  let strongest: Dimension = DIMENSIONS[0];
  let weakest: Dimension = DIMENSIONS[0];
  for (const d of DIMENSIONS) {
    if (scores[d] > scores[strongest]) strongest = d;
    if (scores[d] < scores[weakest]) weakest = d;
  }
  return { strongest, weakest };
}
