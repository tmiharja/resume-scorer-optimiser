import type { AgentModel } from "@/llm/models";
import { REWRITER_PROMPT } from "@/prompts/rewriter";
import { wrapUntrusted } from "@/prompts/shared";
import type { StructuredResume } from "@/schemas/resume";
import { type RewriteOutput, rewriteOutput } from "@/schemas/rewrite";
import { bulletIndex, resumeForPrompt } from "./resume-view";
import { type AgentRun, runAgent } from "./run-agent";

const MAX_REWRITES = 8;
const MIN_REWRITES = 5;

/**
 * The Critic's weakest bullets, topped up with unquantified bullets so the
 * Rewriter always gets 5-8 candidates when the resume has that many.
 */
export function selectBullets(resume: StructuredResume, weakestIds: string[]): string[] {
  const index = bulletIndex(resume);
  const chosen = weakestIds.filter((id) => index.has(id)).slice(0, MAX_REWRITES);
  if (chosen.length < MIN_REWRITES) {
    for (const [id, bullet] of index) {
      if (chosen.length >= MIN_REWRITES) break;
      if (!chosen.includes(id) && !/\d/.test(bullet.text)) chosen.push(id);
    }
  }
  return chosen;
}

export async function runRewriter(
  model: AgentModel,
  resume: StructuredResume,
  bulletIds: string[],
  jd: string | undefined,
  signal?: AbortSignal,
): Promise<AgentRun<RewriteOutput>> {
  const index = bulletIndex(resume);
  const selected = bulletIds.map((id) => {
    const b = index.get(id)!;
    return { bulletId: id, role: `${b.role}, ${b.company}`, text: b.text };
  });
  const run = await runAgent({
    agent: "rewriter",
    model,
    instructions: REWRITER_PROMPT,
    prompt: [
      "Full resume, for context and facts:",
      wrapUntrusted("resume_json", resumeForPrompt(resume)),
      "Bullets to rewrite:",
      wrapUntrusted("resume_json", JSON.stringify(selected)),
      jd ? wrapUntrusted("job_description", jd) : "No job description was provided.",
    ].join("\n\n"),
    schema: rewriteOutput,
    timeoutMs: 60_000,
    maxOutputTokens: 4000,
    signal,
  });
  // Keep only rewrites of bullets that were actually selected, once each.
  const seen = new Set<string>();
  const items = run.output.items.filter(
    (item) =>
      bulletIds.includes(item.bulletId) && !seen.has(item.bulletId) && seen.add(item.bulletId),
  );
  return { ...run, output: { items } };
}
