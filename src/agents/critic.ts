import type { AgentModel } from "@/llm/models";
import { CRITIC_PROMPT } from "@/prompts/critic";
import { wrapUntrusted } from "@/prompts/shared";
import { type CritiqueOutput, DIMENSIONS, critiqueOutput } from "@/schemas/critique";
import type { IngestReport } from "@/schemas/ingest";
import type { StructuredResume } from "@/schemas/resume";
import { bulletIndex, resumeForPrompt } from "./resume-view";
import { type AgentRun, runAgent } from "./run-agent";

/** Deterministic findings the Critic must take into account. */
export function pipelineFacts(ingest: IngestReport, resume: StructuredResume): string {
  const personal = Object.entries(resume.personalData)
    .filter(([, present]) => present)
    .map(([key]) => key);
  const warnings = [...new Set(ingest.warnings.map((w) => w.kind))];
  return [
    "<pipeline_facts>",
    `pages: ${ingest.pageCount}`,
    `seniority: ${resume.derived.seniority}; years of experience: ${resume.derived.yoeBucket}`,
    `spelling: ${resume.spelling}`,
    `personal data present: ${personal.length ? personal.join(", ") : "none"}`,
    `deterministic warnings: ${warnings.length ? warnings.join(", ") : "none"}`,
    `contact details present: ${Object.entries(resume.contact)
      .filter(([, v]) => v)
      .map(([k]) => k.replace(/^has/, "").toLowerCase())
      .join(", ")}`,
    "</pipeline_facts>",
  ].join("\n");
}

/** Drops citations to bullets that don't exist. */
function sanitise(output: CritiqueOutput, resume: StructuredResume): CritiqueOutput {
  const ids = bulletIndex(resume);
  const dimensions = { ...output.dimensions };
  for (const key of DIMENSIONS) {
    dimensions[key] = {
      ...dimensions[key],
      items: dimensions[key].items.map((item) =>
        item.bulletId && !ids.has(item.bulletId) ? { ...item, bulletId: null } : item,
      ),
    };
  }
  return {
    dimensions,
    weakestBulletIds: [...new Set(output.weakestBulletIds)].filter((id) => ids.has(id)),
  };
}

export async function runCritic(
  model: AgentModel,
  resume: StructuredResume,
  ingest: IngestReport,
  signal?: AbortSignal,
): Promise<AgentRun<CritiqueOutput>> {
  const run = await runAgent({
    agent: "critic",
    model,
    instructions: CRITIC_PROMPT,
    prompt: [
      pipelineFacts(ingest, resume),
      wrapUntrusted("resume_json", resumeForPrompt(resume)),
    ].join("\n\n"),
    schema: critiqueOutput,
    timeoutMs: 60_000,
    maxOutputTokens: 6000,
    signal,
  });
  return { ...run, output: sanitise(run.output, resume) };
}
