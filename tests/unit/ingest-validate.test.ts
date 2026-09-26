import { describe, expect, it } from "vitest";
import { IngestError } from "@/ingest/errors";
import { MAX_JD_CHARS, MAX_PDF_BYTES } from "@/ingest/limits";
import { hasPdfHeader, validateUpload } from "@/ingest/validate";

const pdfFile = (body = "%PDF-1.7\n...", name = "resume.pdf") =>
  new File([body], name, { type: "application/pdf" });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return e instanceof IngestError ? e.code : `unexpected: ${String(e)}`;
  }
}

describe("hasPdfHeader", () => {
  it("finds the header at the start or after leading junk", () => {
    expect(hasPdfHeader(new TextEncoder().encode("%PDF-1.4"))).toBe(true);
    expect(hasPdfHeader(new TextEncoder().encode("﻿junk%PDF-1.7"))).toBe(true);
  });
  it("rejects other formats", () => {
    expect(hasPdfHeader(new TextEncoder().encode("PK\u0003\u0004word/document.xml"))).toBe(false);
    expect(hasPdfHeader(new Uint8Array())).toBe(false);
  });
});

describe("validateUpload", () => {
  it("accepts a PDF and trims the job description", async () => {
    const { bytes, jd } = await validateUpload(pdfFile(), "  Senior Data Analyst  ");
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(jd).toBe("Senior Data Analyst");
  });

  it("treats a blank job description as absent", async () => {
    expect((await validateUpload(pdfFile(), "   ")).jd).toBeUndefined();
    expect((await validateUpload(pdfFile(), null)).jd).toBeUndefined();
  });

  it("requires a file", async () => {
    expect(await codeOf(validateUpload(null, null))).toBe("missing_file");
    expect(await codeOf(validateUpload("not a file", null))).toBe("missing_file");
  });

  it("rejects empty files", async () => {
    expect(await codeOf(validateUpload(pdfFile(""), null))).toBe("empty_file");
  });

  it("rejects files over the size limit before reading them", async () => {
    const big = new File([new Uint8Array(MAX_PDF_BYTES + 1)], "resume.pdf");
    const error = await validateUpload(big, null).catch((e: IngestError) => e);
    expect(error).toBeInstanceOf(IngestError);
    expect((error as IngestError).code).toBe("too_large");
    expect((error as IngestError).status).toBe(413);
    expect((error as IngestError).message).toContain("4.0 MB");
  });

  it("ignores the claimed MIME type and names the real extension", async () => {
    const docx = new File(["PK\u0003\u0004"], "resume.docx", { type: "application/pdf" });
    const error = (await validateUpload(docx, null).catch((e) => e)) as IngestError;
    expect(error.code).toBe("not_pdf");
    expect(error.status).toBe(415);
    expect(error.message).toContain(".docx");
  });

  it("rejects an over-long job description", async () => {
    expect(await codeOf(validateUpload(pdfFile(), "x".repeat(MAX_JD_CHARS + 1)))).toBe(
      "jd_too_long",
    );
    expect(await codeOf(validateUpload(pdfFile(), "x".repeat(MAX_JD_CHARS)))).toBeUndefined();
  });
});
