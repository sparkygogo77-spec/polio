import { cn } from "@/core/lib/cn";

export interface ProgressProps {
  /** 0..1 */
  value: number;
  className?: string;
  tone?: "accent" | "up" | "down" | "warn" | "info" | "auto";
  height?: number;
  glow?: boolean;
  label?: string;
}

/** Thin progress bar. `tone="auto"` goes warn→accent→up as it fills. */
export function Progress({ value, className, tone = "accent", height = 3, glow, label }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value));
  const auto = pct < 0.5 ? "bg-warn" : pct < 0.9 ? "bg-accent" : "bg-up";
  const bar = tone === "auto" ? auto : tone === "accent" ? "bg-accent" : `bg-${tone}`;
  return (
    <div className={cn("flex items-center gap-2", className)} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="relative w-full overflow-hidden rounded-full bg-active" style={{ height }}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-(--motion-slow) ease-out", bar, glow && "shadow-[0_0_8px_currentColor]")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {label ? <span className="num shrink-0 text-small text-fg-muted">{label}</span> : null}
    </div>
  );
}
