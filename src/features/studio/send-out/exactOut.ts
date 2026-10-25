/**
 * EXACT LOOK (J 2026-10-24: "an exact-look export that just goes live").
 *
 * Today's published site (`exportSite`: the preview's own markup, within 1%
 * of the board's pixels, tests/export-page.mjs) written as a Next.js +
 * Tailwind app, so the same repository and the same Go live serve it:
 *
 *   · each page is `app/<route>/page.tsx` drawing the published page's body
 *     exactly as published (`markup.ts` beside it), so every part stands as
 *     on the board, and its head's title, description and pictures as React
 *     head tags;
 *   · its stylesheets load in the same order, from public/, as the page
 *     loaded them; its scripts (the features) are in the markup, deferred,
 *     as they were;
 *   · the System's tokens are CSS variables (`tokens/tokens.css`) and, where
 *     a palette role equals its token, the role reads the token
 *     (`--accent: var(--colour-accent)`), so changing a token in tokens.css
 *     changes the site;
 *   · Tailwind's theme and utilities are there for later edits, in CSS
 *     layers, without its base styles: the page's own stylesheet is outside
 *     every layer, so nothing Tailwind says can move a pixel of it.
 *
 * Pure: it reads DOM Documents it is handed and returns files.
 */
import type { System } from "../system/model.ts";
import { homeFor, routeOf, type Routed } from "../homePage.ts";
import { jsxAttr } from "../scaffolding/jsx.ts";
import { assetPath, routeLink } from "./pagesOut.ts";
import { POLIO_HEADER, TOKEN_FILES, cssColour, tokenNames } from "./tokensOut.ts";

export interface ExactInput {
  name: string;
  pages: (Routed & { id: string; name?: string | null })[];
  /** Each page's published document, by page id. */
  published: Map<string, Document>;
  /** The published site's other files (stylesheets, scripts, pictures): served from public/ at the same addresses. */
  assets: { path: string; content: string | Uint8Array }[];
  system: System | null;
}

/** The colour roles as the published stylesheet defines them on `:root` (`--bg: rgb(0, 0, 0)`): what the page really paints with. */
export function publishedRoles(siteCss: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of siteCss.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const m of block[1]!.matchAll(/--(bg|surface|text|muted|accent|highlight)\s*:\s*([^;]+)/g)) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const HEADER_TSX = `/* ${POLIO_HEADER} */`;
const URL_ATTRS = ["src", "href", "poster", "data-src"];

/** Every address in a published page made the app's: pictures and files from public/, page files as routes. */
function rehome(doc: Document, link: (href: string) => string): void {
  for (const el of Array.from(doc.querySelectorAll("*"))) {
    for (const a of URL_ATTRS) {
      const v = el.getAttribute(a);
      if (v === null) continue;
      el.setAttribute(a, a === "href" && el.tagName.toLowerCase() === "a" ? link(v) : assetPath(v));
    }
    const srcset = el.getAttribute("srcset");
    if (srcset) el.setAttribute("srcset", srcset.split(",").map((s) => s.trim().replace(/^\S+/, (u) => assetPath(u))).join(", "));
    const style = el.getAttribute("style");
    if (style && /url\(/.test(style)) el.setAttribute("style", cssAssets(style));
  }
  for (const s of Array.from(doc.querySelectorAll("style"))) s.textContent = cssAssets(s.textContent ?? "");
}
const cssAssets = (css: string) => css.replace(/url\((["']?)((?:\.\.\/|\.\/)*assets\/)/g, (_m, q: string, p: string) => `url(${q}/${p.replace(/^(\.\.\/|\.\/)*/, "")}`);

/** A head tag as JSX: React 19 puts titles, metas and links in the head wherever a page draws them. */
function headJsx(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === "title") return `<title>{${JSON.stringify(el.textContent ?? "")}}</title>`;
  if (tag === "meta") {
    if (el.hasAttribute("charset") || el.getAttribute("name") === "viewport") return null;
    const attrs = Array.from(el.attributes).map((a) => `${a.name === "http-equiv" ? "httpEquiv" : a.name}=${jsxAttr(a.value)}`).join(" ");
    return `<meta ${attrs} />`;
  }
  if (tag === "link") {
    const rel = el.getAttribute("rel") ?? "";
    const attrs = Array.from(el.attributes).map((a) => `${a.name === "crossorigin" ? "crossOrigin" : a.name}=${jsxAttr(a.value)}`).join(" ");
    /* Stylesheets keep their order and are loaded once, in the head, before the page draws (React's precedence). */
    return rel === "stylesheet" ? `<link ${attrs} precedence="site" />` : `<link ${attrs} />`;
  }
  if (tag === "style") return `<style href=${jsxAttr(`page-${Math.abs(hash(el.textContent ?? ""))}`)} precedence="site">{${JSON.stringify(el.textContent ?? "")}}</style>`;
  return null;
}
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

/** The roles that equal their token, read from the token: one value, one place. */
export function roleBridge(system: System | null, palette: Record<string, string> = {}): string[] {
  if (!system) return [];
  const names = tokenNames(system);
  const key = (c: string) => JSON.stringify(cssColour(c) ?? c.replace(/\s+/g, ""));
  return system.tokens.colour.filter((t) => t.role && palette[t.role] && key(palette[t.role]!) === key(t.value)).map((t) => `  --${t.role}: var(${names.get(t.id)!.css});`);
}

export function exactGlobalsCss(system: System | null, palette?: Record<string, string>): string {
  const bridge = roleBridge(system, palette);
  return `/* ${POLIO_HEADER}
 * The exact-look site: its own stylesheet (public/assets/site.css) draws every
 * pixel and sits outside every layer, so nothing here can move one. Here are
 * the design tokens, and Tailwind's theme and utilities for later edits
 * (no base styles: the page brings its own).
 */
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "../${TOKEN_FILES.css}";
@import "../${TOKEN_FILES.tailwind}";
/* Only code written here is read for classes, never the published markup (markup.ts): a word in it like "shadow" would otherwise become a class that paints. */
@source "../app/**/*.tsx";
@source "../components";
${bridge.length ? `
/* Each palette role that equals its token reads the token: change it in tokens.css and the site changes. */
:root:root {
${bridge.join("\n")}
}
` : ""}`;
}

export function exactLayoutTsx(): string {
  return `${HEADER_TSX}
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

/** The exact-look app's pages, layout, globals and public files. */
export function exactOut(input: ExactInput): { files: { path: string; content: string | Uint8Array }[]; pages: number } {
  const home = homeFor(input.pages);
  const routes = new Map(input.pages.map((p) => [home.file(p), routeOf(home, p)]));
  const files: { path: string; content: string | Uint8Array }[] = [];
  let pages = 0;
  for (const page of input.pages) {
    const doc = input.published.get(page.id);
    if (!doc) continue;
    const file = home.file(page);
    rehome(doc, (h) => routeLink(h, routes, file));
    const head = Array.from(doc.head?.children ?? []).map(headJsx).filter((x): x is string => !!x);
    const route = routeOf(home, page);
    const dir = route ? `app/${route}` : "app";
    files.push({ path: `${dir}/markup.ts`, content: `${HEADER_TSX}\n/** The page exactly as published: every part placed as on the board. */\nexport const markup = ${JSON.stringify(doc.body?.innerHTML ?? "")};\n` });
    files.push({
      path: `${dir}/page.tsx`,
      content: `${HEADER_TSX}
import { markup } from "./markup";

export default function Page() {
  return (
    <>
${head.map((h) => `      ${h}`).join("\n")}
      <div className="contents" dangerouslySetInnerHTML={{ __html: markup }} />
    </>
  );
}
`,
    });
    pages++;
  }
  const siteCss = input.assets.find((a) => a.path === "assets/site.css")?.content;
  const roles = publishedRoles(typeof siteCss === "string" ? siteCss : siteCss ? new TextDecoder().decode(siteCss) : "");
  files.push({ path: "app/globals.css", content: exactGlobalsCss(input.system, roles) });
  files.push({ path: "app/layout.tsx", content: exactLayoutTsx() });
  for (const a of input.assets) if (!/\.html?$/.test(a.path) && a.path !== "vercel.json") files.push({ path: `public/${a.path}`, content: a.content });
  return { files, pages };
}
