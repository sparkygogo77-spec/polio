

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
