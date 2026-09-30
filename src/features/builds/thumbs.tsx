"use client";
/**
 * A SITE'S CARD IS A PICTURE, MADE ONCE.
 *
 * Every Builds card drew its whole site live (`SitePreview`), every part of
 * every page's first screen and below it: with the owner's sites that was
 * 30,890 page elements and 470 keyboard stops on one page, Parasite's
 * Connect and Trade buttons and TrendTrader's cookie buttons among them. A
 * card is a thumbnail, and a thumbnail is one image.
 *
 * So each site is drawn once, off screen and inert, down to the fold the
 * card shows; that drawing is turned into a small WebP (the markup and the
 * page's own styles laid into an SVG `foreignObject`, drawn onto a canvas,
 * pictures read out of this browser as data first, since an SVG image loads
 * nothing of its own), and the drawing is taken down. The picture is kept in
 * IndexedDB beside a signature of the document it was made from, so it is
 * made again only when the site changes. The live render is still one press
 * away, on the card's Preview.
 *
 * One at a time, in a queue, so a page of twenty cards never draws twenty
 * sites at once.
 */
import * as React from "react";
import { SitePreview, type PreviewDoc } from "@/features/studio/SitePreview";

const DB = "builder.thumbs";
const SHELF = "thumbs";
/** The width a picture is made at: a card is about 360 px wide, drawn at twice that for sharp screens. */
export const THUMB_W = 360;
export const THUMB_H = 168;
const SCALE = 2;

export interface Thumb { sig: string; url: string }

const ok = () => typeof indexedDB !== "undefined";
function shelf(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((done, no) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF); };
    req.onerror = () => no(req.error ?? new Error("No picture storage in this browser."));
    req.onsuccess = () => { try { done(req.result.transaction(SHELF, mode).objectStore(SHELF)); } catch (err) { no(err); } };
  });
}
const ask = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });

export async function readThumb(id: string): Promise<Thumb | null> {
  if (!ok()) return null;
  try { const v = (await ask((await shelf("readonly")).get(id))) as Thumb | undefined; return v && typeof v.url === "string" ? v : null; } catch { return null; }
}
async function keepThumb(id: string, t: Thumb): Promise<void> {
  if (!ok()) return;
  try { await ask((await shelf("readwrite")).put(t, id)); } catch { /* not kept: made again next time */ }
}

/**
 * What the picture was made from, cheaply: the document's size and a hash of
 * an even sample of it. A site that changes gets a new picture; one that
 * does not keeps the one it has.
 */
export function signatureOf(doc: PreviewDoc | null): string {
  if (!doc) return "none";
  const text = JSON.stringify({ p: doc.pages, n: doc.nodes, f: doc.format, l: doc.look, a: doc.activePageId, w: doc.frameWidth });
  let h = 2166136261;
  const step = Math.max(1, Math.floor(text.length / 40_000));
  for (let i = 0; i < text.length; i += step) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

/* ------------------------------------------------------------ the snapshot */

const blobToData = (b: Blob): Promise<string> => new Promise((done, no) => { const r = new FileReader(); r.onload = () => done(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(b); });

/** A picture as data, drawn no bigger than it is shown: a 4000 px capture on a card the size of a stamp is a waste of bytes. */
async function pictureData(src: string, w: number, h: number): Promise<string | null> {
  if (!src || src.startsWith("data:")) return src || null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (/svg/.test(blob.type) || !w || !h) return await blobToData(blob);
    const bmp = await createImageBitmap(blob);
    const cw = Math.max(1, Math.min(bmp.width, Math.round(w * SCALE)));
    const ch = Math.max(1, Math.round(cw * (bmp.height / bmp.width)));
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    c.getContext("2d")!.drawImage(bmp, 0, 0, cw, ch);
    bmp.close();
    return c.toDataURL("image/webp", 0.8);
  } catch {
    return null;
  }
}

/** The page's own styles, as text, with `:root` and `html` pointed at the picture's own root so its colours and variables come along. */
function styleText(): string {
  let out = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try { for (const r of Array.from(sheet.cssRules)) { if (r instanceof CSSFontFaceRule) continue; out += `${r.cssText}\n`; } } catch { /* another origin's sheet: its rules cannot be read */ }
  }
  return out.replace(/:root\b/g, ".thumb-root").replace(/(^|[\s,}])html(?=[\s.[:{,])/g, "$1.thumb-root");
}

/**
 * Turn a drawn element into a small WebP, or null when this browser will
 * not (no canvas, a picture from another origin that taints it).
 */
export async function snapshot(el: HTMLElement, w = THUMB_W, h = THUMB_H): Promise<string | null> {
  const clone = el.cloneNode(true) as HTMLElement;
  /* What cannot be drawn into a picture is taken out: a moving thing is a still here. */
  for (const n of Array.from(clone.querySelectorAll("canvas, video, iframe, script, audio, object, embed"))) n.remove();
  const liveImgs = Array.from(el.querySelectorAll("img"));
  const cloneImgs = Array.from(clone.querySelectorAll("img"));
  let budget = 8_000_000;
  await Promise.all(liveImgs.map(async (img, i) => {
    const c = cloneImgs[i];
    if (!c) return;
    const r = img.getBoundingClientRect();
    const d = budget > 0 ? await pictureData(img.currentSrc || img.src, r.width, r.height) : null;
    c.removeAttribute("srcset");
    c.removeAttribute("loading");
    if (d) { budget -= d.length; c.setAttribute("src", d); } else c.removeAttribute("src");
  }));
  /* Pictures behind a part, in its own style. */
  const withBg = Array.from(clone.querySelectorAll<HTMLElement>("[style*='url(']"));
  await Promise.all(withBg.map(async (n) => {
    const bg = n.style.backgroundImage;
    const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
    if (!m || m[1]!.startsWith("data:") || m[1]!.startsWith("#")) return;
    const d = budget > 0 ? await pictureData(m[1]!, 0, 0) : null;
    if (d) { budget -= d.length; n.style.backgroundImage = bg.replace(m[0], `url("${d}")`); } else n.style.backgroundImage = "none";
  }));
  const root = document.documentElement;
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrap.className = `thumb-root ${root.className}`;
  for (const a of Array.from(root.attributes)) if (a.name.startsWith("data-")) wrap.setAttribute(a.name, a.value);
  wrap.setAttribute("style", `width:${w}px;height:${h}px;overflow:hidden;margin:0;`);
  const style = document.createElement("style");
  style.textContent = styleText();
  wrap.appendChild(style);
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;
  wrap.appendChild(clone);
  const xml = new XMLSerializer().serializeToString(wrap);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject x="0" y="0" width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try { await img.decode(); } catch { return null; }
  const c = document.createElement("canvas");
  c.width = w * SCALE; c.height = h * SCALE;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(SCALE, SCALE);
  g.drawImage(img, 0, 0, w, h);
  try { return c.toDataURL("image/webp", 0.82); } catch { return null; }
}

/* ------------------------------------------------------------ the queue */

type Job = { id: string; sig: string; doc: PreviewDoc; done: (t: Thumb | null) => void };
const queue: Job[] = [];
const waiting = new Map<string, Promise<Thumb | null>>();
let wake: (() => void) | null = null;

/** Ask for a site's picture: the kept one when it is current, else one made in the queue. */
export function thumbFor(id: string, doc: PreviewDoc | null): Promise<Thumb | null> {
  const sig = signatureOf(doc);
  const key = `${id}:${sig}`;
  const was = waiting.get(key);
  if (was) return was;
  const p = readThumb(id).then((kept) => {
    if (kept && kept.sig === sig) return kept;
    if (!doc || !doc.pages?.length) return null;
    return new Promise<Thumb | null>((done) => { queue.push({ id, sig, doc, done }); wake?.(); });
  });
  waiting.set(key, p);
  void p.finally(() => { window.setTimeout(() => waiting.delete(key), 0); });
  return p;
}

/**
 * Where the pictures are drawn: one site at a time, off screen, inert and
 * hidden from assistive technology, taken down as soon as it is a picture.
 * Mounted once, by the Builds page.
 */
export function ThumbMaker() {
  const [job, setJob] = React.useState<Job | null>(null);
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const next = () => setJob((j) => j ?? queue.shift() ?? null);
    wake = next;
    next();
    return () => { if (wake === next) wake = null; };
  }, []);
  React.useEffect(() => {
    if (!job) return;
    let alive = true;
    (async () => {
      /* Two frames for the parts to lay out, then the pictures in it to arrive, at most a few seconds. */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const imgs = Array.from(box.current?.querySelectorAll("img") ?? []);
      await Promise.race([Promise.all(imgs.map((i) => (i.complete ? null : i.decode().catch(() => null)))), new Promise((r) => setTimeout(r, 4000))]);
      const el = box.current?.firstElementChild as HTMLElement | null;
      const url = el ? await snapshot(el).catch(() => null) : null;
      const t = url ? { sig: job.sig, url } : null;
      if (t) await keepThumb(job.id, t);
      job.done(t);
      if (alive) setJob(queue.shift() ?? null);
    })();
    return () => { alive = false; };
  }, [job]);
  if (!job) return null;
  return (
    <div ref={box} aria-hidden inert data-thumb-maker="" style={{ position: "fixed", left: -10_000, top: 0, width: THUMB_W, height: THUMB_H, overflow: "hidden", pointerEvents: "none", contain: "strict" }}>
      <SitePreview doc={job.doc} width={THUMB_W} height={THUMB_H} fold />
    </div>
  );
}

/** A site's card picture: one image, never focusable, made or read from the queue. */
export function SiteThumb({ id, doc, backdrop }: { id: string; doc: PreviewDoc | null; backdrop?: string }) {
  const [thumb, setThumb] = React.useState<Thumb | null | undefined>(undefined);
  const sig = React.useMemo(() => signatureOf(doc), [doc]);
  React.useEffect(() => {
    let alive = true;
    setThumb((t) => (t && t.sig === sig ? t : undefined));
    void thumbFor(id, doc).then((t) => { if (alive) setThumb(t); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sig]);
  if (!doc || !doc.pages?.length) {
    return <div className="grid size-full place-items-center rounded-[5px] border border-dashed border-border bg-elevated/40 text-small text-fg-faint">nothing on it yet</div>;
  }
  if (thumb) return <img data-site-thumb="" src={thumb.url} alt="" draggable={false} className="block size-full select-none object-cover object-top" />;
  return (
    <div data-site-thumb-wait="" className="grid size-full place-items-center text-small text-fg-faint" style={{ background: backdrop }}>
      {thumb === null ? "no picture of it yet" : "drawing a picture…"}
    </div>
  );
}
