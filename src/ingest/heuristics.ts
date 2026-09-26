import type { IngestReport, IngestWarning, IngestWarningKind } from "@/schemas/ingest";
import { IngestError } from "./errors";
import { HEURISTICS as H, MAX_PAGES, MAX_VISIBLE_CHARS } from "./limits";
import type { ParsedPage, ParsedPdf, TextRun } from "./pdf";
import { detectSgPersonalData, findNrics } from "./sg-pii";

type HiddenKind = Extract<
  IngestWarningKind,
  "invisible_render_mode" | "hidden_white_text" | "tiny_font" | "off_page_text"
>;

/** Why a run is hidden from a human reader, or null if it's visible. */
export function hiddenReason(run: TextRun, view: ParsedPage["view"]): HiddenKind | null {
  // Modes 3 (invisible) and 7 (clip only) paint nothing.
  if (run.renderMode === 3 || run.renderMode === 7 || run.fillAlpha <= H.transparentAlpha) {
    return "invisible_render_mode";
  }
  // Assumes a white page background, which holds for almost all resumes
  // (documented limitation: coloured designs may produce false positives).
  if (run.brightness >= H.whiteBrightness) return "hidden_white_text";
  if (run.fontSize > 0 && run.fontSize < H.tinyFontPt) return "tiny_font";
  const [x0, y0, x1, y1] = view;
  const t = H.offPageTolerancePt;
  if (run.x < x0 - t || run.x > x1 + t || run.y < y0 - t || run.y > y1 + t) return "off_page_text";
  return null;
}

const normalise = (s: string) => s.normalize("NFKC");
// C0 controls except \n, DEL, zero-width marks, line/paragraph separators, BOM.
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0009\\u000b-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029\\ufeff]",
  "g",
);
const isSpace = (c: string) => /\s/.test(c);

/**
 * Marks which characters of each pdf.js text item are hidden, by aligning the
 * item's non-space characters with the operator-list runs (both follow content
 * stream order). Items that can't be aligned are treated as visible; the
 * Extractor's own injection check is the backstop for anything missed.
 */
function alignHidden(page: ParsedPage, reasons: (HiddenKind | null)[]): boolean[][] {
  const stream: { c: string; hidden: boolean }[] = [];
  page.runs.forEach((run, i) => {
    for (const c of normalise(run.text)) {
      if (!isSpace(c)) stream.push({ c, hidden: reasons[i] !== null });
    }
  });

  let cursor = 0;
  return page.items.map((item) => {
    const chars = [...normalise(item.str)];
    const solid = chars.filter((c) => !isSpace(c));
    const flags = chars.map(() => false);
    if (solid.length === 0) return flags;

    const probe = solid.slice(0, 8).join("");
    const matchesAt = (at: number) =>
      stream
        .slice(at, at + Math.min(8, solid.length))
        .map((s) => s.c)
        .join("") === probe;

    let start = -1;
    for (let at = cursor; at < Math.min(stream.length, cursor + 4000); at++) {
      if (matchesAt(at)) {
        start = at;
        break;
      }
    }
    if (start === -1) return flags;

    let k = start;
    chars.forEach((c, j) => {
      if (isSpace(c)) return;
      flags[j] = stream[k]?.hidden ?? false;
      k++;
    });
    // A space takes the flag of the character before it, so hidden phrases vanish whole.
    chars.forEach((c, j) => {
      if (isSpace(c) && j > 0) flags[j] = flags[j - 1] ?? false;
    });
    cursor = k;
    return flags;
  });
}

function clean(text: string): string {
  return (
    text
      .normalize("NFKC")
      // Control and zero-width characters never belong in resume text.
      .replace(CONTROL_CHARS, " ")
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

const excerpt = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > H.evidenceChars ? `${flat.slice(0, H.evidenceChars - 1)}…` : flat;
};

/** Consecutive hidden runs of the same kind become one finding. */
function hiddenFindings(
  page: ParsedPage,
  pageNo: number,
  reasons: (HiddenKind | null)[],
): IngestWarning[] {
  const out: IngestWarning[] = [];
  let current: { kind: HiddenKind; text: string } | null = null;
  const flush = () => {
    if (current && current.text.trim()) {
      out.push({ kind: current.kind, page: pageNo, evidence: maskAll(excerpt(current.text)) });
    }
    current = null;
  };
  page.runs.forEach((run, i) => {
    const kind = reasons[i] ?? null;
    if (!kind) return flush();
    if (current?.kind === kind) current.text += ` ${run.text}`;
    else {
      flush();
      current = { kind, text: run.text };
    }
  });
  flush();
  return out;
}

const maskAll = (text: string) =>
  text.replace(/\b[STFGM]\d{7}[A-Z]\b/gi, (m) => `${m[0]}••••${m.slice(5)}`);

/** Blocks of comma/pipe-separated keyword lists that are unusually long or repetitive. */
function keywordStuffing(pageTexts: string[]): IngestWarning[] {
  const counts = new Map<string, number>();
  const out: IngestWarning[] = [];

  pageTexts.forEach((pageText, idx) => {
    let block: { terms: number; text: string } | null = null;
    const closeBlock = () => {
      if (block && block.terms >= H.keywordBlockTerms) {
        out.push({ kind: "keyword_stuffing", page: idx + 1, evidence: excerpt(block.text) });
      }
      block = null;
    };
    for (const line of pageText.split("\n")) {
      const parts = line
        .split(/[,|;•·]/)
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      const words = parts.map((p) => p.split(/\s+/).length).sort((x, y) => x - y);
      const median = words[Math.floor(words.length / 2)] ?? 0;
      if (parts.length < 6 || median > 3) {
        closeBlock();
        continue;
      }
      for (const part of parts) counts.set(part, (counts.get(part) ?? 0) + 1);
      block ??= { terms: 0, text: "" };
      block.terms += parts.length;
      block.text += ` ${line}`;
    }
    closeBlock();
  });

  const repeated = [...counts].filter(([term, n]) => n >= H.keywordRepeats && term.length > 1);
  if (repeated.length > 0) {
    const list = repeated.map(([term, n]) => `${term} (${n}×)`).join(", ");
    out.push({
      kind: "keyword_stuffing",
      page: 1,
      evidence: excerpt(`Repeated keywords: ${list}`),
    });
  }
  return out;
}

function likelyPhoto(page: ParsedPage | undefined): boolean {
  if (!page) return false;
  const [lo, hi] = H.photoAspect;
  return page.images.some(
    (img) =>
      img.width >= H.photoMinPt &&
      img.height >= H.photoMinPt &&
      img.width / img.height >= lo &&
      img.width / img.height <= hi,
  );
}

/**
 * Turns parsed pages into the in-memory IngestReport: visible text for the
 * LLM, plus user-facing warnings. Throws IngestError("image_only_pdf") when
 * there's no usable text.
 */
export function analysePdf(parsed: ParsedPdf): IngestReport {
  const warnings: IngestWarning[] = [];
  const pageTexts: string[] = [];

  parsed.pages.forEach((page, idx) => {
    const reasons = page.runs.map((run) => hiddenReason(run, page.view));
    const flags = alignHidden(page, reasons);
    let text = "";
    // Line breaks that belong to fully hidden lines are dropped too, so removing
    // hidden text leaves no gaps behind.
    let inHiddenLine = false;
    page.items.forEach((item, i) => {
      const chars = [...normalise(item.str)];
      const itemFlags = flags[i] ?? [];
      const solid = chars.map((c, j) => (isSpace(c) ? null : itemFlags[j]));
      const hasText = solid.some((f) => f !== null);
      if (hasText) inHiddenLine = solid.every((f) => f !== false);
      text += chars.filter((_, j) => !itemFlags[j]).join("");
      if (item.hasEOL && !inHiddenLine) text += "\n";
    });
    pageTexts.push(clean(text));
    warnings.push(...hiddenFindings(page, idx + 1, reasons));
  });

  const fullText = pageTexts.join("\n\n");
  const visibleChars = fullText.replace(/\s/g, "").length;
  if (visibleChars < H.minTextChars) throw new IngestError("image_only_pdf");

  warnings.push(...keywordStuffing(pageTexts));

  const nrics = findNrics(fullText);
  if (nrics.length > 0) {
    warnings.push({
      kind: "nric_detected",
      page: 1,
      evidence: `NRIC/FIN number found: ${nrics.join(", ")}`,
    });
  }
  const photoLikely = likelyPhoto(parsed.pages[0]);
  if (photoLikely) {
    warnings.push({
      kind: "photo_detected",
      page: 1,
      evidence: "A photo-sized image appears on page 1.",
    });
  }
  if (parsed.pageCount >= MAX_PAGES) {
    warnings.push({
      kind: "page_count_long",
      page: parsed.pageCount,
      evidence: `${parsed.pageCount} pages. Most Singapore resumes are 1–2 pages.`,
    });
  }

  const truncated = fullText.length > MAX_VISIBLE_CHARS;
  const visibleText = truncated ? fullText.slice(0, MAX_VISIBLE_CHARS) : fullText;

  return {
    pageCount: parsed.pageCount,
    visibleText,
    visibleChars,
    truncated,
    // Cap per kind so a pathological PDF can't flood the UI.
    warnings: capPerKind(warnings, 3),
    sgPersonalData: { ...detectSgPersonalData(visibleText), photoLikely },
  };
}

function capPerKind(warnings: IngestWarning[], max: number): IngestWarning[] {
  const seen = new Map<string, number>();
  return warnings.filter((w) => {
    const n = (seen.get(w.kind) ?? 0) + 1;
    seen.set(w.kind, n);
    return n <= max;
  });
}
