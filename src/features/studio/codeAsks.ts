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
 * he moved on or off, a page with no file in the code. Pure: no store, no React,
 * nothing imported at run time but pure modules (`motionCss.ts`, `fixLoop.ts`); `tests/code-asks.mjs` holds it.
 *
 * ASKED AGAIN WHEN HE CHANGES IT (audit 2026-10-11). A line's key was only
 * what it was about, so once it went out nothing about that thing was asked
 * again: another page transition, a part moved, an effect set differently, a
 * switch turned back off. Now each key is `what~value` (`fixLoop.ts#baseOf`):
 * asked differently, it is a new line, and the older one is replaced. What a
 * line asked for (`asked`) and J then turns off asks to come out: a Format
 * switch, an effect, Push on press, a frame or page put back as the code had
 * it. A part, page or whole-site motion deleted, or a page's scroll set back
 * to the site's, asks nothing: a Clear and bring in leaves the board the
 * same way, while the code keeps what it built.
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
import { baseOf, type FixIssue } from "./fixLoop.ts";
/* Pure too: which effects and whole-site motions the style layer already writes as CSS, so they are not asked as well. */
import { carriedEffect, carriedSite, pushedOnPress } from "./send-out/motionCss.ts";
import { DEFAULT_OFFSITE, isOffsite, linkAllowed, offsiteRules } from "./shelf/parts/offsite.ts";
import { kitEffect, kitSite } from "./send-out/kitMotion.ts";
import { PART_SCRIPT } from "./shelf/library/works.ts";

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
/** `came`: its name and route before J first renamed or moved it (`StudioPage.came`). */
export interface AskPage { id: string; name: string; path?: string; scroll?: string; came?: { name: string; path: string } | null }
/** A Format switch; `def`, the value a new board starts at: a switch still at it is not something J switched, on or off (PonsStars came in with page transitions, search listing, accessibility and speed bars at their defaults). */
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
  /** The site's name and description as typed in the Pages tab (`brief`): its head, which no style can carry. */
  site?: { name?: string; description?: string } | null;
  /** The keys of the lines already out for this site, sent, pending or built (`fixLoop.ts`): what they were about is asked again when it changes, and turned off, asked to come out. */
  asked?: Iterable<string>;
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
/* What a line asks, printed short for its key (FNV-1a): asked differently, it is another key, so another line. */
const print = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(36); };
/* A value as a key reads it: "curtain wipe" is curtain-wipe. */
const tag = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || print(s);
/* A part the code has, as a line names it: by its data-hook, else its id, else its words. */
const named = (n: AskNode) => (n.source?.hook ? (n.source.hook.attr === "id" ? `the element with id="${n.source.hook.value}"` : `\`${n.source.hook.value}\``) : `the part "${clean(String(n.label ?? wordsOf(n.content))).slice(0, 60)}"`);
/* Where a shelf part's own motion goes (an orb, a 3D shape, a before / after slider): rule 35 lets the code chat write
   `--builder-motion` itself only here, because Publish names no motion for these parts. */
export const OWN_CSS = "in the page's own stylesheet on that hook (never in the style layer: BUILDER-RULES.md rule 35 allows this for a part a NEXT.md line asks for)";

/**
 * The exact `--builder-motion` a shelf part's own script goes by on a
 * builder-ready site: a cube or a pyramid names its shape, and the turnable
 * orb its surface (glass unless J picked metal or matte, as `parts/Orb.tsx`
 * reads it), which the kit's file draws on the graphics card as the board
 * does. It used to be plain `planet`: the flat planet, never the orb he saw.
 */
export function partMotion(featureId: string, options?: Record<string, string> | null): string | null {
  const id = PART_SCRIPT[featureId];
  if (!id) return null;
  if (/^shape-(cube|pyramid)$/.test(featureId)) return `${id}?shape=${featureId.slice(6)}`;
  if (featureId === "orb-webgl") return `${id}?surface=${encodeURIComponent(options?.surface?.trim() || "glass")}`;
  return id;
}

/** Every board change the style layer cannot carry, as a line for NEXT.md (`kind: "build"`). */
export function codeAsks(a: AskInput): FixIssue[] {
  const pageName = new Map(a.pages.map((p) => [p.id, p.name]));
  /* What the lines already out were about: each is asked again when it changes, or when J turns it off. */
  const before = new Set([...(a.asked ?? [])].map(baseOf));
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
    /* What it is now, however the line puts it: its key prints this, so a part changed after it was asked is asked again. */
    const about = clean([
      `a ${name}${n.label && n.label !== name ? ` called "${n.label}"` : ""}, ${where}, ${n0(n.w)} by ${n0(n.h)}px.`,
      words ? `Its words: "${words.slice(0, 200)}".` : "",
      n.link?.target ? `Pressing it leads to ${linkSays(n.link)}.` : "",
      n.prompt?.trim() ? `J's note for it: "${n.prompt.trim().slice(0, 400)}".` : "",
      fx.length ? `Its effects: ${fx.join(", ")}.` : "",
      n.outline?.cut ? "Its outline is drawn, not a box: cut it with the clip-path below." : "",
      css.length ? `Its look: \`${css.join("; ")}\`.` : "",
      /* An orb is a ball the kit's motion file draws and turns: no drawing code to write (`library/planetJs.ts`). */
      /* A before / after slider is split by the same file: two pictures stacked at full size, the before revealed by the handle (`compare`). */
      a.kit && PART_SCRIPT[n.featureId ?? ""] === "compare" ? `It is a before / after slider: give its hook \`--builder-motion: "compare"\` ${OWN_CSS}, with the two pictures inside it as \`<img data-compare-after src="...">\` and \`<img data-compare-before src="...">\` (each with its own data-hook), and vendor/builder-motion.js stacks them at full size in the same place and reveals the before by dragging the handle, with no stretching.` :
      a.kit && PART_SCRIPT[n.featureId ?? ""] ? `It is a 3D shape that turns in the hand: give its hook \`--builder-motion: "${partMotion(n.featureId!, n.options)}"\` ${OWN_CSS}, with any pictures inside it as \`<img data-planet-picture src="...">\` (one per face), and vendor/builder-motion.js draws and turns it.` : "",
    ].filter(Boolean).join(" "));
    const base = `build-part-${n.id}`, record = "its record (outline, link, note, effects) is in design/record.json under that hook.";
    out.push({
      key: `${base}~${print(`${hook} ${about}`)}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      /* Asked before, the code has it: it is changed to match, never made twice. */
      says: before.has(base)
        ? `J changed the part he made in the Builder with data-hook="${hook}". It is now ${about} Change it in the code to match, keeping data-hook="${hook}"; ${record}`
        : `J made a new part in the Builder: ${about} Make it in the code with data-hook="${hook}"; ${record}`,
    });
  }
  const effects = new Map<string, { id: string; set: string; parts: AskNode[] }>();
  for (const n of a.nodes) {
    if (!n.source && !n.from) continue;
    const uses = n.work ? [n.work, ...(n.work.also ?? [])] : [];
    for (const u of uses) {
      if (u.off) continue;
      /* Lift, press, float, spin, blink, reveal and switch on go out as CSS (`motionCss.ts`), but only on a hook the layer can key: not on a part with none (a form label, a ::marker), nor on an id-only part of a builder-ready site. */
      if (carriedEffect(u.id) && n.source?.hook && (!a.kit || n.source.hook.attr === "data-hook")) continue;
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
    /* A part with no data-hook is named by its id, or else by its words, so the line still says which one. */
    const names = [...new Set(g.parts.map(named))];
    const pages = [...new Set(g.parts.map((n) => pageName.get(n.pageId) ?? "the page"))];
    const many = g.parts.length > 1;
    /* Its settings are what it asks: set differently, it is asked again. */
    const base = many ? `build-effect-${g.id}-${g.parts.map((n) => n.id).sort().join("+")}` : `build-effect-${g.parts[0]!.id}-${g.id}`;
    out.push({
      key: g.set ? `${base}~${print(g.set)}` : base,
      kind: "build",
      hook: hooks[0] ?? null,
      page: pages.join(", "),
      says: clean(`J gave ${many ? `these ${g.parts.length} parts` : "this part"} the "${name}" effect in the Builder${e?.blurb ? ` (${e.blurb.replace(/\.$/, "")})` : ""}${g.set ? `, set to ${g.set}` : ""}. The style layer cannot carry it; build it in the code on ${many ? `each of: ${names.join(", ")}` : g.parts[0]!.source?.hook?.attr === "data-hook" ? "this element" : names[0]}.`),
    });
  }
  /*
   * AN EFFECT J TURNED OFF (its switch in the Motion panel) on parts a line
   * asked it for: one line asks the code to take it out of them. Only turned
   * off: an effect gone with its part, or in a Clear and bring in, asks
   * nothing (see the top of this file).
   */
  const ids = new Set(a.nodes.map((n) => n.id));
  const offs = new Map<string, { id: string; of: number; parts: AskNode[] }>();
  for (const n of a.nodes) {
    if (!n.source && !n.from) continue;
    const uses = n.work ? [n.work, ...(n.work.also ?? [])] : [];
    for (const u of uses) {
      if (!u.off || uses.some((x) => x.id === u.id && !x.off)) continue;
      /* The lines that asked it of this part: its own, or one naming every part of a group (`build-effect-<effect>-<part>+<part>`). */
      for (const b of before) {
        const of = b === `build-effect-${n.id}-${u.id}` ? [n.id] : b.startsWith(`build-effect-${u.id}-`) ? b.slice(`build-effect-${u.id}-`.length).split("+") : [];
        if (!of.includes(n.id) || !of.every((id) => ids.has(id))) continue;
        const g = offs.get(b) ?? { id: u.id, of: of.length, parts: [] };
        if (!g.parts.includes(n)) g.parts.push(n);
        offs.set(b, g);
      }
    }
  }
  for (const [b, g] of offs) {
    const many = g.parts.length > 1;
    const names = g.parts.map(named);
    out.push({
      /* Off on some of a group's parts is another line than off on all of them. */
      key: `${b}~off${g.parts.length < g.of ? `-${print(g.parts.map((n) => n.id).sort().join("+"))}` : ""}`,
      kind: "build",
      hook: g.parts.map((n) => n.source?.hook?.value).find(Boolean) ?? null,
      page: [...new Set(g.parts.map((n) => pageName.get(n.pageId) ?? "the page"))].join(", "),
      says: clean(`J turned off the "${a.effect(g.id)?.name ?? g.id}" effect on ${many ? `these ${g.parts.length} parts` : "this part"} in the Builder. Take it out of the code on ${many ? `each of: ${names.join(", ")}` : g.parts[0]!.source?.hook?.attr === "data-hook" ? "this element" : names[0]}.`),
    });
  }
  /*
   * A FRAME WHOSE ADDRESS J CHANGED (the embed box, `EmbedBox.tsx`). The
   * import found it showing one page; he set another. The code sets a
   * frame's src, so the code is asked; set back after a line asked for
   * another, it is asked to go back.
   */
  for (const n of a.nodes) {
    const hook = n.source?.hook?.value;
    const src = n.embed?.src?.trim();
    const base = `build-embed-${n.id}`;
    if (!hook || !src || !n.embed?.was || (n.embed.was === src && !before.has(base))) continue;
    out.push({
      key: `${base}~${print(src)}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean(n.embed.was === src
        ? `J set the embedded frame \`${hook}\` back to ${src} in the Builder, the address the code gave it. Point that frame at it again, keeping data-hook="${hook}" and the site's embed rules.`
        : `J changed what the embedded frame \`${hook}\` shows in the Builder, from ${n.embed.was} to ${src}. Point that frame at the new address, keeping data-hook="${hook}" and the site's embed rules.`),
    });
  }
  /*
   * PUSH ON PRESS MAKES IT PRESSABLE (J, 2026-10-10: "I would also expect
   * that motion to make it a button maybe or linkable"). The style layer
   * gives it the pointing hand and the press; only the code can make an
   * element a real link or button. A part the code already has as one is
   * left alone, unless a line made it one; a link the site's rules turn
   * down is the publish check's. Turned off where a line made it pressable,
   * and going nowhere, it is asked to be plain again.
   */
  const rules = offsiteRules(String(a.format["links.offsite"] ?? DEFAULT_OFFSITE));
  for (const n of a.nodes) {
    const hook = n.source?.hook?.value;
    if (!hook) continue;
    const base = `build-press-${n.id}`;
    if (!pushedOnPress(n.work)) {
      const off = !!n.work && [n.work, ...(n.work.also ?? [])].some((u) => u.id === "press-push" && u.off);
      if (off && before.has(base) && !n.link?.target) out.push({ key: `${base}~off`, kind: "build", hook, page: pageName.get(n.pageId) ?? "the page", says: clean(`J turned off Push on press on \`${hook}\` in the Builder, and pressing it goes nowhere. Make it a plain element again, not a link or a button, keeping data-hook="${hook}" and its look.`) });
      continue;
    }
    if (/^\s*(button|link)\b/i.test(n.data ?? "") && !before.has(base)) continue;
    const l = n.link?.target ? n.link : null;
    if (l?.kind === "url" && isOffsite(l.target) && !linkAllowed(l.target, rules)) continue;
    out.push(l ? {
      key: `${base}~${print(`${l.kind} ${l.target}`)}`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean(`J gave \`${hook}\` Push on press in the Builder and set it to go to ${linkSays(l)} when pressed. Make it a real link there (an \`<a href>\`, or a \`<button>\` that goes there), reachable with Tab and pressed with Enter, keeping data-hook="${hook}" and its look.`),
    } : {
      key: `${base}~button`,
      kind: "build",
      hook,
      page: pageName.get(n.pageId) ?? "the page",
      says: clean(`J gave \`${hook}\` Push on press in the Builder but has not picked where a press goes. Make this a button: a \`<button type="button">\` (or role="button" with tabindex="0", pressed with Enter and Space), keeping data-hook="${hook}" and its look. Until J picks a place (When pressed, go to) it does nothing else.`),
    });
  }
  /*
   * WHOLE-SITE FEATURES J SWITCHED, ON OR OFF. Search listing, the
   * accessibility and speed bars and page transitions start on, so a switch
   * that only counted when on could never ask: switched on it was still at
   * its start, and switched off it was off. Now whichever way it moved from
   * where the site came in is asked. Page transitions are dropped from the
   * Motion shelf, not switched in Format, so the line names no tab. Back
   * where it came in after a line asked otherwise, it is asked back.
   */
  for (const s of a.switches) {
    const v = a.format[s.key] ?? s.def;
    const lit = on(s, v);
    const base = `build-format-${s.key}`;
    if ((s.def !== undefined ? v === s.def : !lit) && !before.has(base)) continue;
    const said = typeof v === "string" ? ` (${v})` : "";
    out.push({
      key: `${base}~${!lit ? "off" : typeof v === "string" ? tag(v) : "on"}`,
      kind: "build",
      hook: null,
      page: "every page",
      says: clean(lit ? `J switched on "${s.label}"${said} for the whole site in the Builder. Build it in the code.` : `J switched off "${s.label}"${said} for the whole site in the Builder. Take it out of the code.`),
    });
  }
  /* Pages: one added in the Builder, a page's own scroll behaviour, and a page the code has renamed or moved. */
  for (const p of a.pages) {
    if (!a.coded.has(p.id)) {
      const base = `build-page-${p.id}`, at = p.path ? ` at ${p.path}` : "";
      /* Asked before, the code has it: renamed or moved, it is changed to match, never made twice. */
      out.push({ key: `${base}~${print(`${p.name} ${p.path ?? ""}`)}`, kind: "build", hook: null, page: p.name, says: clean(before.has(base) ? `J changed the page he added in the Builder: it is now "${p.name}"${at}. Change it in the code to match, keeping every data-hook.` : `J added the page "${p.name}"${at} in the Builder. Make it in the code, with a data-hook on every part, as the board lays it out.`) });
    }
    if (p.scroll && p.scroll !== "inherit") {
      out.push({ key: `build-scroll-${p.id}~${tag(p.scroll)}`, kind: "build", hook: null, page: p.name, says: clean(`J set this page's scroll to "${p.scroll}" in the Builder. Build that scroll behaviour in the code.`) });
    }
    /*
     * A PAGE THE CODE HAS, RENAMED OR MOVED IN THE PAGES TAB (audit
     * 2026-10-11): its name is its title and its route is where the code
     * serves it, so Publish said "Published" and the live site kept both.
     * Asked against what it was before he first changed it (`came`), and
     * asked back when he puts it back after a line asked otherwise.
     */
    if (!a.coded.has(p.id) || !p.came) continue;
    const rename = `build-rename-${p.id}`, move = `build-move-${p.id}`;
    const wherever = `wherever the code names that page: its \`<title>\`, its link preview, the site's own navigation, and builder.json's pages if there is one.`;
    if (p.name.trim() && (p.name !== p.came.name || before.has(rename))) out.push({ key: `${rename}~${print(p.name)}`, kind: "build", hook: null, page: p.name, says: clean(p.name !== p.came.name ? `J renamed the page "${p.came.name}" to "${p.name}" in the Builder. Use the new name ${wherever}` : `J renamed the page back to "${p.name}" in the Builder, the name the code gave it. Use it again ${wherever}`) });
    if (p.path?.trim() && (p.path !== p.came.path || before.has(move))) out.push({ key: `${move}~${print(p.path)}`, kind: "build", hook: null, page: p.name, says: clean(p.path !== p.came.path ? `J moved the page "${p.name}" from ${p.came.path} to ${p.path} in the Builder. Serve it at ${p.path} and update every link to it, keeping every data-hook.` : `J moved the page "${p.name}" back to ${p.path} in the Builder, where the code had it. Serve it there again and update every link to it, keeping every data-hook.`) });
  }
  /* The site's own name and description from the Pages tab: the code's head stands until he types one, and keeps what it has when he empties it. */
  const name = clean(a.site?.name ?? ""), description = clean(a.site?.description ?? "");
  if (name) out.push({ key: `build-head-name~${print(name)}`, kind: "build", hook: null, page: "every page", says: `J named the site "${name}" in the Builder. Use it as the site's name wherever the code names the site: each page's \`<title>\` and its link preview's og:site_name.` });
  if (description) out.push({ key: `build-head-description~${print(description)}`, kind: "build", hook: null, page: "every page", says: `J gave the site the description "${description}" in the Builder (the line under its name in a link preview). Use it as each page's \`<meta name="description">\` and its link preview's og:description and twitter:description, where a page has none of its own.` });
  return out;
}
