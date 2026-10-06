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
import type { SceneScreen } from "./stateRules";
import { useStudio } from "./store";

type Src = { files?: { file: string; pageId: string }[]; screens?: unknown[] } | undefined;

/** The active page's declared scenes, in the site's order, and the one on show (-1: none). */
export function scenesOnPage(s: { activePageId: string; look?: unknown; statesOn?: string[] }): { scenes: SceneScreen[]; at: number } {
  const source = (s.look as { styleSource?: Src } | undefined)?.styleSource;
  const file = source?.files?.find((f) => f.pageId === s.activePageId)?.file ?? null;
  const scenes = ((source?.screens ?? []) as SceneScreen[]).filter((x) => x.declared && x.page === file);
  const on = s.statesOn ?? [];
  return { scenes, at: scenes.findIndex((x) => on.includes(screenKey(x.name))) };
}

/** The next (or previous) scene on show, the board sliding as it goes. */
export function stepScene(by: number): void {
  const st = useStudio.getState();
  const { scenes, at } = scenesOnPage(st);
  if (!scenes.length) return;
  showScene(at < 0 ? (by > 0 ? 0 : scenes.length - 1) : (at + by + scenes.length) % scenes.length, by);
}

/** One scene by its place in the list (-1: the page as it opens), sliding the way `by` says. */
export function showScene(to: number, by = 1): void {
  const { scenes } = scenesOnPage(useStudio.getState());
  if (!scenes.length) return;
  const keys = scenes.map((x) => screenKey(x.name));
  const next = keys[to] ?? null;
  const swap = () => {
    const s = useStudio.getState();
    s.setStatesOn([...(s.statesOn ?? []).filter((k) => !keys.includes(k) && !k.startsWith("panel:") && !k.startsWith("isolate:")), ...(next ? [next] : [])]);
  };
  play("tap");
  const board = typeof document !== "undefined" ? (document.querySelector("[data-board-zoom]") as HTMLElement | null) : null;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!board || still || !board.animate) { swap(); return; }
  const d = by > 0 ? -1 : 1;
  const out = board.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${d * 80}px)`, opacity: 0 }], { duration: 140, easing: "ease-in" });
  out.onfinish = () => {
    swap();
    board.animate([{ transform: `translateX(${-d * 80}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 180, easing: "ease-out" });
  };
}
