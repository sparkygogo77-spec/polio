/**
 * WHICH PART THE POINTER, THE FOCUS AND A PRESS ARE ON, AS WORDS A RULE CAN NAME.
 *
 * A captured group state (hover, focus, press) fires when it is on any part
 * of the group (`capturedMotion.ts#motionCss`, given `hot`). Said with
 * `:root:has(…)`, every element the board restyled cost about twice as much.
 * Here the board's own element carries the state, and the rules read it.
 *
 * ONE ATTRIBUTE A HOST, NOT ONE FOR ALL. The first shape was one attribute a
 * state (`data-hot`) holding the id of the part the state is on and `@` +
 * each path its code stands under, and every group's rule read that one
 * attribute: `[data-hot~="host"] .mo-x`. The browser keys what to restyle by
 * the attribute's name, so a change to `data-hot` restyled every part any
 * rule on it named: on sol face's board about 1,050 elements for each move of
 * the pointer from one part to another, 17–22 ms of style work, against 160
 * elements with no motion sheet (EDIT-ISSUES #69; `checkup/hover-cost.mjs`
 * in the import-gaps lane). Now each host lit by the state gets an attribute
 * of its own on the board's element, `data-hot-<host id>` (and `-focus-`,
 * `-focus-visible-`, `-active-` for the other states), and a group's rule
 * reads only its host's: a change restyles that group's parts and no other.
 * Which hosts a part lights is read from the sheet's hosts (`setHotHosts`,
 * from `motionCss`): the part itself when it is a host, and every host whose
 * path code its own code (`data-at`) stands strictly under, the same parts
 * `[data-at^="code"]:not([data-at="code"])` picked.
 *
 * The plain attributes stay, for a look at what is hot (no rule reads them,
 * so they cost nothing to change):
 *
 *   data-hot                the part under the pointer (`:hover`)
 *   data-hot-focus          the part focus is inside (`:focus-within`)
 *   data-hot-focus-visible  the part that is itself focused, visibly (`:focus-visible`)
 *   data-hot-active         the part pressed, while pressed (`:active`)
 */
import * as React from "react";

export const HOT = "data-hot";

/** A host a group's rule reads: by its path code (the parts under it light it), else by its parts' ids. */
export interface HotHost { code: string | null; ids: readonly string[] | null }

let HOSTS: readonly (HotHost & { id: string })[] = [];
/** The sheet's hosts, as `motionCss` collected them (`DesktopCanvas.tsx`): what each part lights is read from here. */
export function setHotHosts(hosts: ReadonlyMap<string, HotHost>): void {
  HOSTS = [...hosts].map(([id, h]) => ({ id, ...h }));
}

const partOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-node-id]") : null);

/** The tokens for a part: its id, and every path strictly above its code. */
export function hotTokens(part: Element | null): string {
  if (!part) return "";
  const out = [part.getAttribute("data-node-id") ?? ""];
  const code = part.getAttribute("data-at") ?? "";
  for (let i = code.indexOf("."); i > 0 && i < code.length - 1; i = code.indexOf(".", i + 1)) out.push(`@${code.slice(0, i + 1)}`);
  return out.filter(Boolean).join(" ");
}

/** The hosts a part lights: itself, and every host whose code its own stands strictly under (or that names it). */
export function litHosts(part: Element | null): string[] {
  if (!part) return [];
  const id = part.getAttribute("data-node-id") ?? "";
  const code = part.getAttribute("data-at") ?? "";
  const out: string[] = [];
  for (const h of HOSTS) {
    if (h.id === id || (h.code !== null && code.length > h.code.length && code.startsWith(h.code)) || (h.ids?.includes(id) ?? false)) out.push(h.id);
  }
  return out;
}

/** The attribute a state writes for one host, on the board's element. */
export const hotHostAttr = (attr: string, hostId: string) => `${attr}-${hostId}`;

/** Keep the state attributes on the board's element in step with the parts they are on. */
export function useHoverHot(board: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = board.current;
    if (!el) return;
    const lit = new Map<string, Set<string>>();
    const set = (name: string, part: Element | null) => {
      const v = hotTokens(part);
      if ((el.getAttribute(name) ?? "") !== v) { if (v) el.setAttribute(name, v); else el.removeAttribute(name); }
      const now = new Set(litHosts(part));
      const was = lit.get(name) ?? new Set<string>();
      for (const id of was) if (!now.has(id)) el.removeAttribute(hotHostAttr(name, id));
      for (const id of now) if (!was.has(id)) el.setAttribute(hotHostAttr(name, id), "");
      lit.set(name, now);
    };
    const over = (e: PointerEvent) => set(HOT, partOf(e.target));
    const out = () => set(HOT, null);
    const focus = () => {
      const f = document.activeElement;
      const inside = f && el.contains(f) ? partOf(f) : null;
      set(`${HOT}-focus`, inside);
      set(`${HOT}-focus-visible`, inside && inside === f && f.matches(":focus-visible") ? inside : null);
    };
    const left = () => queueMicrotask(focus);
    const down = (e: PointerEvent) => set(`${HOT}-active`, partOf(e.target));
    const up = () => set(`${HOT}-active`, null);
    el.addEventListener("pointerover", over);
    el.addEventListener("pointerleave", out);
    el.addEventListener("focusin", focus);
    el.addEventListener("focusout", left);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerover", over);
      el.removeEventListener("pointerleave", out);
      el.removeEventListener("focusin", focus);
      el.removeEventListener("focusout", left);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      for (const a of [HOT, `${HOT}-focus`, `${HOT}-focus-visible`, `${HOT}-active`]) {
        el.removeAttribute(a);
        for (const id of lit.get(a) ?? []) el.removeAttribute(hotHostAttr(a, id));
      }
    };
  }, [board]);
}
