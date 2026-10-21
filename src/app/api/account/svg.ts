/**
 * AN SVG PICTURE, CLEANED BEFORE IT IS KEPT.
 *
 * An SVG is a document, not pixels: it can carry scripts, event handlers,
 * links that run code and references that fetch from elsewhere. The account
 * keeps one only after DOMPurify (its SVG profile, an allowlist of elements
 * and attributes) has been through it on a server DOM, plus the few rules
 * below that the profile leaves to the caller. What is kept is the drawing;
 * what is not drawing is gone, and the file is served with a policy that
 * stops it running code even if opened directly (`data/route.ts`).
 *
 * No framework imports: `tests/account-svg.mjs` drives it directly.
 */
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

/** The largest SVG kept. Bigger ones are refused, not trimmed. */
export const SVG_MAX = 1024 * 1024;

export type Cleaned = { ok: true; text: string } | { ok: false; says: string };

const NOT_SVG = "That does not read as an SVG picture, so it was not kept.";
const TOO_BIG = "That SVG is over 1 MB. Save it as a PNG or simplify it.";

/** Moving or scripted parts of a picture, and the one element that embeds a whole web page. */
const FORBID_TAGS = ["script", "foreignObject", "handler", "listener", "animate", "set", "animateMotion", "animateTransform", "animateColor", "iframe", "embed", "object", "audio", "video"];
/** In a stylesheet or style attribute: anything that fetches (`url(` to anywhere but a `#id` in this file, `@import`), or runs (`expression(`, `javascript:`). */
const BAD_CSS = /@import|expression\s*\(|javascript:|url\(\s*(?!['"]?\s*#)/i;

let purify: ReturnType<typeof createDOMPurify> | null = null;
function cleaner() {
  if (purify) return purify;
  const p = createDOMPurify(new JSDOM("").window as unknown as Window & typeof globalThis);
  p.addHook("afterSanitizeAttributes", (node) => {
    /* A link or reference may only point at something inside this same picture: `#id`. */
    for (const name of ["href", "xlink:href"]) {
      const v = node.getAttribute?.(name);
      if (v !== null && v !== undefined && !/^\s*#/.test(v)) node.removeAttribute(name);
    }
    const style = node.getAttribute?.("style");
    if (style && BAD_CSS.test(style)) node.removeAttribute("style");
    /* Paint servers and clipping reference by attribute, too (`fill="url(…)"`). */
    for (const a of Array.from(node.attributes ?? [])) {
      if (/url\(/i.test(a.value) && BAD_CSS.test(a.value)) node.removeAttribute(a.name);
    }
    if (node.nodeName.toLowerCase() === "style" && BAD_CSS.test(node.textContent ?? "")) node.parentNode?.removeChild(node);
  });
  purify = p;
  return p;
}

/** The picture without anything that is not drawing, or why it cannot be kept. */
export function cleanSvg(bytes: Uint8Array): Cleaned {
  if (bytes.byteLength > SVG_MAX) return { ok: false, says: TOO_BIG };
  let raw: string;
  try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return { ok: false, says: NOT_SVG }; }
  /* Strictly XML first: a file that is not well-formed SVG is refused rather than guessed at. */
  const probe = new JSDOM("").window;
  const doc = new probe.DOMParser().parseFromString(raw, "image/svg+xml");
  const root = doc.documentElement;
  if (doc.getElementsByTagName("parsererror").length || !root || root.localName !== "svg" || root.namespaceURI !== "http://www.w3.org/2000/svg") return { ok: false, says: NOT_SVG };
  const text = cleaner().sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    PARSER_MEDIA_TYPE: "image/svg+xml",
    FORBID_TAGS,
    FORBID_ATTR: ["srcset", "ping", "target"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
  if (typeof text !== "string" || !/<svg[\s>]/i.test(text)) return { ok: false, says: NOT_SVG };
  return { ok: true, text };
}
