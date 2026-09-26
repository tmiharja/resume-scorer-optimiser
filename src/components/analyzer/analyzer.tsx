"use client";

import { useEffect, type ReactNode } from "react";
import { useAnalysis } from "@/lib/use-analysis";
import ErrorView from "./error-view";
import Notice from "./notice";
import ProgressView from "./progress-view";
import ResultsView from "./results-view";
import UploadForm from "./upload-form";

function resetTime(iso: string | null) {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const mins = Math.max(1, Math.round((at.getTime() - Date.now()) / 60_000));
  const time = at.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
  const wait = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
  return `${time} (in ${wait})`;
}

/**
 * The whole app flow on one page: landing + upload → live progress → results
 * (or an error view). The results state widens the page column to 760px.
 */
export default function Analyzer({
  hero,
  landing,
  dailyLimit,
}: {
  /** Headline + lead, rendered inside the hero band. */
  hero: ReactNode;
  /** Static "How it works" / "What we score" sections. */
  landing: ReactNode;
  dailyLimit: number;
}) {
  const { state, start, cancel, reset } = useAnalysis();
  const error = state.error;

  useEffect(() => {
    const root = document.documentElement;
    if (state.phase === "done") root.dataset.view = "results";
    else delete root.dataset.view;
    window.scrollTo({ top: 0 });
    return () => {
      delete root.dataset.view;
    };
  }, [state.phase]);

  if (state.phase === "running") return <ProgressView state={state} onCancel={cancel} />;
  if (state.phase === "done" && state.result) {
    return (
      <ResultsView
        result={state.result}
        fileName={state.file?.name ?? "your resume"}
        onReset={reset}
      />
    );
  }
  if (
    state.phase === "error" &&
    error &&
    (error.kind === "not_resume" || error.kind === "failed")
  ) {
    return (
      <ErrorView
        error={error}
        fileName={state.file?.name ?? ""}
        onRetry={() => state.file && start(state.file, state.jd)}
        onReset={reset}
      />
    );
  }

  const limited = error?.kind === "rate_limited" || error?.kind === "unavailable";
  return (
    <>
      {hero}
      <div className="page-col">
        {error?.kind === "rate_limited" && (
          // The server's message states the real limit ("You've used today's 5 free analyses.").
          <Notice tone="info" role="status" title={error.message} className="mt-2">
            <p>
              {resetTime(error.resetAt)
                ? `You can analyse again after ${resetTime(error.resetAt)}.`
                : "You can analyse again tomorrow."}{" "}
              Limits keep this tool free for everyone.
            </p>
          </Notice>
        )}
        {error?.kind === "unavailable" && (
          <Notice tone="info" role="status" title="The analyser is taking a break" className="mt-2">
            <p>{error.message}</p>
          </Notice>
        )}
        <UploadForm
          key={state.file ? `${state.file.name}-${state.file.size}` : "empty"}
          onSubmit={start}
          serverError={error?.kind === "validation" ? error.message : null}
          disabled={limited}
          initialFile={error?.kind === "validation" ? null : state.file}
          initialJd={state.jd}
          dailyLimit={dailyLimit}
        />
        {landing}
      </div>
    </>
  );
}
