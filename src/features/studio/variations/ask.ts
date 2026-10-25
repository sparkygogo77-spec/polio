/**
 * THE ASK FOR "ASK CLAUDE FOR 4": the site in short, read off the prepared
 * original (`make.ts#prepare`).
 *
 *   · its sections, top to bottom, with their words;
 *   · its layout tree (`layout/read.ts`) in plain lines: each section's
 *     flow, columns, gap and how its items sit, so Claude can move what is
 *     there rather than guess;
 *   · its System's tokens by kind;
 *   · the aims, the locks (layers Claude must leave alone) and the site
 *     named to be like;
 *   · the parts whose words may get a suggestion: the first screen's, and
 *     every short line that reads like a button.
 *
 * Pure: no store, no browser. The pictures go with it from `run.ts`.
 */
import { readLayout, type Flow, type LayoutTree } from "../layout/read.ts";
import type { BetterAsk } from "../better/prompt.ts";
import type { Prepared } from "./make.ts";
import type { Aim, Layer } from "./model.ts";
import { tokenValues } from "./tokens.ts";

/** The words a part says, as plain text: what Claude reads and may suggest changing. */
export const plainWords = (c: unknown): string => (typeof c === "string" ? c : Array.isArray(c) ? c.map((s) => (s && typeof s === "object" && "text" in s ? String((s as { text: unknown }).text) : "")).join("") : "");

const inside = (b: { x: number; y: number; w: number; h: number }, n: { x: number; y: number; w: number; h: number }) => n.x + n.w / 2 >= b.x && n.x + n.w / 2 <= b.x + b.w && n.y + n.h / 2 >= b.y && n.y + n.h / 2 <= b.y + b.h;

/** One flow in a line: "column of 4, gap 24, items start, pad 48/32". */
function flowLine(f: Flow): string {
  const kind = f.display === "grid" ? `grid of ${f.items.length} (${(f.columns ?? []).length} columns)` : `${f.direction} of ${f.items.length}`;
  const gap = f.gap != null ? `, gap ${Math.round(f.gap)}` : "";
  const pad = f.pad.top || f.pad.left ? `, pad ${Math.round(f.pad.top)}/${Math.round(f.pad.left)}` : "";
  const placed = f.placed.length ? `, ${f.placed.length} placed by hand` : "";
  return `${kind}${gap}, items ${f.align}${pad}${placed}`;
}

/** The tree in plain lines, one per section, its first level of flow under it. */
export function layoutLines(tree: LayoutTree): string[] {
  const out: string[] = [`page ${tree.width}px wide: ${flowLine(tree.root)}`];
  const itemOf = (id: string) => tree.root.items.find((it) => it.id === id);
  tree.sections.forEach((s, i) => {
    const it = itemOf(s.id);
    const widest = it ? Math.round((it.box.w / tree.width) * 100) : null;
    const head = `section ${i}: ${Math.round(s.box.h)}px tall${widest != null ? `, ${widest}% of the page wide` : ""}, ${s.grouped} parts in flow, ${s.placed} placed`;
    out.push(it?.flow ? `${head}; ${flowLine(it.flow)}` : head);
    if (it?.flow) for (const k of it.flow.items.slice(0, 6)) if (k.flow) out.push(`  · ${Math.round(k.box.w)}×${Math.round(k.box.h)}: ${flowLine(k.flow)}`);
  });
  return out;
}

export interface AskOptions { aims: readonly Aim[]; like?: string | null; count: number; locks?: readonly Layer[] }

/** The site in short, for the ask. */
export function askFor(p: Prepared, o: AskOptions, name: string): BetterAsk {
  const first = p.doc.activePageId ?? p.pageIds[0] ?? null;
  const mine = p.nodes.filter((n) => !first || n.pageId === first);
  const tree = readLayout(mine, { width: p.width });
  const sections = tree.sections.map((s, i) => ({ index: i, height: s.box.h, words: mine.filter((n) => inside(s.box, n)).map((n) => plainWords(n.content).trim()).filter(Boolean).join(" · ").slice(0, 240) }));
  const T = tokenValues(p.system);
  const scale = p.system.tokens.type.scale;
  const system = [
    ...(scale ? [`scale now: ×${scale.ratio} from ${scale.base}px`] : []),
    ...Object.entries(T).map(([k, list]) => `${k}: ${list.slice(0, 24).join(", ")}${list.length > 24 ? ` (+${list.length - 24} more)` : ""}`),
  ].join("\n");
  const s0 = tree.sections[0]?.box;
  const words = mine.filter((n) => typeof n.content === "string" && n.content.trim() && n.content.length <= 160 && ((s0 && inside(s0, n)) || n.content.length <= 24)).slice(0, 30).map((n) => ({ part: n.id, now: n.content as string }));
  return { aims: [...o.aims], like: o.like ?? null, count: o.count, locks: [...(o.locks ?? [])], site: { name, sections, system, layout: layoutLines(tree).join("\n") }, words };
}
