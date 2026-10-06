/**
 * STEPPING THROUGH A PAGE'S DECLARED SCENES (J, 2026-10-06).
 *
 * A site that follows the state rules lists its scenes (`stateRules.ts`);
 * the arrows by the search bar and ← → on the board step through them. The
 * board slides: the page on show goes out one way and the next comes in from
 * the other, so a step reads as moving along the site's pages.
 */
import { play } from "@/core/audio/engine";
import { screenKey } from "./boardStates";
import { isPageState, type SceneScreen } from "./stateRules";
import { useStudio, type StudioNode } from "./store";
import { looksOnBoard, placedOnBoard, shownOnBoard } from "./canvas/helpers";

/** How the active page's parts are drawn now: which show, where, with what words. */
function drawnNow(): Map<string, string> {
  const s = useStudio.getState();
  const shows = shownOnBoard(s), places = placedOnBoard(s), looks = looksOnBoard(s);
  const out = new Map<string, string>();
  for (const n of s.nodes as StudioNode[]) {
    if (n.pageId !== s.activePageId || !shows(n)) continue;
    const b = places.get(n.id) ?? n;
    out.set(n.id, JSON.stringify([b.x, b.y, b.w, b.h, looks.get(n.id)?.content ?? null]));
  }
  return out;
}

/** Glow round what one step changed: parts that came, moved or took other words; only the outermost of a changed block. */
function glowChanges(before: Map<string, string>): void {
  if (typeof document === "undefined") return;
  const after = drawnNow();
  const nodes = useStudio.getState().nodes as StudioNode[];
  const sel = new Map(nodes.map((n) => [n.id, n.from?.selector ?? null]));
  const changed = [...after].filter(([id, v]) => before.get(id) !== v).map(([id]) => id);
  const sels = changed.map((id) => sel.get(id)).filter((x): x is string => !!x);
  const outer = changed.filter((id) => { const me = sel.get(id); return !me || !sels.some((o) => o !== me && me.startsWith(`${o} `)); });
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    for (const id of outer.slice(0, 60)) {
      const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      el.removeAttribute("data-scene-changed");
      void (el as HTMLElement).offsetWidth;
      el.setAttribute("data-scene-changed", "");
      window.setTimeout(() => el.removeAttribute("data-scene-changed"), 1300);
    }
  }));
}

type Src = { files?: { file: string; pageId: string }[]; screens?: unknown[] } | undefined;

/** The active page's declared scenes, in the site's order, and the one on show (-1: none). */
export function scenesOnPage(s: { activePageId: string; look?: unknown; statesOn?: string[] }): { scenes: SceneScreen[]; at: number } {
  const source = (s.look as { styleSource?: Src } | undefined)?.styleSource;
  const file = source?.files?.find((f) => f.pageId === s.activePageId)?.file ?? null;
  /* Only page states: a scene that changes one part is that part's state, on the Panels page (rule 31). */
  const scenes = ((source?.screens ?? []) as SceneScreen[]).filter((x) => x.declared && x.page === file && isPageState(x));
  const on = s.statesOn ?? [];
  return { scenes, at: scenes.findIndex((x) => on.includes(screenKey(x.name))) };
}

/** The next (or previous) scene on show, the board sliding as it goes. */
export function stepScene(by: number): void {
  const st = useStudio.getState();
  const { scenes, at } = scenesOnPage(st);
  if (!scenes.length) return;
  /* "As it opens" is a step too (-1): 0, 1 … N and round to 0 again. */
  const n = scenes.length + 1;
  showScene((((at + 1 + by) % n) + n) % n - 1, by);
}

/** One scene by its place in the list (-1: the page as it opens), sliding the way `by` says. */
export function showScene(to: number, by = 1): void {
  const { scenes } = scenesOnPage(useStudio.getState());
  if (!scenes.length) return;
  const keys = scenes.map((x) => screenKey(x.name));
  const next = keys[to] ?? null;
  const before = drawnNow();
  const swap = () => {
    const s = useStudio.getState();
    s.setStatesOn([...(s.statesOn ?? []).filter((k) => !keys.includes(k) && !k.startsWith("panel:") && !k.startsWith("isolate:")), ...(next ? [next] : [])]);
  };
  play("tap");
  const board = typeof document !== "undefined" ? (document.querySelector("[data-board-zoom]") as HTMLElement | null) : null;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!board || still || !board.animate) { swap(); glowChanges(before); return; }
  const d = by > 0 ? -1 : 1;
  const out = board.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${d * 40}px)`, opacity: 0 }], { duration: 70, easing: "ease-in" });
  out.onfinish = () => {
    swap();
    glowChanges(before);
    board.animate([{ transform: `translateX(${-d * 40}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 90, easing: "ease-out" });
  };
}
