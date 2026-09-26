import { createHash } from "node:crypto";
import zlib from "node:zlib";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  TextRenderingMode,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setTextRenderingMode,
} from "pdf-lib";

/**
 * Deterministic synthetic PDFs for unit tests and eval fixtures. All people,
 * employers and numbers used with this builder are fictional.
 */

export type Block =
  | { type: "name"; text: string }
  | { type: "contact"; text: string }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "role"; text: string }
  | { type: "bullet"; text: string }
  | { type: "pageBreak" };

export type HiddenExtras = {
  /** White text on the white page. */
  whiteText?: string;
  /** 1pt text. */
  tinyText?: string;
  /** Text positioned outside the page box. */
  offPageText?: string;
  /** Text drawn with render mode 3 (invisible). */
  invisibleText?: string;
};

export type ResumeSpec = {
  blocks: Block[];
  hidden?: HiddenExtras;
  /** Draw a portrait-sized image in the top-right corner of page 1. */
  photo?: boolean;
  /** Draw a small (logo-sized) image in the top-right corner of page 1. */
  logo?: boolean;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const BODY = 10.5;
const LINE = 14.5;

/** Solid-colour RGB PNG, built by hand so tests need no image files. */
export function makePng(width: number, height: number, [r, g, b] = [128, 128, 128]): Uint8Array {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw[y * row + 1 + x * 3] = r;
      raw[y * row + 2 + x * 3] = g;
      raw[y * row + 3 + x * 3] = b;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typed));
    return Buffer.concat([len, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Lays out resume blocks top to bottom on A4 pages, adding pages as needed. */
export async function buildResumePdf(spec: ResumeSpec): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  // Fixed metadata keeps output byte-for-byte reproducible.
  doc.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  doc.setProducer("resume-optimiser test fixtures");
  doc.setCreator("resume-optimiser test fixtures");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = A4[0] - MARGIN * 2;
  const ink = rgb(0.1, 0.1, 0.1);

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  for (const block of spec.blocks) {
    switch (block.type) {
      case "pageBreak":
        newPage();
        break;
      case "name":
        ensure(30);
        page.drawText(block.text, { x: MARGIN, y: y - 20, size: 20, font: bold, color: ink });
        y -= 30;
        break;
      case "contact":
        ensure(LINE);
        page.drawText(block.text, { x: MARGIN, y: y - BODY, size: 9.5, font: regular, color: ink });
        y -= LINE + 6;
        break;
      case "heading":
        ensure(LINE + 14);
        y -= 10;
        page.drawText(block.text.toUpperCase(), {
          x: MARGIN,
          y: y - 11,
          size: 11,
          font: bold,
          color: ink,
        });
        y -= LINE + 4;
        break;
      case "role":
        ensure(LINE + 4);
        page.drawText(block.text, { x: MARGIN, y: y - BODY, size: BODY, font: bold, color: ink });
        y -= LINE + 2;
        break;
      case "text":
      case "bullet": {
        const indent = block.type === "bullet" ? 12 : 0;
        const lines = wrap(block.text, regular, BODY, width - indent);
        lines.forEach((line, i) => {
          ensure(LINE);
          if (block.type === "bullet" && i === 0) {
            page.drawText("•", { x: MARGIN, y: y - BODY, size: BODY, font: regular, color: ink });
          }
          page.drawText(line, {
            x: MARGIN + indent,
            y: y - BODY,
            size: BODY,
            font: regular,
            color: ink,
          });
          y -= LINE;
        });
        y -= 3;
        break;
      }
    }
  }

  const first = doc.getPage(0);
  const h = spec.hidden ?? {};
  if (h.whiteText) {
    for (const [i, line] of wrap(h.whiteText, regular, 8, width).entries()) {
      first.drawText(line, {
        x: MARGIN,
        y: 40 - i * 9,
        size: 8,
        font: regular,
        color: rgb(1, 1, 1),
      });
    }
  }
  if (h.tinyText) {
    first.drawText(h.tinyText, { x: MARGIN, y: 30, size: 1, font: regular, color: ink });
  }
  if (h.offPageText) {
    first.drawText(h.offPageText, { x: A4[0] + 40, y: 400, size: 10, font: regular, color: ink });
  }
  if (h.invisibleText) {
    first.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
    first.drawText(h.invisibleText, { x: MARGIN, y: 20, size: 9, font: regular, color: ink });
    first.pushOperators(popGraphicsState());
  }
  if (spec.photo) {
    const img = await doc.embedPng(makePng(40, 50, [150, 140, 130]));
    first.drawImage(img, {
      x: A4[0] - MARGIN - 80,
      y: A4[1] - MARGIN - 100,
      width: 80,
      height: 100,
    });
  }
  if (spec.logo) {
    const img = await doc.embedPng(makePng(40, 10, [30, 80, 120]));
    first.drawImage(img, {
      x: A4[0] - MARGIN - 120,
      y: A4[1] - MARGIN - 30,
      width: 120,
      height: 30,
    });
  }

  return new Uint8Array(await doc.save({ useObjectStreams: false }));
}

/** A page with nothing but an image, like a scanned resume. */
export async function buildImageOnlyPdf(): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const img = await doc.embedPng(makePng(60, 85, [235, 235, 235]));
  page.drawImage(img, { x: 0, y: 0, width: A4[0], height: A4[1] });
  return new Uint8Array(await doc.save());
}

/** N pages of plain filler text. */
export async function buildPagesPdf(pages: number): Promise<Uint8Array<ArrayBuffer>> {
  const blocks: Block[] = [];
  for (let p = 0; p < pages; p++) {
    if (p > 0) blocks.push({ type: "pageBreak" });
    blocks.push({ type: "heading", text: `Section ${p + 1}` });
    blocks.push({
      type: "text",
      text: "Delivered analytics projects for regional retail and logistics clients, working with stakeholders across Singapore and Malaysia. ".repeat(
        3,
      ),
    });
  }
  return buildResumePdf({ blocks });
}

// --- Password-protected PDF (Standard security handler, V1 / R2, 40-bit RC4) ---

const PASSWORD_PAD = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 255]!;
  }
  return out;
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const pad = (password: string) =>
  Buffer.concat([Buffer.from(password, "latin1"), PASSWORD_PAD]).subarray(0, 32);

/** A one-page PDF that needs the user password "secret" to open. */
export function buildEncryptedPdf(): Uint8Array<ArrayBuffer> {
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);

  const ownerKey = md5(pad("owner-secret")).subarray(0, 5);
  const O = rc4(ownerKey, pad("secret"));
  const fileKey = md5(pad("secret"), O, permissions, id).subarray(0, 5);
  const U = rc4(fileKey, PASSWORD_PAD);

  const objectKey = (num: number) =>
    md5(fileKey, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0])).subarray(
      0,
      10,
    );
  const content = rc4(
    objectKey(4),
    Buffer.from("BT /F1 12 Tf 72 720 Td (Confidential resume) Tj ET"),
  );

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, // content stream, written separately
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Filter /Standard /V 1 /R 2 /O <${O.toString("hex")}> /U <${U.toString("hex")}> /P -4 >>`,
  ];

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let length = chunks[0]!.length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const head = `${i + 1} 0 obj\n`;
    const part =
      body === null
        ? Buffer.concat([
            Buffer.from(`${head}<< /Length ${content.length} >>\nstream\n`, "latin1"),
            content,
            Buffer.from("\nendstream\nendobj\n", "latin1"),
          ])
        : Buffer.from(`${head}${body}\nendobj\n`, "latin1");
    chunks.push(part);
    length += part.length;
  });
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>] >>`,
    "startxref",
    String(length),
    "%%EOF\n",
  ].join("\n");
  chunks.push(Buffer.from(xref, "latin1"));
  return new Uint8Array(Buffer.concat(chunks));
}

/** A reusable, clean, one-page synthetic resume. */
export const SAMPLE_RESUME: Block[] = [
  { type: "name", text: "Alex Tan" },
  { type: "contact", text: "alex.tan@example.com · +65 8000 0000 · Singapore" },
  { type: "heading", text: "Summary" },
  {
    type: "text",
    text: "Data analyst with five years of experience in retail analytics, building reporting pipelines and dashboards that help teams make faster decisions.",
  },
  { type: "heading", text: "Experience" },
  { type: "role", text: "Data Analyst, Northwind Retail · 2022 – present" },
  {
    type: "bullet",
    text: "Automated weekly sales reporting in SQL and Tableau, cutting preparation time from two days to three hours.",
  },
  {
    type: "bullet",
    text: "Designed and analysed checkout A/B tests that informed a redesign of the payment step.",
  },
  { type: "role", text: "Analyst, Harbour Logistics · 2020 – 2022" },
  {
    type: "bullet",
    text: "Built Python scripts to reconcile shipment data across three warehouse systems.",
  },
  { type: "heading", text: "Education" },
  { type: "text", text: "BSc Statistics, Example University, 2020" },
  { type: "heading", text: "Skills" },
  { type: "text", text: "SQL, Python, Tableau, Excel, A/B testing, ETL pipelines" },
];
