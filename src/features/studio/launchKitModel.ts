"use client";
/**
 * THE LAUNCH KIT: the pictures a site needs the day it goes out, from its own style.
 *
 *   share card    1200 by 630, the picture shown when a link to the site is
 *                 posted (Open Graph and X's large card)
 *   X banner      1500 by 500, the header of the site's X profile, with the
 *                 bottom left kept clear for the profile picture
 *   site icon     16, 32, 48, 180 (Apple touch), 192 and 512 pixels
 *   memes         three templates with captions to type: top and bottom,
 *                 them and us, and an announcement
 *
 * Every one is drawn here, on a canvas, from what the site already is: its
 * colours (`resolvePalette`), its faces (the face its biggest words are set
 * in, and the one most of its words are in, else the Format panel's heading
 * and body fonts; faces the capture carried are loaded first), its name and
 * its line (`brief`), and its logo (`siteLogo`, the picture the bar's mark
 * already uses). Nothing is invented and nothing is asked of a server.
 *
 * "Use on the published page" keeps the share card and the icons as the
 * site's pictures and writes them into the site's link preview
 * (`brief.head.image`, `brief.head.icons`), which the export already turns
 * into `og:image`, `twitter:image` and the icon links, and the publish
 * already carries up as files. `tests/launch-kit.mjs`.
 */
import { bytesFor, put, type Picture } from "./pictures";
import { siteLogo } from "./siteMark";
import { resolvePalette, themeFrom } from "./shelf/run";
import { faceOf, tallyFonts } from "./look";
import { fontFaceCss } from "./look";
import { LARGE, type HeadIcon, type SiteHead } from "./siteHead";
import { useStudio } from "./board/store";

export const ICON_SIZES = [16, 32, 48, 180, 192, 512] as const;

export interface KitStyle {
  name: string;
  line: string;
  bg: string; surface: string; text: string; muted: string; accent: string; highlight: string;
  heading: string;
  body: string;
  logo: ImageBitmap | null;
  /** Where the site is live, for the card's foot. */
  host: string | null;
}

export interface KitItem {
  id: string;
  group: "share" | "banner" | "icon" | "meme";
  label: string;
  w: number;
  h: number;
  blob: Blob;
  file: string;
}

export interface MemeWords { top: string; bottom: string; them: string; us: string; news: string }
export const MEME_DEFAULTS: MemeWords = { top: "WHEN THE SITE GOES LIVE", bottom: "AND IT ACTUALLY WORKS", them: "Everyone else", us: "Us", news: "Big news" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
/** A face name as canvas wants it: the first family of a stack, quoted. */
const first = (stack: string) => stack.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");
const cssFace = (stack: string) => stack.split(",").map((f) => { const t = f.trim(); return /^['"]/.test(t) || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+)$/.test(t) ? t : `"${t}"`; }).join(", ");

/* ------------------------------------------------------------------ */
/* The site's style                                                     */
/* ------------------------------------------------------------------ */

/** Load the faces the capture carried, once, so a canvas can draw in them. */
function carryFaces(fonts: Parameters<typeof fontFaceCss>[0] | undefined) {
  if (!fonts?.length || typeof document === "undefined") return;
  const id = "launch-kit-faces";
  const css = fontFaceCss(fonts);
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
}

/** Wait for a face to be ready, within a moment: a face that never comes is drawn in the fallback. */
async function ready(stack: string, weight: number) {
  try { await Promise.race([document.fonts.load(`${weight} 48px ${cssFace(stack)}`, "Aa"), new Promise((r) => setTimeout(r, 2500))]); } catch { /* the fallback, then */ }
}

/** The site's style, read off the board now. */
export async function readStyle(): Promise<KitStyle> {
  const s = useStudio.getState();
  const palette = resolvePalette(s.format, s.look);
  const theme = themeFrom(s.format, s.look, s.brief.name);
  carryFaces(s.look?.fonts);
  /* The face the biggest words are set in is the heading face; the one most words are in is the body's. */
  const sized = s.nodes.filter((n) => n.font && faceOf(n as never)).sort((a, b) => (b.font?.size ?? 0) - (a.font?.size ?? 0));
  const tally = tallyFonts(s.nodes as never).filter((f) => f.key);
  const heading = sized[0] ? faceOf(sized[0] as never) : first(theme.headingFamily) ? theme.headingFamily : "sans-serif";
  const body = tally[0]?.key ?? theme.bodyFamily ?? "sans-serif";
  await Promise.all([ready(heading, 800), ready(body, 400)]);
  /* The site's own picture first; a captured icon only when the site shows none. */
  const pic = siteLogo(s.nodes as never) ?? s.brief.head?.icons?.find((i) => /icon/.test(i.rel))?.picture ?? null;
  let logo: ImageBitmap | null = null;
  if (pic) { try { const blob = await bytesFor(pic); if (blob) logo = await createImageBitmap(blob); } catch { logo = null; } }
  const headline = s.nodes.filter((n) => typeof n.content === "string" && n.content.trim()).sort((a, b) => (b.font?.size ?? 0) - (a.font?.size ?? 0) || a.y - b.y)[0];
  const line = s.brief.description?.trim() || (typeof headline?.content === "string" && headline.content.trim() !== s.brief.name.trim() ? headline.content.trim() : "") || "";
  const live = (await import("@/features/builds/store")).activeProject()?.live?.url ?? null;
  return {
    name: s.brief.name.trim() || "This site",
    line: line.slice(0, 140),
    bg: palette.bg, surface: palette.surface, text: palette.text, muted: palette.muted, accent: palette.accent, highlight: palette.highlight,
    heading, body, logo,
    host: live ? live.replace(/^https?:\/\//, "").replace(/\/$/, "") : null,
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  return { c, g };
}
const png = (c: HTMLCanvasElement) => new Promise<Blob>((done, no) => c.toBlob((b) => (b ? done(b) : no(new Error("The picture could not be made."))), "image/png"));

/** The largest size, up to `max`, at which `text` fits `width` on `lines` lines; and the lines. */
function fit(g: CanvasRenderingContext2D, text: string, face: string, weight: number, width: number, max: number, lines = 2, min = 12): { size: number; rows: string[] } {
  for (let size = max; size >= min; size -= 2) {
    g.font = `${weight} ${size}px ${cssFace(face)}`;
    const rows: string[] = [];
    let row = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const next = row ? `${row} ${word}` : word;
      if (g.measureText(next).width <= width) row = next;
      else { if (row) rows.push(row); row = word; }
    }
    if (row) rows.push(row);
    if (rows.length <= lines && rows.every((r) => g.measureText(r).width <= width)) return { size, rows };
  }
  g.font = `${weight} ${min}px ${cssFace(face)}`;
  return { size: min, rows: [text] };
}

function ground(g: CanvasRenderingContext2D, w: number, h: number, st: KitStyle, glowAt: [number, number]) {
  g.fillStyle = st.bg;
  g.fillRect(0, 0, w, h);
  const r = Math.max(w, h) * 0.75;
  const glow = g.createRadialGradient(glowAt[0], glowAt[1], 0, glowAt[0], glowAt[1], r);
  glow.addColorStop(0, withAlpha(st.accent, 0.38));
  glow.addColorStop(1, withAlpha(st.accent, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
}

/** A colour at a strength, whatever the site wrote it as. */
function withAlpha(colour: string, a: number): string {
  const { g } = canvas(1, 1);
  g.fillStyle = colour;
  g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${gg},${b},${a})`;
}

/** The logo, or the name's first letter in the accent, in a square. */
function mark(g: CanvasRenderingContext2D, st: KitStyle, x: number, y: number, size: number, round = 0.22) {
  g.save();
  g.beginPath();
  g.roundRect(x, y, size, size, size * round);
  g.clip();
  g.fillStyle = st.surface;
  g.fillRect(x, y, size, size);
  if (st.logo) {
    const k = Math.min(size / st.logo.width, size / st.logo.height);
    const lw = st.logo.width * k, lh = st.logo.height * k;
    g.drawImage(st.logo, x + (size - lw) / 2, y + (size - lh) / 2, lw, lh);
  } else {
    g.fillStyle = st.accent;
    g.fillRect(x, y, size, size);
    g.fillStyle = st.bg;
    g.font = `800 ${Math.round(size * 0.62)}px ${cssFace(st.heading)}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText([...st.name][0]?.toUpperCase() ?? "S", x + size / 2, y + size / 2 + size * 0.04);
  }
  g.restore();
}

function words(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, size: number, lead = 1.12, align: CanvasTextAlign = "left") {
  g.textAlign = align;
  g.textBaseline = "top";
  rows.forEach((r, i) => g.fillText(r, x, y + i * size * lead));
}

async function shareCard(st: KitStyle): Promise<KitItem> {
  const W = 1200, H = 630;
  const { c, g } = canvas(W, H);
  ground(g, W, H, st, [W * 0.9, H * 0.1]);
  mark(g, st, 80, 80, 150);
  g.fillStyle = st.text;
  const name = fit(g, st.name, st.heading, 800, W - 160, 112, 2, 40);
  words(g, name.rows, 80, 270, name.size, 1.04);
  if (st.line) {
    g.fillStyle = st.muted;
    const line = fit(g, st.line, st.body, 400, W - 160, 38, 2, 22);
    words(g, line.rows, 80, 270 + name.rows.length * name.size * 1.04 + 22, line.size, 1.3);
  }
  g.fillStyle = st.accent;
  g.fillRect(0, H - 14, W, 14);
  if (st.host) {
    g.fillStyle = st.accent;
    g.font = `600 28px ${cssFace(st.body)}`;
    g.textAlign = "right";
    g.textBaseline = "bottom";
    g.fillText(st.host, W - 80, H - 44);
  }
  return { id: "share", group: "share", label: "Share card", w: W, h: H, blob: await png(c), file: `${slug(st.name)}-share-card-${W}x${H}.png` };
}

async function banner(st: KitStyle): Promise<KitItem> {
  const W = 1500, H = 500;
  const { c, g } = canvas(W, H);
  ground(g, W, H, st, [W * 0.75, H * 0.5]);
  /* X lays the profile picture over the bottom left: the words stay right of it. */
  const left = 520;
  g.fillStyle = st.text;
  const name = fit(g, st.name, st.heading, 800, W - left - 80, 120, 1, 40);
  const lineFit = st.line ? fit(g, st.line, st.body, 400, W - left - 80, 36, 2, 20) : null;
  const block = name.size + (lineFit ? 20 + lineFit.rows.length * lineFit.size * 1.3 : 0);
  const top = (H - block) / 2;
  g.font = `800 ${name.size}px ${cssFace(st.heading)}`;
  g.fillStyle = st.text;
  words(g, name.rows, W - 80, top, name.size, 1, "right");
  if (lineFit) {
    g.font = `400 ${lineFit.size}px ${cssFace(st.body)}`;
    g.fillStyle = st.muted;
    words(g, lineFit.rows, W - 80, top + name.size + 20, lineFit.size, 1.3, "right");
  }
  g.fillStyle = st.accent;
  g.fillRect(left, H - 10, W - left, 10);
  return { id: "banner", group: "banner", label: "X banner", w: W, h: H, blob: await png(c), file: `${slug(st.name)}-x-banner-${W}x${H}.png` };
}

async function icon(st: KitStyle, size: number): Promise<KitItem> {
  const { c, g } = canvas(size, size);
  /* The smallest sizes are the mark alone, edge to edge: a frame at 16 pixels is all frame. */
  mark(g, st, 0, 0, size, size <= 48 ? 0.18 : 0.22);
  const label = size === 180 ? "Apple touch icon" : size >= 192 ? "App icon" : "Browser tab icon";
  return { id: `icon-${size}`, group: "icon", label: `${label}, ${size}`, w: size, h: size, blob: await png(c), file: `${slug(st.name)}-icon-${size}.png` };
}

/** Meme words: heavy, the site's text colour, edged in its ground so they read over anything. */
function caption(g: CanvasRenderingContext2D, st: KitStyle, text: string, x: number, y: number, width: number, max: number, align: CanvasTextAlign = "center", baseline: "top" | "bottom" = "top") {
  const t = fit(g, text, st.heading, 900, width, max, 2, 24);
  g.font = `900 ${t.size}px ${cssFace(st.heading)}`;
  g.textAlign = align;
  g.textBaseline = "top";
  g.lineJoin = "round";
  g.lineWidth = Math.max(4, t.size * 0.12);
  g.strokeStyle = st.bg;
  g.fillStyle = st.text;
  const h = t.rows.length * t.size * 1.05;
  const y0 = baseline === "bottom" ? y - h : y;
  t.rows.forEach((r, i) => { g.strokeText(r, x, y0 + i * t.size * 1.05); g.fillText(r, x, y0 + i * t.size * 1.05); });
}

async function memes(st: KitStyle, m: MemeWords): Promise<KitItem[]> {
  const out: KitItem[] = [];
  {
    const W = 1080, H = 1080;
    const { c, g } = canvas(W, H);
    ground(g, W, H, st, [W / 2, H / 2]);
    mark(g, st, W / 2 - 250, H / 2 - 250, 500, 0.12);
    caption(g, st, m.top, W / 2, 50, W - 100, 96);
    caption(g, st, m.bottom, W / 2, H - 50, W - 100, 96, "center", "bottom");
    out.push({ id: "meme-top-bottom", group: "meme", label: "Meme: top and bottom", w: W, h: H, blob: await png(c), file: `${slug(st.name)}-meme-top-bottom.png` });
  }
  {
    const W = 1200, H = 1200;
    const { c, g } = canvas(W, H);
    g.fillStyle = st.surface;
    g.fillRect(0, 0, W, H / 2);
    ground(g, W, H, st, [W * 0.8, H * 0.8]);
    g.fillStyle = withAlpha(st.muted, 0.18);
    g.fillRect(0, 0, W, H / 2);
    g.fillStyle = st.accent;
    g.fillRect(0, H / 2 - 4, W, 8);
    caption(g, st, m.them, W / 2, H / 4, W - 120, 110, "center", "top");
    mark(g, st, 80, H / 2 + 120, 360, 0.14);
    caption(g, st, m.us, 80 + 360 + (W - 80 - 360) / 2, H * 0.72, W - 560, 120);
    out.push({ id: "meme-them-us", group: "meme", label: "Meme: them and us", w: W, h: H, blob: await png(c), file: `${slug(st.name)}-meme-them-us.png` });
  }
  {
    const W = 1080, H = 1350;
    const { c, g } = canvas(W, H);
    ground(g, W, H, st, [W * 0.1, H * 0.1]);
    g.fillStyle = st.accent;
    g.fillRect(80, 120, 120, 12);
    caption(g, st, m.news, 80, 180, W - 160, 150, "left");
    mark(g, st, 80, H - 280, 180);
    g.fillStyle = st.text;
    g.font = `800 56px ${cssFace(st.heading)}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(st.name, 300, H - 190);
    out.push({ id: "meme-news", group: "meme", label: "Meme: announcement", w: W, h: H, blob: await png(c), file: `${slug(st.name)}-meme-announcement.png` });
  }
  return out;
}

/** The whole kit, drawn. */
export async function makeKit(st: KitStyle, m: MemeWords = MEME_DEFAULTS): Promise<KitItem[]> {
  return [await shareCard(st), await banner(st), ...(await Promise.all(ICON_SIZES.map((s) => icon(st, s)))), ...(await memes(st, m))];
}

/** Keep the share card and the icons, and write them into the site's link preview. One undo. */
export async function useOnPage(kit: KitItem[]): Promise<{ image: Picture; icons: HeadIcon[] }> {
  const s = useStudio.getState();
  const card = kit.find((k) => k.id === "share");
  if (!card) throw new Error("Make the kit first.");
  const image = await put(card.blob, { alt: `${s.brief.name || "The site"}`, name: card.file });
  const icons: HeadIcon[] = [];
  for (const k of kit.filter((x) => x.group === "icon")) {
    const pic = await put(k.blob, { alt: "", name: k.file });
    icons.push({ rel: k.w === 180 ? "apple-touch-icon" : "icon", picture: pic, sizes: `${k.w}x${k.h}`, type: "image/png" });
  }
  const head: SiteHead = { ...(s.brief.head ?? {}), image: { picture: image, alt: image.alt, w: card.w, h: card.h }, icons, card: LARGE };
  s.setBrief({ head });
  return { image, icons };
}
