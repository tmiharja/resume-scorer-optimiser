import type { AnalysisResult } from "@/schemas/result";
import CopyButton from "./copy-button";

/** Renders suggested text with [placeholders] highlighted. */
function WithPlaceholders({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]\n]{1,24}\])/g).map((part, i) =>
        /^\[[^\]]+\]$/.test(part) ? (
          <mark key={i} className="rounded bg-accent-soft px-1 font-semibold text-accent">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

const Label = ({ children, accent = false }: { children: string; accent?: boolean }) => (
  <p
    className={`text-[11px] font-bold tracking-[0.08em] uppercase ${accent ? "text-accent" : "text-muted"}`}
  >
    {children}
  </p>
);

export default function RewritesList({
  rewrites,
}: {
  rewrites: NonNullable<AnalysisResult["rewrites"]>;
}) {
  if (rewrites.items.length === 0) {
    return (
      <p className="text-muted">
        No rewrites passed our fact check this time, so we&apos;re not showing any. Your scores and
        feedback are unaffected.
      </p>
    );
  }
  return (
    <>
      <p className="text-muted">
        Replace placeholders like{" "}
        <mark className="rounded bg-accent-soft px-1 font-semibold text-accent">[X%]</mark> with
        your real numbers. We never add facts that aren&apos;t in your resume.
      </p>
      <ul className="mt-5 border-t border-rule">
        {rewrites.items.map((r) => (
          <li key={r.bulletId} className="border-b border-rule py-5">
            <Label>Original</Label>
            <p className="mt-1 text-muted">{r.original}</p>
            <p className="mt-0.5 text-[13px] text-muted">{r.context}</p>
            <div className="mt-3 flex flex-col items-start gap-2.5 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Label accent>Suggested</Label>
                <p className="mt-1">
                  <WithPlaceholders text={r.suggested} />
                </p>
                <p className="mt-1 text-[13px] text-muted">{r.rationale}</p>
              </div>
              <CopyButton text={r.suggested} label="suggested bullet" />
            </div>
          </li>
        ))}
      </ul>
      {rewrites.droppedCount > 0 && (
        <p className="mt-3 text-[13px] text-muted">
          {rewrites.droppedCount} suggestion{rewrites.droppedCount === 1 ? " was" : "s were"}{" "}
          removed because {rewrites.droppedCount === 1 ? "it" : "they"} added details that
          aren&apos;t in your resume.
        </p>
      )}
    </>
  );
}
