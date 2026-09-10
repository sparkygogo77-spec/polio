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
  nodes?: { id: string; label: string; prompt?: string; w?: number; h?: number; featureId?: string }[];
  groups?: unknown[];
  shapes?: unknown[];
  format?: Record<string, unknown>;
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
  /** The board as it stood when this thread landed. */
  doc?: ThreadDoc;
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
