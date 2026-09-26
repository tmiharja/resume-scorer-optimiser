import type { PipelineMeta } from "@/agents/orchestrator";

/**
 * Structured logs with an explicit field allowlist. Nothing from the resume or
 * JD (and nothing from error objects, which can carry model output) is logged.
 */
export function logAnalysis(meta: PipelineMeta): void {
  const entry = {
    event: "analysis",
    status: meta.status,
    rubricVersion: meta.rubricVersion,
    pageCount: meta.pageCount,
    jdProvided: meta.jdProvided,
    injectionFlagged: meta.injectionFlagged,
    roleFamily: meta.derived?.roleFamily ?? null,
    seniority: meta.derived?.seniority ?? null,
    overall: meta.overall,
    jdMatchScore: meta.jdMatchScore,
    models: meta.models,
    inputTokens: meta.usage.inputTokens,
    cacheWriteTokens: meta.usage.cacheWriteTokens,
    cacheReadTokens: meta.usage.cacheReadTokens,
    outputTokens: meta.usage.outputTokens,
    costUsd: Number(meta.costUsd.toFixed(6)),
    latencyMs: meta.latencyMs,
    steps: Object.fromEntries(
      Object.entries(meta.steps).map(([agent, s]) => [
        agent,
        { ok: s.ok, ms: s.ms, attempts: s.attempts, costUsd: Number(s.costUsd.toFixed(6)) },
      ]),
    ),
  };
  console.info(JSON.stringify(entry));
}

export function logError(where: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "unknown";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : undefined;
  console.error(JSON.stringify({ event: "error", where, errorClass: name, code }));
}
