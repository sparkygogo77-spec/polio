/**
 * WHICH EFFECTS FIT WHICH KIND OF PART: what the part panel offers when a
 * part is clicked.
 *
 * THE OWNER'S WORDS: everything that can be used universally must be
 * organised into the side panel when he clicks on things. So a picture is
 * offered the picture filters, a button the hover and press effects and the
 * button looks the sites taught, a section the background motions, and
 * every part the openings. Each is a library feature (`works.ts`, `effects.ts`)
 * with its own settings, so what the panel shows is what is published.
 *
 * Also here: a learned button look (a style kit, `styleKits.ts`) put on a
 * part that already exists, as the part's own colours, border, shadow,
 * corners, and its hover and press as features.
 *
 * Pure: no store, no React.
 */
import type { StyleKit, KitFill, KitShadow } from "../look/index.ts";

/** The kinds of part, as the part panel names them, grouped by what fits them. */
export type EffectFamily = "picture" | "button" | "section" | "any";

export interface OfferedEffect {
  /** The library feature it is. */
  work: string;
  /** Why it is offered here, in a few plain words. */
  why: string;
  family: EffectFamily;
}

const PICTURE: OfferedEffect[] = [
  { work: "screen-filter", why: "a filter over the picture", family: "picture" },
];
const BUTTON: OfferedEffect[] = [
  { work: "hover-lift", why: "under the pointer", family: "button" },
  { work: "press-push", why: "while it is pressed", family: "button" },
  { work: "tilt", why: "leans toward the pointer", family: "button" },
];
const SECTION: OfferedEffect[] = [
  { work: "follow-pointer", why: "moves with the pointer", family: "section" },
  { work: "tilt", why: "parallax with the pointer or the scroll", family: "section" },
  { work: "dust-canvas", why: "a moving background", family: "section" },
  { work: "screen-filter", why: "the whole part as if on a screen", family: "section" },
];
const ANY: OfferedEffect[] = [
  { work: "switch-on", why: "opens like a television", family: "any" },
  { work: "reveal", why: "shows as it scrolls in", family: "any" },
];

/** The part kinds (`kindWord`) that are a picture, a control, or a large holder; a shelf part's own name ("Main button") counts by its words. */
const PICTURE_KINDS = /^(picture|video|drawing|embedded page)$|picture|image|gallery|video/i;
const BUTTON_KINDS = /^(button|link|menu|field)$|button|link/i;
const SECTION_KINDS = /^(section|header|footer|page body|form|list)$|section|hero|banner|first screen/i;

/** What a part of this kind is, for the effects that fit it. A box that holds a picture is a picture; a big box is a section. */
export function familyOf(kind: string, part?: { w?: number; h?: number; picture?: unknown; holdsPicture?: boolean; feature?: string | null } | null): Exclude<EffectFamily, "any"> | null {
  /* A shelf part with words on it reads as "Words"; what it was made as ("Main button") still says what it is. */
  const made = part?.feature && part.feature !== "Box" ? part.feature : "";
  if (PICTURE_KINDS.test(kind) || part?.picture || (made && PICTURE_KINDS.test(made))) return "picture";
  if (BUTTON_KINDS.test(kind) || (made && BUTTON_KINDS.test(made))) return "button";
  if (SECTION_KINDS.test(kind) || (made && SECTION_KINDS.test(made))) return "section";
  if (part?.holdsPicture) return "picture";
  if ((part?.w ?? 0) >= 600 && (part?.h ?? 0) >= 240) return "section";
  return null;
}

/** The effects the panel offers a part, the ones that fit its kind first, then those that fit anything; one of each. */
export function effectsFor(kind: string, part?: Parameters<typeof familyOf>[1]): OfferedEffect[] {
  const fam = familyOf(kind, part);
  const mine = fam === "picture" ? PICTURE : fam === "button" ? BUTTON : fam === "section" ? SECTION : [];
  const seen = new Set<string>();
  return [...mine, ...ANY].filter((e) => (seen.has(e.work) ? false : (seen.add(e.work), true)));
}

/* ------------------------------------------------------------------ a button look on a part that exists */
const shadowCss = (s: readonly KitShadow[] | null | undefined): string | undefined => (s?.length ? s.map((x) => `${x.dx}px ${x.dy}px ${x.blur}px ${x.spread}px ${x.colour}`).join(", ") : undefined);

function fillCss(f: KitFill): { bg?: string; background?: string } {
  if (f.kind === "none") return {};
  if (f.kind === "solid" || !f.stops?.length) return { bg: f.colour };
  const stops = f.stops.map((s) => (s.at == null ? s.colour : `${s.colour} ${Math.round(s.at * 100)}%`)).join(", ");
  if (f.kind === "radial") { const [x, y] = f.at ?? [0.5, 0.5]; return { bg: f.colour, background: `radial-gradient(circle at ${Math.round(x * 100)}% ${Math.round(y * 100)}%, ${stops})` }; }
  return { bg: f.colour, background: `linear-gradient(${f.angle ?? 180}deg, ${stops})` };
}

export interface KitPatch {
  colour: { bg?: string; fg?: string };
  art: { background?: string };
  edge: { width?: number; style?: "solid" | "none"; colour?: string; shadow?: string } | null;
  radius: number;
  /** Its hover and press, as the library features that do them, with the kit's own distances. */
  works: { id: string; inputs: Record<string, string> }[];
}

/** What a part is given to wear a learned button look: its fill, words colour, border, shadow, corners, and its hover and press. */
export function kitPatch(kit: StyleKit): KitPatch {
  const fill = fillCss(kit.fill);
  const works: KitPatch["works"] = [];
  const h = kit.hover;
  if (h && (h.dy || h.dx || h.scale !== 1 || h.rotate)) works.push({ id: "hover-lift", inputs: { lift: String(Math.round(-h.dy * 10) / 10), x: String(h.dx), scale: String(h.scale), turn: String(h.rotate) } });
  const p = kit.press;
  if (p && (p.dy || p.dx || p.scale !== 1 || p.shadows)) works.push({ id: "press-push", inputs: { down: String(p.dy), x: String(p.dx), scale: String(p.scale), shadow: p.shadows ? shadowCss(p.shadows) ?? "none" : "" } });
  const shadow = shadowCss(kit.shadows);
  return {
    colour: { ...(fill.bg ? { bg: fill.bg } : {}), ...(kit.text?.colour ? { fg: kit.text.colour } : {}) },
    art: fill.background ? { background: fill.background } : {},
    edge: kit.border || shadow ? { ...(kit.border ? { width: kit.border.width, style: "solid" as const, colour: kit.border.colour } : {}), ...(shadow ? { shadow } : {}) } : null,
    radius: Math.round(kit.radius),
    works,
  };
}
