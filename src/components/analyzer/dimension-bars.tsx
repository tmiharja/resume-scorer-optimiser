import { DIMENSION_WEIGHTS } from "@/prompts/rubric-sg";
import type { AnalysisResult } from "@/schemas/result";

/**
 * Five dimension scores as horizontal bars: one accent hue on a lighter track
 * of the same hue, 6px thick with a 4px rounded data end (square at the
 * baseline). Every value is also printed, so the bars never gate the data.
 */
export default function DimensionBars({
  dimensions,
}: {
  dimensions: AnalysisResult["dimensions"];
}) {
  return (
    <ul className="mt-8 border-t border-rule" aria-label="Scores by dimension">
      {dimensions.map((d) => (
        <li
          key={d.key}
          title={`${d.label}: ${d.score} out of 100 (${DIMENSION_WEIGHTS[d.key]}% of the overall score)`}
          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-b border-rule py-3.5 sm:grid-cols-[200px_1fr_44px]"
        >
          <span className="text-[15px]">{d.label}</span>
          <span
            role="img"
            aria-label={`${d.score} out of 100`}
            className="relative col-span-2 row-start-2 h-1.5 rounded-r bg-accent-track sm:col-span-1 sm:row-start-auto"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${d.score}%` }}
            />
          </span>
          <span
            className="text-right font-medium tabular-nums sm:col-start-3 sm:row-start-1"
            aria-hidden="true"
          >
            {d.score}
          </span>
        </li>
      ))}
    </ul>
  );
}
