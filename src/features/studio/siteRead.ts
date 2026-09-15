/**
 * What runs inside the page being read.
 *
 * Two functions, both serialised into the page by the element route and
 * run in its own context, so everything they hand back is the browser's
 * own answer: `getComputedStyle`'s string for a colour, its number for a
 * size, `getBoundingClientRect`'s box. Nothing here describes anything in
 * words for a model to read back — which library part a reading becomes is
 * decided from these numbers in `recreate.ts`.
 *
 * They live here rather than in the route so that they can be run against
 * any page by anything that has a browser: `tests/site-read.mjs` runs them
 * against a fixture served locally, which the route itself will rightly
 * not open, because the bounds allow public https pages only.
 *
 * Pure in the sense that matters: no imports, no closure over anything.
 * A function serialised into another browser context can carry nothing
 * with it, so every helper either lives inside it or is passed in.
 */

/** One thing on the page worth pointing at. */
export interface Candidate {
  selector: string;
  what: string;
  box: { x: number; y: number; w: number; h: number };
  words: string;
}

/**
 * What is worth pointing at, ranked.
 *
 * Not every element: a page has thousands and all but a few dozen are
 * wrappers. What comes back is what a person would name — something with
 * area, that holds words or pictures, and that is not merely the one box
 * inside another box saying the same thing.
 */
export const CANDIDATES = (cap: number): Candidate[] => {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const path = (el: Element): string => {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
    const bits: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && bits.length < 6) {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) { bits.unshift(tag); break; }
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      bits.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return `body > ${bits.join(" > ")}`;
  };
  const name = (el: Element, box: DOMRect): string => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    if (tag === "header" || role === "banner") return "the bar across the top";
    if (tag === "footer" || role === "contentinfo") return "the foot of the page";
    if (tag === "nav" || role === "navigation") return "the links";
    if (tag === "button" || role === "button") return "a button";
    if (box.top < 40 && box.width > innerWidth * 0.6) return "the top of the page";
    if (box.height > 320 && box.top < innerHeight) return "a first screen";
    if (box.width > innerWidth * 0.6) return "a band across the page";
    return "a box on the page";
  };
  const all = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  for (const el of all) {
    if (out.length >= cap) break;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "svg" || tag === "path" || tag === "br") continue;
    const box = el.getBoundingClientRect();
    if (box.width < 80 || box.height < 24) continue;
    if (box.width * box.height < 6_000) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    const words = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const pictures = el.querySelectorAll("img, picture, video, canvas").length;
    if (!words && !pictures) continue;
    /* One box inside another saying exactly the same thing is one thing to
       point at, not two. The outer one is kept: it is what a person means. */
    const key = `${Math.round(box.width)}x${Math.round(box.height)}:${words.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      selector: path(el),
      what: name(el, box),
      box: { x: Math.round(box.x + scrollX), y: Math.round(box.y + scrollY), w: Math.round(box.width), h: Math.round(box.height) },
      words: words.slice(0, 90),
    });
  }
  // Biggest first: a person points at the thing they can see.
  return out.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h).slice(0, 60);
};

/**
 * One element, measured.
 *
 * Everything here is a number or a string the browser itself reported.
 * Nothing is described, judged or summarised: which part it becomes is
 * decided on the client, off these.
 */
export const MEASURE = (selector: string) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const pageH = Math.max(document.body.scrollHeight, innerHeight);

  /* Every run of words, with the size it was really set at.
     Walked as text nodes rather than read off tags, because the biggest
     run is the headline whatever it was marked up as. */
  const text: { words: string; px: number; weight: number; y: number }[] = [];
  /* One line of the page is one run, whatever is marked up inside it: a
     heading with an `abbr` in it is three text nodes and one line, and it
     came out as "The Beauty of" / "CSS" / "Design". Runs are joined while
     they share the block they sit in and the size they are set at. */
  const blockOf = (e: Element): Element => {
    let node: Element | null = e;
    while (node && node !== el) {
      const d = getComputedStyle(node).display;
      if (d !== "inline" && d !== "contents") return node;
      node = node.parentElement;
    }
    return el;
  };
  let lastBlock: Element | null = null;
  let lastEndedInSpace = false;
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const raw = n.textContent ?? "";
    const words = raw.replace(/\s+/g, " ").trim();
    if (!words) { if (/\s/.test(raw)) lastEndedInSpace = true; continue; }
    const parent = n.parentElement;
    if (!parent) continue;
    const ps = getComputedStyle(parent);
    if (ps.display === "none" || ps.visibility === "hidden") continue;
    const px = Math.round(parseFloat(ps.fontSize) || 16);
    const weight = Number(ps.fontWeight) || 400;
    const block = blockOf(parent);
    const last = text[text.length - 1];
    if (last && block === lastBlock && last.words.length < 300) {
      // The size stays the line's own: an `abbr` set a shade smaller is still on the line.
      const glue = lastEndedInSpace || /^\s/.test(raw) ? " " : "";
      last.words = `${last.words}${glue}${words}`.replace(/\s+/g, " ").slice(0, 300);
      lastEndedInSpace = /\s$/.test(raw);
      continue;
    }
    lastEndedInSpace = /\s$/.test(raw);
    const pb = parent.getBoundingClientRect();
    text.push({
      words: words.slice(0, 300),
      px,
      weight,
      y: box.height ? Math.round(((pb.top - box.top) / box.height) * 100) / 100 : 0,
    });
    lastBlock = block;
    if (text.length >= 40) break;
  }

  const links = Array.from(el.querySelectorAll("a[href]")).slice(0, 30).map((a) => ({
    words: (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    href: (a as HTMLAnchorElement).href,
  })).filter((l) => l.words);

  const buttons = Array.from(el.querySelectorAll("button, [role='button'], input[type='submit']"))
    .slice(0, 10)
    .map((b) => ((b as HTMLInputElement).value || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40))
    .filter(Boolean);

  const images = Array.from(el.querySelectorAll("img")).slice(0, 8).map((im) => {
    const r = im.getBoundingClientRect();
    return { src: (im as HTMLImageElement).currentSrc || (im as HTMLImageElement).src, w: Math.round(r.width), h: Math.round(r.height), alt: (im as HTMLImageElement).alt || "" };
  }).filter((im) => im.src);
  // The element's own background picture counts as one of its pictures.
  const ground = /url\(/.test(style.backgroundImage) ? (style.backgroundImage.match(/url\(["']?([^"')]+)/) ?? [])[1] : undefined;
  if (ground) images.unshift({ src: new URL(ground, location.href).toString(), w: Math.round(box.width), h: Math.round(box.height), alt: "", ground: true } as never);

  const kids = Array.from(el.children).filter((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return r.width > 8 && r.height > 8 && cs.display !== "none";
  });
  const children = kids.slice(0, 24).map((c) => {
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left - box.left), y: Math.round(r.top - box.top), w: Math.round(r.width), h: Math.round(r.height) };
  });
  /* How the children run, read off where they actually are rather than off
     the display property: a grid made of floats is still a grid. */
  const tops = new Set(children.map((c) => Math.round(c.y / 8)));
  const rows = tops.size || 1;
  const columns = Math.max(1, Math.round(children.length / rows));
  const flow: "row" | "column" | "grid" = rows > 1 && columns > 1 ? "grid" : rows > 1 ? "column" : "row";
  const gap = children.length > 1 ? Math.max(0, Math.round(children[1]!.x - (children[0]!.x + children[0]!.w))) : 0;

  const border = Number(parseFloat(style.borderTopWidth)) > 0 ? style.borderTopColor : null;
  return {
    box: { x: Math.round(box.x + scrollX), y: Math.round(box.y + scrollY), w: Math.round(box.width), h: Math.round(box.height) },
    down: Math.round(((box.top + scrollY) / pageH) * 100) / 100,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    text,
    links,
    buttons,
    images,
    paint: {
      bg: style.backgroundColor,
      text: style.color,
      border,
      radius: Math.round(parseFloat(style.borderTopLeftRadius) || 0),
      shadow: style.boxShadow !== "none",
    },
    type: {
      family: style.fontFamily,
      px: Math.round(parseFloat(style.fontSize) || 16),
      weight: Number(style.fontWeight) || 400,
      spacing: style.letterSpacing === "normal" ? 0 : Math.round(((parseFloat(style.letterSpacing) || 0) / (parseFloat(style.fontSize) || 16)) * 1000) / 1000,
      leading: Math.round(parseFloat(style.lineHeight) || 0),
    },
    layout: { flow, columns, gap },
    children,
  };
};
