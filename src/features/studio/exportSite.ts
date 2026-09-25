"use client";
/**
 * The site as HTML and CSS a person can open, read and edit, and nothing
 * else.
 *
 * HIS RULING: output HTML and CSS first, at the one width the site was
 * captured at. Nothing here invents behaviour for another width: the capture
 * records none (no breakpoints, widths only as measured pixels, margins only
 * as the positions they produced), and a breakpoint made up here would be a
 * guess nobody can measure.
 *
 * WHAT IT BUILDS ON, AND WHY NOT A SECOND RENDERER. `staticSite.ts` already
 * renders each page with the preview's own `LiveSite` and reads the markup
 * back, and measured against the preview it draws the home page at 0 px of
 * difference (tests/export-page.mjs, EXPORTER=publish). A renderer written
 * again from the document would be a second opinion about how a part looks,
 * and would drift from the first. So the markup is the same; what changes is
 * everything round it:
 *
 *   · the six colour roles are custom properties on :root, and every colour
 *     in the page that IS a role is written as `var(--role)`, so the export
 *     carries the palette the Builder shows and one line changes it;
 *   · the carried faces are declared as @font-face from their own bytes,
 *     without where they were captured from;
 *   · in place of the app's 126 KB stylesheet, the few resets the parts rely
 *     on, measured, so the page is its own and can be read;
 *   · the Builder's own marks are taken off: every data-* attribute and the
 *     part names it keeps as titles. A part keeps its id, as a plain `id`,
 *     so it can be reached from CSS by hand;
 *   · and the tree holds the pages, one stylesheet and the pictures. Never
 *     the document, the blueprint, a prompt or the capture
 *     (tests/publish-leak.mjs reads the whole tree).
 *
 * WHAT IT IS NOT: wired into Publish. Publish still sends what it sent; that
 * wiring waits on the owner's ruling about the guards. This produces files,
 * and `window.__studioExport` hands them to whoever asks (the checks, and
 * scripts/export-site.mjs, which writes them to a folder to open).
 *
 * LINKS ARE REAL. Every part and every run of words the document gives a
 * link is an `<a href>` here (`linksOf`): a page to the file that page is
 * exported as, relative, so the tree works opened from disk as well as
 * served; a url as given, in a new tab as the preview opens one; a part on
 * the page by its id. The preview draws these as a button, a span with a
 * role, or nothing at all (a box reads no link), all pressed by React; with
 * React gone each was dead, 83 on sink and not one `<a>`
 * (tests/export-links.mjs).
 *
 * Still, as `staticSite` is: any other React handler is gone, so a part that
 * only does something when pressed does nothing, and an entrance animation
 * names keyframes the app's stylesheet held, so the page arrives already
 * arrived.
 */
import * as React from "react";
import { LiveSite, resolvePageLink } from "./live/LiveSite";
import { useStudio, type StudioNode, type StudioPage } from "./store";
import type { NodeLink } from "./parts/types";
import { markupOf, pageFile, sitePictures, type SiteBinary, type SiteFile } from "./staticSite";
import { fontFaceCss } from "./fonts";
import { ROLES, type RoleId } from "./look";
import { resolvePalette } from "./parts/theme";

export type ExportFile = SiteFile | SiteBinary;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The resets the parts rely on, and nothing they do not.
 *
 * The parts style themselves inline; what they take for granted is what the
 * app's reset gives every element: border-box sizing, no default margins,
 * buttons and links that inherit their words' look, pictures that sit as
 * blocks. Each line here is one of those, from the same reset the preview
 * is drawn under (Tailwind's), so a part drawn here is drawn as there.
 */
const RESET = `*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
html{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4}
body{margin:0;line-height:inherit}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
a{color:inherit;text-decoration:inherit}
b,strong{font-weight:bolder}
img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle}
img,video{max-width:100%;height:auto}
button,input,select,optgroup,textarea{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;border-radius:0;background-color:transparent;opacity:1}
button,input:where([type=button],[type=reset],[type=submit]){appearance:button}
button,[role=button]{cursor:pointer}
ol,ul,menu{list-style:none}
table{border-collapse:collapse;border-color:inherit;text-indent:0}
[hidden]:where(:not([hidden=until-found])){display:none!important}`;

/** A colour as the browser writes it back in a style attribute, so a role can be found where the page wears it. */
function asWritten(colour: string): string {
  const probe = document.createElement("i");
  probe.style.color = colour;
  return probe.style.color;
}

/** Every colour in a style that is a role, written as that role. Longest first, so no role eats part of another. */
function toRoles(style: string, roles: [string, RoleId][]): string {
  let out = style;
  for (const [written, role] of roles) if (written) out = out.split(written).join(`var(--${role})`);
  return out;
}

/** How far a page's file is below the root, as the `../` that climbs back to it. */
const upOf = (page: StudioPage, home: string) => "../".repeat(pageFile(page, home).split("/").length - 1);

/** Where a link goes from one exported page, as an href, or null when it names nothing that is exported. */
function hrefOf(link: NodeLink | null | undefined, from: StudioPage, pages: StudioPage[], home: string): string | null {
  const target = link?.target?.trim();
  if (!link || !target) return null;
  /* A script is not somewhere to go: left a link that goes nowhere, and counted missing by the check. */
  if (link.kind === "url") return /^\s*javascript:/i.test(target) ? null : target;
  if (link.kind === "node") return `#${target}`;
  const to = resolvePageLink(pages, target);
  return to ? upOf(from, home) + pageFile(to, home) : null;
}

/** The same element as an `<a>`: every attribute and child kept, the ones only a pretend link needed dropped. */
function asAnchor(el: Element, href: string, kind: NodeLink["kind"], extraStyle = ""): HTMLAnchorElement {
  const a = el.ownerDocument.createElement("a");
  for (const at of Array.from(el.attributes)) {
    if (at.name === "role" || at.name === "tabindex" || at.name === "type" || at.name === "aria-pressed") continue;
    a.setAttribute(at.name, at.value);
  }
  if (extraStyle) a.setAttribute("style", `${extraStyle}${a.getAttribute("style") ?? ""}`);
  a.setAttribute("href", href);
  if (kind === "url") { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
  while (el.firstChild) a.appendChild(el.firstChild);
  el.replaceWith(a);
  return a;
}

/**
 * Every link the document holds, made a real one.
 *
 * A RUN: the preview's `span[data-run-link]`, which carries its own target,
 * becomes an `<a>` with the same style. Inline for inline, so the words set
 * as they did.
 *
 * A PART, in the order the preview draws its press:
 *   · a part that is the link whole (`data-link-whole`, a block `div`)
 *     becomes a block `<a>`;
 *   · a button (a captured control, a library button) becomes an `<a>` with
 *     the button's own style: a link cannot hold a button, and a button
 *     cannot be a link;
 *   · anything else (a box: the preview reads no link off one at all) has
 *     its insides held in an `<a>` that draws no box of its own
 *     (`display: contents`), so what is drawn and where does not change and
 *     a press anywhere on it follows.
 * Only a part's OWN elements: a part drawn inside another part is its own.
 */
function linksOf(root: DocumentFragment, from: StudioPage, pages: StudioPage[], home: string, nodes: Map<string, StudioNode>) {
  for (const run of Array.from(root.querySelectorAll("[data-run-link][data-run-to]"))) {
    const link = { kind: run.getAttribute("data-run-link") as NodeLink["kind"], target: run.getAttribute("data-run-to") ?? "" };
    const href = hrefOf(link, from, pages, home);
    if (href) asAnchor(run, href, link.kind);
  }
  for (const part of Array.from(root.querySelectorAll("[data-live-node]"))) {
    const node = nodes.get(part.getAttribute("data-live-node") ?? "");
    const href = hrefOf(node?.link, from, pages, home);
    if (!node?.link || !href) continue;
    const own = (el: Element) => el.closest("[data-live-node]") === part && !el.closest("a");
    const whole = Array.from(part.querySelectorAll("[data-link-whole]")).find(own);
    if (whole) { asAnchor(whole, href, node.link.kind, "display:block;"); continue; }
    const button = Array.from(part.querySelectorAll("button")).find(own);
    if (button) { asAnchor(button, href, node.link.kind); continue; }
    const a = part.ownerDocument.createElement("a");
    a.setAttribute("href", href);
    a.setAttribute("style", "display:contents");
    if (node.link.kind === "url") { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    while (part.firstChild) a.appendChild(part.firstChild);
    part.appendChild(a);
  }
}

/** One page's markup, the Builder's marks taken off it, its links made real and its colours tied to the roles. */
function clean(html: string, page: StudioPage, pages: StudioPage[], home: string, nodes: Map<string, StudioNode>, roles: [string, RoleId][]): string {
  const pageId = page.id;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const root = tpl.content;
  linksOf(root, page, pages, home, nodes);
  /* The carried faces are declared once, in the stylesheet, not in the page. */
  for (const el of Array.from(root.querySelectorAll("style[data-carried-fonts], link[data-carried-font-link]"))) el.remove();
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const node = el.getAttribute("data-live-node");
    const isPage = el.hasAttribute("data-live-page");
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith("data-") || a.name === "title") el.removeAttribute(a.name);
    }
    if (node) el.setAttribute("id", node);
    if (isPage) el.setAttribute("data-page", pageId);
    const style = el.getAttribute("style");
    if (style) el.setAttribute("style", toRoles(style, roles));
  }
  const box = document.createElement("div");
  box.appendChild(root.cloneNode(true));
  return box.innerHTML;
}

/**
 * The site, as files: an index.html per page, one stylesheet, the pictures.
 * `only` limits it to some pages; the stylesheet and the pictures come with
 * whatever is asked for.
 */
export async function exportSite(only?: readonly string[]): Promise<ExportFile[]> {
  const s = useStudio.getState();
  if (!s.pages.length) return [];
  const home = s.pages[0]!.id;
  const width = s.frameWidth || 1440;
  const name = s.brief.name?.trim() || "Site";
  const palette = resolvePalette(s.format, s.look);
  const roles = (ROLES.map((r) => [asWritten(palette[r]), r]) as [string, RoleId][])
    .filter(([w]) => !!w)
    .sort((a, b) => b[0].length - a[0].length);
  const nodes = new Map(s.nodes.map((n) => [n.id, n]));
  const files: ExportFile[] = [];

  for (const page of s.pages) {
    if (only && !only.includes(page.id)) continue;
    const up = upOf(page, home);
    const { html } = markupOf(
      React.createElement(LiveSite, {
        pages: s.pages,
        nodes: s.nodes,
        pageId: page.id,
        device: "desktop" as const,
        frameWidth: width,
        format: s.format,
        look: s.look,
        siteName: s.brief.name,
        published: true,
        shapes: s.shapes,
        pictureAt: (pic) => `${up}${pic.path}`,
      }),
      width,
      [],
    );
    const title = page.name?.trim() ? (page.id === home ? name : `${page.name.trim()} · ${name}`) : name;
    files.push({
      path: pageFile(page, home),
      content: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${up}assets/site.css">
</head>
<body>
<div class="site-root">
${clean(html, page, s.pages, home, nodes, roles)}
</div>
</body>
</html>
`,
    });
  }

  const vars = ROLES.map((r) => `  --${r}: ${palette[r]};`).join("\n");
  const css = `/* The site's palette: every colour on the pages that is one of these is written as var(--name). */
:root {
${vars}
}

/* The faces the site was drawn in, carried with it. */
${fontFaceCss(s.look.fonts ?? [])}

/* What every element starts from. */
${RESET}

/* The page, at the one width it was made at. */
body { background: var(--bg); }
.site-root { width: ${width}px; margin-inline: auto; }
`;
  files.push({ path: "assets/site.css", content: css });

  const { files: pictures } = await sitePictures();
  files.push(...pictures);
  return files;
}
