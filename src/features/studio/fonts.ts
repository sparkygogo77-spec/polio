/**
 * Faces carried one to one.
 *
 * HIS RULING: fonts come through as they are, because size and ratios have
 * to stay true — he measured his layout against the real face, and a
 * substitute that is merely close is a layout fault wearing a disguise.
 * The name of a face travelled before this (`NodeFont.face`); the file did
 * not, so his headings wrapped and his sidebar labels truncated in a wider
 * face, and nothing said so.
 *
 * So a page's `@font-face` rules are read off its stylesheets (`FACES` in
 * `siteRead.ts`), the faces its elements are actually set in are carried
 * here — the bytes, as a data URL, the way a picture's bytes ride in a
 * texture layer — and the document keeps them in `look.fonts`, a stack
 * beside the textures. A part goes on naming its face by name, so a
 * carried face stays swappable: change the part's face on the wheel, or
 * the site's family, and the file simply stops being named.
 *
 * A system face — Arial, Segoe, Georgia — has no rule on the page and no
 * file to carry, so it is named and left alone. A face whose host forbids
 * carrying is not fetched; its stylesheet link is kept and the reason is
 * written. A face that cannot be fetched is kept by its address with the
 * reason, never dropped, so the strip and the board can say why it is not
 * drawing rather than falling back in silence. Latin only, by
 * unicode-range: this is built for the faces he uses.
 *
 * Pure: no fetch, no browser, no React. The routes hand in a fetcher.
 * `tests/fonts-carried.mjs` holds it.
 */

/** A face as the page declared it, read off its stylesheets. */
export interface FaceRead {
  /** As declared, without quotes. */
  family: string;
  /** "400", "700", or a range "100 800". */
  weight?: string;
  style?: string;
  /** The `src` list, absolute, in the order the page gave it. */
  sources: { url: string; format?: string }[];
  /** The stylesheet that declared it, absolute, or null for a `<style>` on the page. */
  sheet: string | null;
  unicodeRange?: string;
}

/** What `FACES` hands back: the rules it could read, and the sheets it could not. */
export interface FacesRead {
  faces: FaceRead[];
  /** Stylesheets from another origin, unreadable, so only their link can be carried. */
  links: { href: string }[];
}

export type FontSource =
  /** The bytes, carried. */
  | { kind: "data"; src: string; format: string }
  /** An address, referenced but not carried. */
  | { kind: "url"; url: string; format?: string }
  /** A stylesheet link that loads it where it is allowed to. */
  | { kind: "link"; href: string };

export interface CarriedFont {
  id: string;
  family: string;
  weight?: string;
  style?: string;
  source: FontSource;
  /** Where it came from: the page, and the stylesheet that declared it. */
  from: { url: string; sheet: string | null };
  /** What was found out about carrying it, in a line. */
  licence: string;
  /** True when the bytes are in the document, or a link that is allowed to load it is. */
  carried: boolean;
  /** Why it is not carried, when it is not. */
  says?: string;
  bytes?: number;
}

/** What carrying a page's faces came to. */
export interface FacesCarried {
  fonts: CarriedFont[];
  /** Faces some element is set in that the page declares no rule for: system faces, named and moved on. */
  named: string[];
}

/** The most one file may weigh, and all of a page's together. A face is a few dozen kilobytes; a whole family in six weights is not a page's business. */
export const FONT_FILE_MAX = 600 * 1024;
export const FONT_TOTAL_MAX = 2 * 1024 * 1024;
/** How many rules of one family are carried: regular, bold, an italic or two. */
export const FONT_RULES_MAX = 4;

/** Hosts whose licence forbids carrying the file away from the page. */
const FORBIDS: { host: RegExp; says: string }[] = [
  { host: /(^|\.)typekit\.(net|com)$/i, says: "Adobe Fonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads from Adobe only where Adobe allows the site to" },
  { host: /(^|\.)fonts\.adobe\.com$/i, says: "Adobe Fonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads from Adobe only where Adobe allows the site to" },
  { host: /(^|\.)typography\.com$/i, says: "Cloud.typography's licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
  { host: /(^|\.)fonts\.com$/i, says: "Monotype's licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
  { host: /(^|\.)myfonts\.net$/i, says: "MyFonts' licence forbids carrying the file; its stylesheet link is kept, and the face loads only where the licence allows" },
];
/** Hosts whose faces are open: carried, and said to be. */
const OPEN = /(^|\.)(fonts\.gstatic\.com|fonts\.googleapis\.com|fonts\.bunny\.net|cdn\.jsdelivr\.net|unpkg\.com|fontlibrary\.org)$/i;

const hostOf = (url: string): string => { try { return new URL(url).hostname; } catch { return ""; } };

/** What the host says about carrying the file. Null when nothing forbids it. */
export function forbids(url: string): string | null {
  const host = hostOf(url);
  return FORBIDS.find((f) => f.host.test(host))?.says ?? null;
}

/** The licence line for a file that may be carried. */
export function licenceOf(url: string): string {
  return OPEN.test(hostOf(url))
    ? "an open face (OFL or Apache), carried with the page"
    : "the page's own file, carried as the page serves it; its licence is the page's";
}

/**
 * Latin, or no range at all: what this is built for. A range is read as
 * the browser serialises it (`U+0-FF`, `U+0460-52F`, `U+00??`), and a
 * subset that starts anywhere in Basic Latin is Latin.
 */
export function isLatin(range: string | undefined): boolean {
  if (!range || !range.trim()) return true;
  return range.split(",").some((part) => {
    const m = /u\+([0-9a-f?]+)/i.exec(part.trim());
    if (!m) return false;
    const start = parseInt(m[1]!.replace(/\?/g, "0"), 16);
    return Number.isFinite(start) && start <= 0x7a;
  });
}

const FORMAT_OF: [RegExp, string][] = [[/\.woff2(\?|#|$)/i, "woff2"], [/\.woff(\?|#|$)/i, "woff"], [/\.ttf(\?|#|$)/i, "truetype"], [/\.otf(\?|#|$)/i, "opentype"]];
/** The format of a source: as declared, or off the address. Null for a format no browser here draws. */
export function formatOf(s: { url: string; format?: string }): string | null {
  const f = (s.format ?? "").toLowerCase().replace(/["']/g, "");
  if (f) return /^(woff2|woff|truetype|opentype)$/.test(f) ? f : f === "ttf" ? "truetype" : f === "otf" ? "opentype" : null;
  if (/^data:font\/woff2/i.test(s.url)) return "woff2";
  if (/^data:font\/woff/i.test(s.url)) return "woff";
  return FORMAT_OF.find(([re]) => re.test(s.url))?.[1] ?? null;
}

const MIME: Record<string, string> = { woff2: "font/woff2", woff: "font/woff", truetype: "font/ttf", opentype: "font/otf" };

export type FetchBytes = (url: string) => Promise<{ bytes: Uint8Array; error?: undefined } | { bytes?: undefined; error: string }>;

/** A stable id for a rule: family, weight and style, so the same face brought twice is one entry. */
export function fontId(family: string, weight?: string, style?: string): string {
  return `font:${family.toLowerCase().replace(/\s+/g, "-")}:${(weight ?? "400").replace(/\s+/g, "-")}:${style ?? "normal"}`;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const b64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
};

/**
 * The faces the page's elements are set in, carried.
 *
 * `used` is the faces the readings name (`type.face`), so a page that
 * loads six faces and sets its words in one carries one. The fetcher is
 * the route's, because the browser cannot fetch a font across origins and
 * the server can.
 */
export async function carryFaces(read: FacesRead, used: readonly string[], pageUrl: string, fetchBytes: FetchBytes): Promise<FacesCarried> {
  const fonts: CarriedFont[] = [];
  const named: string[] = [];
  let weight = 0;
  const seen = new Set<string>();
  for (const name of used) {
    const family = (name ?? "").trim();
    if (!family || seen.has(family.toLowerCase())) continue;
    seen.add(family.toLowerCase());
    const rules = read.faces.filter((f) => same(f.family, family) && isLatin(f.unicodeRange)).slice(0, FONT_RULES_MAX);
    if (!rules.length) {
      /* No rule readable. A link to a sheet this family is named in is the
         next best thing: a Google Fonts sheet names its families in its
         address. Otherwise it is a system face, and needs nothing. */
      const link = read.links.find((l) => new RegExp(`family=${family.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "(\\+|%20|\\s)")}`, "i").test(l.href));
      if (link) fonts.push({ id: fontId(family), family, source: { kind: "link", href: link.href }, from: { url: pageUrl, sheet: link.href }, licence: licenceOf(link.href), carried: true });
      else named.push(family);
      continue;
    }
    for (const rule of rules) {
      const id = fontId(family, rule.weight, rule.style);
      if (fonts.some((f) => f.id === id)) continue;
      const src = rule.sources.map((s) => ({ ...s, format: formatOf(s) })).find((s) => s.format);
      const base = { id, family, ...(rule.weight ? { weight: rule.weight } : {}), ...(rule.style ? { style: rule.style } : {}), from: { url: pageUrl, sheet: rule.sheet } };
      if (!src) {
        fonts.push({ ...base, source: { kind: "url", url: rule.sources[0]?.url ?? "" }, licence: "no source in a format a browser draws", carried: false, says: `${family} is declared in a format no browser here draws` });
        continue;
      }
      const no = forbids(src.url);
      if (no) {
        fonts.push({ ...base, source: rule.sheet ? { kind: "link", href: rule.sheet } : { kind: "url", url: src.url, format: src.format! }, licence: no, carried: false, says: `${family} could not be carried: ${no}` });
        continue;
      }
      if (/^data:/i.test(src.url)) {
        const size = Math.round((src.url.length - src.url.indexOf(",") - 1) * 0.75);
        if (size > FONT_FILE_MAX || weight + size > FONT_TOTAL_MAX) { fonts.push({ ...base, source: { kind: "url", url: "", format: src.format! }, licence: "the page's own file", carried: false, says: `${family} could not be carried: its file is ${Math.round(size / 1024)}KB, past the ${Math.round(FONT_FILE_MAX / 1024)}KB a face may weigh` }); continue; }
        weight += size;
        fonts.push({ ...base, source: { kind: "data", src: src.url, format: src.format! }, licence: "the page's own file, carried as the page serves it; its licence is the page's", carried: true, bytes: size });
        continue;
      }
      const got = await fetchBytes(src.url);
      if (got.error !== undefined || !got.bytes) {
        fonts.push({ ...base, source: { kind: "url", url: src.url, format: src.format! }, licence: licenceOf(src.url), carried: false, says: `${family} could not be fetched from ${src.url}: ${got.error ?? "no answer"}` });
        continue;
      }
      const size = got.bytes.length;
      if (size > FONT_FILE_MAX || weight + size > FONT_TOTAL_MAX) {
        fonts.push({ ...base, source: { kind: "url", url: src.url, format: src.format! }, licence: licenceOf(src.url), carried: false, says: `${family} could not be carried: its file is ${Math.round(size / 1024)}KB, past the ${Math.round(FONT_FILE_MAX / 1024)}KB a face may weigh${weight ? ` with ${Math.round(weight / 1024)}KB already carried` : ""}` });
        continue;
      }
      weight += size;
      fonts.push({ ...base, source: { kind: "data", src: `data:${MIME[src.format!] ?? "font/woff2"};base64,${b64(got.bytes)}`, format: src.format! }, licence: licenceOf(src.url), carried: true, bytes: size });
    }
  }
  return { fonts, named };
}

/** The `@font-face` rules for what is carried or referenced. Links are separate (`fontLinks`). */
export function fontFaceCss(fonts: readonly CarriedFont[]): string {
  const rules: string[] = [];
  for (const f of fonts) {
    const s = f.source;
    if (s.kind === "link") continue;
    const src = s.kind === "data" ? `url(${s.src}) format("${s.format}")` : s.url ? `url(${s.url})${s.format ? ` format("${s.format}")` : ""}` : "";
    if (!src) continue;
    rules.push(`@font-face{font-family:"${f.family.replace(/"/g, "")}";font-weight:${f.weight ?? "400"};font-style:${f.style ?? "normal"};font-display:block;src:${src}}`);
  }
  return rules.join("\n");
}

/** The stylesheet links carried instead of files, each once. */
export function fontLinks(fonts: readonly CarriedFont[]): string[] {
  return [...new Set(fonts.map((f) => (f.source.kind === "link" ? f.source.href : "")).filter(Boolean))];
}

/** Said on the strip, whether or not anything went wrong: silence was the fault. */
export function facesSays(carried: FacesCarried): string {
  const ok = [...new Set(carried.fonts.filter((f) => f.carried).map((f) => f.family))];
  const not = carried.fonts.filter((f) => !f.carried);
  const parts: string[] = [];
  if (ok.length) parts.push(`${ok.length === 1 ? "Its face" : "Its faces"} ${list(ok)} ${ok.length === 1 ? "came" : "came"} with the page, one to one.`);
  const seen = new Set<string>();
  for (const f of not) {
    if (seen.has(f.family)) continue;
    seen.add(f.family);
    parts.push(`${f.says ?? `${f.family} could not be carried`}; its parts show in the nearest face this machine has.`);
  }
  if (carried.named.length) parts.push(`${list(carried.named)} ${carried.named.length === 1 ? "is a system face" : "are system faces"}, named and needing no file.`);
  return parts.join(" ");
}

/**
 * A generic keyword — `ui-monospace`, `system-ui` — is not a face but a
 * request for the machine's own, and the machine's own differs from
 * machine to machine: his headings fit 143px in his machine's monospace
 * and wrapped in this one's. Nothing can be carried for it, so it is said.
 */
export const GENERIC_FACES = /^(ui-monospace|ui-sans-serif|ui-serif|ui-rounded|system-ui|-apple-system|BlinkMacSystemFont|monospace|sans-serif|serif|cursive|fantasy|math|emoji|fangsong)$/i;

/** The generic keywords the readings' stacks lead with, each once, in order met. */
export function genericsOf(stacks: readonly string[]): string[] {
  const out: string[] = [];
  for (const stack of stacks) {
    const first = (stack ?? "").split(",")[0]?.trim().replace(/^["']|["']$/g, "") ?? "";
    if (first && GENERIC_FACES.test(first) && !out.some((g) => g.toLowerCase() === first.toLowerCase())) out.push(first);
  }
  return out;
}

/** Said on the strip beside the faces: what is set in the machine's own face, and that it will differ. */
export function genericSays(generics: readonly string[]): string {
  if (!generics.length) return "";
  return `${generics.length === 1 ? "Text set in" : "Text set in"} ${list(generics)} is set in ${generics.length === 1 ? "the machine's own face" : "the machine's own faces"}, which ${generics.length === 1 ? "is a different face" : "are different faces"} on a different machine; nothing can be carried for it, so widths there are this machine's.`;
}

function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
