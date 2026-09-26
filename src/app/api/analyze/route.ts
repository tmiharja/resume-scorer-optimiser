import { IngestError, ingestPdf, validateUpload } from "@/ingest";
import { errorResponse, isBodyTooLarge, isSameOrigin } from "@/server/request";

// Hobby-plan maximum with Fluid Compute; the full agent pipeline needs ~1 min.
export const maxDuration = 300;

/**
 * POST multipart/form-data { file: PDF, jd?: string }.
 *
 * Phase 2: guards, validation and in-memory ingest only. Returns the ingest
 * summary as JSON (never the resume text). Phase 3 turns the success path into
 * an SSE stream of agent progress events.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "forbidden_origin", "Requests must come from this site.");
  }
  if (isBodyTooLarge(request)) {
    return errorResponse(413, "too_large", new IngestError("too_large").message);
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new IngestError("missing_file");
    }
    const { bytes } = await validateUpload(form.get("file"), form.get("jd"));
    const report = await ingestPdf(bytes);

    return Response.json(
      {
        pageCount: report.pageCount,
        visibleChars: report.visibleChars,
        truncated: report.truncated,
        warnings: report.warnings,
        sgPersonalData: report.sgPersonalData,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof IngestError) {
      return errorResponse(error.status, error.code, error.message);
    }
    // Log the error class only: error objects from parsers can carry content.
    console.error("analyze: unexpected error", { errorClass: (error as Error)?.name ?? "unknown" });
    return errorResponse(500, "internal", "Something went wrong on our side. Please try again.");
  }
}
