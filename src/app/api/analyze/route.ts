import { runPipeline } from "@/agents/orchestrator";
import { getEnv } from "@/env";
import { IngestError, ingestPdf, validateUpload } from "@/ingest";
import { encodeEvent } from "@/lib/sse";
import { resolveModels } from "@/llm/models";
import type { AnalysisEvent } from "@/schemas/events";
import { logAnalysis, logError } from "@/server/log";
import { errorResponse, isBodyTooLarge, isSameOrigin } from "@/server/request";

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

  // Rate limiting and the monthly budget breaker go here (Phase 5), after
  // validation so rejected files don't use up a visitor's quota.

  let models: Awaited<ReturnType<typeof resolveModels>>;
  try {
    models = await resolveModels(getEnv());
  } catch (error) {
    logError("analyze.config", error);
    return errorResponse(
      503,
      "unavailable",
      "The analyser isn't available right now. Please try again later.",
    );
  }

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
      } catch (error) {
        logError("analyze.pipeline", error);
        emit({
          type: "error",
          code: "internal",
          message: "Something went wrong on our side. Please try again.",
        });
      } finally {
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
