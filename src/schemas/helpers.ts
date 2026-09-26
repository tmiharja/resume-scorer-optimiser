import { z } from "zod";

/**
 * Lenient field builders for LLM output schemas.
 *
 * Anthropic's native structured outputs can't enforce lengths or numeric
 * ranges; @ai-sdk/anthropic moves those into the schema description as hints,
 * and the AI SDK then validates the reply against this Zod schema. Hard limits
 * would turn "5 characters too long" into a failed call and a paid retry, so
 * these builders state the limit in the description and then trim / clamp.
 * The AI SDK converts schemas with `io: "input"`, so transforms are allowed.
 */

const withHint = (description: string | undefined, hint: string) =>
  description ? `${description} (${hint})` : hint;

const clip = (max: number) => (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Single-line text, trimmed and clipped to `max` characters. */
export const text = (max: number, description?: string) =>
  z
    .string()
    .describe(withHint(description, `max ${max} characters`))
    .transform(clip(max));

/** Array clipped to `max` items. */
export const list = <T extends z.ZodType>(item: T, max: number, description?: string) =>
  z
    .array(item)
    .describe(withHint(description, `at most ${max} items`))
    .transform((items) => items.slice(0, max));

/** Integer score, rounded and clamped to 0–100. */
export const score = (description?: string) =>
  z
    .number()
    .describe(withHint(description, "integer 0-100"))
    .transform((n) => Math.min(100, Math.max(0, Math.round(n))));

/** Integer clamped to [min, max]. */
export const int = (min: number, max: number, description?: string) =>
  z
    .number()
    .describe(withHint(description, `integer ${min} to ${max}`))
    .transform((n) => Math.min(max, Math.max(min, Math.round(n))));
