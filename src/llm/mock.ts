import { MockLanguageModelV4 } from "ai/test";
import type { CritiqueOutput } from "@/schemas/critique";
import type { MatchOutput } from "@/schemas/match";
import type { ExtractorOutput } from "@/schemas/resume";
import type { RewriteOutput } from "@/schemas/rewrite";
import type { VerifyOutput } from "@/schemas/verify";
import type { AgentModels } from "./models";

/**
 * Deterministic LLM stand-in for e2e tests and offline development
 * (LLM_MOCK=1, refused in production by src/env.ts). Each call is routed by
 * the "# Pipeline step: <agent>" header in its system prompt and answers with
 * canned, schema-valid JSON. It never makes a network call.
 */

type Json = Record<string, unknown>;

const MOCK_RESUME: ExtractorOutput = {
  isResume: true,
  notResumeReason: null,
  injection: { suspected: false, evidence: [] },
  contact: { hasName: true, hasEmail: true, hasPhone: true, hasLocation: true, hasLinkedIn: false },
  summary:
    "Data analyst with five years of experience in retail analytics, building reporting pipelines and dashboards.",
  experience: [
    {
      role: "Data Analyst",
      company: "Northwind Retail",
      start: "2022",
      end: "present",
      bullets: [
        "Responsible for weekly sales reports for management.",
        "Worked with teams to improve data quality.",
        "Did A/B tests for the website.",
      ],
    },
    {
      role: "Analyst",
      company: "Harbour Logistics",
      start: "2020",
      end: "2022",
      bullets: ["Built Python scripts to reconcile shipment data across three warehouse systems."],
    },
  ],
  education: [{ institution: "Example University", qualification: "BSc Statistics", year: "2020" }],
  skills: ["SQL", "Python", "Tableau", "Excel", "A/B testing"],
  certifications: [],
  personalData: {
    nric: false,
    ageOrDateOfBirth: false,
    maritalStatus: false,
    race: false,
    religion: false,
    nationality: false,
    expectedSalary: false,
    workAuthorisation: false,
  },
  spelling: "british",
  derived: {
    roleFamily: "data_analytics",
    seniority: "mid",
    industry: "retail_ecommerce",
    yoeBucket: "5-9",
  },
};

const item = (
  severity: "high" | "medium" | "low",
  section: CritiqueOutput["dimensions"]["impact"]["items"][number]["section"],
  bulletId: string | null,
  issue: string,
  fix: string,
) => ({ severity, section, bulletId, issue, fix });

const MOCK_CRITIQUE: CritiqueOutput = {
  dimensions: {
    impact: {
      score: 58,
      items: [
        item(
          "high",
          "experience",
          "e1b1",
          "Describes duties, not results.",
          "Lead with the outcome and add a metric, e.g. reporting time saved.",
        ),
        item(
          "high",
          "experience",
          null,
          "No numbers in your most recent role.",
          "Quantify scale (records, users, revenue) for at least two bullets.",
        ),
        item(
          "medium",
          "experience",
          "e1b3",
          "Vague about what the tests achieved.",
          "Say what you tested and the result.",
        ),
      ],
    },
    clarity: {
      score: 74,
      items: [
        item(
          "medium",
          "experience",
          "e1b2",
          '"Worked with teams" is vague.',
          "Name the teams and what you changed.",
        ),
      ],
    },
    structure: { score: 86, items: [] },
    ats: {
      score: 79,
      items: [
        item(
          "low",
          "skills",
          null,
          "Skills list lacks role keywords.",
          "Add the tools you use daily, such as SQL dialects.",
        ),
      ],
    },
    sgConventions: {
      score: 80,
      items: [
        item(
          "low",
          "summary",
          null,
          "Summary could be sharper.",
          "Keep it to 2-3 lines focused on outcomes.",
        ),
      ],
    },
  },
  weakestBulletIds: ["e1b1", "e1b2", "e1b3"],
};

const MOCK_MATCH: MatchOutput = {
  matchScore: 64,
  summary: "Good overlap on core tools; gaps in the modern data stack.",
  matchedKeywords: ["SQL", "Python", "Tableau", "A/B testing"],
  missingKeywords: ["dbt", "BigQuery", "Looker"],
  experienceGaps: ["No evidence of dbt or cloud data warehouses."],
  tailoringPriorities: [
    "Mention any cloud warehouse you have used.",
    "Surface the A/B testing work higher up.",
    "Quantify the reporting automation.",
  ],
};

const MOCK_REWRITES: RewriteOutput = {
  items: [
    {
      bulletId: "e1b1",
      suggested:
        "Automated weekly sales reporting in SQL and Tableau, cutting preparation time by [X hours] for management.",
      rationale: "Leads with the outcome and leaves a slot for the real saving.",
    },
    {
      bulletId: "e1b2",
      suggested:
        "Partnered with merchandising and finance to fix upstream data issues, reducing report errors by [X%].",
      rationale: "Names the partners and the result.",
    },
    {
      bulletId: "e1b3",
      suggested: "Designed and analysed [N] A/B tests on the website, lifting conversion by [X%].",
      rationale: "States the scope and the outcome.",
    },
  ],
};

const MOCK_VERIFY: VerifyOutput = {
  rewrites: [
    { bulletId: "e1b1", verdict: "keep", edited: null, reason: "Supported by the resume." },
    {
      bulletId: "e1b2",
      verdict: "edit",
      edited:
        "Worked with stakeholders to fix upstream data issues, reducing report errors by [X%].",
      reason: "The resume doesn't name merchandising or finance.",
    },
    { bulletId: "e1b3", verdict: "keep", edited: null, reason: "Supported by the resume." },
  ],
  scoreAdjustments: [],
};

/** Canned per-agent outputs, exported for tests. */
export const MOCK_OUTPUTS = {
  extractor: MOCK_RESUME,
  critic: MOCK_CRITIQUE,
  matcher: MOCK_MATCH,
  rewriter: MOCK_REWRITES,
  verifier: MOCK_VERIFY,
};

const NOT_A_RESUME: Json = {
  ...MOCK_RESUME,
  isResume: false,
  notResumeReason: "It reads like a recipe.",
  experience: [],
  education: [],
  skills: [],
};

type Prompt = Parameters<MockLanguageModelV4["doGenerate"]>[0]["prompt"];

function textOf(prompt: Prompt): string {
  return prompt
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content.map((part) => ("text" in part ? String(part.text) : "")).join("\n"),
    )
    .join("\n");
}

function respond(prompt: Prompt): Json {
  const all = textOf(prompt);
  const agent = /# Pipeline step: (\w+)/.exec(all)?.[1];
  switch (agent) {
    case "extractor":
      return /\bingredients\b|\brecipe\b/i.test(all) ? NOT_A_RESUME : MOCK_RESUME;
    case "critic":
      return MOCK_CRITIQUE;
    case "matcher":
      return MOCK_MATCH;
    case "rewriter":
      return MOCK_REWRITES;
    case "verifier":
      return MOCK_VERIFY;
    default:
      throw new Error("mock model: unknown pipeline step");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** LLM_MOCK_DELAY_MS sets the per-call delay (default 250 ms, so progress is visible). */
export function createMockModel(delayMs = Number(process.env.LLM_MOCK_DELAY_MS ?? 250)) {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: "mock",
    doGenerate: async ({ prompt }) => {
      await sleep(delayMs);
      const text = JSON.stringify(respond(prompt));
      const outputTokens = Math.ceil(text.length / 4);
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "end_turn" },
        usage: {
          inputTokens: { total: 3000, noCache: 3000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

/** Every agent on the mock model, priced as Haiku so cost logging still works. */
export function mockAgentModels(delayMs?: number): AgentModels {
  const model = createMockModel(delayMs);
  const entry = { id: "claude-haiku-4-5" as const, model };
  return { extractor: entry, critic: entry, matcher: entry, rewriter: entry, verifier: entry };
}
