"use client";
/**
 * The site as HTML and CSS a person can open, read and edit, and nothing
 * else.
 *
 * HIS RULING: output HTML and CSS first, at the one width the site was
 * captured at. Nothing here invents behaviour for another width: the capture
 * records none (no breakpoints, widths only as measured pixels, margins only
 * as the positions they produced), and a breakpoint made up here would be a
 * guess nobody can measure. A captured site stretches instead, 1:1, as the
 * original did (`fluidSite.ts`, from what the capture holds and says where
 * it infers); a hand-built one is scaled to the window (`frameCss`).
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
 * FEATURES RUN. A part carrying a feature from the library (`node.work`)
 * gets it on the published page: `assets/features/runtime.js`, the
 * feature's own script, and a JSON list on the page saying which part takes
 * which feature. The feature writes into the part's own element, so it keeps
 * the part's style. A page that uses none carries none of it.
 *
 * Otherwise still, as `staticSite` is: any other React handler is gone, so a
 * part that only does something when pressed does nothing, and an entrance animation
 * names keyframes the app's stylesheet held, so the page arrives already
 * arrived.
 */
import * as React from "react";
import { keyframesCss, motionCss, pathCodes } from "../shelf";
import { shareRules } from "../cssMerge";
import { carryOwned, pointing } from "../carry";
import { LiveSite, resolvePageLink } from "../live/LiveSite";
import { useStudio, type StudioNode, type StudioPage } from "../board/store";
import type { NodeLink } from "../shelf";
import { homeFor, type Home } from "../homePage";
import { markupOf, pageFile, sitePictures, type SiteBinary, type SiteFile } from "../staticSite";
import { TABLET_MAX } from "../live/small";
import { fontFaceCss } from "../look";
import { ROLES, type RoleId } from "../look";
import { resolvePalette } from "../shelf/run";
import { base64, bytesFor, type Picture } from "../pictures";
import { siteLogo } from "../siteMark";
import { headPictures, heldHead, pageHead, type SiteIcons } from "../siteHead";
import { bandMoves, captureHeight, css as lenCss, heroHeight, fluidClip, fluidParts, fluidStyle, isCaptured, pageUnits, snapPlace, SNAP_CSS, stickyFlow, stickyHolds, typeShifts, vhShift, vhStretch, type FluidPart } from "../fluidSite";
import { activeProject } from "@/features/builds/store";
import { innerBlock, layerStyle, type Units } from "../layerUnits";
import { DEFAULT_OFFSITE, isOffsite, linkAllowed, offsiteRules, type OffsiteRules } from "../shelf";
import { featureFiles, onUsesOf, pageFeatureTags, type WorkUse } from "../shelf";
import { PARTS_JS, SITE_MOTION_JS, pageTransitionCss, partKeyframesFor, partsTags, siteMotionTags } from "../shelf";
import { deriveBehaviours, isBehaviour as isBehaviourPart } from "../live/behaviours";
import { CRATE_CSS, crateOn, setCrateHref } from "../crateLayer";
import { cellFor, crateSheet, type CrateSheet } from "../crateDraw";

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
const upOf = (page: StudioPage, home: Home) => "../".repeat(pageFile(page, home).split("/").length - 1);

/** Where a link goes from one exported page, as an href, or null when it names nothing that is exported. */
/* The site's allow-list for links off it, read as each export starts. */
let offsite: OffsiteRules = offsiteRules(DEFAULT_OFFSITE);
function hrefOf(link: NodeLink | null | undefined, from: StudioPage, pages: StudioPage[], home: Home): string | null {
  const target = link?.target?.trim();
  if (!link || !target) return null;
  /* A script is not somewhere to go: left a link that goes nowhere, and counted missing by the check. */
  /* An address off the site only as the site's allow-list says (`parts/offsite.ts`); a page of the site always. */
  if (link.kind === "url") return /^\s*javascript:/i.test(target) || !linkAllowed(target, offsite) ? null : target;
  if (link.kind === "node") return `#${target}`;
  const to = resolvePageLink(pages, target);
  return to ? cleanHref(from, to, home) : null;
}

/**
 * A PAGE'S ADDRESS IS CLEAN: `/tokens`, never `/tokens/index.html`. The
 * owner saw solcinerator.vercel.app/tokens/index.html in the bar. The files
 * stay `tokens/index.html`; `vercel.json` (cleanUrls, no trailing slash)
 * serves them at `/tokens`. A link is written relative to the page it is on
 * as served (`/docs` sits in `/`), so the site works wherever it is rooted.
 * Opened from disk, a page link is a folder, not the file in it.
 */
export const pageAddress = (page: StudioPage, home: Home) => "/" + pageFile(page, home).replace(/(^|\/)index\.html$/, "");
function cleanHref(from: StudioPage, to: StudioPage, home: Home): string {
  const a = pageAddress(from, home), b = pageAddress(to, home);
  const ups = a.slice(0, a.lastIndexOf("/") + 1).split("/").length - 2;
  return "../".repeat(Math.max(0, ups)) + (b.slice(1) || "./");
}

/**
 * PAGES THE ORIGINAL SHOWED AT ONE ADDRESS SWITCH IN PLACE.
 *
 * The original kept solcinerator's address at its root whichever section was
 * picked: its sidebar switched sections in place. The capture says so: every
 * captured part keeps the address it was captured at (`from.url`), and
 * Creator Hub and the seven sections were all captured at `/`, Docs at
 * `/docs`. Pages sharing a captured address are a group; the group's root
 * is the page whose own path is that address (else its first page). Returns,
 * for each page in a group of two or more, its group and root.
 */
function inPlaceGroups(pages: StudioPage[], nodes: StudioNode[], home: Home): Map<string, { root: StudioPage; members: StudioPage[] }> {
  const at = new Map<string, string>();
  for (const page of pages) {
    const count = new Map<string, number>();
    for (const n of nodes) {
      if (n.pageId !== page.id || !n.from?.url) continue;
      let u: string;
      try { const x = new URL(n.from.url); u = `${x.origin}${x.pathname.replace(/\/+$/, "") || "/"}`; } catch { continue; }
      count.set(u, (count.get(u) ?? 0) + 1);
    }
    const best = [...count].sort((a, b) => b[1] - a[1])[0];
    if (best) at.set(page.id, best[0]);
  }
  const out = new Map<string, { root: StudioPage; members: StudioPage[] }>();
  for (const addr of new Set(at.values())) {
    const members = pages.filter((p) => at.get(p.id) === addr);
    if (members.length < 2) continue;
    const path = new URL(addr).pathname.replace(/\/+$/, "") || "/";
    const norm = (p: StudioPage) => "/" + (p.path ?? "").trim().replace(/^\/+|\/+$/g, "");
    const root = members.find((p) => norm(p) === path) ?? members.find((p) => p.id === home.id) ?? members[0]!;
    for (const m of members) out.set(m.id, { root, members });
  }
  return out;
}

/**
 * The script that switches a group's pages in place: a press on a link to a
 * page of the same group fetches that page and swaps it in, and the address
 * stays the group's root; back and forward walk the pages seen. The links
 * are real `<a href>` all the same, so a crawler, a new tab or a browser
 * without scripts opens the page at its own clean address. A page of the
 * group opened at its own address shows the root's address too, as the
 * original would. Nothing for a page in no group.
 */
function inPlaceScript(page: StudioPage, group: { root: StudioPage; members: StudioPage[] } | undefined, home: Home): string {
  if (!group) return "";
  const data = { root: cleanHref(page, group.root, home), members: group.members.map((m) => cleanHref(page, m, home)) };
  return `<script type="application/json" id="in-place">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>
(() => {
  const G = JSON.parse(document.getElementById("in-place").textContent);
  const key = (u) => new URL(u, location.href).pathname.replace(/\\/index\\.html$/, "").replace(/(.)\\/$/, "$1");
  const members = new Set(G.members.map(key));
  const root = new URL(G.root, location.href).href;
  /* Every address in the page made whole first: the bar will say the root's, and a relative one would then read from there. */
  const whole = (doc, base) => doc.querySelectorAll("[href], [src]").forEach((e) => {
    for (const a of ["href", "src"]) { const v = e.getAttribute(a); if (v && !/^(#|[a-z][a-z0-9+.-]*:)/i.test(v)) e.setAttribute(a, new URL(v, base).href); }
  });
  whole(document, location.href);
  const show = async (to, push) => {
    let text;
    try { const r = await fetch(to); if (!r.ok) throw 0; text = await r.text(); } catch { location.href = to; return; }
    const doc = new DOMParser().parseFromString(text, "text/html");
    whole(doc, to);
    const next = doc.querySelector(".site-root");
    if (!next) { location.href = to; return; }
    document.querySelector(".site-root").replaceWith(document.adoptNode(next));
    document.title = doc.title;
    if (push) history.pushState({ at: to }, "", root);
    scrollTo(0, 0);
  };
  history.replaceState({ at: location.href }, "", root);
  addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || new URL(a.href).origin !== location.origin || !members.has(key(a.href))) return;
    e.preventDefault();
    void show(a.href, true);
  });
  addEventListener("popstate", (e) => { if (e.state && e.state.at) void show(e.state.at, false); });
})();
</script>`;
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
function linksOf(root: DocumentFragment, from: StudioPage, pages: StudioPage[], home: Home, nodes: Map<string, StudioNode>): Map<Element, HTMLAnchorElement> {
  const partLinks = new Map<Element, HTMLAnchorElement>();
  for (const run of Array.from(root.querySelectorAll("[data-run-link][data-run-to]"))) {
    const link = { kind: run.getAttribute("data-run-link") as NodeLink["kind"], target: run.getAttribute("data-run-to") ?? "" };
    const href = hrefOf(link, from, pages, home);
    if (href) asAnchor(run, href, link.kind);
  }
  /* A part, and a part drawn again in a "What's new" card (`data-copy-of`): the copy links where the part does. */
  const PART = "[data-live-node], [data-copy-of]";
  for (const part of Array.from(root.querySelectorAll(PART))) {
    const node = nodes.get(part.getAttribute("data-live-node") ?? part.getAttribute("data-copy-of") ?? "");
    const href = hrefOf(node?.link, from, pages, home);
    /* One the allow-list keeps out is no link: the part stays as drawn, and says where it went for a backend. */
    if (node?.link?.kind === "url" && !href && node.link.target && isOffsite(node.link.target)) part.setAttribute("data-offsite", node.link.target.trim());
    if (!node?.link || !href) continue;
    const own = (el: Element) => el.closest(PART) === part && !el.closest("a");
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
    if (Array.from(part.querySelectorAll("a[href]")).some((x) => x.closest(PART) === part)) continue;
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
    const node = nodes.get(part.getAttribute("data-live-node") ?? part.getAttribute("data-copy-of") ?? "");
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
/** A part carried inside its box leaves to the box what the box does too (a reveal, a tilt): done twice, it would travel twice as far. */
function carriedFeatures(nodes: StudioNode[], fluid: boolean): StudioNode[] {
  if (!fluid) return nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const hostOf = new Map<string, StudioNode>();
  for (const [h, kids] of carryOwned(nodes)) for (const k of kids) hostOf.set(k, byId.get(h)!);
  return nodes.map((n) => {
    const host = hostOf.get(n.id);
    if (!host) return n;
    const theirs = new Set(onUsesOf((host as { work?: WorkUse | null }).work).map((u) => u.id));
    const mine = onUsesOf((n as { work?: WorkUse | null }).work);
    const kept = mine.filter((u) => !theirs.has(u.id));
    if (kept.length === mine.length) return n;
    const [first, ...rest] = kept;
    return { ...n, work: first ? { ...first, ...(rest.length ? { also: rest } : {}) } : null } as StudioNode;
  });
}

/** Set for one export: keep `data-hook` attributes (Export for code). */
let keepHooks = false;

function clean(html: string, page: StudioPage, pages: StudioPage[], home: Home, nodes: Map<string, StudioNode>, roles: [string, RoleId][], fluidAt: number | null = null, atOf?: ReadonlyMap<string, string>, shared?: ReadonlyMap<string, readonly string[]>): string {
  const pageId = page.id;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const root = tpl.content;
  const partLinks = linksOf(root, page, pages, home, nodes);
  /* A canvas world's way to another page of the site (a character, a dialog's link or button): to that page's file, as every page link is. */
  for (const el of Array.from(root.querySelectorAll("[data-part-world] a[href^='/'], [data-part-world] [data-world-href^='/']"))) {
    const at = el.hasAttribute("data-world-href") ? "data-world-href" : "href";
    const to = resolvePageLink(pages, (el.getAttribute(at) ?? "").split(/[?#]/)[0]!);
    if (to) el.setAttribute(at, cleanHref(page, to, home));
  }
  stretchLinks(partLinks, nodes);
  pressThrough(root, nodes);
  if (fluidAt) fluid(root, page.id, nodes, fluidAt);
  /* The parts that point: every pressable part, and every part inside one. */
  const pressed = pointing([...nodes.values()].filter((n) => n.pageId === page.id));
  /* The carried faces are declared once, in the stylesheet, not in the page. */
  for (const el of Array.from(root.querySelectorAll("style[data-carried-fonts], link[data-carried-font-link]"))) el.remove();
  /* So is the page's motion: in the stylesheet, reaching each part by its id. */
  for (const el of Array.from(root.querySelectorAll("style[data-motion-css]"))) el.remove();
  /* And a crate's rule (crateLayer.tsx): once, in the stylesheet. */
  for (const el of Array.from(root.querySelectorAll("style[data-crate-css]"))) el.remove();
  for (const el of Array.from(root.querySelectorAll("*"))) {
    const node = el.getAttribute("data-live-node");
    const isPage = el.hasAttribute("data-live-page");
    /*
     * A canvas world's press areas and dialogs (parts/World.tsx) are the site's, not the Builder's marks: the
     * feature finds them by their `data-world-*`, and a dialog keeps every attribute the page gave its controls
     * (`data-buysol`, `data-world-control`) for a backend to wire, and its titles (tests/world-dialogs.mjs).
     */
    const world = el.closest("[data-part-world]");
    const dialog = world ? el.closest("[data-world-dialogs]") : null;
    for (const a of Array.from(el.attributes)) {
      if (dialog || (world && (a.name.startsWith("data-world-") || a.name === "data-part-world")) || a.name === "data-offsite") continue;
      /* A "What's new" card is the site's too: its feature finds its steps, buttons and previews by these (`library/tour.ts`). */
      if (a.name.startsWith("data-tour") || a.name === "data-copy-of" || a.name === "data-copy-node") continue;
      /* An orb's ball is the site's too: the planet feature finds it, its settings and its picture by these (`library/planetJs.ts`). */
      if (a.name.startsWith("data-planet")) continue;
      /* For code (`exportForCode.ts`), the hooks a brought-in page's code finds its words by stay: `data-hook` on a run. */
      if (keepHooks && a.name === "data-hook") continue;
      /* A frame keeps its title: it is the frame's accessible name, not a part name the Builder kept. */
      if (a.name.startsWith("data-") || (a.name === "title" && el.tagName !== "IFRAME")) el.removeAttribute(a.name);
    }
    if (node) el.setAttribute("id", node);
    if (node && pressed.has(node)) (el as HTMLElement).style.cursor = "pointer";
    /* Its element path, where a rule fires on what stands under a path (`motionCss#trigger`). */
    const code = node ? atOf?.get(node) : undefined;
    if (code) el.setAttribute("data-at", code);
    /* A part moving as others move wears, on its element and its box, the classes their one rule names (`cssMerge.ts#shareRules`). */
    if (shared?.size) {
      for (const x of (node && shared.get(`#${node}`)) || []) el.classList.add(x);
      for (const c of Array.from(el.classList)) for (const x of (c.startsWith("mo-") && shared.get(c)) || []) el.classList.add(x);
    }
    if (isPage) el.setAttribute("data-page", pageId);
    /*
     * The page frame clips, and is no scroll container. The preview's frame
     * is `overflow: hidden`, which makes it the nearest scrolling ancestor of
     * everything in it: a sticky band (fluidSite.ts) then sticks to the
     * frame, which never scrolls, and share.xyz's header scrolled away.
     * `clip` clips the same and leaves the window as what scrolls.
     */
    const style = isPage ? (el.getAttribute("style") ?? "").replace(/overflow:\s*hidden/, "overflow: clip") : el.getAttribute("style");
    if (style) el.setAttribute("style", toRoles(style, roles));
  }
  const box = document.createElement("div");
  box.appendChild(root.cloneNode(true));
  return box.innerHTML;
}

/**
 * A captured page, re-anchored to stretch as the original did (`fluidSite.ts`):
 * every captured part's left and width follow the window, fixed bands are
 * fixed, and the page is the window's width. A part placed by hand keeps its
 * place. After the links and the press-through, which read the captured px.
 */
/**
 * The same, on the Preview's own page (`live/previewWindow.ts`): `live` leaves
 * the parts a band owns where React put them, since moving an element React
 * keeps would break its tree.
 */
export function fluidPage(root: ParentNode, pageId: string, nodes: Map<string, StudioNode>, W: number): void {
  fluid(root, pageId, nodes, W, true);
}

/** The move across in a captured `matrix(a, b, c, d, e, f)`: e. */
const shiftOf = (t: string | undefined): number | null => { const m = /matrix\(([^)]+)\)/.exec(t ?? ""); const e = m ? Number(m[1]!.split(",")[4]) : NaN; return Number.isFinite(e) ? e : null; };

function fluid(root: ParentNode, pageId: string, nodes: Map<string, StudioNode>, W: number, live = false): void {
  const parts: FluidPart[] = [...nodes.values()].filter((n) => n.pageId === pageId).map((n) => ({
    id: n.id, x: n.x ?? 0, y: n.y ?? 0, w: n.w, h: n.h,
    selector: n.from?.selector?.trim() || null, position: n.from?.position ?? null, inset: n.from?.inset ?? null,
    layout: (n as { layout?: FluidPart["layout"] }).layout ?? null,
    pad: (n as { pad?: FluidPart["pad"] }).pad ?? null,
    edge: (n as { edge?: { width?: number } | null }).edge?.width ?? null,
    maxw: (n as { maxw?: number }).maxw ?? null,
    state: n.state ? `${n.state.group}:${n.state.option}` : null,
    shiftX: shiftOf((n as { art?: { transform?: string } | null }).art?.transform),
  }));
  const k = fluidParts(parts, W);
  const H = captureHeight(parts);
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) {
    if (el.parentElement?.closest("[data-live-node]")) continue;
    const id = el.getAttribute("data-live-node") ?? "";
    const p = byId.get(id), f = k.get(id);
    if (p && f) fluidStyle(el, p, f, W, H);
    /* A cut window that reaches the page's right edge moves with it (`fluidSite.ts#fluidClip`). */
    const art = nodes.get(id)?.art;
    const cutEl = art?.clipPath ? Array.from(el.querySelectorAll<HTMLElement>("[data-part-box], [data-still-cut]")).find((e) => !!e.style.clipPath) : null;
    if (p && f && art?.clipPath && cutEl && !f.width.css && Math.abs(f.width.k) < 1e-9) {
      const tx = Number(/^matrix\(([^)]*)\)$/.exec(art.transform ?? "")?.[1]?.split(",")[4] ?? 0) || 0;
      const moved = fluidClip(art.clipPath, p, tx, W);
      if (moved) cutEl.style.clipPath = moved;
    }
  }
  /* A hero sized in the window's height (`node.vh`, 100svh): it fills a taller window and what is under it moves down (`fluidSite.ts#vhShift`). */
  const heroNode = [...nodes.values()].find((n) => n.pageId === pageId && (n as { vh?: { px?: number } }).vh?.px);
  const heroPx = (heroNode as { vh?: { px?: number } } | undefined)?.vh?.px ?? 0;
  const heroPart = heroNode ? byId.get(heroNode.id) : undefined;
  /*
   * Type set with the window, and what it moves (`fluidSite.ts#typeShifts`),
   * and the hero's height: the window's, never under what it holds (its own
   * content and padding, `vh.content`, and what its type grew by). Held at
   * the px it was captured at, a hero in a window shorter than that ran its
   * ribbons below the fold (tests/fluid-type.mjs).
   */
  const typed = typeShifts([...nodes.values()].filter((n) => n.pageId === pageId).map((n) => ({ ...byId.get(n.id)!, fluid: n.font?.fluid ?? null, px: n.font?.px ?? null })), heroPart?.id ?? null);
  /* As the page wrote it (a clamp of the window, or 100svh), never under what it holds where it wrote a minimum (`fluidSite.ts#heroHeight`). */
  const heroH = heroHeight((heroNode as { vh?: { height?: string; minHeight?: string; px?: number; content?: number } } | undefined)?.vh ?? {}, typed.heroGrow, heroPart?.h ?? 0);
  /* What it grows from: the height it had at the capture, which its content can have made more than its minimum. */
  const heroBase = Math.max(heroPx, heroPart?.h ?? 0);
  if (heroPart && heroPx > 0) {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) {
      if (el.parentElement?.closest("[data-live-node]")) continue;
      const p = byId.get(el.getAttribute("data-live-node") ?? "");
      if (!p || p.position === "fixed" || p.position === "sticky" || el.style.position === "fixed") continue;
      if (p === heroPart) { el.style.minHeight = heroH; continue; }
      /* The hero's own child that holds it: its group moves as one. */
      const hs = heroPart.selector ?? "";
      const group = p.selector && hs && p.selector.startsWith(`${hs} > `)
        ? byId.get([...byId.values()].find((q) => q.selector && q.selector === `${hs} > ${p.selector!.slice(hs.length + 3).split(" > ")[0]}`)?.id ?? "") ?? p
        : p;
      /* One that fills the hero (a world and its canvas in the slide's row) keeps its top and grows with it (`fluidSite.ts#vhStretch`). */
      const tall = vhStretch(p, heroPart, heroBase, heroH);
      if (tall) {
        el.style.height = tall; el.style.minHeight = tall;
        for (const box of Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-part-box], :scope > [data-still-cut], :scope > [data-still-cut] > [data-part-box]"))) { box.style.flex = "1 1 0"; box.style.minHeight = "0"; }
        continue;
      }
      const top = vhShift(p, heroPart, heroBase, group, heroH);
      if (top) el.style.top = top;
    }
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) {
    if (el.parentElement?.closest("[data-live-node]")) continue;
    const id = el.getAttribute("data-live-node") ?? "";
    const node = nodes.get(id), p = byId.get(id);
    /* Its words at the window's size: every size in it by the same measure, so a run at .62 of the title stays .62 of it. */
    const fluid = node?.font?.fluid, fpx = node?.font?.px;
    if (fluid && fpx && fpx > 0) {
      for (const e of [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))]) {
        const v = e.style.fontSize.endsWith("px") ? parseFloat(e.style.fontSize) : NaN;
        if (Number.isFinite(v) && v > 0) e.style.fontSize = `calc(${fluid} * ${+(v / fpx).toFixed(6)})`;
      }
      if (p) el.style.minHeight = `calc(${fluid} * ${+(p.h / fpx).toFixed(6)})`;
    }
    const moved = typed.shift.get(id);
    if (moved && p && p.position !== "fixed" && p.position !== "sticky" && el.style.position !== "fixed") el.style.top = `calc(${el.style.top || `${p.y}px`} + ${moved})`;
  }
  /* A layer placed in the window's units or a share of a block that grows with it (`node.units`): placed so again (`layerUnits.ts`). */
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) {
    if (el.parentElement?.closest("[data-live-node]") || el.style.position === "fixed") continue;
    const node = nodes.get(el.getAttribute("data-live-node") ?? "");
    const u = (node as { units?: Units } | undefined)?.units;
    const block = u?.of?.by === "block" && u.of.part ? byId.get(u.of.part) : undefined;
    const bk = block ? k.get(block.id) : undefined;
    if (!node || !u || !block || !bk || block.position === "fixed" || block.position === "sticky") continue;
    const isHero = block === heroPart && heroPx > 0;
    if (!isHero && !bk.width.css && Math.abs(bk.width.k) < 1e-9) continue;
    const top = isHero ? `${block.y}px` : (heroPart && heroPx > 0 ? vhShift(block, heroPart, heroBase, block, heroH) : null) ?? `${block.y}px`;
    const pic = !!(node as { picture?: unknown }).picture || node.featureId === "picture";
    /* Of the block's inside, as the capture measured it (a frame's border is not part of what `100%` spans), and placed where it stood in it. */
    const ofBox = (u.of as { box?: number[] } | undefined)?.box ?? null;
    const inner = innerBlock({ left: lenCss(bk.left, W), top, width: lenCss(bk.width, W), height: isHero ? heroH : `${block.h}px` }, block, ofBox);
    const at0 = ofBox ? { x: ofBox[0]!, y: ofBox[1]! } : { x: block.x, y: block.y };
    const st = layerStyle(u, inner, node.w, node.h, pic && node.w > 0 ? node.h / node.w : null, { x: (node.x ?? 0) - at0.x, y: (node.y ?? 0) - at0.y });
    if (!st) continue;
    if (st.left) el.style.left = st.left;
    if (st.top) el.style.top = st.top;
    if (st.width) el.style.width = st.width;
    if (st.height) {
      el.style.height = st.height; el.style.minHeight = st.height;
      /* A picture sized by its block is held to that height: its wrapper grows with what it holds, and parasiteonsol.fun's hero picture stood 1026 tall in 702 (tests/picture-in-box.mjs). */
      if (pic) for (const box of Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-part-box], :scope > [data-still-cut], :scope > [data-still-cut] > [data-part-box]"))) { box.style.flex = "1 1 0"; box.style.minHeight = "0"; }
    }
    if (st.backgroundSize || st.backgroundPosition) {
      for (const b of [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))]) {
        if (!b.style.backgroundImage || !/url\(/.test(b.style.backgroundImage)) continue;
        if (st.backgroundSize) b.style.backgroundSize = st.backgroundSize;
        if (st.backgroundPosition) b.style.backgroundPosition = st.backgroundPosition;
      }
    }
  }
  /*
   * The parts a sticky or fixed band owns go inside its element and stick
   * with it (fluidSite.ts#bandMoves). The band is positioned, so it is what
   * its absolute parts are placed against: their top is their own less the
   * band's, their left the same less the band's, and a nested band goes in
   * with its own parts already inside it (the moves are nearest band first).
   */
  const moves = bandMoves(parts, W);
  const elOf = (id: string) => root.querySelector<HTMLElement>(`[data-live-node="${CSS.escape(id)}"]`);
  for (const [id, m] of live ? [] : moves) {
    const el = elOf(id), host = elOf(m.band);
    if (!el || !host || el === host || host.contains(el) || el.contains(host)) continue;
    host.appendChild(el);
    el.style.top = `${m.top}px`;
    if (m.inside) { el.style.left = m.inside.left; el.style.width = m.inside.width; }
    else if (m.dx) el.style.left = `calc(${el.style.left || "0px"} - ${m.dx}px)`;
  }
  /*
   * IN THE PREVIEW A STICKY BAND'S OWN PARTS STICK WITH IT. React owns the
   * Preview's DOM, so nothing is moved into the band there; left absolute at
   * the page's own coordinates, under the band's z-index 2, sunkcoin.fun's
   * logo, nav, ticker and button were hidden behind an empty bar. Each part
   * the band owns is made sticky too, at the band's inset plus its own offset
   * in it, in the frame's flow after the band (`stickyFlow` below measures
   * its margin from the band's top), so it paints over the band and sticks
   * where the band does. `tests/sticky-band-parts.mjs`.
   */
  const stuck = new Map<string, FluidPart>();
  if (live) for (const [id, m] of moves) {
    const band = byId.get(m.band), p = byId.get(id), el = elOf(id);
    if (!band || !p || !el || band.position !== "sticky" || el.parentElement?.closest("[data-live-node]")) continue;
    const st = el.style;
    st.position = "sticky";
    st.top = `${(band.inset?.top ?? 0) + (p.y - band.y)}px`;
    st.marginBottom = `-${p.h}px`;
    st.marginLeft = st.left || `${p.x}px`;
    st.left = "auto";
    st.zIndex = "2";
    stuck.set(id, { ...p, position: "sticky" });
  }
  /* A band that sticks inside less than the page, or that a press shows or hides, is held in a box where its parent stood and sticks inside it (fluidSite.ts#stickyHolds). */
  const holds = live ? new Map<string, { top: number; height: number }>() : stickyHolds(parts, Math.max(0, ...parts.map((p) => p.y + p.h)));
  for (const [id, box] of holds) {
    const el = elOf(id), p = byId.get(id);
    if (!el || !p || !el.parentElement || el.parentElement.closest("[data-live-node]")) continue;
    const hold = el.ownerDocument.createElement("div");
    hold.setAttribute("data-sticky-hold", "");
    /* See-through under the desktop's width, where the parts are laid out by the page's small rules (`live/smallCss.ts`). */
    hold.className = "sm-hold";
    /* Over the parts that flow past it, under a band that sticks to the whole page (the header, z-index 2): stuck under the header, it goes under it, as on the page. */
    hold.style.cssText = `position:absolute;left:0;top:${box.top}px;width:100%;height:${box.height}px;pointer-events:none;z-index:1`;
    el.parentElement.insertBefore(hold, el);
    hold.appendChild(el);
    el.style.marginTop = `${p.y - box.top}px`;
    /* Its height is not taken back: nothing flows after it in its box, and a margin under it would let it stick past the box's foot. */
    el.style.marginBottom = "0px";
    if (el.style.pointerEvents !== "none") el.style.pointerEvents = "auto";
  }
  /*
   * WHAT TURNS WITH ITS HOLDER IS DRAWN INSIDE IT. A part the page turned
   * only because its holder is turned (sink: `art.turnsWith`; trumpmorty's
   * ribbon words, a track in a rotate(-2.5deg) row) is drawn flat with the
   * holder's tilt about its own centre. That agrees at the capture's width
   * and drifts where the holder is placed in shares of the window: the row
   * is -5% to 105% wide, its middle moves, and at 2000 the words sat 12px off
   * the band's middle. So where the holder's width follows the window, the
   * part goes inside the holder's turned box, keeps only its own transform
   * (the marquee's slide) and the holder's own window cuts it, as the page
   * did. `tests/ribbon-band.mjs`.
   */
  const bySelector = new Map([...nodes.values()].filter((n) => n.from?.selector).map((n) => [n.from!.selector!.trim(), n]));
  for (const el of live ? [] : Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) {
    if (el.parentElement?.closest("[data-live-node]")) continue;
    const node = nodes.get(el.getAttribute("data-live-node") ?? "");
    const tw = node?.art?.turnsWith;
    const holder = tw ? bySelector.get(tw.selector.trim()) : undefined;
    const hk = holder ? k.get(holder.id) : undefined;
    if (!node || !tw || !holder || !hk || (!hk.width.css && Math.abs(hk.width.k) < 1e-9)) continue;
    const turned = (box: HTMLElement) => [box, ...Array.from(box.querySelectorAll<HTMLElement>("*"))].find((e) => !!e.style.transform && e.style.transform !== "none");
    const hEl = elOf(holder.id), into = hEl ? turned(hEl) : undefined, mine = turned(el);
    if (!into || !mine || into.contains(el)) continue;
    if (!into.style.position || into.style.position === "static") into.style.position = "relative";
    into.appendChild(el);
    /* What it measured against the page it still measures against the page, not against the holder it is now in. */
    if (el.style.width.includes("%")) el.style.width = pageUnits(el.style.width, W);
    el.style.left = `${node.x - holder.x}px`;
    el.style.top = `${node.y - holder.y}px`;
    mine.style.transform = tw.own ?? "none";
    mine.style.transformOrigin = tw.origin ?? "";
    mine.style.clipPath = "";
  }
  /* The sticky bands left at the frame's level, in the order they stand there: each one's top margin is measured from the last (fluidSite.ts#stickyFlow). */
  const atFrame = Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]")).filter((el) => !el.parentElement?.closest("[data-live-node], [data-sticky-hold]")).map((el) => { const id = el.getAttribute("data-live-node") ?? ""; return stuck.get(id) ?? byId.get(id); }).filter((p): p is FluidPart => !!p);
  for (const [id, top] of stickyFlow(atFrame)) { const el = elOf(id); if (el) el.style.marginTop = `${top}px`; }
  /* What moves under the pointer carries what is on it (`carryOwned`): each part inside its box, nearest box first. */
  if (!live) {
    const carry = carryOwned([...nodes.values()].filter((n) => n.pageId === pageId));
    const depth = (id: string) => nodes.get(id)?.from?.selector?.length ?? 0;
    for (const hid of [...carry.keys()].sort((a, b) => depth(b) - depth(a))) {
      const hostEl = elOf(hid), host = nodes.get(hid);
      if (!hostEl || !host) continue;
      const into = hostEl.querySelector<HTMLElement>(":scope > [data-part-box]") ?? hostEl;
      const e = host.edge;
      const bw = into !== hostEl && e && e.style !== "none" && typeof e.width === "number" && Number.isFinite(e.width) ? Math.max(0, e.width) : 0;
      const turn = (box: HTMLElement) => [box, ...Array.from(box.querySelectorAll<HTMLElement>("*"))].find((x) => !!x.style.transform && x.style.transform !== "none");
      const hostTurn = turn(into);
      let moved = 0;
      for (const kid of carry.get(hid)!) {
        const el = elOf(kid);
        if (!el || el === hostEl || el.contains(hostEl) || into.contains(el) || el.parentElement !== hostEl.parentElement) continue;
        if (el.style.position !== "absolute" || hostEl.style.position !== "absolute" || !el.style.left || !el.style.top || !hostEl.style.left || !hostEl.style.top) continue;
        el.style.left = pageUnits(`calc(${el.style.left} - ${hostEl.style.left} - ${bw}px)`, W);
        el.style.top = pageUnits(`calc(${el.style.top} - ${hostEl.style.top} - ${bw}px)`, W);
        if (el.style.width.includes("%")) el.style.width = pageUnits(el.style.width, W);
        /* Turned as its box is turned, it is turned by its box now, not twice. */
        const mine = turn(el);
        if (hostTurn && mine && mine.style.transform === hostTurn.style.transform) { mine.style.transform = "none"; mine.style.transformOrigin = ""; }
        /* Cut to its box's rounded inside, it is inside that box now, and the box cuts it as the page's did: one edge, snapped with the box's own. */
        if (/hidden|clip/.test(host.art?.overflow ?? "") && /^inset\(/.test(nodes.get(kid)?.art?.clipPath ?? "")) for (const c of [el, ...Array.from(el.querySelectorAll<HTMLElement>("*"))]) if (c.style.clipPath) c.style.clipPath = "";
        into.appendChild(el);
        moved++;
      }
      if (moved && into !== hostEl) {
        if (!into.style.position || into.style.position === "static") into.style.position = "relative";
        /* What it holds hangs out of it as on the page (the card's badge over its top edge), unless the page cut it there. */
        if (!/hidden|clip/.test(host.art?.overflow ?? "")) into.style.overflow = "visible";
      }
    }
  }
  /* Every part on a whole pixel, once its place is final (`fluidSite.ts#snapPlace`). */
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]"))) snapPlace(el, live);
  /*
   * THE PAGE IS AS TALL AS WHAT IS ON IT. The preview's page runs 160px past
   * its last part, and the published page scrolled by that much where the
   * original fits the screen (the owner's ruling). A page whose parts end at
   * the foot of the capture's window (the lowest fixed band's) fitted it, so
   * in a window at least that tall it is the window's height and never
   * scrolls; in a shorter one (a small laptop) it keeps its own height and
   * scrolls, so nothing is cut off. Any other page is as tall as its lowest
   * part and scrolls. Never with a scrollbar showing (`frameCss`).
   */
  /*
   * A part a press shows (`state`) is not on the page as it opens: counted, PST's Play ran
   * 2044px for 1315px of page, an empty band under its last panel. And a page shorter than
   * the window is still the window's height, as a browser paints its body's ground down to
   * the window's foot (PST's Leaderboard: white to the bottom, not cut off under its table).
   */
  const body = parts.find((p) => p.selector === "body" && !p.state);
  const bottom = Math.max(0, ...parts.filter((p) => !p.state).map((p) => p.y + p.h), body ? body.y * 2 + body.h : 0);
  const fits = H > 0 && bottom <= H + 1;
  for (const pg of Array.from(root.querySelectorAll<HTMLElement>("[data-live-page]"))) {
    pg.style.width = "100%";
    const grown = [heroPart && heroPx > 0 ? `(${heroH} - ${heroBase}px)` : null, typed.pageGrow].filter(Boolean);
    pg.style.height = fits || !grown.length ? `max(100vh, ${bottom}px)` : `max(100vh, calc(${bottom}px + ${grown.join(" + ")}))`;
  }
}

/**
 * The site's picture at the sizes a browser asks an icon for: 32 for the
 * tab, 180 for a phone's home screen. The share picture stays the original
 * (1024 on sink): a tab shrinking a 316 KB logo to 16px every visit is the
 * wrong way round. Drawn here, in the browser that holds the bytes, by
 * halving until the next halving would pass the size, so a large logo is
 * not thinned to a few sampled pixels in one step. Square, the picture
 * fitted inside and centred. A picture the browser cannot decode gives none,
 * and the head falls back to the picture itself.
 */
async function siteIcons(pic: Picture, blob: Blob): Promise<SiteIcons | null> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(blob); } catch { return null; }
  const draw = async (n: number): Promise<string> => {
    let src: CanvasImageSource = bmp;
    let w = bmp.width, h = bmp.height;
    while (Math.max(w, h) / 2 >= n) {
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w / 2)); c.height = Math.max(1, Math.round(h / 2));
      const g = c.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      g.drawImage(src, 0, 0, c.width, c.height);
      src = c; w = c.width; h = c.height;
    }
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    const k = n / Math.max(w, h);
    g.drawImage(src, (n - w * k) / 2, (n - h * k) / 2, w * k, h * k);
    const out = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
    return out ? base64(out) : "";
  };
  const [small, touch] = await Promise.all([draw(32), draw(180)]);
  bmp.close();
  if (!small || !touch) return null;
  const at = (n: number) => `assets/icons/${pic.id}-${n}.png`;
  return {
    small: at(32), touch: at(180),
    files: [{ path: at(32), content: small, encoding: "base64" }, { path: at(180), content: touch, encoding: "base64" }],
  };
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
function frameCss(width: number, fluid: boolean): string {
  /* A captured site stretches instead (`fluidSite.ts`): 1:1, so browser zoom
     works, and no narrower than 1280 (or its own width, if less), below
     which the window scrolls. */
  if (fluid) return `html, body { background: var(--bg); }
.site-root { width: 100%; min-width: ${smallFrom(width, true)}px; }
${smallCss(smallFrom(width, true))}
/* Scrolling, never a scrollbar: the original shows none (the owner's ruling). */
html, body, * { scrollbar-width: none; -ms-overflow-style: none; }
::-webkit-scrollbar { display: none; width: 0; height: 0; }
/* Each part on a whole pixel, where the browser can round (fluidSite.ts#snapPlace). */
${SNAP_CSS}`;
  return `html, body { background: var(--bg); }
body { container-type: inline-size; overflow-x: clip; }
.site-root { width: ${width}px; zoom: tan(atan2(100cqw, ${width}px)); }
${smallCss(smallFrom(width, false))}`;
}

/**
 * Where the desktop's layout stops (`live/small.ts`): a captured page is
 * drawn no narrower than its own width or 1280, so below that it is the
 * tablet's; anything else turns at 1024. Below 600 it is the phone's.
 */
function smallFrom(width: number, fluid: boolean): number {
  return fluid ? Math.min(width, 1280) : TABLET_MAX + 1;
}

/**
 * The frame under the desktop's width: the window's own width, unscaled, and
 * no box a container for what is fixed in it (the Menu's panel). Each part's
 * own rules are the page's (`LiveSite`'s `smallAt`). The groups the page is
 * nested in are see-through on the desktop; the Menu's key is not drawn there.
 */
function smallCss(wideFrom: number): string {
  return `.sm-g, .sm-gi { display: contents; }
.sm-br, .sm-menu-button, .sm-menu-panel { display: none; }
@media (max-width: ${wideFrom - 0.02}px) {
  body { container-type: normal; }
  .site-root { width: 100%; min-width: 0; zoom: 1; overflow-x: clip; }
}`;
}

/**
 * The address the site is published at, with no trailing slash, or null.
 *
 * Known once it has gone live: Go live writes the address Vercel answered
 * on the site (`setLive`). Not before, and not guessed: a new Vercel project
 * named `gotchi` is not `gotchi.vercel.app` when that name is somebody
 * else's (his came out as gotchi-red.vercel.app). So a first Go live writes
 * the preview's addresses relative, and Link preview says so.
 */
export function publishedAt(): string | null {
  return activeProject()?.live?.url?.trim().replace(/\/+$/, "") || null;
}

/**
 * The site, as files: an index.html per page, one stylesheet, the pictures.
 * `only` limits it to some pages; the stylesheet and the pictures come with
 * whatever is asked for. `pictures: false` leaves the pictures for the
 * caller, which Go live does so that a lost one can be named.
 */
export async function exportSite(only?: readonly string[], opts: { pictures?: boolean; /** The published address when it is known before the site has gone live (Go live asks Vercel for it before the push). */ address?: string | null; /** Keep every `data-hook` the pages carry (Export for code). */ hooks?: boolean } = {}): Promise<ExportFile[]> {
  const s = useStudio.getState();
  keepHooks = !!opts.hooks;
  offsite = offsiteRules(String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE));
  if (!s.pages.length) return [];
  const home = homeFor(s.pages);
  const width = s.frameWidth || 1440;
  const name = s.brief.name?.trim() || "Site";
  const palette = resolvePalette(s.format, s.look);
  const roles = (ROLES.map((r) => [asWritten(palette[r]), r]) as [string, RoleId][])
    .filter(([w]) => !!w)
    .sort((a, b) => b[0].length - a[0].length);
  const nodes = new Map(s.nodes.map((n) => [n.id, n]));
  const files: ExportFile[] = [];
  /* Captured, it stretches as the original did; built by hand, it keeps the frame it had. */
  const fluidAt = s.nodes.some(isCaptured) ? width : null;
  const live = publishedAt() ?? opts.address?.trim().replace(/\/+$/, "") ?? null;
  /* The link preview a capture recorded, or Link preview set: named only where this browser still has the file. */
  const heads = [s.brief.head, ...s.pages.map((p) => p.head)].flatMap((h) => headPictures(h));
  const here = new Set<string>();
  for (const pic of heads) if (!here.has(pic.id) && (await bytesFor(pic))) here.add(pic.id);
  const held = (pic: Picture) => here.has(pic.id);
  const siteHead = heldHead(s.brief.head, held);
  /* The logo stays the fallback: for the icons when the head names none, for the share picture when it names none. */
  const logo = siteLogo(s.nodes);
  const logoBytes = logo ? await bytesFor(logo) : null;
  const icon = logo && logoBytes ? logo : null;
  const icons = icon && logoBytes && !siteHead?.icons?.length ? await siteIcons(icon, logoBytes) : null;
  const description = s.brief.description?.trim() ?? "";
  const inPlace = inPlaceGroups(s.pages, s.nodes, home);

  /*
   * THE PAGE'S MOTION, IN ITS OWN SHEET. One stylesheet for every page's
   * parts grew with the site: parasiteonsol.fun's twelve pages and their
   * press-opened panels came to 26 MB, past what a publish carries (25). So
   * `site.css` keeps what every page shares (the palette, the faces, the
   * resets, the keyframes) and each page loads the motion of its own parts
   * and its panels', `assets/motion/<page>.css`. Pages switched in place
   * swap their parts and not their head, so a group's pages share one sheet.
   * A group's rules name its host and the path its parts stand under
   * (`motionCss#trigger`), and what many parts say the same way is said
   * once, by a class they share (`cssMerge.ts`).
   * `tests/css-scale.mjs`.
   */
  const nested = new Set(fluidAt !== null ? [...carryOwned(s.nodes).values()].flat() : []);
  const sheetOf = (p: StudioPage) => (inPlace.get(p.id)?.root ?? p).id;
  const pathCode = pathCodes(s.nodes);
  const usedCodes = new Set<string>();
  const motionSheets = new Map<string, string>();
  const shared = new Map<string, string[]>();
  let sheetNo = 0;
  for (const key of new Set(s.pages.filter((p) => !only || only.includes(p.id)).map(sheetOf))) {
    const on = new Set(s.pages.filter((p) => sheetOf(p) === key).map((p) => p.id));
    const css = motionCss(s.nodes.filter((n) => on.has(n.pageId)), undefined, (id) => `#${id}`, nested, pathCode, usedCodes);
    if (!css) continue;
    const folded = shareRules(css, `ms${(sheetNo++).toString(36)}-`);
    motionSheets.set(key, folded.css);
    for (const [box, names] of folded.classes) shared.set(box, [...(shared.get(box) ?? []), ...names]);
  }
  /* The parts under a path a rule names wear their code (`motionCss#trigger`); no other part needs it. */
  const atOf = new Map<string, string>();
  if (usedCodes.size) for (const n of s.nodes) {
    const code = pathCode(n.id);
    if (!code) continue;
    for (let i = code.indexOf("."); i > 0 && i < code.length - 1; i = code.indexOf(".", i + 1)) if (usedCodes.has(code.slice(0, i + 1))) { atOf.set(n.id, code); break; }
  }
  const sheetFile = (key: string) => `assets/motion/${key.replace(/[^\w-]/g, "_")}.css`;

  /*
   * THE CRATES PARTS WEAR. Each is made into its strip of frames before any
   * page is drawn, so the page is drawn with it in the same pass, and each
   * strip is a file of its own under assets/crates/, played by one rule in
   * the stylesheet (`crateLayer.tsx`). A site whose parts wear none carries
   * none of it.
   */
  const crates = new Map<string, CrateSheet>();
  for (const n of s.nodes) {
    if (only && !only.includes(n.pageId)) continue;
    const m = crateOn(s.motion, n.id);
    if (!m || crates.has(m.id)) continue;
    const cell = cellFor(n.w, n.h);
    const sheet = await crateSheet(m, cell.w, cell.h);
    if (sheet) crates.set(m.id, sheet);
  }
  const crateFile = (id: string, sheet: CrateSheet) => `assets/crates/${id}.${sheet.ext}`;

  /* What the pages ask of the two small scripts (`library/siteMotion.ts`), and the markup each page drew, for the keyframes it names. */
  let anyMotion = false;
  let anyParts = false;
  const drawn: string[] = [];
  for (const page of s.pages) {
    if (only && !only.includes(page.id)) continue;
    const up = upOf(page, home);
    setCrateHref((m, sheet) => `${up}${crateFile(m.id, sheet)}`);
    let html = "";
    try {
      ({ html } = markupOf(
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
          /*
           * THE PAGE ON A TABLET AND ON A PHONE (`live/smallCss.ts`,
           * docs/RESPONSIVE.md). The page was one layout at one width, and a
           * phone was served it with a viewport of 1280: the whole desktop,
           * shrunk, its words too small to read. It is still one page, each
           * part drawn once, and below this width the tablet's and the
           * phone's layouts are rules on those same parts, so every script
           * and every motion runs at every width.
           */
          smallAt: smallFrom(width, fluidAt !== null),
        }),
        width,
        [],
      ));
    } finally {
      setCrateHref(null);
    }
    drawn.push(html);
    /*
     * THE WHOLE-SITE MOTIONS AND THE PARTS THAT ANSWER A PRESS. The preview
     * runs them with React; here they are two small scripts, shipped only
     * where a page asks (`library/siteMotion.ts`), so a card that says
     * "Works when published" is true of the published page.
     */
    const onPage = s.nodes.filter((n) => n.pageId === page.id);
    const b = deriveBehaviours(onPage, page.scroll, width);
    const motionTags = siteMotionTags({
      progress: b.progress, backToTop: b.backToTop, backAt: b.backToTopAt, reveal: b.reveal, revealStyle: b.revealStyle, parallax: b.parallax, smooth: b.smooth, smoothStrength: b.smoothStrength, snap: b.snap,
      stops: b.smoothStops, snapParts: b.snapParts, depthParts: b.depthParts,
      intro: b.intro, cursor: b.cursor, cursorPicture: b.cursorPicture, tilt: b.tilt, parts: onPage.filter((n) => !isBehaviourPart(n.featureId)).map((n) => n.id),
      accent: palette.accent, surface: palette.surface,
    }, up);
    if (motionTags) anyMotion = true;
    const partTags = partsTags(onPage, up);
    if (partTags) anyParts = true;
    const title = page.name?.trim() ? (page.id === home.id ? name : `${page.name.trim()} · ${name}`) : name;
    files.push({
      path: pageFile(page, home),
      content: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${pageHead({ title, name, description, icon, icons, up, address: pageAddress(page, home), live, site: siteHead, page: heldHead(page.head, held) })}
<link rel="stylesheet" href="${up}assets/site.css">${motionSheets.has(sheetOf(page)) ? `\n<link rel="stylesheet" href="${up}${sheetFile(sheetOf(page))}">` : ""}
</head>
<body>
<div class="site-root">
${clean(html, page, s.pages, home, nodes, roles, fluidAt, atOf, shared)}
</div>
${pageFeatureTags(carriedFeatures(s.nodes.filter((n) => n.pageId === page.id), fluidAt !== null), up)}
${inPlaceScript(page, inPlace.get(page.id), home)}${motionTags ? `\n${motionTags}` : ""}${partTags ? `\n${partTags}` : ""}
</body>
</html>
`,
    });
  }

  const vars = ROLES.map((r) => `  --${r}: ${palette[r]};`).join("\n");
  const frames = keyframesCss(s.look.keyframes);
  /* Keyframes the parts' own style names, which only the app's stylesheet held; and the browser's fade between pages when the site has more than one. */
  const partFrames = partKeyframesFor(drawn);
  const between = s.pages.length > 1 ? pageTransitionCss(s.format?.["pages.transition"]) : "";
  const motion = frames || motionSheets.size ? [frames, "@media (prefers-reduced-motion: reduce) { .mo, .mo *, .mo-l { animation: none !important; transition: none !important; } }"].filter(Boolean).join("\n") : "";
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
${frameCss(width, fluidAt !== null)}
${motion ? `
/* The site's own motion, as captured: its keyframes (prefixed cap-); each page's parts move in assets/motion/<page>.css. */
${motion}
` : ""}${partFrames ? `
/* Keyframes the parts name in their own style. */
${partFrames}
` : ""}${between ? `
/* From one page to the next, the browser's own fade. */
${between}
` : ""}${crates.size ? `
/* A crate a part wears: its frames in one strip, stepped through (assets/crates/). */
${CRATE_CSS}
` : ""}`;
  files.push({ path: "assets/site.css", content: css });
  for (const [key, sheet] of motionSheets) files.push({ path: sheetFile(key), content: `/* The motion of this page's parts and its panels', as captured: each part's animation, transitions and hover (keyframes in site.css). */\n${sheet}\n` });
  /* Clean addresses on Vercel: tokens/index.html served at /tokens (see cleanHref). */
  files.push({ path: "vercel.json", content: `${JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2)}\n` });
  /* The features the site uses: a tiny runtime and each one's script, static, no framework (`library/works.ts`). */
  files.push(...featureFiles(s.nodes));
  if (anyMotion) files.push({ path: "assets/site-motion.js", content: SITE_MOTION_JS });
  if (anyParts) files.push({ path: "assets/parts.js", content: PARTS_JS });
  for (const [id, sheet] of crates) files.push({ path: crateFile(id, sheet), content: await base64(sheet.blob), encoding: "base64" });
  /* The icons are drawn from the picture, not the picture: they go up whatever the caller does with the pictures. */
  /* The heads' share pictures and icons are among the site's pictures (`sitePictures`), so they are served beside the pages. */
  if (icons) files.push(...icons.files);

  if (opts.pictures !== false) {
    const { files: pictures } = await sitePictures();
    files.push(...pictures);
  }
  return files;
}
