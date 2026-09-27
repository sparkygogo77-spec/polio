"use client";
/**
 * The site as HTML and CSS a person can open, read and edit, and nothing
 * else.
 *
 * HIS RULING: output HTML and CSS first, at the one width the site was
 * captured at. Nothing here invents behaviour for another width: the capture
 * records none (no breakpoints, widths only as measured pixels, margins only
 * as the positions they produced), and a breakpoint made up here would be a
 * guess nobody can measure. The whole page is scaled to the window instead
 * (`frameCss`), which invents nothing.
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
 * WHERE IT GOES: Publish and Go live send it (`collectFiles` in goLive.ts),
 * and `window.__studioExport` hands it to whoever else asks (the checks, and
 * scripts/export-site.mjs, which writes it to a folder to open).
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
import { bytesFor, type Picture } from "./pictures";
import { siteLogo } from "./siteMark";
import { activeProject } from "@/features/builds/store";

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

/* A part's link stretched over its part: empty, transparent, and on top of the part so a press anywhere on it follows (see stretchLinks). */
const STRETCH = `a.link-fills-part::after{content:"";position:absolute;inset:0}
.link-fills-part-frame{position:static!important}`;

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
function asAnchor(el: Element, href: string, kind: NodeLink["kind"], extraStyle = "", here = false): HTMLAnchorElement {
  const a = el.ownerDocument.createElement("a");
  for (const at of Array.from(el.attributes)) {
    if (at.name === "role" || at.name === "tabindex" || at.name === "type" || at.name === "aria-pressed") continue;
    a.setAttribute(at.name, at.value);
  }
  if (extraStyle) a.setAttribute("style", `${extraStyle}${a.getAttribute("style") ?? ""}`);
  a.setAttribute("href", href);
  if (here) a.setAttribute("aria-current", "page");
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
function linksOf(root: DocumentFragment, from: StudioPage, pages: StudioPage[], home: string, nodes: Map<string, StudioNode>): Map<Element, HTMLAnchorElement> {
  const partLinks = new Map<Element, HTMLAnchorElement>();
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
    /* The page this one is: its own entry in a menu is the current page's.
       How it looks as the current one is the capture's (sink's sidebar draws
       its own page's entry filled); this only says so to a screen reader. */
    const here = node.link.kind === "page" && resolvePageLink(pages, node.link.target)?.id === from.id;
    const whole = Array.from(part.querySelectorAll("[data-link-whole]")).find(own);
    if (whole) { partLinks.set(part, asAnchor(whole, href, node.link.kind, "display:block;", here)); continue; }
    const button = Array.from(part.querySelectorAll("button")).find(own);
    if (button) { partLinks.set(part, asAnchor(button, href, node.link.kind, "", here)); continue; }
    /* A part whose words already hold a link cannot be held in another: a
       link inside a link is rebuilt by the browser, not followed. Its own
       link is left out, and tests/export-links.mjs counts it missing. */
    if (Array.from(part.querySelectorAll("a[href]")).some((x) => x.closest("[data-live-node]") === part)) continue;
    const a = part.ownerDocument.createElement("a");
    a.setAttribute("href", href);
    if (here) a.setAttribute("aria-current", "page");
    a.setAttribute("style", "display:contents");
    if (node.link.kind === "url") { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    while (part.firstChild) a.appendChild(part.firstChild);
    part.appendChild(a);
    partLinks.set(part, a);
  }
  return partLinks;
}

/** The classes a stretched link and the box between it and its part wear: the stylesheet's STRETCH. */
const FILLS = "link-fills-part";
const FRAME = "link-fills-part-frame";

/** What a part does when pressed, if anything: a link, a control, or anything that takes focus. */
const PRESS = "a[href], button, input, select, textarea, [tabindex], [role=link], [role=button]";

/**
 * A part's link, stretched over the whole part.
 *
 * WHY. A captured button's link is only as big as its words: a sidebar
 * entry's is 159 by 20 inside a 223 by 44 part, and the icon beside the
 * words sits in the part's padding, where there is no link, in the preview
 * as here. On the site the icon was inside the link and the whole entry was
 * pressable; the capture flattened that away. His ruling, in the export
 * only: an empty, transparent layer on the link (`::after`, placed over the
 * part, which is the nearest placed box) so a press anywhere on the part
 * follows it. It draws nothing and moves nothing.
 *
 * THE BOX IN BETWEEN. A button's link sits in the part's `Fill`, which is
 * `position: relative` (and clips), so the layer would stop at the words'
 * box. That one box is set back to `position: static` in the export, which
 * changes nothing drawn only when it has no offset, no z-index, no
 * transform or filter, and nothing placed inside it; otherwise the link is
 * not stretched. Measured on sink: every button's link has exactly one such
 * box, none of those things, and the nine pages are byte-identical.
 *
 * ONLY where the part holds exactly one link and nothing else pressable,
 * counted from the document (its own link, and every linked run of its
 * words) and from the page (every control in it). Two links under one layer
 * would have one of them silently win. Returns how many took it and how
 * many each guard held back.
 */
function stretchLinks(partLinks: Map<Element, HTMLAnchorElement>, nodes: Map<string, StudioNode>): { took: number; twoLinks: number; placed: number } {
  let took = 0, twoLinks = 0, placed = 0;
  const pos = (el: Element) => (el as HTMLElement).style?.position ?? "";
  for (const [part, a] of partLinks) {
    const node = nodes.get(part.getAttribute("data-live-node") ?? "");
    const runs = Array.isArray(node?.content) ? node!.content.filter((r) => r?.link?.target).length : 0;
    const links = part.querySelectorAll("a[href]").length;
    const others = [part, ...Array.from(part.querySelectorAll("*"))].filter((x) => x.matches(PRESS) && !x.matches("a[href]")).length;
    if (runs !== 0 || links !== 1 || others !== 0) { twoLinks++; continue; }
    const between: HTMLElement[] = [];
    for (let e = a.parentElement; e && e !== part; e = e.parentElement) if (pos(e) && pos(e) !== "static") between.push(e);
    const quiet = between.every((e) => {
      const st = e.style;
      return st.position === "relative" && !st.top && !st.left && !st.right && !st.bottom && !st.inset && !st.zIndex
        && (!st.transform || st.transform === "none") && (!st.filter || st.filter === "none")
        && !Array.from(e.querySelectorAll<HTMLElement>("*")).some((x) => pos(x) && pos(x) !== "static");
    });
    if (!quiet) { placed++; continue; }
    for (const e of between) e.classList.add(FRAME);
    a.classList.add(FILLS);
    took++;
  }
  return { took, twoLinks, placed };
}

/**
 * A part sitting wholly on a link lets the press through to it.
 *
 * WHY. The capture keeps a thing the site had INSIDE a link (the sidebar's
 * icons, the Documentation logo's icon and name) as a part BESIDE it, drawn
 * on top, so it takes the press: the docs logo followed on 14% of itself
 * and not on its own name. Containment is the converter's to fix; until it
 * does, his ruling, in the export only: a part whose box is wholly inside a
 * linked part's box, with no link and nothing pressable of its own, gets
 * `pointer-events: none`. Nothing moves and the document is untouched. When
 * containment is fixed this becomes unnecessary rather than wrong.
 *
 *   · wholly inside, to 0.01px, by the boxes the page places them at; a part
 *     that only clips a link's corner keeps its press;
 *   · a part with a link, a linked run of words or a control of its own
 *     keeps its press: two links fighting over one press is worse than one
 *     that has to be aimed at.
 * Returns how many parts took it.
 */
function pressThrough(root: DocumentFragment, nodes: Map<string, StudioNode>): number {
  const boxOf = (el: HTMLElement) => {
    const [x, y, w, h] = [el.style.left, el.style.top, el.style.width, el.style.minHeight || el.style.height].map((v) => (v.endsWith("px") ? parseFloat(v) : NaN));
    return [x, y, w, h].every((v) => Number.isFinite(v)) ? { x0: x!, y0: y!, x1: x! + w!, y1: y! + h! } : null;
  };
  const parts = Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]")).map((el) => ({ el, node: nodes.get(el.getAttribute("data-live-node") ?? ""), box: boxOf(el) }));
  const links = parts.filter((p) => p.box && p.node?.link?.target && p.el.querySelector("a[href]"));
  const E = 0.01;
  let n = 0;
  for (const q of parts) {
    const b = q.box;
    if (!b || !q.node || q.node.link?.target) continue;
    if (Array.isArray(q.node.content) && q.node.content.some((r) => r?.link?.target)) continue;
    if (q.el.matches(PRESS) || q.el.querySelector(PRESS)) continue;
    const on = links.some((l) => l.el !== q.el && b.x0 >= l.box!.x0 - E && b.y0 >= l.box!.y0 - E && b.x1 <= l.box!.x1 + E && b.y1 <= l.box!.y1 + E);
    if (on) { q.el.style.pointerEvents = "none"; n++; }
  }
  return n;
}

/** One page's markup, the Builder's marks taken off it, its links made real and its colours tied to the roles. */
function clean(html: string, page: StudioPage, pages: StudioPage[], home: string, nodes: Map<string, StudioNode>, roles: [string, RoleId][]): string {
  const pageId = page.id;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const root = tpl.content;
  const partLinks = linksOf(root, page, pages, home, nodes);
  stretchLinks(partLinks, nodes);
  pressThrough(root, nodes);
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

/** A value for an attribute in double quotes. */
const attr = (v: string) => esc(v).replace(/"/g, "&quot;");

/**
 * What a page says about itself before it is opened: its icon, its
 * description, and the Open Graph lines a link preview is drawn from.
 *
 *   · the icon and the share picture are the site's own picture, by the rule
 *     the Builder's bar already uses (`siteLogo`: the picture on the most
 *     pages, then the largest; on sink the SolWorks logo). A site with no
 *     picture, or one this browser no longer has the bytes of, says nothing
 *     rather than point at a file that is not there: a missing icon 404s;
 *   · the description is the one the site's owner typed (`brief.description`),
 *     never the brief's central idea, which is authoring and is not
 *     published (tests/publish-leak.mjs). None typed, none written;
 *   · og:url, and og:image as a full address, need the address the site is
 *     at, which is known once it has gone live (the Builds page keeps it).
 *     Before that, og:url is left out and the picture is named relative.
 */
function headOf(o: { title: string; name: string; description: string; icon: Picture | null; up: string; folder: string; live: string | null }): string {
  const L: string[] = [];
  if (o.description) L.push(`<meta name="description" content="${attr(o.description)}">`);
  if (o.icon) L.push(`<link rel="icon" href="${attr(o.up + o.icon.path)}"${o.icon.type ? ` type="${attr(o.icon.type)}"` : ""}>`);
  L.push(`<meta property="og:type" content="website">`);
  L.push(`<meta property="og:site_name" content="${attr(o.name)}">`);
  L.push(`<meta property="og:title" content="${attr(o.title)}">`);
  if (o.description) L.push(`<meta property="og:description" content="${attr(o.description)}">`);
  if (o.live) L.push(`<meta property="og:url" content="${attr(`${o.live}/${o.folder}`)}">`);
  if (o.icon) L.push(`<meta property="og:image" content="${attr(o.live ? `${o.live}/${o.icon.path}` : o.up + o.icon.path)}">`);
  L.push(`<meta name="twitter:card" content="summary">`);
  return L.join("\n");
}

/**
 * The page's frame, fitted to the window.
 *
 * The capture has one width and no breakpoints (see the top of this file),
 * so the page is laid out at that width and then drawn at the window's:
 * `zoom` by the window's width over the capture's. Wider windows draw it
 * larger, so the header bar, the sidebar and the page's own background
 * reach both edges; narrower ones smaller, so nothing scrolls sideways, a
 * phone included (the viewport is the device's width, so a phone does not
 * autosize the words of a page it takes for a desktop one).
 *
 * WHY ZOOM AND NOT A TRANSFORM. `zoom` lays the page out again at the new
 * size: words are drawn at the size they end up, so they stay crisp; a press
 * lands where it is aimed, because what is hit is what is drawn; and the
 * page's height shrinks with it, where a transform leaves the layout box at
 * full size, so the window would still scroll sideways and under the page.
 *
 * WHY NO SCRIPT. The factor is a number, and CSS gives a number from two
 * lengths as `tan(atan2(a, b))`. `100cqw` is the body's width without the
 * scrollbar (`100vw` counts it, and would push the page past the edge by
 * its width). A browser that has none of this draws the page at the capture's
 * width, as it did before.
 */
function frameCss(width: number): string {
  return `html, body { background: var(--bg); }
body { container-type: inline-size; overflow-x: clip; }
.site-root { width: ${width}px; zoom: tan(atan2(100cqw, ${width}px)); }`;
}

/**
 * The site, as files: an index.html per page, one stylesheet, the pictures.
 * `only` limits it to some pages; the stylesheet and the pictures come with
 * whatever is asked for. `pictures: false` leaves the pictures for the
 * caller, which Go live does so that a lost one can be named.
 */
export async function exportSite(only?: readonly string[], opts: { pictures?: boolean } = {}): Promise<ExportFile[]> {
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
  const logo = siteLogo(s.nodes);
  const icon = logo && (await bytesFor(logo)) ? logo : null;
  const live = activeProject()?.live?.url?.trim().replace(/\/+$/, "") || null;
  const description = s.brief.description?.trim() ?? "";

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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${headOf({ title, name, description, icon, up, folder: pageFile(page, home).replace(/index\.html$/, ""), live })}
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

/* A link that is a whole part, pressable over the whole part. */
${STRETCH}

/* The page, made at one width, drawn at the window's. */
${frameCss(width)}
`;
  files.push({ path: "assets/site.css", content: css });

  if (opts.pictures !== false) {
    const { files: pictures } = await sitePictures();
    files.push(...pictures);
  }
  return files;
}
