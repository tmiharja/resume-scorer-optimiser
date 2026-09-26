import { useState } from "react";
import { HIDDEN_TEXT_KINDS, type IngestWarning } from "@/schemas/ingest";
import Notice from "./notice";

const isHidden = (w: IngestWarning) => (HIDDEN_TEXT_KINDS as readonly string[]).includes(w.kind);

/**
 * The red-flag card: hidden text found in the PDF, or text that reads like
 * instructions to an AI. Shown during progress and on results.
 */
export default function WarningsNotice({
  warnings,
  injectionEvidence = [],
  className,
}: {
  warnings: IngestWarning[];
  injectionEvidence?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = warnings.filter(isHidden);
  if (hidden.length === 0 && injectionEvidence.length === 0) return null;

  const findings = [...hidden.map((w) => w.evidence), ...injectionEvidence];
  const first = findings[0] ?? "";
  const quote = first.length > 90 ? `${first.slice(0, 89)}…` : first;

  return (
    <Notice
      tone="warn"
      role="status"
      className={className}
      title={
        hidden.length
          ? "Your PDF contains hidden text"
          : "Your resume contains instructions aimed at AI screening"
      }
    >
      <p>
        {hidden.length
          ? "We found text that isn't visible on the page"
          : "Some text reads like instructions to an automated screener"}
        {quote ? <>: “{quote}”</> : null}. Applicant tracking systems and recruiters often flag
        this. Remove it before applying. Your scores ignore it.
      </p>
      {findings.length > 1 && (
        <>
          <button
            type="button"
            className="link text-[13px]"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide findings" : `Show all ${findings.length} findings`}
          </button>
          {open && (
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              {findings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </Notice>
  );
}
