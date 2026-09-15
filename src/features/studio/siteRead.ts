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
  const pictureOf = (bg: string) => (/url\(/.test(bg) ? (bg.match(/url\(["']?([^"')]+)/) ?? [])[1] : undefined);
  const ground = pictureOf(style.backgroundImage);
  if (ground) images.unshift({ src: new URL(ground, location.href).toString(), w: Math.round(box.width), h: Math.round(box.height), alt: "", ground: true } as never);
  /* What is behind it. A block that paints nothing of its own sits on
     whatever is painted up the page from it, the body included, and that
     is most of what a page looks like: the koi and the bamboo were on the
     body, and every block read as painted on nothing. The nearest painted
     colour and the nearest picture behind, each found separately. */
  const seeThrough = (c: string) => { const m = /rgba?\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+(?:[,/\s]+([\d.]+))?/i.exec(c); return !m || (m[1] !== undefined && Number(m[1]) < 0.05); };
  let behind: string | null = null;
  let behindPicture: string | undefined;
  for (let up = el.parentElement; up; up = up.parentElement) {
    const us = getComputedStyle(up);
    if (behind === null && !seeThrough(us.backgroundColor)) behind = us.backgroundColor;
    if (!behindPicture) behindPicture = pictureOf(us.backgroundImage);
    if (behind !== null && behindPicture) break;
  }
  if (!ground && behindPicture) images.push({ src: new URL(behindPicture, location.href).toString(), w: Math.round(box.width), h: Math.round(box.height), alt: "", ground: true, behind: true } as never);

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
      bg: style.backgroundColor,
      text: style.color,
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
      leading: Math.round(parseFloat(style.lineHeight) || 0),
    },
    layout: { flow, columns, gap },
    children,
  };
};
