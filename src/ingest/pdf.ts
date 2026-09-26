import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { IngestError } from "./errors";
import { INGEST_TIMEOUT_MS, MAX_PAGES } from "./limits";

/**
 * In-memory PDF parsing with pdf.js (via unpdf). Nothing is written to disk.
 *
 * Two views of each page are collected:
 * - `items`: pdf.js text content, which has good reading order and spacing and
 *   becomes the text the LLM sees.
 * - `runs`: one entry per text-showing operator, with the graphics state
 *   pdf.js text content doesn't expose (fill colour, opacity, render mode,
 *   effective size, position). Hidden-text heuristics work on these.
 * pdf.js also silently drops off-page text from `items`, so off-page text is
 * only visible in `runs`.
 */

export type TextItem = { str: string; hasEOL: boolean; fontSize: number };

export type TextRun = {
  text: string;
  /** Perceived brightness of the fill colour, 0 (black) – 1 (white). */
  brightness: number;
  fillAlpha: number;
  renderMode: number;
  fontSize: number;
  x: number;
  y: number;
};

export type DrawnImage = { width: number; height: number };

export type ParsedPage = {
  /** Page box [x0, y0, x1, y1] in PDF points. */
  view: [number, number, number, number];
  items: TextItem[];
  runs: TextRun[];
  images: DrawnImage[];
};

export type ParsedPdf = { pageCount: number; pages: ParsedPage[] };

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  // Returns m × n in PDF's row-vector convention: apply m, then n.
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function toMatrix(value: unknown): Matrix | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<number, unknown>;
  const m = [0, 1, 2, 3, 4, 5].map((i) => Number(v[i]));
  return m.every(Number.isFinite) ? (m as Matrix) : undefined;
}

function brightnessOf(hex: unknown): number {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function glyphText(glyphs: unknown): string {
  if (!Array.isArray(glyphs)) return "";
  let out = "";
  for (const g of glyphs) {
    if (g && typeof g === "object" && "unicode" in g) {
      out += String((g as { unicode: unknown }).unicode ?? "");
    } else if (typeof g === "number" && g < -250) {
      // Large negative TJ adjustments are how many generators encode spaces.
      out += " ";
    }
  }
  return out;
}

type GraphicsState = {
  ctm: Matrix;
  fill: number;
  alpha: number;
  renderMode: number;
};

type Ops = Record<string, number>;

async function parsePage(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>,
  OPS: Ops,
): Promise<ParsedPage> {
  const view = page.view.map(Number) as ParsedPage["view"];
  const [opList, content] = await Promise.all([page.getOperatorList(), page.getTextContent()]);

  const items: TextItem[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const t = item.transform as number[];
    items.push({
      str: item.str,
      hasEOL: item.hasEOL,
      fontSize: Math.hypot(t[2] ?? 0, t[3] ?? 0),
    });
  }

  const runs: TextRun[] = [];
  const images: DrawnImage[] = [];
  const stack: GraphicsState[] = [];
  let gs: GraphicsState = { ctm: IDENTITY, fill: 0, alpha: 1, renderMode: 0 };
  let fontSize = 0;
  let leading = 0;
  let textMatrix: Matrix = IDENTITY;
  let lineMatrix: Matrix = IDENTITY;

  const moveText = (tx: number, ty: number) => {
    lineMatrix = multiply([1, 0, 0, 1, tx, ty], lineMatrix);
    textMatrix = lineMatrix;
  };
  const show = (glyphs: unknown) => {
    const text = glyphText(glyphs);
    if (!text.trim()) return;
    const m = multiply(textMatrix, gs.ctm);
    runs.push({
      text,
      brightness: gs.fill,
      fillAlpha: gs.alpha,
      renderMode: gs.renderMode,
      fontSize: Math.abs(fontSize) * Math.hypot(m[2], m[3]),
      x: m[4],
      y: m[5],
    });
  };

  const { fnArray, argsArray } = opList;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = (argsArray[i] ?? []) as unknown[];
    switch (fn) {
      case OPS.save:
        stack.push({ ...gs });
        break;
      case OPS.restore:
        gs = stack.pop() ?? gs;
        break;
      case OPS.transform: {
        const m = toMatrix(args);
        if (m) gs = { ...gs, ctm: multiply(m, gs.ctm) };
        break;
      }
      case OPS.paintFormXObjectBegin: {
        stack.push({ ...gs });
        const m = toMatrix(args[0]);
        if (m) gs = { ...gs, ctm: multiply(m, gs.ctm) };
        break;
      }
      case OPS.paintFormXObjectEnd:
        gs = stack.pop() ?? gs;
        break;
      case OPS.setFillRGBColor:
        gs = { ...gs, fill: brightnessOf(args[0]) };
        break;
      case OPS.setGState: {
        for (const entry of (args[0] as unknown[]) ?? []) {
          if (Array.isArray(entry) && entry[0] === "ca" && typeof entry[1] === "number") {
            gs = { ...gs, alpha: entry[1] };
          }
        }
        break;
      }
      case OPS.setTextRenderingMode:
        gs = { ...gs, renderMode: Number(args[0]) || 0 };
        break;
      case OPS.beginText:
        textMatrix = IDENTITY;
        lineMatrix = IDENTITY;
        break;
      case OPS.setFont:
        fontSize = Number(args[1]) || 0;
        break;
      case OPS.setLeading:
        leading = Number(args[0]) || 0;
        break;
      case OPS.setTextMatrix: {
        const m = toMatrix(args[0]) ?? toMatrix(args);
        if (m) {
          textMatrix = m;
          lineMatrix = m;
        }
        break;
      }
      case OPS.moveText:
        moveText(Number(args[0]) || 0, Number(args[1]) || 0);
        break;
      case OPS.setLeadingMoveText:
        leading = -(Number(args[1]) || 0);
        moveText(Number(args[0]) || 0, Number(args[1]) || 0);
        break;
      case OPS.nextLine:
        moveText(0, -leading);
        break;
      case OPS.showText:
      case OPS.showSpacedText:
        show(args[0]);
        break;
      case OPS.nextLineShowText:
        moveText(0, -leading);
        show(args[0]);
        break;
      case OPS.nextLineSetSpacingShowText:
        moveText(0, -leading);
        show(args[2]);
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        images.push({
          width: Math.hypot(gs.ctm[0], gs.ctm[1]),
          height: Math.hypot(gs.ctm[2], gs.ctm[3]),
        });
        break;
    }
  }

  return { view, items, runs, images };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new IngestError("unreadable_pdf")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Parses PDF bytes in memory. Rejects encrypted, oversized-by-pages and
 * unreadable files with an IngestError; never logs or persists content.
 */
export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  const { OPS } = (await getResolvedPDFJS()) as unknown as { OPS: Ops };

  const run = async (): Promise<ParsedPdf> => {
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
    try {
      // pdf.js may transfer (detach) the buffer it's given, so hand it a copy.
      // pdf.js 6 has no eval-based font path (the CVE-2024-4367 vector), so there's
      // no isEvalSupported switch to set; fonts aren't loaded into any page either.
      pdf = await getDocumentProxy(bytes.slice(), {
        disableFontFace: true,
        // Errors only: pdf.js warnings (e.g. missing standard-font metrics, which
        // don't affect text extraction) would otherwise flood server logs.
        verbosity: 0,
        useSystemFonts: false,
        stopAtErrors: false,
        // Skip decoding very large images; they aren't needed for text or size checks.
        maxImageSize: 4096 * 4096,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "PasswordException") throw new IngestError("encrypted_pdf");
      throw new IngestError("unreadable_pdf");
    }

    try {
      if (pdf.numPages > MAX_PAGES) {
        throw new IngestError("too_many_pages", { pages: pdf.numPages });
      }
      const pages: ParsedPage[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        pages.push(await parsePage(await pdf.getPage(n), OPS));
      }
      return { pageCount: pdf.numPages, pages };
    } catch (error) {
      if (error instanceof IngestError) throw error;
      throw new IngestError("unreadable_pdf");
    } finally {
      await pdf.loadingTask.destroy().catch(() => undefined);
    }
  };

  return withTimeout(run(), INGEST_TIMEOUT_MS);
}
