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
import { base64, bytesFor, type Picture } from "./pictures";

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

/**
 * Did this part put anything on the page at all?
 *
 * Words, a picture, a frame, a drawing, or paint of its own all count. A box
 * with none of those is a part that rendered nothing, and the page must say
 * so rather than leave a gap: four sections of his went out missing and the
 * page did not mention them, which is worse than failing.
 */
function drewNothing(el: Element): boolean {
  if ((el.textContent ?? "").trim()) return false;
  if (el.querySelector("img, svg, canvas, video, picture, iframe")) return false;
  for (const kid of [el, ...Array.from(el.querySelectorAll("*"))]) {
    const cs = getComputedStyle(kid);
    if (cs.backgroundImage && cs.backgroundImage !== "none") return false;
    if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") return false;
    if (cs.borderTopWidth !== "0px" || cs.borderLeftWidth !== "0px") return false;
  }
  return true;
}

/** The plain sentence a part gets when it could not be published as itself. */
function saidInstead(label: string, why: string): string {
  return `<div class="site-unmade" role="note"><span class="site-unmade-name">${esc(label)}</span><span class="site-unmade-why">${esc(why)}</span></div>`;
}

/**
 * One page, rendered by the same component the preview uses, read back as
 * markup — and audited on the way out.
 *
 * Every part carries `data-live-node`, so what the page holds can be
 * compared with what the board has. A part that drew nothing is labelled in
 * its own place; a part the renderer never placed at all is named at the
 * foot of the page. Neither is silent.
 */
function markupOf(el: React.ReactElement, width: number, expect: { id: string; label: string; featureId: string }[]): { html: string; blank: string[]; unplaced: string[] } {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;pointer-events:none;opacity:0`;
  document.body.appendChild(host);
  const root = createRoot(host);
  let html = "";
  const blank: string[] = [];
  const unplaced: string[] = [];
  try {
    flushSync(() => root.render(el));
    const seen = new Set<string>();
    for (const box of Array.from(host.querySelectorAll("[data-live-node]"))) {
      const id = box.getAttribute("data-live-node") ?? "";
      seen.add(id);
      const part = expect.find((p) => p.id === id);
      if (!part || !drewNothing(box)) continue;
      blank.push(part.label || part.featureId);
      box.setAttribute("data-unmade", part.featureId);
      box.innerHTML = saidInstead(part.label || part.featureId, "this part is described rather than drawn, so there was nothing to publish yet");
    }
    for (const part of expect) if (!seen.has(part.id)) unplaced.push(part.label || part.featureId);
    if (unplaced.length) {
      const note = document.createElement("div");
      note.className = "site-unplaced";
      note.innerHTML = `<div class="site-unmade-name">Not on this page yet</div>${unplaced.map((n) => `<div class="site-unmade-why">${esc(n)}</div>`).join("")}`;
      host.firstElementChild?.appendChild(note);
    }
    html = host.innerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
  return { html, blank, unplaced };
}

/**
 * The whole site, as files. Nothing is asked of anybody: no key, no model,
 * no network. The same document gives the same files every time.
 */
/** A file that is bytes rather than words: a picture, on its way to the repository. */
export interface SiteBinary {
  path: string;
  /** Base64, because that is how a file reaches a repository. */
  content: string;
  encoding: "base64";
}

/**
 * The pictures the parts point at, as real files.
 *
 * The document holds a path; this is where the bytes are fetched out of
 * this browser's file storage and handed to the publish to commit. A
 * picture this browser has lost is named rather than skipped, so the page
 * that references it can say why it is not there.
 */
export async function sitePictures(): Promise<{ files: SiteBinary[]; lost: Picture[] }> {
  const s = useStudio.getState();
  const files: SiteBinary[] = [];
  const lost: Picture[] = [];
  const done = new Set<string>();
  for (const node of s.nodes) {
    const pic = node.picture;
    if (!pic || done.has(pic.id)) continue;
    done.add(pic.id);
    const blob = await bytesFor(pic);
    if (!blob) { lost.push(pic); continue; }
    files.push({ path: pic.path, content: await base64(blob), encoding: "base64" });
  }
  return { files, lost };
}

export function staticSite(): SiteFile[] {
  const s = useStudio.getState();
  if (!s.pages.length) return [];
  const home = s.pages[0]!.id;
  const width = s.frameWidth || 1440;
  const { css, links } = styles();
  const name = s.brief.name?.trim() || "Site";
  const pageIds = new Set(s.pages.map((p) => p.id));
  const orphans = s.nodes.filter((n) => !pageIds.has(n.pageId));
  const files: SiteFile[] = [];

  for (const page of s.pages) {
    const { html: body } = markupOf(
      React.createElement(LiveSite, {
        pages: s.pages,
        nodes: s.nodes,
        pageId: page.id,
        device: "desktop" as const,
        frameWidth: width,
        format: s.format,
        look: s.look,
        /* Not a browser address: the page being written will be read from a
           repository, where the file sits at its own path beside it. */
        pictureAt: (pic) => `${page.id === home ? "" : "../"}${pic.path}`,
      }),
      width,
      /*
       * What this page is meant to hold — and, on the home page, anything
       * the board holds that no page claims at all. A part whose `pageId`
       * names a page that is gone is drawn nowhere and belongs to nothing,
       * which is the one shape that used to vanish without trace: not a
       * part that rendered badly, a part nothing ever asked to render.
       */
      [...s.nodes.filter((n) => n.pageId === page.id), ...(page.id === home ? orphans : [])]
        .map((n) => ({ id: n.id, label: n.label, featureId: n.featureId })),
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
  const frame = `
/* The exported page's frame. */
html, body { margin: 0; padding: 0; }
.site-root { width: ${width}px; max-width: 100%; margin-inline: auto; }

/* A part that could not be published as itself says so where it stood.
   Quiet, and impossible to miss: a gap in a page is read as a mistake by
   whoever made it and as nothing at all by everybody else. */
.site-unmade, .site-unplaced {
  display: flex; flex-direction: column; gap: 4px; justify-content: center;
  height: 100%; padding: 16px; border: 1px dashed currentColor; border-radius: 8px;
  opacity: 0.55; font: 500 13px/1.4 ui-sans-serif, system-ui, sans-serif;
}
.site-unplaced { margin: 24px; height: auto; }
.site-unmade-name { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
.site-unmade-why { font-size: 12px; opacity: 0.8; }
`;
  files.push({ path: "assets/site.css", content: `${css}${frame}` });
  return files;
}
