/**
 * WHAT A DRAWING'S OWN SHAPES PAINT UNDER.
 *
 * An inline svg comes in as one part drawing its markup (`node.svg.markup`),
 * and each plain shape in it the page hooked (a dial's face, a clock's rim)
 * as a part of its own, hidden in the markup so it is drawn once
 * (`siteread/parts.ts`). Those parts stood after the drawing, so they
 * painted over it: PonsStars' dial was a plain yellow disc over its ticks
 * and labels, its clock an empty ring over its hands. On the page a shape
 * paints under everything after it in the svg. A hidden shape with nothing
 * drawn before it in the markup goes under the drawing; the rest stay over
 * it (a hub over the hands). The ids of the parts to draw before their svg's
 * part, each with that part's id.
 */
const DRAWS = /^(circle|ellipse|rect|path|line|polyline|polygon|text|use|image)$/i;

interface SvgPart { id: string; from?: { selector?: string | null } | null; svg?: { markup?: unknown } | null }

/** Each element's path under the svg, as the importer wrote a part's selector (`circle:nth-of-type(1) > …`). */
function paths(svg: Element): Map<Element, string> {
  const out = new Map<Element, string>();
  const walk = (el: Element, at: string) => {
    const seen = new Map<string, number>();
    for (const c of Array.from(el.children)) {
      const tag = c.tagName.toLowerCase();
      const k = (seen.get(tag) ?? 0) + 1;
      seen.set(tag, k);
      const same = Array.from(el.children).filter((x) => x.tagName.toLowerCase() === tag).length;
      const step = same > 1 ? `${tag}:nth-of-type(${k})` : tag;
      const p = at ? `${at} > ${step}` : step;
      out.set(c, p);
      walk(c, p);
    }
  };
  walk(svg, "");
  return out;
}

export function svgUnder(parts: readonly SvgPart[]): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof DOMParser === "undefined") return out;
  const bySelector = new Map(parts.filter((p) => p.from?.selector).map((p) => [p.from!.selector!.trim(), p.id]));
  for (const p of parts) {
    const markup = p.svg?.markup;
    const sel = p.from?.selector?.trim();
    if (typeof markup !== "string" || !sel) continue;
    let svg: Element | null = null;
    try { svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement; } catch { continue; }
    if (!svg || svg.tagName.toLowerCase() !== "svg") continue;
    const at = paths(svg);
    let drawnBefore = false;
    for (const el of Array.from(svg.querySelectorAll("*"))) {
      if (!DRAWS.test(el.tagName)) continue;
      const hidden = el.getAttribute("visibility") === "hidden";
      if (!hidden) { drawnBefore = true; continue; }
      if (drawnBefore) continue;
      /* The importer writes `:nth-of-type(1)` on a first of several and nothing on an only one; either is accepted. */
      const rel = at.get(el);
      const id = rel ? bySelector.get(`${sel} > ${rel}`) ?? bySelector.get(`${sel} > ${rel.replace(/:nth-of-type\(1\)/g, "")}`) : undefined;
      if (id && id !== p.id) out.set(id, p.id);
    }
  }
  return out;
}
