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
 * nothing imported at run time but the pure `motionCss.ts`; `tests/code-asks.mjs` holds it.
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
/* Pure too: which effects and whole-site motions the style layer already writes as CSS, so they are not asked as well. */
import { carriedEffect, carriedSite, pushedOnPress } from "./send-out/motionCss.ts";
import { DEFAULT_OFFSITE, isOffsite, linkAllowed, offsiteRules } from "./shelf/parts/offsite.ts";
import { kitEffect, kitSite } from "./send-out/kitMotion.ts";

export interface AskNode {
  id: string;
  pageId: string;
  label?: string | null;
  work?: { id: string; inputs?: Record<string, string>; off?: boolean; also?: { id: string; inputs?: Record<string, string>; off?: boolean }[] } | null;
  source?: { hook?: { value: string; attr?: string } | null } | null;
  from?: { selector?: string } | null;
  featureId?: string;
  x?: number; y?: number; w?: number; h?: number;
  hooks?: Record<string, string> | null;
  content?: unknown;
  prompt?: string | null;
  link?: { kind: string; target: string } | null;
  /** What the capture read it as: "button, named …", "link, …" (`control.ts`). */
  data?: string | null;
  outline?: { cut?: string } | null;
  state?: unknown;
  options?: Record<string, string> | null;
  /** A frame of another page the import found (`node.embed`); `was` is set once J changed its address in the embed box. */
  embed?: { src?: string; was?: string } | null;
}
export interface AskPage { id: string; name: string; path?: string; scroll?: string }
/** A Format switch; `def`, the value a new board starts at: a switch still at it is not something J turned on (PonsStars came in with page transitions, search listing, accessibility and speed bars at their defaults). */
export interface AskSwitch { key: string; label: string; on: string | boolean; off: string | boolean; def?: string | boolean | number }

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
  /** A builder-ready site (`styleSource.kit`): it loads the kit's motion file, so the motions it runs go in the style layer (`send-out/kitMotion.ts`). */
  kit?: boolean;
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

const settingsOf = (inputs: Record<string, string> | undefined) => Object.entries(inputs ?? {}).filter(([, v]) => v !== "").map(([k, v]) => `${k} ${v}`).join(", ");
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
      if (motions.has(n.featureId!) || carriedSite(n.featureId!, n.options) || (a.kit && kitSite(n.featureId!, n.options))) continue;
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
    /* An effect's settings ride with it: an Embed without its address is no embed (J, 2026-10-10). */
    const fx = n.work ? [n.work, ...(n.work.also ?? [])].filter((u) => !u.off).map((u) => { const set = settingsOf(u.inputs); return `${a.effect(u.id)?.name ?? u.id}${set ? ` (${set})` : ""}`; }) : [];
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
  const effects = new Map<string, { id: string; set: string; parts: AskNode[] }>();
  for (const n of a.nodes) {
    if (!n.source && !n.from) continue;
    const uses = n.work ? [n.work, ...(n.work.also ?? [])] : [];
    for (const u of uses) {
      /* Lift, press, float, spin, blink, reveal and switch on go out as CSS (`motionCss.ts`). */
      if (u.off || carriedEffect(u.id)) continue;
      /* On a builder-ready site the kit's motion file runs the rest, named in the style layer on the part's hook. */
      if (a.kit && n.source?.hook?.attr === "data-hook" && kitEffect(u.id)) continue;
      const set = settingsOf(u.inputs);
      const k = `${u.id}|${set}`;
      const g = effects.get(k) ?? { id: u.id, set, parts: [] };
      g.parts.push(n);
      effects.set(k, g);
    }
  }
  /*
   * ONE LINE PER EFFECT, NOT PER PART. An effect given to a panel goes to
   * every panel of its kind (14 on PST's Play page): one line names them all.
   */
  for (const g of effects.values()) {
    const e = a.effect(g.id);
    const name = e?.name ?? g.id;
    const hooks = [...new Set(g.parts.map((n) => n.source?.hook?.value).filter(Boolean))] as string[];
    const pages = [...new Set(g.parts.map((n) => pageName.get(n.pageId) ?? "the page"))];
    const many = g.parts.length > 1;
    out.push({
      key: many ? `build-effect-${g.id}-${g.parts.map((n) => n.id).sort().join("+")}` : `build-effect-${g.parts[0]!.id}-${g.id}`,
      kind: "build",
      hook: hooks[0] ?? null,
      page: pages.join(", "),
      says: clean(`J gave ${many ? `these ${g.parts.length} parts` : "this part"} the "${name}" effect in the Builder${e?.blurb ? ` (${e.blurb.replace(/\.$/, "")})` : ""}${g.set ? `, set to ${g.set}` : ""}. The style layer cannot carry it; build it in the code on ${many ? `each of: ${hooks.map((h) => `\`${h}\``).join(", ")}` : "this element"}.`),
    });
  }
  /*
   * A FRAME WHOSE ADDRESS J CHANGED (the embed box, `EmbedBox.tsx`). The
   * import found it showing one page; he set another. The code sets a
   * frame's src, so the code is asked.
   */
  for (const n of a.nodes) {
    const hook = n.source?.hook?.value;
    const src = n.embed?.src?.trim();
    if (!hook || !src || !n.embed?.was || n.embed.was === src) continue;
    out.push({ key: `build-embed-${n.id}-${src}`, kind: "build", hook, page: pageName.get(n.pageId) ?? "the page", says: clean(`J changed what the embedded frame \`${hook}\` shows in the Builder, from ${n.embed.was} to ${src}. Point that frame at the new address, keeping data-hook="${hook}" and the site's embed rules.`) });
  }
  /*
   * PUSH ON PRESS MAKES IT PRESSABLE (J, 2026-10-10: "I would also expect
   * that motion to make it a button maybe or linkable"). The style layer
   * gives it the pointing hand and the press; only the code can make an
   * element a real link or button. A part the code already has as one is
   * left alone; a link the site's rules turn down is the publish check's.
   */
  const rules = offsiteRules(String(a.format["links.offsite"] ?? DEFAULT_OFFSITE));
  for (const n of a.nodes) {
    const hook = n.source?.hook?.value;
    if (!hook || !pushedOnPress(n.work) || /^\s*(button|link)\b/i.test(n.data ?? "")) continue;
    const l = n.link?.target ? n.link : null;
    if (l?.kind === "url" && isOffsite(l.target) && !linkAllowed(l.target, rules)) continue;
    out.push(l ? {
      key: `build-press-link-${n.id}-${l.target}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean(`J gave \`${hook}\` Push on press in the Builder and set it to go to ${linkSays(l)} when pressed. Make it a real link there (an \`<a href>\`, or a \`<button>\` that goes there), reachable with Tab and pressed with Enter, keeping data-hook="${hook}" and its look.`),
    } : {
      key: `build-press-button-${n.id}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean(`J gave \`${hook}\` Push on press in the Builder but has not picked where a press goes. Make this a button: a \`<button type="button">\` (or role="button" with tabindex="0", pressed with Enter and Space), keeping data-hook="${hook}" and its look. Until J picks a place (When pressed, go to) it does nothing else.`),
    });
  }
  /* Whole-site features switched on in Format. */
  for (const s of a.switches) {
    const v = a.format[s.key];
    if (!on(s, v) || (s.def !== undefined && v === s.def)) continue;
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
