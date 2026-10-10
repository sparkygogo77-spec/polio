/**
 * WHAT THE BOARD HOLDS THAT THE STYLE LAYER CANNOT WRITE, AS ASKS FOR THE CODE.
 *
 * J (2026-10-10): on a site from code (PonsStars), Publish sends the design
 * as CSS keyed by data-hook (`send-out/styleLayer.ts`). Some of what he sets
 * on the board is not a look CSS can carry: an effect from the shelf put on
 * a part (tilt on hover, appear on scroll: a script), a whole-site feature
 * switched on in Format (dark and light versions, cookie consent), a page
 * added in Pages or a page's scroll behaviour. Those were dropped without a
 * word. Now each becomes one line in polio/NEXT.md (`fixLoop.ts#nextMd`),
 * the queue the kit's CLAUDE.md tells every code chat to read first, so the
 * code chat builds it and ticks the line; Refresh reads the tick back.
 *
 * Only what he changed is asked: an effect on a part brought in, a switch
 * he turned on, a page with no file in the code. Pure: no store, no React,
 * nothing imported at run time; `tests/code-asks.mjs` holds it.
 */
import type { FixIssue } from "./fixLoop.ts";

export interface AskNode {
  id: string;
  pageId: string;
  label?: string | null;
  work?: { id: string; inputs?: Record<string, string>; off?: boolean; also?: { id: string; inputs?: Record<string, string>; off?: boolean }[] } | null;
  source?: { hook?: { value: string } | null } | null;
  from?: { selector?: string } | null;
}
export interface AskPage { id: string; name: string; path?: string; scroll?: string }
export interface AskSwitch { key: string; label: string; on: string | boolean; off: string | boolean }

export interface AskInput {
  nodes: readonly AskNode[];
  pages: readonly AskPage[];
  format: Readonly<Record<string, unknown>>;
  /** The whole-site switches Format shows (`shelfFacts.ts#formatSwitches`), each with its label. */
  switches: readonly AskSwitch[];
  /** The page ids that have a file in the code (`styleSource.files`). */
  coded: ReadonlySet<string>;
  /** A shelf effect's name and what it does, by its id (`getWork`). */
  effect: (id: string) => { name: string; blurb?: string } | null;
}

const on = (s: AskSwitch, v: unknown) => (typeof s.on === "boolean" ? v === true : v !== undefined && v !== null && v !== s.off);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Every board change the style layer cannot carry, as a line for NEXT.md (`kind: "build"`). */
export function codeAsks(a: AskInput): FixIssue[] {
  const pageName = new Map(a.pages.map((p) => [p.id, p.name]));
  const out: FixIssue[] = [];
  /* Effects put on parts brought in from the code: each one on, by the part's hook. */
  for (const n of a.nodes) {
    if (!n.source && !n.from) continue;
    const uses = n.work ? [n.work, ...(n.work.also ?? [])] : [];
    for (const u of uses) {
      if (u.off) continue;
      const e = a.effect(u.id);
      const name = e?.name ?? u.id;
      const set = Object.entries(u.inputs ?? {}).filter(([, v]) => v !== "").map(([k, v]) => `${k} ${v}`).join(", ");
      out.push({
        key: `build-effect-${n.id}-${u.id}`,
        kind: "build",
        hook: n.source?.hook?.value ?? null,
        page: pageName.get(n.pageId) ?? "the page",
        says: clean(`J gave this part the "${name}" effect in the Builder${e?.blurb ? ` (${e.blurb.replace(/\.$/, "")})` : ""}${set ? `, set to ${set}` : ""}. The style layer cannot carry it; build it in the code on this element.`),
      });
    }
  }
  /* Whole-site features switched on in Format. */
  for (const s of a.switches) {
    if (!on(s, a.format[s.key])) continue;
    const v = a.format[s.key];
    out.push({
      key: `build-format-${s.key}`,
      kind: "build",
      hook: null,
      page: "every page",
      says: clean(`J switched on "${s.label}"${typeof v === "string" ? ` (${v})` : ""} for the whole site in the Builder's Format tab. Build it in the code.`),
    });
  }
  /* Pages: one added in the Builder, and a page's own scroll behaviour. */
  for (const p of a.pages) {
    if (!a.coded.has(p.id)) {
      out.push({ key: `build-page-${p.id}`, kind: "build", hook: null, page: p.name, says: clean(`J added the page "${p.name}"${p.path ? ` at ${p.path}` : ""} in the Builder. Make it in the code, with a data-hook on every part, as the board lays it out.`) });
    }
    if (p.scroll && p.scroll !== "inherit") {
      out.push({ key: `build-scroll-${p.id}-${p.scroll.replace(/[^a-z]+/gi, "-")}`, kind: "build", hook: null, page: p.name, says: clean(`J set this page's scroll to "${p.scroll}" in the Builder. Build that scroll behaviour in the code.`) });
    }
  }
  return out;
}
