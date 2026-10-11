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
 * started are cancelled, what it listens to and watches is let go (`noting`).
 * A marquee's track is left (the part is drawn again when the Preview is).
 */
import { getWork, NOT_ON_COPIES, pageFeatures, RUNTIME_JS } from "../shelf";
import { ON_BOARD } from "../shelf";
import { carriers } from "./carry";

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
 * WHAT A FEATURE LISTENS TO GOES WITH IT. As published a script listens on
 * the window (a follow, a tilt, a parallax) and watches its part for as long
 * as the page is open; here a run is undone (the Motion tab's four seconds, a
 * hover-try, the Preview drawn again), so every listener and observer a
 * script starts while it runs is noted, and the undo lets it go. Else a part
 * played with Follow the pointer went on following it after its four
 * seconds, and each play added another.
 */
type Observer = new (...a: never[]) => { disconnect(): void };
const WATCHERS = ["IntersectionObserver", "ResizeObserver", "MutationObserver"] as const;
function noting<T>(run: () => T, undo: (() => void)[]): T {
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  proto.addEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
    add.call(this, type, fn, o);
    undo.push(() => this.removeEventListener(type, fn, o));
  };
  const w = window as unknown as Record<string, Observer | undefined>;
  const was = WATCHERS.map((k) => w[k]);
  WATCHERS.forEach((k, i) => {
    const O = was[i];
    if (O) w[k] = class extends O { constructor(...a: never[]) { super(...a); undo.push(() => this.disconnect()); } };
  });
  try { return run(); } finally {
    proto.addEventListener = add;
    WATCHERS.forEach((k, i) => { if (was[i]) w[k] = was[i]; });
  }
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
type Placed = { id: string; work?: unknown; x?: number; y?: number; w?: number; h?: number; from?: { selector?: string } | null };

/**
 * ON THE BOARD, A MOVING PART CARRIES WHAT IS ON IT, as the Preview and the
 * published page do (`carry.ts`): the parts drawn over it or attached to its
 * edge play the same motion, turned about its middle, so an icon's shapes, a
 * panel's words, the TV's antennas go round and bob with it rather than
 * standing still. Each rider goes with the moving part at the top of its chain.
 */
function boardRiders(nodes: readonly Placed[], moving: ReadonlySet<string>): Map<string, Placed[]> {
  const boxed = nodes.filter((n) => [n.x, n.y, n.w, n.h].every((v) => typeof v === "number"));
  const by = carriers(boxed.map((n) => ({ id: n.id, x: n.x!, y: n.y!, w: n.w!, h: n.h!, moves: moving.has(n.id), path: n.from?.selector })));
  const out = new Map<string, Placed[]>();
  for (const n of boxed) {
    let o = by.get(n.id);
    for (let i = 0; o && !moving.has(o) && i < 8; i++) o = by.get(o);
    if (o && moving.has(o)) out.set(o, [...(out.get(o) ?? []), n]);
  }
  return out;
}

export function runWorks(root: HTMLElement, nodes: readonly Placed[], opts: { board?: boolean; only?: { part: string; feature: string } } = {}): () => void {
  const all = pageFeatures(nodes as { id: string; work?: null }[]);
  const board = !!opts.board;
  /*
   * ONE, PLAYED ON PURPOSE. The Motion tab's play button runs a single
   * feature on a single part, on the board, at its real strength: somebody
   * asked to see that one, so it is not the board's soft ambient loop, and
   * whatever it is (a reveal, a tilt) runs as the page would run it.
   */
  const only = opts.only;
  const ambient = (id: string) => ON_BOARD.includes(id);
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
  const riders = board ? boardRiders(nodes, new Set(bindings.map((b) => b.part))) : null;
  const timers: number[] = [];
  const undo: (() => void)[] = [];
  for (const b of bindings) {
    const el = board
      ? root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(b.part)}"] > [data-part-drawn]`)
      : root.querySelector<HTMLElement>(`[data-live-node="${CSS.escape(b.part)}"]`);
    const fn = rt.defs.get(b.feature);
    if (!el || !fn) continue;
    /* The part and the layers directly inside it: a feature may run on its drawing (a blink). */
    for (const x of [el, ...Array.from(el.children)] as HTMLElement[]) if (!touched.some((t) => t.el === x)) touched.push({ el: x, style: x.getAttribute("style") });
    if (board) el.setAttribute("data-board-moves", b.feature);
    try {
      const r = noting(() => fn(el, gentle ? softly(b.feature, b.inputs) : b.inputs, rt.F.api), undo);
      if (typeof r === "number") timers.push(r);
    } catch { /* as the runtime does: the part keeps what it was drawn as */ }
    const host = riders ? nodes.find((n) => n.id === b.part) : null;
    for (const k of (host && riders?.get(b.part)) || []) {
      const kel = root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(k.id)}"] > [data-part-drawn]`);
      if (!kel) continue;
      if (!touched.some((t) => t.el === kel)) touched.push({ el: kel, style: kel.getAttribute("style") });
      kel.style.transformOrigin = `${host!.x! + host!.w! / 2 - k.x!}px ${host!.y! + host!.h! / 2 - k.y!}px`;
      kel.setAttribute("data-board-moves-of", b.part);
      try { noting(() => fn(kel, gentle ? softly(b.feature, b.inputs) : b.inputs, rt.F.api), undo); } catch { /* the rider stays as drawn */ }
    }
    /* The part drawn again in a "What's new" card works as the part does, as published (`RUNTIME_JS`). */
    if (board || NOT_ON_COPIES.includes(b.feature)) continue;
    for (const copy of Array.from(root.querySelectorAll<HTMLElement>(`[data-copy-of="${CSS.escape(b.part)}"]`))) {
      if (!touched.some((t) => t.el === copy)) touched.push({ el: copy, style: copy.getAttribute("style") });
      try { noting(() => fn(copy, b.inputs, rt.F.api), undo); } catch { /* the copy stays as drawn */ }
    }
  }
  return () => {
    for (const u of undo.splice(0)) try { u(); } catch { /* already gone */ }
    for (const t of timers) window.clearInterval(t);
    document.querySelectorAll("[data-crt], [data-loader-film]").forEach((o) => o.remove());
    document.documentElement.style.overflow = "";
    for (const { el, style } of touched) {
      for (const a of el.getAnimations?.() ?? []) if (!(a as { animationName?: string }).animationName) a.cancel();
      /* A layer a feature drew into the part (the dust's canvas): taken out, and its loop stops with it. */
      el.querySelectorAll(":scope > [data-feature-layer]").forEach((x) => x.remove());
      el.removeAttribute("data-board-moves");
      el.removeAttribute("data-board-moves-of");
      /* A loop a feature keeps going (a follow as a layer) stops at its next frame, the part no longer its own. */
      delete (el as { __follow?: unknown }).__follow;
      if (style === null) el.removeAttribute("style"); else el.setAttribute("style", style);
    }
  };
}
