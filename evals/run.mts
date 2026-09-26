/**
 * Eval suite: runs every fixture through the real pipeline (real API calls,
 * real cost) and checks the expectations in evals/cases.ts.
 *
 *   npm run eval                      all fixtures
 *   npm run eval -- --only=jd-match   a subset (comma-separated)
 *   EVAL_MOCK=1 npm run eval          plumbing check with the mock model (no API calls)
 *
 * Writes the full outputs to evals/results/latest.json for review.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { type PipelineOutcome, runPipeline } from "../src/agents/orchestrator";
import { parseEnv } from "../src/env";
import { ingestPdf } from "../src/ingest";
import { resolveModels } from "../src/llm/models";
import { CASES, type EvalRun } from "./cases";

const DIR = import.meta.dirname;
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? "true"];
  }),
);
const only = args.get("only")?.split(",");
const concurrency = Number(args.get("concurrency") ?? 2);

const mock = process.env.EVAL_MOCK === "1";
const env = parseEnv({ ...process.env, LLM_MOCK: mock ? "1" : "0" });
if (!mock && !env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set. Set it, or run with EVAL_MOCK=1 for a plumbing check.",
  );
  process.exit(2);
}
const models = await resolveModels(env);

// The clean twin must run before the injection case, which compares against it.
const selected = CASES.filter((c) => !only || only.includes(c.name));
const ordered = [
  ...selected.filter((c) => c.name === "hidden-injection-clean"),
  ...selected.filter((c) => c.name !== "hidden-injection-clean"),
];

const runs = new Map<string, EvalRun>();
async function runCase(name: string, jdFile?: string): Promise<EvalRun> {
  const pdf = new Uint8Array(await readFile(path.join(DIR, "fixtures", `${name}.pdf`)));
  const jd = jdFile ? await readFile(path.join(DIR, "fixtures", "jds", jdFile), "utf8") : undefined;
  const ingest = await ingestPdf(pdf);
  const outcome: PipelineOutcome = await runPipeline(
    { ingest, jd },
    { models, emit: () => {}, startedAt: Date.now() },
  );
  return { name, ingest, outcome };
}

console.log(
  `Running ${ordered.length} eval case(s) ${mock ? "with the MOCK model" : `on ${[...new Set(Object.values(models).map((m) => m.id))].join(", ")}`}…\n`,
);
const queue = [...ordered];
const clean = queue.findIndex((c) => c.name === "hidden-injection-clean");
if (clean === 0) {
  const c = queue.shift()!;
  runs.set(c.name, await runCase(c.name, c.jd));
}
await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        runs.set(c.name, await runCase(c.name, c.jd));
      } catch (error) {
        console.error(`${c.name}: crashed (${(error as Error).name}: ${(error as Error).message})`);
      }
    }
  }),
);

type Row = {
  name: string;
  status: string;
  overall: string;
  match: string;
  rewrites: string;
  cost: string;
  secs: string;
  result: string;
};
const rows: Row[] = [];
const problems: string[] = [];
let totalCost = 0;
let totalIn = 0;
let totalOut = 0;
for (const c of ordered) {
  const run = runs.get(c.name);
  if (!run) {
    rows.push({
      name: c.name,
      status: "crashed",
      overall: "",
      match: "",
      rewrites: "",
      cost: "",
      secs: "",
      result: "FAIL",
    });
    problems.push(`${c.name}: crashed`);
    continue;
  }
  const fails = c.check(run, runs);
  const { meta } = run.outcome;
  totalCost += meta.costUsd;
  totalIn += meta.usage.inputTokens + meta.usage.cacheReadTokens + meta.usage.cacheWriteTokens;
  totalOut += meta.usage.outputTokens;
  const r = run.outcome.kind === "result" ? run.outcome.result : null;
  rows.push({
    name: c.name,
    status: run.outcome.kind === "result" ? r!.status : run.outcome.code,
    overall: r ? String(r.overall) : "–",
    match: r?.jdMatch ? String(r.jdMatch.matchScore) : "–",
    rewrites: r?.rewrites
      ? `${r.rewrites.items.length}/${r.rewrites.items.length + r.rewrites.droppedCount}`
      : "–",
    cost: `$${meta.costUsd.toFixed(4)}`,
    secs: (meta.latencyMs / 1000).toFixed(1),
    result: fails.length ? "FAIL" : "PASS",
  });
  for (const f of fails) problems.push(`${c.name}: ${f}`);
}

const headers: Row = {
  name: "fixture",
  status: "status",
  overall: "overall",
  match: "match",
  rewrites: "rewrites kept",
  cost: "cost",
  secs: "secs",
  result: "result",
};
const cols = Object.keys(headers) as (keyof Row)[];
const width = (k: keyof Row) => Math.max(headers[k].length, ...rows.map((r) => r[k].length));
const line = (r: Row) => cols.map((k) => r[k].padEnd(width(k))).join("  ");
console.log(line(headers));
console.log(cols.map((k) => "-".repeat(width(k))).join("  "));
rows.forEach((r) => console.log(line(r)));
const passed = rows.filter((r) => r.result === "PASS").length;
console.log(
  `\n${passed}/${rows.length} passed · total cost $${totalCost.toFixed(4)} · ${totalIn.toLocaleString()} input + ${totalOut.toLocaleString()} output tokens`,
);
if (problems.length) console.log(`\nFailures:\n${problems.map((p) => `  - ${p}`).join("\n")}`);

await mkdir(path.join(DIR, "results"), { recursive: true });
await writeFile(
  path.join(DIR, "results", "latest.json"),
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      mock,
      totalCostUsd: totalCost,
      cases: ordered.map((c) => {
        const run = runs.get(c.name);
        return run
          ? { name: c.name, warnings: run.ingest.warnings, outcome: run.outcome }
          : { name: c.name, crashed: true };
      }),
    },
    null,
    2,
  ),
);
console.log("Full outputs: evals/results/latest.json");
process.exit(problems.length ? 1 : 0);
