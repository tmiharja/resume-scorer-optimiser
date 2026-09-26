import type { AnalysisResult } from "@/schemas/result";

function Chips({ items, missing = false }: { items: string[]; missing?: boolean }) {
  return (
    <ul className="mt-2.5 flex flex-wrap gap-2">
      {items.map((k) => (
        <li
          key={k}
          className={
            missing
              ? "rounded-full border border-dashed border-muted px-2.5 py-1 text-[13px] text-muted"
              : "rounded-full bg-accent-soft px-2.5 py-1 text-[13px] text-accent"
          }
        >
          {k}
        </li>
      ))}
    </ul>
  );
}

const SubHeading = ({ children }: { children: string }) => (
  <h3 className="mt-7 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
    {children}
  </h3>
);

export default function JdMatch({ match }: { match: NonNullable<AnalysisResult["jdMatch"]> }) {
  return (
    <>
      {/* The overall score is the page's one hero figure; this one is secondary. */}
      <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className="text-3xl font-medium tracking-tight">{match.matchScore}%</span>
        <span className="text-muted">{match.summary}</span>
      </p>
      {match.matchedKeywords.length > 0 && (
        <>
          <SubHeading>{`Matched · ${match.matchedKeywords.length}`}</SubHeading>
          <Chips items={match.matchedKeywords} />
        </>
      )}
      {match.missingKeywords.length > 0 && (
        <>
          <SubHeading>{`Missing · ${match.missingKeywords.length}`}</SubHeading>
          <Chips items={match.missingKeywords} missing />
        </>
      )}
      {match.tailoringPriorities.length > 0 && (
        <>
          <SubHeading>Top priorities</SubHeading>
          <ol className="mt-2.5 space-y-2">
            {match.tailoringPriorities.map((p, i) => (
              <li key={p} className="flex gap-3">
                <span className="w-3.5 shrink-0 text-muted tabular-nums">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {match.experienceGaps.length > 0 && (
        <>
          <SubHeading>Experience gaps</SubHeading>
          <ul className="mt-2.5 list-disc space-y-1.5 pl-5">
            {match.experienceGaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
