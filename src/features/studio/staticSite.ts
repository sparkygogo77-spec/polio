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
import { TABLET_MAX } from "./live/small";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { LiveSite } from "./live/LiveSite";
import { useStudio, type StudioPage } from "./board/store";
import { homeFor, type Home } from "./homePage";
import { base64, bytesFor, type Picture } from "./pictures";
import { unbuiltSections } from "./spec";
import { missingCopy } from "./promised";
import { NOT_WRITTEN } from "./shelf";
import { namedPictures } from "./siteHead";

export interface SiteFile {
  path: string;
  content: string;
}

/** Where a page's own `index.html` goes. The home page is the root. */
export function pageFile(page: StudioPage, home: Home): string {
  return home.file(page);
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

/*
 * There used to be a `saidInstead` here, and blocks at the foot of the
 * page listing what had not been built. They are gone from the export on
 * a ruling, and the ruling is the point of this note: fail loudly in the
 * Builder, never on the published site.
 *
 * WHAT HAPPENED. The audit worked — and then it shipped. His live page
 * served a dashed-bordered note reading "The coordinates / in the layout,
 * and nothing has been built for it yet", a block headed "No words
 * written for these yet", and a list headed "Asked for in the prompt and
 * not on the page", to anybody who visited, at opacity 0.75. He is the
 * only person who needs to know a part did not render. A visitor must
 * never see the scaffolding, and a note saying "nothing has been built
 * for it yet" is a sentence about how the work is made, which his site is
 * never to mention at all.
 *
 * So the page shows what was built and omits what was not. Nothing is
 * lost: everything the audit finds comes back from `markupOf` and is
 * handed to him beside the publish button, which is the same information
 * at the same volume on the side of the boundary that is his.
 */

/**
 * One page, rendered by the same component the preview uses, read back as
 * markup — and audited on the way out.
 *
 * Every part carries `data-live-node`, so what the page holds can be
 * compared with what the board has. A part that drew nothing is labelled in
 * its own place; a part the renderer never placed at all is named at the
 * foot of the page; a part whose words were never written, and a part whose
 * prompt named copy that is nowhere on the page, are named there too. None
 * of the four is silent, because silence is how five of his sections went
 * out missing and he had to find them himself.
 */
interface Expected { id: string; label: string; featureId: string; prompt: string }
interface Audit { html: string; blank: string[]; unplaced: string[]; unwritten: string[]; unsaid: { part: string; words: string[] }[] }

export function markupOf(el: React.ReactElement, width: number, expect: Expected[]): Audit {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;pointer-events:none;opacity:0`;
  document.body.appendChild(host);
  const root = createRoot(host);
  let html = "";
  const blank: string[] = [];
  const unplaced: string[] = [];
  const unwritten: string[] = [];
  const unsaid: { part: string; words: string[] }[] = [];
  try {
    flushSync(() => root.render(el));
    const seen = new Set<string>();
    for (const box of Array.from(host.querySelectorAll("[data-live-node]"))) {
      /*
       * A surface is a page, so this page's markup can hold another page's
       * parts. Those belong to that page and are audited on it; counted
       * here they would be read as this page's, and a part that is both
       * missing here and present on a cube would be called present.
       */
      if (box.closest("[data-cube-surface]")) continue;
      const id = box.getAttribute("data-live-node") ?? "";
      seen.add(id);
      const part = expect.find((p) => p.id === id);
      if (!part) continue;
      const name = part.label || part.featureId;
      const text = (box as HTMLElement).textContent ?? "";
      if (drewNothing(box)) {
        // Counted for him, and left as the empty box it is on the page.
        blank.push(name);
        continue;
      }
      // Words nobody wrote. The part already says so where it stands; this
      // is the list, so the gap is findable without reading the whole page.
      if (text.includes(NOT_WRITTEN)) unwritten.push(name);
      // Copy the prompt named and the part never carried.
      const missed = missingCopy(part.prompt, text);
      if (missed.length) unsaid.push({ part: name, words: missed });
    }
    for (const part of expect) if (!seen.has(part.id)) unplaced.push(part.label || part.featureId);
    html = host.innerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
  return { html, blank, unplaced, unwritten, unsaid };
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
  /* The parts' pictures, and the heads' share pictures and icons (`namedPictures`). */
  for (const pic of namedPictures(s)) {
    if (done.has(pic.id)) continue;
    done.add(pic.id);
    const blob = await bytesFor(pic);
    if (!blob) { lost.push(pic); continue; }
    files.push({ path: pic.path, content: await base64(blob), encoding: "base64" });
  }
  return { files, lost };
}

/** What one page of the site could not build, for the one person who should see it. */
export interface PageAudit {
  page: string;
  /** Parts that put nothing on the page at all. */
  blank: string[];
  /** Parts the renderer never placed. */
  unplaced: string[];
  /** Parts showing words nobody wrote. */
  unwritten: string[];
  /** Copy a prompt named outright that the part is not carrying. */
  unsaid: { part: string; words: string[] }[];
  /** Sections of the brief's layout that no part carries. */
  sections: string[];
}

/**
 * What the publish will leave out, page by page.
 *
 * The same audit that used to print itself at the foot of his live site,
 * on the other side of the publish boundary: rendered the way the Builder
 * renders — so a part standing in for words nobody wrote still says so,
 * and can be counted — and handed to the panel rather than to a visitor.
 *
 * One render per page and no model, no key, no network, like everything
 * else here. `sections` needs no render at all: it is the brief's own
 * layout minus what the board carries.
 */
export function auditSite(): PageAudit[] {
  const s = useStudio.getState();
  if (!s.pages.length) return [];
  const home = homeFor(s.pages);
  const width = s.frameWidth || 1440;
  const pageIds = new Set(s.pages.map((p) => p.id));
  const orphans = s.nodes.filter((n) => !pageIds.has(n.pageId));

  return s.pages.map((page) => {
    const { blank, unplaced, unwritten, unsaid } = markupOf(
      React.createElement(LiveSite, {
        pages: s.pages,
        nodes: s.nodes,
        pageId: page.id,
        device: "desktop" as const,
        frameWidth: width,
        format: s.format,
        look: s.look,
        siteName: s.brief.name,
        shapes: s.shapes,
        /* The Builder's own view, because that is where this is read and
           because a part standing in for missing words has to be visible
           to be counted. */
        published: false,
      }),
      width,
      [...s.nodes.filter((n) => n.pageId === page.id), ...(page.id === home.id ? orphans : [])]
        .map((n) => ({ id: n.id, label: n.label, featureId: n.featureId, prompt: n.prompt ?? "" })),
    );
    return {
      page: page.name?.trim() || page.path || page.id,
      blank,
      unplaced,
      unwritten,
      unsaid,
      sections: unbuiltSections(s.shapes, s.nodes, page.id).map((x) => x.label),
    };
  });
}

/** Is there anything at all to say about this document? */
export function auditCounts(audit: PageAudit[]): number {
  return audit.reduce((n, a) => n + a.blank.length + a.unplaced.length + a.unwritten.length + a.unsaid.length + a.sections.length, 0);
}

export function staticSite(): SiteFile[] {
  const s = useStudio.getState();
  if (!s.pages.length) return [];
  const home = homeFor(s.pages);
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
        siteName: s.brief.name,
        /* A visitor is reading this one. */
        published: true,
        /* The brief's layout is regions as well as parts, and a region with
           nothing in it is a section the board never built. It is in the
           brief, so it is on the page — saying it is not built. */
        shapes: s.shapes,
        /* Not a browser address: the page being written will be read from a
           repository, where the file sits at its own path beside it. */
        pictureAt: (pic) => `${"../".repeat(pageFile(page, home).split("/").length - 1)}${pic.path}`,
        /* One page at every width: the tablet's and the phone's layouts are rules on the same parts (`live/smallCss.ts`), keyed to each part's id. */
        smallAt: TABLET_MAX + 1,
      }),
      width,
      /*
       * What this page is meant to hold — and, on the home page, anything
       * the board holds that no page claims at all. A part whose `pageId`
       * names a page that is gone is drawn nowhere and belongs to nothing,
       * which is the one shape that used to vanish without trace: not a
       * part that rendered badly, a part nothing ever asked to render.
       */
      [...s.nodes.filter((n) => n.pageId === page.id), ...(page.id === home.id ? orphans : [])]
        .map((n) => ({ id: n.id, label: n.label, featureId: n.featureId, prompt: n.prompt ?? "" })),
    );
    const title = page.name?.trim() ? (page.id === home.id ? name : `${page.name.trim()} · ${name}`) : name;
    const up = "../".repeat(pageFile(page, home).split("/").length - 1);
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
${body.replace(/ data-live-node="([^"]+)"/g, ' data-live-node="$1" id="$1"')}
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
.sm-g, .sm-gi { display: contents; }
.sm-br, .sm-menu-button, .sm-menu-panel { display: none; }
@media (max-width: ${TABLET_MAX + 0.98}px) { .site-root { width: 100%; overflow-x: clip; } }
`;
  files.push({ path: "assets/site.css", content: `${css}${frame}` });
  return files;
}
