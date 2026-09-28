import type { AgentModel } from "@/llm/models";
import { wrapUntrusted } from "@/prompts/shared";
import { VERIFIER_PROMPT } from "@/prompts/verifier";
import { type CritiqueOutput, DIMENSIONS } from "@/schemas/critique";
import type { StructuredResume } from "@/schemas/resume";
import type { RewriteOutput } from "@/schemas/rewrite";
import { type VerifyOutput, verifyOutput } from "@/schemas/verify";
import { bulletIndex, resumeForPrompt } from "./resume-view";
import { type AgentRun, runAgent } from "./run-agent";

export async function runVerifier(
  model: AgentModel,
  resume: StructuredResume,
  critique: CritiqueOutput,
  rewrites: RewriteOutput,
  signal?: AbortSignal,
): Promise<AgentRun<VerifyOutput>> {
  const index = bulletIndex(resume);
  const proposed = rewrites.items.map((r) => ({
    bulletId: r.bulletId,
    original: index.get(r.bulletId)?.text ?? "",
    suggested: r.suggested,
  }));
  const scores = DIMENSIONS.map((d) => {
    const items = critique.dimensions[d].items;
    const count = (s: string) => items.filter((i) => i.severity === s).length;
    return `${d}: score ${critique.dimensions[d].score}; issues high ${count("high")}, medium ${count("medium")}, low ${count("low")}`;
  }).join("\n");

  return runAgent({
    agent: "verifier",
    model,
    instructions: VERIFIER_PROMPT,
    prompt: [
      "Original resume:",
      wrapUntrusted("resume_json", resumeForPrompt(resume)),
      "Proposed rewrites:",
      wrapUntrusted("rewrites", JSON.stringify(proposed)),
      `Scores and feedback counts:\n${scores}`,
    ].join("\n\n"),
    schema: verifyOutput,
    timeoutMs: 45_000,
    maxOutputTokens: 3000,
    signal,
  });
}
