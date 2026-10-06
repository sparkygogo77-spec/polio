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
  /* The box a thing takes up, which is not always its own: a section whose
     children are floated has a box that collapses to its heading while its
     paragraphs run on below, and read by its own box it was a thin band
     with four paragraphs loose under it. The box is grown to hold the
     children, and their children, that run out of it *and touch it*: a
     child that sits under the box's foot grows it, and the next one under
     that, so a section is measured where its words are; a child placed far
     from it does not, so a box whose lists are placed about the page is not
     grown to the page. Placed (absolute, fixed) children never count. */
  const spreadOf = (el: Element, own: DOMRect): DOMRect => {
    let x0 = own.left, y0 = own.top, x1 = own.right, y1 = own.bottom;
    let grew = false;
    const kids: DOMRect[] = [];
    for (const c of Array.from(el.children)) {
      for (const k of [c, ...Array.from(c.children)]) {
        const r = k.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const cs = getComputedStyle(k);
        if (cs.display === "none" || cs.position === "fixed" || cs.position === "absolute") continue;
        kids.push(r);
      }
    }
    const TOUCH = 24;
    let more = true;
    while (more) {
      more = false;
      for (const r of kids) {
        if (r.bottom <= y1 + 2 && r.top >= y0 - 2 && r.left >= x0 - 2 && r.right <= x1 + 2) continue;
        const touches = r.top <= y1 + TOUCH && r.bottom >= y0 - TOUCH && r.left <= x1 + TOUCH && r.right >= x0 - TOUCH;
        if (!touches) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
        grew = true; more = true;
      }
    }
    return grew ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : own;
  };
  const seen = new Set<string>();
  /*
   * A selector the element can be found again by. Walked all the way up
   * to the body, every step a child combinator: it was cut at six steps
   * and still prefixed `body >`, so anything seven deep, which is most of
   * a real page, gave a path that matched nothing and came back "not on
   * the page any more" when pressed. A page nested past forty is left as a
   * descendant of the body, which is still one element on any page seen.
   */
  const path = (el: Element): string => {
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
    const bits: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && bits.length < 40) {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) { bits.unshift(tag); break; }
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      bits.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return `body ${node === document.body ? ">" : ""} ${bits.join(" > ")}`.replace(/\s+/g, " ");
  };
  const name = (el: Element, box: DOMRect): string => {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    // A `header` is the bar across the top when it is the size of one; a
    // first screen marked up as a header, which a page builder does, is a
    // first screen, and the name should agree with what the reading makes it.
    if ((tag === "header" || role === "banner") && box.height <= 160) return "the bar across the top";
    if (tag === "footer" || role === "contentinfo") return "the foot of the page";
    if (tag === "nav" || role === "navigation") return "the links";
    if (tag === "button" || role === "button") return "a button";
    // A paragraph is a paragraph however tall or wide, and so is a heading:
    // a section of tall paragraphs is not a column of bands.
    if (tag === "p" || tag === "blockquote" || tag === "pre" || tag === "li" || tag === "dt" || tag === "dd") return "a paragraph";
    if (/^h[1-6]$/.test(tag)) return "a heading";
    if (box.top < 40 && box.width > innerWidth * 0.6) return "the top of the page";
    if (box.height > 320 && box.top < innerHeight) return "a first screen";
    if (box.width > innerWidth * 0.6) return "a band across the page";
    return "a box on the page";
  };
  /* The box a thing takes up, which is not always its own: a section whose
     children are floated or placed has a box that collapses to its heading
     while its paragraphs run on below, and read by its own box it was a
     thin band with four paragraphs loose under it. The spread is the box
     grown to hold its children and their children where they run out of
     it, so a section is measured where its words are. */
  const spread = (el: Element): DOMRect => spreadOf(el, el.getBoundingClientRect());
  const all = Array.from(document.querySelectorAll("body *")).slice(0, 4000);
  for (const el of all) {
    if (out.length >= cap) break;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "svg" || tag === "path" || tag === "br") continue;
    const box = spread(el);
    if (box.width < 80 || box.height < 24) continue;
    if (box.width * box.height < 6_000) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    /* The caption is the words with a space between one run and the
       next, not the text nodes run together: a row of links read
       "PlaywrightDocsMCPCLIAPI". The nodes are walked and joined. */
    const bits: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && bits.join(" ").length < 200; n = walker.nextNode()) {
      const w = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (w) bits.push(w);
    }
    const words = bits.join(" ").replace(/\s+/g, " ").trim();
    const pictures = el.querySelectorAll("img, picture, video, canvas, svg").length;
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
  // The box grown to hold children that run out of it and touch it, the same way `CANDIDATES` lists it.
  const own = el.getBoundingClientRect();
  const box = (() => {
    let x0 = own.left, y0 = own.top, x1 = own.right, y1 = own.bottom;
    const kids: DOMRect[] = [];
    for (const c of Array.from(el.children)) {
      for (const k of [c, ...Array.from(c.children)]) {
        const r = k.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const cs = getComputedStyle(k);
        if (cs.display === "none" || cs.position === "fixed" || cs.position === "absolute") continue;
        kids.push(r);
      }
    }
    const TOUCH = 24;
    let more = true;
    while (more) {
      more = false;
      for (const r of kids) {
        if (r.bottom <= y1 + 2 && r.top >= y0 - 2 && r.left >= x0 - 2 && r.right <= x1 + 2) continue;
        if (!(r.top <= y1 + TOUCH && r.bottom >= y0 - TOUCH && r.left <= x1 + TOUCH && r.right >= x0 - TOUCH)) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
        more = true;
      }
    }
    return new DOMRect(x0, y0, x1 - x0, y1 - y0);
  })();
  const spilled = Math.round(box.height) > Math.round(own.height) + 2 || Math.round(box.width) > Math.round(own.width) + 2;
  const style = getComputedStyle(el);
  /* How tall the page is: the document's own height, or the bottom of the
     lowest thing on it when the page scrolls an inner container and the
     body stays 900 tall, which put everything below the fold past the
     page's end. */
  let lowest = 0;
  for (const e of Array.from(document.querySelectorAll("body *")).slice(0, 4000)) {
    const r = e.getBoundingClientRect();
    if (r.width > 8 && r.height > 8) lowest = Math.max(lowest, r.bottom + scrollY);
  }
  const pageH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, innerHeight, lowest);

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
  /*
   * THE SPACE BEFORE A RUN, ASKED OF THE PAGE RATHER THAN OF THE READING.
   *
   * His header came back "A SolWorksproject" because the reader trimmed
   * every run's edges: three fragments, no spaces, and nothing left anywhere
   * to say where they belonged. The boxes butt, so no gap could be measured
   * either — only the page knew, and it was being thrown away here.
   *
   * Three rules, and they are the browser's, not ours:
   *
   *  - A space belongs to the run AFTER it, never to the one before, so it
   *    is written down exactly once. Two runs cannot each claim it and come
   *    back with a double space where the page had one.
   *  - It is only a space if the page RENDERS one there. Whitespace at the
   *    start of a line is collapsed away by CSS, so a headline indented in
   *    the markup — "\n  Everything arrives somewhere\n" — has no space in
   *    front of it and must not gain one.
   *  - The question is asked of the whole line the run sits in, not of the
   *    element being read. A fragment read on its own has no idea what is
   *    beside it, and being beside something is the entire point.
   */
  const lineCache = new Map<Element, Element>();
  /** The nearest thing that makes a line: the block this run is set in. */
  const lineOf = (e: Element): Element => {
    const had = lineCache.get(e);
    if (had) return had;
    let node: Element | null = e;
    while (node && node !== document.body) {
      const d = getComputedStyle(node).display;
      if (d !== "inline" && d !== "contents") break;
      node = node.parentElement;
    }
    const found = node ?? document.body;
    lineCache.set(e, found);
    return found;
  };
  /** Every run of text on one line, in the order it is read. */
  const lineText = new Map<Element, Text[]>();
  const runsOn = (b: Element): Text[] => {
    let list = lineText.get(b);
    if (list) return list;
    list = [];
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      const par = (t as Text).parentElement;
      /* A nested block is its own line, so its words are not on this one. */
      if (par && lineOf(par) === b) list.push(t as Text);
    }
    lineText.set(b, list);
    return list;
  };
  /** Does the page draw a space immediately before this run? */
  const spaceBefore = (n: Text): boolean => {
    const par = n.parentElement;
    if (!par) return false;
    const list = runsOn(lineOf(par));
    const i = list.indexOf(n);
    if (i < 0) return false;
    const own = /^\s/.test(n.textContent ?? "");
    /* Whatever the whitespace is, it draws only if words come before it. */
    let gap = own;
    for (let j = i - 1; j >= 0; j--) {
      const t = list[j]!.textContent ?? "";
      if (/\S/.test(t)) return gap || /\s$/.test(t);
      if (/\s/.test(t)) gap = true;
    }
    return false;
  };
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const raw = n.textContent ?? "";
    const words = raw.replace(/\s+/g, " ").trim();
    if (!words) continue;
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
      const glue = spaceBefore(n as Text) ? " " : "";
      last.words = `${last.words}${glue}${words}`.replace(/\s+/g, " ").slice(0, 300);
      continue;
    }
    const lead = spaceBefore(n as Text) ? " " : "";
    const pb = parent.getBoundingClientRect();
    text.push({
      /* The space the page draws in front of it rides along (`spaceBefore`). */
      words: `${lead}${words}`.slice(0, 300),
      px,
      weight,
      y: box.height ? Math.round(((pb.top - box.top) / box.height) * 100) / 100 : 0,
    });
    lastBlock = block;
    if (text.length >= 40) break;
  }

  /* Every colour in the browser's rgb() form, whatever syntax the page
     wrote it in. Chrome reports `oklch(0.3 0.1 250)`, `lab(…)` and
     `color(display-p3 …)` as written, and a reader that knew `rgb(` alone
     dropped the paint of any site built this year. A canvas normalises
     any colour it can paint: set as its fill, read back as #rrggbb or
     rgba(). Transparent stays as it was, so see-through is still seen. */
  const normal = (() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return (c: string): string => {
      if (!ctx || !c || /^rgba?\(/i.test(c) || c === "transparent") return c;
      try {
        /* Painted onto one pixel and read back, because the canvas keeps
           a newer syntax as written when its fill style is read as a
           string; the pixel is always sRGB bytes. */
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#010203";
        ctx.fillStyle = c;
        if (String(ctx.fillStyle) === "#010203") return c;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = Array.from(ctx.getImageData(0, 0, 1, 1).data) as [number, number, number, number];
        if (a === 0) return "rgba(0, 0, 0, 0)";
        return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
      } catch { return c; }
    };
  })();
  const seeThrough = (c: string) => { const m = /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,/\s]+([\d.]+))?/i.exec(normal(c)); return !m || (m[1] !== undefined && Number(m[1]) < 0.05); };
  /* A link's words: what is written on it, else what it is called. A link
     that is only an icon (a GitHub mark, a Discord mark) has no text and
     was dropped, so a bar of twelve links read as ten; it is named by its
     label, its title, its picture's alt, its icon's title, or the last
     part of where it goes, in that order. */
  const nameOfLink = (a: Element): string => {
    const said = (a.textContent ?? "").replace(/\s+/g, " ").trim();
    if (said) return said;
    const label = a.getAttribute("aria-label") || a.getAttribute("title") || a.querySelector("img")?.getAttribute("alt") || a.querySelector("svg title")?.textContent || "";
    if (label.trim()) return label.replace(/\s+/g, " ").trim();
    const href = (a as HTMLAnchorElement).href || "";
    const tail = href.replace(/[/#?]+$/, "").split(/[/#?]/).filter(Boolean).pop() ?? "";
    return /^[\w.-]{1,40}$/.test(tail) ? tail : "";
  };
  const links = Array.from(el.querySelectorAll("a[href]")).slice(0, 30).map((a) => ({
    words: nameOfLink(a).slice(0, 60),
    href: (a as HTMLAnchorElement).href,
  })).filter((l) => l.words);

  /* A button is a button, and so is a link painted as a box: the page's
     own "Get started" is an `a` with a green fill and padding, and it read
     as no button at all. A link is a box when it paints its own
     background and has padding on both sides of its words. */
  const paintedLink = (a: Element): boolean => {
    const s = getComputedStyle(a);
    if (s.display === "inline" || (seeThrough(s.backgroundColor) && !/gradient\(/i.test(s.backgroundImage))) return false;
    return (parseFloat(s.paddingLeft) || 0) >= 6 && (parseFloat(s.paddingTop) || 0) >= 4;
  };
  const buttons = [
    ...Array.from(el.querySelectorAll("button, [role='button'], input[type='submit']")),
    ...Array.from(el.querySelectorAll("a[href]")).filter(paintedLink),
  ]
    .slice(0, 10)
    .map((b) => ((b as HTMLInputElement).value || b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40))
    .filter(Boolean);

  const images = Array.from(el.querySelectorAll("img")).slice(0, 8).map((im) => {
    const r = im.getBoundingClientRect();
    return { src: (im as HTMLImageElement).currentSrc || (im as HTMLImageElement).src, w: Math.round(r.width), h: Math.round(r.height), alt: (im as HTMLImageElement).alt || "" };
  }).filter((im) => im.src);
  /* An inline svg is a picture too, a logo or a hero drawing as often as
     not, and it was invisible: no `img`, no `src`. It is carried as the
     markup it is, when that is small enough to carry. */
  for (const sv of Array.from(el.querySelectorAll("svg")).slice(0, 8 - images.length)) {
    const r = sv.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) continue;
    const markup = sv.outerHTML;
    if (markup.length > 40_000) continue;
    images.push({ src: `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`, w: Math.round(r.width), h: Math.round(r.height), alt: sv.querySelector("title")?.textContent?.trim() || sv.getAttribute("aria-label") || "" });
  }
  // The element's own background picture counts as one of its pictures.
  const pictureOf = (bg: string) => (/url\(/.test(bg) ? (bg.match(/url\(["']?([^"')]+)/) ?? [])[1] : undefined);
  const ground = pictureOf(style.backgroundImage);
  if (ground) images.unshift({ src: new URL(ground, location.href).toString(), w: Math.round(box.width), h: Math.round(box.height), alt: "", ground: true } as never);
  /* What is behind it. A block that paints nothing of its own sits on
     whatever is painted up the page from it, the body included, and that
     is most of what a page looks like: the koi and the bamboo were on the
     body, and every block read as painted on nothing. The nearest painted
     colour and the nearest picture behind, each found separately. */
  /* A gradient is paint. A first screen painted with a linear gradient
     of three dark stops read as painted on nothing, and its white words
     landed on no ground. The colour of a gradient, for a part that takes
     one colour, is the mean of its stops: dark for a dark gradient, which
     is what a person sees behind the words. */
  const gradientColour = (image: string): string | null => {
    if (!/gradient\(/i.test(image)) return null;
    const stops = Array.from(image.matchAll(/(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^()]*(?:\([^()]*\)[^()]*)*\)|#[0-9a-f]{3,8}\b/gi))
      .map((m) => /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i.exec(normal(m[0])))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])])
      .filter((c) => c[3]! >= 0.05);
    if (!stops.length) return null;
    const mean = (i: number) => Math.round(stops.reduce((n, c) => n + c[i]!, 0) / stops.length);
    return `rgb(${mean(0)}, ${mean(1)}, ${mean(2)})`;
  };
  const painted = (s: CSSStyleDeclaration): string | null => (!seeThrough(s.backgroundColor) ? normal(s.backgroundColor) : gradientColour(s.backgroundImage));
  let behind: string | null = null;
  let behindPicture: string | undefined;
  for (let up = el.parentElement; up; up = up.parentElement) {
    const us = getComputedStyle(up);
    if (behind === null) behind = painted(us);
    if (!behindPicture) behindPicture = pictureOf(us.backgroundImage);
    if (behind !== null && behindPicture) break;
  }
  /* Nothing painted all the way up is the browser's own canvas, which is
     white, or black for a page that asks for a dark scheme and nothing
     else. A band of cards on a page whose body paints nothing read as
     painted on nothing, took the site's dark surface, and drew its dark
     titles on it. */
  if (behind === null) {
    const scheme = getComputedStyle(document.documentElement).colorScheme || "";
    behind = /\bdark\b/.test(scheme) && !/\blight\b/.test(scheme) ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
  }
  if (!ground && behindPicture) images.push({ src: new URL(behindPicture, location.href).toString(), w: Math.round(box.width), h: Math.round(box.height), alt: "", ground: true, behind: true } as never);

  /* The children that are the structure. A page builder wraps a band's
     contents in a container inside a section, and a row inside that, so
     the section's one child was one box and a row of three cards read as
     a band of words. A wrapper is opened while it is the only thing
     inside: the children are the first level with more than one. */
  const visibleKids = (e: Element): Element[] => Array.from(e.children).filter((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return r.width > 8 && r.height > 8 && cs.display !== "none";
  });
  let kids = visibleKids(el);
  for (let opened = 0; kids.length === 1 && opened < 4; opened++) {
    const inner = visibleKids(kids[0]!);
    if (!inner.length) break;
    kids = inner;
  }
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

  const border = Number(parseFloat(style.borderTopWidth)) > 0 ? normal(style.borderTopColor) : null;
  /*
   * The face: the first name on the stack, which is the family the page
   * was set in whether or not its file came with it. A web font the page
   * loads from the network comes on neither door, so the name travels on
   * its own. Whether it drew is measured rather than asked: a line set in
   * the face over a fallback is the same width as the fallback alone when
   * the face is not on this machine, and `document.fonts.check` says yes
   * to any family it has no rule for.
   */
  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|math|emoji|fangsong|inherit|initial|unset|-apple-system|BlinkMacSystemFont)$/i;
  const first = (style.fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
  const face = first && !GENERIC.test(first) ? first : null;
  const drew = (name: string): boolean => {
    const c = document.createElement("canvas").getContext("2d");
    if (!c) return false;
    const line = "mmmmmmmmmmlli WWW 0123 The quick fox";
    return ["monospace", "serif", "sans-serif"].some((fb) => {
      c.font = `32px ${fb}`;
      const alone = c.measureText(line).width;
      c.font = `32px "${name.replace(/"/g, "")}", ${fb}`;
      return Math.abs(c.measureText(line).width - alone) > 0.5;
    });
  };
  return {
    box: { x: Math.round(box.x + scrollX), y: Math.round(box.y + scrollY), w: Math.round(box.width), h: Math.round(box.height) },
    /** True when the box is wider than the element's own: its children run out of it, and the box holds them. */
    spilled,
    down: Math.round(((box.top + scrollY) / pageH) * 100) / 100,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role"),
    text,
    links,
    buttons,
    images,
    paint: {
      bg: painted(style) ?? normal(style.backgroundColor),
      text: normal(style.color),
      behind,
      border,
      radius: Math.round(parseFloat(style.borderTopLeftRadius) || 0),
      shadow: style.boxShadow !== "none",
    },
    type: {
      family: style.fontFamily,
      face,
      drew: face ? drew(face) : true,
      px: Math.round(parseFloat(style.fontSize) || 16),
      weight: Number(style.fontWeight) || 400,
      spacing: style.letterSpacing === "normal" ? 0 : Math.round(((parseFloat(style.letterSpacing) || 0) / (parseFloat(style.fontSize) || 16)) * 1000) / 1000,
      // `normal` is a line the browser sets itself, about 1.2 of the size; it was read as nought and dropped.
      leading: Math.round(parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 16) * 1.2),
    },
    layout: { flow, columns, gap },
    children,
  };
};

/**
 * The faces the page declares, read off its stylesheets.
 *
 * Every `@font-face` rule this browser can read: the family as declared,
 * its weight and style, its `src` list made absolute against the sheet
 * that declared it, and that sheet. A sheet from another origin cannot be
 * read at all, so its link is listed instead — a Google Fonts sheet names
 * its families in its address, and `fonts.ts` reads that. Nothing here
 * decides what to carry: that is `carryFaces`, with the faces the readings
 * are set in.
 */
export const FACES = (): { faces: { family: string; weight?: string; style?: string; sources: { url: string; format?: string }[]; sheet: string | null; unicodeRange?: string }[]; links: { href: string }[] } => {
  const faces: { family: string; weight?: string; style?: string; sources: { url: string; format?: string }[]; sheet: string | null; unicodeRange?: string }[] = [];
  const links: { href: string }[] = [];
  const abs = (u: string, base: string): string => { try { return new URL(u, base).href; } catch { return u; } };
  const walk = (list: CSSRuleList, base: string, sheet: string | null): void => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSFontFaceRule) {
        const st = r.style;
        const family = st.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "");
        const src = st.getPropertyValue("src");
        const sources: { url: string; format?: string }[] = [];
        const re = /url\((["']?)([^)"']+)\1\)(?:\s*format\((["']?)([^)"']+)\3\))?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) sources.push({ url: abs(m[2]!, base), ...(m[4] ? { format: m[4] } : {}) });
        if (family && sources.length) {
          const weight = st.getPropertyValue("font-weight").trim();
          const style = st.getPropertyValue("font-style").trim();
          const range = st.getPropertyValue("unicode-range").trim();
          faces.push({ family, ...(weight ? { weight } : {}), ...(style ? { style } : {}), sources, sheet, ...(range ? { unicodeRange: range } : {}) });
        }
      } else if (r instanceof CSSImportRule) {
        try {
          const inner = r.styleSheet;
          if (inner) walk(inner.cssRules, inner.href ?? base, inner.href ?? sheet);
        } catch {
          if (r.href) links.push({ href: abs(r.href, base) });
        }
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) {
        walk((r as CSSGroupingRule).cssRules, base, sheet);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { if (sheet.href) links.push({ href: sheet.href }); continue; }
    if (!rules) continue;
    walk(rules, sheet.href ?? location.href, sheet.href ?? null);
  }
  return { faces, links };
};

/* ------------------------------------------------------------------ */
/* Every element a person would name, one by one                        */
/* ------------------------------------------------------------------ */

/** A stretch of a text part's words carrying its own weight, slant, face, ink, link or hook. */
export interface PartRun {
  text: string;
  weight?: number;
  italic?: boolean;
  mono?: boolean;
  colour?: string;
  /** A chip in the sentence (PST's dark "not connected" code label): its fill, padding (top right bottom left) and rounding. */
  bg?: string;
  pad?: number[];
  radius?: number;
  /** Room the page left beside it in the line, left and right px (PST's "OFF AIR", 8px after the channel). */
  space?: number[];
  href?: string;
  /** The id and data-* attributes of the element these words sit in, so code can still find it. */
  hooks?: Record<string, string>;
}

/** How one element was set, as the browser computed it: the page's own rules, or the browser's defaults where it has none. */
/** One state rule as `parts/capturedMotion.ts` replays it. */
export interface PartState { selector: string; self: boolean; state: string; style: Record<string, string> }

export interface PartStyle {
  px: number;
  weight: number;
  family: string;
  italic: boolean;
  colour: string;
  /** Its own fill, when it paints one. */
  bg: string | null;
  border: { w: number; style: string; colour: string } | null;
  radius: number;
  /** Padding: top, right, bottom, left. */
  pad: [number, number, number, number];
  align: string;
  leading: number;
  transform: string;
  /**
   * What paints it besides one colour: a gradient, several layered, a data:
   * picture (the TV's static), as computed, with its size, position and
   * repeat. A picture at an address of the page's own is not carried this way.
   */
  image?: string;
  imageOptions?: [string, string, string];
  /** `text`: the background is seen only through its letters. */
  imageClip?: string;
  /** Its box-shadow, as computed (the TV body's offset ink shadow). */
  shadow?: string;
  /** A filter over it, as computed (the TV static's contrast). */
  filter?: string;
  /** The colour its control is ticked in (`accent-color`; PST's orange checkboxes). */
  accent?: string;
  /** How see-through it is as shown: its own opacity times every box round it, under 1. */
  opacity?: number;
  /** A mask it is painted through (an icon drawn in its colour), with its size, position and repeat. */
  mask?: string;
  maskOptions?: [string, string, string];
  /*
   * The rest of its look, as computed, carried as the capture carries it
   * (sink `node.art`): no field of the builder's sets these yet, so the part
   * is marked "look from capture" where it lands.
   */
  blend?: string;
  backdrop?: string;
  clipPath?: string;
  textShadow?: string;
  textStroke?: { w: number; color: string };
  paintOrder?: string;
  /** Each corner, top-left clockwise, where they differ. */
  radii?: number[];
  /** It clips what it holds (overflow other than visible): a rounded one rounds the corners of the parts in its corners (`pageParts.ts`). */
  clips?: boolean;
  maxw?: number;
  /** Its inside, when it is a flex row or column or a grid (as sink records it): the export grows its children as the page does (`fluidSite.ts`). */
  layout?: { display: "flex" | "grid"; direction?: "row" | "column"; align?: string; justify?: string; gap?: number; wrap?: boolean; columns?: number };
  /**
   * How it answers the pointer and the keyboard: each `:hover`, `:active` and
   * `:focus` rule that reaches it, its selector as written and its
   * declarations with the page's tokens resolved (`self`: the state is its
   * own, not an ancestor's). The shapes `parts/capturedMotion.ts` replays.
   */
  states?: { hover?: PartState[]; active?: PartState[]; focus?: PartState[] };
  /** What it eases between those states, as computed. */
  transition?: { property: string; duration?: string; timing?: string; delay?: string }[];
  /** A turned part that also animates (PST's swaying rods): its own turn at rest and the point it turns about, px from its box's top left, so its keyframes turn it where the page did. */
  ownTurn?: { transform: string; origin: string };
  /** Its running animations, every longhand as computed; their @keyframes are the read's `keyframes`. */
  animation?: { name: string; duration: string; timing: string; delay: string; iterations: string; direction: string; fill: string }[];
}

/** A form control as the page wrote it. */
export interface PartControl {
  type: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  disabled?: boolean;
  multiple?: boolean;
  rows?: number;
  /** A list's choices; `hook`: the `data-hook` the page's code finds one by. */
  options?: { text: string; value: string; selected: boolean; hook?: string }[];
}

/** One element of the page, read on its own. */
export interface PagePart {
  kind: "section" | "slot" | "heading" | "text" | "code" | "button" | "link" | "field" | "check" | "picture" | "shape";
  tag: string;
  /** The index of the section part this one sits in, or -1 for the page itself. */
  parent: number;
  box: { x: number; y: number; w: number; h: number };
  words: string;
  runs?: PartRun[];
  /** A field's or a checkbox's label, as the page wrote it. */
  label?: string;
  control?: PartControl;
  /** Its id and data-* attributes (and a control's name and role), exactly as written. */
  hooks: Record<string, string>;
  /** Null when it shows as the page opens; else what hides it (the hidden block's hook, id or path), and it took no room. */
  hidden: string | null;
  selector: string;
  href?: string;
  src?: string;
  alt?: string;
  style: PartStyle;
  /** The line of the page's source its hook (else its words) is written on, when the source was read beside it (`sourceHooks.ts#withLines`). */
  line?: number;
  /** The page's own CSS rules that reach it: a linked sheet's address, or which style block, and the selector as written. */
  rules?: { sheet: string | null; block: number; selector: string }[];
  /** Its class names, which scripts may find it by too. */
  classes?: string[];
  /** Hooks on elements inside it that are not parts of their own (a list's options, the words inside a button): carried by this part. */
  inner?: Record<string, string>[];
  /** The same rules with the file and line they are written on (`sourceHooks.ts#withLines`). */
  css?: { file: string; line: number; selector: string }[];
  /**
   * What turns it, as one matrix about its own box's centre: its own
   * rotation, scale or skew after those of what holds it. Its `box` is then
   * the one the layout gave, before the turn (PST's antenna rods: 6x90,
   * leaning -32deg, not the 51x81 box round the lean).
   */
  turn?: string;
  /** A `::before` or `::after` that draws (the red balls on the antenna tips), and the hooks of the element it belongs to. */
  pseudo?: { which: "::before" | "::after"; host: Record<string, string> };
}

/** A page read element by element. */
export interface PageRead {
  title: string;
  width: number;
  height: number;
  /** The page's own ground, ink, face and size: the body's, as computed. */
  bg: string;
  colour: string;
  family: string;
  px: number;
  /** How many of the parts any rule of the page's own styles (a sheet or a style attribute) reaches. None: the browser's defaults are the whole look. */
  styledParts: number;
  /** Blocks hidden as the page opens (the hidden attribute, display none) and templates, read as hidden parts. */
  hiddenBlocks: number;
  templates: number;
  /** More than the cap: the rest are not read. */
  truncated: boolean;
  parts: PagePart[];
  /** Each part's box with the window at the tablet's and the phone's width, in the order of `parts`; null where the site does not draw it there (filled by whoever opened the page, `api/studio/zip`). */
  widths?: Partial<Record<"tablet" | "phone", ({ x: number; y: number; w: number; h: number; px?: number } | null)[]>>;
  /** The page's @keyframes that a part's animation names, as the capture records them. */
  keyframes?: { name: string; frames: { key: string; style: Record<string, string> }[] }[];
}

/**
 * THE PAGE, ELEMENT BY ELEMENT.
 *
 * `CANDIDATES` names the few big blocks a person would point at, and
 * `MEASURE` reads one block as a whole; a plain page read that way came in
 * as seven bands of words (PST's test page: every heading, paragraph,
 * button and field of a section folded into one part, its hidden panels
 * read as tall blank boxes). This reads the other way round: each heading,
 * paragraph, line, button, link, field, checkbox and picture is a part of
 * its own, under the section it sits in, with the id and data-* attributes
 * the page's code finds it by.
 *
 * What the browser computed is what is kept, so a page with no styles of
 * its own keeps the browser's defaults: an h1 at 32px bold, a button's
 * grey face and edge, a list's bullets, the margins between blocks.
 *
 * Hidden blocks (the hidden attribute, display none) take no room where
 * the page opens, so they are read where they stand without being shown
 * there: each is revealed in place for a moment, read, and hidden again,
 * and its parts carry what hid them. A template is read the same way, from
 * a copy of its contents put beside it and taken away again.
 *
 * Serialised into the page like the two above: no imports, no closure.
 */
export const PARTS = (cap: number): PageRead => {
  const parts: PagePart[] = [];
  let truncated = false;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "META", "LINK", "HEAD", "TITLE", "BASE", "WBR"]);
  const MEDIA = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "PICTURE", "IFRAME", "AUDIO"]);
  /* An SVG element's tag name is lower case ("svg", "circle"): compared as written, an inline svg was taken for inline words with none and dropped, its circles' hooks with it (PST's duel). */
  const isMedia = (e: Element) => MEDIA.has(e.tagName.toUpperCase());
  const SECTIONING = new Set(["SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "MAIN", "NAV", "FORM", "FIELDSET", "DETAILS", "DIALOG", "UL", "OL", "DL", "TABLE", "FIGURE"]);
  const SEPARATORS = /^[\s|·•/\\,;:–—\-]*$/;
  const css = (e: Element) => getComputedStyle(e);
  const shown = (e: Element) => css(e).display !== "none";
  /* What a closed <details> holds past its summary: the page does not show it, whatever its display says. */
  const folded = (e: Element) => { const d = e.parentElement; return !!d && d.tagName === "DETAILS" && !(d as HTMLDetailsElement).open && e.tagName !== "SUMMARY"; };
  const inlineish = (e: Element) => { const d = css(e).display; return d.startsWith("inline") || d === "contents"; };
  const isCheck = (e: Element) => e.tagName === "INPUT" && /^(checkbox|radio)$/i.test((e as HTMLInputElement).type);
  const isControl = (e: Element) => {
    const t = e.tagName;
    if (t === "BUTTON" || t === "TEXTAREA" || t === "SELECT") return true;
    if (t === "INPUT") return (e as HTMLInputElement).type !== "hidden";
    return e.getAttribute("role") === "button";
  };
  const checkLabel = (e: Element) => e.tagName === "LABEL" && !!Array.from(e.querySelectorAll("input")).find(isCheck) && !Array.from(e.querySelectorAll("input, select, textarea, button")).some((c) => !isCheck(c) && isControl(c));
  const box = (r: DOMRect) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  /* A path the element can be found again by: every step from the body, the same walk `CANDIDATES` makes. Never the id alone: what a section holds is read off its path continuing the section's (`partTree.ts`). */
  const path = (el: Element): string => {
    const bits: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && bits.length < 40) {
      const parent: Element | null = node.parentElement;
      const tag = node.tagName.toLowerCase();
      if (!parent) { bits.unshift(tag); break; }
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      bits.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag);
      node = parent;
    }
    return node === document.body && !bits.length ? "body" : `body > ${bits.join(" > ")}`;
  };
  const hooksOf = (e: Element): Record<string, string> => {
    const h: Record<string, string> = {};
    for (const a of Array.from(e.attributes)) {
      if (a.name === "id" || a.name.startsWith("data-") || a.name.startsWith("aria-") || ((a.name === "name" || a.name === "role") && isControl(e))) h[a.name] = a.value;
    }
    return h;
  };
  const hooked = (e: Element) => e.hasAttribute("id") || Array.from(e.attributes).some((a) => a.name.startsWith("data-"));
  const seeThrough = (c: string) => !c || c === "transparent" || /rgba\([^)]*,\s*0(\.0+)?\s*\)$/.test(c);
  /* A line height of "normal" is the face's own, 18px for 16px Times and not 1.2 of the size: measured once per face and size. Read as 1.2, two lines of a paragraph looked like less than two lines on the board, which sets those on one unbroken line past the page's edge. */
  const normals = new Map<string, number>();
  const normalLine = (s: CSSStyleDeclaration, px: number): number => {
    const key = `${s.fontFamily}|${px}|${s.fontWeight}|${s.fontStyle}`;
    const had = normals.get(key);
    if (had) return had;
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap;line-height:normal;font-family:${s.fontFamily};font-size:${px}px;font-weight:${s.fontWeight};font-style:${s.fontStyle}`;
    probe.textContent = "Hxg";
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height || px * 1.2;
    probe.remove();
    normals.set(key, h);
    return h;
  };
  const styleOf = (e: Element, which?: "::before" | "::after"): PartStyle => {
    const s = which ? getComputedStyle(e, which) : css(e);
    const px = parseFloat(s.fontSize) || 16;
    const bw = parseFloat(s.borderTopWidth) || 0;
    return {
      px: Math.round(px * 100) / 100,
      weight: Number(s.fontWeight) || 400,
      family: s.fontFamily,
      italic: s.fontStyle === "italic",
      colour: s.color,
      bg: seeThrough(s.backgroundColor) ? null : s.backgroundColor,
      border: bw > 0 && s.borderTopStyle !== "none" && s.borderTopStyle !== "hidden" ? { w: Math.round(bw * 100) / 100, style: s.borderTopStyle, colour: s.borderTopColor } : null,
      radius: Math.round(parseFloat(s.borderTopLeftRadius) || 0),
      pad: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => Math.round((parseFloat(v) || 0) * 100) / 100) as [number, number, number, number],
      align: s.textAlign,
      leading: Math.round((parseFloat(s.lineHeight) || normalLine(s, px)) * 100) / 100,
      transform: s.textTransform,
      ...(!which && (s.overflowX !== "visible" || s.overflowY !== "visible") ? { clips: true } : {}),
      /* Its max-width in pixels, where it has one: the export lets it grow with the window up to this and no further (`fluidSite.ts`, node.maxw). */
      ...(!which && /^[\d.]+px$/.test(s.maxWidth) ? { maxw: Math.round(parseFloat(s.maxWidth)) } : {}),
      ...(!which && /^(inline-)?(flex|grid)$/.test(s.display) ? { layout: {
        display: s.display.endsWith("grid") ? "grid" as const : "flex" as const,
        ...(s.display.endsWith("flex") ? { direction: s.flexDirection.startsWith("column") ? "column" as const : "row" as const, ...(s.flexWrap === "wrap" ? { wrap: true } : {}) } : { columns: s.gridTemplateColumns.split(/\s+(?![^(]*\))/).filter(Boolean).length }),
        align: s.alignItems, justify: s.justifyContent,
        ...(parseFloat(s.columnGap) > 0 ? { gap: Math.round(parseFloat(s.columnGap) * 100) / 100 } : {}),
      } } : {}),
    };
  };
  const paints = (e: Element) => { const s = styleOf(e); return !!s.bg || !!s.border || !!paintOf(css(e)).image; };
  /*
   * WHAT PAINTS IT BESIDES ONE COLOUR. PST's TV body is a linear gradient
   * built from tokens over no background colour, with an offset ink shadow:
   * read for its colour alone it came in as no fill at all, and the board
   * drew it white inside its outline. The background image is kept as the
   * browser computed it (the tokens already resolved), when it is paint the
   * board can draw by itself: gradients, and pictures written into the CSS
   * as data:. A picture at an address of the page's own would be a broken
   * link on the board, and is left out as before.
   */
  type Paint = Pick<PartStyle, "image" | "imageOptions" | "imageClip" | "shadow" | "filter" | "mask" | "maskOptions" | "blend" | "backdrop" | "clipPath" | "textShadow" | "textStroke" | "paintOrder" | "radii" | "animation" | "accent">;
  function paintOf(s: CSSStyleDeclaration): Paint {
    const out: Paint = {};
    const r = s as unknown as Record<string, string>;
    /* A picture at one of the page's own addresses is kept too: whoever opened the page (the zip route) puts its bytes in as data: before it reaches the board (`inlineOwnPictures`). */
    const bi = s.backgroundImage;
    if (bi && bi !== "none") {
      out.image = bi;
      out.imageOptions = [s.backgroundSize, s.backgroundPosition, s.backgroundRepeat];
      const clip = r.webkitBackgroundClip || s.backgroundClip;
      if (clip === "text") out.imageClip = "text";
    }
    /* A mask it is painted through: PST's icons are one colour (background: currentColor) seen through an svg (web/assets/tv). */
    const mk = s.maskImage || r.webkitMaskImage;
    if (mk && mk !== "none") {
      out.mask = mk;
      out.maskOptions = [s.maskSize || r.webkitMaskSize || "auto", s.maskPosition || r.webkitMaskPosition || "0% 0%", s.maskRepeat || r.webkitMaskRepeat || "repeat"];
    }
    if (s.boxShadow && s.boxShadow !== "none") out.shadow = s.boxShadow;
    if (s.filter && s.filter !== "none") out.filter = s.filter;
    if (s.accentColor && s.accentColor !== "auto") out.accent = s.accentColor;
    /* What the builder has no field for yet: kept as computed, as a capture keeps it. */
    if (s.mixBlendMode && s.mixBlendMode !== "normal") out.blend = s.mixBlendMode;
    const bd = s.backdropFilter || r.webkitBackdropFilter;
    if (bd && bd !== "none") out.backdrop = bd;
    if (s.clipPath && s.clipPath !== "none") out.clipPath = s.clipPath;
    if (s.textShadow && s.textShadow !== "none") out.textShadow = s.textShadow;
    const sw = parseFloat(r.webkitTextStrokeWidth || "0") || 0;
    if (sw > 0) out.textStroke = { w: Math.round(sw * 100) / 100, color: r.webkitTextStrokeColor || s.color };
    if (s.paintOrder && s.paintOrder !== "normal") out.paintOrder = s.paintOrder;
    const corners = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
    if (corners.every((c) => /^[\d.]+px$/.test(c ?? "")) && new Set(corners).size > 1) out.radii = corners.map((c) => Math.round(parseFloat(c!) * 100) / 100);
    const anim = animOf(s);
    if (anim) out.animation = anim;
    return out;
  }

  /*
   * A TURNED BOX, MEASURED AS LAID OUT. PST's antenna rods are 6x90 bars
   * leaning -32deg and 28deg (and swaying): the box the browser reports for
   * one is the box round the lean, 51x81, and filled with the rod's ink the
   * two drew as one dark block. So before anything is read, every element
   * turned, scaled or skewed (its transform, or rotate and scale of their
   * own) is read at rest (its animation lifted for the read), then has its
   * turn taken off while the page is measured: every box is the one the
   * layout gave. Each part then carries what turns it, its own and what
   * holds it, as one matrix about its own centre (`turn`), and the board
   * turns it back. A move alone (translate(-50%, -50%) centring a box) stays
   * in the box, as it always was. Put back when the read is done.
   */
  /* Its running animations, from the longhands as computed (or as they were before a turned box's were lifted for the read). */
  type Moving = Pick<CSSStyleDeclaration, "animationName" | "animationDuration" | "animationTimingFunction" | "animationDelay" | "animationIterationCount" | "animationDirection" | "animationFillMode" | "transitionProperty" | "transitionDuration" | "transitionTimingFunction" | "transitionDelay">;
  function animOf(s: Moving): PartStyle["animation"] {
    const names = (s.animationName || "none").split(",").map((v) => v.trim());
    if (!names.some((n) => n && n !== "none")) return undefined;
    const at = (v: string, i: number) => { const l = (v || "").split(/,(?![^(]*\))/).map((x) => x.trim()); return l[i % Math.max(1, l.length)] ?? ""; };
    return names.flatMap((name, i) => (name && name !== "none" ? [{ name, duration: at(s.animationDuration, i), timing: at(s.animationTimingFunction, i), delay: at(s.animationDelay, i), iterations: at(s.animationIterationCount, i), direction: at(s.animationDirection, i), fill: at(s.animationFillMode, i) }] : []));
  }
  const keep = (s: CSSStyleDeclaration): Moving => ({ animationName: s.animationName, animationDuration: s.animationDuration, animationTimingFunction: s.animationTimingFunction, animationDelay: s.animationDelay, animationIterationCount: s.animationIterationCount, animationDirection: s.animationDirection, animationFillMode: s.animationFillMode, transitionProperty: s.transitionProperty, transitionDuration: s.transitionDuration, transitionTimingFunction: s.transitionTimingFunction, transitionDelay: s.transitionDelay });
  /* What a turned box ran before its animation and easing were lifted for the read: the antennas' sway. */
  const moving = new Map<Element, Moving>();
  const restTurn = new Map<Element, { transform: string; origin: string }>();
  const I = new DOMMatrix();
  const flat = (m: DOMMatrix) => Math.abs(m.a - 1) < 1e-4 && Math.abs(m.b) < 1e-4 && Math.abs(m.c) < 1e-4 && Math.abs(m.d - 1) < 1e-4;
  /* translate, then rotate, then scale, then transform, as CSS composes them; a % of translate is of the box's own size. */
  const ownMatrix = (r: { tf: string; translate: string; rotate: string; scale: string }, w: number, h: number): DOMMatrix => {
    let m = new DOMMatrix();
    const set = (v: string) => !!v && v !== "none";
    if (set(r.translate)) { const [x, y] = r.translate.split(/\s+/).map((v, i) => (/%$/.test(v) ? (parseFloat(v) / 100) * (i ? h : w) : parseFloat(v) || 0)); m = m.translate(x ?? 0, y ?? 0); }
    if (set(r.rotate)) { const d = /(-?[\d.]+)(deg|rad|turn|grad)\s*$/.exec(r.rotate); if (d) { const v = Number(d[1]); m = m.rotate(d[2] === "rad" ? (v * 180) / Math.PI : d[2] === "turn" ? v * 360 : d[2] === "grad" ? v * 0.9 : v); } }
    if (set(r.scale)) { const [x, y] = r.scale.split(/\s+/).map(Number); if (Number.isFinite(x)) m = m.scale(x!, Number.isFinite(y) ? y! : x!); }
    if (set(r.tf)) { try { m = m.multiply(new DOMMatrix(r.tf)); } catch { /* not a matrix this browser reads */ } }
    return m;
  };
  /* A matrix in the page's space, about a point: what turns a box about its own origin. */
  const about = (m: DOMMatrix, ox: number, oy: number) => I.translate(ox, oy).multiply(m).translate(-ox, -oy);
  const originAt = (origin: string, x: number, y: number, w: number, h: number): [number, number] => {
    const [a, b] = origin.split(/\s+/).map(parseFloat);
    return [x + (Number.isFinite(a) ? a! : w / 2), y + (Number.isFinite(b) ? b! : h / 2)];
  };
  const turns = new Map<Element, DOMMatrix>();
  const lifted: { el: HTMLElement; had: string | null }[] = [];
  {
    const turning: { el: HTMLElement; m: DOMMatrix; origin: string }[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (!(el instanceof HTMLElement) || SKIP.has(el.tagName) || !el.getClientRects().length) continue;
      const s = css(el);
      const moved = (v: string) => !!v && v !== "none";
      if (!moved(s.transform) && !moved(s.getPropertyValue("rotate")) && !moved(s.getPropertyValue("scale"))) continue;
      /* At rest: the swaying rods read where they lean, not mid-swing. */
      const animated = (el.getAnimations?.() ?? []).length > 0;
      const before = el.getAttribute("style");
      if (animated) el.style.setProperty("animation", "none", "important");
      const r = css(el);
      const rest = { tf: r.transform, translate: r.getPropertyValue("translate"), rotate: r.getPropertyValue("rotate"), scale: r.getPropertyValue("scale"), origin: r.transformOrigin, position: r.position };
      if (animated) { if (before === null) el.removeAttribute("style"); else el.setAttribute("style", before); }
      const m = ownMatrix(rest, el.offsetWidth, el.offsetHeight);
      if (flat(m)) continue;
      lifted.push({ el, had: before });
      moving.set(el, keep(css(el)));
      if (animated) restTurn.set(el, { transform: m.toString(), origin: rest.origin });
      if (animated) el.style.setProperty("animation", "none", "important");
      for (const p of ["transform", "translate", "rotate", "scale", "transition"]) el.style.setProperty(p, "none", "important");
      /* A transform holds what is placed absolutely inside it; lifted, a static box must still hold them. */
      if (rest.position === "static") el.style.setProperty("position", "relative", "important");
      turning.push({ el, m, origin: rest.origin });
    }
    /* Origins read off the boxes as laid out, every turn lifted. */
    for (const t of turning) {
      const r = t.el.getBoundingClientRect();
      const [ox, oy] = originAt(t.origin, r.left + scrollX, r.top + scrollY, r.width, r.height);
      turns.set(t.el, about(t.m, ox, oy));
    }
  }
  /* Everything that turns it, in the page's space: what holds it first, its own last. */
  const turnOf = (el: Element | null, own: DOMMatrix | null = null): DOMMatrix | null => {
    let m = own;
    for (let up: Element | null = el; up && up !== document.documentElement; up = up.parentElement) {
      const t = turns.get(up);
      if (t) m = m ? t.multiply(m) : t;
    }
    return m;
  };
  /* The same, about a box's own centre, as CSS writes it on a box whose origin is its centre. */
  const turnSaid = (m: DOMMatrix | null, b: { x: number; y: number; w: number; h: number }): string | null => {
    if (!m || (flat(m) && Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5)) return null;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const tx = m.a * cx + m.c * cy + m.e - cx, ty = m.b * cx + m.d * cy + m.f - cy;
    const k = (v: number) => Math.round(v * 10000) / 10000, q = (v: number) => Math.round(v * 100) / 100;
    return `matrix(${k(m.a)}, ${k(m.b)}, ${k(m.c)}, ${k(m.d)}, ${q(tx)}, ${q(ty)})`;
  };

  /*
   * A ::before OR ::after THAT DRAWS. PST's antenna balls are each rod's
   * ::after: a red disc with an ink edge on the rod's tip, with no element
   * of its own, so nothing read it and the rods came in bare. One placed
   * absolutely and drawing something (a fill, a gradient, an edge, a shadow
   * or words) is a part of its own, at the place the browser put it inside
   * its containing block, at its size, under the section its element is in,
   * turned with its element.
   */
  const pseudoParts = (el: Element, parent: number, hidden: string | null, host = -1) => {
    if (el instanceof SVGElement) return;
    for (const which of ["::before", "::after"] as const) {
      if (truncated) return;
      const ps = getComputedStyle(el, which);
      const c = ps.content;
      if (!c || c === "none" || c === "normal" || ps.display === "none" || ps.visibility === "hidden") continue;
      if (Number(ps.opacity) <= 0.05) continue;
      /*
       * ONE IN THE FLOW (PST's panel titles: an icon before the words, a
       * flex item 22px square painted through a mask). It has no box to
       * ask for and no left or top to place it by, so a stand-in is put
       * where it is, wearing every property it computes to, while it stops
       * drawing for the moment; the stand-in's box is its box.
       */
      if (ps.position !== "absolute" && ps.position !== "fixed") {
        const paint0 = paintOf(ps);
        const words0 = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").replace(/\\(.)/g, "$1").trim();
        if (!(!seeThrough(ps.backgroundColor) || paint0.image || paint0.mask || paint0.shadow || words0)) continue;
        const stand = document.createElement("span");
        for (let k = 0; k < ps.length; k++) { const prop = ps[k]!; if (prop !== "content") stand.style.setProperty(prop, ps.getPropertyValue(prop)); }
        if (words0) stand.textContent = words0;
        const mark = `polio-pseudo-${parts.length}`;
        el.setAttribute("data-polio-pseudo", mark);
        const hush = document.createElement("style");
        hush.textContent = `[data-polio-pseudo="${mark}"]${which} { content: none !important; display: none !important; }`;
        document.head.appendChild(hush);
        if (which === "::before") el.insertBefore(stand, el.firstChild); else el.appendChild(stand);
        const rr = stand.getBoundingClientRect();
        /* The host's own words start past it: their part keeps that start as its padding, or the words are drawn over the icon. */
        const hostPart = host >= 0 ? parts[host] : undefined;
        if (which === "::before" && hostPart && hostPart.words && hostPart.style.pad) {
          const range = document.createRange();
          let first: Text | null = null;
          for (const t of Array.from(el.childNodes)) if (t.nodeType === 3 && t.textContent!.trim()) { first = t as Text; break; }
          if (first) {
            range.selectNodeContents(first);
            const tr = Array.from(range.getClientRects())[0];
            const hr = el.getBoundingClientRect();
            const start = tr ? Math.round((tr.left - hr.left - (parseFloat(css(el).borderLeftWidth) || 0)) * 100) / 100 : 0;
            if (start > hostPart.style.pad[3]) hostPart.style.pad[3] = start;
          }
        }
        stand.remove(); hush.remove(); el.removeAttribute("data-polio-pseudo");
        if (!(rr.width > 0 && rr.height > 0)) continue;
        const b0 = box(rr);
        const st0 = { ...styleOf(el, which), ...paint0 };
        if (/%$/.test(ps.borderTopLeftRadius)) st0.radius = Math.round((parseFloat(ps.borderTopLeftRadius) / 100) * Math.min(b0.w, b0.h));
        const turn0 = turnSaid(turnOf(el), b0);
        push({ kind: "shape", tag: which, parent, box: b0, words: words0, hooks: {}, hidden, selector: `${path(el)}${which}`, style: st0, pseudo: { which, host: hooksOf(el) }, ...(turn0 ? { turn: turn0 } : {}) });
        continue;
      }
      const n = (v: string) => parseFloat(v) || 0;
      const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
      const bw = SIDES.map((k) => (ps.getPropertyValue(`border-${k.toLowerCase()}-style`) === "none" ? 0 : n(ps.getPropertyValue(`border-${k.toLowerCase()}-width`))));
      const pad = SIDES.map((k) => n(ps.getPropertyValue(`padding-${k.toLowerCase()}`)));
      const mar = SIDES.map((k) => n(ps.getPropertyValue(`margin-${k.toLowerCase()}`)));
      const text = (/^"([\s\S]*)"$/.exec(c)?.[1] ?? "").replace(/\\(.)/g, "$1").trim();
      const paint = paintOf(ps);
      if (!(!seeThrough(ps.backgroundColor) || paint.image || paint.mask || paint.shadow || bw.some(Boolean) || text)) continue;
      const w0 = n(ps.width), h0 = n(ps.height);
      if (!(w0 > 0 && h0 > 0)) continue;
      const bb = ps.boxSizing === "border-box";
      const w = bb ? w0 : w0 + pad[1]! + pad[3]! + bw[1]! + bw[3]!;
      const h = bb ? h0 : h0 + pad[0]! + pad[2]! + bw[0]! + bw[2]!;
      /* Its containing block: the padding box of the nearest positioned box, its own element first. */
      let block = { x: 0, y: 0, w: innerWidth, h: innerHeight };
      if (ps.position === "fixed") block = { x: scrollX, y: scrollY, w: innerWidth, h: innerHeight };
      else {
        let cb: Element | null = el;
        while (cb && cb !== document.body && css(cb).position === "static") cb = cb.parentElement;
        if (cb) {
          const r = cb.getBoundingClientRect(), cs = css(cb);
          const bl = n(cs.borderLeftWidth), bt = n(cs.borderTopWidth);
          block = { x: r.left + scrollX + bl, y: r.top + scrollY + bt, w: r.width - bl - n(cs.borderRightWidth), h: r.height - bt - n(cs.borderBottomWidth) };
        }
      }
      const x = block.x + (ps.left !== "auto" ? n(ps.left) + mar[3]! : block.w - n(ps.right) - mar[1]! - w);
      const y = block.y + (ps.top !== "auto" ? n(ps.top) + mar[0]! : block.h - n(ps.bottom) - mar[2]! - h);
      const b = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      const own = ps.transform && ps.transform !== "none" ? about(ownMatrix({ tf: ps.transform, translate: ps.getPropertyValue("translate"), rotate: ps.getPropertyValue("rotate"), scale: ps.getPropertyValue("scale") }, w, h), ...originAt(ps.transformOrigin, x, y, w, h)) : null;
      const style = { ...styleOf(el, which), ...paint };
      /* Rounding written as a share of the box (border-radius: 50%) is a share of this box: a disc stays a disc. */
      if (/%$/.test(ps.borderTopLeftRadius)) style.radius = Math.round((parseFloat(ps.borderTopLeftRadius) / 100) * Math.min(b.w, b.h));
      /* A move alone is its place, as an element's is; a turn is carried. */
      const total = turnOf(el, own);
      if (total && flat(total)) { b.x = Math.round(b.x + total.e); b.y = Math.round(b.y + total.f); }
      const turn = total && !flat(total) ? turnSaid(total, b) : null;
      push({ kind: "shape", tag: which, parent, box: b, words: text, hooks: {}, hidden, selector: `${path(el)}${which}`, style, pseudo: { which, host: hooksOf(el) }, ...(turn ? { turn } : {}) });
    }
  };
  /* The page's own rules, once: a linked sheet by the address its link wrote, a style block by its place among the page's style blocks. */
  let pageRules: { sheet: string | null; block: number; selector: string }[] | null = null;
  /*
   * HOVER, PRESS AND FOCUS. Every `:hover`, `:active` and `:focus` rule of
   * the page, read once; for a part, the ones whose selector reaches it with
   * the state taken off, their declarations as written with the page's
   * tokens resolved where the part is (a rule copied to the board has no
   * `--pons-…` to read). PST's TV button sinks when pressed, its fields ring
   * when focused.
   */
  let stateRules: { selector: string; state: string; decl: [string, string][] }[] | null = null;
  const STATE = /:(hover|active|focus-visible|focus-within|focus)(?![\w-])/;
  const statesOf = (e: Element, was?: Moving): Pick<PartStyle, "states" | "transition"> => {
    if (!stateRules) {
      stateRules = [];
      const walk = (list: CSSRuleList) => {
        for (const r of Array.from(list)) {
          if (stateRules!.length > 400) return;
          if (r instanceof CSSStyleRule) {
            const decl = r.style.cssText.split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as [string, string]; }).filter(([k, v]) => k && v);
            for (const one of r.selectorText.split(/,(?![^(]*\))/)) {
              const s = one.trim(), m = STATE.exec(s);
              if (m && !/::?(before|after)/.test(s) && decl.length) stateRules!.push({ selector: s, state: m[1]!, decl });
            }
          } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules);
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        const owner = sh.ownerNode as Element | null;
        if (!owner || owner.hasAttribute("data-polio-template")) continue;
        try { walk(sh.cssRules); } catch { /* another origin's sheet */ }
      }
    }
    const cs = css(e);
    const resolve = (v: string) => { for (let i = 0; i < 6 && v.includes("var("); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fb?: string) => cs.getPropertyValue(name).trim() || (fb ?? "").trim()); return v; };
    const out: NonNullable<PartStyle["states"]> = {};
    let n = 0;
    for (const r of stateRules) {
      if (n >= 8) break;
      const bare = r.selector.replace(new RegExp(STATE.source, "g"), "").trim();
      if (!bare) continue;
      try { if (!e.matches(bare)) continue; } catch { continue; }
      const self = STATE.test(r.selector.replace(/\[[^\]]*\]|\([^)]*\)/g, "").trim().split(/[\s>+~]+/).pop() ?? "");
      const kind = r.state === "hover" ? "hover" : r.state === "active" ? "active" : "focus";
      (out[kind] ??= []).push({ selector: r.selector, self, state: r.state, style: Object.fromEntries(r.decl.map(([k, v]) => [k, resolve(v)])) });
      n++;
    }
    const ts = was ?? cs;
    const tp = (ts.transitionProperty || "").split(",").map((v) => v.trim());
    const at = (v: string, i: number) => { const l = (v || "").split(/,(?![^(]*\))/).map((x) => x.trim()); return l[i % Math.max(1, l.length)] ?? ""; };
    const transition = tp.map((property, i) => ({ property, duration: at(ts.transitionDuration, i), timing: at(ts.transitionTimingFunction, i), delay: at(ts.transitionDelay, i) })).filter((t) => t.property && t.property !== "none" && parseFloat(t.duration) > 0);
    return { ...(n ? { states: out } : {}), ...(transition.length ? { transition } : {}) };
  };
  const rulesFor = (e: Element) => {
    if (!pageRules) {
      pageRules = [];
      const blocks = Array.from(document.querySelectorAll("style"));
      const walk = (list: CSSRuleList, sheet: string | null, block: number) => {
        for (const r of Array.from(list)) {
          if (pageRules!.length > 3000) return;
          if (r instanceof CSSStyleRule) pageRules!.push({ sheet, block, selector: r.selectorText });
          else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) walk((r as CSSGroupingRule).cssRules, sheet, block);
        }
      };
      for (const sh of Array.from(document.styleSheets)) {
        const owner = sh.ownerNode as Element | null;
        if (!owner || owner.hasAttribute("data-polio-template")) continue;
        try { walk(sh.cssRules, owner.tagName === "LINK" ? owner.getAttribute("href") : null, owner.tagName === "STYLE" ? blocks.indexOf(owner as HTMLStyleElement) : -1); } catch { /* another origin's sheet */ }
      }
    }
    const out: { sheet: string | null; block: number; selector: string }[] = [];
    /* And a rule naming it by its hook, id or class that does not reach it as the page opens: its other states (PST's score in [data-sign="gain"] green). */
    const hook = e.getAttribute("data-hook");
    const names = [hook ? `[data-hook="${hook}"]` : null, e.id ? `#${e.id}` : null, ...Array.from(e.classList).map((c) => `.${c}`)].filter((x): x is string => !!x);
    const names_ = (sel: string) => names.some((n) => { const i = sel.indexOf(n); return i >= 0 && !/[\w-]/.test(sel[i + n.length] ?? ""); });
    for (const r of pageRules) {
      if (out.length >= 12) break;
      try { if (e.matches(r.selector) || names_(r.selector)) out.push(r); } catch { /* a selector this browser cannot test */ }
    }
    return out;
  };
  /* `turnFrom`: the element whose turn it takes, when it is not `el` (a line of words takes its holder's). */
  const push = (p: PagePart, el?: Element, turnFrom: Element | null = el ?? null): number => {
    if (parts.length >= cap) { truncated = true; return -1; }
    /*
     * ONE LINE OF INLINE WORDS IS AS TALL AS ITS LINE. An inline element's
     * box is its letters' (PST's "Amount (SOL)" label: 19 tall in a 22.4
     * line), and the board sets words in their line: drawn 22 tall, the part
     * grew by 3 and pushed everything under it down (the money column by 6).
     * So it is read as the line holds it, centred where its letters are.
     */
    const held = p.kind === "check" ? el?.closest("label") ?? null : el ?? turnFrom ?? null;
    if (held && (p.words || (held.textContent ?? "").trim()) && !(held instanceof SVGElement) && (css(held).display === "inline" || (p.kind === "text" && !!p.words))) {
      const lh = parseFloat(css(held).lineHeight);
      if (lh > p.box.h + 0.5 && p.box.h < lh * 1.5) { const grow = Math.round(lh) - p.box.h; if (grow > 0) p.box = { ...p.box, y: p.box.y - Math.floor(grow / 2), h: p.box.h + grow }; }
    }
    if (el) {
      const rules = rulesFor(el);
      if (rules.length) p.rules = rules;
      const classes = Array.from(el.classList).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 8);
      if (classes.length) p.classes = classes;
      if (!(el instanceof SVGElement && el.tagName.toLowerCase() !== "svg")) Object.assign(p.style, paintOf(css(el)));
      /* Seen through as the page shows it: its own see-through times every box round it (PST's legend at 0.8 fades its words too, a part of their own on the board). */
      let seen = 1;
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) seen *= Number(css(a).opacity) || 0;
      if (seen < 0.999) p.style.opacity = Math.round(seen * 1000) / 1000; else delete p.style.opacity;
      /* A turned box's own animation and easing, as they were before the read lifted them. */
      const was = moving.get(el);
      if (was) {
        const a = animOf(was);
        if (a) p.style.animation = a;
        /* Turned by itself alone, and swaying: its own turn about its own point, which its keyframes turn about too. */
        let held = false;
        for (let up = el.parentElement; up; up = up.parentElement) if (turns.has(up)) { held = true; break; }
        const own = restTurn.get(el);
        if (a && own && !held) p.style.ownTurn = own;
      }
      if (!p.pseudo) Object.assign(p.style, statesOf(el, was));
    }
    if (turnFrom && !p.turn) { const t = turnSaid(turnOf(turnFrom), p.box); if (t) p.turn = t; }
    parts.push(p);
    const at = parts.length - 1;
    if (el && !p.pseudo) pseudoParts(el, p.kind === "section" ? at : p.parent, p.hidden, at);
    return at;
  };

  /* Hidden blocks wait until the page as it opens has been read. */
  const later: { el: Element; parent: number; template?: boolean }[] = [];
  const queue = (el: Element, parent: number) => { later.push({ el, parent, ...(el.tagName === "TEMPLATE" ? { template: true } : {}) }); };

  /* Words of a run of inline nodes, with what each stretch wore. A hidden element met on the way is kept for later. */
  const runsOf = (nodes: Node[], root: Element, pre: boolean, parent: number): PartRun[] => {
    const out: PartRun[] = [];
    /* A run says only how it differs from the block it is set in: a heading's own bold is the heading's. */
    const rs = css(root);
    const rootWeight = Number(rs.fontWeight) || 400;
    const mono = (f: string) => /mono|courier|consolas|menlo/i.test(f);
    const add = (text: string, from: Element) => {
      const s = css(from);
      const a = from.closest("a[href]");
      const run: PartRun = { text };
      const w = Number(s.fontWeight) || 400;
      if (w !== rootWeight) run.weight = w;
      if (s.fontStyle === "italic" && rs.fontStyle !== "italic") run.italic = true;
      if (mono(s.fontFamily) && !mono(rs.fontFamily)) run.mono = true;
      if (a && root.contains(a) && a !== root) run.href = a.getAttribute("href") ?? "";
      if (s.color !== rs.color) run.colour = s.color;
      /* A chip: the nearest element inside the run that paints a fill of its own. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        const u = css(up);
        if (!seeThrough(u.backgroundColor)) {
          run.bg = u.backgroundColor;
          const px = (v: string) => Math.round((parseFloat(v) || 0) * 100) / 100;
          const pad = [px(u.paddingTop), px(u.paddingRight), px(u.paddingBottom), px(u.paddingLeft)];
          if (pad.some((v) => v > 0)) run.pad = pad;
          if (px(u.borderTopLeftRadius) > 0) run.radius = px(u.borderTopLeftRadius);
          break;
        }
      }
      /* Room beside it in the line: the nearest element inside the run with a side margin. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        const u = css(up), l = Math.round((parseFloat(u.marginLeft) || 0) * 100) / 100, r = Math.round((parseFloat(u.marginRight) || 0) * 100) / 100;
        if (l || r) { run.space = [l, r]; break; }
      }
      /* The nearest element inside the run carrying an id or a data-* attribute: a live value the page's code writes into. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        if (hooked(up)) { run.hooks = hooksOf(up); break; }
      }
      const last = out[out.length - 1];
      const same = last && last.weight === run.weight && last.italic === run.italic && last.mono === run.mono && last.href === run.href && last.colour === run.colour && last.bg === run.bg && String(last.space) === String(run.space) && JSON.stringify(last.hooks ?? null) === JSON.stringify(run.hooks ?? null);
      if (same) last!.text += text; else out.push(run);
    };
    const visit = (n: Node, holder: Element) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const raw = n.textContent ?? "";
        const text = pre ? raw : raw.replace(/\s+/g, " ");
        if (text) add(text, holder);
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const e = n as Element;
      if (SKIP.has(e.tagName)) return;
      if (e.tagName === "BR") { add("\n", holder); return; }
      if (e.tagName === "TEMPLATE" || !shown(e) || folded(e)) { queue(e, parent); return; }
      /* An empty element with a hook is a place the page's code fills: it is kept, as a run with no words, so the hook travels. */
      if (hooked(e) && !(e.textContent ?? "").trim()) out.push({ text: "", hooks: hooksOf(e) });
      for (const c of Array.from(e.childNodes)) visit(c, e);
    };
    for (const n of nodes) visit(n, n.nodeType === Node.ELEMENT_NODE ? (n as Element) : (n.parentElement ?? root));
    /* One space where the page draws one, none at either end. */
    if (!pre) {
      for (let i = 0; i < out.length; i++) {
        if (i > 0 && /\s$/.test(out[i - 1]!.text) && out[i]!.text.startsWith(" ")) out[i]!.text = out[i]!.text.slice(1);
        out[i]!.text = out[i]!.text.replace(/ ?\n ?/g, "\n");
      }
      const first = out.find((r) => r.text);
      if (first) first.text = first.text.replace(/^\s+/, "");
      const lastRun = [...out].reverse().find((r) => r.text);
      if (lastRun) lastRun.text = lastRun.text.replace(/\s+$/, "");
    }
    return out.filter((r) => r.text || r.hooks);
  };
  const wordsOf = (runs: PartRun[]) => runs.map((r) => r.text).join("");
  const plainRuns = (runs: PartRun[]) => runs.every((r) => r.weight === undefined && !r.italic && !r.mono && !r.href && !r.hooks && !r.colour && !r.bg && !r.space);

  /* A link stands on its own when what is beside it is only separators: a bar of links, not a sentence with one in it. */
  const loneLinks = new Map<Element, boolean>();
  const linksStandAlone = (c: Element): boolean => {
    const had = loneLinks.get(c);
    if (had !== undefined) return had;
    const links = Array.from(c.querySelectorAll("a[href]"));
    let rest = "";
    const walk = (n: Node) => {
      if (n.nodeType === Node.TEXT_NODE) { rest += n.textContent ?? ""; return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const e = n as Element;
      if (SKIP.has(e.tagName) || links.includes(e)) return;
      for (const k of Array.from(e.childNodes)) walk(k);
    };
    walk(c);
    const alone = links.length > 0 && SEPARATORS.test(rest);
    loneLinks.set(c, alone);
    return alone;
  };
  /* Does this element hold anything that is a part of its own: a block, a control, a picture, a link standing alone? */
  const holdsParts = (el: Element): boolean => {
    if (el.tagName === "PRE") return false;
    if (linksStandAlone(el)) return true;
    for (const d of Array.from(el.querySelectorAll("*"))) {
      if (SKIP.has(d.tagName) || d.tagName === "BR") continue;
      if (isControl(d) || isMedia(d) || d.tagName === "TEMPLATE") return true;
      if (shown(d) && !inlineish(d)) return true;
    }
    return false;
  };

  const marker = (li: Element): string => {
    const t = css(li).listStyleType;
    if (!t || t === "none") return "";
    if (li.parentElement?.tagName === "OL") {
      const start = Number(li.parentElement.getAttribute("start")) || 1;
      return `${start + Array.from(li.parentElement.children).filter((c) => c.tagName === "LI").indexOf(li)}. `;
    }
    return t === "circle" ? "◦ " : t === "square" ? "▪ " : "• ";
  };

  const labelFor = (control: Element): string => {
    const wrap = control.closest("label");
    const from = wrap ?? (control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null);
    if (!from) return control.getAttribute("aria-label") ?? "";
    const copy = from.cloneNode(true) as Element;
    copy.querySelectorAll("input, select, textarea, button").forEach((x) => x.remove());
    return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  /* One control: a button, a field, a checkbox. */
  const control = (el: Element, parent: number, hidden: string | null) => {
    const tag = el.tagName;
    const r = el.getBoundingClientRect();
    /* What is hooked inside a control: a picture is a part of its own over it (PST's avatar buttons), anything else (a list's options, a button's words) is carried by the control. */
    const insideHooked = Array.from(el.querySelectorAll("[data-hook], [id]"));
    const inner = insideHooked.filter((d) => !isMedia(d) && !d.closest("svg")).map(hooksOf);
    const base = { tag: tag.toLowerCase(), parent, box: box(r), hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el), ...(inner.length ? { inner } : {}) };
    const after = () => { for (const d of insideHooked) if (isMedia(d) && !d.parentElement?.closest("svg")) picture(d, parent, hidden); };
    if (tag === "BUTTON" || el.getAttribute("role") === "button" || (tag === "INPUT" && /^(submit|button|reset|image)$/i.test((el as HTMLInputElement).type))) {
      const words = (tag === "INPUT" ? (el as HTMLInputElement).value : el.textContent ?? "").replace(/\s+/g, " ").trim();
      push({ ...base, kind: "button", words, control: { type: (el as HTMLButtonElement).type || "button", ...((el as HTMLButtonElement).disabled ? { disabled: true } : {}) } }, el);
      after();
      return;
    }
    if (isCheck(el)) {
      const i = el as HTMLInputElement;
      push({ ...base, kind: "check", words: labelFor(el), label: labelFor(el), control: { type: i.type, checked: i.checked, ...(i.disabled ? { disabled: true } : {}) } }, el);
      after();
      return;
    }
    const c: PartControl = { type: tag === "INPUT" ? (el as HTMLInputElement).type : tag.toLowerCase() };
    const f = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    if (tag === "SELECT") {
      c.options = Array.from(f.options).map((o) => ({ text: o.text.replace(/\s+/g, " ").trim(), value: o.value, selected: o.selected, ...(o.getAttribute("data-hook") ? { hook: o.getAttribute("data-hook")! } : {}) }));
      if (f.multiple) c.multiple = true;
      c.value = f.value;
    } else if (c.type !== "file" && c.type !== "password") c.value = f.value;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.disabled) c.disabled = true;
    if (tag === "TEXTAREA") c.rows = f.rows;
    const words = tag === "SELECT" ? (c.options?.find((o) => o.selected)?.text ?? "") : (c.value || c.placeholder || "");
    push({ ...base, kind: "field", words, label: labelFor(el), control: c }, el);
    after();
  };

  /* A label holding a checkbox is one part: the box and the words beside it. */
  const checkPart = (label: Element, parent: number, hidden: string | null) => {
    const input = Array.from(label.querySelectorAll("input")).find(isCheck) as HTMLInputElement;
    const words = labelFor(input);
    /* A label with a hook of its own (the kit's `newwallet-ack-label`) is a box round the checkbox, so both hooks are on the board. */
    let at = parent;
    if (hooked(label)) { const i = push({ kind: "section", tag: "label", parent, box: box(label.getBoundingClientRect()), words: "", hooks: hooksOf(label), hidden, selector: path(label), style: styleOf(label) }, label); if (i >= 0) at = i; }
    push({ kind: "check", tag: "label", parent: at, box: box(label.getBoundingClientRect()), words, label: words, control: { type: input.type, checked: input.checked, ...(input.disabled ? { disabled: true } : {}) }, hooks: hooked(label) ? hooksOf(input) : { ...hooksOf(label), ...hooksOf(input) }, hidden, selector: path(input), style: styleOf(label) }, input);
  };

  const picture = (el: Element, parent: number, hidden: string | null) => {
    const im = el as HTMLImageElement;
    const b = box(el.getBoundingClientRect());
    /* A picture with no file yet (its script sets one) draws as its alt text, 96x18 for a 96x96 avatar: the size it was given is its size. */
    const aw = Number(el.getAttribute("width")), ah = Number(el.getAttribute("height"));
    if (el.tagName === "IMG" && !im.naturalWidth && aw > 0 && ah > 0) { b.w = Math.round(aw); b.h = Math.round(ah); }
    const style = styleOf(el);
    /* Rounding written as a share of the box (border-radius: 50%) is a share of this box: a circle stays a circle. */
    const r = css(el).borderTopLeftRadius;
    if (/%$/.test(r)) style.radius = Math.round((parseFloat(r) / 100) * Math.min(b.w, b.h));
    /*
     * A CANVAS IS WHAT ITS CODE DREW. Read without its scripts, PST's chart
     * canvas is blank: as a picture with no file it drew the library's stand-in
     * landscape over the TV's screen, its still and its static. Blank, it is a
     * box with nothing of its own to paint; drawn, its pixels are its picture.
     */
    let drawn = "";
    if (el.tagName === "CANVAS") {
      try { const cv = el as HTMLCanvasElement, blank = document.createElement("canvas"); blank.width = cv.width; blank.height = cv.height; const u = cv.toDataURL(); if (u !== blank.toDataURL()) drawn = u; } catch { /* a canvas another origin drew into is not readable: blank to us */ }
      if (!drawn) { push({ kind: "shape", tag: "canvas", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style }, el); return; }
    }
    /*
     * AN INLINE SVG IS ITS OWN PICTURE. PST's title icons are inline svgs
     * filled with currentColor: with no file to point at, each came in as a
     * picture with nothing in it, drawn as the stand-in (71px tall, its alt
     * words over the heading) with its path as a solid block on top. Drawn
     * here as the browser drew it: a copy of the svg with every colour it
     * takes from the page (currentColor, the stylesheet's fill and stroke)
     * written on, as a data: picture of its own size.
     */
    const inline = el.tagName.toLowerCase() === "svg";
    const kept = new Set<Element>();
    if (inline && !drawn) {
      try {
        const copy = el.cloneNode(true) as SVGSVGElement;
        const from = [el, ...Array.from(el.querySelectorAll("*"))], to = [copy, ...Array.from(copy.querySelectorAll("*"))];
        from.forEach((s, i) => {
          const c = to[i] as SVGElement | undefined;
          if (!c || !/^(svg|g|path|circle|ellipse|rect|polygon|polyline|line|text|tspan|use)$/i.test(s.tagName)) return;
          const sc = css(s);
          /* A circle, an ellipse or a box with a hook is a part of its own (below), drawn there: not twice. */
          if (/^(circle|ellipse|rect)$/i.test(s.tagName) && (s.hasAttribute("data-hook") || s.hasAttribute("id"))) { kept.add(s); c.setAttribute("visibility", "hidden"); return; }
          c.setAttribute("style", `fill:${sc.fill};fill-opacity:${sc.fillOpacity};fill-rule:${sc.fillRule};stroke:${sc.stroke};stroke-width:${sc.strokeWidth};stroke-opacity:${sc.strokeOpacity};stroke-linecap:${sc.strokeLinecap};stroke-linejoin:${sc.strokeLinejoin};opacity:${sc.opacity};color:${sc.color}`);
        });
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.setAttribute("width", String(b.w));
        copy.setAttribute("height", String(b.h));
        drawn = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
      } catch { /* drawn as it was */ }
    }
    /*
     * A PICTURE ITS SCRIPT DREW IS KEPT. PonsStars' avatars and profile
     * picture are <img>s whose src its script writes (a data: SVG, or a file
     * of its own); read for their src attribute alone they came in as grey
     * stand-ins with their hook for words. A loaded <img> is kept as what it
     * shows: its data: address as it is, else read through a canvas (one
     * from another origin cannot be read, and stays a stand-in).
     */
    let shown: string | null = null;
    if (!inline && !drawn && el.tagName === "IMG" && im.complete && im.naturalWidth > 0) {
      const src = im.currentSrc || im.src || "";
      if (src.startsWith("data:")) shown = src;
      else {
        try {
          const k = Math.min(1, 256 / Math.max(im.naturalWidth, im.naturalHeight));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
          cv.getContext("2d")?.drawImage(im, 0, 0, cv.width, cv.height);
          shown = cv.toDataURL("image/webp", 0.85);
        } catch { /* another origin's picture: not readable here */ }
      }
    }
    const fit = css(el).objectFit;
    if (shown) {
      push({ kind: "shape", tag: "img", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style: { ...style, image: `url("${shown}")`, imageOptions: [fit === "cover" ? "cover" : fit === "contain" || fit === "scale-down" ? "contain" : "100% 100%", css(el).objectPosition || "50% 50%", "no-repeat"] } }, el);
      return;
    }
    /* Painted as the box's own picture, as a data: background is: no file to carry, nothing to stand in for. */
    const at = inline && drawn
      ? push({ kind: "shape", tag: "svg", parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), style: { ...style, image: `url("${drawn}")`, imageOptions: ["100% 100%", "0% 0%", "no-repeat"] } }, el)
      : push({ kind: "picture", tag: el.tagName.toLowerCase(), parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), src: drawn || im.currentSrc || im.getAttribute?.("src") || "", alt: im.getAttribute?.("alt") ?? el.getAttribute("aria-label") ?? "", style }, el);
    /*
     * AN INLINE SVG KEEPS ITS SHAPES' HOOKS. PST's duel is an svg holding two
     * circles its script resizes (duel-circle-me, duel-circle-opponent): each
     * shape inside that carries a hook is a part of its own under the picture,
     * at its own box, with its fill and its stroke, so the hook is on the
     * board and the style layer can recolour it.
     */
    if (el.tagName.toLowerCase() === "svg" && at >= 0) {
      for (const s of Array.from(el.querySelectorAll("[data-hook], [id]"))) {
        if (truncated) break;
        const sc = css(s);
        const sb = box(s.getBoundingClientRect());
        /* A path, a line or words inside a drawn svg are in its picture: the part keeps the hook and paints nothing over it. */
        const own = !drawn || kept.has(s);
        const fill = own && sc.fill && sc.fill !== "none" && !seeThrough(sc.fill) ? sc.fill : null;
        const stroke = own && sc.stroke && sc.stroke !== "none" && !seeThrough(sc.stroke) ? sc.stroke : null;
        const sw = parseFloat(sc.strokeWidth) || 0;
        const base = styleOf(s);
        push({
          kind: "shape", tag: s.tagName.toLowerCase(), parent: at, box: sb, words: (s.tagName.toLowerCase() === "text" ? s.textContent ?? "" : "").trim(), hooks: hooksOf(s), hidden, selector: path(s),
          style: { ...base, bg: fill, border: stroke && sw > 0 ? { w: Math.round(sw * 100) / 100, style: "solid", colour: stroke } : null, radius: /^(circle|ellipse)$/i.test(s.tagName) ? Math.round(Math.min(sb.w, sb.h) / 2) : 0, pad: [0, 0, 0, 0] },
        }, s);
      }
    }
  };

  const link = (a: Element, parent: number, hidden: string | null) => {
    const said = (a.textContent ?? "").replace(/\s+/g, " ").trim() || a.getAttribute("aria-label") || a.getAttribute("title") || "";
    push({ kind: "link", tag: "a", parent, box: box(a.getBoundingClientRect()), words: said, href: a.getAttribute("href") ?? "", hooks: hooksOf(a), hidden, selector: path(a), style: styleOf(a) }, a);
  };

  /* A run of inline words between the parts of a mixed block: one line of its own. */
  let lineNo = 0;
  const line = (nodes: Node[], holder: Element, parent: number, hidden: string | null) => {
    const runs = runsOf(nodes, holder, false, parent);
    const words = wordsOf(runs);
    const hooks = runs.find((r) => r.hooks)?.hooks;
    if (!words.trim() && !hooks) return;
    if (!hooks && SEPARATORS.test(words)) return;
    /*
     * The line's own nodes, not the stretch between its first and last: what
     * was taken out of the run sits in that stretch too, and a closed
     * <details>' folded text still has boxes there. PST's "?" help (its
     * summary, then the folded paragraph) read as 236x234 over the lines
     * under it (J, 2026-10-06).
     */
    const range = document.createRange();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) {
      if (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim()) continue;
      range.selectNode(n);
      for (const q of Array.from(range.getClientRects())) {
        if (q.width <= 0 || q.height <= 0) continue;
        x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
      }
    }
    if (x0 === Infinity) { range.setStartBefore(nodes[0]!); range.setEndAfter(nodes[nodes.length - 1]!); const a = range.getBoundingClientRect(); x0 = a.left; y0 = a.top; x1 = a.right; y1 = a.bottom; }
    const r = { left: x0, top: y0, width: x1 - x0, height: y1 - y0, right: x1, bottom: y1, x: x0, y: y0 } as DOMRect;
    /* Only empty places the code writes into: one empty place, with their hook. */
    if (!words.trim()) { push({ kind: "slot", tag: "span", parent, box: box(r), words: "", hooks: hooks!, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: styleOf(holder) }, undefined, holder); return; }
    push({ kind: "text", tag: "line", parent, box: box(r), words, ...(plainRuns(runs) ? {} : { runs }), hooks: {}, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: styleOf(holder) }, undefined, holder);
  };

  /* Inline content, with the parts among it taken out as they come. */
  const flow = (container: Element, parent: number, hidden: string | null) => {
    let buffer: Node[] = [];
    const flush = () => { if (buffer.length) line(buffer, container, parent, hidden); buffer = []; };
    const lone = linksStandAlone(container);
    for (const n of Array.from(container.childNodes)) {
      if (truncated) return;
      if (n.nodeType === Node.TEXT_NODE) { buffer.push(n); continue; }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const e = n as Element;
      if (SKIP.has(e.tagName)) continue;
      if (e.tagName === "BR") { buffer.push(e); continue; }
      if (e.tagName === "TEMPLATE" || !shown(e) || folded(e)) { queue(e, parent); continue; }
      if (isMedia(e)) { flush(); picture(e, parent, hidden); continue; }
      if (checkLabel(e)) { flush(); checkPart(e, parent, hidden); continue; }
      if (isControl(e)) { flush(); control(e, parent, hidden); continue; }
      if (e.tagName === "A" && e.hasAttribute("href") && lone) { flush(); link(e, parent, hidden); continue; }
      if (inlineish(e)) {
        if (!holdsParts(e) || e.tagName === "A") { buffer.push(e); continue; }
        /* An inline holder of parts (a label round a field): its words are a line, its controls parts; with a hook of its own, it is a box round them. */
        flush();
        let at = parent;
        if (hooked(e)) { const i = push({ kind: "section", tag: e.tagName.toLowerCase(), parent, box: box(e.getBoundingClientRect()), words: "", hooks: hooksOf(e), hidden, selector: path(e), style: styleOf(e) }, e); if (i >= 0) at = i; }
        flow(e, at, hidden);
        continue;
      }
      flush();
      block(e, parent, hidden);
    }
    flush();
  };

  /* A block: a part of its own when it is only words, else a section (or a plain wrapper) holding its parts. */
  const block = (el: Element, parent: number, hidden: string | null) => {
    if (truncated) return;
    const tag = el.tagName;
    if (!holdsParts(el)) {
      const pre = tag === "PRE" || /^pre/.test(css(el).whiteSpace);
      const runs = runsOf(Array.from(el.childNodes), el, pre, parent);
      const mark = tag === "LI" ? marker(el) : "";
      if (mark && runs.length) runs.unshift({ text: mark });
      const words = wordsOf(runs);
      if (!words.trim() && !hooked(el) && !runs.some((r) => r.hooks) && !paints(el)) return;
      /* Nothing in it yet: an empty place the page's code fills (a log, a message line, a list it builds), kept as an empty box with its hook. */
      const kind: PagePart["kind"] = !words.trim() ? "slot" : /^H[1-6]$/.test(tag) ? "heading" : tag === "PRE" ? "code" : "text";
      push({ kind, tag: tag.toLowerCase(), parent, box: box(el.getBoundingClientRect()), words, ...(plainRuns(runs) ? {} : { runs }), hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el) }, el);
      return;
    }
    const section = SECTIONING.has(tag) || hooked(el) || paints(el);
    let at = parent;
    if (section) {
      const i = push({ kind: "section", tag: tag.toLowerCase(), parent, box: box(el.getBoundingClientRect()), words: "", hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el) }, el);
      if (i >= 0) at = i;
    }
    flow(el, at, hidden);
  };

  /* A page whose body carries a hook (the kit's `page-contact`, PST's `app`) has it as the box everything sits in. */
  let top = -1;
  if (hooked(document.body)) top = push({ kind: "section", tag: "body", parent: -1, box: box(document.body.getBoundingClientRect()), words: "", hooks: hooksOf(document.body), hidden: null, selector: "body", style: styleOf(document.body) }, document.body);
  flow(document.body, top, null);

  /* Then what was hidden, each revealed where it stands, read, and hidden again. */
  let hiddenBlocks = 0;
  let templates = 0;
  for (let i = 0; i < later.length && !truncated && i < 400; i++) {
    const { el, parent, template } = later[i]!;
    const key = el.getAttribute("data-hook") || el.id || path(el);
    if (template) {
      templates++;
      const holder = document.createElement("div");
      holder.setAttribute("data-polio-template", "");
      holder.appendChild((el as HTMLTemplateElement).content.cloneNode(true));
      el.parentElement?.insertBefore(holder, el);
      if (shown(holder)) {
        /* The template itself, by its hook (the kit's `template-history-row`): the box its copy stands in, at the copy's path, so what is in it is owned by it. */
        let at = parent;
        if (hooked(el)) { const i = push({ kind: "section", tag: "template", parent, box: box(holder.getBoundingClientRect()), words: "", hooks: hooksOf(el), hidden: `template:${key}`, selector: path(holder), style: styleOf(holder) }); if (i >= 0) at = i; }
        flow(holder, at, `template:${key}`);
      }
      holder.remove();
      continue;
    }
    hiddenBlocks++;
    /* Revealed with whatever above it is hidden too, and every change put back. */
    const undo: (() => void)[] = [];
    for (let up: Element | null = el; up && up !== document.documentElement; up = up.parentElement) {
      const h = up as HTMLElement;
      if (h.tagName === "DETAILS" && !(h as HTMLDetailsElement).open && up !== el) { (h as HTMLDetailsElement).open = true; undo.push(() => { (h as HTMLDetailsElement).open = false; }); }
      if (shown(up)) continue;
      const hadHidden = h.hasAttribute("hidden");
      const hadStyle = h.getAttribute("style");
      if (hadHidden) h.removeAttribute("hidden");
      if (!shown(h)) h.style.setProperty("display", h.tagName === "TR" ? "table-row" : h.tagName === "TD" || h.tagName === "TH" ? "table-cell" : "block", "important");
      undo.push(() => { if (hadHidden) h.setAttribute("hidden", ""); if (hadStyle === null) h.removeAttribute("style"); else h.setAttribute("style", hadStyle); });
    }
    try {
      if (isMedia(el)) picture(el, parent, key);
      else if (checkLabel(el)) checkPart(el, parent, key);
      else if (isControl(el)) control(el, parent, key);
      else if (el.tagName === "A" && el.hasAttribute("href") && el.parentElement && linksStandAlone(el.parentElement)) link(el, parent, key);
      else block(el, parent, key);
    } finally {
      for (const u of undo.reverse()) u();
    }
  }

  /* How much of it the page's own styles reach: none, and the browser's defaults are its whole look. */
  const reached = new Set<Element>();
  let rules = 0;
  const reach = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      if (rules > 2000) return;
      if (r instanceof CSSStyleRule) {
        rules++;
        try { document.querySelectorAll(r.selectorText).forEach((e) => reached.add(e)); } catch { /* a selector this browser cannot run */ }
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) reach((r as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) { try { reach(sheet.cssRules); } catch { /* another origin's sheet */ } }
  document.querySelectorAll("[style]").forEach((e) => reached.add(e));
  const styledParts = parts.filter((p) => { try { const e = document.querySelector(p.selector.replace(/ ::line\(\d+\)$/, "").replace(/::(before|after)$/, "")); return !!e && reached.has(e); } catch { return false; } }).length;

  const bs = css(document.body);
  const hs = css(document.documentElement);
  const ground = !seeThrough(bs.backgroundColor) ? bs.backgroundColor : !seeThrough(hs.backgroundColor) ? hs.backgroundColor : "rgb(255, 255, 255)";
  let lowest = 0;
  for (const p of parts) if (!p.hidden) lowest = Math.max(lowest, p.box.y + p.box.h);
  /* The @keyframes the parts' animations name, each frame's declarations as the sheet wrote them. */
  const named = new Set(parts.flatMap((p) => (p.style.animation ?? []).map((a) => a.name)));
  const tokensOut = (v: string) => { for (let i = 0; i < 6 && v.includes("var("); i++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_, name: string, fb?: string) => hs.getPropertyValue(name).trim() || (fb ?? "").trim()); return v; };
  const keyframes: NonNullable<PageRead["keyframes"]> = [];
  const frameRules = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      if (r instanceof CSSKeyframesRule) {
        if (!named.has(r.name) || keyframes.some((k) => k.name === r.name) || keyframes.length >= 40) continue;
        /* With the page's tokens resolved: a board has no `--pons-tv-antenna-swing` to read, and a frame it cannot read turns the rod to nothing. */
        keyframes.push({ name: r.name, frames: Array.from(r.cssRules).slice(0, 40).map((f) => { const kf = f as CSSKeyframeRule; const style: Record<string, string> = {}; for (let i = 0; i < kf.style.length; i++) { const prop = kf.style[i]!; style[prop] = tokensOut(kf.style.getPropertyValue(prop)); } return { key: kf.keyText, style }; }) });
      } else if ("cssRules" in r && (r as CSSGroupingRule).cssRules) frameRules((r as CSSGroupingRule).cssRules);
    }
  };
  if (named.size) for (const sh of Array.from(document.styleSheets)) { try { frameRules(sh.cssRules); } catch { /* another origin's sheet */ } }
  /* Every turn put back as it was. */
  for (const { el, had } of lifted.reverse()) { if (had === null) el.removeAttribute("style"); else el.setAttribute("style", had); }
  return {
    title: document.title.trim(),
    width: innerWidth,
    height: Math.max(document.documentElement.scrollHeight, lowest),
    bg: ground,
    colour: bs.color,
    family: bs.fontFamily,
    px: parseFloat(bs.fontSize) || 16,
    styledParts,
    hiddenBlocks,
    templates,
    truncated,
    parts,
    ...(keyframes.length ? { keyframes } : {}),
  };
};
