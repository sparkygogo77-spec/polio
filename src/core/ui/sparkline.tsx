import * as React from "react";
import { cn } from "@/core/lib/cn";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Force a colour; default is up/down by first→last. */
  tone?: "up" | "down" | "accent" | "muted";
  fill?: boolean;
  strokeWidth?: number;
}

export function Sparkline({ data, width = 72, height = 22, className, tone, fill = true, strokeWidth = 1.5 }: SparklineProps) {
  const id = React.useId();
  if (data.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / span) * (height - 2) - 1] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;
  const auto = last >= first ? "up" : "down";
  const t = tone ?? auto;
  const color = t === "up" ? "var(--up)" : t === "down" ? "var(--down)" : t === "accent" ? "var(--accent)" : "var(--fg-muted)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("shrink-0 overflow-visible", className)} aria-hidden>
      {fill ? (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
        </>
      ) : null}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
