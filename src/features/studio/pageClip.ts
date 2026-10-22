/**
 * WHAT IS OFF THE PAGE IS NOT THE PAGE.
 *
 * A part standing past the page's top, left or right edge is drawn cut at
 * it on the board, as the site and the export cut it (trumpmorty.fun's
 * planet at -355,-441, its hero layers and ribbons past both sides). The page
 * grows downward to hold what is below it, so the foot is never cut. Only the
 * part's drawing is: its box, selection and handles, and the ink round the
 * page, are not (`tests/board-clips.mjs`, `tests/board-edges.mjs`).
 *
 * AND IT IS CUT WHERE IT IS DRAWN. A part moved by its own translation (a
 * `transform` that only shifts it, a `translate` in px) is drawn away from
 * its box, and an inset cuts at the box: thesolface's frog, recorded at
 * x 1049 and shifted -345px, is drawn at 704 to 1394, inside the page, and
 * was cut in half (J, 2026-10-21). Such a part is cut by where its drawing
 * stands: not at all inside the page, else along the drawing, in the part's
 * own frame (`tests/page-clip-shifted.mjs`).
 */
export function pageClip(n: { x: number; y: number; w: number; h?: number; art?: { transform?: string; translate?: string } | null }, pageW: number): string | undefined {
  const { tx, ty } = shiftOf(n.art);
  if (!tx && !ty) {
    const top = Math.max(0, -n.y), left = Math.max(0, -n.x), right = Math.max(0, n.x + n.w - pageW);
    if (!top && !left && !right) return undefined;
    return `inset(${top}px ${right}px 0px ${left}px)`;
  }
  const x = n.x + tx, y = n.y + ty;
  if (x >= 0 && y >= 0 && x + n.w <= pageW) return undefined;
  /* In the part's own frame: the drawing spans [tx, tx + w], the page [-x, pageW - x]; the foot is never cut. */
  const L = Math.max(-n.x, tx), R = Math.min(pageW - n.x, tx + n.w), T = Math.max(-n.y, ty);
  const px = (v: number) => `${Math.round(v * 100) / 100}px`;
  return `polygon(${px(L)} ${px(T)}, ${px(R)} ${px(T)}, ${px(R)} 100000px, ${px(L)} 100000px)`;
}

/** How far a part's own transform and translate move it, when that is all they do; a turn or a scale is not read. */
function shiftOf(art: { transform?: string; translate?: string } | null | undefined): { tx: number; ty: number } {
  let tx = 0, ty = 0;
  const m = /^matrix\(\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*\)$/.exec(art?.transform?.trim() ?? "");
  if (m) {
    const [a, b, c, d, e, f] = m.slice(1).map(Number) as [number, number, number, number, number, number];
    const only = Math.abs(a - 1) < 1e-3 && Math.abs(d - 1) < 1e-3 && Math.abs(b) < 1e-3 && Math.abs(c) < 1e-3;
    if (!only) return { tx: 0, ty: 0 };
    tx += e; ty += f;
  }
  const t = /^(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?$/.exec(art?.translate?.trim() ?? "");
  if (t) { tx += Number(t[1]); ty += Number(t[2] ?? 0); }
  return { tx, ty };
}

/**
 * THE CAPTURE'S OWN CUT, ON A PART THAT MOVES ITSELF. The capture cuts a part
 * where it hangs out of the box that holds it (`art.clipPath`, an inset), and
 * a part with an animation wears that cut on a still box round it
 * (`blocks.tsx#StillCut`). An inset also cuts at the part's box on every side
 * it leaves at 0, and a part moved by its own translation is drawn off that
 * box: thesolface's frog, cut only at the hero's foot (17px) and shifted
 * -345px, lost its left half there. Shifted, only the sides the capture cut
 * are cut, and the others are left open (tests/page-clip-shifted.mjs).
 */
export function stillCutOf(cut: string | undefined | null, art?: { transform?: string; translate?: string } | null): string | undefined {
  if (!cut) return undefined;
  const { tx, ty } = shiftOf(art);
  const m = /^inset\(\s*(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?(?:\s+(-?[\d.]+)px)?\s*\)$/.exec(cut.trim());
  if ((!tx && !ty) || !m) return cut;
  const t = Number(m[1]), r = Number(m[2] ?? m[1]), b = Number(m[3] ?? m[1]), l = Number(m[4] ?? m[2] ?? m[1]);
  const OPEN = 100000;
  const L = l > 0 ? `${l}px` : `-${OPEN}px`, R = r > 0 ? `calc(100% - ${r}px)` : `calc(100% + ${OPEN}px)`;
  const T = t > 0 ? `${t}px` : `-${OPEN}px`, B = b > 0 ? `calc(100% - ${b}px)` : `calc(100% + ${OPEN}px)`;
  return `polygon(${L} ${T}, ${R} ${T}, ${R} ${B}, ${L} ${B})`;
}
