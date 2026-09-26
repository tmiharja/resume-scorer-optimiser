"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AnalysisEvent, Step } from "@/schemas/events";
import type { IngestWarning } from "@/schemas/ingest";
import type { AnalysisResult } from "@/schemas/result";
import { readEvents } from "./sse";

export type StepStatus = "pending" | "started" | "done" | "error" | "skipped";

export type UiError =
  /** Upload rejected (client check or server 4xx): shown inline on the form. */
  | { kind: "validation"; message: string }
  | { kind: "rate_limited"; message: string; resetAt: string | null }
  | { kind: "unavailable"; message: string }
  | { kind: "not_resume"; message: string }
  | { kind: "failed"; message: string };

export type AnalysisState = {
  phase: "idle" | "running" | "done" | "error";
  file: File | null;
  jd: string;
  startedAt: number | null;
  steps: Record<Step, { status: StepStatus; durationMs?: number }>;
  warnings: IngestWarning[];
  result: AnalysisResult | null;
  error: UiError | null;
};

const freshSteps = (): AnalysisState["steps"] => ({
  parse: { status: "pending" },
  extract: { status: "pending" },
  critique: { status: "pending" },
  match: { status: "pending" },
  rewrite: { status: "pending" },
  verify: { status: "pending" },
});

const initial: AnalysisState = {
  phase: "idle",
  file: null,
  jd: "",
  startedAt: null,
  steps: freshSteps(),
  warnings: [],
  result: null,
  error: null,
};

type Action =
  | { type: "start"; file: File; jd: string }
  | { type: "event"; event: AnalysisEvent }
  | { type: "fail"; error: UiError }
  | { type: "cancel" }
  | { type: "reset" };

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case "start":
      return {
        ...initial,
        phase: "running",
        file: action.file,
        jd: action.jd,
        startedAt: Date.now(),
        steps: { ...freshSteps(), parse: { status: "started" } },
      };
    case "event": {
      const e = action.event;
      if (e.type === "step") {
        const steps = { ...state.steps, [e.step]: { status: e.status, durationMs: e.durationMs } };
        // Parsing covers upload + ingest (parse) and the Extractor (extract).
        if (e.step === "parse" && e.status === "done") steps.extract = { status: "started" };
        return { ...state, steps };
      }
      if (e.type === "warning") return { ...state, warnings: [...state.warnings, e.warning] };
      if (e.type === "result") return { ...state, phase: "done", result: e.result };
      return {
        ...state,
        phase: "error",
        error:
          e.code === "not_resume"
            ? { kind: "not_resume", message: e.message }
            : { kind: "failed", message: e.message },
      };
    }
    case "fail":
      // Validation and rate-limit errors return to the form; others get their own view.
      return action.error.kind === "validation" ||
        action.error.kind === "rate_limited" ||
        action.error.kind === "unavailable"
        ? { ...state, phase: "idle", error: action.error, startedAt: null }
        : { ...state, phase: "error", error: action.error };
    case "cancel":
      return { ...initial, file: state.file, jd: state.jd };
    case "reset":
      return initial;
  }
}

type ErrorBody = { error?: { code?: string; message?: string; resetAt?: string } };

function errorFromResponse(status: number, body: ErrorBody): UiError {
  const message = body.error?.message ?? "Something went wrong on our side. Please try again.";
  if (status === 429)
    return { kind: "rate_limited", message, resetAt: body.error?.resetAt ?? null };
  if (status === 503) return { kind: "unavailable", message };
  if (status >= 400 && status < 500 && status !== 403) return { kind: "validation", message };
  return { kind: "failed", message };
}

/** Drives one analysis: POST the upload, then fold the SSE stream into state. */
export function useAnalysis() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (file: File, jd: string) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    dispatch({ type: "start", file, jd });

    const form = new FormData();
    form.set("file", file, file.name);
    if (jd.trim()) form.set("jd", jd);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form, signal: abort.signal });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as ErrorBody;
        dispatch({ type: "fail", error: errorFromResponse(res.status, body) });
        return;
      }
      let finished = false;
      for await (const event of readEvents(res.body)) {
        dispatch({ type: "event", event });
        if (event.type === "result" || event.type === "error") finished = true;
      }
      if (!finished) {
        dispatch({
          type: "fail",
          error: {
            kind: "failed",
            message: "The connection dropped before the analysis finished.",
          },
        });
      }
    } catch (error) {
      if (abort.signal.aborted) return; // cancelled by the user
      void error;
      dispatch({
        type: "fail",
        error: {
          kind: "failed",
          message: "We couldn't reach the server. Check your connection and try again.",
        },
      });
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "cancel" });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, start, cancel, reset };
}
