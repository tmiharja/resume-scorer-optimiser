/**
 * Deterministic backstop for "never invent numbers, employers or achievements".
 * Runs on every rewrite after the Verifier (or instead of it, if it failed).
 * A rewrite is rejected if it contains a number or a capitalised name/term that
 * doesn't appear anywhere in the source resume. Placeholders like [X%] are fine.
 */

const PLACEHOLDER = /\[[^\]\n]{1,24}\]/g;

export function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER) ?? [])];
}

/** Numbers normalised so "1,200" and "1200" compare equal. */
function numbersIn(text: string): string[] {
  return (text.replace(PLACEHOLDER, " ").match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) =>
    n.replace(/,/g, ""),
  );
}

/**
 * Capitalised words that aren't the first word of a sentence: names of
 * employers, clients, tools and places. Single letters are ignored.
 */
function namesIn(text: string): string[] {
  const names: string[] = [];
  for (const sentence of text.replace(PLACEHOLDER, " ").split(/(?<=[.!?;:])\s+|\n+/)) {
    const words = sentence.trim().split(/\s+/);
    words.slice(1).forEach((raw) => {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+#]+$/gu, "");
      if (word.length > 1 && /^\p{Lu}/u.test(word)) names.push(word);
    });
  }
  return names;
}

export type GuardResult = { ok: true } | { ok: false; unsupported: string[] };

export function checkRewrite(suggested: string, source: string): GuardResult {
  const sourceNumbers = new Set(numbersIn(source));
  const sourceLower = source.toLowerCase();
  const unsupported = [
    ...numbersIn(suggested).filter((n) => !sourceNumbers.has(n)),
    ...namesIn(suggested).filter((name) => !sourceLower.includes(name.toLowerCase())),
  ];
  return unsupported.length ? { ok: false, unsupported: [...new Set(unsupported)] } : { ok: true };
}
