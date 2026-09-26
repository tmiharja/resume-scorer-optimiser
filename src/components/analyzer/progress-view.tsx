"use client";

import { useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/client-validate";
import type { AnalysisState, StepStatus } from "@/lib/use-analysis";
import { cn } from "@/lib/utils";
import WarningsNotice from "./warnings-notice";

type Row = {
  key: string;
  label: string;
  detail: string;
  status: StepStatus;
  ms?: number;
  parallel?: boolean;
};

function rows(state: AnalysisState): Row[] {
  const { steps } = state;
  // "Parsing" covers upload + PDF ingest and the Extractor.
  const parsing: StepStatus =
    steps.parse.status === "error" || steps.extract.status === "error"
      ? "error"
      : steps.extract.status === "done"
        ? "done"
        : "started";
  const list: Row[] = [
    {
      key: "parse",
      label: "Parsing",
      detail: parsing === "done" ? "Read and structured your resume" : "Reading your resume",
      status: parsing,
      ms: (steps.parse.durationMs ?? 0) + (steps.extract.durationMs ?? 0) || undefined,
    },
    {
      key: "critique",
      label: "Critiquing",
      detail: "Scoring 5 dimensions",
      status: steps.critique.status,
      ms: steps.critique.durationMs,
    },
  ];
  if (state.jd.trim()) {
    list.push({
      key: "match",
      label: "Matching job description",
      detail: "Running in parallel",
      status: steps.match.status,
      ms: steps.match.durationMs,
      parallel: true,
    });
  }
  list.push(
    {
      key: "rewrite",
      label: "Rewriting bullet points",
      detail: "Your weakest bullets",
      status: steps.rewrite.status,
      ms: steps.rewrite.durationMs,
    },
    {
      key: "verify",
      label: "Verifying rewrites",
      detail: "Checking every fact against your resume",
      status: steps.verify.status,
      ms: steps.verify.durationMs,
    },
  );
  return list;
}

function Marker({ status }: { status: StepStatus }) {
  if (status === "done")
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] text-accent-contrast"
        aria-hidden="true"
      >
        ✓
      </span>
    );
  if (status === "started")
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-accent"
        aria-hidden="true"
      >
        <span className="step-pulse size-2 rounded-full bg-accent" />
      </span>
    );
  if (status === "error")
    return (
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-background"
        aria-hidden="true"
      >
        !
      </span>
    );
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rule text-[11px] text-muted"
      aria-hidden="true"
    >
      {status === "skipped" ? "–" : ""}
    </span>
  );
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "waiting",
  started: "in progress",
  done: "done",
  error: "couldn't complete",
  skipped: "skipped",
};

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function ProgressView({
  state,
  onCancel,
}: {
  state: AnalysisState;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => headingRef.current?.focus(), []);

  const list = rows(state);
  const active = list.find((r) => r.status === "started");

  return (
    <div className="page-col pt-32 pb-10 sm:pt-36">
      <div className="flex items-baseline justify-between gap-3 text-sm text-muted">
        <span className="truncate">
          {state.file?.name}
          {state.file ? ` · ${formatBytes(state.file.size)}` : ""}
          {state.jd.trim() ? " · with job description" : ""}
        </span>
        <span className="tabular-nums" aria-label="Elapsed time">
          {clock(state.startedAt ? now - state.startedAt : 0)}
        </span>
      </div>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2.5 text-3xl font-medium tracking-tight outline-none"
      >
        Analysing your resume
      </h1>
      <p className="mt-2 text-muted">Usually about a minute. Keep this tab open.</p>

      <WarningsNotice warnings={state.warnings} className="mt-7" />

      <ol className="mt-7 border-t border-rule" aria-label="Progress">
        {list.map((row) => (
          <li
            key={row.key}
            className={cn(
              "flex items-center gap-3.5 border-b border-rule py-4",
              row.parallel && "ml-8 border-l [border-left-style:dashed] border-l-rule pl-3.5",
            )}
          >
            <Marker status={row.status} />
            <div className={cn("flex-1", row.status === "pending" && "text-muted")}>
              <p>
                {row.label}
                <span className="sr-only">: {STATUS_TEXT[row.status]}</span>
              </p>
              {row.status !== "pending" && (
                <p className="text-[13px] text-muted">
                  {row.status === "skipped"
                    ? "Skipped"
                    : row.status === "error"
                      ? "Couldn't complete. Continuing without it."
                      : row.detail}
                </p>
              )}
            </div>
            {row.ms !== undefined && row.status === "done" && (
              <span className="text-[13px] text-muted tabular-nums">
                {(row.ms / 1000).toFixed(1)} s
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {active ? `${active.label} in progress` : ""}
      </p>

      <p className="mt-5 text-sm">
        <button type="button" onClick={onCancel} className="link">
          Cancel
        </button>
        <span className="text-muted"> · cancelling still uses one of today&apos;s analyses</span>
      </p>
    </div>
  );
}
