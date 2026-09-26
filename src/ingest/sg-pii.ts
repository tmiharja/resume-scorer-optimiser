/**
 * Deterministic detectors for personal data that Singapore resumes shouldn't
 * include (rubric: no NRIC, age, marital status, race or religion; no expected
 * salary). Results are hints for the Critic and warnings for the user. Matched
 * values are never stored or logged; NRICs are masked before display.
 */

const NRIC_PATTERN = /\b([STFGM])(\d{7})([A-Z])\b/g;
const WEIGHTS = [2, 7, 6, 5, 4, 3, 2] as const;
const CHECK_ST = "JZIHGFEDCBA";
const CHECK_FG = "XWUTRQPNMLK";
const CHECK_M = "KLJNPQRTUWX";

/** Validates the NRIC/FIN check letter (S/T citizens and PRs, F/G/M foreigners). */
export function isValidNric(value: string): boolean {
  const match = /^([STFGM])(\d{7})([A-Z])$/.exec(value.toUpperCase());
  if (!match) return false;
  const [, prefix, digits, check] = match as unknown as [string, string, string, string];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * WEIGHTS[i]!;
  if (prefix === "T" || prefix === "G") sum += 4;
  if (prefix === "M") sum += 3;
  const r = sum % 11;
  const expected =
    prefix === "S" || prefix === "T"
      ? CHECK_ST[r]
      : prefix === "F" || prefix === "G"
        ? CHECK_FG[r]
        : CHECK_M[10 - r];
  return check === expected;
}

/** "S1234567D" → "S••••567D" */
export function maskNric(value: string): string {
  return `${value[0]}••••${value.slice(5)}`;
}

/** Returns masked NRIC/FIN numbers found in the text (valid checksums only). */
export function findNrics(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.toUpperCase().matchAll(NRIC_PATTERN)) {
    if (isValidNric(m[0])) found.add(maskNric(m[0]));
  }
  return [...found];
}

export type SgPersonalDataHints = {
  nric: boolean;
  dateOfBirthOrAge: boolean;
  maritalStatus: boolean;
  race: boolean;
  religion: boolean;
  nationality: boolean;
  expectedSalary: boolean;
  workAuthorisation: boolean;
};

// A label separator: a colon, or a dash followed by a space ("Race: …", "Race – …"),
// so hyphenated words like "race-condition" don't match.
const SEP = String.raw`\s*(?::|[-–]\s)`;

const HINT_PATTERNS: Record<Exclude<keyof SgPersonalDataHints, "nric">, RegExp> = {
  dateOfBirthOrAge: new RegExp(
    String.raw`\b(date of birth|d\.?\s?o\.?\s?b\.?|birth\s?date)\b|\bage${SEP}\s*\d{2}\b|\b\d{2}\s*(years old|y\/o)\b`,
    "i",
  ),
  maritalStatus: new RegExp(
    String.raw`\bmarital status\b|\bstatus${SEP}\s*(single|married|divorced|widowed)\b`,
    "i",
  ),
  race: new RegExp(String.raw`\b(race|ethnicity)${SEP}`, "i"),
  religion: new RegExp(String.raw`\breligion${SEP}`, "i"),
  nationality: new RegExp(String.raw`\bnationality${SEP}`, "i"),
  expectedSalary:
    /\b(expected|current|last[-\s]drawn|asking)\s+(salary|pay|remuneration)\b|\bsalary\s+expectations?\b/i,
  workAuthorisation:
    /\b(singapore(an)?\s+(citizen|pr)|permanent resident|employment pass|s[\s-]?pass|work permit|dependant'?s? pass|ltvp)\b/i,
};

export function detectSgPersonalData(text: string): SgPersonalDataHints {
  const hints = { nric: findNrics(text).length > 0 } as SgPersonalDataHints;
  for (const [key, pattern] of Object.entries(HINT_PATTERNS)) {
    hints[key as keyof typeof HINT_PATTERNS] = pattern.test(text);
  }
  return hints;
}
