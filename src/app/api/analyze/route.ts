import { type PipelineMeta, runPipeline } from "@/agents/orchestrator";
import { after } from "next/server";
import { type Env, getEnv } from "@/env";
import { IngestError, ingestPdf, validateUpload } from "@/ingest";
import { encodeEvent } from "@/lib/sse";
import { resolveModels } from "@/llm/models";
import type { AnalysisEvent } from "@/schemas/events";
import { buildAnalyticsRow, recordAnalytics } from "@/server/analytics";
import { capacityMessage, monthKey } from "@/server/budget";
import { type Guards, getGuards } from "@/server/guards";
import { logAnalysis, logError } from "@/server/log";
import { clientIp, hashIp } from "@/server/ratelimit";
import { errorResponse, isBodyTooLarge, isSameOrigin } from "@/server/request";

/** `after()` outside a Next.js request (unit tests) falls back to running now. */
function runAfter(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

// Hobby-plan maximum with Fluid Compute; the pipeline itself is capped at 270 s.
export const maxDuration = 300;

/**
 * POST multipart/form-data { file: PDF, jd?: string }.
 *
 * Guards, validation and in-memory ingest run first and fail as plain HTTP
 * errors (4xx), so bad files never cost an analysis. Then the response becomes
 * a text/event-stream of step events and a final `result` or `error` event.
 */
export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  if (!isSameOrigin(request)) {
    return errorResponse(403, "forbidden_origin", "Requests must come from this site.");
  }
  if (isBodyTooLarge(request)) {
    return errorResponse(413, "too_large", new IngestError("too_large").message);
  }

  let upload: Awaited<ReturnType<typeof validateUpload>>;
  let report: Awaited<ReturnType<typeof ingestPdf>>;
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new IngestError("missing_file");
    }
    upload = await validateUpload(form.get("file"), form.get("jd"));
    report = await ingestPdf(upload.bytes);
  } catch (error) {
    if (error instanceof IngestError) return errorResponse(error.status, error.code, error.message);
    logError("analyze.ingest", error);
    return errorResponse(500, "internal", "Something went wrong on our side. Please try again.");
  }
  const parseMs = Date.now() - startedAt;

  let env: Env;
  let models: Awaited<ReturnType<typeof resolveModels>>;
  let guards: Guards;
  try {
    env = getEnv();
    models = await resolveModels(env);
    guards = getGuards(env);
  } catch (error) {
    logError("analyze.config", error);
    return errorResponse(
      503,
      "unavailable",
      "The analyser isn't available right now. Please try again later.",
    );
  }

  // Budget breaker, then the per-visitor limit. Both run after validation, so
  // a rejected file never uses up quota; the limit is only consumed by a run.
  try {
    if ((await guards.budget.spent(monthKey())) >= env.MONTHLY_BUDGET_USD) {
      return errorResponse(503, "capacity_reached", capacityMessage());
    }
    const visitor = hashIp(clientIp(request), guards.salt);
    const limit = await guards.limiter.limit(visitor);
    if (!limit.success) {
      const response = errorResponse(
        429,
        "rate_limited",
        `You've used today's ${env.RATE_LIMIT_PER_DAY} free analyses.`,
        new Date(limit.reset).toISOString(),
      );
      response.headers.set(
        "retry-after",
        String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))),
      );
      return response;
    }
  } catch (error) {
    // If Redis is unreachable, fail closed: an unmetered public LLM endpoint
    // is the costlier failure.
    logError("analyze.guards", error);
    return errorResponse(
      503,
      "unavailable",
      "The analyser isn't available right now. Please try again later.",
    );
  }

  // Bookkeeping once the stream has finished: spend towards the monthly budget
  // and the anonymised analytics row. Registered here, in the request scope,
  // and fed the run summary when the pipeline completes. Neither step can
  // affect the user's result.
  let finished: (meta: PipelineMeta | null) => void = () => {};
  const runSummary = new Promise<PipelineMeta | null>((resolve) => (finished = resolve));
  runAfter(async () => {
    const meta = await runSummary;
    if (!meta) return;
    await guards.budget.add(monthKey(), meta.costUsd).catch((e) => logError("analyze.budget", e));
    await recordAnalytics(buildAnalyticsRow(meta), env.DATABASE_URL).catch((e) =>
      logError("analyze.analytics", e),
    );
  });

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const encoder = new TextEncoder();
  const jd = upload.jd;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: AnalysisEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          open = false;
        }
      };

      emit({ type: "step", step: "parse", status: "done", t: parseMs, durationMs: parseMs });
      for (const warning of report.warnings) emit({ type: "warning", warning });

      try {
        const outcome = await runPipeline(
          { ingest: report, jd },
          { models, emit, startedAt, signal: abort.signal },
        );
        logAnalysis(outcome.meta);
        finished(outcome.meta);
      } catch (error) {
        logError("analyze.pipeline", error);
        emit({
          type: "error",
          code: "internal",
          message: "Something went wrong on our side. Please try again.",
        });
      } finally {
        finished(null); // no-op if the summary was already delivered
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
