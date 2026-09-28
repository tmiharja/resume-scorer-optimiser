import type { AgentModel } from "@/llm/models";
import { EXTRACTOR_PROMPT } from "@/prompts/extractor";
import { wrapUntrusted } from "@/prompts/shared";
import type { IngestReport } from "@/schemas/ingest";
import { extractorOutput, type StructuredResume } from "@/schemas/resume";
import { type AgentRun, runAgent } from "./run-agent";

/** Adds stable IDs (e1, e1b1 …) and merges the deterministic ingest checks. */
export function toStructuredResume(
  output: typeof extractorOutput._output,
  ingest: IngestReport,
): StructuredResume {
  const hints = ingest.sgPersonalData;
  return {
    ...output,
    experience: output.experience.map((role, i) => ({
      ...role,
      id: `e${i + 1}`,
      bullets: role.bullets.map((text, j) => ({ id: `e${i + 1}b${j + 1}`, text })),
    })),
    personalData: {
      nric: output.personalData.nric || hints.nric,
      ageOrDateOfBirth: output.personalData.ageOrDateOfBirth || hints.dateOfBirthOrAge,
      maritalStatus: output.personalData.maritalStatus || hints.maritalStatus,
      race: output.personalData.race || hints.race,
      religion: output.personalData.religion || hints.religion,
      nationality: output.personalData.nationality || hints.nationality,
      expectedSalary: output.personalData.expectedSalary || hints.expectedSalary,
      workAuthorisation: output.personalData.workAuthorisation || hints.workAuthorisation,
      photo: hints.photoLikely,
    },
  };
}

export async function runExtractor(
  model: AgentModel,
  ingest: IngestReport,
  signal?: AbortSignal,
): Promise<AgentRun<StructuredResume>> {
  const run = await runAgent({
    agent: "extractor",
    model,
    instructions: EXTRACTOR_PROMPT,
    prompt: [
      `The document has ${ingest.pageCount} page(s).${ingest.truncated ? " The text was truncated for length." : ""}`,
      wrapUntrusted("resume_text", ingest.visibleText),
    ].join("\n\n"),
    schema: extractorOutput,
    timeoutMs: 90_000,
    maxOutputTokens: 8000,
    signal,
  });
  return { ...run, output: toStructuredResume(run.output, ingest) };
}
