/**
 * STEPPING THE PICK OUT TO A BIGGER BOX AND BACK IN (J, 2026-11-08).
 *
 * With a part picked, a gesture steps the pick out to the box that holds it,
 * and the opposite gesture steps back in along the path it came out on. The
 * path is remembered here: out from the words to the button to the row,
 * then back in to the button and the words, not to whichever child happens
 * to be first. Escape, the toolbar's Step out, the wheel and the bracket
 * keys all step through these two functions, so they share one ladder.
 *
 * THE GESTURE IS ONE SETTING, `STEP_GESTURE`, read everywhere it matters:
 *   "alt-wheel"          Alt + wheel down steps out, Alt + wheel up steps in;
 *                        a plain wheel scrolls the page as it always did
 *                        (the coordinator's pick, 2026-11-08);
 *   "wheel-over-picked"  the wheel over the picked box steps instead of
 *                        scrolling; off the box it scrolls;
 *   "keys"               only `[` (out) and `]` (in).
 * `[` and `]` work under every setting. Stepping picks; it is never a step
 * of undo (`setSelection` writes no history). `tests/select-step.mjs`.
 */
import { holds } from "../owner";
import { useStudio } from "./store";
import { climbSpot, stepOutOf } from "./selectTools";

export type StepGesture = "alt-wheel" | "wheel-over-picked" | "keys";
/** THE ONE SETTING. Change this word and nothing else to change the gesture. */
export const STEP_GESTURE: StepGesture = "alt-wheel";

/** The hint shown once, by the toolbar, under each setting. */
export const STEP_HINT: Record<StepGesture, string> = {
  "alt-wheel": "Alt + scroll: bigger box / smaller box",
  "wheel-over-picked": "Scroll over it: bigger box / smaller box",
  "keys": "[ bigger box   ] smaller box",
};

/** How much wheel makes one step: one notch of a mouse wheel, a short flick of a trackpad. */
const NOTCH = 40;
/** A pause longer than this starts the count again, so a flick's tail does not add to the next one. */
const PAUSE = 400;

/*
 * THE PATH OUT. `ids` are the parts left behind on the way out, innermost first; `at` is the pick they were
 * left from ("" when the last step out left nothing picked). A pick that was not made by a step (a click, the
 * part list) leaves `at` naming some other part, and the path is dropped the next time it is read.
 */
let path: { at: string; ids: string[] } | null = null;
const listeners = new Set<() => void>();
/** Called after every step; the toolbar's hint goes away on the first. */
export function onStep(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const stepped = () => { for (const f of listeners) f(); };

/** What is picked now: one part's id, "" for nothing, null for several or a part off this page. */
function pickNow() {
  const s = useStudio.getState();
  if (!s.selection.length) return "";
  if (s.selection.length !== 1) return null;
  const n = s.nodes.find((x) => x.id === s.selection[0]);
  return n && n.pageId === s.activePageId ? n.id : null;
}

/** One level out: to the part that holds the picked one, else to nothing picked. True when anything changed. */
export function stepOut(): boolean {
  const s = useStudio.getState();
  const cur = pickNow();
  if (cur === "") return false;
  if (cur === null) { s.clearSelection(); climbSpot(null); path = null; stepped(); return true; }
  const part = s.nodes.find((n) => n.id === cur)!;
  const up = stepOutOf(s.nodes, part);
  if (path && path.at === cur) path.ids.push(cur);
  else path = { at: cur, ids: [cur] };
  if (up) s.setSelection([up.id]);
  else s.clearSelection();
  path.at = up?.id ?? "";
  climbSpot(up?.id ?? null);
  stepped();
  return true;
}

/** One level back in, along the path the pick came out on. False when there is no path from here. */
export function stepIn(): boolean {
  const s = useStudio.getState();
  const cur = pickNow();
  if (cur === null || !path || path.at !== cur || !path.ids.length) { if (path && path.at !== cur) path = null; return false; }
  const id = path.ids[path.ids.length - 1]!;
  const next = s.nodes.find((n) => n.id === id);
  const outer = cur ? s.nodes.find((n) => n.id === cur) : null;
  /* The part has gone, or no longer sits inside the pick (an edit since): the path is stale. */
  if (!next || next.pageId !== s.activePageId || (outer && !holds(outer, next))) { path = null; return false; }
  path.ids.pop();
  path.at = id;
  s.setSelection([id]);
  climbSpot(id);
  stepped();
  return true;
}

let acc = 0, accAt = -Infinity;
/**
 * Which way a wheel event steps under the setting: 1 out, -1 in, 0 when this wheel is a scroll. `overPicked` says
 * whether the pointer is over the picked part. Small deltas add up to a notch; a pause starts over.
 */
export function wheelStep(e: WheelEvent, overPicked: boolean): -1 | 0 | 1 {
  if (STEP_GESTURE === "keys" || e.ctrlKey || e.metaKey || e.shiftKey) return 0;
  if (STEP_GESTURE === "alt-wheel" ? !e.altKey : !overPicked || e.altKey) return 0;
  const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
  if (e.timeStamp - accAt > PAUSE) acc = 0;
  accAt = e.timeStamp;
  acc += dy;
  if (Math.abs(acc) < NOTCH) return 0;
  const dir = acc > 0 ? 1 : -1;
  acc = 0;
  return dir;
}

/** Which way a key steps: `[` out, `]` in, else 0. */
export function keyStep(key: string): -1 | 0 | 1 { return key === "[" ? 1 : key === "]" ? -1 : 0; }

const SEEN = "polio.stepHintSeen";
export function stepHintSeen(): boolean { try { return localStorage.getItem(SEEN) === "1"; } catch { return true; } }
export function markStepHintSeen() { try { localStorage.setItem(SEEN, "1"); } catch { /* kept for this visit */ } }
