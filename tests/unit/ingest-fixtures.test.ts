import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestPdf } from "@/ingest";

// Regression tests on the committed eval fixtures (evals/fixtures, all synthetic).
const load = async (name: string) =>
  ingestPdf(new Uint8Array(await readFile(path.join("evals/fixtures", `${name}.pdf`))));
const kinds = (r: Awaited<ReturnType<typeof load>>) => r.warnings.map((w) => w.kind);

describe("eval fixtures: ingest", () => {
  it("removes Chromium-rendered white-text injection exactly (matches the clean twin)", async () => {
    const [dirty, clean] = await Promise.all([
      load("hidden-injection"),
      load("hidden-injection-clean"),
    ]);
    expect(kinds(dirty)).toContain("hidden_white_text");
    expect(kinds(clean)).toEqual([]);
    expect(dirty.visibleText).toBe(clean.visibleText);
    expect(dirty.visibleText).not.toMatch(/ignore all previous instructions/i);
  });

  it("flags SG personal data", async () => {
    const report = await load("sg-personal-data");
    expect(kinds(report)).toEqual(expect.arrayContaining(["nric_detected", "photo_detected"]));
    expect(report.sgPersonalData).toMatchObject({
      nric: true,
      photoLikely: true,
      dateOfBirthOrAge: true,
      maritalStatus: true,
      race: true,
      religion: true,
      expectedSalary: true,
    });
  });

  it("flags keyword stuffing, visible and tiny", async () => {
    expect(kinds(await load("keyword-stuffing"))).toEqual(
      expect.arrayContaining(["tiny_font", "keyword_stuffing"]),
    );
  });

  it("accepts the 4-page resume and flags its length", async () => {
    const report = await load("overlong-4p");
    expect(report.pageCount).toBe(4);
    expect(kinds(report)).toContain("page_count_long");
  });

  it.each([
    "senior-strong",
    "junior-weak",
    "no-metrics",
    "jd-match",
    "jd-mismatch",
    "not-a-resume",
  ])("raises no ingest warnings for %s", async (name) => {
    expect(kinds(await load(name))).toEqual([]);
  });
});
