/**
 * What a page says about itself before it is opened: its title, its icon,
 * its description, and the Open Graph lines a link preview is drawn from.
 *
 * Pure, so the rule can be held without a browser (tests/link-preview.mjs).
 * `exportSite.ts` works out the pieces that need one (the logo's icons,
 * which pictures this browser still holds) and hands them here.
 */
import type { Picture } from "./pictures";

/** The site's picture drawn as icons, and where each is published. */
export interface SiteIcons { small: string; touch: string; files: { path: string; content: string; encoding: "base64" }[] }

/** A value for an attribute in double quotes. */
const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The head a capture recorded (sink `doc.head`), kept on the brief; a page
 * keeps only where it differs (`page.head`). Editable in the Pages panel's
 * Link preview. `from` and `url` are the original's addresses, recorded and
 * never written: a preview of the copy names the copy.
 */
export interface HeadImage { picture: Picture; alt?: string; w?: number; h?: number; from?: string }
export interface HeadIcon { rel: string; picture: Picture; sizes?: string; type?: string; color?: string; from?: string }
export interface SiteHead {
  title?: string;
  description?: string;
  siteName?: string;
  url?: string;
  themeColor?: string;
  /** twitter:card as captured, or as picked: "summary_large_image" or "summary". */
  card?: string;
  image?: HeadImage;
  icons?: HeadIcon[];
  manifest?: string;
  /** Every og:* and twitter:* line as captured. */
  meta?: Record<string, string>;
}

export const LARGE = "summary_large_image";
/** A share picture this wide, and no taller than wide, is drawn as the large card. */
export const LARGE_FROM = 600;

/** The shortest side a share picture may have: under it a card is refused or blurred. */
export const SHARE_MIN = 200;

/**
 * Whether a crawler can draw this as a share picture: a raster (Discord and X
 * draw no SVG; stonkfun's copy named its 296×289 logo mark) at least
 * SHARE_MIN on its short side.
 */
export function drawable(p: Picture | null | undefined, w?: number, h?: number): boolean {
  if (!p) return false;
  const raster = p.type ? /^image\/(png|jpe?g|webp|gif)$/i.test(p.type) : /\.(png|jpe?g|webp|gif)$/i.test(p.path);
  return raster && Math.min(w ?? p.w ?? 0, h ?? p.h ?? 0) >= SHARE_MIN;
}

/** The card a picture makes when nobody said: large when it is wide, small otherwise. */
export function cardFor(img: HeadImage | undefined): string {
  if (!img) return "summary";
  const w = img.w ?? img.picture.w ?? 0, h = img.h ?? img.picture.h ?? 0;
  return w >= LARGE_FROM && w >= h ? LARGE : "summary";
}

/** Lines the head below writes itself: a captured one of these is the original's, and is not copied. */
const DERIVED = /^(og:(type|site_name|title|description|url|image(:.*)?)|twitter:(card|title|description|url|image(:.*)?))$/;

export interface HeadIn {
  /** The page's title as the site's name and the page's make it. */
  title: string;
  name: string;
  description: string;
  icon: Picture | null;
  icons: SiteIcons | null;
  /** From this page's folder back to the site's root: "" or "../". */
  up: string;
  /** The page as served, from the root: "/" or "/tokens". */
  address: string;
  /** The address the site is published at, no trailing slash, or null before it has been. */
  live: string | null;
  /** The site's head, when the document has one (`brief.head`). */
  site?: SiteHead | null;
  /** This page's own, where it differs (`page.head`). */
  page?: SiteHead | null;
}

/**
 * The lines, `<title>` first.
 *
 * WITH NO HEAD RECORDED, as it always was:
 *   · the icon and the share picture are the site's own picture, by the rule
 *     the Builder's bar already uses (`siteLogo`: the picture on the most
 *     pages, then the largest; on sink the SolWorks logo). A site with no
 *     picture, or one this browser no longer has the bytes of, says nothing
 *     rather than point at a file that is not there: a missing icon 404s;
 *   · the description is the one the site's owner typed (`brief.description`),
 *     never the brief's central idea, which is authoring and is not
 *     published (tests/publish-leak.mjs). None typed, none written;
 *   · og:url, and og:image as a full address, need the address the site is
 *     published at. Go live asks Vercel for it before the push (`goLive.ts`,
 *     the project's production domain); a site with no project yet goes up
 *     once with og:url left out and the picture named relative, and the
 *     next publish, once live, fills them;
 *   · a share picture, captured or the logo fallen back on, is written only
 *     when a crawler can draw it (`drawable`: a raster, SHARE_MIN or more).
 *
 * WITH ONE (a capture's, or set in Link preview), the page's own values
 * first, then the site's: title, share picture, card, icons, theme colour.
 * The picture and the icons are the files the export writes beside the
 * pages, so a preview is drawn from the copy, and every full address is on
 * the published one, never the original's (gotchi.gg's card, pasted beside
 * its copy, drew the copy's park logo because the copy named nothing
 * better). Captured og:/twitter: lines this does not write itself pass
 * through, unless they name the original's host. The logo stays the
 * fallback for whatever the head does not have.
 */
export function pageHead(o: HeadIn): string {
  const site = o.site ?? null, page = o.page ?? null;
  const has = !!(site || page);
  const title = page?.title?.trim() || site?.title?.trim() || o.title;
  const name = site?.siteName?.trim() || o.name;
  const description = page?.description?.trim() || o.description;
  const given = page?.image ?? site?.image;
  const image = given && drawable(given.picture, given.w, given.h) ? given : undefined;
  /* The logo stands in only when a crawler can draw it, then the site's own largest drawable icon (stonkfun's 250px touch icon). */
  const own = [...(site?.icons ?? [])].map((i) => i.picture).filter((p) => drawable(p)).sort((a, b) => (b.w ?? 0) - (a.w ?? 0))[0] ?? null;
  const fallback = image ? null : drawable(o.icon) ? o.icon : own;
  const icons = site?.icons?.length ? site.icons : null;
  const full = (path: string) => (o.live ? `${o.live}/${path}` : o.up + path);
  const L: string[] = [`<title>${esc(title)}</title>`];
  if (description) L.push(`<meta name="description" content="${attr(description)}">`);
  if (icons) {
    for (const i of icons) {
      const rel = i.rel === "shortcut icon" ? "icon" : i.rel;
      L.push(`<link rel="${attr(rel)}" href="${attr(o.up + i.picture.path)}"${i.sizes ? ` sizes="${attr(i.sizes)}"` : ""}${i.type || rel === "icon" ? ` type="${attr(i.type || i.picture.type)}"` : ""}${i.color ? ` color="${attr(i.color)}"` : ""}>`);
    }
  } else if (o.icons) {
    L.push(`<link rel="icon" type="image/png" sizes="32x32" href="${attr(o.up + o.icons.small)}">`);
    L.push(`<link rel="apple-touch-icon" sizes="180x180" href="${attr(o.up + o.icons.touch)}">`);
  } else if (o.icon) L.push(`<link rel="icon" href="${attr(o.up + o.icon.path)}"${o.icon.type ? ` type="${attr(o.icon.type)}"` : ""}>`);
  const theme = page?.themeColor?.trim() || site?.themeColor?.trim();
  if (theme) L.push(`<meta name="theme-color" content="${attr(theme)}">`);
  L.push(`<meta property="og:type" content="website">`);
  L.push(`<meta property="og:site_name" content="${attr(name)}">`);
  L.push(`<meta property="og:title" content="${attr(title)}">`);
  if (description) L.push(`<meta property="og:description" content="${attr(description)}">`);
  if (o.live) L.push(`<meta property="og:url" content="${attr(o.live + o.address)}">`);
  if (image) {
    const at = full(image.picture.path);
    const w = image.w ?? image.picture.w, h = image.h ?? image.picture.h;
    const alt = image.alt?.trim() || image.picture.alt?.trim() || "";
    L.push(`<meta property="og:image" content="${attr(at)}">`);
    if (/^https:/.test(at)) L.push(`<meta property="og:image:secure_url" content="${attr(at)}">`);
    if (image.picture.type) L.push(`<meta property="og:image:type" content="${attr(image.picture.type)}">`);
    if (w && h) L.push(`<meta property="og:image:width" content="${w}">\n<meta property="og:image:height" content="${h}">`);
    if (alt) L.push(`<meta property="og:image:alt" content="${attr(alt)}">`);
  } else if (fallback) {
    L.push(`<meta property="og:image" content="${attr(full(fallback.path))}">`);
    if (fallback.w && fallback.h) L.push(`<meta property="og:image:width" content="${fallback.w}">\n<meta property="og:image:height" content="${fallback.h}">`);
  }
  if (!has) {
    L.push(`<meta name="twitter:card" content="summary">`);
    return L.join("\n");
  }
  const card = image ? page?.card || site?.card || cardFor(image) : "summary";
  L.push(`<meta name="twitter:card" content="${attr(card === LARGE ? LARGE : "summary")}">`);
  L.push(`<meta name="twitter:title" content="${attr(title)}">`);
  if (description) L.push(`<meta name="twitter:description" content="${attr(description)}">`);
  const shown = image ? image.picture.path : fallback?.path;
  if (shown) {
    L.push(`<meta name="twitter:image" content="${attr(full(shown))}">`);
    const alt = image?.alt?.trim() || image?.picture.alt?.trim();
    if (alt) L.push(`<meta name="twitter:image:alt" content="${attr(alt)}">`);
  }
  /* The rest of what was captured, as it was: twitter:site, og:locale and the like. */
  const hosts = [site?.url, page?.url].map((u) => { try { return u ? new URL(u).host.toLowerCase() : ""; } catch { return ""; } }).filter(Boolean);
  const passed = { ...(site?.meta ?? {}), ...(page?.meta ?? {}) };
  for (const [key, value] of Object.entries(passed)) {
    if (!/^(og|twitter):[a-z0-9_:.-]+$/i.test(key) || DERIVED.test(key.toLowerCase()) || typeof value !== "string" || !value.trim()) continue;
    if (hosts.some((h) => value.toLowerCase().includes(h))) continue;
    L.push(key.startsWith("og:") ? `<meta property="${attr(key)}" content="${attr(value)}">` : `<meta name="${attr(key)}" content="${attr(value)}">`);
  }
  return L.join("\n");
}

/** The pictures one head names: its share picture and its icons. */
export function headPictures(head: SiteHead | null | undefined): Picture[] {
  if (!head) return [];
  return [head.image?.picture, ...(head.icons ?? []).map((i) => i.picture)].filter((p): p is Picture => !!p && typeof p.id === "string" && typeof p.path === "string");
}

/**
 * Every picture a document names, once each: what its parts show, and what
 * its heads name. A document as captured carries its head as `doc.head`;
 * taken in, the same head is `brief.head`. The importer fetches these, and
 * the export writes them.
 */
export function namedPictures(doc: { nodes?: unknown; head?: unknown; brief?: unknown; pages?: unknown }): Picture[] {
  const out = new Map<string, Picture>();
  const add = (p: Picture | null | undefined) => { if (p && typeof p.id === "string" && typeof p.path === "string" && !out.has(p.id)) out.set(p.id, p); };
  /* A part's picture, and a captured video's own file (carried and published as a picture is). */
  for (const n of Array.isArray(doc.nodes) ? (doc.nodes as { picture?: Picture | null; media?: { file?: Picture } | null }[]) : []) { add(n?.picture); add(n?.media?.file); }
  const heads = [doc.head, (doc.brief as { head?: unknown } | undefined)?.head, ...(Array.isArray(doc.pages) ? (doc.pages as { head?: unknown }[]).map((p) => p?.head) : [])];
  for (const h of heads) if (h && typeof h === "object") headPictures(h as SiteHead).forEach(add);
  return [...out.values()];
}

/** A head with only the pictures `held` says are here: a file that is not there is not named. */
export function heldHead(head: SiteHead | null | undefined, held: (p: Picture) => boolean): SiteHead | undefined {
  if (!head) return undefined;
  const icons = head.icons?.filter((i) => held(i.picture));
  return { ...head, image: head.image && held(head.image.picture) ? head.image : undefined, icons: icons?.length ? icons : undefined };
}

/**
 * A head as the published document keeps it: without the original's
 * addresses. The document goes up beside the pages, and where a site was
 * captured from is authoring, never published (tests/publish-leak.mjs):
 * `url`, `manifest`, each picture's `from`, and any captured line that names
 * the original's host are left out. What the export writes needs none of it.
 */
export function publishedHead(head: SiteHead | null | undefined, also: (string | undefined)[] = []): SiteHead | undefined {
  if (!head || typeof head !== "object") return undefined;
  const hosts = [head.url, head.manifest, head.image?.from, ...(head.icons ?? []).map((i) => i.from), ...also]
    .map((u) => { try { return u ? new URL(u).host.toLowerCase() : ""; } catch { return ""; } })
    .filter(Boolean);
  const { url: _url, manifest: _manifest, ...rest } = head;
  const meta = head.meta ? Object.fromEntries(Object.entries(head.meta).filter(([, v]) => typeof v === "string" && !hosts.some((h) => v.toLowerCase().includes(h)))) : undefined;
  const bare = <T extends { from?: string }>(x: T): T => { const { from: _from, ...y } = x; return y as T; };
  return {
    ...rest,
    ...(head.image ? { image: bare(head.image) } : {}),
    ...(head.icons ? { icons: head.icons.map(bare) } : {}),
    ...(meta ? { meta } : {}),
  };
}

/** A head with `patch` over it, an emptied field left out, and nothing at all when nothing is left. */
export function withHead(head: SiteHead | null | undefined, patch: Partial<SiteHead>): SiteHead | undefined {
  const next = { ...(head ?? {}), ...patch } as Record<string, unknown>;
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "" || (Array.isArray(next[k]) && !(next[k] as unknown[]).length)) delete next[k];
  return Object.keys(next).length ? (next as SiteHead) : undefined;
}
