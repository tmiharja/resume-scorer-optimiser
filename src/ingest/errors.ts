import { MAX_JD_CHARS, MAX_PAGES, MAX_PDF_BYTES } from "./limits";

export type IngestErrorCode =
  | "missing_file"
  | "not_pdf"
  | "too_large"
  | "empty_file"
  | "jd_too_long"
  | "encrypted_pdf"
  | "too_many_pages"
  | "image_only_pdf"
  | "unreadable_pdf";

/** HTTP status for each rejection, used by the analyse route. */
export const INGEST_ERROR_STATUS: Record<IngestErrorCode, number> = {
  missing_file: 400,
  not_pdf: 415,
  too_large: 413,
  empty_file: 422,
  jd_too_long: 422,
  encrypted_pdf: 422,
  too_many_pages: 422,
  image_only_pdf: 422,
  unreadable_pdf: 422,
};

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * User-facing copy (ui-layout.md §6). Messages may include the file's own size,
 * page count or type, but never its contents.
 */
export function ingestErrorMessage(
  code: IngestErrorCode,
  detail: { bytes?: number; pages?: number; extension?: string } = {},
): string {
  switch (code) {
    case "missing_file":
      return "Choose a PDF of your resume to analyse.";
    case "not_pdf":
      return detail.extension && detail.extension !== "pdf"
        ? `That's a .${detail.extension} file. Please upload a PDF: most editors can export one via File → Save as PDF.`
        : "That file isn't a PDF. Please upload a PDF: most editors can export one via File → Save as PDF.";
    case "too_large":
      return detail.bytes
        ? `That file is ${mb(detail.bytes)}. The limit is ${mb(MAX_PDF_BYTES)}. Try exporting it again with smaller images.`
        : `That file is over the ${mb(MAX_PDF_BYTES)} limit. Try exporting it again with smaller images.`;
    case "empty_file":
      return "That file is empty. Please upload your resume as a PDF.";
    case "jd_too_long":
      return `The job description is over ${MAX_JD_CHARS.toLocaleString("en-SG")} characters. Trim it to the role summary and requirements.`;
    case "encrypted_pdf":
      return "This PDF is password-protected. Remove the password and upload it again.";
    case "too_many_pages":
      return `Your resume is ${detail.pages ?? "more than " + MAX_PAGES} pages. We accept up to ${MAX_PAGES}. Most Singapore resumes are 1–2 pages.`;
    case "image_only_pdf":
      return "We couldn't find any text. It looks like a scanned image. Please upload a PDF exported from your editor.";
    case "unreadable_pdf":
      return "We couldn't read this PDF. It may be damaged. Try exporting it again from your editor.";
  }
}

export class IngestError extends Error {
  readonly code: IngestErrorCode;
  readonly status: number;

  constructor(code: IngestErrorCode, detail?: Parameters<typeof ingestErrorMessage>[1]) {
    super(ingestErrorMessage(code, detail));
    this.name = "IngestError";
    this.code = code;
    this.status = INGEST_ERROR_STATUS[code];
  }
}
