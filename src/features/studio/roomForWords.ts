/**
 * WORDS THE BOARD PUTS IN A PART MAKE ROOM ON THEIR LINE (J, 2026-10-06).
 *
 * A page state or a sample gives a part other words ("Level" becomes
 * "Behind by 1.83 points"). On the site the line flows: the longer words
 * push what follows along. The board places parts where they were read, so
 * the longer words ran over "Time left". Here a one-line part whose words
 * grew is widened by as much as its words grew (measured off its own width
 * per letter, so its face and size count), and what follows it on its line,
 * in the same holder, moves along by that much, with everything inside it.
 *
 * A place read off a capture was measured with that capture's words
 * (`readWith`), so it grows only past those: "Go to the match" on a button
 * read holding "Go to the match" stays its width, not fifteen times the
 * "-" the page opened with (J, 2026-10-06: page state 9's button ran off
 * the board).
 *
 * Pure: `tests/state-rules.mjs`.
 */
import { plain } from "./parts/spans";

export type RoomBox = { x: number; y: number; w: number; h: number };
type RoomNode = { id: string; pageId: string; x: number; y: number; w: number; h: number; content?: unknown; from?: { selector?: string } | null };

const parentSel = (s: string) => { const i = s.lastIndexOf(" > "); return i > 0 ? s.slice(0, i) : ""; };

export function roomForWords(nodes: readonly RoomNode[], pageId: string, shows: (n: RoomNode) => boolean, places: ReadonlyMap<string, RoomBox>, looks: ReadonlyMap<string, { content?: unknown }>, readWith: ReadonlyMap<string, string> = new Map()): Map<string, RoomBox> {
  const out = new Map(places);
  const here = nodes.filter((n) => n.pageId === pageId && shows(n));
  const box = (n: RoomNode): RoomBox => out.get(n.id) ?? { x: n.x, y: n.y, w: n.w, h: n.h };
  const sel = (n: RoomNode) => n.from?.selector?.replace(/ ::line\(\d+\)$/, "") ?? null;
  for (const n of here) {
    const look = looks.get(n.id);
    if (!look || look.content === undefined) continue;
    const was = (out.has(n.id) ? readWith.get(n.id) : undefined)?.trim() ?? plain(n.content as never).trim(), now = plain(look.content as never).trim();
    if (!was || now.length <= was.length || now.includes("\n")) continue;
    const b = box(n);
    /* One line: about as tall as its letters are wide apart allows (a wrapped block keeps its width and grows down instead). */
    if (b.h > 2.2 * Math.max(12, b.w / Math.max(1, was.length) * 1.9)) continue;
    const grow = Math.ceil(b.w * (now.length / was.length) - b.w);
    if (grow <= 0) continue;
    out.set(n.id, { ...b, w: b.w + grow });
    const me = sel(n);
    if (!me) continue;
    const holder = parentSel(me);
    const right = b.x + b.w;
    /* What follows on its line, in its holder, and what is inside those. */
    const along = here.filter((o) => {
      const s = sel(o);
      if (!s || o.id === n.id || parentSel(s) !== holder) return false;
      const ob = box(o);
      return ob.x >= right - 2 && ob.y < b.y + b.h && ob.y + ob.h > b.y;
    });
    const moved = new Set<string>();
    for (const o of along) {
      const s = sel(o)!;
      for (const x of here) {
        const xs = sel(x);
        if (moved.has(x.id) || !xs || (xs !== s && !xs.startsWith(`${s} `))) continue;
        moved.add(x.id);
        const xb = box(x);
        out.set(x.id, { ...xb, x: xb.x + grow });
      }
    }
  }
  return out;
}
