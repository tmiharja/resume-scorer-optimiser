import { z } from "zod";
import { list, score, text } from "./helpers";

export const matchOutput = z.object({
  matchScore: score("How well the resume fits the job description"),
  summary: text(200, "One sentence on the overall fit"),
  matchedKeywords: list(text(40), 25, "Skills/keywords from the JD that the resume shows"),
  missingKeywords: list(text(40), 25, "Important JD skills/keywords the resume doesn't show"),
  experienceGaps: list(text(200), 5),
  tailoringPriorities: list(text(200), 3, "Top 3 changes, most important first"),
});
export type MatchOutput = z.output<typeof matchOutput>;
