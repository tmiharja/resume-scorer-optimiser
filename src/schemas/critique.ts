import { z } from "zod";
import { list, score, text } from "./helpers";

export const DIMENSIONS = ["impact", "clarity", "structure", "ats", "sgConventions"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  impact: "Impact & quantification",
  clarity: "Clarity & concision",
  structure: "Structure & formatting",
  ats: "ATS readiness",
  sgConventions: "SG-market conventions",
};

export const SECTIONS = [
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
  "contact",
  "personal",
  "layout",
  "whole",
] as const;

export const severity = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof severity>;

export const feedbackItem = z.object({
  severity,
  section: z.enum(SECTIONS),
  bulletId: z
    .string()
    .nullable()
    .describe("ID of the bullet this refers to, e.g. e1b2, or null for section-level feedback"),
  issue: text(220, "What is wrong, specifically"),
  fix: text(220, "What to do instead"),
});
export type FeedbackItem = z.output<typeof feedbackItem>;

const dimension = z.object({
  score: score(),
  items: list(feedbackItem, 6, "Most important first"),
});

export const critiqueOutput = z.object({
  dimensions: z.object({
    impact: dimension,
    clarity: dimension,
    structure: dimension,
    ats: dimension,
    sgConventions: dimension,
  }),
  weakestBulletIds: list(z.string(), 8, "IDs of the 5-8 bullets that most need rewriting"),
});
export type CritiqueOutput = z.output<typeof critiqueOutput>;
