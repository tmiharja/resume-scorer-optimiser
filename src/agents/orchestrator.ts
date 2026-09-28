import type { Agent, AgentModels } from "@/llm/models";
import { type ModelId, type TokenUsage, costUsd } from "@/llm/pricing";
import { RUBRIC_VERSION } from "@/prompts/rubric-sg";
import {
  type CritiqueOutput,
  DIMENSIONS,
  DIMENSION_LABELS,
  type FeedbackItem,
  type Severity,
} from "@/schemas/critique";
import type { AnalysisStatus } from "@/schemas/enums";
import type { AnalysisEvent, PipelineErrorCode, Step } from "@/schemas/events";
import { HIDDEN_TEXT_KINDS, type IngestReport } from "@/schemas/ingest";
import type { MatchOutput } from "@/schemas/match";
import type { AnalysisResult } from "@/schemas/result";
import type { StructuredResume } from "@/schemas/resume";
import type { RewriteOutput } from "@/schemas/rewrite";
import type { VerifyOutput } from "@/schemas/verify";
import { runCritic } from "./critic";
import { runExtractor } from "./extractor";
import { checkRewrite, placeholdersIn } from "./fact-guard";
import { runMatcher } from "./matcher";
import { bulletIndex } from "./resume-view";
import { runRewriter, selectBullets } from "./rewriter";
import { AgentError, type AgentRun, addUsage } from "./run-agent";
import { VERDICTS, extremes, finalScores, overallScore, scoreBand } from "./scoring";
import { runVerifier } from "./verifier";

/** Global budget for the LLM steps, under the route's 300 s maxDuration. */
export const PIPELINE_DEADLINE_MS = 270_000;

export type PipelineInput = { ingest: IngestReport; jd?: string | undefined };

export type PipelineDeps = {
  models: AgentModels;
  emit: (event: AnalysisEvent) => void;
  /** Request start (ms epoch), for the `t` field of step events. */
  startedAt: number;
  /** Aborts on client disconnect. */
  signal?: AbortSignal;
};

type StepRecord = {
  ok: boolean;
  ms: number;
  attempts: number;
  usage: TokenUsage;
  costUsd: number;
  /** Why a failed step failed (AgentError.detail); for logs only. */
  error?: string;
};

/** Server-side run summary for logging and analytics. Contains no resume content. */
export type PipelineMeta = {
  status: AnalysisStatus;
  rubricVersion: string;
  pageCount: number;
  jdProvided: boolean;
  derived: StructuredResume["derived"] | null;
  overall: number | null;
  dimensionScores: Record<(typeof DIMENSIONS)[number], number> | null;
  jdMatchScore: number | null;
  injectionFlagged: boolean;
  models: Record<Agent, ModelId>;
  usage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  steps: Partial<Record<Agent, StepRecord>>;
};

export type PipelineOutcome =
  | { kind: "result"; result: AnalysisResult; meta: PipelineMeta }
  | { kind: "error"; code: PipelineErrorCode; message: string; meta: PipelineMeta };

const ERROR_MESSAGES: Record<PipelineErrorCode, string> = {
  not_resume: "This doesn't look like a resume.",
  extract_failed: "We couldn't read the structure of your resume. Please try again.",
  critique_failed: "We couldn't finish the analysis. This is on our side, not your file.",
  timeout: "The review took too long to respond. Please try again.",
  cancelled: "The analysis was cancelled.",
  internal: "Something went wrong on our side. Please try again.",
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const ZERO: TokenUsage = {
  inputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  outputTokens: 0,
};

export async function runPipeline(
  input: PipelineInput,
  deps: PipelineDeps,
): Promise<PipelineOutcome> {
  const { ingest, jd } = input;
  const { models, emit, startedAt } = deps;
  const signal = AbortSignal.any([
    ...(deps.signal ? [deps.signal] : []),
    AbortSignal.timeout(PIPELINE_DEADLINE_MS),
  ]);
  const steps: PipelineMeta["steps"] = {};
  const notices: string[] = [];
  const t = () => Math.max(0, Date.now() - startedAt);

  const meta = (status: AnalysisStatus, extra: Partial<PipelineMeta> = {}): PipelineMeta => {
    const records = Object.values(steps);
    return {
      status,
      rubricVersion: RUBRIC_VERSION,
      pageCount: ingest.pageCount,
      jdProvided: Boolean(jd),
      derived: null,
      overall: null,
      dimensionScores: null,
      jdMatchScore: null,
      injectionFlagged: ingest.warnings.some((w) =>
        (HIDDEN_TEXT_KINDS as readonly string[]).includes(w.kind),
      ),
      models: Object.fromEntries(Object.entries(models).map(([a, m]) => [a, m.id])) as Record<
        Agent,
        ModelId
      >,
      usage: records.reduce((sum, r) => addUsage(sum, r.usage), ZERO),
      costUsd: records.reduce((sum, r) => sum + r.costUsd, 0),
      latencyMs: t(),
      steps,
      ...extra,
    };
  };

  /** Runs one agent step with started/done/error events and cost bookkeeping. */
  async function step<T>(
    agent: Agent,
    stepName: Step,
    fn: () => Promise<AgentRun<T>>,
  ): Promise<AgentRun<T>> {
    const began = Date.now();
    emit({ type: "step", step: stepName, status: "started", t: t() });
    try {
      const run = await fn();
      steps[agent] = {
        ok: true,
        ms: run.durationMs,
        attempts: run.attempts,
        usage: run.usage,
        costUsd: run.costUsd,
      };
      emit({
        type: "step",
        step: stepName,
        status: "done",
        t: t(),
        durationMs: Date.now() - began,
      });
      return run;
    } catch (error) {
      const usage = error instanceof AgentError ? error.usage : ZERO;
      const detail = error instanceof AgentError ? error.detail : undefined;
      steps[agent] = {
        ok: false,
        ms: Date.now() - began,
        attempts: 0,
        usage,
        costUsd: costUsd(models[agent].id, usage),
        ...(detail ? { error: detail } : {}),
      };
      emit({
        type: "step",
        step: stepName,
        status: "error",
        t: t(),
        durationMs: Date.now() - began,
      });
      throw error;
    }
  }

  const fail = (
    code: PipelineErrorCode,
    extra?: Partial<PipelineMeta>,
    detail?: string | null,
  ): PipelineOutcome => {
    const message = detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code];
    emit({ type: "error", code, message });
    return {
      kind: "error",
      code,
      message,
      meta: meta(code === "not_resume" ? "rejected_not_resume" : "error", extra),
    };
  };
  const failureCode = (error: unknown, fallback: PipelineErrorCode): PipelineErrorCode => {
    if (error instanceof AgentError && error.code === "cancelled") {
      return deps.signal?.aborted ? "cancelled" : "timeout";
    }
    if (error instanceof AgentError && error.code === "timeout") return "timeout";
    return fallback;
  };

  // 1. Extractor (critical)
  let resume: StructuredResume;
  try {
    resume = (
      await step("extractor", "extract", () => runExtractor(models.extractor, ingest, signal))
    ).output;
  } catch (error) {
    return fail(failureCode(error, "extract_failed"));
  }
  if (!resume.isResume) {
    // The reason is model-written from the document; it's shown to the user only.
    return fail("not_resume", { derived: null }, resume.notResumeReason);
  }

  // 2. Critic (critical) and JD Matcher (non-critical) in parallel
  if (!jd) emit({ type: "step", step: "match", status: "skipped", t: t() });
  const [critiqueRes, matchRes] = await Promise.allSettled([
    step("critic", "critique", () => runCritic(models.critic, resume, ingest, signal)),
    jd ? step("matcher", "match", () => runMatcher(models.matcher, resume, jd, signal)) : null,
  ]);
  if (critiqueRes.status === "rejected") {
    return fail(failureCode(critiqueRes.reason, "critique_failed"), { derived: resume.derived });
  }
  const critique: CritiqueOutput = critiqueRes.value.output;
  let match: MatchOutput | null = null;
  if (jd) {
    if (matchRes.status === "fulfilled" && matchRes.value) match = matchRes.value.output;
    else notices.push("We couldn't complete the job match this time. Your scores are unaffected.");
  }

  // 3. Rewriter (non-critical)
  let rewrites: RewriteOutput | null = null;
  const bulletIds = selectBullets(resume, critique.weakestBulletIds);
  if (bulletIds.length === 0) {
    emit({ type: "step", step: "rewrite", status: "skipped", t: t() });
  } else {
    try {
      rewrites = (
        await step("rewriter", "rewrite", () =>
          runRewriter(models.rewriter, resume, bulletIds, jd, signal),
        )
      ).output;
    } catch {
      notices.push(
        "Suggested rewrites are unavailable for this run. Your scores and feedback are complete.",
      );
    }
  }

  // 4. Verifier (non-critical); the deterministic fact guard runs either way
  let verification: VerifyOutput | null = null;
  if (rewrites && rewrites.items.length > 0) {
    try {
      verification = (
        await step("verifier", "verify", () =>
          runVerifier(models.verifier, resume, critique, rewrites!, signal),
        )
      ).output;
    } catch {
      notices.push(
        "We couldn't fully fact-check the rewrites this time. Check each one carefully before using it.",
      );
    }
  } else {
    emit({ type: "step", step: "verify", status: "skipped", t: t() });
  }

  // 5. Assemble
  const scores = finalScores(critique, verification?.scoreAdjustments);
  const overall = overallScore(scores);
  const band = scoreBand(overall);
  const { strongest, weakest } = extremes(scores);
  const index = bulletIndex(resume);
  const source = [ingest.visibleText, JSON.stringify(resume)].join("\n");

  let rewriteResult: AnalysisResult["rewrites"] = null;
  if (rewrites) {
    const verdicts = new Map(verification?.rewrites.map((v) => [v.bulletId, v]));
    let dropped = 0;
    const items: NonNullable<AnalysisResult["rewrites"]>["items"] = [];
    for (const r of rewrites.items) {
      const bullet = index.get(r.bulletId);
      const verdict = verdicts.get(r.bulletId);
      const suggested =
        verdict?.verdict === "edit" && verdict.edited ? verdict.edited : r.suggested;
      if (!bullet || verdict?.verdict === "drop" || !checkRewrite(suggested, source).ok) {
        dropped++;
        continue;
      }
      items.push({
        bulletId: r.bulletId,
        context: `${bullet.role}, ${bullet.company}`,
        original: bullet.text,
        suggested,
        placeholders: placeholdersIn(suggested),
        rationale: r.rationale,
      });
    }
    rewriteResult = { verified: verification !== null, items, droppedCount: dropped };
  }

  const citation = (item: FeedbackItem) => {
    const bullet = item.bulletId ? index.get(item.bulletId) : undefined;
    if (!bullet) return { citation: null, quote: null };
    return {
      citation: `Experience · ${bullet.role}, ${bullet.company} · bullet ${bullet.position}`,
      quote: bullet.text,
    };
  };

  const result: AnalysisResult = {
    status: notices.length > 0 ? "partial" : "success",
    rubricVersion: RUBRIC_VERSION,
    overall,
    band,
    verdict: VERDICTS[band],
    strongest,
    weakest,
    dimensions: DIMENSIONS.map((key) => ({
      key,
      label: DIMENSION_LABELS[key],
      score: scores[key],
      items: [...critique.dimensions[key].items]
        .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
        .map((item) => ({
          severity: item.severity,
          section: item.section,
          issue: item.issue,
          fix: item.fix,
          ...citation(item),
        })),
    })),
    jdProvided: Boolean(jd),
    jdMatch: match,
    rewrites: rewriteResult,
    warnings: ingest.warnings,
    injection: resume.injection,
    notices,
  };

  emit({ type: "result", result });
  return {
    kind: "result",
    result,
    meta: meta(result.status, {
      derived: resume.derived,
      overall,
      dimensionScores: scores,
      jdMatchScore: match?.matchScore ?? null,
      injectionFlagged:
        resume.injection.suspected ||
        ingest.warnings.some((w) => (HIDDEN_TEXT_KINDS as readonly string[]).includes(w.kind)),
    }),
  };
}
