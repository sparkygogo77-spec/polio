"use client";
/**
 * The features a page's parts carry, run in the Preview.
 *
 * The published page loads `assets/features/runtime.js` and each feature's
 * script (`library/works.ts`); until now the Preview ran none of them, so a
 * marquee, a reveal or a loader was only ever seen once the site was live.
 * This runs the very same scripts, through the very same runtime, on the
 * Preview's own part elements (`[data-live-node]`), which is what the
 * published page's `#id` elements are. The board never calls it: it is a
 * layout surface and stays still.
 *
 * The runtime is evaluated with its own `window` and `document` standing in,
 * so it neither reads the Builder's page for a list of parts nor starts on
 * its own; it only hands back `siteFeatures` (define, and the api). Each
 * script is then run against that, and each binding on its element.
 * A visitor asking for less motion is asked in each script, as published.
 *
 * What a run leaves is undone where it can be: the loader's screen is taken
 * away, the inline styles a feature set are put back, the animations it
 * started are cancelled. A marquee's track is left (the part is drawn again
 * when the Preview is).
 */
import { getWork, pageFeatures, RUNTIME_JS } from "../library/works";

type Def = (el: HTMLElement, inputs: Record<string, string>, api: unknown) => unknown;
interface Runtime { define: (id: string, fn: Def) => void; api: unknown }

function runtime(): { F: Runtime; defs: Map<string, Def> } | null {
  const defs = new Map<string, Def>();
  const win: Record<string, unknown> = {};
  const doc = { readyState: "loading", addEventListener() {}, getElementById: () => null };
  try {
    new Function("window", "document", RUNTIME_JS)(win, doc);
  } catch {
    return null;
  }
  const real = win.siteFeatures as Runtime | undefined;
  if (!real) return null;
  return { F: { define: (id, fn) => { defs.set(id, fn); }, api: real.api }, defs };
}

/** Runs every feature switched on for the page's parts; returns what undoes it. */
export function runWorks(root: HTMLElement, nodes: readonly { id: string; work?: unknown }[]): () => void {
  const { bindings, scripts } = pageFeatures(nodes as { id: string; work?: null }[]);
  if (!bindings.length) return () => {};
  const rt = runtime();
  if (!rt) return () => {};
  for (const s of scripts) {
    if (s === "runtime.js") continue;
    const w = getWork(s.replace(/\.js$/, ""));
    if (!w) continue;
    try { new Function("siteFeatures", w.script)(rt.F); } catch { /* a feature that will not load is left out, as published */ }
  }
  const touched: { el: HTMLElement; style: string | null }[] = [];
  const timers: number[] = [];
  for (const b of bindings) {
    const el = root.querySelector<HTMLElement>(`[data-live-node="${CSS.escape(b.part)}"]`);
    const fn = rt.defs.get(b.feature);
    if (!el || !fn) continue;
    if (!touched.some((t) => t.el === el)) touched.push({ el, style: el.getAttribute("style") });
    try {
      const r = fn(el, b.inputs, rt.F.api);
      if (typeof r === "number") timers.push(r);
    } catch { /* as the runtime does: the part keeps what it was drawn as */ }
  }
  return () => {
    for (const t of timers) window.clearInterval(t);
    document.querySelectorAll("[data-crt]").forEach((o) => o.remove());
    document.documentElement.style.overflow = "";
    for (const { el, style } of touched) {
      for (const a of el.getAnimations?.() ?? []) if (!(a as { animationName?: string }).animationName) a.cancel();
      if (style === null) el.removeAttribute("style"); else el.setAttribute("style", style);
    }
  };
}
