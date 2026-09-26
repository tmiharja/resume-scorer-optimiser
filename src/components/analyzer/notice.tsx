import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: "border-accent bg-accent-soft",
  warn: "border-warn bg-warn-soft",
  danger: "border-danger bg-danger-soft",
} as const;

/** Left-rule notice (ui-layout.md §4.2). Meaning is carried by the title text, not colour alone. */
export default function Notice({
  tone,
  title,
  children,
  role,
  className,
}: {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div role={role} className={cn("rounded-r-lg border-l-2 px-4 py-3.5", TONES[tone], className)}>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 space-y-1.5 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
