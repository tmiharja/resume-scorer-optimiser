import { ingestErrorMessage } from "@/ingest/errors";
import { MAX_JD_CHARS, MAX_PDF_BYTES } from "@/ingest/limits";

/**
 * Instant checks in the browser, with the same messages as the server
 * (which re-checks everything, including the file's real header).
 */
export function checkFile(file: File): string | null {
  const extension = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1]?.toLowerCase();
  const looksPdf = extension === "pdf" || file.type === "application/pdf";
  if (!looksPdf) return ingestErrorMessage("not_pdf", { extension });
  if (file.size === 0) return ingestErrorMessage("empty_file");
  if (file.size > MAX_PDF_BYTES) return ingestErrorMessage("too_large", { bytes: file.size });
  return null;
}

export function checkJd(jd: string): string | null {
  return jd.trim().length > MAX_JD_CHARS ? ingestErrorMessage("jd_too_long") : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
