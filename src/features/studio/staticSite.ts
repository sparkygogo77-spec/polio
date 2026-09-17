"use client";
/**
 * The site as a site: HTML and CSS a browser can open, written in the
 * browser that is already drawing it.
 *
 * WHY THIS EXISTS. A publish put three files in a `site/` folder — the
 * document and the blueprint — which is a description of a website and not
 * a website. Imported at Vercel, the repository had nothing at its root to
 * serve and every address answered NOT_FOUND. The scaffold (`scaffold.ts`)
 * writes a Next app from the same document, which is the right thing later
 * and could not have saved this either: it has no `package.json`, no
 * framework config, so nothing builds it and there is still no page.
 *
 * So this writes the simplest thing that is a real website: one `index.html`
 * per page at the repository root, one stylesheet beside them, and nothing
 * else. No build step, no framework to detect, no configuration to get
 * wrong — and no serverless function, which is not a detail: a static export
 * costs nothing against the function storage a Next deployment eats.
 *
 * HOW IT IS FAITHFUL. Not by describing the board to anything. Each page is
 * rendered once, by the same `LiveSite` the preview uses, into a detached
 * container at the site's own width; its DOM is read out; and the app's own
 * stylesheets are read out of `document.styleSheets` and written beside it.
 * The exported page is therefore the same markup under the same rules as the
 * preview, not a second implementation of it. Images are already data URLs,
 * so the export carries them with it.
 *
 * WHAT IT IS NOT, said here so nobody finds out by being surprised: it is a
 * still. Anything that was a React handler is gone, so a part that only does
 * something when pressed does nothing; page-to-page links are the notable
 * case, and every page is still at its own address. Behaviour is what the
 * model is for, and it goes in the scaffold's components, not here.
 */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LiveSite } from "./live/LiveSite";
import { useStudio, type StudioPage } from "./store";

export interface SiteFile {
  path: string;
  content: string;
}

/** Where a page's own `index.html` goes. The home page is the root. */
export function pageFile(page: StudioPage, home: string | null): string {
  if (page.id === home) return "index.html";
  const p = (page.path || page.name || page.id).trim().replace(/^\/+|\/+$/g, "");
  const slug = p.toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/^-+|-+$/g, "") || page.id;
  return `${slug}/index.html`;
}

/**
 * Every rule the app is painting with, as one stylesheet.
 *
 * Read off the live document rather than rebuilt: whatever the preview looks
 * like, the export is under the same rules. A sheet from another origin
 * cannot be read at all — the browser refuses — so those are linked instead,
 * which is what a web font is and is the right answer for it anyway.
 */
function styles(): { css: string; links: string[] } {
  const out: string[] = [];
  const links: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try {
      rules = sheet.cssRules;
    } catch {
      // Another origin. A link is the only way to carry it.
      if (sheet.href) links.push(sheet.href);
      continue;
    }
    if (!rules) continue;
    for (const rule of Array.from(rules)) out.push(rule.cssText);
  }
  return { css: out.join("\n"), links };
}

/** The attributes the tokens hang off: the theme, the font, the accent hue. */
function rootAttrs(): string {
  const el = document.documentElement;
  const keep = ["data-theme", "data-font", "data-contrast", "data-motion", "data-glow", "data-glass"];
  const attrs = keep.filter((k) => el.getAttribute(k)).map((k) => `${k}="${el.getAttribute(k)}"`);
  const style = el.getAttribute("style");
  if (style) attrs.push(`style="${style.replace(/"/g, "&quot;")}"`);
  return attrs.join(" ");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One page, rendered by the same component the preview uses, and read back as markup. */
function markupOf(el: React.ReactElement, width: number): string {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;pointer-events:none;opacity:0`;
  document.body.appendChild(host);
  const root = createRoot(host);
  let html = "";
  try {
    flushSync(() => root.render(el));
    html = host.innerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
  return html;
}

/**
 * The whole site, as files. Nothing is asked of anybody: no key, no model,
 * no network. The same document gives the same files every time.
 */
export function staticSite(): SiteFile[] {
  const s = useStudio.getState();
  if (!s.pages.length) return [];
  const home = s.pages[0]!.id;
  const width = s.frameWidth || 1440;
  const { css, links } = styles();
  const name = s.brief.name?.trim() || "Site";
  const files: SiteFile[] = [];

  for (const page of s.pages) {
    const body = markupOf(
      React.createElement(LiveSite, {
        pages: s.pages,
        nodes: s.nodes,
        pageId: page.id,
        device: "desktop" as const,
        frameWidth: width,
        format: s.format,
        look: s.look,
      }),
      width,
    );
    const title = page.name?.trim() ? (page.id === home ? name : `${page.name.trim()} · ${name}`) : name;
    const up = page.id === home ? "" : "../";
    files.push({
      path: pageFile(page, home),
      content: `<!doctype html>
<html lang="en" ${rootAttrs()}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${links.map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join("\n")}
<link rel="stylesheet" href="${up}assets/site.css">
</head>
<body>
<div class="site-root">
${body}
</div>
</body>
</html>
`,
    });
  }

  /*
   * The page's own frame, after everything the app paints with.
   *
   * The board is laid out at one width, so the export is too, and without
   * this it sat against the left edge of a wider window with the rest of the
   * screen bare. Centred, and the browser's own default margin taken off.
   */
  const frame = `\n/* The exported page's frame. */\nhtml, body { margin: 0; padding: 0; }\n.site-root { width: ${width}px; max-width: 100%; margin-inline: auto; }\n`;
  files.push({ path: "assets/site.css", content: `${css}${frame}` });
  return files;
}
