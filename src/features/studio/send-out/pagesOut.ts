/**
 * CLEAN PAGES (create-system "(d) Export", "Pages"; J 2026-10-24: "a clean,
 * readable code export that he or a code chat will keep working on").
 *
 * Today's export copies the preview: every part absolutely placed, inline
 * styles, sizes as long `calc()`s. It looks right and nobody can edit it.
 * This writes the same parts as a Next.js + Tailwind app a person reads:
 *
 *   · layout from the layout tree (`layout/read.ts`): rows and columns as
 *     flex, card grids as grid, gaps and padding said once on the holder,
 *     widths as max-widths. Nothing in the flow is absolutely placed;
 *   · each part's own look and words from the published page (`exportSite`,
 *     the preview's own markup, so a part's paint and words are exactly the
 *     board's) with its placement taken off, and every inline style written
 *     as Tailwind classes, the System's tokens by name (`tailwindOf.ts`);
 *   · each section of a page as its own component in `components/sections/`,
 *     and `app/<route>/page.tsx` as the list of them;
 *   · a part the reader could not put in a flow (over another part, fixed to
 *     the window, sticking out of its holder) stays absolutely placed inside
 *     its holder, and is listed in POLIO.md as "still placed by hand", with
 *     its reason. Counted, never hidden.
 *
 * The pages and sections carry Polio's header line, so the next export
 * writes them again unless someone edited them (`exportSync.ts`).
 *
 * Pure: it reads DOM Documents it is handed (the browser's DOMParser, or
 * jsdom in a test) and returns files. Every import ends in .ts.
 */
import { readLayout, type Flow, type LayoutItem, type LayoutPart, type LayoutTree, type Placed } from "../layout/read.ts";
import type { System } from "../system/model.ts";
import { homeFor, routeOf, type Routed } from "../homePage.ts";
import { htmlToJsx, jsxAttr } from "../scaffolding/jsx.ts";
import { classesOf, declarations, twContext, type TwContext } from "./tailwindOf.ts";
import { POLIO_HEADER, TOKEN_FILES } from "./tokensOut.ts";
import type { LibraryName } from "./libraryOut.ts";

/* ------------------------------------------------------------------ */
/* Reading the published page                                          */
/* ------------------------------------------------------------------ */

/** One part as the published page draws it, its placement apart from its look. */
export interface ExportedPart {
  /** The placing box's style (`.sm-p`): position and size, which the flow replaces, and a few looks (corners, cursor) kept. */
  place: string;
  /** The part's own box (`.mo`): fill, outline, shadow, corners, padding. */
  look: string;
  /** What draws the words or the picture: its style, already as classes. */
  content: { classes: string[]; html: string; words: boolean };
  /** The link the whole part is (the page wraps it in a `display: contents` link), as the app's address. */
  link: { href: string; newTab: boolean } | null;
}

export interface ExportedPage {
  /** The page box's own style (ground, words colour). */
  page: string;
  parts: Map<string, ExportedPart>;
}

/** Classes the published page uses for its own machinery, not for looks: never carried. */
const MACHINE = /^(sm-|mo$|mo-|ms\d|g-)/;

/**
 * Rewrites every element under `root`: its inline style becomes Tailwind
 * classes beside the classes it already had (the published page's own
 * machinery classes taken off), pictures and links point where the app
 * serves them, and the Builder's marks go.
 */
function classify(root: Element, ctx: TwContext, link: (href: string) => string): void {
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const style = el.getAttribute("style");
    const had = (el.getAttribute("class") ?? "").split(/\s+/).filter((c) => c && !MACHINE.test(c));
    if (style !== null) {
      el.removeAttribute("style");
      const cls = [...had, ...classesOf(assetsIn(style), ctx)];
      if (cls.length) el.setAttribute("class", cls.join(" ")); else el.removeAttribute("class");
    } else if (had.length) el.setAttribute("class", had.join(" "));
    else el.removeAttribute("class");
    for (const a of Array.from(el.attributes)) if (a.name.startsWith("data-")) el.removeAttribute(a.name);
    const src = el.getAttribute("src");
    if (src) el.setAttribute("src", assetPath(src));
    const href = el.getAttribute("href");
    if (href !== null && el.tagName.toLowerCase() === "a") el.setAttribute("href", link(href));
  }
}

/** A published page's relative path to a picture or file, as the app serves it from public/. */
export function assetPath(src: string): string {
  return /^(\.\.\/|\.\/)*assets\//.test(src) ? `/${src.replace(/^(\.\.\/|\.\/)*/, "")}` : src;
}
const assetsIn = (css: string) => css.replace(/url\((["']?)((?:\.\.\/|\.\/)*assets\/)/g, (_m, q: string, p: string) => `url(${q}/${p.replace(/^(\.\.\/|\.\/)*/, "")}`);

/** A published page read part by part. `ctx` turns styles into classes; `link` turns a page file link into the app's route. */
export function readExportedPage(doc: Document, ctx: TwContext, link: (href: string) => string = (h) => h): ExportedPage {
  const pageEl = doc.querySelector(".sm-page");
  const parts = new Map<string, ExportedPart>();
  for (const box of Array.from(doc.querySelectorAll(".sm-p[id]"))) {
    /* A part's own box (`.mo` when it moves, a plain div when not) sizes itself (`height: auto`) and holds the content box; a part with no look of its own has the content box straight inside. */
    let first = Array.from(box.children).find((c) => !c.classList.contains("sm-g")) ?? null;
    /* A part that is a link is wrapped in one that draws nothing (\`display: contents\`): the link is kept, the wrapper is not. */
    let wrapLink: ExportedPart["link"] = null;
    while (first && /display:\s*contents/.test(first.getAttribute("style") ?? "") && first.children.length === 1) {
      if (first.tagName.toLowerCase() === "a" && first.getAttribute("href") !== null) wrapLink = { href: link(first.getAttribute("href")!), newTab: first.getAttribute("target") === "_blank" };
      first = first.firstElementChild;
    }
    const isLook = !!first && (first.classList.contains("mo") || /(^|;)\s*height:\s*auto/.test(first.getAttribute("style") ?? ""));
    const mo = isLook ? first : null;
    const inner = isLook ? first!.firstElementChild : first;
    let content: ExportedPart["content"] = { classes: [], html: "", words: false };
    if (inner) {
      const words = /\S/.test(inner.textContent ?? "");
      const style = inner.getAttribute("style") ?? "";
      inner.removeAttribute("style");
      classify(inner, ctx, link);
      content = { classes: classesOf(assetsIn(style), ctx, dropContent), html: inner.innerHTML, words };
    }
    parts.set(box.id, { place: box.getAttribute("style") ?? "", look: assetsIn(mo?.getAttribute("style") ?? ""), content, link: wrapLink });
  }
  return { page: pageEl?.getAttribute("style") ?? "", parts };
}

/** The content box fills its part; the flow sizes the part, so its own sizing is said by the part. */
function dropContent(p: string, v: string): boolean {
  if (p === "width" || p === "height") return v === "100%";
  if (p === "flex") return v === "1 0 auto";
  return p === "box-sizing";
}

/* ------------------------------------------------------------------ */
/* JSX                                                                 */
/* ------------------------------------------------------------------ */

interface El { tag: string; cls: string[]; attrs: [string, string][]; kids: (El | { raw: string } | { use: string })[] }
const el = (tag: string, cls: string[] = [], attrs: [string, string][] = []): El => ({ tag, cls, attrs, kids: [] });

function printJsx(e: El, pad: string): string {
  const attrs = [
    ...e.attrs.map(([k, v]) => `${k}=${jsxAttr(v)}`),
    ...(e.cls.length ? [`className=${jsxAttr(e.cls.join(" "))}`] : []),
  ].join(" ");
  const open = `${pad}<${e.tag}${attrs ? ` ${attrs}` : ""}`;
  if (!e.kids.length) return `${open} />`;
  const kids = e.kids.map((k) => ("raw" in k ? k.raw.split("\n").map((l) => `${pad}  ${l.trim()}`).filter((l) => l.trim()).join("\n") : "use" in k ? `${pad}  <${k.use} />` : printJsx(k, `${pad}  `)));
  return `${open}>\n${kids.join("\n")}\n${pad}</${e.tag}>`;
}

/* ------------------------------------------------------------------ */
/* The tree, as elements                                               */
/* ------------------------------------------------------------------ */

const px = (v: number) => `${Math.round(v * 100) / 100}px`;
const flexAlign = (a: string) => (a === "start" ? "flex-start" : a === "end" ? "flex-end" : a);

function flowDecls(f: Flow, border: Sides = NO_SIDES): [string, string][] {
  const d: [string, string][] = [];
  if (f.display === "grid") {
    d.push(["display", "grid"], ["grid-template-columns", f.columns!.map(px).join(" ")]);
    if (f.gap) d.push(["column-gap", px(f.gap)]);
    if (f.rowGap) d.push(["row-gap", px(f.rowGap)]);
    d.push(["align-items", "start"], ["justify-items", "start"]);
  } else {
    d.push(["display", "flex"]);
    if (f.direction === "column") d.push(["flex-direction", "column"]);
    if (f.align !== "stretch") d.push(["align-items", flexAlign(f.align)]);
    if (f.gap) d.push(["gap", px(f.gap)]);
  }
  const p = { top: Math.max(0, f.pad.top - border.top), right: Math.max(0, f.pad.right - border.right), bottom: Math.max(0, f.pad.bottom - border.bottom), left: Math.max(0, f.pad.left - border.left) };
  if (p.top || p.right || p.bottom || p.left) d.push(["padding", `${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)}`]);
  if (f.minHeight != null) d.push(["min-height", px(f.minHeight)]);
  if (f.placed.length) d.push(["position", "relative"]);
  return d;
}

function itemDecls(it: LayoutItem, parent: Flow): [string, string][] {
  const d: [string, string][] = [];
  const self = it.self ?? parent.align;
  if (parent.display === "grid") {
    d.push(["width", "100%"], ["max-width", px(it.maxWidth)]);
    if (it.before) d.push(["margin-top", px(it.before)]);
    if (it.offset) d.push(["margin-left", px(it.offset)]);
  } else if (parent.direction === "column") {
    d.push(["width", "100%"]);
    if (!it.fill) d.push(["max-width", px(it.maxWidth)]);
    d.push(["flex", "none"]);
    if (it.self) d.push(["align-self", flexAlign(it.self)]);
    if (it.before) d.push(["margin-top", px(it.before)]);
    if (it.offset && (self === "start" || self === "stretch")) d.push(["margin-left", px(it.offset)]);
  } else {
    d.push(["flex", `0 1 ${px(it.maxWidth)}`], ["min-width", "0px"]);
    d.push(["align-self", flexAlign(self === "stretch" ? "start" : self)]);
    if (it.before) d.push(["margin-left", px(it.before)]);
    if (it.offset && (self === "start" || self === "stretch")) d.push(["margin-top", px(it.offset)]);
  }
  /* A part with nothing in flow inside keeps the board's height, words too: a line box a hair taller than the board's (a 46px heading at 47.8) would otherwise push everything under it down, part after part. Words that outgrow it show past it, never cut. */
  if (it.height != null) d.push(["height", px(it.height)]);
  return d;
}

/** The placing box's own looks that are not placement: kept on the part. */
const PLACE_KEEP = new Set(["border-radius", "cursor", "z-index", "pointer-events", "opacity", "transform", "rotate", "scale", "translate", "filter", "mix-blend-mode", "clip-path", "isolation"]);
/** The part box's sizing, which the flow says instead. */
const LOOK_SIZING = new Set(["width", "height", "flex", "box-sizing", "min-width", "min-height"]);
/** A holder's own arrangement, which its flow says instead. */
const LOOK_FLOW = new Set(["padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "display", "flex-direction", "align-items", "justify-content", "justify-items", "place-items", "place-content", "align-content", "gap", "row-gap", "column-gap", "flex-wrap", "grid-template-columns", "grid-template-rows", "grid-auto-flow", "grid-auto-rows", "grid-auto-columns"]);

type Sides = { top: number; right: number; bottom: number; left: number };
const NO_SIDES: Sides = { top: 0, right: 0, bottom: 0, left: 0 };
/** How wide a look's border is on each side: padding sits inside it, and so does what is placed. */
export function borderOf(look: [string, string][]): Sides {
  const b = { ...NO_SIDES };
  const width = (v: string) => { const m = /(-?\d*\.?\d+)px/.exec(v); return m && !/\b(none|hidden)\b/.test(v) ? parseFloat(m[1]!) : 0; };
  const keys = ["top", "right", "bottom", "left"] as const;
  for (const [p, v] of look) {
    if (p === "border") { const n = width(v); for (const k of keys) b[k] = n; }
    else if (p === "border-width") { const w = v.trim().split(/\s+/).map(width); const [t, r = t, bo = t, l = r] = w; Object.assign(b, { top: t, right: r, bottom: bo, left: l }); }
    else { const m = /^border-(top|right|bottom|left)(-width)?$/.exec(p); if (m) b[m[1] as keyof Sides] = width(v); }
  }
  return b;
}
/** Words' looks, which the part's own box can carry for its content (they pass down). */
const INHERITED = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "white-space", "overflow-wrap", "word-wrap", "text-decoration", "text-decoration-line"]);

interface Walk {
  exported: ExportedPage;
  ctx: TwContext;
  sections: Map<string, string>;
  /** Section components written, by name, with their element. */
  out: Map<string, El>;
  missing: string[];
  /** The part's System component, when it is an instance of one the library writes. */
  instance: (id: string) => Instance | null;
}

/** A part drawn as a library component: its name, its variant, and the look properties the variant already says. */
interface Instance { name: string; variant: string; pressable: boolean; covers: Set<string> }
const SLOT_PROPS: Record<string, string[]> = { fill: ["background", "background-color"], words: ["color"], shadow: ["box-shadow"], radius: ["border-radius"], face: ["font-family"], size: ["font-size"] };

function partEl(id: string, flow: Flow | null, layout: [string, string][], w: Walk): El {
  const ex = w.exported.parts.get(id);
  if (!ex) {
    w.missing.push(id);
    const e = el("div", classesOf(layout, w.ctx), [["id", id]]);
    if (flow) fill(e, flow, w, NO_SIDES);
    return e;
  }
  const placeDecls = declarations(ex.place);
  /* A part that sticks as the page scrolls keeps sticking, at the same distance from the top. */
  const sticky = placeDecls.some(([p, v]) => p === "position" && v === "sticky") && !layout.some(([p]) => p === "position");
  const keep = [...placeDecls.filter(([p]) => PLACE_KEEP.has(p)), ...(sticky ? placeDecls.filter(([p]) => p === "position" || p === "top") : [])];
  const inst = w.instance(id);
  const look = declarations(ex.look).filter(([p]) => !LOOK_SIZING.has(p) && !(flow && LOOK_FLOW.has(p)));
  /* An instance says its variant's look by the variant's name; the part keeps only what the variant does not say. */
  const own = inst ? look.filter(([p]) => !inst.covers.has(p)) : look;
  const content = ex.content;
  const onlyWords = content.classes.length === 0 || (!flow && contentInherits(content.classes));
  const e = el("div", [...classesOf(layout, w.ctx), ...classesOf([...keep, ...own], w.ctx, (p) => p === "position" && !flow)], [["id", id]]);
  /* A holder's own words or picture lie over it, inside its padding, as the board draws them; its parts flow over them. An empty one is nothing. */
  if (flow && content.html.trim()) {
    const pad = declarations(ex.look).filter(([p]) => p.startsWith("padding"));
    const inner = el("div", ["absolute", "inset-0", ...classesOf(pad, w.ctx), ...content.classes.filter((c) => !POSITIONED.includes(c))]);
    inner.kids.push({ raw: htmlToJsx(content.html, "") });
    e.kids.push(inner);
    if (!e.cls.some((c) => POSITIONED.includes(c))) e.cls.push("relative");
  } else if (!flow && (content.html.trim() || (!onlyWords && content.classes.length))) {
    if (onlyWords) {
      /* A leaf whose content box only says how its words look: said on the part, the words straight inside. */
      for (const c of content.classes) if (!e.cls.includes(c)) e.cls.push(c);
      if (content.html.trim()) e.kids.push({ raw: htmlToJsx(content.html, "") });
    } else {
      const inner = el("div", content.classes);
      if (content.html.trim()) inner.kids.push({ raw: htmlToJsx(content.html, "") });
      e.kids.push(inner);
    }
  }
  const interactive = /<(a|button)[\s>]/.test(content.html);
  if (inst) {
    e.tag = inst.name;
    e.attrs.unshift(["variant", inst.variant]);
    /* A button may not hold a button or a link: one that holds its own (the page's words are a button already) draws as a div. */
    if (inst.pressable && (interactive || !!flow) && !(ex.link && !flow && !interactive)) e.attrs.push(["as", "div"]);
    else if (inst.pressable && !ex.link && !e.cls.some((c) => /^text-(left|center|right|justify|start|end)$/.test(c))) e.cls.push("text-start");
  }
  if (ex.link) linkPart(e, ex.link, !!flow || interactive, !!inst);
  if (flow) fill(e, flow, w, borderOf(look));
  return e;
}

/** A part that is a link: an `<a>` itself, or, when it holds parts or links of its own (a link may not hold a link), a link laid over it. */
function linkPart(e: El, link: NonNullable<ExportedPart["link"]>, holds: boolean, component = false): void {
  const attrs: [string, string][] = [["href", link.href], ...(link.newTab ? [["target", "_blank"], ["rel", "noopener"]] as [string, string][] : [])];
  /* A library component given an href draws as a link itself. */
  if (!holds && component) { e.attrs.push(...attrs); if (!e.cls.some((c) => /^(flex|grid|block|inline|hidden|contents)/.test(c))) e.cls.push("block"); return; }
  if (!holds) { e.tag = "a"; e.attrs.push(...attrs); if (!e.cls.some((c) => /^(flex|grid|block|inline|hidden|contents)/.test(c))) e.cls.push("block"); return; }
  const over = el("a", ["absolute", "inset-0", "z-[1]"], [...attrs, ["aria-label", "Open"]]);
  e.kids.unshift(over);
  if (!e.cls.some((c) => POSITIONED.includes(c))) e.cls.push("relative");
}

/** A content box whose classes are all words' looks (they pass down to the words). */
function contentInherits(classes: string[]): boolean {
  return classes.every((c) => /^(text-|font-|leading-|tracking-|uppercase|lowercase|capitalize|normal-case|whitespace-|wrap-|italic|not-italic|underline|no-underline|line-through|relative$)/.test(c));
}

const POSITIONED = ["relative", "absolute", "sticky", "fixed"];

/**
 * A holder that hides what spills out also catches a sticky part inside it
 * (it becomes what the part sticks in, so the part never sticks to the
 * window). Above a sticky part, `overflow-hidden` is `overflow-clip`: the
 * same cut, and the part sticks to the window as the board's does.
 */
function letStick(e: El, sections: Map<string, El>): boolean {
  let holds = false;
  for (const k of e.kids) {
    const kid = "tag" in k ? k : "use" in k ? sections.get(k.use) : undefined;
    if (kid && letStick(kid, sections)) holds = true;
  }
  if (holds) e.cls = e.cls.map((c) => (c === "overflow-hidden" ? "overflow-clip" : c));
  return holds || e.cls.includes("sticky");
}

function fill(e: El, f: Flow, w: Walk, border: Sides = NO_SIDES): void {
  const placedAlready = e.cls.some((c) => POSITIONED.includes(c));
  for (const c of classesOf(flowDecls(f, border), w.ctx)) if (!e.cls.includes(c) && !(c === "relative" && placedAlready)) e.cls.push(c);
  for (const it of f.items) e.kids.push(itemOrSection(it, f, w));
  for (const p of f.placed) e.kids.push(placedEl(p, w, border));
}

function itemOrSection(it: LayoutItem, parent: Flow, w: Walk): El | { use: string } {
  const layout = itemDecls(it, parent);
  const e = it.part ? partEl(it.part, it.flow, layout, w) : (() => { const g = el("div", classesOf(layout, w.ctx)); if (it.flow) fill(g, it.flow, w); return g; })();
  const name = w.sections.get(it.id);
  if (!name) return e;
  w.out.set(name, e);
  return { use: name };
}

function placedEl(p: Placed, w: Walk, border: Sides): El {
  const words = !!w.exported.parts.get(p.id)?.content.words;
  /* Fixed to the window on the board stays fixed: it is placed against the window, so its holder's border does not move it. */
  const fixed = p.why === "fixed to the window";
  const layout: [string, string][] = [["position", fixed ? "fixed" : "absolute"], ["left", px(fixed ? p.box.x : p.left - border.left)], ["top", px(fixed ? p.box.y : p.top - border.top)], ["width", px(p.box.w)], [words || p.flow ? "min-height" : "height", px(p.box.h)]];
  return partEl(p.id, p.flow, layout, w);
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export interface PagesNode extends LayoutPart { label?: string | null; state?: unknown; sys?: { c?: { component: string; variant: string } | null } | null }
export interface PagesInput {
  /** The site's name, for the layout's title. */
  name: string;
  description?: string;
  pages: (Routed & { id: string; name?: string | null })[];
  nodes: PagesNode[];
  frameWidth: number;
  system: System | null;
  /** The six colour roles, for a role the System has no token for. */
  palette?: Record<string, string>;
  /** Each page's published document (`exportSite`'s HTML, parsed), by page id. */
  published: Map<string, Document>;
  /** The component library's names (\`libraryOut.ts\`): a part linked to a System component is written as it. */
  library?: Map<string, LibraryName>;
  /** The published site's stylesheet (`assets/site.css`): its font faces and keyframes are carried. */
  siteCss?: string;
}

export interface StillPlaced { page: string; id: string; label: string; why: string }
export interface PagesReport {
  pages: number;
  sections: number;
  parts: number;
  grouped: number;
  /** Parts written as a library component (`<Button variant="main">`). */
  instances: number;
  placed: StillPlaced[];
  /** Parts shown only on a press: not on the page as it opens, not written (listed). */
  states: { page: string; id: string; label: string }[];
  /** Parts the layout holds that the published page did not draw (hidden, empty). */
  missing: string[];
}
export interface PagesOut { files: { path: string; content: string }[]; report: PagesReport; trees: LayoutTree[] }

/** A name a person reads, as a component name: "Hero, dark" → "HeroDark". */
export function pascal(s: string): string {
  const w = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const n = w.map((x) => x[0]!.toUpperCase() + x.slice(1)).join("");
  return /^[A-Z]/.test(n) ? n : n ? `S${n}` : "";
}

const HEADER_TSX = `/* ${POLIO_HEADER} */`;

/** The four lines a Next.js app needs for Tailwind and the tokens, and the published site's font faces and keyframes. */
export function globalsCss(siteCss = ""): string {
  const keep: string[] = [];
  /* @font-face and @keyframes blocks, whole: the faces the parts wear and the motion they name. */
  const re = /@(font-face|keyframes\s+[\w-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(siteCss))) {
    let depth = 0, i = m.index + m[0].length - 1;
    for (; i < siteCss.length; i++) { if (siteCss[i] === "{") depth++; else if (siteCss[i] === "}" && --depth === 0) break; }
    keep.push(siteCss.slice(m.index, i + 1));
    re.lastIndex = i + 1;
  }
  return `/* ${POLIO_HEADER}
 * Tailwind, the design tokens, and the font faces and keyframes the site carries.
 */
@import "tailwindcss";
@import "../${TOKEN_FILES.css}";
@import "../${TOKEN_FILES.tailwind}";
@source "../app";
@source "../components";
${keep.length ? `\n${keep.join("\n")}\n` : ""}`;
}

export function layoutTsx(name: string, description: string, bodyClasses: string[]): string {
  return `${HEADER_TSX}
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(name || "Site")},
  description: ${JSON.stringify(description)},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body${bodyClasses.length ? ` className=${jsxAttr(bodyClasses.join(" "))}` : ""}>{children}</body>
    </html>
  );
}
`;
}

/** A page file link (`about/index.html`, `../`, `./`) as the app's route (`/about`, `/`). */
export function routeLink(href: string, routes: Map<string, string>, from: string): string {
  if (/^([a-z]+:|#|\/\/)/i.test(href)) return href;
  const base = from.split("/").slice(0, -1);
  const parts = [...base];
  for (const seg of href.split("#")[0]!.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  let file = parts.join("/");
  if (!file || !file.endsWith(".html")) file = `${file ? `${file}/` : ""}index.html`;
  const hash = href.includes("#") ? `#${href.split("#")[1]}` : "";
  const route = routes.get(file);
  if (route !== undefined) return `/${route}${hash}`;
  return /^(\.\.\/|\.\/)*assets\//.test(href) ? assetPath(href) : href;
}

/** The clean pages of a site: its layout, a component per section, a page per page. */
export function pagesOut(input: PagesInput): PagesOut {
  const ctx = twContext(input.system, input.palette);
  const home = homeFor(input.pages);
  const routes = new Map(input.pages.map((p) => [home.file(p), routeOf(home, p)]));
  const label = (id: string) => input.nodes.find((n) => n.id === id)?.label?.trim() || id;
  const files: { path: string; content: string }[] = [];
  const report: PagesReport = { pages: 0, sections: 0, parts: 0, grouped: 0, instances: 0, placed: [], states: [], missing: [] };
  const trees: LayoutTree[] = [];
  const used = new Set<string>();
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  const comps = new Map((input.system?.components ?? []).map((c) => [c.id, c]));
  const instance = (id: string): Instance | null => {
    const c = byId.get(id)?.sys?.c;
    const lib = c && input.library?.get(c.component);
    const variant = lib && lib.variants.get(c!.variant);
    const v = comps.get(c?.component ?? "")?.variants.find((x) => x.id === c?.variant);
    if (!lib || !variant || !v) return null;
    report.instances++;
    return { name: lib.name, variant, pressable: ["button", "tab", "copy-bar"].includes(lib.kind), covers: new Set(Object.keys(v.look).flatMap((slot) => SLOT_PROPS[slot] ?? [])) };
  };
  /* The library components a file draws, imported from components/ui. */
  const libNames = [...(input.library?.values() ?? [])].map((n) => n.name);
  const uiImport = (jsx: string) => {
    const drawn = libNames.filter((n) => new RegExp(`<${n}[\\s/>]`).test(jsx));
    return drawn.length ? `import { ${drawn.join(", ")} } from "@/components/ui";` : "";
  };

  let bodyClasses: string[] = [];

  for (const page of input.pages) {
    const doc = input.published.get(page.id);
    if (!doc) continue;
    const file = home.file(page);
    const exported = readExportedPage(doc, ctx, (h) => routeLink(h, routes, file));
    const tree = readLayout(input.nodes, { pageId: page.id, width: input.frameWidth });
    trees.push(tree);
    const pageName = page.name?.trim() || routeOf(home, page) || "Home";
    report.pages++;
    report.parts += tree.counts.parts;
    report.grouped += tree.counts.grouped;
    for (const p of tree.placed) report.placed.push({ page: pageName, id: p.id, label: label(p.id), why: p.why });
    for (const s of tree.states) report.states.push({ page: pageName, id: s, label: label(s) });

    /* Each section's component name, unique across the site: what it says (its first heading), else what it is (header, footer), else its place. */
    const sections = new Map<string, string>();
    tree.sections.forEach((s, i) => {
      const stem = sectionName(s.id, tree, label) || pascal(`${pascal(pageName) || "Page"} section ${i + 1}`) || `Section${i + 1}`;
      let n = stem;
      for (let k = 2; used.has(n.toLowerCase()) || n === "Page" || n === "RootLayout"; k++) n = `${stem}${k}`;
      used.add(n.toLowerCase());
      sections.set(s.id, n);
    });

    const w: Walk = { exported, ctx, sections, out: new Map(), missing: [], instance };
    /* The page's ground and words colour go on the body, said once for the site (the home page's). */
    const pageLook = declarations(exported.page).filter(([p]) => ["background", "background-color", "color", "font-family", "font-size", "line-height"].includes(p));
    if (!bodyClasses.length) bodyClasses = classesOf(pageLook, ctx);
    const main = el("main", ["relative", "w-full", "overflow-x-clip"]);
    fill(main, tree.root, w);
    letStick(main, w.out);
    report.missing.push(...w.missing);
    report.sections += w.out.size;

    for (const [name, sec] of w.out) {
      const jsx = printJsx(sec, "    ");
      files.push({ path: `components/sections/${name}.tsx`, content: `${HEADER_TSX}\n${uiImport(jsx)}${uiImport(jsx) ? "\n" : ""}export default function ${name}() {\n  return (\n${jsx}\n  );\n}\n` });
    }
    const route = routeOf(home, page);
    const jsx = printJsx(main, "    ");
    const imports = [uiImport(jsx), ...[...w.out.keys()].map((n) => `import ${n} from "@/components/sections/${n}";`)].filter(Boolean).join("\n");
    files.push({
      path: route ? `app/${route}/page.tsx` : "app/page.tsx",
      content: `${HEADER_TSX}\n${imports}${imports ? "\n\n" : ""}export default function Page() {\n  return (\n${jsx}\n  );\n}\n`,
    });
  }
  files.push({ path: "app/globals.css", content: globalsCss(input.siteCss) });
  files.push({ path: "app/layout.tsx", content: layoutTsx(input.name, input.description ?? "", bodyClasses) });
  return { files, report, trees };
}

const ROLE_NAME: Record<string, string> = { banner: "Header", contentinfo: "Footer", navigation: "Nav", complementary: "Aside", header: "Header", footer: "Footer", nav: "Nav", form: "Form" };
const SMALL = new Set(["a", "an", "the", "of", "to", "and", "or", "in", "on", "for", "with", "is", "it", "its", "your", "you", "we", "our"]);

/** A section's name from what it holds: the words of its first heading or titled part ("heading “An agent you can watch think.”" → AgentCanWatch), else its role (a banner is the Header). */
export function sectionName(id: string, tree: LayoutTree, label: (id: string) => string): string {
  const ids: string[] = [];
  const walk = (f: Flow | null) => { if (!f) return; for (const it of f.items) { if (it.part) ids.push(it.part); walk(it.flow); } for (const p of f.placed) { ids.push(p.id); walk(p.flow); } };
  const find = (f: Flow | null): LayoutItem | null => { if (!f) return null; for (const it of f.items) { if (it.id === id) return it; const got = find(it.flow); if (got) return got; } for (const p of f.placed) { const got = find(p.flow); if (got) return got; } return null; };
  const item = find(tree.root);
  if (item?.part) ids.push(item.part);
  walk(item?.flow ?? null);
  const role = item?.part ? label(item.part).split(/\s*·/)[0]!.trim().toLowerCase() : "";
  if (ROLE_NAME[role]) return ROLE_NAME[role]!;
  /* A heading or a titled region says what the section is about; a link or a button in it says less, so it is only the fallback. */
  const titled = (l: string) => /^(heading|region)\b/.test(l);
  for (const pass of [titled, () => true]) {
    for (const pid of ids) {
      const l = label(pid);
      const m = pass(l) ? /“([^”…]+)/.exec(l) : null;
      if (!m) continue;
      const words = m[1]!.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
      const n = pascal(words.slice(0, 3).join(" "));
      if (n.length >= 3) return n;
    }
  }
  return "";
}

/** The POLIO.md section the clean export adds: what is still placed by hand, and why. */
export function stillPlacedMd(report: PagesReport): string {
  const lines = [
    "## Still placed by hand",
    "",
    `${report.grouped} of ${report.parts} parts are laid out by flex and grid. ${report.placed.length} are still placed by hand: absolutely, inside the box that holds them, because the layout reader could not put them in a row, a column or a grid. Each says why. Moving one into the flow is a good first edit.`,
    "",
    "Each part with nothing inside it keeps the board's height (`h-[…]`), so the page stands exactly as the board does. Words that grow past it show past it; take the height off a box to let it grow with its words.",
    "",
  ];
  if (report.placed.length) {
    lines.push("| Page | Part | Id | Why |", "|---|---|---|---|");
    for (const p of report.placed) lines.push(`| ${p.page} | ${p.label.replace(/\|/g, "/")} | \`${p.id}\` | ${p.why.replace(/\|/g, "/")} |`);
    lines.push("");
  }
  if (report.states.length) lines.push(`${report.states.length} parts show only on a press (a menu opened, a tab chosen) and are not written in the pages yet: ${report.states.slice(0, 12).map((s) => `\`${s.id}\``).join(", ")}${report.states.length > 12 ? "…" : ""}.`, "");
  return lines.join("\n");
}
