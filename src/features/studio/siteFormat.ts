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
import { faceOf, type Worn } from "./siteColours.ts";
import { paintedPalette, type PaintedPart } from "./shelfTheme.ts";

export interface Reading {
  /** The value the Format field would hold, where one of its own fits; else null. */
  value: string | number | null;
  /** What to show: the site's own word for it ("Luckiest Guy", "light", "12px"). */
  shows: string;
  /** How it was read, in a phrase ("the page's colour"). */
  from: string;
  /** The colour itself, for a reading that is one. */
  colour?: string;
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

const wordsIn = (n: Part) => {
  const c = n.content;
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => (r && typeof r === "object" && "text" in r ? String((r as { text: unknown }).text) : "")).join(" ") : "";
  return Math.max(1, text.trim().split(/\s+/).length);
};

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
export function readSiteFormat(
  doc: { nodes: readonly Part[]; look?: { paletteFrom?: unknown } | null; format?: Record<string, unknown> | null },
  pageColour: string | null | undefined,
): Record<string, Reading> {
  if (!isCaptured(doc)) return {};
  const out: Record<string, Reading> = {};
  const nodes = doc.nodes;

  /* The colour behind most of the page, read off the parts that span it; the page's own fill only when none does. */
  const behind = pageColourOf(nodes, pageColour);
  const page = parseColor(behind?.colour ?? pageColour ?? "");
  if (page) {
    const mode = page.l >= 0.6 ? "light" : "dark";
    out["palette.mode"] = { value: mode, shows: mode, colour: behind?.colour ?? pageColour ?? undefined, from: behind ? "the colour behind most of the page" : "the page's colour" };
  }

  /* The accent the shelf draws with too: the coloured fill and words that cover most after the page. */
  const top = behind?.accent ? parseColor(behind.accent) : null;
  if (top && top.c >= 0.05) {
    const h = Math.round(top.h) % 360;
    out["palette.accentHue"] = { value: h, shows: `${h}°`, colour: behind!.accent, from: "the colour that covers most of the page after its background" };
  }

  const worded = nodes.filter((n) => hasWords(n) && faceOf(n));
  /*
   * A part's `font.size` is a multiple of the site's base size, never pixels
   * (`parts/theme.ts` draws it as base × size). Read as pixels, every
   * captured word was "1px" and none was ever big enough to be a heading.
   */
  const base = Number(doc.format?.["type.baseSize"]) > 0 ? Number(doc.format!["type.baseSize"]) : 16;
  const px = (n: Part) => base * n.font!.size!;
  const sized = worded.filter((n) => typeof n.font?.size === "number" && n.font.size > 0);
  if (sized.length) {
    const biggest = Math.max(...sized.map(px));
    const heads = sized.filter((n) => px(n) >= Math.max(24, biggest * 0.6));
    const head = most((heads.length ? heads : sized).map((n) => faceOf(n)));
    if (head) out["type.headingFamily"] = { value: familyOf(head.value, true), shows: head.value, from: "the face on the biggest words" };
    const rest = sized.filter((n) => px(n) < 24);
    /* By how much each face sets, not how many parts: forty one-word buttons are not the body text. */
    const body = most((rest.length ? rest : worded).flatMap((n) => Array(Math.min(400, wordsIn(n))).fill(faceOf(n)) as string[]));
    if (body) out["type.bodyFamily"] = { value: familyOf(body.value, false), shows: body.value, from: "the face on most of the words" };
    out["type.baseSize"] = { value: base, shows: `${base}px`, from: "every word on the site is sized from it" };
  } else {
    const face = most(worded.map((n) => faceOf(n)));
    if (face) {
      out["type.headingFamily"] = { value: familyOf(face.value, true), shows: face.value, from: "the face the words are set in" };
      out["type.bodyFamily"] = { value: familyOf(face.value, false), shows: face.value, from: "the face the words are set in" };
    }
  }

  const radii = nodes.map((n) => (typeof n.radius === "number" ? Math.round(n.radius) : null)).filter((r): r is number => r !== null && r > 0 && r < 200);
  const round = most(radii);
  if (round) out["layout.radius"] = { value: Math.min(32, round.value), shows: `${round.value}px`, from: `on most of its rounded boxes (${round.count})` };
  else if (nodes.some((n) => n.from)) out["layout.radius"] = { value: 0, shows: "square", from: "no box on the site has rounded corners" };

  return out;
}

/**
 * The colour behind most of the page, and the accent: what the page paints
 * most by area, asked of `paintedPalette` (shelfTheme.ts), the same function
 * the shelf draws its previews in, so Format's "This site" and the shelf can
 * never disagree about a site's colours. A captured page's own background is
 * often a colour no visitor sees (trumpmorty.fun's body is navy under yellow
 * sections). Read on the page with the most parts. Null when nothing is filled.
 */
export function pageColourOf(nodes: readonly Part[], declaredBg?: string | null): { colour: string; share: number; accent: string } | null {
  const placed = nodes as readonly (Part & { x?: number; y?: number; w?: number; h?: number; pageId?: string })[];
  const count = new Map<string, number>();
  for (const n of placed) count.set(n.pageId ?? "", (count.get(n.pageId ?? "") ?? 0) + 1);
  const page = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const parts = placed.filter((n) => (n.pageId ?? "") === page).map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 0, h: n.h ?? 0 })) as PaintedPart[];
  const painted = paintedPalette(parts, {}, declaredBg ?? null);
  return painted ? { colour: painted.bg, share: painted.fills[0]?.share ?? 0, accent: painted.accent } : null;
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
