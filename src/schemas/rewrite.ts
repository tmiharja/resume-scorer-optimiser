import { z } from "zod";
import { list, text } from "./helpers";

export const rewriteOutput = z.object({
  items: list(
    z.object({
      bulletId: z.string().describe("ID of the original bullet, e.g. e1b2"),
      suggested: text(300, "Rewritten bullet"),
      rationale: text(160, "Why this is stronger"),
    }),
    8,
  ),
});
export type RewriteOutput = z.output<typeof rewriteOutput>;
