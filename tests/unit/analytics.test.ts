import { describe, expect, it } from "vitest";
import { runPipeline } from "@/agents/orchestrator";
import { getDb } from "@/db/client";
import { analyses } from "@/db/schema";
import { MOCK_OUTPUTS } from "@/llm/mock";
import type { IngestReport } from "@/schemas/ingest";
import {
  ANALYTICS_ALLOWLIST,
  analyticsRow,
  buildAnalyticsRow,
  recordAnalytics,
} from "@/server/analytics";
import { type FakeScript, fakeModels } from "../helpers/fake-models";

// Distinctive strings from the resume and JD that must never reach analytics.
const SECRETS = [
  "Alex Tan",
  "alex.tan@example.com",
  "Northwind",
  "Harbour",
  "weekly sales",
  "S1234567D",
  "Senior Data Analyst",
];

const INGEST: IngestReport = {
  pageCount: 1,
  visibleText: [
    "Alex Tan · alex.tan@example.com · NRIC S1234567D",
    "Data Analyst, Northwind Retail · 2022 – present",
    "Responsible for weekly sales reports for management.",
    "Analyst, Harbour Logistics · 2020 – 2022",
  ].join("\n"),
  visibleChars: 200,
  truncated: false,
  warnings: [{ kind: "nric_detected", page: 1, evidence: "NRIC/FIN number found: S••••567D" }],
  sgPersonalData: {
    nric: true,
    dateOfBirthOrAge: false,
    maritalStatus: false,
    race: false,
    religion: false,
    nationality: false,
    expectedSalary: false,
    workAuthorisation: false,
    photoLikely: false,
  },
};

async function metaFor(script: FakeScript = {}, jd?: string) {
  const { models } = fakeModels(script);
  const outcome = await runPipeline(
    { ingest: INGEST, jd },
    { models, emit: () => {}, startedAt: Date.now() },
  );
  return outcome.meta;
}

describe("analytics row", () => {
  it("contains only allowlisted fields", async () => {
    const row = buildAnalyticsRow(await metaFor({}, "Senior Data Analyst role"));
    expect(Object.keys(row).sort()).toEqual([...ANALYTICS_ALLOWLIST].sort());
    expect(ANALYTICS_ALLOWLIST).toEqual([
      "region",
      "roleFamily",
      "seniority",
      "industry",
      "yoeBucket",
      "pageCount",
      "overallScore",
      "dimensionScores",
      "jdProvided",
      "jdMatchScore",
      "injectionFlagged",
      "rubricVersion",
      "models",
      "inputTokens",
      "outputTokens",
      "costUsd",
      "latencyMs",
      "status",
    ]);
  });

  it("never carries resume or JD content", async () => {
    const row = buildAnalyticsRow(await metaFor({}, "Senior Data Analyst role"));
    const serialised = JSON.stringify(row);
    for (const secret of SECRETS) expect(serialised).not.toContain(secret);
    expect(row).toMatchObject({
      region: "SG",
      roleFamily: "data_analytics",
      status: "success",
      jdProvided: true,
      jdMatchScore: 64,
      overallScore: 73,
    });
    expect(row.costUsd).toMatch(/^\d+\.\d{6}$/);
  });

  it("records rejected and failed runs without scores", async () => {
    const notResume = buildAnalyticsRow(
      await metaFor({
        extractor: { ...MOCK_OUTPUTS.extractor, isResume: false, notResumeReason: "A recipe." },
      }),
    );
    expect(notResume).toMatchObject({
      status: "rejected_not_resume",
      roleFamily: null,
      overallScore: null,
    });

    const failed = buildAnalyticsRow(await metaFor({ critic: { error: new Error("boom") } }));
    expect(failed).toMatchObject({ status: "error", overallScore: null, dimensionScores: null });
    expect(failed.roleFamily).toBe("data_analytics");
  });

  it("rejects any field outside the allowlist", () => {
    const good = analyticsRow.parse({
      region: "SG",
      roleFamily: null,
      seniority: null,
      industry: null,
      yoeBucket: null,
      pageCount: 1,
      overallScore: null,
      dimensionScores: null,
      jdProvided: false,
      jdMatchScore: null,
      injectionFlagged: false,
      rubricVersion: "sg-2026.09.1",
      models: {
        extractor: "claude-haiku-4-5",
        critic: "claude-haiku-4-5",
        matcher: "claude-haiku-4-5",
        rewriter: "claude-haiku-4-5",
        verifier: "claude-haiku-4-5",
      },
      inputTokens: 0,
      outputTokens: 0,
      costUsd: "0.000000",
      latencyMs: 0,
      status: "error",
    });
    expect(() => analyticsRow.parse({ ...good, name: "Alex Tan" })).toThrow();
    expect(() => analyticsRow.parse({ ...good, roleFamily: "Alex Tan's job" })).toThrow();
    expect(() =>
      analyticsRow.parse({
        ...good,
        dimensionScores: { impact: 1, clarity: 1, structure: 1, ats: 1, sgConventions: 1, note: 2 },
      }),
    ).toThrow();
  });

  it("maps to exactly the analyses table columns in SQL", async () => {
    const row = buildAnalyticsRow(await metaFor({}, "JD"));
    // toSQL() builds the statement without touching the network.
    const { sql, params } = getDb("postgres://user:pass@example.neon.tech/db")
      .insert(analyses)
      .values(row)
      .toSQL();
    const columns = /insert into "analyses" \(([^)]+)\)/
      .exec(sql)?.[1]
      ?.split(", ")
      .map((c) => c.replace(/"/g, ""));
    expect(columns).toEqual(
      expect.arrayContaining([
        "role_family",
        "overall_score",
        "dimension_scores",
        "cost_usd",
        "status",
      ]),
    );
    expect(columns).not.toContain("resume_text");
    for (const secret of SECRETS) expect(JSON.stringify(params)).not.toContain(secret);
  });

  it("is a no-op without DATABASE_URL", async () => {
    const row = buildAnalyticsRow(await metaFor());
    await expect(recordAnalytics(row, undefined)).resolves.toBeUndefined();
  });
});
