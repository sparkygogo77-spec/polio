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
 *
 * A PART MADE IN THE BUILDER (J, 2026-10-10: a star drawn as a PST button,
 * linked, with a note and a tilt, sent nothing on Publish; every shelf part
 * put on a PST page was dropped the same way). It has no element in the code,
 * so the style layer has nothing to key it by. It is given a data-hook of its
 * own (`freshHooks`, kept on the part), and one line asks the code to make it:
 * where it sits (inside and under which hooks), its size, words, where it
 * leads, J's note, its effects, a drawn outline and its look as CSS. The
 * same hook carries its record in design/record.json.
 */
import type { FixIssue } from "./fixLoop.ts";

export interface AskNode {
  id: string;
  pageId: string;
  label?: string | null;
  work?: { id: string; inputs?: Record<string, string>; off?: boolean; also?: { id: string; inputs?: Record<string, string>; off?: boolean }[] } | null;
  source?: { hook?: { value: string } | null } | null;
  from?: { selector?: string } | null;
  featureId?: string;
  x?: number; y?: number; w?: number; h?: number;
  hooks?: Record<string, string> | null;
  content?: unknown;
  prompt?: string | null;
  link?: { kind: string; target: string } | null;
  outline?: { cut?: string } | null;
  state?: unknown;
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
  /** A shelf part's name by its id ("Slideshow"), for a part made in the Builder. */
  part?: (featureId: string) => string | null;
  /** The hooks parts made in the Builder go by (`freshHooks`), by part id. Without it they are not asked. */
  fresh?: Readonly<Record<string, string>>;
  /** A part's look as CSS declarations (`styleLayer.ts#lookOf`), for a part made in the Builder. */
  lookCss?: (n: AskNode) => string[];
  /** Shelf ids that are a whole-site motion kept as a part on every page (`shelfFacts.ts#RUN_MOTIONS`): asked once, for the site. */
  siteMotions?: ReadonlySet<string>;
}

/** A part made in the Builder on a page the code has: no element there yet. */
export const isNewPart = (n: AskNode, coded: ReadonlySet<string>) => !n.source && !n.from && coded.has(n.pageId);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").filter(Boolean).slice(0, 4).join("-");

/**
 * A data-hook for each part made in the Builder: the one it already has, or
 * one made from its name (else what it is), unique against every hook in the
 * code and on the board. In the order the parts were made, so the same board
 * names them the same way every time.
 */
const VAGUE = /^(box|part|text|text-block|words|prose|section|picture|shape|area)$/;

export function freshHooks(nodes: readonly AskNode[], coded: ReadonlySet<string>, taken: Iterable<string>, opts: { part?: (featureId: string) => string | null; skip?: ReadonlySet<string>; pages?: readonly { id: string; name: string }[] } = {}): Record<string, string> {
  const used = new Set(taken);
  for (const n of nodes) { const h = n.hooks?.["data-hook"]; if (h) used.add(h); }
  const out: Record<string, string> = {};
  const fresh = nodes.filter((n) => isNewPart(n, coded) && !opts.skip?.has(n.featureId ?? ""));
  for (const n of fresh) { const h = n.hooks?.["data-hook"]; if (h) out[n.id] = h; }
  for (const n of fresh) {
    if (out[n.id]) continue;
    let base = slug(n.label ?? "") || slug(opts.part?.(n.featureId ?? "") ?? "") || slug(n.featureId ?? "") || "part";
    /* A name that says nothing on its own ("box") says which page it is on: play-box. */
    if (VAGUE.test(base)) base = `${slug(opts.pages?.find((p) => p.id === n.pageId)?.name ?? "") || "new"}-${base}`;
    let hook = base, i = 2;
    while (used.has(hook)) hook = `${base}-${i++}`;
    used.add(hook);
    out[n.id] = hook;
  }
  return out;
}

const wordsOf = (c: unknown): string => (typeof c === "string" ? c : Array.isArray(c) ? c.map((s) => (typeof s === "string" ? s : (s as { text?: string })?.text ?? "")).join("") : "");
const n0 = (v: number | undefined) => Math.round(v ?? 0);
const boxOf = (n: AskNode) => ({ x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 0, h: n.h ?? 0 });
const holds = (o: AskNode, n: AskNode) => { const a = boxOf(o), b = boxOf(n); return o !== n && a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w >= b.x + b.w - 1 && a.y + a.h >= b.y + b.h - 1 && a.w * a.h > b.w * b.h; };

/** A drawn outline (0..1 of the box) as a CSS clip in the part's own pixels. */
export function clipPx(cut: string, w: number, h: number): string {
  let i = 0;
  const d = cut.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (m) => { const v = Number(m) * (i++ % 2 === 0 ? w : h); return String(Math.round(v * 10) / 10); });
  return `clip-path: path('${d}')`;
}

const on = (s: AskSwitch, v: unknown) => (typeof s.on === "boolean" ? v === true : v !== undefined && v !== null && v !== s.off);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Every board change the style layer cannot carry, as a line for NEXT.md (`kind: "build"`). */
export function codeAsks(a: AskInput): FixIssue[] {
  const pageName = new Map(a.pages.map((p) => [p.id, p.name]));
  const out: FixIssue[] = [];
  /* Effects put on parts brought in from the code: each one on, by the part's hook. */
  /* Parts made in the Builder: a line each, and the whole-site motions once. */
  const linkSays = (l: NonNullable<AskNode["link"]>) => {
    if (l.kind === "page") { const p = a.pages.find((x) => x.id === l.target || x.path === l.target || x.name === l.target); return `the ${p?.name ?? l.target} page${p?.path ? ` (${p.path})` : ""}`; }
    if (l.kind === "url") return l.target;
    const t = a.nodes.find((x) => x.id === l.target);
    return `the part ${t?.source?.hook?.value ? `\`${t.source.hook.value}\`` : t?.label ?? l.target}`;
  };
  const motions = new Set<string>();
  for (const n of a.nodes) {
    if (!isNewPart(n, a.coded)) continue;
    if (a.siteMotions?.has(n.featureId ?? "")) {
      if (motions.has(n.featureId!)) continue;
      motions.add(n.featureId!);
      out.push({ key: `build-site-${n.featureId}`, kind: "build", hook: null, page: "every page", says: clean(`J turned on "${a.part?.(n.featureId!) ?? n.featureId}" for the whole site in the Builder. Build it in the code.`) });
      continue;
    }
    const hook = a.fresh?.[n.id];
    if (!hook) continue;
    const name = a.part?.(n.featureId ?? "") ?? n.featureId ?? "part";
    /* Among the parts the code has that show where the page opens (a hidden face of a panel is not where it sits). */
    const kin = a.nodes.filter((o) => o.pageId === n.pageId && o.source?.hook?.value && !o.state);
    const inside = kin.filter((o) => holds(o, n)).sort((p, q) => boxOf(p).w * boxOf(p).h - boxOf(q).w * boxOf(q).h)[0];
    const peers = kin.filter((o) => (inside ? holds(inside, o) && o !== inside : !kin.some((q) => holds(q, o))) && !holds(o, n) && boxOf(o).y + boxOf(o).h <= boxOf(n).y + 1);
    const above = peers.sort((p, q) => (boxOf(q).y + boxOf(q).h) - (boxOf(p).y + boxOf(p).h))[0];
    const where = [inside ? `inside \`${inside.source!.hook!.value}\`` : "on the page itself", above ? `under \`${above.source!.hook!.value}\`` : "", inside ? `${n0(boxOf(n).x - boxOf(inside).x)}px from its left and ${n0(boxOf(n).y - boxOf(inside).y)}px from its top` : `at ${n0(n.x)}px across, ${n0(n.y)}px down`].filter(Boolean).join(", ");
    const words = wordsOf(n.content).replace(/\s+/g, " ").trim();
    const fx = n.work ? [n.work, ...(n.work.also ?? [])].filter((u) => !u.off).map((u) => a.effect(u.id)?.name ?? u.id) : [];
    const css = [...(a.lookCss?.(n) ?? []), ...(n.outline?.cut ? [clipPx(n.outline.cut, n.w ?? 0, n.h ?? 0)] : [])];
    out.push({
      key: `build-part-${n.id}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean([
        `J made a new part in the Builder: a ${name}${n.label && n.label !== name ? ` called "${n.label}"` : ""}, ${where}, ${n0(n.w)} by ${n0(n.h)}px.`,
        words ? `Its words: "${words.slice(0, 200)}".` : "",
        n.link?.target ? `Pressing it leads to ${linkSays(n.link)}.` : "",
        n.prompt?.trim() ? `J's note for it: "${n.prompt.trim().slice(0, 400)}".` : "",
        fx.length ? `Its effects: ${fx.join(", ")}.` : "",
        n.outline?.cut ? "Its outline is drawn, not a box: cut it with the clip-path below." : "",
        css.length ? `Its look: \`${css.join("; ")}\`.` : "",
        `Make it in the code with data-hook="${hook}"; its record (outline, link, note, effects) is in design/record.json under that hook.`,
      ].filter(Boolean).join(" ")),
    });
  }
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
