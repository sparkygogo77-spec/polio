/**
 * A SPEED BAR UNDER A PART THAT MOVES ON ITS OWN.
 *
 * J (2026-10-10): "for spin once i select a part to put it on a small bar
 * should come up ... right under where i select. i need to be able to choose
 * the speed with a bar that shows me how fast it will spin until i let go of
 * the bar and it disappears". Once Spin or Float lands on a part, a small bar
 * sits just under it (above it when there is no room below), following the
 * part as the board scrolls. While the hand drags along it the part on the
 * board plays at that speed, live, with nothing saved; on let go the speed is
 * saved once (one undo step), the bar goes, and the Preview and Publish take
 * the same speed from the part's settings. Escape or a press anywhere else
 * puts it away with nothing changed.
 */
import { useStudio } from "./board/store";
import { usesOf, withWork } from "./shelf";
import { getWork } from "./shelf";

interface Speed { input: string; slow: number; fast: number; prop: string; say: (s: string) => string }

/** The motions with a speed, the setting that holds it (seconds), the range the bar covers and what it animates. */
export const SPEEDS: Readonly<Record<string, Speed>> = {
  spin: { input: "period", slow: 40, fast: 0.6, prop: "rotate", say: (s) => `One turn takes ${s}` },
  float: { input: "period", slow: 16, fast: 1, prop: "translate", say: (s) => `Up and back takes ${s}` },
};

/** Bar position (0 slow, 1 fast) ⇄ seconds, on a log scale so the quick end is not crammed. */
export const secondsAt = (sp: Speed, t: number) => sp.slow * Math.pow(sp.fast / sp.slow, Math.min(1, Math.max(0, t)));
export const placeOf = (sp: Speed, s: number) => Math.min(1, Math.max(0, Math.log(s / sp.slow) / Math.log(sp.fast / sp.slow)));
const tidy = (s: number) => (s >= 10 ? Math.round(s) : Math.round(s * 10) / 10);
const said = (s: number) => `${tidy(s)} second${tidy(s) === 1 ? "" : "s"}`;

/** The animations a part's motion runs on the board: its drawn layer, the parts it carries, and their layers. */
function running(nodeId: string, prop: string): Animation[] {
  const id = CSS.escape(nodeId);
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-node-id="${id}"] > [data-part-drawn], [data-board-moves-of="${id}"]`));
  const out: Animation[] = [];
  for (const el of els) for (const x of [el, ...Array.from(el.children)]) {
    for (const a of x.getAnimations?.() ?? []) {
      const fx = a.effect as KeyframeEffect | null;
      if (fx?.getKeyframes?.().some((k) => prop in k)) out.push(a);
    }
  }
  return out;
}

let open: (() => void) | null = null;

/** Puts the speed bar up under a part that was just given `workId`, when that motion has a speed. */
export function offerSpeed(nodeId: string, workId: string): void {
  const sp = SPEEDS[workId];
  if (!sp || typeof document === "undefined") return;
  open?.();
  const st = useStudio.getState();
  const node = st.nodes.find((n) => n.id === nodeId);
  const use = usesOf(node?.work).find((u) => u.id === workId);
  if (!node || !use) return;
  const def = Number(getWork(workId)?.manifest.inputs.find((i) => i.id === sp.input)?.default ?? sp.slow);
  const had = Number(use.inputs?.[sp.input]);
  /* What the board is playing it at now: the rate is set against this. */
  const base = Number.isFinite(had) && had > 0 ? had : def;
  let now = base;
  let held = false;

  const bar = document.createElement("div");
  bar.setAttribute("data-speed-bar", workId);
  bar.setAttribute("role", "slider");
  bar.setAttribute("aria-label", `${getWork(workId)?.manifest.name ?? "Motion"} speed`);
  bar.style.cssText = "position:fixed;z-index:2147483602;left:0;top:0;width:220px;box-sizing:border-box;padding:8px 10px 9px;border-radius:8px;" +
    "background:rgb(10 18 28 / .94);box-shadow:0 10px 26px rgb(0 0 0 / .45),0 0 0 1px rgb(125 211 252 / .55);touch-action:none;user-select:none;cursor:ew-resize;" +
    "font:600 11px/1.2 system-ui,sans-serif;color:rgb(224 242 254)";
  const words = document.createElement("div");
  words.style.cssText = "display:flex;justify-content:space-between;gap:8px;margin-bottom:7px";
  const say = document.createElement("span");
  const ends = document.createElement("span");
  ends.style.cssText = "color:rgb(125 211 252 / .75);font-weight:500";
  ends.textContent = "slow · fast";
  words.append(say, ends);
  const track = document.createElement("div");
  track.style.cssText = "position:relative;height:6px;border-radius:3px;background:rgb(125 211 252 / .22)";
  const fill = document.createElement("div");
  fill.style.cssText = "position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:rgb(125 211 252)";
  const knob = document.createElement("div");
  knob.setAttribute("data-speed-knob", "");
  knob.style.cssText = "position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:rgb(224 242 254);box-shadow:0 2px 6px rgb(0 0 0 / .5),0 0 0 2px rgb(125 211 252)";
  track.append(fill, knob);
  bar.append(words, track);
  document.body.appendChild(bar);

  const show = () => {
    const t = placeOf(sp, now);
    fill.style.width = `${t * 100}%`;
    knob.style.left = `${t * 100}%`;
    say.textContent = sp.say(said(now));
    bar.setAttribute("aria-valuenow", String(tidy(now)));
  };
  show();

  /* Under the part, or over it when the window has no room below; it follows the part while the board scrolls. */
  let frame = 0;
  const place = () => {
    const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      const w = bar.offsetWidth, h = bar.offsetHeight;
      /* Kept over the board, never over the side panel or off the window. */
      const b = el.closest("[data-board-tool]")?.getBoundingClientRect();
      const lo = Math.max(8, b?.left ?? 0), hi = Math.min(window.innerWidth, b?.right ?? Infinity) - w - 8;
      const left = Math.min(hi, Math.max(lo, r.left + r.width / 2 - w / 2));
      const top = r.bottom + 10 + h <= window.innerHeight - 8 ? r.bottom + 10 : Math.max(8, r.top - 10 - h);
      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
    }
    frame = requestAnimationFrame(place);
  };
  place();

  /* Live on the board: the running animations sped up or slowed, from where they are, nothing restarted or saved. */
  const at = (x: number) => {
    const r = track.getBoundingClientRect();
    now = secondsAt(sp, (x - r.left) / Math.max(1, r.width));
    show();
    for (const a of running(nodeId, sp.prop)) a.playbackRate = base / now;
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (!bar.contains(e.target as Node)) { stop(); return; }
    e.preventDefault();
    e.stopPropagation();
    held = true;
    at(e.clientX);
  };
  const move = (e: PointerEvent) => { if (held) { e.preventDefault(); at(e.clientX); } };
  const up = (e: PointerEvent) => {
    if (!held) return;
    e.stopPropagation();
    held = false;
    const s = tidy(now);
    const cur = useStudio.getState().nodes.find((n) => n.id === nodeId);
    const u = usesOf(cur?.work).find((x) => x.id === workId);
    if (s === tidy(base) || !cur || !u) { stop(); return; }
    /* Saved: the board starts it again at the new speed, so it is not put back first. */
    stop(false);
    useStudio.getState().updateNode(nodeId, { work: withWork(cur.work, { ...u, inputs: { ...(u.inputs ?? {}), [sp.input]: String(s) } }) });
  };
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); stop(); } };
  const away = () => stop();
  const stop = (putBack = true) => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointerdown", down, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", up, true);
    window.removeEventListener("keydown", key, true);
    /* Put away without saving: back to the speed it has. */
    if (putBack) for (const a of running(nodeId, sp.prop)) a.playbackRate = 1;
    bar.remove();
    if (open === away) open = null;
  };
  /* The press that put the motion on is still on its way up: listen from the next frame. */
  requestAnimationFrame(() => {
    if (open !== away) return;
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    window.addEventListener("keydown", key, true);
  });
  open = away;
}
