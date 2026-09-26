import type { AgentModel } from "@/llm/models";
import { MATCHER_PROMPT } from "@/prompts/matcher";
import { wrapUntrusted } from "@/prompts/shared";
import { type MatchOutput, matchOutput } from "@/schemas/match";
import type { StructuredResume } from "@/schemas/resume";
import { resumeForPrompt } from "./resume-view";
import { type AgentRun, runAgent } from "./run-agent";

export async function runMatcher(
  model: AgentModel,
  resume: StructuredResume,
  jd: string,
  signal?: AbortSignal,
): Promise<AgentRun<MatchOutput>> {
  return runAgent({
    agent: "matcher",
    model,
    instructions: MATCHER_PROMPT,
    prompt: [
      wrapUntrusted("resume_json", resumeForPrompt(resume)),
      wrapUntrusted("job_description", jd),
    ].join("\n\n"),
    schema: matchOutput,
    timeoutMs: 45_000,
    maxOutputTokens: 1500,
    signal,
  });
}
