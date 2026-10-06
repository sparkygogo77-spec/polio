

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
