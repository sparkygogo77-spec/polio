/** Number/time formatting helpers tuned for dense terminal UIs. */

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 1234 -> "1.23K", 1_500_000 -> "1.5M". Tight, no trailing zeros. */
export function fmtCompact(n: number, digits = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [value, suffix] of units) {
    if (abs >= value) {
      return sign + trimZeros((abs / value).toFixed(digits)) + suffix;
    }
  }
  return sign + trimZeros(abs.toFixed(abs < 10 ? digits : 0));
}

export function fmtUsd(n: number, digits = 2): string {
  return "$" + fmtCompact(n, digits);
}

/** Milliseconds since -> "2s", "14m", "7h", "3d". */
export function fmtAge(sinceMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - sinceMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Turn any value into a short human label for diffs and news lines. */
export function labelValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : trimZeros(v.toFixed(2));
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
