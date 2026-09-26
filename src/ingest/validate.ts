import { IngestError } from "./errors";
import { MAX_JD_CHARS, MAX_PDF_BYTES } from "./limits";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** True if the "%PDF-" header appears in the first 1 KB (the spec allows leading junk). */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - PDF_MAGIC.length, 1024);
  for (let i = 0; i <= limit; i++) {
    if (PDF_MAGIC.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

function extensionOf(name: string | undefined): string | undefined {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name ?? "");
  return match?.[1]?.toLowerCase();
}

export type ValidUpload = { bytes: Uint8Array; jd: string | undefined };

/**
 * Checks the uploaded file and optional job description before any parsing.
 * The browser-supplied MIME type is ignored: only the file's own header counts.
 */
export async function validateUpload(
  file: FormDataEntryValue | null,
  jdValue: FormDataEntryValue | null,
): Promise<ValidUpload> {
  if (!(file instanceof Blob)) throw new IngestError("missing_file");
  const name = file instanceof File ? file.name : undefined;
  const extension = extensionOf(name);

  if (file.size === 0) throw new IngestError("empty_file");
  if (file.size > MAX_PDF_BYTES) throw new IngestError("too_large", { bytes: file.size });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasPdfHeader(bytes)) throw new IngestError("not_pdf", { extension });

  let jd: string | undefined;
  if (typeof jdValue === "string") {
    const trimmed = jdValue.normalize("NFKC").trim();
    if (trimmed.length > MAX_JD_CHARS) throw new IngestError("jd_too_long");
    jd = trimmed || undefined;
  }
  return { bytes, jd };
}
