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
import { useStudio } from "./board/store";
import { atFullSize } from "./textFit";

/**
 * WORDS HELD TO THEIR ROWS GROW THEIR PART WHEN THEIR LOOK DOES. A part whose words are held on one row each (a captured
 * button's label, a heading broken with `<br>`s, a one-line paragraph: `white-space: nowrap` as drawn) and whose size,
 * face or spacing was just changed in the panel ran past its own box: sol face's "JOIN THE WAVE ↗" 222px over the edge
 * at 1.5 times its size, its heading 787px (the hand-edit pass, 2026-10-22). Such a part is made as wide as the rows now
 * drawn past it, on whichever side they run past. Only wider; not a step of undo of its own (the edit that caused it
 * took one, and undoing it puts the width back with it). `tests/size-widens.mjs`.
 */
export function heldRowsGrow(id: string): void {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => requestAnimationFrame(() => atFullSize(() => {
    const s = useStudio.getState();
    const n = s.nodes.find((x) => x.id === id);
    const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    const frame = document.querySelector("[data-frame]");
    if (!n || !el || !frame) return;
    const zoom = frame.getBoundingClientRect().width / Math.max(1, s.frameWidth);
    if (!(zoom > 0)) return;
    const box = el.getBoundingClientRect();
    let l = Infinity, r = -Infinity, held = false;
    const rg = document.createRange(), walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!(t.textContent ?? "").trim() || !t.parentElement) continue;
      if (getComputedStyle(t.parentElement).whiteSpace === "nowrap") held = true;
      rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) if (q.width > 0) { l = Math.min(l, q.left); r = Math.max(r, q.right); }
    }
    if (!held || !(r > l)) return;
    const over = (Math.max(0, box.left - l) + Math.max(0, r - box.right)) / zoom;
    if (!(over > 0.5)) return;
    useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, w: Math.ceil(x.w + over) } : x)) }));
  })));
}

/**
 * `row`: the words were one row when they were opened on the canvas (`WordsInPlace.tsx`), with this much room
 * between them and the part's left and right edges. Their one row is then the test, not the part's height (a
 * button's own padding made "Find my wallet" a 38px part round a 19px line), and the part is as wide as the room
 * either side and the words' one row.
 */
export function growToWords(id: string, row?: { gapL: number; gapR: number }): void {
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
    if (row) {
      const want = Math.ceil(row.gapL + one.width / zoom + row.gapR);
      if (want > n.w + 0.5) useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, w: want } : x)) }));
      return;
    }
    const has = surface.getBoundingClientRect().width;
    const oneLineTall = n.h < 1.5 * (one.height / zoom);
    const short = (one.width - has) / zoom;
    if (!oneLineTall || !(short > 0.5)) return;
    useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, w: Math.ceil(x.w + short) } : x)) }));
  })));
}
