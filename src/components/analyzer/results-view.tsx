"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Reveal from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { DIMENSION_LABELS } from "@/schemas/critique";
import type { AnalysisResult } from "@/schemas/result";
import DimensionBars from "./dimension-bars";
import FeedbackList from "./feedback-list";
import JdMatch from "./jd-match";
import Notice from "./notice";
import RewritesList from "./rewrites-list";
import ScoreRing from "./score-ring";
import WarningsNotice from "./warnings-notice";

function Section({
  id,
  title,
  badge,
  children,
}: {
  id: string;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-[72px]">
      <Reveal>
        <h2
          id={id}
          className="mb-6 flex items-center gap-2.5 text-2xl font-semibold tracking-tight"
        >
          {title}
          {badge}
        </h2>
        {children}
      </Reveal>
    </section>
  );
}

export default function ResultsView({
  result,
  fileName,
  onReset,
}: {
  result: AnalysisResult;
  fileName: string;
  onReset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="page-col pt-32 pb-10 sm:pt-36">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-muted">Results · {fileName}</span>
        <button type="button" onClick={onReset} className="link shrink-0">
          Analyse another
        </button>
      </div>

      {result.notices.length > 0 && (
        <Notice tone="warn" title="Some parts couldn't be completed" className="mt-5">
          {result.notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </Notice>
      )}
      <WarningsNotice
        warnings={result.warnings}
        injectionEvidence={result.injection.suspected ? result.injection.evidence : []}
        className="mt-5"
      />

      <Reveal>
        <div className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing score={result.overall} />
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-3xl font-medium tracking-tight outline-none"
            >
              <span className="sr-only">Overall score {result.overall} out of 100. </span>
              {result.verdict}
            </h1>
            <p className="mt-2 text-muted">
              Strongest: {DIMENSION_LABELS[result.strongest].toLowerCase()}. Biggest opportunity:{" "}
              {DIMENSION_LABELS[result.weakest].toLowerCase()}.
            </p>
          </div>
        </div>
        <DimensionBars dimensions={result.dimensions} />
      </Reveal>

      <Section id="match-heading" title="Job match">
        {result.jdMatch ? (
          <JdMatch match={result.jdMatch} />
        ) : (
          <p className="text-muted">
            {result.jdProvided
              ? "We couldn't complete the job match this time."
              : "Add a job description next time to see how well you match a specific role."}
          </p>
        )}
      </Section>

      <Section id="feedback-heading" title="Feedback">
        <FeedbackList dimensions={result.dimensions} weakest={result.weakest} />
      </Section>

      <Section
        id="rewrites-heading"
        title="Suggested rewrites"
        badge={
          result.rewrites && !result.rewrites.verified ? (
            <span className="rounded border border-warn px-1.5 py-px text-[11px] font-bold tracking-[0.06em] text-warn uppercase">
              Unverified
            </span>
          ) : undefined
        }
      >
        {result.rewrites ? (
          <RewritesList rewrites={result.rewrites} />
        ) : (
          <p className="text-muted">
            Rewrites couldn&apos;t be generated this time. Your scores are unaffected.
          </p>
        )}
      </Section>

      <div className="mt-14">
        <Button variant="secondary" onClick={onReset} className="w-full sm:w-auto">
          Analyse another resume
        </Button>
      </div>
    </div>
  );
}
