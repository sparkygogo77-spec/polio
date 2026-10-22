/**
 * WHICH PART THE POINTER, THE FOCUS AND A PRESS ARE ON, AS WORDS A RULE CAN NAME.
 *
 * A captured group state (hover, focus, press) fires when it is on any part
 * of the group (`capturedMotion.ts#motionCss`, given `hot`). Said with
 * `:root:has(…)`, every element the board restyled cost about twice as much.
 * Here the board's own element carries one attribute a state
 * (`capturedMotion.ts#hotAttr`): the id of the part the state is on, and
 * `@` + each path its code (`data-at`) stands strictly under, the same parts
 * `[data-at^="code"]:not([data-at="code"])` picked.
 *
 *   data-hot                the part under the pointer (`:hover`)
 *   data-hot-focus          the part focus is inside (`:focus-within`)
 *   data-hot-focus-visible  the part that is itself focused, visibly (`:focus-visible`)
 *   data-hot-active         the part pressed, while pressed (`:active`)
 */
import * as React from "react";

export const HOT = "data-hot";

const partOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-node-id]") : null);

/** The tokens for a part: its id, and every path strictly above its code. */
export function hotTokens(part: Element | null): string {
  if (!part) return "";
  const out = [part.getAttribute("data-node-id") ?? ""];
  const code = part.getAttribute("data-at") ?? "";
  for (let i = code.indexOf("."); i > 0 && i < code.length - 1; i = code.indexOf(".", i + 1)) out.push(`@${code.slice(0, i + 1)}`);
  return out.filter(Boolean).join(" ");
}

/** Keep the state attributes on the board's element in step with the parts they are on. */
export function useHoverHot(board: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const el = board.current;
    if (!el) return;
    const set = (name: string, v: string) => { if ((el.getAttribute(name) ?? "") !== v) { if (v) el.setAttribute(name, v); else el.removeAttribute(name); } };
    const over = (e: PointerEvent) => set(HOT, hotTokens(partOf(e.target)));
    const out = () => set(HOT, "");
    const focus = () => {
      const f = document.activeElement;
      const inside = f && el.contains(f) ? partOf(f) : null;
      set(`${HOT}-focus`, hotTokens(inside));
      set(`${HOT}-focus-visible`, inside && inside === f && f.matches(":focus-visible") ? hotTokens(inside) : "");
    };
    const left = () => queueMicrotask(focus);
    const down = (e: PointerEvent) => set(`${HOT}-active`, hotTokens(partOf(e.target)));
    const up = () => set(`${HOT}-active`, "");
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
      for (const a of [HOT, `${HOT}-focus`, `${HOT}-focus-visible`, `${HOT}-active`]) el.removeAttribute(a);
    };
  }, [board]);
}
