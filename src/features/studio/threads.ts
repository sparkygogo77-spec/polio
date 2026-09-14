/**
 * Threads: every prompt that reached Claude, and what it produced.
 *
 * An iteration that an API call lands is a **thread**, not an update. It
 * carries what was asked, what came back, what it did to the board, and the
 * board as it stood the moment it landed — so a thread is a place you can
 * stand rather than an entry in a log. Threads hang off one another: the one
 * that lands while another is live becomes its child, and the tree that
 * makes is the history of the site as it was actually reasoned about.
 *
 * Pruning cuts one node and nothing else. Its children re-hang from its
 * parent — they happened, and the work in them is not undone by removing the
 * step that happened to be underneath them — and the board goes back to
 * whichever thread is live after the cut.
 *
 * Pure: no React, no store, no browser. `tests/threads.mjs` holds it to its
 * rules; `store.ts` and `ThreadTree.tsx` are the only callers.
 */

/** The part of the document a thread keeps, so the board can go back to it. */
export interface ThreadDoc {
  pages?: unknown[];
  // x and y were always in the snapshot; the type only ever named what was
  // read. The timeline draws a thumbnail of the board an iteration left
  // behind, and a thumbnail without positions is a list.
  nodes?: { id: string; pageId?: string; label: string; prompt?: string; x?: number; y?: number; w?: number; h?: number; featureId?: string }[];
  groups?: unknown[];
  shapes?: unknown[];
  format?: Record<string, unknown>;
  /* The two the timeline needs to *render* the snapshot rather than sketch
     it: which page was open and how wide the site is built. They were always
     in it — `snapshot` takes the whole document — and the type only ever
     named what somebody read. */
  activePageId?: string;
  frameWidth?: number;
  brief?: { name?: string; gimmick?: string; master?: string };
  look?: unknown;
  motion?: unknown[];
}

export interface Thread {
  id: string;
  /** The thread this one landed on top of, or null for the first. */
  parentId: string | null;
  at: number;
  /** plan · critique · expand · finish · ideas · ask · build · drawing */
  mode: string;
  model?: string;
  /** What was asked, in the author's words. */
  ask: string;
  /** What came back, whole. */
  answer: string;
  /** What it put on the board. Empty means it answered without changing anything. */
  changes: string[];
  /**
   * The part this iteration made, or changed.
   *
   * Without it the timeline can show what was drawn and not act on it: going
   * back to change a thing made a second thing, because nothing on the
   * thread said which part on the board it was about.
   */
  madeId?: string;
  /** The board as it stood when this thread landed. */
  doc?: ThreadDoc;
  /** The pieces that were vined to it when it fired. */
  pieces?: string[];
  /**
   * The drawing that started it, when one did.
   *
   * An element prompt *is* a drawing: the timeline shows it on the card
   * that grows out of the box, because "a drawing of one closed line" is
   * not what was asked, the line is.
   */
  sketch?: { strokes: [number, number][][]; words: string };
  /**
   * How far it has formed, and how many times.
   *
   * `p` is the real progress of the job behind it, 0..1, from the steps the
   * job says it is on; landing is 1. `gen` goes up on every update to the
   * thread, and the box plays its formation again from nothing. See
   * `formation.ts`.
   */
  form?: { p: number; gen: number };
  /**
   * What the call cost: what was sent, what was skipped, what the cache gave
   * back, and the dollars, when an iteration reached a renderer that charges
   * by the press rather than by the token.
   */
  usage?: {
    sent: number;
    skipped: number;
    cached?: number;
    input?: number;
    output?: number;
    /** What it cost, in dollars, Claude and the renderer together. */
    cost?: number;
    /** Of that, what went to Claude per token, and what to the renderer per press. */
    claude?: number;
    renderer?: number;
    /** How long the person actually waited, retries included. */
    ms?: number;
    /** How many paid calls it took. */
    calls?: number;
    /**
     * One line per pass, in the order they ran.
     *
     * A drawing lands twice and the two passes are two charges on somebody's
     * bill, so a total is not enough: it hides which of them was expensive.
     * Each says what ran, how long it took, and what it cost — or that the
     * cost was not reported, which is the truth for a model Replicate
     * publishes no rate for and better than a number nobody can stand
     * behind.
     */
    passes?: string[];
  };
  /**
   * How the process behind this iteration ended, if it has.
   *
   * An iteration is not one call: a drawing lands the moment it is read and
   * then goes on to have a body traced for it, and until that finishes the
   * iteration is not finished. Two states and no more, because there are
   * only two things worth knowing at a glance: it is still going or it gave
   * up (red), or it is done (green). Absent means done, which is what every
   * thread written before this was.
   */
  state?: ProcessState;
}

/**
 * How a process ended, if it has. Three words, two colours.
 *
 * `running` is still going, `cut` gave up, `done` finished, and absent means
 * done — which is what every thread written before this was. The names live
 * here rather than being spelled out at each site so the timeline's boxes
 * and the Finish key on the bar cannot drift into two vocabularies for one
 * idea.
 */
export type ProcessState = "running" | "done" | "cut";

/**
 * Red or green, and nothing else, wherever a process shows its state.
 *
 * The only question worth answering at a glance is whether the work
 * finished. Red while it is still going *or* gave up, green the moment it is
 * done. Two colours, no shades between them, and no third: a third would
 * make it a legend rather than a glance. Both the timeline's boxes and the
 * bar's Finish key read from here.
 */
export const PROCESS = {
  /** Unfinished or abandoned. */
  open: "oklch(0.62 0.23 27)",
  /** Completed. */
  done: "oklch(0.72 0.2 150)",
  /** The same two, to glow with. */
  openGlow: "oklch(0.62 0.23 27 / 0.7)",
  doneGlow: "oklch(0.72 0.2 150 / 0.7)",
} as const;

/** Has this one finished? Absent counts as done. */
export function processDone(state?: ProcessState): boolean {
  return (state ?? "done") === "done";
}

/** How many threads are kept with their documents. The board lives in localStorage. */
export const THREAD_LIMIT = 14;

const MODE_WORD: Record<string, string> = {
  plan: "Asked for a plan",
  critique: "Asked for a critique",
  expand: "Asked for the missing prompts",
  finish: "Asked what is left",
  ideas: "Asked for ideas",
  ask: "Asked",
  build: "Asked for the code",
  drawing: "Drew a shape",
  start: "Started the board",
};

/** One line: what was asked, and what it put on the board. */
export function threadTitle(t: Thread): string {
  const asked = t.ask.trim() ? `${MODE_WORD[t.mode] ?? "Asked"}: ${firstLine(t.ask, 60)}` : MODE_WORD[t.mode] ?? "Asked";
  const did = t.changes.length ? t.changes.length === 1 ? t.changes[0]! : `${t.changes[0]!} and ${t.changes.length - 1} more` : "nothing taken yet";
  return `${asked} → ${did}`;
}

function firstLine(s: string, max: number): string {
  const line = s.split("\n").map((x) => x.trim()).find(Boolean) ?? "";
  return line.length > max ? line.slice(0, max - 1).trimEnd() + "…" : line;
}

/* ------------------------------------------------------------------ */
/* The tree                                                            */
/* ------------------------------------------------------------------ */

export interface ThreadNode {
  thread: Thread;
  children: ThreadNode[];
  /** How far from a root: the row it sits on. */
  depth: number;
}

/** The threads as a forest, oldest first at every level. */
/**
 * What each iteration is drawn hanging off: the one that landed before it.
 *
 * One chain in time order and nothing else. No branches, no forks, ever.
 *
 * `parentId` is still on the thread and is still true — an iteration really
 * was worked in another one, and the panel's tree still reads it — but it is
 * not what the timeline draws. Drawing it gave a thread hanging off whatever
 * was being worked in, which fanned the timeline into branches and gave some
 * boxes several vines into them. What a person wants from a timeline is what
 * happened, in the order it happened.
 *
 * The order is the list's own order, not the clock on the threads: the list
 * is appended to, so its order *is* what happened, and a timestamp makes the
 * chain depend on the machine's clock being right rather than on the record.
 * The first entry is where it began and says so by being first.
 */
export function chainOf(threads: Thread[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < threads.length; i++) out.set(threads[i]!.id, i > 0 ? threads[i - 1]!.id : null);
  return out;
}

export function threadTree(threads: Thread[]): ThreadNode[] {
  const byId = new Map(threads.map((t) => [t.id, { thread: t, children: [], depth: 0 } as ThreadNode]));
  const roots: ThreadNode[] = [];
  for (const t of [...threads].sort((a, b) => a.at - b.at)) {
    const node = byId.get(t.id)!;
    const parent = t.parentId ? byId.get(t.parentId) : null;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Every node of the forest, in the order they are drawn: a parent before its children. */
export function flatten(roots: ThreadNode[]): ThreadNode[] {
  const out: ThreadNode[] = [];
  const walk = (n: ThreadNode) => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  return out;
}

/**
 * Cut one thread. Its children re-hang from its parent, so the work under it
 * stays where it happened, and everything else is untouched.
 */
export function pruneThread(threads: Thread[], id: string): Thread[] {
  const cut = threads.find((t) => t.id === id);
  if (!cut) return threads;
  return threads.filter((t) => t.id !== id).map((t) => (t.parentId === id ? { ...t, parentId: cut.parentId } : t));
}

/**
 * The thread the board should stand on after a cut: the newest one left on
 * the line the cut thread was on — its parent if it has one, otherwise the
 * newest thread of all, and nothing when the last thread has gone.
 */
export function liveAfterPrune(threads: Thread[], cutId: string, live: string | null): string | null {
  if (live !== cutId) return live && threads.some((t) => t.id === live) ? live : newest(threads);
  const cut = threads.find((t) => t.id === cutId);
  const rest = threads.filter((t) => t.id !== cutId);
  if (cut?.parentId && rest.some((t) => t.id === cut.parentId)) return cut.parentId;
  return newest(rest);
}

function newest(threads: Thread[]): string | null {
  let best: Thread | null = null;
  for (const t of threads) if (!best || t.at > best.at) best = t;
  return best?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* What changed                                                        */
/* ------------------------------------------------------------------ */

/**
 * The difference between two boards, in words: what arrived, what left, and
 * whose prompt or size changed. This is the "diff" a thread shows when it is
 * opened — not a text diff of the answer, which nobody reads, but what the
 * answer did to the site.
 */
export function diffDocs(before: ThreadDoc | undefined, after: ThreadDoc | undefined): string[] {
  if (!before || !after) return [];
  const out: string[] = [];
  const was = new Map((before.nodes ?? []).map((n) => [n.id, n]));
  const now = new Map((after.nodes ?? []).map((n) => [n.id, n]));
  for (const [id, n] of now) if (!was.has(id)) out.push(`+ ${n.label} placed`);
  for (const [id, n] of was) if (!now.has(id)) out.push(`− ${n.label} removed`);
  for (const [id, n] of now) {
    const b = was.get(id);
    if (!b) continue;
    if ((b.prompt ?? "") !== (n.prompt ?? "")) out.push(`~ ${n.label}: prompt rewritten`);
    if (b.w !== n.w || b.h !== n.h) out.push(`~ ${n.label}: ${Math.round(b.w ?? 0)}×${Math.round(b.h ?? 0)} → ${Math.round(n.w ?? 0)}×${Math.round(n.h ?? 0)}`);
    if (b.featureId !== n.featureId) out.push(`~ ${n.label}: now a ${n.featureId}`);
  }
  const bb = before.brief ?? {};
  const ab = after.brief ?? {};
  if ((bb.master ?? "") !== (ab.master ?? "")) out.push("~ the site's own prompt rewritten");
  if ((bb.gimmick ?? "") !== (ab.gimmick ?? "")) out.push("~ the central idea rewritten");
  if ((before.pages ?? []).length !== (after.pages ?? []).length) out.push(`~ ${(before.pages ?? []).length} pages → ${(after.pages ?? []).length}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * A piece: one thing on the board that carries a prompt.
 *
 * The site's own prompt, a page's, a group's, an element's. A piece is what
 * a call actually sends — the prompt, what it is, how big, and what it sits
 * beside — so the brief can stay a stable prefix and only the pieces that
 * matter to this thread go with it.
 */
export interface Piece {
  /** "site" · "page:<id>" · "group:<id>" · "node:<id>" */
  id: string;
  kind: "site" | "page" | "group" | "node";
  label: string;
  /** The page it is on, when it is on one. */
  where: string;
  prompt: string;
  size?: { w: number; h: number };
  /** What it sits between, in reading order. */
  neighbours: string[];
  /**
   * The chains drawn to and from it, each with the reason it is there —
   * "→ Wallet — only when the wallet is connected". A part that is
   * contingent on another, or that reads another's data, cannot be built
   * without knowing it, so the chain travels with the prompt rather than
   * being left on the board.
   */
  links: string[];
  /**
   * What it looked like when it was last sent. Two calls in one thread do
   * not resend a piece whose fingerprint has not moved.
   */
  fingerprint: string;
}

interface BoardIn {
  brief?: { name?: string; gimmick?: string; master?: string };
  pages?: { id: string; name: string; prompt?: string }[];
  groups?: { id: string; label?: string; pageId?: string; prompt?: string }[];
  /**
   * In reading order already: the caller sorts, because it owns `toRows` —
   * and it brings each part's chains with it, from `links.ts`, because it
   * owns the shapes too.
   */
  nodes?: { id: string; pageId?: string; label: string; prompt?: string; w?: number; h?: number; links?: string[] }[];
}

const print = (parts: (string | number | undefined)[]) => parts.filter((p) => p !== undefined && p !== "").join("|");

/** Everything on the board that carries a prompt, as pieces. */
export function piecesFrom(board: BoardIn): Piece[] {
  const out: Piece[] = [];
  const brief = board.brief ?? {};
  const site = [brief.gimmick?.trim(), brief.master?.trim()].filter(Boolean).join("\n");
  if (site) out.push({ id: "site", kind: "site", label: brief.name?.trim() || "The site", where: "", prompt: site, neighbours: [], links: [], fingerprint: print(["site", site]) });
  const pageName = new Map((board.pages ?? []).map((p) => [p.id, p.name]));
  for (const p of board.pages ?? []) {
    if (!p.prompt?.trim()) continue;
    out.push({ id: `page:${p.id}`, kind: "page", label: p.name, where: "", prompt: p.prompt.trim(), neighbours: [], links: [], fingerprint: print(["page", p.id, p.prompt.trim()]) });
  }
  for (const g of board.groups ?? []) {
    if (!g.prompt?.trim()) continue;
    out.push({ id: `group:${g.id}`, kind: "group", label: g.label || "Group", where: pageName.get(g.pageId ?? "") ?? "", prompt: g.prompt.trim(), neighbours: [], links: [], fingerprint: print(["group", g.id, g.prompt.trim()]) });
  }
  const nodes = board.nodes ?? [];
  nodes.forEach((n, i) => {
    if (!n.prompt?.trim()) return;
    const near = [nodes[i - 1]?.label, nodes[i + 1]?.label].filter((x): x is string => !!x);
    const links = n.links ?? [];
    out.push({
      id: `node:${n.id}`, kind: "node", label: n.label, where: pageName.get(n.pageId ?? "") ?? "",
      prompt: n.prompt.trim(), size: { w: Math.round(n.w ?? 0), h: Math.round(n.h ?? 0) }, neighbours: near, links,
      // A chain drawn, re-worded or cut changes what this part is, so it moves
      // the fingerprint: the piece is resent rather than assumed unchanged.
      fingerprint: print(["node", n.id, n.prompt.trim(), Math.round(n.w ?? 0), Math.round(n.h ?? 0), links.join("/")]),
    });
  });
  return out;
}

/**
 * Which thread a piece belongs beside: the newest one that says it did
 * something to it. A piece no thread has touched belongs to nothing yet and
 * floats by the draft, waiting to be vined to the next call.
 */
export function pieceOwners(pieces: Piece[], threads: Thread[]): Map<string, string> {
  const owner = new Map<string, string>();
  const ordered = [...threads].sort((a, b) => a.at - b.at);
  for (const piece of pieces) {
    const needle = piece.label.toLowerCase();
    for (const t of ordered) {
      if (t.changes.some((c) => c.toLowerCase().includes(needle)) || (t.pieces ?? []).includes(piece.id)) owner.set(piece.id, t.id);
    }
  }
  return owner;
}

/** What one piece costs to say, for the call and for the reader. */
export function pieceToText(p: Piece): string {
  const bits = [`${p.label}${p.where ? ` (on ${p.where})` : ""}${p.size ? `, ${p.size.w}×${p.size.h}` : ""}`];
  if (p.neighbours.length) bits.push(`between ${p.neighbours.join(" and ")}`);
  const chained = p.links.map((l) => `\n  chained: ${l}`).join("");
  return `- ${bits.join(" · ")}\n  prompt: ${p.prompt}${chained}`;
}

/**
 * What a call has to carry: the pieces vined to it whose fingerprint has
 * moved since this thread last sent them. A piece that has not changed is
 * not resent — the model has it from the turn before, and the brief in
 * front of it is the same bytes, so the whole prefix is a cache read.
 */
export function piecesToSend(pieces: Piece[], vined: string[], sent: Record<string, string>): { send: Piece[]; skipped: Piece[] } {
  const want = pieces.filter((p) => vined.includes(p.id));
  const send: Piece[] = [];
  const skipped: Piece[] = [];
  for (const p of want) (sent[p.id] === p.fingerprint ? skipped : send).push(p);
  return { send, skipped };
}

/** The tree in words, for copying out. */
export function threadsToMarkdown(threads: Thread[]): string {
  const roots = threadTree(threads);
  const L: string[] = ["# Threads", "", "Every prompt that reached Claude, and what it produced.", ""];
  const walk = (n: ThreadNode) => {
    const pad = "  ".repeat(n.depth);
    L.push(`${pad}- **${threadTitle(n.thread)}**`);
    L.push(`${pad}  - when: ${new Date(n.thread.at).toISOString()}${n.thread.model ? ` · ${n.thread.model}` : ""}`);
    if (n.thread.ask.trim()) L.push(`${pad}  - asked: ${n.thread.ask.trim().split("\n").join(" ")}`);
    for (const c of n.thread.changes) L.push(`${pad}  - did: ${c}`);
    for (const c of n.children) walk(c);
  };
  for (const r of roots) walk(r);
  if (!threads.length) L.push("_Nothing has been asked yet._");
  return L.join("\n");
}
