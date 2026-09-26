/**
 * Overall score: the page's one hero figure (dataviz: ≥48px, proportional
 * digits), inside a single-value ring. The number is real text, so the ring is
 * decorative for assistive tech.
 */
export default function ScoreRing({ score }: { score: number }) {
  const r = 58;
  const circumference = 2 * Math.PI * r;
  const filled = (circumference * Math.max(0, Math.min(100, score))) / 100;
  return (
    <div className="relative size-[132px] shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" className="-rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--accent-track)" strokeWidth="6" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <p className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl leading-none font-medium tracking-tight">{score}</span>
        <span className="mt-1 text-xs text-muted">out of 100</span>
      </p>
    </div>
  );
}
