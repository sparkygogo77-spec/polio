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
    const words = ot.map((r) => r[0]).join("");
    const own = ot.map(([text, x, y, w, h], i) => ({ text, x, y, w, h, i }));
    /* Every element it holds is one of these children: nothing else on the line sits between the words. */
    /* Only words and links on the line: a line with an icon or a dot in it (a LIVE badge) is the converter's own to set (its words after the icon). */
    const dumpKids = (el.kids ?? []).filter((k) => !k.pseudo);
    const shown = dumpKids.filter((k) => k.w > 0 && k.h > 0).length;
    if (shown !== kids.length || !kids.every((k) => TEXT_KINDS.has(k.featureId) && typeof k.content === "string" && k.content.trim())) continue;
    if (!SEPARATORS.test(words)) {
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
 * and plain words beside plain words are one run. `run(kid)` makes a child's.
 */
export function foldRuns(pieces, run) {
  const runs = [];
  const ends = () => { const last = runs[runs.length - 1]; return last ? /[ \n]$/.test(last.text) : true; };
  for (const pc of pieces) {
    const r = pc.kid ? run(pc.kid) : { text: pc.text };
    let text = r.text;
    if (text.startsWith(" ") && ends()) text = text.replace(/^ +/, "");
    if (!text) continue;
    const last = runs[runs.length - 1];
    /* A line break (a <br>): no space before it, and the run it closes keeps it, so `lines()` cuts there. */
    if (text === "\n" && last) last.text = last.text.replace(/ +$/, "");
    if (!pc.kid && last && Object.keys(last).length === 1) last.text += text;
    else runs.push({ ...r, text });
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
