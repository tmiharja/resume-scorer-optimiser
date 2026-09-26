"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { UiError } from "@/lib/use-analysis";

export default function ErrorView({
  error,
  fileName,
  onRetry,
  onReset,
}: {
  error: Extract<UiError, { kind: "not_resume" | "failed" }>;
  fileName: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const notResume = error.kind === "not_resume";

  return (
    <div className="page-col pt-32 pb-10 sm:pt-36" role="alert">
      <p className="truncate text-sm text-muted">{fileName}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-3xl font-medium tracking-tight outline-none"
      >
        {notResume ? "This doesn't look like a resume" : "We couldn't finish the analysis"}
      </h1>
      <p className="mt-2.5 text-muted">
        {notResume
          ? `${error.message.replace(/^This doesn't look like a resume\.\s*/, "")} Upload a resume or CV as a PDF to get feedback.`.trim()
          : `${error.message} This is on our side, not your file.`}
      </p>
      <div className="mt-6 flex flex-col gap-3.5 sm:flex-row sm:items-center">
        {notResume ? (
          <Button onClick={onReset} className="w-full sm:w-auto">
            Try another file
          </Button>
        ) : (
          <>
            <Button onClick={onRetry} className="w-full sm:w-auto">
              Try again
            </Button>
            <button
              type="button"
              onClick={onReset}
              className="link self-center text-sm sm:self-auto"
            >
              Start over
            </button>
          </>
        )}
      </div>
    </div>
  );
}
