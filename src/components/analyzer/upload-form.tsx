"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_JD_CHARS } from "@/ingest/limits";
import { checkFile, checkJd, formatBytes } from "@/lib/client-validate";
import { cn } from "@/lib/utils";
import PrivacyNotice from "./privacy-notice";

type Props = {
  onSubmit: (file: File, jd: string) => void;
  /** Server-side rejection of the last upload, shown against the file. */
  serverError: string | null;
  disabled?: boolean;
  initialFile: File | null;
  initialJd: string;
  dailyLimit: number;
};

export default function UploadForm({
  onSubmit,
  serverError,
  disabled = false,
  initialFile,
  initialJd,
  dailyLimit,
}: Props) {
  const ids = {
    file: useId(),
    fileHelp: useId(),
    fileError: useId(),
    jd: useId(),
    jdHelp: useId(),
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileError, setFileError] = useState<string | null>(null);
  const [jd, setJd] = useState(initialJd);
  const [dragging, setDragging] = useState(false);

  const jdError = checkJd(jd);
  const shownFileError = fileError ?? (file === initialFile ? serverError : null);

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const problem = checkFile(picked);
    setFileError(problem);
    setFile(problem ? null : picked);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) choose(e.dataTransfer.files[0]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (file && !jdError && !disabled) onSubmit(file, jd);
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Analyse your resume" className="mt-8">
      <input
        ref={inputRef}
        id={ids.file}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-rule px-4 py-3.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-7 shrink-0 items-end justify-center rounded border border-rule pb-1 text-[9px] font-bold text-muted"
          >
            PDF
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate">{file.name}</p>
            <p className="text-[13px] text-muted">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            className="link text-sm"
            onClick={() => {
              setFile(null);
              setFileError(null);
            }}
          >
            Remove<span className="sr-only"> {file.name}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-describedby={`${ids.fileHelp}${shownFileError ? ` ${ids.fileError}` : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "block w-full rounded-[10px] border-[1.5px] border-dashed px-5 py-9 text-center transition-colors disabled:opacity-45",
            shownFileError
              ? "border-danger"
              : dragging
                ? "border-accent bg-accent-soft"
                : "border-rule",
            !disabled && "hover:bg-accent-soft/60",
          )}
        >
          <span className="block text-base">
            Drop your resume here, or{" "}
            <span className="text-accent underline underline-offset-4">browse files</span>
          </span>
          <span id={ids.fileHelp} className="mt-1.5 block text-[13px] text-muted">
            PDF only · up to 4 MB · up to 4 pages
          </span>
        </button>
      )}
      {shownFileError && (
        <p id={ids.fileError} role="alert" className="mt-2.5 text-sm text-danger">
          {shownFileError}
        </p>
      )}

      <div className="mt-7">
        <Label htmlFor={ids.jd}>
          Job description <span className="font-normal text-muted">(optional)</span>
        </Label>
        <Textarea
          id={ids.jd}
          value={jd}
          disabled={disabled}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job ad here"
          aria-describedby={ids.jdHelp}
          aria-invalid={jdError ? true : undefined}
          className="mt-2"
          rows={6}
        />
        <div id={ids.jdHelp} className="mt-1.5 flex justify-between gap-4 text-xs text-muted">
          <span className={jdError ? "text-danger" : undefined}>
            {jdError ?? "Adds a match score and tailors the rewrites"}
          </span>
          <span className={cn("tabular-nums", jdError && "text-danger")}>
            {jd.trim().length.toLocaleString("en-SG")} / {MAX_JD_CHARS.toLocaleString("en-SG")}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3.5 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={!file || Boolean(jdError) || disabled}
          className="w-full sm:w-auto"
        >
          Analyse resume
        </Button>
        <span className="text-[13px] text-muted">
          {dailyLimit > 0 ? `${dailyLimit} free analyses a day` : "Free to use"}
        </span>
      </div>

      <PrivacyNotice />
    </form>
  );
}
