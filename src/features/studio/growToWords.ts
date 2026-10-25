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
import { useStudio, type StudioNode } from "./board/store";
import { atFullSize } from "./textFit";
import { holds, parentOf } from "./owner";

/**
 * HOW FAR RIGHT A PART MAY GROW: THE RIGHT EDGE OF ITS COLUMN (EDIT-ISSUES #29,
 * J, 2026-10-23). Long words in a one-line part wrap inside its column, as the
 * page would have wrapped them, instead of widening it off the page: gotchi's
 * heading "your bag keeps it alive." given a sentence went 537 -> 2,366 wide.
 * The column ends at its holder's inner edge (the holder's own inset, read
 * off where its parts start, taken on both sides), or the page's edge when
 * nothing holds it, and before any part standing beside it on its rows (the
 * picture column next to that heading), a gap kept to it.
 */
export function columnRight(nodes: readonly StudioNode[], n: StudioNode, frameWidth: number): number {
  const page = nodes.filter((x) => x.pageId === n.pageId && !x.state);
  let right = frameWidth;
  /* A holder its parts fill edge to edge is one that sizes to them (the sink header's wordmark: three wrappers, each 216 wide round 216 of words), and grows with them on the page: the column is the first holder with room of its own. */
  for (let holder = parentOf(page, n), hops = 0; holder && hops < 8; holder = parentOf(page, holder), hops++) {
    const h = holder;
    const kids = page.filter((x) => x.id !== h.id && parentOf(page, x)?.id === h.id);
    const left = Math.min(n.x, ...kids.map((k) => k.x)), end = Math.max(n.x + n.w, ...kids.map((k) => k.x + k.w));
    if (Math.abs(left - h.x) <= 1 && Math.abs(end - (h.x + h.w)) <= 1) continue;
    const inset = Math.max(0, left - h.x);
    right = Math.min(right, h.x + h.w - inset);
    break;
  }
  for (const b of page) {
    if (b.id === n.id || holds(b, n) || holds(n, b)) continue;
    const pos = (b as { from?: { position?: string } | null }).from?.position;
    if (pos === "fixed" || pos === "absolute") continue;
    const overlapY = Math.min(b.y + b.h, n.y + n.h) - Math.max(b.y, n.y);
    if (overlapY < Math.min(b.h, n.h) / 2 || b.x < n.x + n.w - 2) continue;
    const gap = Math.min(16, Math.max(0, b.x - (n.x + n.w)));
    right = Math.min(right, b.x - gap);
  }
  return Math.max(n.x + n.w, right);
}

/**
 * The part made `want` wide, or, when that runs past its column, as wide as
 * its column and its words let wrap (`text.wrap`, which `Text` and `ValueProp`
 * read as "not held to one line"): the board then draws it taller, and the
 * settle writes that height down and moves what is below, its holder growing
 * with it. Only wider, never narrower.
 */
export function widenInColumn(id: string, want: number): void {
  const s = useStudio.getState();
  const n = s.nodes.find((x) => x.id === id);
  if (!n || !(want > n.w + 0.5)) return;
  const room = Math.floor(columnRight(s.nodes, n, s.frameWidth) - n.x);
  const fits = want <= room + 0.5;
  const w = fits ? Math.ceil(want) : Math.max(n.w, room);
  useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, w, ...(fits ? {} : { text: { ...(x.text ?? {}), wrap: "wrap" as const } }) } : x)) }));
}

/**
 * WORDS HELD TO THEIR ROWS GROW THEIR PART WHEN THEIR LOOK DOES. A part whose words are held on one row each (a captured
 * button's label, a heading broken with `<br>`s, a one-line paragraph: `white-space: nowrap` as drawn) and whose size,
 * face or spacing was just changed in the panel ran past its own box: sol face's "JOIN THE WAVE ↗" 222px over the edge
 * at 1.5 times its size, its heading 787px (the hand-edit pass, 2026-10-22). Such a part is made as wide as the rows now
 * drawn past it, on whichever side they run past, and one row as tall as it is drawn. Only wider and taller; not a step of undo of its own (the edit that caused it
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
    /* The part's own drawing: its name tag and its note, drawn beside it on the board, are not its words. */
    const drawn = el.querySelector<HTMLElement>("[data-part-drawn]") ?? el;
    let l = Infinity, r = -Infinity, size = 0, held = false;
    const tops: number[] = [];
    const rg = document.createRange(), walk = document.createTreeWalker(drawn, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      if (!(t.textContent ?? "").trim() || !t.parentElement) continue;
      const cs = getComputedStyle(t.parentElement);
      if (cs.whiteSpace === "nowrap") held = true;
      size = Math.max(size, parseFloat(cs.fontSize) || 0);
      rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) if (q.width > 0) { l = Math.min(l, q.left); r = Math.max(r, q.right); if (!tops.some((y) => Math.abs(y - q.top) < q.height / 2)) tops.push(q.top); }
    }
    /* Or one row that cannot break: share.xyz's "Share", one word, made bigger ran 32px past its box with nothing held (tests/size-widens.mjs). */
    if ((!held && tops.length !== 1) || !(r > l)) return;
    const over = (Math.max(0, box.left - l) + Math.max(0, r - box.right)) / zoom;
    /* And as tall as its one row needs: a captured row is set at its box's height, so share.xyz's "Share" made bigger (35px words on a 28px line) ran 7px under the foot and over the top (EDIT-ISSUES #31). Its row is its size at its own leading; letters taller than a tight line are the page's (EDIT-ISSUES #24) and not grown for. The settle then moves what is below. */
    const under = tops.length === 1 && size > 0 ? Math.ceil(size * (n.font?.leading ?? 1.2)) - n.h : 0;
    if (!(over > 0.5) && !(under > 0.5)) return;
    /* Widened, not wrapped: a size change keeps its rows (one line is almost always preferred); only typed words wrap in their column. Through the column, share.xyz's label made bigger went onto two rows. */
    useStudio.setState((st) => ({ nodes: st.nodes.map((x) => (x.id === id ? { ...x, ...(over > 0.5 ? { w: Math.ceil(x.w + over) } : {}), ...(under > 0.5 ? { h: x.h + under } : {}) } : x)) }));
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
      widenInColumn(id, want);
      return;
    }
    const has = surface.getBoundingClientRect().width;
    const oneLineTall = n.h < 1.5 * (one.height / zoom);
    const short = (one.width - has) / zoom;
    if (!oneLineTall || !(short > 0.5)) return;
    widenInColumn(id, n.w + short);
  })));
}
