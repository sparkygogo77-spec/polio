"use client";
/**
 * Which build this is, where a person looks.
 *
 * `/api/version` could say the commit and when the build was made, and
 * nothing in the app asked it; `version` in site.config had no reader; the
 * only visible "v0.N" was the ordinal of a pass on the Updates panel, not a
 * version (inventory B14). This is the one mark: the site's version, the
 * commit when the build was given one and a plain "no commit named" when
 * it was not, and how old the build is. Asked once per page load and
 * shared, because it does not change until the next deployment.
 */
import * as React from "react";
import site from "@site";

interface Version {
  commit: string | null;
  short: string | null;
  branch: string | null;
  builtAt: string | null;
}

let asked: Promise<Version | null> | null = null;
function version(): Promise<Version | null> {
  asked ??= fetch("/api/version", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Version>) : null))
    .catch(() => null);
  return asked;
}

/** How long ago, in the fewest words: "just now", "4 min ago", "3 h ago", "2 d ago". */
export function ageOf(iso: string | null, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "built at an unknown time";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "built just now";
  if (s < 3600) return `built ${Math.round(s / 60)} min ago`;
  if (s < 86400) return `built ${Math.round(s / 3600)} h ago`;
  return `built ${Math.round(s / 86400)} d ago`;
}

export function BuildMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [v, setV] = React.useState<Version | null | undefined>(undefined);
  React.useEffect(() => { let live = true; void version().then((r) => { if (live) setV(r); }); return () => { live = false; }; }, []);
  const words = [
    `v${site.version}`,
    v === undefined ? "asking which build" : v?.short ? v.short : "no commit named",
    v === undefined ? "" : ageOf(v?.builtAt ?? null),
  ].filter(Boolean).join(" · ");
  const title = v?.commit ? `commit ${v.commit}${v.branch ? ` on ${v.branch}` : ""}${v.builtAt ? `, built ${v.builtAt}` : ""}` : v?.builtAt ? `built ${v.builtAt}; this build was not given a commit` : undefined;
  return (
    <span data-build-mark="" title={title} className={className} style={style}>
      {words}
    </span>
  );
}
