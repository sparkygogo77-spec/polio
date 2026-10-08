/**
 * A STYLE KIT AS A PART'S LOOK.
 *
 * A kit (styleKits.ts) is how a site dresses its buttons, cards, panels and
 * badges, read off the parts that wear it: a fill, an edge, shadows, a light
 * band, corners, type, and how it answers the pointer and a press. Until now
 * only a newly drawn shape could wear one. Read as a `PartLook` (partLook.ts)
 * it dresses any part, through the same paste every other look goes through:
 * tried on by pointing (tryLook.ts), put on by a click, and worn by a part
 * remixed onto another site (remix).
 *
 * Pure. Lengths in px; colours as the kit holds them (the browser's own).
 */
import type { PartLook } from "./partLook";
import type { KitBand, KitShadow, KitState, StyleKit } from "./styleKits";

const shadowCss = (s: KitShadow) => `${s.dx}px ${s.dy}px ${s.hard ? 0 : s.blur}px ${s.spread}px ${s.colour}`;

/** A colour at an opacity, for a light band laid over the fill. */
function faded(colour: string, opacity: number): string {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i.exec(colour.trim());
  if (!m) return colour;
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Math.round(a * opacity * 1000) / 1000})`;
}

/** The light band as CSS: an inset band is an inset shadow; a gloss is a fading strip laid over the fill. */
function bandCss(b: KitBand): { shadow?: string; layer?: string } {
  if (b.kind === "gloss") {
    const share = Math.round(Math.max(0.05, Math.min(1, b.share ?? 0.5)) * 100);
    return { layer: `linear-gradient(${Math.round(b.angle)}deg, ${faded(b.colour, b.opacity)} 0%, transparent ${share}%)` };
  }
  return { shadow: `inset ${b.dx}px ${b.dy}px ${b.blur}px ${b.size}px ${faded(b.colour, b.opacity)}` };
}

const stateCss = (s: KitState | null) => {
  if (!s) return null;
  const style: Record<string, string> = {};
  const t = [s.dx || s.dy ? `translate(${s.dx}px, ${s.dy}px)` : "", s.rotate ? `rotate(${s.rotate}deg)` : "", s.scale && s.scale !== 1 ? `scale(${s.scale})` : ""].filter(Boolean).join(" ");
  if (t) style.transform = t;
  if (s.shadows?.length) style["box-shadow"] = s.shadows.map(shadowCss).join(", ");
  return Object.keys(style).length ? [{ self: true, style }] : null;
};

/**
 * The look a kit gives a part. `button`: the part draws a pressable (its
 * fill is its accent as well as its ground, as the converter writes a
 * captured button's).
 */
export function lookOfKit(kit: StyleKit, opts: { button?: boolean } = {}): PartLook {
  const fill = kit.fill;
  const base = fill.kind === "none" ? null : fill.colour;
  const gradient = fill.kind === "linear" && fill.stops?.length
    ? `linear-gradient(${Math.round(fill.angle ?? 180)}deg, ${fill.stops.map((s) => `${s.colour}${s.at === null ? "" : ` ${Math.round(s.at * 100)}%`}`).join(", ")})`
    : fill.kind === "radial" && fill.stops?.length
      ? `radial-gradient(circle at ${Math.round((fill.at?.[0] ?? 0.5) * 100)}% ${Math.round((fill.at?.[1] ?? 0.5) * 100)}%, ${fill.stops.map((s) => `${s.colour}${s.at === null ? "" : ` ${Math.round(s.at * 100)}%`}`).join(", ")})`
      : null;
  const band = kit.bar ? bandCss(kit.bar) : {};
  const colour: Record<string, string> = {};
  if (base) { colour.bg = base; if (opts.button) colour.accent = base; else colour.surface = base; }
  if (kit.text?.colour) colour.text = kit.text.colour;
  const shadows = [...kit.shadows.map(shadowCss), ...(band.shadow ? [band.shadow] : [])];
  const layers = [band.layer, gradient].filter(Boolean) as string[];
  const t = kit.text;
  const transition = kit.hover || kit.press ? [{ property: "transform", duration: "0.15s", timing: "ease" }, { property: "box-shadow", duration: "0.15s", timing: "ease" }] : null;
  return {
    from: { id: `kit:${kit.id}`, name: kit.name },
    facets: {
      fill: { colour: Object.keys(colour).length ? colour : null, hue: null, texture: null, opacity: null, art: { blend: null, filter: null, backdrop: null } },
      outline: { edge: kit.border && kit.border.width > 0 ? { width: kit.border.width, style: kit.border.style || "solid", colour: kit.border.colour } : { width: 0, style: "none", colour: null } },
      shadow: { shadow: shadows.length ? shadows.join(", ") : null, aura: null, auraSize: 1, auraStyle: "glow" },
      light: { art: { background: layers.length ? layers.join(", ") : null, backgroundOptions: null, backgroundClip: null } },
      corners: { radius: Math.round(kit.radius), shape: null },
      /* A kit names a face and a weight, not a size: merged into the part's own font, which keeps its size. */
      font: t ? {
        font: { ...(t.face ? { face: t.face } : {}), ...(t.stack ? { stack: t.stack } : {}), ...(t.weight ? { weight: t.weight } : {}) },
        fontMerge: true,
        text: t.transform && t.transform !== "none" ? { transform: t.transform } : null,
        art: { textShadow: t.shadow ?? null, textStroke: t.stroke ? { w: t.stroke.w, color: t.stroke.colour } : null, paintOrder: null },
      } : undefined,
      /* With its own easing into and out of them; the part's own animations are not the kit's to change. */
      hover: { hover: stateCss(kit.hover), active: stateCss(kit.press), focus: null, ...(transition ? { transition } : {}) },
    },
  };
}
