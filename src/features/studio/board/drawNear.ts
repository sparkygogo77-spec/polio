/**
 * THE BOARD DRAWS WHAT IS IN VIEW FIRST, AND THE REST THE FRAME AFTER.
 *
 * Opening sol face's board, the first frame waited on React drawing all 800
 * parts, 13,500 elements, and on the words' measuring pass over all of them
 * (`textFit.ts#useKeepLines`), though the board opens at its top and a view
 * shows a tenth of it: 7.2 s at 4× CPU, against 4.4 s drawing only the parts
 * near the top first (MEASURED, median of 3). So on opening a big board, the
 * first frame holds the parts that stand within a view and a half of its
 * top, and the parts that ride the view wherever it is; the rest are drawn
 * in the next task after that frame has been painted.
 *
 * NOTHING MOVES FOR IT. A part stands where its document says (its own x, y,
 * w, h), whatever else is drawn, so a part drawn a frame later moves nothing.
 * What reads parts as drawn waits for all of them: the settle does not read
 * until every part is drawn (`useSettleToWords`'s `drawn`), and the far-part
 * watchers count the parts actually drawn. Once all are drawn, the board is
 * exactly the board it was. A part once drawn is never taken away again.
 *
 * Only on opening (or a page first shown) and only on a big board: a page of
 * a few hundred parts or less draws whole, as it did.
 */
import * as React from "react";

/** Parts or fewer: drawn whole, at once. */
const SMALL = 200;
/** How far down the board the first frame reaches: views below its top. */
const VIEWS = 1.5;

type Box = { id: string; y: number; h: number };

/**
 * Which parts to draw now. `zoom` is the board's applied scale; `rides` are
 * the parts drawn wherever the view is (pinned, sticky). `all` turns true in
 * the task after the first frame is painted, and stays true for this page.
 */
export function useDrawNear<T extends Box>(nodes: readonly T[], zoom: number, rides: ReadonlySet<string>, pageId: string | null): { drawn: readonly T[]; all: boolean } {
  const [allFor, setAllFor] = React.useState<string | null>(null);
  const all = nodes.length <= SMALL || allFor === pageId;
  /* The parts drawn so far on this page: once drawn, never undrawn. */
  const kept = React.useRef<{ page: string | null; ids: Set<string> }>({ page: pageId, ids: new Set() });
  if (kept.current.page !== pageId) kept.current = { page: pageId, ids: new Set() };
  const drawn = React.useMemo(() => {
    if (all) return nodes;
    const reach = (VIEWS * (typeof window === "undefined" ? 1000 : window.innerHeight)) / Math.max(zoom, 0.05);
    const ids = kept.current.ids;
    for (const n of nodes) if (n.y < reach || rides.has(n.id)) ids.add(n.id);
    return nodes.filter((n) => ids.has(n.id));
  }, [all, nodes, zoom, rides]);
  React.useEffect(() => {
    if (all) return;
    /* After the frame that shows the near parts has been painted: a frame callback runs before it, a task queued from there after it. */
    let t = 0;
    const f = requestAnimationFrame(() => { t = window.setTimeout(() => setAllFor(pageId), 0); });
    return () => { cancelAnimationFrame(f); window.clearTimeout(t); };
  }, [all, pageId]);
  return { drawn, all };
}
