/**
 * Fixed sample content for the lanes: eleven offers, checked in so the
 * look and the behaviour can be judged before any of it is wired to
 * something live. The items are real findings from this project's own
 * suites, so a fix reads like a fix; where the work has really been
 * carried out, `did` says what it changed, written from the change itself.
 * The lanes are made from the list by band (`lanesOf`, where the lanes
 * are drawn): the cheap ones in the green lane at the top, the dear ones
 * in the red at the bottom. The day this is swapped for a live source,
 * that source hands over a list of items and nothing else changes. This
 * file imports nothing at run time, so the checks can read it off the disk.
 */
import type { Item } from "./lanesModel";

export const ITEMS: Item[] = [
  {
    id: "fix-aura-reference",
    kind: "fix",
    title: "The aura reference lands on the menu bar",
    detail: "space-one-open.mjs\nFAIL lit the same all the way round, not heavier on the left\n  lift left 247, right 245, top 212, bottom 245\n  background left 8, right 10, top 37, bottom 10",
    difficulty: 1,
    tokens: { in: 20_000, out: 3_000 },
    minutes: 4,
    did: "The check read the page's own brightness 180 pixels out from each side of the hole, and above the hole that landed on the menu bar's words, luma 37 against the page's 10. The reference point is now held inside the board's pane on every side. The top's lift reads 235 against 247 on the left, inside the 45 the check allows, and 19 of 19 hold. Nothing on the site itself changed: the light was right and the reading was wrong.",
  },
  {
    id: "fix-too-short-key",
    kind: "fix",
    title: "A key too short to be one is said to be missing",
    detail: "keys-live.mjs\nFAIL 4. a key too short to be one is said to be too short, not \"nothing offered\"\n  No key to try: nothing on the server and nothing offered by this browser.",
    difficulty: 1,
    tokens: { in: 12_000, out: 1_500 },
    minutes: 3,
    did: "The key test route drops any key of eight characters or fewer rather than send it anywhere, and used to answer that nothing had been offered. It now answers, for all four services, that the key held in this browser is too short to be one and to paste it whole. Nothing of what was pasted comes back in the sentence. The check that failed on the deploy passes on the branch.",
  },
  {
    id: "fix-requirements-band",
    kind: "fix",
    title: "A section of floated paragraphs arrives as five parts",
    detail: "zip-import.mjs\nFAIL a section whose paragraphs float is read where its words are\n  30 tall\nFAIL it says how many blocks the page is\n  Take the whole page, 10 blocks",
    difficulty: 3,
    tokens: { in: 60_000, out: 10_000 },
    minutes: 25,
    did: "The reader measured a section by its own box, which collapses to its heading when its paragraphs float. It now grows the box to hold the children that run out of it and touch it, with placed children never counting; a paragraph and a heading are named as such so a section of tall paragraphs is never opened as a column; and a column stretched up beside the floats of the section before it is trimmed to its own contents. The Zen Garden's Requirements section reads 1121 tall with six children inside and lands as one part. The harbour fixture went from ten blocks and five parts for one section to six blocks and one part.",
  },
  {
    id: "fix-no-key-ask",
    kind: "fix",
    title: "The ask for a missing key is off the board",
    detail: "keys-live.mjs\nFAIL 2. what the person sees after it says a key is wanted, on the board\n  only in News, after opening it: \"No Claude key yet. Paste one under the key button (⌘⇧K)\"",
    difficulty: 2,
    tokens: { in: 40_000, out: 8_000 },
    minutes: 6,
  },
  {
    id: "next-heading-by-tag",
    kind: "step",
    title: "Name the heading by its tag, not its size",
    detail: "Carry the run's tag out of the measurement and let the heading picker prefer an h1 to h6, falling back to size only when the page has no heading. Requirements is headed by its 32px closing line today.",
    difficulty: 3,
    tokens: { in: 60_000, out: 12_000 },
    minutes: 30,
  },
  {
    id: "next-footer-wins",
    kind: "step",
    title: "Let a tagged footer win over the card grid",
    detail: "A block tagged footer scores 1 as a footer and 1 as five cards, and the first to reach the top score wins. Put the footer before the cards in the catalogue, or score a tagged match above 1.",
    difficulty: 1,
    tokens: { in: 15_000, out: 2_000 },
    minutes: 5,
  },
  {
    id: "next-one-first-screen",
    kind: "step",
    title: "One page, one first screen",
    detail: "Three inner sections land as first screens because each is tall, high on the page and headed by a run over 28px. Claim only the first tall block, or ask for an h1 or h2 heading.",
    difficulty: 4,
    tokens: { in: 80_000, out: 12_000 },
    minutes: 45,
  },
  {
    id: "after-picture-field",
    kind: "step",
    title: "Give a landed part a place to hold a picture",
    detail: "A library part draws a placeholder where a picture goes and has no field for one. Add the field, hand the page's own picture to it on both doors, and the grounded step has something to fill.",
    difficulty: 5,
    tokens: { in: 120_000, out: 25_000 },
    minutes: 90,
  },
  {
    id: "after-fetch-font",
    kind: "step",
    title: "Fetch the web font a page names, on both doors",
    detail: "The face travels by name today and draws in the nearest class. Fetching the file the page's stylesheet points at, on the zip door and the address door, would make it draw as itself.",
    difficulty: 4,
    tokens: { in: 70_000, out: 10_000 },
    minutes: 60,
  },
  {
    id: "after-ask-on-board",
    kind: "step",
    title: "Put the no-key ask on the board",
    detail: "Queued jobs publish their news without toasts, which keeps the one line that asks for a key in the News panel. Give that one line a place on the board, beside the part that needed it.",
    difficulty: 2,
    tokens: { in: 30_000, out: 5_000 },
    minutes: 15,
  },
  {
    id: "after-keys-on-phone",
    kind: "step",
    title: "Prove the Keys panel on a phone",
    detail: "The five claims hold at 1500 wide. Run the same suite at 400 wide, where the panel is a sheet over the foot of the board, and add whatever fails.",
    difficulty: 3,
    tokens: { in: 40_000, out: 6_000 },
    minutes: 40,
  },
];
