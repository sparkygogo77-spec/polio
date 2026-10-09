"use client";
/**
 * Showing an effect on the board, from the Motion tab.
 *
 *   · HINT: the pointer over an effect (or one of its parts) in the tab rings
 *     every part on the board that has it, in light blue. Nothing else is
 *     dimmed: the owner may want to give the effect to something else.
 *   · SHOW: pressing the effect keeps it on. Every part that has it does it,
 *     in and out every 1.5 seconds, wearing a light blue glow, until it is
 *     pressed again or Escape. While it shows, pressing a part on the board
 *     gives it the effect, or takes it away if it had it; the tab comes back
 *     after each press. A part inside a panel that has the effect already
 *     moves with it, so it is not given it twice; a panel given it takes it
 *     from the parts inside (BUILDER-RULES.md rule 33).
 *
 * The rings are drawn on one layer over the board, never on the parts, so
 * nothing a part already does (its shadow, its filter) is touched. Lives
 * outside React: the tab goes away while a part is pressed, the show does not.
 */
import { BACKGROUND_ID, useStudio } from "./board/store";
import { holds, type Effect } from "./motionEffects";
import { changeEffect } from "./motionWrite";

/** The glow: light blue, so it reads against dark and light pages alike. */
export const SHOW_GLOW = "125 211 252";
/** One way, in or out: there and back is 1.5 seconds. */
export const SHOW_HALF_MS = 750;

let layer: HTMLDivElement | null = null;
let hinted: string[] = [];
let shown: { effect: Effect; ids: string[] } | null = null;
let runs: Animation[] = [];
let raf = 0;
let unhear: (() => void) | null = null;
let note: string | null = null;
const listeners = new Set<() => void>();
const tell = () => { for (const f of listeners) f(); };

export function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
/** The effect showing now, by key. */
export const showing = (): string | null => shown?.effect.key ?? null;
/** What the last press on the board did, in words. */
export const lastNote = (): string | null => note;

const nodeEl = (id: string) => document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
/** The part's drawn box: what its own hover rule moves. */
const boxEl = (id: string) => nodeEl(id)?.querySelector<HTMLElement>("[data-part-box]") ?? nodeEl(id);

function draw() {
  raf = 0;
  const ids = [...new Set([...(shown?.ids ?? []), ...hinted])];
  if (!ids.length) { layer?.remove(); layer = null; return; }
  if (!layer || !layer.isConnected) {
    layer = document.createElement("div");
    layer.setAttribute("data-motion-show", "");
    Object.assign(layer.style, { position: "fixed", pointerEvents: "none", zIndex: "40", overflow: "hidden" });
    document.body.appendChild(layer);
  }
  /* Only over the board: a part scrolled under a side panel has no ring on the panel. */
  const room = document.querySelector("[data-studio-scroll]")?.getBoundingClientRect() ?? document.body.getBoundingClientRect();
  Object.assign(layer.style, { left: `${room.left}px`, top: `${room.top}px`, width: `${room.width}px`, height: `${room.height}px` });
  const lit = new Set(shown?.ids ?? []);
  while (layer.childElementCount > ids.length) layer.lastElementChild!.remove();
  ids.forEach((id, i) => {
    const ring = (layer!.children[i] as HTMLDivElement | undefined) ?? layer!.appendChild(document.createElement("div"));
    const r = boxEl(id)?.getBoundingClientRect();
    if (!r || (!r.width && !r.height)) { ring.style.display = "none"; return; }
    ring.setAttribute("data-motion-ring", lit.has(id) ? "show" : "hint");
    ring.dataset.id = id;
    Object.assign(ring.style, {
      display: "block", position: "absolute", left: `${r.left - room.left - 3}px`, top: `${r.top - room.top - 3}px`,
      width: `${r.width + 6}px`, height: `${r.height + 6}px`, borderRadius: "6px",
      boxShadow: lit.has(id)
        ? `0 0 0 2px rgb(${SHOW_GLOW}), 0 0 16px 4px rgb(${SHOW_GLOW} / 0.65)`
        : `0 0 0 2px rgb(${SHOW_GLOW} / 0.9)`,
    });
  });
  /* Keeps up with the loop and the scroll while anything is ringed. */
  raf = requestAnimationFrame(draw);
}
const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

/** Rings these parts while the pointer is over their effect; null takes the rings away. */
export function hint(ids: readonly string[] | null): void {
  hinted = ids ? [...ids] : [];
  redraw();
}

const camel = (p: string) => p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function loopParts() {
  for (const a of runs) a.cancel();
  runs = [];
  if (!shown) return;
  const frame: Keyframe = {};
  for (const [p, v] of Object.entries(shown.effect.style)) frame[camel(p)] = v.replace(/\s*!important$/i, "");
  if (!Object.keys(frame).length) return;
  for (const id of shown.ids) {
    const el = boxEl(id);
    if (!el?.animate) continue;
    try {
      runs.push(el.animate([frame], { duration: SHOW_HALF_MS, direction: "alternate", iterations: Infinity, easing: "ease-in-out" }));
    } catch { /* a declaration the browser will not animate: the glow still says which part */ }
  }
}

/** Shows an effect (the one pressed again stops); null stops whatever shows. */
export function show(effect: Effect | null): void {
  if (!effect || shown?.effect.key === effect.key) { stop(); return; }
  shown = { effect, ids: [...new Set(effect.rows.map((r) => r.nodeId))] };
  note = null;
  loopParts();
  hear();
  redraw();
  tell();
}

/** The parts with the effect changed while it shows (from the tab): the loop follows. */
export function refresh(effect: Effect): void {
  if (!shown || shown.effect.key !== effect.key) return;
  const ids = [...new Set(effect.rows.map((r) => r.nodeId))];
  if (ids.join() === shown.ids.join()) return;
  shown = { effect, ids };
  loopParts();
  redraw();
}

export function stop(): void {
  shown = null;
  for (const a of runs) a.cancel();
  runs = [];
  unhear?.();
  unhear = null;
  note = null;
  redraw();
  tell();
}

/** Gives or takes the effect from one part, keeping a panel and what is inside it as one. */
export function toggle(id: string): void {
  if (!shown) return;
  const s = useStudio.getState();
  const nodes = s.nodes.filter((n) => n.pageId === s.activePageId);
  const part = nodes.find((n) => n.id === id);
  if (!part) return;
  const have = new Set(shown.ids);
  const e = shown.effect;
  if (have.has(id)) {
    changeEffect(e, [], [id]);
    have.delete(id);
    note = "Taken off that part.";
  } else {
    const outer = nodes.find((n) => have.has(n.id) && holds(n, part));
    if (outer) { note = "That part sits in a panel that already does this, so it moves with it."; tell(); return; }
    const inner = nodes.filter((n) => have.has(n.id) && holds(part, n)).map((n) => n.id);
    changeEffect(e, [id], inner);
    for (const i of inner) have.delete(i);
    have.add(id);
    note = inner.length
      ? `Added. ${inner.length} part${inner.length === 1 ? "" : "s"} inside it now move with it instead of on their own.`
      : "Added to that part.";
  }
  shown = { effect: e, ids: [...have] };
  /* The board draws the change after the store writes: start the loop on the new boxes then. */
  setTimeout(loopParts, 60);
  redraw();
  tell();
}

/** While an effect shows, a press on a part toggles it, and the Motion tab is asked back. */
function hear() {
  if (unhear) return;
  let was = useStudio.getState().selection.join(",");
  const off = useStudio.subscribe((st) => {
    const now = st.selection.join(",");
    if (now === was) return;
    was = now;
    if (st.selection.length !== 1 || st.selection[0] === BACKGROUND_ID) return;
    const id = st.selection[0]!;
    toggle(id);
    let done = false;
    const back = () => {
      if (done) return;
      done = true;
      window.removeEventListener("pointerup", back);
      setTimeout(() => {
        /* Let go of the part, so pressing it again is heard as a press too. */
        useStudio.getState().setSelection([]);
        useStudio.getState().want({ panel: "motion" });
      }, 0);
    };
    window.addEventListener("pointerup", back, { once: true });
    setTimeout(back, 600);
  });
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") stop(); };
  window.addEventListener("keydown", esc);
  unhear = () => { off(); window.removeEventListener("keydown", esc); };
}
