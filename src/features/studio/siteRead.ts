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
  href?: string;
  /** The id and data-* attributes of the element these words sit in, so code can still find it. */
  hooks?: Record<string, string>;
}

/** How one element was set, as the browser computed it: the page's own rules, or the browser's defaults where it has none. */
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
  options?: { text: string; value: string; selected: boolean }[];
}

/** One element of the page, read on its own. */
export interface PagePart {
  kind: "section" | "slot" | "heading" | "text" | "code" | "button" | "link" | "field" | "check" | "picture";
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
  /** The same rules with the file and line they are written on (`sourceHooks.ts#withLines`). */
  css?: { file: string; line: number; selector: string }[];
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
  const SECTIONING = new Set(["SECTION", "ARTICLE", "ASIDE", "HEADER", "FOOTER", "MAIN", "NAV", "FORM", "FIELDSET", "DETAILS", "DIALOG", "UL", "OL", "DL", "TABLE", "FIGURE"]);
  const SEPARATORS = /^[\s|·•/\\,;:–—\-]*$/;
  const css = (e: Element) => getComputedStyle(e);
  const shown = (e: Element) => css(e).display !== "none";
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
  const styleOf = (e: Element): PartStyle => {
    const s = css(e);
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
    };
  };
  const paints = (e: Element) => { const s = styleOf(e); return !!s.bg || !!s.border; };
  /* The page's own rules, once: a linked sheet by the address its link wrote, a style block by its place among the page's style blocks. */
  let pageRules: { sheet: string | null; block: number; selector: string }[] | null = null;
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
  const push = (p: PagePart, el?: Element): number => {
    if (parts.length >= cap) { truncated = true; return -1; }
    if (el) {
      const rules = rulesFor(el);
      if (rules.length) p.rules = rules;
      const classes = Array.from(el.classList).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 8);
      if (classes.length) p.classes = classes;
    }
    parts.push(p);
    return parts.length - 1;
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
      /* The nearest element inside the run carrying an id or a data-* attribute: a live value the page's code writes into. */
      for (let up: Element | null = from; up && up !== root; up = up.parentElement) {
        if (hooked(up)) { run.hooks = hooksOf(up); break; }
      }
      const last = out[out.length - 1];
      const same = last && last.weight === run.weight && last.italic === run.italic && last.mono === run.mono && last.href === run.href && JSON.stringify(last.hooks ?? null) === JSON.stringify(run.hooks ?? null);
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
      if (e.tagName === "TEMPLATE" || !shown(e)) { queue(e, parent); return; }
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
  const plainRuns = (runs: PartRun[]) => runs.every((r) => r.weight === undefined && !r.italic && !r.mono && !r.href && !r.hooks);

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
      if (isControl(d) || MEDIA.has(d.tagName) || d.tagName === "TEMPLATE") return true;
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
    const base = { tag: tag.toLowerCase(), parent, box: box(r), hooks: hooksOf(el), hidden, selector: path(el), style: styleOf(el) };
    if (tag === "BUTTON" || el.getAttribute("role") === "button" || (tag === "INPUT" && /^(submit|button|reset|image)$/i.test((el as HTMLInputElement).type))) {
      const words = (tag === "INPUT" ? (el as HTMLInputElement).value : el.textContent ?? "").replace(/\s+/g, " ").trim();
      push({ ...base, kind: "button", words, control: { type: (el as HTMLButtonElement).type || "button", ...((el as HTMLButtonElement).disabled ? { disabled: true } : {}) } }, el);
      return;
    }
    if (isCheck(el)) {
      const i = el as HTMLInputElement;
      push({ ...base, kind: "check", words: labelFor(el), label: labelFor(el), control: { type: i.type, checked: i.checked, ...(i.disabled ? { disabled: true } : {}) } }, el);
      return;
    }
    const c: PartControl = { type: tag === "INPUT" ? (el as HTMLInputElement).type : tag.toLowerCase() };
    const f = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
    if (tag === "SELECT") {
      c.options = Array.from(f.options).map((o) => ({ text: o.text.replace(/\s+/g, " ").trim(), value: o.value, selected: o.selected }));
      if (f.multiple) c.multiple = true;
      c.value = f.value;
    } else if (c.type !== "file" && c.type !== "password") c.value = f.value;
    if (f.placeholder) c.placeholder = f.placeholder;
    if (f.disabled) c.disabled = true;
    if (tag === "TEXTAREA") c.rows = f.rows;
    const words = tag === "SELECT" ? (c.options?.find((o) => o.selected)?.text ?? "") : (c.value || c.placeholder || "");
    push({ ...base, kind: "field", words, label: labelFor(el), control: c }, el);
  };

  /* A label holding a checkbox is one part: the box and the words beside it. */
  const checkPart = (label: Element, parent: number, hidden: string | null) => {
    const input = Array.from(label.querySelectorAll("input")).find(isCheck) as HTMLInputElement;
    const words = labelFor(input);
    push({ kind: "check", tag: "label", parent, box: box(label.getBoundingClientRect()), words, label: words, control: { type: input.type, checked: input.checked, ...(input.disabled ? { disabled: true } : {}) }, hooks: { ...hooksOf(label), ...hooksOf(input) }, hidden, selector: path(input), style: styleOf(label) }, input);
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
    push({ kind: "picture", tag: el.tagName.toLowerCase(), parent, box: b, words: "", hooks: hooksOf(el), hidden, selector: path(el), src: im.currentSrc || im.getAttribute?.("src") || "", alt: im.getAttribute?.("alt") ?? el.getAttribute("aria-label") ?? "", style }, el);
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
    const range = document.createRange();
    range.setStartBefore(nodes[0]!);
    range.setEndAfter(nodes[nodes.length - 1]!);
    const r = range.getBoundingClientRect();
    /* Only empty places the code writes into: one empty place, with their hook. */
    if (!words.trim()) { push({ kind: "slot", tag: "span", parent, box: box(r), words: "", hooks: hooks!, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: styleOf(holder) }); return; }
    push({ kind: "text", tag: "line", parent, box: box(r), words, ...(plainRuns(runs) ? {} : { runs }), hooks: {}, hidden, selector: `${path(holder)} ::line(${++lineNo})`, style: styleOf(holder) });
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
      if (e.tagName === "TEMPLATE" || !shown(e)) { queue(e, parent); continue; }
      if (MEDIA.has(e.tagName)) { flush(); picture(e, parent, hidden); continue; }
      if (checkLabel(e)) { flush(); checkPart(e, parent, hidden); continue; }
      if (isControl(e)) { flush(); control(e, parent, hidden); continue; }
      if (e.tagName === "A" && e.hasAttribute("href") && lone) { flush(); link(e, parent, hidden); continue; }
      if (inlineish(e)) {
        if (!holdsParts(e) || e.tagName === "A") { buffer.push(e); continue; }
        /* An inline holder of parts (a label round a field): its words are a line, its controls parts. */
        flush();
        flow(e, parent, hidden);
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

  flow(document.body, -1, null);

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
      if (shown(holder)) flow(holder, parent, `template:${key}`);
      holder.remove();
      continue;
    }
    hiddenBlocks++;
    /* Revealed with whatever above it is hidden too, and every change put back. */
    const undo: (() => void)[] = [];
    for (let up: Element | null = el; up && up !== document.documentElement; up = up.parentElement) {
      if (shown(up)) continue;
      const h = up as HTMLElement;
      const hadHidden = h.hasAttribute("hidden");
      const hadStyle = h.getAttribute("style");
      if (hadHidden) h.removeAttribute("hidden");
      if (!shown(h)) h.style.setProperty("display", h.tagName === "TR" ? "table-row" : h.tagName === "TD" || h.tagName === "TH" ? "table-cell" : "block", "important");
      undo.push(() => { if (hadHidden) h.setAttribute("hidden", ""); if (hadStyle === null) h.removeAttribute("style"); else h.setAttribute("style", hadStyle); });
    }
    try {
      if (MEDIA.has(el.tagName)) picture(el, parent, key);
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
  const styledParts = parts.filter((p) => { try { const e = document.querySelector(p.selector.replace(/ ::line\(\d+\)$/, "")); return !!e && reached.has(e); } catch { return false; } }).length;

  const bs = css(document.body);
  const hs = css(document.documentElement);
  const ground = !seeThrough(bs.backgroundColor) ? bs.backgroundColor : !seeThrough(hs.backgroundColor) ? hs.backgroundColor : "rgb(255, 255, 255)";
  let lowest = 0;
  for (const p of parts) if (!p.hidden) lowest = Math.max(lowest, p.box.y + p.box.h);
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
  };
};
