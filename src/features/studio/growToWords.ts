"use client";
/**
 * A ONE-LINE BOX GROWS TO HOLD THE WORDS JUST TYPED INTO IT.
 *
 * His words: "the boxes should extend on their own ESPECIALLY text boxes
 * because one line is almost always preferred". He added one space to "A
 * SolWorks project" and had to drag the box wider himself.
 *
 * So after an edit to a part's words, the part is measured as the board draws
 * it: its words set on one line, unwrapped and uncapped, against the surface
 * they have. A part one line tall whose words no longer fit grows by exactly
 * the shortfall. Only wider, never narrower, never taller, and only the part
 * that was edited: nothing imported is looked at, and a paragraph that wraps
 * on purpose (a box taller than one line) is left to wrap.
 *
 * Not a checkpoint of its own. The typing that caused it already pushed one,
 * so undoing the typing puts the width back with it.
 */
import { useStudio } from "./store";
import { atFullSize } from "./textFit";

export function growToWords(id: string): void {
  if (typeof window === "undefined") return;
  /* Two frames: the words just written have to be drawn before they can be measured. */
  /* Read at one to one: words laid out at the board's zoom are not the page's words (`textFit.ts#atFullSize`). */
  requestAnimationFrame(() => requestAnimationFrame(() => atFullSize(() => {
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    const surface = document.querySelector(`[data-node-id="${id}"] [data-part]`);
    const frame = document.querySelector("[data-frame]");
    if (!n || !(surface instanceof HTMLElement) || !frame) return;
    const zoom = frame.getBoundingClientRect().width / Math.max(1, s.frameWidth);
    if (!(zoom > 0)) return;
    const c = surface.cloneNode(true) as HTMLElement;
    c.removeAttribute("data-part");
    c.style.cssText += ";position:absolute;left:0;top:0;width:max-content;height:auto;min-height:0;visibility:hidden;flex:none;margin:0";
    for (const e of [c, ...Array.from(c.querySelectorAll<HTMLElement>("*"))]) { e.style.maxWidth = "none"; e.style.whiteSpace = "nowrap"; }
    surface.parentElement?.appendChild(c);
    const one = c.getBoundingClientRect();
    c.remove();
    const has = surface.getBoundingClientRect().width;
    const oneLineTall = n.h < 1.5 * (one.height / zoom);
    const short = (one.width - has) / zoom;
    if (!oneLineTall || !(short > 0.5)) return;
    useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, w: Math.ceil(x.w + short) } : x)) }));
  })));
}
