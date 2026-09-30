"use client";
/**
 * The features a page's parts carry, run in the Preview.
 *
 * The published page loads `assets/features/runtime.js` and each feature's
 * script (`library/works.ts`); until now the Preview ran none of them, so a
 * marquee, a reveal or a loader was only ever seen once the site was live.
 * This runs the very same scripts, through the very same runtime, on the
 * Preview's own part elements (`[data-live-node]`), which is what the
 * published page's `#id` elements are. The board calls it too, for the few
 * that move on their own, softly (`board`, below): it is a layout surface
 * and nothing else on it moves.
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
import { AMBIENT } from "../library/behaviours";

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

/**
 * ON THE BOARD, SOFTLY. The board is where parts are placed, so only what
 * moves on its own with nobody touching it plays there (`AMBIENT`: a spin, a
 * float, the dust), and gently: a float goes half as far, the dust is half
 * as thick. Each runs on the drawn layer inside the part
 * (`[data-part-drawn]`), never on the part's own box, so the box, its
 * selection and its handles stand still and it is picked up and moved as
 * ever; the dust's canvas takes no pointer. A visitor's machine asking for
 * less motion holds it all still, as every script asks.
 */
function softly(feature: string, inputs: Record<string, string>): Record<string, string> {
  const n = (v: string | undefined, d: number) => { const x = Number(v); return v === undefined || v === "" || !Number.isFinite(x) ? d : x; };
  if (feature === "float") return { ...inputs, travel: String(n(inputs.travel, 12) * 0.5) };
  if (feature === "dust-canvas") return { ...inputs, spacing: String(n(inputs.spacing, 18) * 2) };
  return inputs;
}

/** Runs every feature switched on for the page's parts; returns what undoes it. `board`: the board's own, softly (above). */
export function runWorks(root: HTMLElement, nodes: readonly { id: string; work?: unknown }[], opts: { board?: boolean; only?: { part: string; feature: string } } = {}): () => void {
  const all = pageFeatures(nodes as { id: string; work?: null }[]);
  const board = !!opts.board;
  /*
   * ONE, PLAYED ON PURPOSE. The Motion tab's play button runs a single
   * feature on a single part, on the board, at its real strength: somebody
   * asked to see that one, so it is not the board's soft ambient loop, and
   * whatever it is (a reveal, a tilt) runs as the page would run it.
   */
  const only = opts.only;
  const ambient = (id: string) => (AMBIENT as readonly string[]).includes(id);
  const bindings = only
    ? all.bindings.filter((b) => b.part === only.part && b.feature === only.feature)
    : board ? all.bindings.filter((b) => ambient(b.feature)) : all.bindings;
  const scripts = only
    ? all.scripts.filter((s) => s === "runtime.js" || s.replace(/\.js$/, "") === only.feature)
    : board ? all.scripts.filter((s) => ambient(s.replace(/\.js$/, ""))) : all.scripts;
  const gentle = board && !only;
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
    const el = board
      ? root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(b.part)}"] > [data-part-drawn]`)
      : root.querySelector<HTMLElement>(`[data-live-node="${CSS.escape(b.part)}"]`);
    const fn = rt.defs.get(b.feature);
    if (!el || !fn) continue;
    if (!touched.some((t) => t.el === el)) touched.push({ el, style: el.getAttribute("style") });
    if (board) el.setAttribute("data-board-moves", b.feature);
    try {
      const r = fn(el, gentle ? softly(b.feature, b.inputs) : b.inputs, rt.F.api);
      if (typeof r === "number") timers.push(r);
    } catch { /* as the runtime does: the part keeps what it was drawn as */ }
  }
  return () => {
    for (const t of timers) window.clearInterval(t);
    document.querySelectorAll("[data-crt]").forEach((o) => o.remove());
    document.documentElement.style.overflow = "";
    for (const { el, style } of touched) {
      for (const a of el.getAnimations?.() ?? []) if (!(a as { animationName?: string }).animationName) a.cancel();
      /* A layer a feature drew into the part (the dust's canvas): taken out, and its loop stops with it. */
      el.querySelectorAll(":scope > [data-feature-layer]").forEach((x) => x.remove());
      el.removeAttribute("data-board-moves");
      if (style === null) el.removeAttribute("style"); else el.setAttribute("style", style);
    }
  };
}
