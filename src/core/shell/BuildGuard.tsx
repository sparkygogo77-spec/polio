"use client";
/**
 * A PAGE RUNNING AN OLDER BUILD THAN THE SERVER SAYS SO, and stops.
 *
 * Driven by hand: a deploy went out, the same tab stayed open, and from
 * then on pressing things did nothing. A tab holds the code it loaded;
 * after a deploy the server holds a newer one, and anything the old page
 * loads on demand, a panel, a route, a chunk, is asked for at an address
 * the new build no longer serves. That fails inside the press, and the
 * press ends in silence. Nothing on screen said the page was stale.
 *
 * So the page knows the build it was made from: `BUILD_TIME` is written
 * into the code at build (next.config.ts), and `/api/version` says the
 * server's. When they differ, or when the browser reports a chunk it
 * could not load, a banner says so in words with one thing to press,
 * Reload, and the controls that would otherwise run quietly refuse with
 * the same sentence. Asked on load, on coming back to the tab, and every
 * minute, because a deploy can land while the tab is open.
 */
import * as React from "react";
import { ageOf } from "@/features/builds/BuildMark";

/** The build this code came from. Inlined at build; null on a build that did not set it. */
const MINE: string | null = process.env.BUILD_TIME ?? null;

interface Stale {
  why: "server" | "chunk";
  mine: string | null;
  server: string | null;
}

let stale: Stale | null = null;
const listeners = new Set<() => void>();
const tell = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Is this page running an older build than the server? For controls that must not run quietly on one. */
export function staleBuild(): Stale | null {
  return stale;
}

/** The sentence a control says instead of running on a stale page. */
export function staleSays(s: Stale = stale ?? { why: "server", mine: MINE, server: null }): string {
  return s.why === "chunk"
    ? "This page is out of date since the last deploy: part of its code could not be loaded. Reload the page, then try again."
    : `This page is running an older build than the server: this page was ${ageOf(s.mine)}, and the server has a newer one. Reload the page, then try again.`;
}

function markStale(next: Stale) {
  if (stale && stale.why === next.why) return;
  stale = next;
  tell();
}

const CHUNK = /ChunkLoadError|Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;

async function askServer(): Promise<void> {
  if (!MINE) return;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const v = (await res.json()) as { builtAt?: string | null };
    const server = typeof v.builtAt === "string" ? v.builtAt : null;
    if (server && server !== MINE) markStale({ why: "server", mine: MINE, server });
  } catch { /* offline, or between deploys: asked again in a minute */ }
}

export function BuildGuard() {
  const s = React.useSyncExternalStore(subscribe, () => stale, () => null);
  React.useEffect(() => {
    void askServer();
    const every = window.setInterval(() => void askServer(), 60_000);
    const back = () => { if (document.visibilityState === "visible") void askServer(); };
    const onError = (e: ErrorEvent) => { if (CHUNK.test(String(e.message ?? "")) || CHUNK.test(String((e.error as { message?: string } | undefined)?.message ?? ""))) markStale({ why: "chunk", mine: MINE, server: null }); };
    const onReject = (e: PromiseRejectionEvent) => { const r = e.reason as { message?: string; name?: string } | undefined; if (CHUNK.test(String(r?.message ?? "")) || CHUNK.test(String(r?.name ?? ""))) markStale({ why: "chunk", mine: MINE, server: null }); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  if (!s) return null;
  return (
    <div
      data-stale-build={s.why}
      role="alert"
      /* A row of its own above the bar, never over it: a banner that hid
         the GitHub button would have hidden the one control it is about. */
      className="flex shrink-0 items-center justify-center gap-3 px-4 py-2 text-large"
      style={{ background: "oklch(0.72 0.17 18)", color: "oklch(0.98 0.01 18)" }}
    >
      <span>{staleSays(s)}</span>
      <button
        type="button"
        data-stale-reload=""
        onClick={() => window.location.reload()}
        className="tactile rounded-md border px-2 py-0.5 font-medium"
        style={{ borderColor: "oklch(0.98 0.01 18 / 0.7)", background: "oklch(0.98 0.01 18 / 0.12)" }}
      >
        Reload
      </button>
    </div>
  );
}
