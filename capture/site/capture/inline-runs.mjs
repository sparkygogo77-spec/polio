/**
 * WORDS ON ONE LINE BESIDE ELEMENTS, PUT BACK IN THEIR ORDER.
 *
 * The PonsStars screens: "Match: <code>m_7f3a9c</code> Round: <b>0</b>
 * Status: <b>live</b>" came out as "Match: Round: Status:" with its three
 * values laid over it, and the nav "Play | Leaderboard | My profile | How it
 * works" as "PlayLeaderboardMy profileHow it works | | |". An element's own
 * words were one string with one box, so the hole arbiter (hole-arbiter.mjs)
 * could only try every place for all the children's words as one block: the
 * links fitted at the start, before every bar, and the three values fitted
 * nowhere.
 *
 * A capture taken since records each run of an element's own words with its
 * box (dump.mjs, `ot`). On one line, the runs and the children sort by x
 * into the order the page drew them, so nothing is measured or guessed:
 *
 *   - a sentence (its own words are words) whose children are all words
 *     folds them back in as runs, in that order, with the spaces its own
 *     text nodes hold (a space either side of a child, collapsed as the
 *     browser collapses it);
 *   - a line whose own words only separate (the bars of a nav) keeps its
 *     children as parts, and each run of its own words becomes a part of its
 *     own at its box.
 *
 * Only a line of words and links: one with an icon or a dot in it (a LIVE
 * badge) is set as before. A capture without `ot` is left to the hole
 * arbiter.
 *
 * A SENTENCE THAT WRAPS FOLDS TOO, BY THE ORDER THE PAGE WROTE IT. A capture
 * taken since records, with each run of own words, how many of the
 * element's kids come before it in the DOM (`ot[6]`, dump.mjs), and a <br>
 * as a run of "\n". sunkcoin.fun's title "The coin that pays<br><em>your sunk
 * cost.</em>" and its paragraph with three bold runs across four lines came
 * in as a sentence with holes and the children as parts of their own at
 * their measured places, which overlapped the moment the board's lines
 * broke elsewhere (J, 2026-10-11). Put back in DOM order they are one part
 * with runs, broken where the page broke them, and the browser sets the
 * lines (check-mixed-sentence.mjs). Boxes decide nothing then; an older
 * capture, without the order, still folds only a line that does not wrap.
 */

import { kidsByParent } from "./hole-arbiter.mjs";

const TEXT_KINDS = new Set(["prose", "value-prop"]);
/** Words that only separate (a nav's bars, dots, slashes, dashes), never a sentence. */
const SEPARATORS = /^[\s|·•∙/\\–—\-:;,>»›<«‹+*~]*$/;

/**
 * For each part with its own words recorded run by run (`elOf(p).ot`) on one
 * line beside its children: `{ p, kids, mode: "fold", runs }` (runs in page
 * order, a child as `{ kid }`) or `{ p, kids, mode: "split", own }` (each
 * run of its own words, with its box). Pure: changes nothing.
 */
export function inlineLines(nodes, elOf, skip = new Set()) {
  const out = [];
  const under = kidsByParent(nodes);
  for (const p of nodes) {
    if (skip.has(p.id) || typeof p.content !== "string" || !p.content.trim() || !p.from?.selector) continue;
    const el = elOf(p.id);
    const ot = el?.ot;
    if (!Array.isArray(ot) || !ot.length) continue;
    const kids = (under.get(`${p.pageId}|${p.from.selector}`) ?? []).filter((c) => c !== p && !skip.has(c.id));
    if (!kids.length) continue;
    /* The order the page wrote them, when the capture recorded it (`before` on every run). */
    const ordered = ot.every((r) => Number.isInteger(r[6]) && r[6] >= 0);
    /* One line: every run and every child stand across the first run's middle. */
    const first = ot.find((r) => r[4] > 0) ?? ot[0];
    const mid = first[2] + first[4] / 2;
    const across = (y, h) => y - 1 <= mid && mid <= y + h + 1;
    const oneLine = ot.every((r) => r[5] === 1 && r[0] !== "\n" && across(r[2], r[4])) && kids.every((k) => across(k.y, k.h));
    if (!ordered && !oneLine) continue;
    /*
     * A FLEX OR GRID CONTAINER'S ITEMS ARE NOT ONE SENTENCE. Its own words are
     * an item of their own (an anonymous one) beside each child. When those
     * words wrap or break across lines they are no line with the child on it:
     * thesolface's sign-off, a 60px arrow beside two lines, folded into one
     * sentence drew 133px tall against the 60 the page measured
     * (check-flex-wrap-fold.mjs). The child stays a part, and the words become
     * a part of their own at the box they were drawn in (below). A row whose
     * words stay on one line still folds.
     */
    const flexed = /(flex|grid)$/.test(el.disp ?? "") && !oneLine;
    const words = ot.map((r) => r[0]).join("");
    const own = ot.map(([text, x, y, w, h], i) => ({ text, x, y, w, h, i }));
    /* Every element it holds is one of these children: nothing else on the line sits between the words. */
    /* Only words and links on the line: a line with an icon or a dot in it (a LIVE badge) is the converter's own to set (its words after the icon). */
    const dumpKids = (el.kids ?? []).filter((k) => !k.pseudo);
    const shown = dumpKids.filter((k) => k.w > 0 && k.h > 0).length;
    if (shown !== kids.length || !kids.every((k) => TEXT_KINDS.has(k.featureId) && typeof k.content === "string" && k.content.trim())) continue;
    if (flexed) {
      /* All the words of the item, its lines kept (a <br> is a newline run), at the union of the boxes of its runs. */
      const NL = String.fromCharCode(10);
      const lines = own.filter((o) => o.text !== NL && o.text.trim());
      if (!lines.length || SEPARATORS.test(words)) continue;
      const x0 = Math.min(...lines.map((o) => o.x)), y0 = Math.min(...lines.map((o) => o.y));
      const x1 = Math.max(...lines.map((o) => o.x + o.w)), y1 = Math.max(...lines.map((o) => o.y + o.h));
      const text = own.map((o) => o.text).join("").replace(/[ \t]*\n[ \t]*/g, NL);
      out.push({ p, kids, mode: "split", own: [{ text, x: x0, y: y0, w: x1 - x0, h: y1 - y0, i: lines[0].i }] });
    } else if (!SEPARATORS.test(words)) {
      let pieces;
      if (ordered) {
        /* A run before its kid number b sits at 2b, the kid at 2b+1: the sentence as written, whatever the boxes say. */
        const at = kids.map((k) => dumpKids.indexOf(elOf(k.id)));
        if (at.some((i) => i < 0)) continue;
        pieces = [...ot.map((r) => ({ key: r[6] * 2, text: r[0] })), ...kids.map((k, i) => ({ key: at[i] * 2 + 1, kid: k }))].sort((a, b) => a.key - b.key);
      } else {
        pieces = [...own.map((o) => ({ x: o.x, text: o.text })), ...kids.map((k) => ({ x: k.x, kid: k }))].sort((a, b) => a.x - b.x);
      }
      out.push({ p, kids, mode: "fold", runs: pieces, ...(ordered ? { ordered: true } : {}) });
    } else if (oneLine) {
      out.push({ p, kids, mode: "split", own: own.filter((o) => o.text.trim()) });
    }
  }
  return out;
}

/**
 * The runs of a folded line, its white space collapsed as the browser
 * collapses it: a space after a space is dropped, none at the line's ends,
 * and plain words beside plain words are one run. `run(kid)` makes a child's
 * (one run, or several where the child was folded first and holds runs).
 *
 * IN A FLEX ROW, THE ROW'S GAP STANDS BETWEEN ITS ITEMS. mochi.trade's
 * "Live · MochiMan is up ▼86.7% this week →" is an <a> laid out as a flex
 * row with an 8px gap: each child is an item, and so is each stretch of its
 * own words between them. Folded with only the spaces its text held, it
 * read "LiveMochiMan is up 86.7% this week→". With `flex` ({ gap, fs }), a
 * stretch of words is one item, its ends trimmed as a line's are (one that
 * is only white space is no item at all), and a spacer run carries the gap
 * between every two items: a space, padded out to the gap (the marquee's
 * spacer, capture-to-document.mjs). `check-flex-gap-runs.mjs`.
 */
/** Each side's padding on a spacer run (a space, about a quarter of the type) so that it stands `gap` wide. */
export const gapSide = (gap, fs) => Math.max(0, Math.round(((gap - (fs || 16) * 0.27) / 2) * 10) / 10);

export function foldRuns(pieces, run, flex = null) {
  const runs = [];
  const ends = () => { const last = runs[runs.length - 1]; return last ? /[ \n]$/.test(last.text) : true; };
  const asRuns = (k) => { const r = run(k); return Array.isArray(r) ? r : [r]; };
  let items = pieces;
  if (flex && flex.gap > 0) {
    const grouped = [];
    for (const pc of pieces) {
      const last = grouped[grouped.length - 1];
      if (!pc.kid && last && !last.kid) last.text += pc.text;
      else grouped.push(pc.kid ? pc : { text: pc.text });
    }
    const side = gapSide(flex.gap, flex.fs);
    items = [];
    for (const it of grouped) {
      if (!it.kid) { it.text = it.text.replace(/^[ \t]+|[ \t]+$/g, ""); if (!it.text.trim()) continue; }
      if (items.length) items.push({ spacer: { text: " ", pad: [0, side, 0, side] } });
      items.push(it);
    }
  }
  for (const pc of items) {
    if (pc.spacer) { runs.push({ ...pc.spacer }); continue; }
    for (const r of pc.kid ? asRuns(pc.kid) : [{ text: pc.text }]) {
      let text = r.text;
      if (text.startsWith(" ") && ends()) text = text.replace(/^ +/, "");
      if (!text) continue;
      const last = runs[runs.length - 1];
      /* A line break (a <br>): no space before it, and the run it closes keeps it, so `lines()` cuts there. */
      if (text === "\n" && last) last.text = last.text.replace(/ +$/, "");
      if (!pc.kid && last && Object.keys(last).length === 1) last.text += text;
      else runs.push({ ...r, text });
    }
  }
  const last = runs[runs.length - 1];
  if (last) last.text = last.text.replace(/[ \n]+$/, "");
  return runs.filter((r) => r.text);
}

/** A run of a part's own words as a part of its own, at its box: the part's words and type, none of its box's dress. */
export function wordsPart(p, o, id) {
  const { layout, pad, edge, radius, radii, radiiY, vh, units, motion, embed, picture, art, rows, world, media, maxw, link, colour, ...rest } = p;
  const text = o.text.trim();
  return {
    ...rest,
    id,
    featureId: "prose",
    label: text,
    content: text,
    data: "",
    x: o.x, y: o.y, w: o.w, h: o.h,
    link: null,
    colour: colour?.text ? { text: colour.text } : null,
    from: { ...p.from, selector: `${p.from.selector}::text(${o.i + 1})` },
  };
}
