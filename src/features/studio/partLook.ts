/**
 * A PART'S LOOK, APART FROM WHAT IT SAYS AND WHERE IT STANDS.
 *
 * Copy look / Paste look, Make all like this, Try before you apply and Remix
 * all move the same thing: how a part is dressed. This is that thing, once,
 * as eight facets a person can choose between:
 *
 *   fill      its colours, texture, see-through and blend
 *   outline   its edge's width, line and colour
 *   shadow    its box shadow and glow (aura)
 *   light     the lighting bar across it (a worn shape's band, a gloss laid
 *             over its fill)
 *   corners   its rounding and cut
 *   font      its type: face, size, weight, spacing, leading, case, and the
 *             shadow and stroke on its words
 *   hover     how it answers the pointer and a press
 *   motion    how it moves on its own: animations, transitions, entrances,
 *             and the motion features it carries (blink, spin, float…)
 *
 * Nothing here touches a part's place, size, words, picture, link, page or
 * name. Pure: no store, no DOM. `lookOf` reads a part's look; `lookPatch`
 * turns a look into the change one part takes; `lookDiffers` says which
 * facets would change anything. The store's `patchNodes` applies the
 * patches for many parts as one undo step (`pasteLook`, partLookApply.ts).
 */
import type { StudioNode } from "./store";
import { getWork, usesOf, type WorkUse } from "./library/works";

export const FACETS = ["fill", "outline", "shadow", "light", "corners", "font", "hover", "motion"] as const;
export type Facet = (typeof FACETS)[number];

/** Each facet in plain words, for the keys that choose them. */
export const FACET_WORDS: Record<Facet, string> = {
  fill: "Fill",
  outline: "Outline",
  shadow: "Shadow",
  light: "Light",
  corners: "Corners",
  font: "Font",
  hover: "Hover and press",
  motion: "Motion",
};

type N = Partial<StudioNode> & Record<string, unknown>;
type Rec = Record<string, unknown>;

/** The art keys each facet owns; the rest of `art` (a turn, a clip, a mask) is the part's shape and stays. */
const ART: Partial<Record<Facet, readonly string[]>> = {
  fill: ["blend", "filter", "backdrop"],
  light: ["background", "backgroundOptions", "backgroundClip"],
  font: ["textShadow", "textStroke", "paintOrder"],
  motion: ["animation"],
};
/** The worn shape's keys each facet owns; its outline (`pts`, `smooth`, `snap`, `raw`) is its shape and stays. */
const WORN: Partial<Record<Facet, readonly string[]>> = {
  fill: ["kit", "fill"],
  light: ["bar"],
  hover: ["hover", "press"],
  motion: ["motion"],
};

/** A motion feature (blink, spin, float, reveal…), by the shelf category it sits in. */
const isMotionWork = (u: WorkUse) => getWork(u.id)?.manifest.category === "motion";

/**
 * A part's look: every field the eight facets own, as the part holds them.
 * A field the part leaves unset is recorded as null, so pasting it clears
 * what the target had (a part with no shadow makes the target lose its own).
 */
export interface PartLook {
  /** The part it was read from, by id and in words, for "Copied from …". */
  from: { id: string; name: string };
  facets: Partial<Record<Facet, Rec>>;
}

const pick = (o: Rec | null | undefined, keys: readonly string[]): Rec => {
  const out: Rec = {};
  for (const k of keys) out[k] = o && o[k] !== undefined ? o[k] : null;
  return out;
};

/** The look of one facet of a part. */
function facetOf(n: N, f: Facet): Rec {
  const edge = (n.edge ?? null) as Rec | null;
  const motion = (n.motion ?? null) as Rec | null;
  const out: Rec = {};
  switch (f) {
    case "fill":
      Object.assign(out, { colour: n.colour ?? null, hue: n.hue ?? null, texture: n.texture ?? null, opacity: n.opacity ?? null });
      break;
    case "outline":
      out.edge = edge ? pick(edge, ["width", "style", "colour"]) : null;
      break;
    case "shadow":
      Object.assign(out, { shadow: edge?.shadow ?? null, aura: n.aura ?? null, auraSize: n.auraSize ?? null, auraStyle: n.auraStyle ?? null });
      break;
    case "corners":
      Object.assign(out, { radius: n.radius ?? null, shape: n.shape ?? null });
      break;
    case "font":
      Object.assign(out, { font: n.font ?? null, text: n.text ?? null });
      break;
    case "hover":
      Object.assign(out, { hover: motion?.hover ?? null, active: motion?.active ?? null, focus: motion?.focus ?? null });
      break;
    case "motion":
      Object.assign(out, {
        animation: motion?.animation ?? null, transition: motion?.transition ?? null, letter: motion?.letter ?? null,
        anim: n.anim ?? null, animSpeed: n.animSpeed ?? null, animDelay: n.animDelay ?? null, animEase: n.animEase ?? null,
        works: usesOf(n.work as WorkUse | null).filter(isMotionWork),
      });
      break;
    case "light":
      break;
  }
  const art = ART[f];
  if (art) out.art = pick(n.art as Rec | null, art);
  const worn = WORN[f];
  if (worn && n.worn) out.worn = pick(n.worn as unknown as Rec, worn);
  return out;
}

/** The part in words, for "Copied from …": its words, else its kind. */
const nameOf = (n: N) => {
  const w = typeof n.content === "string" ? n.content : Array.isArray(n.content) ? (n.content as { text?: string }[]).map((r) => r.text ?? "").join("") : "";
  const t = w.replace(/\s+/g, " ").trim();
  return t ? (t.length > 28 ? `${t.slice(0, 27)}…` : t) : String(n.label ?? "part");
};

export function lookOf(n: N, facets: readonly Facet[] = FACETS): PartLook {
  return { from: { id: String(n.id ?? ""), name: nameOf(n) }, facets: Object.fromEntries(facets.map((f) => [f, facetOf(n, f)])) };
}

/** A sub-record with some keys set and the rest left as they were; a key set to null is taken out. Empty, it is null. */
function merge(was: unknown, set: Rec): Rec | null {
  const out: Rec = { ...((was && typeof was === "object" ? was : {}) as Rec) };
  for (const [k, v] of Object.entries(set)) if (v === null || v === undefined) delete out[k]; else out[k] = v;
  return Object.keys(out).length ? out : null;
}

/**
 * The change `target` takes to wear `look`'s chosen facets. What the facets
 * do not own is left exactly as it was: its place, words, picture, link, its
 * other features, the rest of its edge, art and motion.
 */
export function lookPatch(target: N, look: PartLook, chosen: readonly Facet[]): Partial<StudioNode> {
  const p: Rec = {};
  let edge: Rec | null | undefined = (target.edge ?? null) as Rec | null;
  let art: Rec | null | undefined = (target.art ?? null) as Rec | null;
  let motion: Rec | null | undefined = (target.motion ?? null) as Rec | null;
  let worn: Rec | null | undefined = (target.worn ?? null) as Rec | null;
  let work: WorkUse[] | null = null;
  const touched = new Set<string>();
  for (const f of chosen) {
    const v = look.facets[f];
    if (!v) continue;
    switch (f) {
      case "fill": Object.assign(p, { colour: v.colour, hue: v.hue, texture: v.texture, opacity: v.opacity }); break;
      case "outline": edge = merge(edge, (v.edge as Rec | null) ?? { width: null, style: null, colour: null }); touched.add("edge"); break;
      case "shadow": edge = merge(edge, { shadow: v.shadow }); touched.add("edge"); Object.assign(p, { aura: v.aura, auraSize: v.auraSize ?? 1, auraStyle: v.auraStyle ?? "glow" }); break;
      case "corners": Object.assign(p, { radius: v.radius, shape: v.shape }); break;
      case "font": Object.assign(p, { font: v.font, text: v.text }); break;
      case "hover": motion = merge(motion, { hover: v.hover, active: v.active, focus: v.focus }); touched.add("motion"); break;
      case "motion": {
        motion = merge(motion, { animation: v.animation, transition: v.transition, letter: v.letter }); touched.add("motion");
        Object.assign(p, { anim: v.anim, animSpeed: v.animSpeed ?? 1, animDelay: v.animDelay ?? 0, animEase: v.animEase ?? "smooth" });
        /* The motion features it carries take the place of the target's own; its other features (a copy, a link, live data) stay. */
        const keep = usesOf(target.work as WorkUse | null).filter((u) => !isMotionWork(u));
        work = [...keep, ...((v.works as WorkUse[] | undefined) ?? [])];
        break;
      }
      case "light": break;
    }
    if (v.art) { art = merge(art, v.art as Rec); touched.add("art"); }
    /* A worn shape's kit only dresses a worn shape: its outline is the target's own. */
    if (v.worn && target.worn) { worn = merge(worn, v.worn as Rec); touched.add("worn"); }
  }
  if (touched.has("edge")) p.edge = edge;
  if (touched.has("art")) p.art = art;
  if (touched.has("motion")) p.motion = motion;
  if (touched.has("worn")) p.worn = worn;
  if (work) p.work = (work as WorkUse[]).length ? { ...(work as WorkUse[])[0]!, also: (work as WorkUse[]).slice(1) } : null;
  for (const [k, v] of Object.entries(p)) if (v === undefined) p[k] = null;
  return p as Partial<StudioNode>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The facets whose paste would change anything on `target`. */
export function lookDiffers(target: N, look: PartLook, chosen: readonly Facet[] = FACETS): Facet[] {
  return chosen.filter((f) => {
    const patch = lookPatch(target, look, [f]) as Rec;
    return Object.entries(patch).some(([k, v]) => !same((target as Rec)[k], v));
  });
}

/** The facets a look actually says something about (not every field empty). */
export function lookHas(look: PartLook): Facet[] {
  const filled = (v: unknown): boolean => v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.values(v as Rec).some(filled));
  return FACETS.filter((f) => filled(look.facets[f]));
}
