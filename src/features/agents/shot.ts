"use client";
/**
 * A REAL PICTURE OF THE OPEN BOARD (INTERFACE-OPTIONS.md, section 3, card 4).
 *
 * The board is in J's browser and nothing else holds it, so the picture is made
 * there: the page window is copied with every element's computed style written on it,
 * pictures and faces are brought in as data, and the browser draws the copy in
 * an SVG `foreignObject` onto a canvas (as `builds/thumbs.tsx` does for a card).
 * Only the parts that reach the crop are copied, parts above it included, so the
 * picture of a covered part shows it covered, as J sees it.
 *
 * Nothing is sent anywhere: it goes back the way every site call does. What this
 * can't draw (a picture from a site that doesn't allow reading it, a WebGL
 * canvas, an embedded page) is named in `missing`, never passed off as drawn.
 */

/** How long the long side of a picture is, unless asked otherwise: about 850 tokens for a square one. */
export const SHOT_SIDE = 800;
export const SHOT_MAX_SIDE = 1600;
/** The helper takes a reply of 1 MB (`helper/server/server.ts#MAX_BODY`); this leaves room for the rest of it. */
export const SHOT_MAX_CHARS = 900_000;
const PICTURE_BUDGET = 16_000_000;
const FONT_BUDGET = 6_000_000;
/** How much copied style a shot may carry. Past it the rest is left out and named: a big copy can take the whole tab down, with J's board in it. */
const STYLE_BUDGET = 60_000_000;

export type Crop = { x: number; y: number; w: number; h: number };
export type Shot = { data: string; mime: string; width: number; height: number; crop: Crop; scale: number; missing: string[] };

const blobToData = (b: Blob): Promise<string> => new Promise((done, no) => { const r = new FileReader(); r.onload = () => done(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(b); });

/** What the copy can't take: a part being handled carries these on the board. */
const CHROME = "[data-resize], [data-board-chrome], script, style, noscript, link, template";

/** Every computed property, but those that would make the copy move or wait. Not the custom ones: what they gave is already in the computed values, and one holding a picture would be copied onto every element under it. */
function styleOf(el: Element, pseudo?: string): string {
  const c = getComputedStyle(el, pseudo);
  let out = "";
  for (let i = 0; i < c.length; i++) {
    const k = c[i]!;
    if (k.startsWith("--") || k.startsWith("animation") || k.startsWith("transition") || k === "content-visibility" || k === "contain-intrinsic-size" || k === "will-change" || k === "view-transition-name") continue;
    const v = c.getPropertyValue(k);
    if (v) out += `${k}:${v};`;
  }
  return out;
}

const URLS = /url\((["']?)(?!data:|#)([^"')]+)\1\)/g;

class Copier {
  readonly missing = new Set<string>();
  readonly rules: string[] = [];
  readonly faces = new Set<string>();
  readonly chars = new Set<string>();
  private seq = 0;
  private pictures = new Map<string, Promise<string | null>>();
  private budget = PICTURE_BUDGET;
  private waits: Promise<void>[] = [];
  private styleChars = 0;

  constructor(private readonly crop: Crop, private readonly frameRect: DOMRect, private readonly drawnScale: number) {}

  /** A picture as data, read once however often it is used. */
  private picture(src: string): Promise<string | null> {
    let p = this.pictures.get(src);
    if (!p) {
      p = (async () => {
        if (this.budget <= 0) { this.missing.add("pictures past the size a shot can carry"); return null; }
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error(String(res.status));
          const data = await blobToData(await res.blob());
          this.budget -= data.length;
          return data;
        } catch {
          this.missing.add("a picture this page isn't allowed to read");
          return null;
        }
      })();
      this.pictures.set(src, p);
    }
    return p;
  }

  private inlineUrls(style: string, write: (s: string) => void) {
    this.styleChars += style.length;
    const urls = [...style.matchAll(URLS)].map((m) => m[2]!);
    if (!urls.length) { write(style); return; }
    write(style);
    this.waits.push((async () => {
      const got = new Map(await Promise.all([...new Set(urls)].map(async (u) => [u, await this.picture(u)] as const)));
      const full = style.replace(URLS, (_all, _q, u: string) => { const d = got.get(u); return d ? `url("${d}")` : "none"; });
      this.styleChars += full.length - style.length;
      if (this.styleChars > STYLE_BUDGET) { this.missing.add("pictures past the size a shot can carry"); return; }
      write(full);
    })());
  }

  private reaches(el: Element): boolean {
    const r = el.getBoundingClientRect();
    const s = this.drawnScale, c = this.crop;
    const x = (r.left - this.frameRect.left) / s, y = (r.top - this.frameRect.top) / s;
    return x < c.x + c.w && x + r.width / s > c.x && y < c.y + c.h && y + r.height / s > c.y;
  }

  private special(el: Element): HTMLElement | null {
    if (el instanceof HTMLCanvasElement || el instanceof HTMLVideoElement) {
      const img = document.createElement("img");
      try {
        let c = el as HTMLCanvasElement;
        if (el instanceof HTMLVideoElement) { c = document.createElement("canvas"); c.width = el.videoWidth; c.height = el.videoHeight; c.getContext("2d")!.drawImage(el, 0, 0); }
        const url = c.toDataURL("image/png");
        const blank = document.createElement("canvas"); blank.width = c.width; blank.height = c.height;
        if (url === blank.toDataURL("image/png")) this.missing.add("a moving drawing that can't be read back");
        else img.src = url;
      } catch { this.missing.add("a moving picture this page isn't allowed to read"); }
      return img;
    }
    if (el instanceof HTMLIFrameElement || el.tagName === "OBJECT" || el.tagName === "EMBED") { this.missing.add("an embedded page"); return document.createElement("div"); }
    return null;
  }

  private pseudos(el: Element, copy: Element) {
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(el, pseudo).content;
      if (!content || content === "none" || content === "normal") continue;
      const cls = `pshot${++this.seq}`;
      copy.setAttribute("class", `${copy.getAttribute("class") ?? ""} ${cls}`.trim());
      const at = this.rules.length;
      this.rules.push("");
      this.inlineUrls(styleOf(el, pseudo), (s) => { this.rules[at] = `.${cls}${pseudo}{${s}}`; });
    }
  }

  copy(el: Element, isRoot = false): Node | null {
    if (el.matches(CHROME)) return null;
    if (el.hasAttribute("data-node-id") && !this.reaches(el)) return null;
    if (this.styleChars > STYLE_BUDGET) { this.missing.add("parts past the size a shot can carry"); return null; }
    const css = getComputedStyle(el);
    if (css.display === "none") return null;
    const copy = (this.special(el) ?? el.cloneNode(false)) as HTMLElement;
    /* The copy's own ids and handlers are nothing to it, and a loading picture would never arrive. */
    copy.removeAttribute("id");
    for (const f of css.fontFamily.split(",")) this.faces.add(f.trim().replace(/^['"]|['"]$/g, ""));
    if (copy instanceof HTMLImageElement && el instanceof HTMLImageElement) {
      copy.removeAttribute("srcset"); copy.removeAttribute("sizes"); copy.removeAttribute("loading");
      const src = el.currentSrc || el.src;
      if (src && !src.startsWith("data:")) { copy.removeAttribute("src"); this.waits.push(this.picture(src).then((d) => { if (d) copy.setAttribute("src", d); })); }
    }
    this.inlineUrls(styleOf(el), (s) => copy.setAttribute("style", s));
    this.pseudos(el, copy);
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) { for (const ch of child.textContent ?? "") this.chars.add(ch); copy.appendChild(child.cloneNode()); }
      else if (child.nodeType === Node.ELEMENT_NODE) { const c = this.copy(child as Element); if (c) copy.appendChild(c); }
    }
    if (isRoot) this.rootStyle(copy);
    return copy;
  }

  private rootStyle(copy: HTMLElement) {
    const write = copy.setAttribute.bind(copy);
    const c = this.crop;
    const place = `position:absolute;left:${-c.x}px;top:${-c.y}px;margin:0;transform:none;zoom:1;translate:none;scale:none;`;
    copy.setAttribute = (k: string, v: string) => write(k, k === "style" ? `${v}${place}` : v);
    copy.setAttribute("style", copy.getAttribute("style") ?? "");
  }

  async settled() { await Promise.all(this.waits); }
}

/** The faces in use, as data, from every sheet this page can read or fetch. */
async function fontRules(faces: ReadonlySet<string>, chars: ReadonlySet<string>, missing: Set<string>): Promise<string> {
  const texts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(sheet.cssRules)) if (r instanceof CSSFontFaceRule) texts.push(`${r.cssText}\n/*base:${sheet.href ?? location.href}*/`); }
    catch {
      if (!sheet.href) continue;
      try { const t = await (await fetch(sheet.href)).text(); for (const m of t.matchAll(/@font-face\s*{[^}]*}/g)) texts.push(`${m[0]}\n/*base:${sheet.href}*/`); }
      catch { missing.add("a font sheet this page isn't allowed to read"); }
    }
  }
  const codes = [...chars].map((c) => c.codePointAt(0)!);
  const inRange = (rule: string) => {
    const m = /unicode-range:\s*([^;}]+)/i.exec(rule);
    if (!m) return true;
    return m[1]!.split(",").some((part) => {
      const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
      if (a!.includes("?")) { const lo = parseInt(a!.replace(/\?/g, "0"), 16), hi = parseInt(a!.replace(/\?/g, "F"), 16); return codes.some((c) => c >= lo && c <= hi); }
      const lo = parseInt(a!, 16), hi = b ? parseInt(b, 16) : lo;
      return codes.some((c) => c >= lo && c <= hi);
    });
  };
  let budget = FONT_BUDGET;
  const out: string[] = [];
  await Promise.all(texts.map(async (text) => {
    const family = /font-family:\s*(['"]?)([^;'"}]+)\1/i.exec(text)?.[2]?.trim();
    if (!family || !faces.has(family) || !inRange(text)) return;
    const base = /\/\*base:(.*)\*\//.exec(text)?.[1] ?? location.href;
    const m = /url\((["']?)([^"')]+)\1\)(\s*format\([^)]*\))?/i.exec(text);
    if (!m) return;
    if (m[2]!.startsWith("data:")) { out.push(text); return; }
    try {
      const data = await blobToData(await (await fetch(new URL(m[2]!, base))).blob());
      if ((budget -= data.length) < 0) { missing.add(`the face ${family}, past the size a shot can carry`); return; }
      out.push(text.replace(/\/\*base:.*\*\//, "").replace(/src:[^;}]+/i, `src:url("${data}")${m[3] ?? ""}`));
    } catch { missing.add(`the face ${family}, which this page isn't allowed to read`); }
  }));
  return out.join("\n");
}

const b64Of = (url: string) => url.slice(url.indexOf(",") + 1);

/** The picture of `crop`, in the page's own pixels, its long side no more than `side`. */
export async function shootBoard(crop: Crop, side: number): Promise<Shot> {
  const frame = document.querySelector<HTMLElement>("[data-frame]");
  if (!frame) throw new Error("the board isn't drawn");
  const rect = frame.getBoundingClientRect();
  const page = frame.offsetWidth || rect.width;
  const copier = new Copier(crop, rect, rect.width / page);
  /* The frame is only the page's background: the parts are its siblings, in the page window, which starts where the frame does (`DesktopCanvas.tsx`). */
  const root = copier.copy(frame.closest("[data-page-window]") ?? frame, true) as HTMLElement | null;
  if (!root) throw new Error("the board isn't drawn");
  await copier.settled();
  const faces = await fontRules(copier.faces, copier.chars, copier.missing);
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrap.setAttribute("style", `position:relative;width:${crop.w}px;height:${crop.h}px;overflow:hidden;margin:0;`);
  const sheet = document.createElement("style");
  sheet.textContent = `${faces}\n${copier.rules.join("\n")}`;
  wrap.appendChild(sheet);
  wrap.appendChild(root);
  const xml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.w}" height="${crop.h}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  /* A small part is not blown up, and a big picture comes down until it fits the reply. */
  let scale = Math.min(1, side / Math.max(crop.w, crop.h));
  let quality = 0.85;
  for (;;) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(crop.w * scale)); c.height = Math.max(1, Math.round(crop.h * scale));
    const g = c.getContext("2d")!;
    g.scale(scale, scale);
    g.drawImage(img, 0, 0, crop.w, crop.h);
    const url = c.toDataURL("image/webp", quality);
    const data = b64Of(url);
    if (data.length <= SHOT_MAX_CHARS || scale < 0.1) {
      return { data, mime: url.slice(5, url.indexOf(";")), width: c.width, height: c.height, crop, scale, missing: [...copier.missing] };
    }
    if (quality > 0.6) quality -= 0.15; else scale *= 0.75;
  }
}
