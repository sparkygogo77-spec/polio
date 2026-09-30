/**
 * WHAT A CAPTURED SITE ALREADY SAYS ABOUT ITS OWN FORMAT.
 *
 * The Format panel's values are a generator's defaults: theme dark, accent
 * hue 265°, heading font geometric sans, corners 10px, stack "extend this
 * template (Next.js + Tailwind)". For a site made here those are a starting
 * point. For a site brought in they are wrong on sight: trumpmorty.fun is
 * yellow, set in Luckiest Guy, with rounded cards, and the panel said dark,
 * violet, geometric and square.
 *
 * So on a captured site each value is one of three things:
 *
 *   read     the site says it, and this reads it off the parts: the page's
 *            colour gives light or dark, the colour worn most that is a
 *            colour gives the accent's hue, the face on the biggest words is
 *            the heading font and the face on most of the rest the body's,
 *            the corners most boxes have are the corner radius, and the size
 *            most words are set at is the base size;
 *   hidden   the site cannot say it, and it does nothing to a captured site:
 *            every captured part carries its own measured borders, shadows,
 *            spacing and type, so a type scale or a shadow style chosen here
 *            moves nothing, and "the stack" of a site copied whole is the
 *            static page this app publishes;
 *   as is    everything else (what the site is for, its pages, how it
 *            feels), which the owner decides either way.
 *
 * A value the owner changed is theirs and wins over the reading. The Format
 * panel, Settings > This site and the blueprint all ask this one function,
 * so none of the three can say something the others do not.
 *
 * Pure: no store, no DOM.
 */
import { parseColor } from "./look.ts";
import { chromatic, faceOf, tallyColours, type Worn } from "./siteColours.ts";

export interface Reading {
  /** The value the Format field would hold, where one of its own fits; else null. */
  value: string | number | null;
  /** What to show: the site's own word for it ("Luckiest Guy", "light", "12px"). */
  shows: string;
  /** How it was read, in a phrase ("the page's colour"). */
  from: string;
}

/** Fields that do nothing to a captured site and cannot be read off it. */
export const CAPTURE_HIDES: ReadonlySet<string> = new Set([
  "type.scale", "type.headingCase", "type.letterSpacing", "type.paragraphSpacing",
  "layout.width", "layout.density", "layout.grid", "layout.gap", "layout.borders", "layout.shadow", "layout.imagery",
  "palette.scheme", "palette.contrast",
  "build.stack",
]);

type Part = Worn & { from?: unknown; radius?: number | null; font?: (Worn["font"] & { leading?: number }) | null };

/** A document is a captured site when its parts were brought in from a page. */
export function isCaptured(doc: { nodes: readonly Part[]; look?: { paletteFrom?: unknown } | null }): boolean {
  return !!doc.look?.paletteFrom || doc.nodes.some((n) => !!n.from);
}

const hasWords = (n: Part) => (typeof n.content === "string" ? n.content.trim().length > 0 : Array.isArray(n.content) && n.content.length > 0);

/** The value most parts share, by count, with the count. */
function most<T>(xs: readonly T[]): { value: T; count: number } | null {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of m) if (!best || count > best.count) best = { value, count };
  return best;
}

/** The Format panel's families, matched to a face by the shape of its name. */
function familyOf(face: string, heading: boolean): string | null {
  const f = face.toLowerCase();
  if (/mono|code|courier|consol/.test(f)) return "monospace";
  if (/serif/.test(f) && !/sans/.test(f)) return "serif";
  if (/hand|script|marker|brush|caveat|pacifico/.test(f)) return heading ? "handwritten" : null;
  if (/condensed|narrow|oswald|bebas|anton/.test(f)) return heading ? "condensed" : null;
  return null;
}

/**
 * Every Format value the captured site says, keyed by the field's id.
 * Empty for a site made here.
 */
export function readSiteFormat(doc: { nodes: readonly Part[]; look?: { paletteFrom?: unknown } | null }, pageColour: string | null | undefined): Record<string, Reading> {
  if (!isCaptured(doc)) return {};
  const out: Record<string, Reading> = {};
  const nodes = doc.nodes;

  const page = parseColor(pageColour ?? "");
  if (page) {
    const mode = page.l >= 0.6 ? "light" : "dark";
    out["palette.mode"] = { value: mode, shows: mode, from: "the page's colour" };
  }

  const accents = tallyColours(nodes).byUse.accent.filter((c) => chromatic(c.value));
  const top = accents[0] ? parseColor(accents[0].value) : null;
  if (top) {
    const h = Math.round(top.h) % 360;
    out["palette.accentHue"] = { value: h, shows: `${h}°`, from: `the colour worn most (${accents[0]!.parts} part${accents[0]!.parts === 1 ? "" : "s"})` };
  }

  const worded = nodes.filter((n) => hasWords(n) && faceOf(n));
  const sized = worded.filter((n) => typeof n.font?.size === "number");
  if (sized.length) {
    const biggest = Math.max(...sized.map((n) => n.font!.size!));
    const heads = sized.filter((n) => n.font!.size! >= Math.max(24, biggest * 0.6));
    const head = most((heads.length ? heads : sized).map((n) => faceOf(n)));
    if (head) out["type.headingFamily"] = { value: familyOf(head.value, true), shows: head.value, from: "the face on the biggest words" };
    const rest = sized.filter((n) => n.font!.size! < 24);
    const body = most((rest.length ? rest : worded).map((n) => faceOf(n)));
    if (body) out["type.bodyFamily"] = { value: familyOf(body.value, false), shows: body.value, from: "the face on most of the words" };
    const size = most(rest.map((n) => Math.round(n.font!.size!)));
    if (size) out["type.baseSize"] = { value: size.value, shows: `${size.value}px`, from: "the size most words are set at" };
  } else {
    const face = most(worded.map((n) => faceOf(n)));
    if (face) {
      out["type.headingFamily"] = { value: familyOf(face.value, true), shows: face.value, from: "the face the words are set in" };
      out["type.bodyFamily"] = { value: familyOf(face.value, false), shows: face.value, from: "the face the words are set in" };
    }
  }

  const radii = nodes.map((n) => (typeof n.radius === "number" ? Math.round(n.radius) : null)).filter((r): r is number => r !== null && r > 0 && r < 200);
  const round = most(radii);
  if (round) out["layout.radius"] = { value: Math.min(32, round.value), shows: `${round.value}px`, from: `the corners most rounded boxes have (${round.count})` };
  else if (nodes.some((n) => n.from)) out["layout.radius"] = { value: 0, shows: "square", from: "no box on the site has rounded corners" };

  return out;
}

/** What one Format field says for this document: the owner's value, the site's reading, or hidden. */
export function siteSays(
  id: string,
  captured: boolean,
  readings: Record<string, Reading>,
  format: Record<string, unknown>,
  dflt: unknown,
): { kind: "owner" } | { kind: "read"; reading: Reading } | { kind: "hidden" } | { kind: "plain" } {
  const changed = id in format && format[id] !== dflt;
  if (!captured) return { kind: "plain" };
  if (changed) return { kind: "owner" };
  if (readings[id]) return { kind: "read", reading: readings[id]! };
  if (CAPTURE_HIDES.has(id)) return { kind: "hidden" };
  return { kind: "plain" };
}
