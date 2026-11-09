/**
 * WHAT THE HEADLESS BROWSER READS OFF A REFERENCE PAGE.
 *
 * The page's elements as the parts `layout/read.ts` and `paletteFrom.ts`
 * already read for a captured site: a box, what it wears, and what it is. So
 * a page fetched on demand is summed up by the same rules as a site captured
 * in full, without the capture's workflow run (minutes, and a GitHub token).
 *
 * A string, not a function: it runs in the page, and a built route's helpers
 * do not exist there. Colours come back as `rgb(…)` whatever the page wrote
 * them in (`color(srgb …)`, `lab(…)`), because that is what `parseColor` reads;
 * one mostly see-through is left out, as it does not say what the page shows.
 *
 * Words are counted and never returned: the only text that leaves the page is
 * its title, which is J's to read and is never sent to Claude.
 */
const MAX_PARTS = 900;

export const READ_PAGE = `(() => {
  const MAX = ${MAX_PARTS};
  const cx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (v) => {
    if (!v || v === "transparent") return null;
    const m = /^rgba?\\(([^)]+)\\)$/.exec(v);
    if (m) {
      const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);
      if (p.length > 3 && p[3] < 0.5) return null;
      return "rgb(" + Math.round(p[0]) + ", " + Math.round(p[1]) + ", " + Math.round(p[2]) + ")";
    }
    if (!cx) return null;
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = v;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return d[3] < 128 ? null : "rgb(" + d[0] + ", " + d[1] + ", " + d[2] + ")";
  };
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK", "BR"]);
  const SEMANTIC = new Set(["HEADER", "NAV", "MAIN", "SECTION", "FOOTER", "ARTICLE", "ASIDE", "FORM"]);
  const PICTURE = new Set(["IMG", "PICTURE", "VIDEO", "CANVAS", "svg", "IFRAME"]);
  const FIELD = new Set(["INPUT", "SELECT", "TEXTAREA"]);
  const width = innerWidth;
  const height = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0, innerHeight);
  const parts = [];
  let capped = false;
  const walk = (el) => {
    if (parts.length >= MAX) { capped = true; return; }
    if (SKIP.has(el.tagName)) return;
    const s = getComputedStyle(el);
    if (s.display === "none") return;
    const tag = el.tagName;
    const r = el.getBoundingClientRect();
    const seen = s.visibility !== "hidden" && Number(s.opacity) > 0.01 && r.width >= 2 && r.height >= 2 && r.right > 0 && r.left < width;
    if (seen) {
      let chars = 0;
      for (const n of el.childNodes) if (n.nodeType === 3) chars += n.textContent.trim().length;
      const bg = rgb(s.backgroundColor);
      const pic = PICTURE.has(tag) || s.backgroundImage !== "none";
      const edgeW = parseFloat(s.borderTopWidth) || 0;
      const edge = edgeW > 0 && s.borderTopStyle !== "none" ? rgb(s.borderTopColor) : null;
      /* A wide plain box too: most pages cut their bands with nothing but wrappers, and bands are read off them. */
      if (chars || bg || pic || edge || SEMANTIC.has(tag) || FIELD.has(tag) || tag === "A" || tag === "BUTTON" || (r.width >= width * 0.5 && r.height >= 40)) {
        const heading = /^H[1-6]$/.test(tag);
        const press = tag === "BUTTON" || el.getAttribute("role") === "button" || (tag === "INPUT" && /^(submit|button)$/i.test(el.type || "")) || (tag === "A" && !!(bg || edge));
        const role = heading ? "heading" : press ? "button" : tag === "A" ? "link" : pic ? "picture" : FIELD.has(tag) ? "field" : chars ? "text" : "box";
        const x = Math.max(0, r.left + scrollX);
        const part = { id: "r" + parts.length, tag: tag.toLowerCase(), role, x: Math.round(x), y: Math.round(r.top + scrollY), w: Math.round(Math.min(r.right + scrollX, width) - x), h: Math.round(r.height), colour: {}, from: { position: s.position }, chars };
        if (bg) part.colour.bg = bg;
        if (chars) {
          const c = rgb(s.color);
          if (c) part.colour.text = c;
          part.font = { face: (s.fontFamily.split(",")[0] || "").replace(/["']/g, "").trim().slice(0, 60), size: Math.round(parseFloat(s.fontSize) || 0), weight: Number(s.fontWeight) || 400 };
        }
        if (edge) part.edge = { width: edgeW, style: s.borderTopStyle, colour: edge };
        parts.push(part);
      }
    }
    if (PICTURE.has(tag)) return;
    for (const k of el.children) walk(k);
  };
  if (document.body) for (const k of document.body.children) walk(k);
  const paint = (el) => (el ? rgb(getComputedStyle(el).backgroundColor) : null);
  const wide = parts.find((p) => p.colour.bg && p.w >= width * 0.9 && p.h >= height * 0.5);
  return {
    title: (document.title || "").trim().slice(0, 200),
    width,
    height,
    parts,
    capped,
    captured: {
      bg: paint(document.body) || paint(document.documentElement) || (wide ? wide.colour.bg : null) || "rgb(255, 255, 255)",
      text: document.body ? rgb(getComputedStyle(document.body).color) : null,
    },
    signIn: !!document.querySelector("input[type=password]"),
  };
})()`;

/** Down the page and back, so pictures that load on scroll are there for the photograph. Bounded by the steps. */
export const WAKE_PAGE = `(async () => {
  const step = Math.max(400, innerHeight);
  const end = Math.min(document.documentElement.scrollHeight, 12000);
  for (let y = 0; y < end; y += step) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, 0);
})()`;
