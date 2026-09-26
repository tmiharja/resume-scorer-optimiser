import type { IngestReport } from "@/schemas/ingest";
import { analysePdf } from "./heuristics";
import { parsePdf } from "./pdf";

export { IngestError, type IngestErrorCode } from "./errors";
export { validateUpload } from "./validate";

/** Parses a validated PDF in memory and returns the visible text plus red-flag findings. */
export async function ingestPdf(bytes: Uint8Array): Promise<IngestReport> {
  return analysePdf(await parsePdf(bytes));
}
