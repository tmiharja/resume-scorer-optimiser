import { z } from "zod";
import { DIMENSIONS } from "./critique";
import { int, list, text } from "./helpers";

export const verifyOutput = z.object({
  rewrites: list(
    z.object({
      bulletId: z.string(),
      verdict: z.enum(["keep", "edit", "drop"]),
      edited: text(300, "Corrected rewrite when verdict is edit, else null").nullable(),
      reason: text(160),
    }),
    8,
  ),
  scoreAdjustments: list(
    z.object({
      dimension: z.enum(DIMENSIONS),
      delta: int(-10, 10),
      reason: text(160),
    }),
    5,
  ),
});
export type VerifyOutput = z.output<typeof verifyOutput>;
