/**
 * THE AUDIT RECEIPT, AS THE SCREEN READS IT, AND THE BRIEF IT WRITES.
 *
 * `scripts/audit-runner.mjs` writes `receipt.json`; this is its shape on the
 * client side, plus the two pure things the Audit screen needs: how to say a
 * size, and how to turn the ticked findings into a lane brief. The brief is
 * made here, in the browser, so the screen can show exactly what it will
 * write before it writes it, and the server (`/api/studio/audit`) only puts
 * the text in a file. Nothing here touches code: a brief is a page of words
 * a lane reads. Pure, no React, no store: `tests/audit-screen.mjs` loads it.
 */

export type FindingKind = "cut" | "shortcut" | "look";

export interface Pin {
  feature: string;
  date: string;
  merged?: string | null;
  commit: string | null;
  certain: boolean;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  what: string;
  why: string;
  loses: string | null;
  bytes: { before: number; after: number | null; ceiling?: boolean };
  files: string[];
  functions: string[];
  apply: string;
  pin: Pin;
}

export interface Feature {
  name: string;
  date: string;
  commit: string;
  uncertain?: boolean;
  found: number;
  saves: number;
  findings: string[];
}

export interface Receipt {
  kind: "polio-audit-receipt";
  version: 1;
  when: string;
  commit: string | null;
  branch: string | null;
  limit: number;
  before: { total: number; functions: number; over: boolean };
  afterCuts: { total: number; over: boolean };
  functions: { fn: string; bytes: number; heaviest: [string, number][] }[];
  features: Feature[];
  findings: Finding[];
}

export const MB = 1048576;
export const mb = (b: number): string => `${(b / MB).toFixed(b >= 100 * MB ? 0 : 1)} MB`;

/** What a finding saves, in bytes: nothing for one with no after. */
export const saves = (f: Finding): number => (f.bytes.after == null ? 0 : f.bytes.before - f.bytes.after);

/** The default ticks: every safe cut on, every shortcut and look off. */
export function defaultTicks(r: Receipt): Record<string, boolean> {
  return Object.fromEntries(r.findings.map((f) => [f.id, f.kind === "cut"]));
}

/** The deployment's size with the ticked findings made. */
export function totalWith(r: Receipt, ticks: Record<string, boolean>): number {
  return r.before.total - r.findings.filter((f) => ticks[f.id]).reduce((s, f) => s + saves(f), 0);
}

/** The feature a finding hangs on, by its pin's name. */
export function featureOf(r: Receipt, f: Finding): Feature | undefined {
  return r.features.find((x) => x.name === f.pin.feature);
}

const plainKind = (k: FindingKind) => (k === "cut" ? "Cut, nothing lost" : k === "shortcut" ? "Shortcut, something given up" : "To look at");

/**
 * The lane brief for the ticked findings: what to change, why, what each
 * gives up, and what done looks like, in the shape every lane brief has.
 * Nothing in it is a branch name or a long commit code: J reads these too.
 */
export function briefFor(r: Receipt, ticks: Record<string, boolean>, when = new Date()): { name: string; text: string; ticked: Finding[] } {
  const ticked = r.findings.filter((f) => ticks[f.id]);
  const day = when.toISOString().slice(0, 10);
  const name = `audit-piece-${day}.md`;
  const after = totalWith(r, ticks);
  const lines: string[] = [];
  lines.push(`# Audit piece (${day}): ${ticked.length} change${ticked.length === 1 ? "" : "s"} from the audit of ${r.when.slice(0, 10)}`);
  lines.push("");
  lines.push(`Polio today: ${mb(r.before.total)} of ${mb(r.limit)}${r.before.over ? ", over the limit" : ""}. With these: about ${mb(after)}${after > r.limit ? ", still over by this count" : ", under"}.`);
  lines.push("");
  lines.push("One branch from base, one PR. Make only what is below; the audit runner (`scripts/audit-runner.mjs`) on your build must show each line gone. Red on base, green on yours. Nothing here was changed by the audit itself.");
  for (const f of ticked) {
    lines.push("", `## ${f.what}`);
    lines.push(`- Kind: ${plainKind(f.kind)}.`);
    lines.push(`- Why: ${f.why}`);
    if (f.loses) lines.push(`- Gives up: ${f.loses}`);
    if (f.bytes.after != null) lines.push(`- Size: ${mb(f.bytes.before)} → ${f.bytes.ceiling ? "at most " : ""}${mb(f.bytes.after)}.`);
    lines.push(`- Where: ${f.files.join(", ")}${f.functions.length ? ` (functions: ${f.functions.join(", ")})` : ""}.`);
    lines.push(`- How: ${f.apply}`);
    lines.push(`- Came in with: ${f.pin.feature}, ${f.pin.date}.`);
  }
  const skipped = r.findings.filter((f) => !ticks[f.id]);
  if (skipped.length) {
    lines.push("", "## Left for later (not in this piece)");
    for (const f of skipped) lines.push(`- ${f.what}${f.loses ? ` (gives up: ${f.loses})` : ""}`);
  }
  lines.push("", `Done looks like: the runner's receipt on your build lists none of the ${ticked.length} above, and the deployment is about ${mb(after)}.`);
  return { name, text: lines.join("\n") + "\n", ticked };
}
