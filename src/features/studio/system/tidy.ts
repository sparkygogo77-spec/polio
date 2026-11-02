/**
 * TIDY A TAKEN SYSTEM: fold its sizes into a usable scale, dry run first.
 *
 * A System taken from a captured site is exact, and exact is unusable as a
 * design language: sol face wears 35 text sizes, 39 space steps and 8
 * corners, most of them one or two pixels from the next. Tidying folds each
 * kind of size onto a scale, so a person can read the System and choose
 * from it. Nothing here changes anything: `tidyPlan` reads a System and the
 * parts pointing at it and hands back a PLAN, the System as it would be and
 * which parts would move, with how far. `api.ts#tidySystem` applies a plan
 * as one undo step; until then not a pixel moves.
 *
 * THE RULES, in plain words (every one is in this file, nowhere else):
 *
 *   · TOLERANCE: AN EIGHTH. Two sizes that differ by less than an eighth
 *     (12.5%) are not two sizes to a reader: 20px and 22px words look the
 *     same size side by side, and 16px and 18px padding give the same room.
 *     So folding may move a size by up to an eighth without the board
 *     looking different, and NO SIZE EVER MOVES FURTHER THAN THAT, however
 *     rarely it is worn. Where a value moves, how far is in the plan, so a
 *     person can see it before it does.
 *
 *   · TEXT SIZES fold onto a RATIO SCALE from the body size: the size most
 *     fields wear is the body, and the steps are the body times a ratio to
 *     a power, rounded to whole pixels. Every size snaps to its nearest step
 *     (nearest by proportion, so 9 is as near to 8 as 18 is to 16). The
 *     ratio is the coarsest of 1.5, 1.414, 1.333, 1.25, 1.2 and 1.125 under
 *     which no size moves further than an eighth: as few steps as the site's
 *     own sizes allow. A site whose sizes already sit near a coarse scale
 *     gets it (mochi: 13 sizes to 4); one spanning 8px to 155px with sizes
 *     everywhere between keeps more steps (sol face: 35 to 14). The count
 *     is what the sizes need, not a number chosen first. A System tidied
 *     once keeps its scale: tidying again tries that ratio first, so the
 *     second press moves nothing (or only a size added since).
 *
 *   · SPACE STEPS (padding, gaps) fold onto a GRID whose step grows with
 *     the size: every pixel up to 8, by 2 to 16, by 4 to 32, by 8 to 64, by
 *     16 to 128, by 32 to 256, then doubling the step at each doubling. So
 *     every snap is within an eighth, hairlines (1px, 2px, 3px) stay what
 *     they are, 9 folds to 10 and 11 to 12 (nearest by proportion), and 24
 *     and 25 fold to 24.
 *
 *   · CORNERS fold their near-duplicates together: radii within an eighth
 *     (or a pixel: a 3px corner and a 4px one are the same corner) of the
 *     one most parts wear become that one, so 3, 4 and 5 become 4 while 3
 *     and 7 stay apart. The most-worn corner gathers first, then the
 *     most-worn of what is left, and so on; a corner near two leads goes to
 *     the heavier. So no two surviving corners are within the tolerance of
 *     each other, and a second tidy finds nothing to gather (a nearest-pair
 *     chain is not so: 24 pairs with 22 because 24 cannot reach 20, and the
 *     next tidy folds 22 into 20, moving the old 24 further than an eighth
 *     in two steps; gotchi did this in the Builder, 2026-11-01). The pixel
 *     is why corners alone may fold their smallest or largest away: 3 into
 *     4 is not a smaller corner lost. A pill (a radius of 999px or more,
 *     which rounds the whole end of a part whatever its size) is never
 *     folded: it is a shape, not a size.
 *
 *   · THE SMALLEST AND LARGEST text size and space step are kept exactly.
 *     The scale's range is the site's range: nothing gets bigger than the
 *     biggest thing on the site or smaller than the smallest.
 *
 *   · TWICE IS ONCE. Every fold is a fixed point: the text scale is recorded
 *     and tried first, the grid is the grid, and the corners' leads are not
 *     near each other. So a second Tidy moves nothing (or only a size added
 *     since). `tests/system-tidy.mjs` checks it on every capture.
 *
 *   · WHICH TOKEN SURVIVES a fold is the one most fields point at; it keeps
 *     its id (so other sites sharing the System keep their pointers) and
 *     takes the step's value. The others are taken out of the System and
 *     every field pointing at them points at the survivor instead.
 *
 *   · WHAT MOVES when the plan is applied is only what points at a token
 *     and still holds that token's value (`resolve.ts`): a field set apart
 *     by hand ("change just this one") stays, and so does every part that
 *     holds its own values and points at nothing. The plan counts those
 *     under `stays`.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it
 * (`tests/system-tidy.mjs`).
 */
import { kindKey, kindWord } from "../partKind.ts";
import { kindOfField, kindOfToken, type FieldPath, type LookRef, type LookRefs, type NodeSys, type SizeToken, type System, type SystemComponent } from "./model.ts";
import { fieldValue, sameValue, type SysNode } from "./resolve.ts";
import { cornerNames, typeStepNames } from "./take.ts";

/** The kinds of size a tidy folds. Colours fold on their own already (close shades, `siteRoles.ts`); shadows and motion are few. */
export type TidyKind = "type" | "space" | "radius";
export const TIDY_KINDS: readonly TidyKind[] = ["type", "space", "radius"];
export const TIDY_WORD: Record<TidyKind, string> = { type: "text sizes", space: "space steps", radius: "corners" };
export type TidyOn = Record<TidyKind, boolean>;
export const TIDY_ALL: TidyOn = { type: true, space: true, radius: true };

/** The tolerance: an eighth, as a proportion in log units (so it reads the same way up and down). */
export const EIGHTH = Math.log(1.125);
/** The ratios a text scale may have, coarsest first: the first under which no size moves further than an eighth is taken (1.125 always passes: its half step is 6%). */
export const RATIOS: readonly number[] = [1.5, 1.414, 1.333, 1.25, 1.2, 1.125];
/** A corner this big or bigger is a pill: it rounds the whole end of a part whatever the part's size, so it is never folded. */
export const PILL = 999;

const away = (from: number, to: number) => Math.abs(Math.log(to / from));
/** The nearest of `steps` to `px` by proportion; of two as near, the larger. */
function nearest(px: number, steps: readonly number[]): number {
  let best = steps[0]!;
  for (const s of steps) {
    const d = away(px, s), b = away(px, best);
    if (d < b - 1e-12 || (Math.abs(d - b) <= 1e-12 && s > best)) best = s;
  }
  return best;
}

export interface Sized { px: number; weight: number }
export interface Fold { to: Map<number, number>; ratio: number | null; base: number | null }

/**
 * Text sizes onto a ratio scale from the body (see the header). `kept` is
 * the scale a tidy before recorded (`tokens.type.scale` of a System with
 * `tidied`): tried first, so a tidied System holds its scale.
 */
export function foldType(sizes: readonly Sized[], kept?: { ratio: number; base: number } | null): Fold {
  const to = new Map<number, number>();
  if (!sizes.length) return { to, ratio: null, base: null };
  const pxs = [...new Set(sizes.map((s) => s.px))].sort((a, b) => a - b);
  const min = pxs[0]!, max = pxs[pxs.length - 1]!;
  /* The body: the size most fields wear (of two, the smaller, which is the one the words wear rather than the one a heading does). */
  const body = [...sizes].sort((a, b) => b.weight - a.weight || a.px - b.px)[0]!.px;
  if (pxs.length < 2) { to.set(min, min); return { to, ratio: null, base: body }; }
  const tries: { ratio: number; base: number }[] = [...(kept ? [kept] : []), ...RATIOS.map((ratio) => ({ ratio, base: body }))];
  for (const [i, { ratio, base }] of tries.entries()) {
    const steps = new Set<number>([min, max]);
    for (let k = -40; k <= 40; k++) {
      const step = Math.round(base * ratio ** k);
      if (step > min && step < max) steps.add(step);
    }
    const list = [...steps].sort((a, b) => a - b);
    const snap = new Map(pxs.map((px) => [px, nearest(px, list)] as const));
    const ok = pxs.every((px) => away(px, snap.get(px)!) <= EIGHTH + 1e-9);
    if (ok || i === tries.length - 1) return { to: new Map(snap), ratio, base };
  }
  return { to, ratio: null, base: body };
}

/** The space grid up to `max`: every pixel to 8, then a step that doubles at each doubling of the size. */
export function spaceGrid(max: number): number[] {
  const out: number[] = [];
  for (let px = 1; px <= 8; px++) out.push(px);
  let step = 2;
  for (let px = 8 + step, top = 16; out[out.length - 1]! < max; px += step) {
    out.push(px);
    if (px >= top) { step *= 2; top *= 2; }
  }
  return out;
}

/** Space steps onto the grid, the smallest and largest kept. */
export function foldSpace(sizes: readonly Sized[]): Fold {
  const to = new Map<number, number>();
  if (!sizes.length) return { to, ratio: null, base: null };
  const pxs = [...new Set(sizes.map((s) => s.px))].sort((a, b) => a - b);
  const min = pxs[0]!, max = pxs[pxs.length - 1]!;
  const steps = [...new Set([min, max, ...spaceGrid(max).filter((g) => g > min && g < max)])].sort((a, b) => a - b);
  for (const px of pxs) to.set(px, nearest(px, steps));
  return { to, ratio: null, base: null };
}

/** Within an eighth, or a pixel: the same corner to a reader. Symmetric, which is what makes the fold below a fixed point. */
const nearCorner = (a: number, b: number) => Math.abs(b - a) <= 1 + 1e-9 || away(a, b) <= EIGHTH + 1e-9;

/**
 * Corners: near-duplicates (within an eighth or a pixel) become the one most
 * parts wear; pills stay. The most-worn corner leads first and gathers every
 * loose corner near it; then the most-worn of what is left, and so on. Every
 * corner lands within the tolerance of its lead, and no two leads are near
 * each other (a corner near a heavier lead went to it), so folding the folded
 * corners again changes nothing, whatever their weights have become. A
 * nearest-pair-first clustering is not so (see the header): it pairs 22 with
 * 24 when 24 cannot reach 20, and the next tidy then folds 22 into 20.
 */
export function foldRadius(sizes: readonly Sized[]): Fold {
  const to = new Map<number, number>();
  if (!sizes.length) return { to, ratio: null, base: null };
  const weight = new Map<number, number>();
  for (const s of sizes) weight.set(s.px, (weight.get(s.px) ?? 0) + s.weight);
  const pills = [...weight.keys()].filter((px) => px >= PILL);
  for (const px of pills) to.set(px, px);
  /* Most worn first; of two as worn, the smaller (the one the words' boxes wear rather than a card's). */
  const loose = [...weight.keys()].filter((px) => px < PILL).sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || a - b);
  const leads: number[] = [];
  for (const px of loose) {
    const lead = leads.find((l) => nearCorner(l, px));
    to.set(px, lead ?? px);
    if (lead === undefined) leads.push(px);
  }
  return { to, ratio: null, base: null };
}

/* ------------------------------------------------------------------ */
/* The plan                                                            */
/* ------------------------------------------------------------------ */

/** A part as tidying reads it: its System link and fields, and what `partKind.ts` needs to say what kind of part it is. */
export type TidyNode = SysNode & { featureId?: string; pageId?: string } & Record<string, unknown>;

/** One token that folds: where it was, where it goes, and what moves with it. */
export interface TidyMove {
  token: string;
  name: string;
  from: number;
  to: number;
  /** Fields pointing at it that hold its value and so move. */
  fields: number;
  /** The parts those fields are on. */
  parts: string[];
  /** Fields pointing at it set apart by hand: they keep their value. */
  stays: number;
}
/** One step of the folded scale: the surviving token, and the tokens that fold into it. */
export interface TidyStep {
  token: string;
  name: string;
  px: number;
  /** The old values that fold here, the step's own among them when it moves or gathers. Empty for a step that stays as it is. */
  gathers: TidyMove[];
  fields: number;
  parts: string[];
  /** The kinds of part that move, in words ("buttons", "word parts"), most first. */
  kinds: { word: string; parts: number }[];
}
export interface TidyKindPlan {
  kind: TidyKind;
  word: string;
  before: number;
  after: number;
  /** For text sizes: the ratio and body the scale is built from. */
  ratio: number | null;
  base: number | null;
  steps: TidyStep[];
  fields: number;
  parts: string[];
  stays: number;
}
export interface TidyPlan {
  kinds: TidyKindPlan[];
  /** The System as it would be: the same object as the one given when nothing would change. */
  after: System;
  /** Each part's link as it would be, for the parts whose pointers move to a surviving token. */
  links: Map<string, NodeSys>;
  fields: number;
  /** Every part that would move, once each. */
  parts: string[];
  stays: number;
  nothing: boolean;
}

const listOf = (s: System, kind: TidyKind): SizeToken[] => (kind === "type" ? s.tokens.type.steps : kind === "space" ? s.tokens.space : s.tokens.radius);
const FOLD: Record<TidyKind, (sizes: readonly Sized[], s: System) => Fold> = {
  type: (sizes, s) => foldType(sizes, s.tidied ? s.tokens.type.scale : null),
  space: foldSpace,
  radius: foldRadius,
};

/** The plan for tidying `s` on these parts. Reads everything, changes nothing. */
export function tidyPlan(s: System, nodes: readonly TidyNode[], on: Partial<TidyOn> = {}, at = Date.now()): TidyPlan {
  const want: TidyOn = { ...TIDY_ALL, ...on };
  const mine = nodes.filter((n) => n.sys?.s === s.id && n.sys.f);
  /* How many fields point at each token, and which fields on which parts. */
  const pointers = new Map<string, { node: TidyNode; field: FieldPath }[]>();
  for (const n of mine) for (const [f, id] of Object.entries(n.sys!.f!)) if (id) pointers.set(id, [...(pointers.get(id) ?? []), { node: n, field: f as FieldPath }]);
  const weightOf = (id: string) => pointers.get(id)?.length ?? 0;

  const kinds: TidyKindPlan[] = [];
  const survivorOf = new Map<string, string>();
  let tokens = s.tokens;
  for (const kind of TIDY_KINDS) {
    const list = listOf(s, kind);
    if (!want[kind] || !list.length) continue;
    const fold = FOLD[kind](list.map((t) => ({ px: t.px, weight: weightOf(t.id) })), s);
    /* Group by where each lands; the survivor is the member most fields point at. */
    const groups = new Map<number, SizeToken[]>();
    for (const t of list) { const to = fold.to.get(t.px) ?? t.px; groups.set(to, [...(groups.get(to) ?? []), t]); }
    const steps: TidyStep[] = [];
    const survivors: SizeToken[] = [];
    for (const [px, members] of groups) {
      const keep = [...members].sort((a, b) => weightOf(b.id) - weightOf(a.id) || Math.abs(a.px - px) - Math.abs(b.px - px))[0]!;
      survivors.push({ ...keep, px });
      const gathers: TidyMove[] = [];
      const moved = new Set<string>();
      const byKind = new Map<string, Set<string>>();
      for (const t of members) {
        if (t.id !== keep.id) survivorOf.set(t.id, keep.id);
        if (t.px === px) continue;
        let fields = 0, stays = 0;
        const parts = new Set<string>();
        for (const { node, field } of pointers.get(t.id) ?? []) {
          const now = fieldValue(node, field), held = node.sys?.v?.[field];
          if (kindOfField(field) !== kind) continue;
          if (held !== undefined && !sameValue(kind, now, held)) { stays++; continue; }
          if (sameValue(kind, now, px)) continue;
          fields++;
          parts.add(node.id);
          moved.add(node.id);
          const key = kindWord(kindKey(node as never), 2);
          byKind.set(key, (byKind.get(key) ?? new Set()).add(node.id));
        }
        gathers.push({ token: t.id, name: t.name, from: t.px, to: px, fields, parts: [...parts], stays });
      }
      steps.push({
        token: keep.id, name: keep.name, px, gathers, fields: gathers.reduce((a, g) => a + g.fields, 0), parts: [...moved],
        kinds: [...byKind.entries()].map(([word, ids]) => ({ word, parts: ids.size })).sort((a, b) => b.parts - a.parts),
      });
    }
    steps.sort((a, b) => (kind === "type" ? b.px - a.px : a.px - b.px));
    /* Names for the folded scale, as the take names them, when something folds; a kind that stays as it is keeps the names it was given. */
    if (steps.some((st) => st.gathers.length)) {
      const named = nameSteps(kind, steps.map((st) => st.px), fold.base);
      steps.forEach((st, i) => { st.name = named[i]!; });
    }
    const nextList = steps.map((st) => ({ id: st.token, name: st.name, px: st.px }));
    const same = nextList.length === list.length && nextList.every((t, i) => t.id === list[i]!.id && t.px === list[i]!.px && t.name === list[i]!.name);
    const parts = [...new Set(steps.flatMap((st) => st.parts))];
    kinds.push({
      kind, word: TIDY_WORD[kind], before: list.length, after: steps.length, ratio: fold.ratio, base: fold.base, steps,
      fields: steps.reduce((a, st) => a + st.fields, 0), parts, stays: steps.reduce((a, st) => a + st.gathers.reduce((b, g) => b + g.stays, 0), 0),
    });
    if (same) continue;
    tokens = kind === "type"
      ? { ...tokens, type: { ...tokens.type, steps: nextList, scale: fold.ratio && fold.base ? { ratio: fold.ratio, base: fold.base } : tokens.type.scale } }
      : kind === "space" ? { ...tokens, space: nextList } : { ...tokens, radius: nextList };
  }

  /* The parts' pointers, and the components' slots, onto the survivors. */
  const links = new Map<string, NodeSys>();
  if (survivorOf.size) {
    for (const n of mine) {
      let changed = false;
      const f: Partial<Record<FieldPath, string>> = {};
      for (const [field, id] of Object.entries(n.sys!.f!) as [FieldPath, string][]) {
        const to = survivorOf.get(id);
        if (to) changed = true;
        f[field] = to ?? id;
      }
      if (changed) links.set(n.id, { ...n.sys!, f });
    }
  }
  const components = survivorOf.size ? s.components.map((c) => repoint(c, survivorOf)) : s.components;
  const changedSystem = tokens !== s.tokens || components !== s.components;
  const after: System = changedSystem ? { ...s, tokens, components, rev: s.rev + 1, editedAt: Math.max(at, s.editedAt + 1), tidied: at } : s;
  const parts = [...new Set(kinds.flatMap((k) => k.parts))];
  return {
    kinds, after, links,
    fields: kinds.reduce((a, k) => a + k.fields, 0), parts, stays: kinds.reduce((a, k) => a + k.stays, 0),
    nothing: !changedSystem && !links.size,
  };
}

/** The names the take gives sizes of a kind, for the folded steps (`take.ts`). */
function nameSteps(kind: TidyKind, pxs: readonly number[], base: number | null): string[] {
  if (kind === "type") return typeStepNames(pxs, base ?? pxs[0] ?? 16);
  if (kind === "space") return pxs.map((_, i) => `Space ${i + 1}`);
  return cornerNames(pxs);
}

const ref = (r: LookRef | undefined, to: Map<string, string>): LookRef | undefined => (r && "token" in r && to.has(r.token) ? { token: to.get(r.token)! } : r);
function refs(look: LookRefs, to: Map<string, string>): LookRefs {
  let out = look;
  for (const [slot, r] of Object.entries(look) as [keyof LookRefs, LookRef][]) {
    const next = ref(r, to);
    if (next !== r) out = { ...out, [slot]: next };
  }
  return out;
}
/** A component with every slot that pointed at a folded token pointing at its survivor; the same component when none did. */
function repoint(c: SystemComponent, to: Map<string, string>): SystemComponent {
  const base = refs(c.base, to);
  let variants = c.variants;
  c.variants.forEach((v, i) => { const look = refs(v.look, to); if (look !== v.look) variants = variants.map((x, k) => (k === i ? { ...x, look } : x)); });
  return base === c.base && variants === c.variants ? c : { ...c, base, variants };
}

/** The plan's parts of one kind of token, by the token's id prefix: what a "used by" press lights. */
export function partsOfKind(plan: TidyPlan, kind: TidyKind): string[] {
  return plan.kinds.find((k) => k.kind === kind)?.parts ?? [];
}

/** True when a token id is one a tidy folds. */
export const tidies = (id: string): boolean => (TIDY_KINDS as readonly string[]).includes(kindOfToken(id) ?? "");
