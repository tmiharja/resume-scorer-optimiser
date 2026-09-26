import type { AnalysisResult } from "@/schemas/result";
import { cn } from "@/lib/utils";

const SEVERITY = {
  high: { label: "High", className: "text-danger" },
  medium: { label: "Medium", className: "text-warn" },
  low: { label: "Low", className: "text-muted" },
} as const;

function summary(items: AnalysisResult["dimensions"][number]["items"]) {
  if (items.length === 0) return "No issues";
  const highs = items.filter((i) => i.severity === "high").length;
  return `${items.length} issue${items.length === 1 ? "" : "s"}${highs ? ` · ${highs} high` : ""}`;
}

/** Feedback grouped by dimension; the lowest-scoring dimension starts open. */
export default function FeedbackList({
  dimensions,
  weakest,
}: {
  dimensions: AnalysisResult["dimensions"];
  weakest: AnalysisResult["weakest"];
}) {
  const ordered = [...dimensions].sort((a, b) => a.score - b.score);
  return (
    <div className="border-t border-rule">
      {ordered.map((d) => (
        <details key={d.key} open={d.key === weakest} className="group border-b border-rule">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-3.5 shrink-0 text-muted transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            <span className="flex-1 font-medium">{d.label}</span>
            <span className="text-[13px] text-muted">{summary(d.items)}</span>
            <span className="w-7 text-right tabular-nums">{d.score}</span>
          </summary>
          {d.items.length === 0 ? (
            <p className="pb-4 pl-[26px] text-muted">Nothing to fix here.</p>
          ) : (
            <ul>
              {d.items.map((item, i) => (
                <li key={i} className="border-t border-rule py-4 pl-[26px]">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase",
                      SEVERITY[item.severity].className,
                    )}
                  >
                    <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
                    {SEVERITY[item.severity].label}
                    <span className="sr-only"> priority</span>
                  </span>
                  <p className="mt-1 font-medium">{item.issue}</p>
                  <p className="mt-1 text-muted">{item.fix}</p>
                  {item.citation && (
                    <p className="mt-2 border-l-2 border-rule pl-2.5 text-[13px] text-muted">
                      {item.citation}
                      {item.quote && (
                        <>
                          <br />“{item.quote}”
                        </>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </div>
  );
}
