/**
 * THE FIX LOOP: REAL ISSUES, TICKED, QUEUED FOR THE NEXT CODE CHAT.
 *
 * J (2026-10-08): "if the code generates an issue and builder recognizes it
 * you can view it and choose what needs a fix through the blue boxes and the
 * api queues a fix in the document for the next code chat to interpret and
 * fix". Audit item 7 (`builder-audit.md`, section 4), end to end:
 *
 *   1. Spot.   The board's own check (`publishCheck.ts`: links, pictures,
 *              hard-to-read words, parts that spill at phone width, the
 *              orange "!" parts that do nothing yet) hands its problems
 *              here, and each becomes a lane item (`issueItem`). The lanes
 *              show these instead of their sample whenever there are any.
 *   2. Pick.   Tick a card and it turns blue. The ticks are kept on the
 *              board (`look.fixLoop`).
 *   3. Queue.  Publish writes the ticked ones into `polio/NEXT.md` in the
 *              site's repository (`nextMd`): the hook, what is wrong, and
 *              what done looks like, one line each. The kit's CLAUDE.md
 *              tells every code chat to read it first.
 *   4. Land.   Refresh reads the file back (`fixedIn`): a line the code chat
 *              ticked (`- [x]`) or deleted is fixed, and becomes a blue box
 *              on the timeline.
 *
 * No server is involved: the file in the repository is the queue, so it
 * works with any code chat. This file imports nothing at run time, so
 * `tests/fix-loop.mjs` reads it straight off the disk.
 */
import type { Difficulty, Item } from "./lanes";

/** Where the queue lives in a site's repository. The kit's CLAUDE.md names the same path. */
export const NEXT_PATH = "polio/NEXT.md";

/** One problem the board found, as the loop carries it. `key` is the check's own stable key. */
export interface FixIssue {
  key: string;
  /** The check's kind: link, share, picture, words, fit, nowhere. */
  kind: string;
  hook: string | null;
  page: string;
  says: string;
}

/** What the board keeps (`look.fixLoop`): the ticked keys, and what went into NEXT.md and is not fixed yet. */
export interface FixLoop {
  ticked: string[];
  sent: FixIssue[];
}

export const NO_LOOP: FixLoop = { ticked: [], sent: [] };

/** What done looks like for each kind, so the code chat knows when to tick the line. */
export const DONE_WHEN: Record<string, string> = {
  link: "the link leads within the site, to pump.fun, or to DEX Screener without one token's address, or it is no longer a link",
  share: "the share link is kept on purpose or removed",
  picture: "the part shows its picture from a file in the repository",
  words: "the words read clearly on what is behind them (the Builder's Readable words check passes)",
  fit: "the part stays inside the page at phone and tablet width",
  nowhere: "pressing it does something: it leads somewhere or runs its script",
};

/** How hard each kind is to fix in code. Difficulty picks the model, the cost and so the lane (`lanes.ts`). */
const HARD: Record<string, Difficulty> = { link: 1, share: 1, words: 1, nowhere: 2, picture: 2, fit: 4 };
const TOKENS: Record<Difficulty, { in: number; out: number }> = {
  1: { in: 15_000, out: 2_000 },
  2: { in: 30_000, out: 4_000 },
  3: { in: 60_000, out: 8_000 },
  4: { in: 80_000, out: 10_000 },
  5: { in: 150_000, out: 20_000 },
};
const MINUTES: Record<Difficulty, number> = { 1: 3, 2: 6, 3: 12, 4: 20, 5: 40 };

/** A problem as a lane card: a fix, printed with its hook and page, carrying the issue so the card can be ticked. */
export function issueItem(issue: FixIssue): Item {
  const difficulty = HARD[issue.kind] ?? 3;
  return {
    id: `issue:${issue.key}`,
    kind: "fix",
    title: issue.says,
    detail: `${issue.hook ?? "(no hook)"} · ${issue.page}\nDone when ${doneWhen(issue.kind)}.`,
    difficulty,
    tokens: TOKENS[difficulty],
    minutes: MINUTES[difficulty],
    issue,
  };
}

export const doneWhen = (kind: string): string => DONE_WHEN[kind] ?? "the Builder's check no longer lists it";

/** Tick or untick one card. */
export function toggleTick(loop: FixLoop, key: string): FixLoop {
  const on = loop.ticked.includes(key);
  return { ...loop, ticked: on ? loop.ticked.filter((k) => k !== key) : [...loop.ticked, key] };
}

/** The ticked issues not yet in NEXT.md: what Publish sends. */
export function toSend(loop: FixLoop, issues: readonly FixIssue[]): FixIssue[] {
  const sent = new Set(loop.sent.map((i) => i.key));
  return issues.filter((i) => loop.ticked.includes(i.key) && !sent.has(i.key));
}

const LINE = /^- \[( |x|X)\] .*<!-- fix:(\S+) -->\s*$/;

/** One queue line: the box, the hook, the page, what is wrong, what done looks like, and its key for Refresh. */
export function nextLine(i: FixIssue): string {
  return `- [ ] ${i.hook ? `\`${i.hook}\`` : "(no hook)"} on ${i.page}: ${i.says.replace(/\s+/g, " ").trim()} Done when ${doneWhen(i.kind)}. <!-- fix:${i.key} -->`;
}

/**
 * The whole file, with the new lines added to what is already there. Lines
 * already in the file (open or ticked) are kept as they are: the code chat
 * owns them once they are written. A line whose key is already in the file
 * is not written twice.
 */
export function nextMd(adding: readonly FixIssue[], o: { site: string; when: string; prev?: string | null }): string {
  const prev = (o.prev ?? "").split("\n").filter((l) => LINE.test(l));
  const have = new Set(prev.map((l) => LINE.exec(l)![2]));
  const lines = [...prev, ...adding.filter((i) => !have.has(i.key)).map(nextLine)];
  return [
    `# Next for the code chat: ${o.site}`,
    "",
    "Read this first. Each line is a problem the Builder found that J ticked for the next code chat to fix.",
    "Fix it in the code and keep every data-hook. Then, in the same pull request, tick its box (`- [x]`) or delete the line,",
    "and leave the `<!-- fix:... -->` comment as it is. The Builder's Refresh reads this file back: a ticked or deleted line shows as fixed.",
    "",
    `Last written by the Builder on ${o.when}.`,
    "",
    ...lines,
    "",
  ].join("\n");
}

/** Which of the sent issues the code chat has fixed: ticked or deleted in the file. Nothing, when the file could not be read. */
export function fixedIn(sent: readonly FixIssue[], md: string | null): FixIssue[] {
  if (md == null) return [];
  const open = new Set<string>();
  for (const l of md.split("\n")) {
    const m = LINE.exec(l);
    if (m && m[1] === " ") open.add(m[2]!);
  }
  return sent.filter((i) => !open.has(i.key));
}
