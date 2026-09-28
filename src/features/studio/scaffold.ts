/**
 * The codebase, written from the document rather than described to a model.
 *
 * Build used to hand Claude the blueprint and ask for every file. The
 * blueprint is words, and words are lossy about looks: "a heading, 28px,
 * accent" is not `oklch(0.86 0.19 158)`, `letter-spacing: -0.02em`, the
 * shadow the page's lamp casts at that spot, or the texture the surface
 * wears. Every re-generation drifted, and the site that came back was a
 * cousin of the one on the board.
 *
 * So the looks are not generated at all any more. The document already
 * holds them exactly, the Builder already renders them exactly, and this
 * turns that into a codebase: design tokens off the palette, one component
 * per part carrying the markup the part actually rendered — styles, shape,
 * clip, texture, light and all — and pages that place them where the board
 * places them. Deterministic: the same document gives the same files, byte
 * for byte, every time.
 *
 * What is left for Claude is what a document genuinely does not contain:
 * an Idea part with no body written yet, where data comes from, and what
 * behaviour a part should have beyond the state the board can show. The
 * brief is the narrative for that, and the screenshots are the reference.
 *
 * Pure, and tested by `tests/scaffold.mjs`.
 */
import { paintRoles, roleVars } from "./bodyPaint.ts";
import { auraStyle, entranceCss, type AnimDelay, type AnimEase, type AnimSpeed, type AuraStyle, type Palette } from "./look.ts";
import { homeOf } from "./homePage.ts";

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldPage {
  id: string;
  name: string;
  path: string;
  prompt?: string;
  /** The page's behaviours, derived the way the live page derives them (`deriveBehaviours`). */
  behaviours?: ExportBehaviours;
  /** The page at tablet and phone, placed the way the live page places it (`placeNodes`); the desktop placement is on the parts. */
  layouts?: { tablet?: ExportLayout; phone?: ExportLayout };
}

/** One device's layout of a page: its size, and where each part sits in it. */
export interface ExportLayout {
  width: number;
  height: number;
  placed: { id: string; x: number; y: number; w: number; h: number }[];
}

/** The switches a page's tier-B parts set. The same shape as the live page's `Behaviours`, kept here so the scaffold stays pure. */
export interface ExportBehaviours {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  tilt: boolean;
  confetti: boolean;
  described: { id: string; label: string }[];
  any: boolean;
}

export interface ScaffoldPart {
  id: string;
  pageId: string;
  /** The catalog id, for the comment at the top of the component. */
  featureId: string;
  label: string;
  prompt?: string;
  /** Where and how big, at the frame's own width. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The markup the part actually rendered, as HTML. */
  html: string;
  /** The exact edge it is cut to, when it has one. */
  outline?: { cut: string; closed: boolean } | null;
  /** A written body, when it has one: rendered in a frame with no permissions. */
  code?: { html: string; note?: string } | null;
  /**
   * The six faces, when it is a cube.
   *
   * The one part whose markup is not the answer: a snapshot of a cube is a
   * picture of one angle of it. This is data and behaviour, so it is
   * written out as a component that turns.
   */
  cube?: { faces: { heading: string; body: string; colour: string }[]; turn?: { x: number; y: number } } | null;
  /** True when nothing has been written for it yet: this is what Claude is for. */
  empty?: boolean;
  /** What it reads, when the board says it reads something. */
  data?: string;
  /** Its entrance on the live page, as the wheel's Animation shard set it. */
  anim?: string | null;
  animSpeed?: number | AnimSpeed;
  animDelay?: number | AnimDelay;
  animEase?: AnimEase;
  /** The colour round its edge, when it wears one. */
  aura?: string | null;
  auraSize?: number;
  auraStyle?: AuraStyle;
  /** Where a click on it goes: a page by id, path or name; a part on the page by id; a URL. */
  link?: { kind: "page" | "node" | "url"; target: string } | null;
  /** The solid, when it is one: written as a component that turns, the still as its fallback. */
  mesh?: { glb: string; still?: string; turn?: { x: number; y: number }; from?: string } | null;
}

export interface ScaffoldInput {
  name: string;
  gimmick?: string;
  master?: string;
  frameWidth: number;
  pages: ScaffoldPage[];
  parts: ScaffoldPart[];
  /** The six roles, resolved to colours. */
  palette: Record<string, string>;
  /** Fonts, radius, and the rest of the format, already resolved. */
  tokens: Record<string, string | number>;
  /** The page's own background, texture included, as CSS. */
  pageCss?: Record<string, string>;
  /** The keyframes the page's own paint names (`driftKeyframes`), written into the stylesheet. */
  keyframes?: string[];
  /** The `@font-face` rules for the faces the site carries (`fontFaceCss`), written into the stylesheet so the built site draws in the real files. */
  fontCss?: string;
  /** The wash over the page, when a texture lands over everything. */
  overlayCss?: Record<string, string>;
  /** The veil over the page, as a colour, when the look has one. */
  veil?: string;
  /** The backdrop chosen with no texture: a gradient, a grid, or the page colour. */
  backdrop?: string;
}

/**
 * The keyframes the live page's stylesheet carries and an exported site
 * has to carry too: the entrances a part can make, and the aura's pulse.
 * Copied from `app/globals.css`, where the Builder's own live page reads
 * them; the export used to name them and define none.
 */
export const EXPORT_KEYFRAMES = `/* Entrances, as the Builder's live page plays them. */
@keyframes el-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes el-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes el-drop { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: none; } }
@keyframes el-left { from { opacity: 0; transform: translateX(-26px); } to { opacity: 1; transform: none; } }
@keyframes el-right { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }
@keyframes el-grow { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }
@keyframes el-blur { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0); } }
@keyframes el-flip { from { opacity: 0; transform: perspective(700px) rotateX(-24deg); } to { opacity: 1; transform: none; } }
/* An aura that pulses. */
@keyframes aura-pulse {
  0%, 100% { box-shadow: 0 0 0 1px var(--aura), 0 0 calc(12px * var(--aura-k)) calc(1px * var(--aura-k)) var(--aura); }
  50% { box-shadow: 0 0 0 1px var(--aura), 0 0 calc(30px * var(--aura-k)) calc(7px * var(--aura-k)) var(--aura); }
}
@keyframes aura-pulse-shape {
  0%, 100% { filter: drop-shadow(0 0 1px var(--aura)) drop-shadow(0 0 calc(6px * var(--aura-k)) var(--aura)); }
  50% { filter: drop-shadow(0 0 1px var(--aura)) drop-shadow(0 0 calc(15px * var(--aura-k)) var(--aura)); }
}
`;

/**
 * A style object as JSX writes it: plain keys bare, a CSS variable quoted,
 * and the whole cast to `CSSProperties` when a variable is in it, since
 * React's style type does not know custom properties and the export has
 * to typecheck.
 */
function styleJsx(style: Record<string, string | number>): string {
  const body = `{ ${Object.entries(style).map(([k, v]) => `${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
  return Object.keys(style).some((k) => k.startsWith("--")) ? `${body} as CSSProperties` : body;
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Where a link goes in the exported site, as an href, the way the live page resolves it. */
export function hrefOf(link: ScaffoldPart["link"], pages: ScaffoldPage[]): { href: string; newTab: boolean } | null {
  if (!link || !link.target.trim()) return null;
  const t = link.target.trim();
  if (link.kind === "url") return { href: t, newTab: true };
  if (link.kind === "node") return { href: `#${t}`, newTab: false };
  const page =
    pages.find((p) => p.id === t) ??
    pages.find((p) => p.path === t || p.path === "/" + slugOf(t)) ??
    pages.find((p) => p.name.toLowerCase() === t.toLowerCase()) ??
    (t.toLowerCase() === "home" || t === "/" ? homeOf(pages) ?? null : null);
  return page ? { href: page.path, newTab: false } : null;
}

/* ------------------------------------------------------------------ */
/* HTML → JSX                                                          */
/* ------------------------------------------------------------------ */

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** React's names for the attributes HTML spells differently. */
const ATTR: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  maxlength: "maxLength",
  readonly: "readOnly",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  novalidate: "noValidate",
  enctype: "encType",
  "xlink:href": "xlinkHref",
  "xml:lang": "xmlLang",
};

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** One CSS declaration list as a React style object literal. */
export function styleToObject(css: string): string {
  const out: string[] = [];
  for (const bit of splitDeclarations(css)) {
    const i = bit.indexOf(":");
    if (i < 0) continue;
    const key = bit.slice(0, i).trim();
    const value = bit.slice(i + 1).trim();
    if (!key || !value) continue;
    const name = key.startsWith("--") ? `"${key}"` : camel(key);
    out.push(`${name}: ${JSON.stringify(value)}`);
  }
  return `{ ${out.join(", ")} }`;
}

/**
 * A declaration list, split into declarations.
 *
 * Not `split(";")`: a data: URI has semicolons in it (`;base64`), and so
 * does a font stack with an escaped one. Parentheses and quotes are
 * counted, so `background-image: url(data:image/png;base64,AA==)` stays
 * one declaration.
 */
function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out;
}

/** Text that JSX would read as code, made into text again. */
const escapeText = (s: string) => s.replace(/[{}]/g, (c) => `{"${c}"}`);

/**
 * The markup a part rendered, as JSX.
 *
 * Not a general HTML parser: the input is React's own output, so tags are
 * balanced, attributes are quoted, and there is nothing exotic in it. What
 * it has to get right is the handful of names React spells differently,
 * inline styles (which is where every part keeps its looks), and braces in
 * text.
 */
export function htmlToJsx(html: string, indent = "    "): string {
  let out = "";
  let i = 0;
  const push = (s: string) => { out += s; };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      push(escapeText(html.slice(i)));
      break;
    }
    if (lt > i) push(escapeText(html.slice(i, lt)));
    // A comment: React's output has none, but a hand-written body might.
    if (html.startsWith("<!--", lt)) {
      i = html.indexOf("-->", lt) + 3;
      continue;
    }
    const gt = findTagEnd(html, lt);
    const raw = html.slice(lt, gt + 1);
    if (raw.startsWith("</")) {
      push(raw);
      i = gt + 1;
      continue;
    }
    const nameEnd = raw.search(/[\s/>]/);
    const tag = raw.slice(1, nameEnd < 0 ? raw.length - 1 : nameEnd);
    const attrs = parseAttrs(raw.slice(nameEnd, raw.endsWith("/>") ? -2 : -1));
    const written = attrs
      .map(({ name, value }) => {
        if (/^(data|aria)-/.test(name)) return `${name}=${JSON.stringify(value)}`;
        if (name === "style") return `style={${styleToObject(value)}}`;
        const jsxName = ATTR[name] ?? (name.includes("-") ? camel(name) : name);
        return `${jsxName}=${JSON.stringify(value)}`;
      })
      .join(" ");
    const selfClosing = VOID_TAGS.has(tag) || raw.endsWith("/>");
    push(`<${tag}${written ? ` ${written}` : ""}${selfClosing ? " />" : ">"}`);
    i = gt + 1;
  }
  return out.split("\n").map((l) => indent + l).join("\n").trim();
}

/** The `>` that closes a tag, skipping any inside quoted attribute values. */
function findTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from + 1; i < html.length; i++) {
    const c = html[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return html.length - 1;
}

function parseAttrs(s: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const re = /([:\w-]+)\s*=\s*"([^"]*)"|([:\w-]+)\s*=\s*'([^']*)'|([:\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const name = m[1] ?? m[3] ?? m[5]!;
    const value = m[2] ?? m[4] ?? "";
    out.push({ name, value: decode(value) });
  }
  return out;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

/** A React component name from a part's label, unique by its id. */
export function componentName(part: ScaffoldPart): string {
  const words = part.label.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const base = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join("") || "Part";
  const tail = part.id.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  return /^[0-9]/.test(base) ? `Part${base}${tail}` : `${base}${tail}`;
}

/** A line cut to length at a word, with a mark to say it was cut. */
const trim = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max) > max * 0.6 ? s.lastIndexOf(" ", max) : max)}…`);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";

/* ------------------------------------------------------------------ */
/* The files                                                           */
/* ------------------------------------------------------------------ */

/** Every file the document itself decides. */
export function scaffold(input: ScaffoldInput): ScaffoldFile[] {
  const files: ScaffoldFile[] = [];
  files.push({ path: "app/globals.css", content: tokensCss(input) });
  files.push({ path: "app/layout.tsx", content: layoutTsx(input) });
  files.push({ path: "components/Frame.tsx", content: FRAME_TSX });
  // The shell, when any page has a behaviour for it to run.
  if (input.pages.some((p) => p.behaviours?.any)) files.push({ path: "components/Shell.tsx", content: SHELL_TSX });

  for (const part of input.parts) files.push({ path: `components/parts/${componentName(part)}.tsx`, content: partTsx(part, input.palette) });

  for (const page of input.pages) {
    const parts = input.parts.filter((p) => p.pageId === page.id);
    const dir = page.path === "/" ? "app" : `app/${slug(page.path)}`;
    files.push({ path: `${dir}/page.tsx`, content: pageTsx(page, parts, input) });
  }
  files.push({ path: "BUILD.md", content: buildMd(input) });
  return files;
}

/**
 * A cube, written out.
 *
 * Everything else in this file is markup the Builder rendered, because for
 * everything else the markup *is* the part. A cube is six faces and the
 * behaviour that turns them, and a snapshot of it is a photograph of one
 * angle. So this is the only component the scaffold writes as code: the
 * faces as data, the turning as a small amount of state, and no
 * dependencies beyond React, so the site that ships carries it whole.
 */
function cubeTsx(part: ScaffoldPart, name: string): string {
  // The words only: a face's prompt is for whoever builds the site, not for the face.
  const faces = JSON.stringify(part.cube!.faces.map((f) => ({ heading: f.heading, body: f.body, colour: f.colour })), null, 2).split("\n").join("\n");
  const turn = part.cube!.turn ?? { x: -18, y: -32 };
  return `import * as React from "react";

const SIDES = ["front", "right", "back", "left", "top", "bottom"] as const;
const PLACE: Record<string, { rx: number; ry: number }> = {
  front: { rx: 0, ry: 0 }, right: { rx: 0, ry: 90 }, back: { rx: 0, ry: 180 },
  left: { rx: 0, ry: -90 }, top: { rx: 90, ry: 0 }, bottom: { rx: -90, ry: 0 },
};

/** What is written on each side. Edit the words here; the shape looks after itself. */
const FACES: { heading: string; body: string; colour: string }[] = ${faces};

/** The box's own proportion: a square box is a cube, a wide one is a slab as deep as its short side. */
const W = ${Math.max(24, Math.round(part.w * 0.74))};
const H = ${Math.max(24, Math.round(part.h * 0.74))};
const D = Math.min(W, H);
/** The resting pose: a three-quarter view from a little above. It rests a quarter turn at a time round it. */
const REST = { x: -18, y: -32 };
/** Looking down on the top, the ordinary view, looking up at the bottom. */
const PITCHES = [REST.x - 54, REST.x, REST.x + 90];
/** Never upside down. */
const LIMIT = 85;
const clampPitch = (x: number) => Math.max(-LIMIT, Math.min(LIMIT, x));
const restYaw = (y: number) => Math.round((y - REST.y) / 90) * 90 + REST.y;
const restPitch = (x: number) => PITCHES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));

export function ${name}() {
  const [turn, setTurn] = React.useState({ x: ${turn.x}, y: ${turn.y} });
  const spin = React.useRef({ x: 0, y: 0 });
  const held = React.useRef(false);
  const touched = React.useRef(false);
  const goal = React.useRef<{ x: number; y: number } | null>(null);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    let id = 0;
    const tick = () => {
      id = requestAnimationFrame(tick);
      if (held.current || !touched.current) return;
      const s = spin.current;
      if (Math.abs(s.x) > 0.35 || Math.abs(s.y) > 0.35) {
        setTurn((v) => ({ x: clampPitch(v.x + s.x), y: v.y + s.y }));
        s.x *= 0.94;
        s.y *= 0.94;
        return;
      }
      s.x = 0; s.y = 0;
      setTurn((v) => {
        const want = goal.current ?? { x: restPitch(v.x), y: restYaw(v.y) };
        const dx = want.x - v.x;
        const dy = want.y - v.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) { goal.current = null; return { x: want.x, y: ((want.y + 180) % 360 + 360) % 360 - 180 }; }
        return { x: v.x + dx * 0.16, y: v.y + dy * 0.16 };
      });
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-part="cube-3d"
      data-cube=""
      role="img"
      tabIndex={0}
      aria-label=${JSON.stringify(`${part.label}, a cube. Drag to turn it, or use the arrow keys.`)}
      onPointerDown={(e) => { held.current = true; touched.current = true; goal.current = null; last.current = { x: e.clientX, y: e.clientY }; spin.current = { x: 0, y: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!held.current || !last.current) return;
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        spin.current = { x: -dy * 0.42, y: dx * 0.42 };
        setTurn((v) => ({ x: clampPitch(v.x - dy * 0.42), y: v.y + dx * 0.42 }));
      }}
      onPointerUp={() => { held.current = false; last.current = null; }}
      onKeyDown={(e) => {
        const step: Record<string, [number, number]> = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
        const s = step[e.key];
        if (!s) return;
        e.preventDefault();
        touched.current = true;
        spin.current = { x: 0, y: 0 };
        setTurn((v) => {
          const at = goal.current ?? { x: restPitch(v.x), y: restYaw(v.y) };
          if (s[1]) goal.current = { x: at.x, y: at.y + s[1] };
          else {
            const i = PITCHES.indexOf(at.x);
            goal.current = { x: PITCHES[Math.max(0, Math.min(PITCHES.length - 1, (i < 0 ? 1 : i) + s[0]))], y: at.y };
          }
          return v;
        });
      }}
      style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", perspective: Math.max(W, H) * 3.4, touchAction: "none", cursor: "grab", outline: "none" }}
    >
      <div style={{ width: W, height: H, position: "relative", transformStyle: "preserve-3d", transform: \`translateZ(\${-D / 2}px) rotateX(\${turn.x}deg) rotateY(\${turn.y}deg)\` }}>
        {SIDES.map((side, i) => {
          const face = FACES[i] ?? { heading: "", body: "", colour: "" };
          const place = PLACE[side];
          const fw = side === "left" || side === "right" ? D : W;
          const fh = side === "top" || side === "bottom" ? D : H;
          const out = side === "left" || side === "right" ? W / 2 : side === "top" || side === "bottom" ? H / 2 : D / 2;
          const s = Math.min(fw, fh);
          return (
            <div
              key={side}
              data-face={side}
              style={{
                position: "absolute", left: "50%", top: "50%", width: fw, height: fh, boxSizing: "border-box",
                transform: \`translate(-50%, -50%) rotateX(\${place.rx}deg) rotateY(\${place.ry}deg) translateZ(\${out}px)\`,
                background: face.colour ? \`var(--\${face.colour})\` : "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: Math.round(s * 0.1),
                display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(s * 0.03),
                backfaceVisibility: "hidden", overflow: "hidden",
              }}
            >
              {face.heading ? <span style={{ fontWeight: 650, fontSize: Math.max(11, Math.round(s * 0.11)), lineHeight: 1.15, color: "var(--text)" }}>{face.heading}</span> : null}
              {face.body ? <span style={{ fontSize: Math.max(9, Math.round(s * 0.062)), lineHeight: 1.35, opacity: 0.72, color: "var(--text)" }}>{face.body}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;
}

/** The design tokens: the palette, the type, the shape, as CSS variables. */
function tokensCss(input: ScaffoldInput): string {
  const roles = Object.entries(input.palette).map(([k, v]) => `  --${k}: ${v};`).join("\n");
  // A role is a token; naming it twice is two places to change one colour.
  const rest = Object.entries(input.tokens)
    .filter(([k]) => !(k in input.palette))
    .map(([k, v]) => `  --${k}: ${typeof v === "number" ? `${v}px` : v};`)
    .join("\n");
  // The page's own paint when a texture is on it; else the backdrop chosen
  // without one (a gradient, a grid), which the export used to leave out.
  const pageCss = input.pageCss && Object.keys(input.pageCss).length ? input.pageCss : input.backdrop ? { background: input.backdrop } : {};
  const page = Object.entries(pageCss)
    .map(([k, v]) => `  ${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`)
    .join("\n");
  const keyframes = [EXPORT_KEYFRAMES, SHELL_CSS, ...(input.keyframes ?? []), ...(input.fontCss ? [input.fontCss] : [])].join("\n");
  return `/*
 * The site's tokens, taken from the document — not described, copied.
 * Every colour here is the one the board is painted in; change one and
 * every part that reads it changes with it.
 */
:root {
${roles}
${rest}
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--bodyFamily);
  font-size: var(--fontPx);${page ? `\n${page}` : ""}
}
a { color: inherit; }

${keyframes}`;
}

function layoutTsx(input: ScaffoldInput): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(input.name || "Site")},
  description: ${JSON.stringify(input.gimmick || input.master || "")},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

/** One part, exactly as the Builder renders it. */
function partTsx(part: ScaffoldPart, palette: Record<string, string>): string {
  const name = componentName(part);
  const head = `/**
 * ${part.label}${part.prompt ? ` — ${trim(part.prompt.split("\n")[0]!, 120)}` : ""}
 *
 * Written from the document (${part.featureId}). The markup below is what
 * the Builder rendered: the styles are the site's own tokens resolved for
 * this part, including its shape, its texture and the shadow the page's
 * lamp casts on it. Edit it freely — nothing regenerates it — but if you
 * change the look here it will differ from the board.
 */
`;
  if (part.mesh?.glb) {
    return `${head}
${meshTsx(part, name)}`;
  }
  if (part.cube) {
    // Its own preamble: the sentence about copied markup is untrue here,
    // and a comment that lies about the file under it is worse than none.
    return `/**
 * ${part.label}${part.prompt ? `, ${trim(part.prompt.split("\n")[0]!, 120)}` : ""}
 *
 * A cube, written as a component rather than copied as markup: six faces
 * and the behaviour that turns them. A snapshot of it would be a
 * photograph of one angle. Drag it, or use the arrow keys; it comes to
 * rest at the nearest three-quarter view, never upside down. The words are
 * the data at the top of the file, and the colours are the site's own
 * tokens.
 */
${cubeTsx(part, name)}`;
  }
  if (part.code) {
    // A written body renders in a frame with no permissions, exactly as it
    // does in the Builder: no scripts, nothing fetched. Its baked colours
    // are handed to the site's own roles the same way the Builder does it,
    // so a drawn part answers the palette in the built site too — the frame
    // is its own document, so the roles are passed into it.
    return `${head}const BODY = ${JSON.stringify(paintRoles(part.code.html))};

/** The site's roles, carried into the frame: it is its own document and cannot see them. */
const ROLES = ${JSON.stringify(roleVars({
      bg: palette.bg ?? "#ffffff",
      text: palette.text ?? "#111111",
      accent: palette.accent ?? "#4f46e5",
      muted: palette.muted ?? "#6b7280",
    }))};

export function ${name}() {
  return (
    <div style={{ width: "100%", height: "100%"${part.outline ? `, clipPath: "path('" + PATH + "')"` : ""} }}>
      <iframe
        title=${JSON.stringify(part.label)}
        srcDoc={\`<!doctype html><meta charset="utf-8"><meta http-equiv="content-security-policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><style>:root{\${ROLES}}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;color:currentColor}svg{display:block;width:100%;height:100%}</style>\${BODY}\`}
        sandbox=""
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: "100%", border: "none", background: "transparent" }}
      />
    </div>
  );
}
${part.outline ? `\n/** The line drawn round this part, in its own box. */\nconst PATH = ${JSON.stringify(part.outline.cut)};\n` : ""}`;
  }
  const body = htmlToJsx(part.html || `<div />`);
  const clipped = part.outline
    ? `    <div style={{ width: "100%", height: "100%", overflow: "hidden", clipPath: \`url(#clip-${part.id})\` }}>
      <svg width="0" height="0" aria-hidden focusable="false" style={{ position: "absolute" }}>
        <defs>
          <clipPath id=${JSON.stringify(`clip-${part.id}`)} clipPathUnits="objectBoundingBox">
            <path d=${JSON.stringify(part.outline.cut)} />
          </clipPath>
        </defs>
      </svg>
${body.split("\n").map((l) => `  ${l}`).join("\n")}
    </div>`
    : body;
  return `${head}export function ${name}() {
  return (
${clipped}
  );
}
`;
}

/** One page: the parts where the board puts them. */
function pageTsx(page: ScaffoldPage, parts: ScaffoldPart[], input: ScaffoldInput): string {
  const imports = parts
    .map((p) => `import { ${componentName(p)} } from "${page.path === "/" ? "@/components" : "@/components"}/parts/${componentName(p)}";`)
    .join("\n");
  const height = parts.reduce((m, p) => Math.max(m, p.y + p.h), 0) + 160;
  const palette = input.palette as unknown as Palette;
  const box = (b: { x: number; y: number; w: number; h: number }) => `{ left: ${Math.round(b.x)}, top: ${Math.round(b.y)}, width: ${Math.round(b.w)}, height: ${Math.round(b.h)} }`;
  const placed = parts
    .map((p) => {
      // The wrapper carries what the live page puts round a part: its place
      // at each device, its aura, its entrance. The component inside is the
      // markup alone.
      const at = [`desktop: ${box(p)}`];
      for (const device of ["tablet", "phone"] as const) {
        const hit = page.layouts?.[device]?.placed.find((q) => q.id === p.id);
        if (hit) at.push(`${device}: ${box(hit)}`);
      }
      const style: Record<string, string | number> = {
        ...(auraStyle(p.aura, palette, p.auraSize ?? 1, p.auraStyle ?? "glow") ?? {}),
      };
      const entrance = entranceCss(p.anim, p.animSpeed ?? 1, p.animDelay ?? 0, p.animEase ?? "smooth");
      if (entrance) style.animation = entrance;
      // A link is an anchor round the part: the markup's own click was lost with the snapshot.
      const link = hrefOf(p.link, input.pages);
      const inner = link
        ? `<a href=${JSON.stringify(link.href)}${link.newTab ? ' target="_blank" rel="noopener noreferrer"' : ""} style={{ display: "block", height: "100%", color: "inherit", textDecoration: "none" }}>
          <${componentName(p)} />
        </a>`
        : `<${componentName(p)} />`;
      return `      <Place
        id=${JSON.stringify(p.id)}
        data-part=${JSON.stringify(p.id)}
        at={{ ${at.join(", ")} }}${Object.keys(style).length ? `\n        style={${styleJsx(style)}}` : ""}
      >
        ${inner}
      </Place>`;
    })
    .join("\n");
  const sizes = (["tablet", "phone"] as const)
    .filter((d) => page.layouts?.[d])
    .map((d) => `${d}: { width: ${Math.round(page.layouts![d]!.width)}, height: ${Math.round(page.layouts![d]!.height)} }`);
  // The wash and the veil the live page lays over everything, when the look has them.
  const over = [
    input.overlayCss && Object.keys(input.overlayCss).length
      ? `      <div aria-hidden data-wash="" style={${styleJsx({ position: "absolute", inset: 0, pointerEvents: "none", ...input.overlayCss })}} />`
      : "",
    input.veil ? `      <div aria-hidden data-veil="" style={${styleJsx({ position: "absolute", inset: 0, pointerEvents: "none", background: input.veil })}} />` : "",
  ].filter(Boolean).join("\n");
  const b = page.behaviours?.any ? page.behaviours : null;
  const open = b ? `<Shell behaviours={${JSON.stringify(b)}}>\n` : "";
  const close = b ? `\n      </Shell>` : "";
  const vars = parts.some((p) => p.aura && (p.auraStyle ?? "glow") === "pulse");
  return `${imports}${vars ? `\nimport type { CSSProperties } from "react";` : ""}
import { Frame, Place } from "@/components/Frame";${b ? `\nimport { Shell } from "@/components/Shell";` : ""}

/**
 * ${page.name} (${page.path})${page.prompt ? `\n *\n * ${page.prompt.split("\n")[0]!.slice(0, 160)}` : ""}
 *
 * The parts sit where the board puts them, at the frame's own width
 * (${input.frameWidth}px). ${sizes.length ? "At a tablet or a phone the frame takes the placement the\n * Builder's preview computes for that width, each part stacked in reading\n * order with the height its words need, and scales only between those\n * widths." : "The frame scales the whole page down on a narrower screen."}
 */
export default function Page() {
  return (
    <Frame width={${input.frameWidth}} height={${Math.round(height)}}${sizes.length ? ` layouts={{ ${sizes.join(", ")} }}` : ""}>
      ${open}${placed}${close}${over ? `\n${over}` : ""}
    </Frame>
  );
}
`;
}

const FRAME_TSX = `"use client";
import * as React from "react";

export type Device = "desktop" | "tablet" | "phone";
export interface Box { left: number; top: number; width: number; height: number }

/** The layouts a page carries besides the board's own: the Builder's preview at a tablet (834) and a phone (390). */
export interface Layouts { tablet?: { width: number; height: number }; phone?: { width: number; height: number } }

const DeviceContext = React.createContext<Device>("desktop");

/** Which layout a screen this wide gets: the phone's up to 480, the tablet's up to 1024, when the page carries them. */
function deviceFor(innerWidth: number, layouts: Layouts | undefined): Device {
  if (layouts?.phone && innerWidth <= 480) return "phone";
  if (layouts?.tablet && innerWidth <= 1024) return "tablet";
  return "desktop";
}

/**
 * The page's own frame. At the board's width every position is the
 * board's. At a tablet or a phone it takes the placement the Builder's
 * preview computes for that width, when the page carries one, and only
 * scales down between those widths. Every part on the page sits in a
 * \`Place\`, which reads the device from here.
 */
export function Frame({ width, height, layouts, children }: { width: number; height: number; layouts?: Layouts; children: React.ReactNode }) {
  const [device, setDevice] = React.useState<Device>("desktop");
  const [scale, setScale] = React.useState(1);
  const size = device === "desktop" ? { width, height } : layouts?.[device] ?? { width, height };
  React.useEffect(() => {
    const fit = () => {
      const d = deviceFor(window.innerWidth, layouts);
      const w = d === "desktop" ? width : layouts?.[d]?.width ?? width;
      setDevice(d);
      setScale(Math.min(1, window.innerWidth / w));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, layouts]);
  return (
    <DeviceContext.Provider value={device}>
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div style={{ width: size.width, height: size.height, position: "relative", transform: \`scale(\${scale})\`, transformOrigin: "top left", marginBottom: (scale - 1) * size.height, marginInline: "auto" }}>
          {children}
        </div>
      </div>
    </DeviceContext.Provider>
  );
}

/** One part's place on the page, at whichever device the frame is showing; the desktop's when a device has none. */
export function Place({ id, at, style, children, ...rest }: { id: string; at: Partial<Record<Device, Box>> & { desktop: Box }; style?: React.CSSProperties; children: React.ReactNode } & Record<\`data-\${string}\`, string>) {
  const device = React.useContext(DeviceContext);
  const box = at[device] ?? at.desktop;
  return (
    <div id={id} {...rest} style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height, ...style }}>
      {children}
    </div>
  );
}
`;


/**
 * A solid, written out.
 *
 * Like the cube, a mesh is not markup: a snapshot of it is a photograph of
 * one angle. So the export writes the live part again as code: the GLB as
 * data at the top of the file, three.js loaded only in the browser and only
 * when it is there, the still the live page falls back to, and the same
 * turning by pointer and keys. The one dependency is named in BUILD.md.
 */
function meshTsx(part: ScaffoldPart, name: string): string {
  const m = part.mesh!;
  const start = m.turn ?? { x: -12, y: -28 };
  return `"use client";
import * as React from "react";

/**
 * ${part.label}, a solid you can turn. Written from the document (${part.featureId}${m.from ? `, made by ${m.from}` : ""}).
 * The GLB rides in this file as data, so nothing is fetched. three.js is
 * loaded only in the browser and only when it is installed (npm install
 * three); without it, or without a 3D context, the still is shown and says so.
 */
const GLB = ${JSON.stringify(m.glb)};
const STILL = ${m.still ? JSON.stringify(m.still) : "null"};
const START = { x: ${Math.round(start.x)}, y: ${Math.round(start.y)} };
/** Degrees per pixel dragged: the cube's number, so the two turn alike. */
const PER_PX = 0.42;
const DECAY = 0.94;
const SETTLE = 0.35;
const rad = (d: number) => (d * Math.PI) / 180;

export function ${name}() {
  const host = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState("");
  const turn = React.useRef({ ...START });
  const spin = React.useRef({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const held = React.useRef(false);

  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stop = false;
    let frame = 0;
    let cleanup = () => {};
    void (async () => {
      let THREE: typeof import("three");
      let GLTFLoader: typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader;
      try {
        THREE = await import("three");
        ({ GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js"));
      } catch {
        if (!stop) setFailed("shown as a still: the 3D library did not load (npm install three)");
        return;
      }
      if (stop) return;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        if (!stop) setFailed("shown as a still: this browser gave no 3D context");
        return;
      }
      const box = el.getBoundingClientRect();
      const width = Math.max(64, Math.round(box.width || ${Math.round(part.w)}));
      const height = Math.max(64, Math.round(box.height || ${Math.round(part.h)}));
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      el.append(renderer.domElement);
      const scene = new THREE.Scene();
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(-0.8, 1.2, 3);
      scene.add(key);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const rim = new THREE.DirectionalLight(0xffffff, 0.7);
      rim.position.set(-2, -1, -3);
      scene.add(rim);
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.05, 100);
      const pivot = new THREE.Group();
      scene.add(pivot);
      let loaded: import("three").Object3D | null = null;
      try {
        loaded = (await new GLTFLoader().loadAsync(GLB)).scene;
      } catch {
        if (!stop) setFailed("shown as a still: the solid would not load");
        renderer.dispose();
        return;
      }
      if (stop || !loaded) { renderer.dispose(); return; }
      const bounds = new THREE.Box3().setFromObject(loaded);
      const size = bounds.getSize(new THREE.Vector3());
      const middle = bounds.getCenter(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      loaded.position.sub(middle);
      pivot.add(loaded);
      pivot.scale.setScalar(1 / longest);
      camera.position.set(0, 0, 1 / 0.86 / (2 * Math.tan(rad(35 / 2))));
      camera.lookAt(0, 0, 0);
      const draw = () => {
        pivot.rotation.x = rad(turn.current.x);
        pivot.rotation.y = rad(turn.current.y);
        renderer.render(scene, camera);
      };
      const tick = () => {
        if (stop) return;
        frame = requestAnimationFrame(tick);
        if (held.current) return;
        const s = spin.current;
        if (Math.abs(s.x) > SETTLE || Math.abs(s.y) > SETTLE) {
          turn.current = { x: turn.current.x + s.x, y: turn.current.y + s.y };
          s.x *= DECAY;
          s.y *= DECAY;
          draw();
          return;
        }
        if (s.x || s.y) { s.x = 0; s.y = 0; draw(); }
      };
      draw();
      frame = requestAnimationFrame(tick);
      const resize = () => {
        const r = el.getBoundingClientRect();
        const rw = Math.max(64, Math.round(r.width));
        const rh = Math.max(64, Math.round(r.height));
        renderer.setSize(rw, rh, false);
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        draw();
      };
      const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
      watch?.observe(el);
      cleanup = () => {
        cancelAnimationFrame(frame);
        watch?.disconnect();
        renderer.domElement.remove();
        renderer.dispose();
      };
    })();
    return () => { stop = true; cancelAnimationFrame(frame); cleanup(); };
  }, []);

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    held.current = true;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    spin.current = { x: -dy * PER_PX, y: dx * PER_PX };
    turn.current = { x: turn.current.x - dy * PER_PX, y: turn.current.y + dx * PER_PX };
  };
  const up = (e: React.PointerEvent) => {
    held.current = false;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!spin.current.x && !spin.current.y) spin.current = { x: 0.01, y: 0.01 };
  };
  const keys = (e: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] } as Record<string, [number, number]>)[e.key];
    if (!step) return;
    e.preventDefault();
    turn.current = { x: Math.round(turn.current.x / 90) * 90 + step[0], y: Math.round(turn.current.y / 90) * 90 + step[1] };
    spin.current = { x: 0.01, y: 0.01 };
  };

  return (
    <div
      data-part=${JSON.stringify(part.id)}
      data-mesh=""
      data-mesh-still={failed ? "" : undefined}
      role="img"
      tabIndex={failed ? -1 : 0}
      aria-label=${JSON.stringify(`${part.label}, a solid you can turn. Drag to turn it, or use the arrow keys.`)}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={keys}
      style={{ width: "100%", height: "100%", outline: "none", cursor: failed ? "default" : "grab", touchAction: "none", position: "relative", overflow: "hidden" }}
    >
      <div ref={host} style={{ width: "100%", height: "100%", display: failed ? "none" : "block" }} />
      {failed ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {STILL ? <img src={STILL} alt=${JSON.stringify(part.label)} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <p style={{ color: "var(--muted)", fontSize: 11 }}>${part.label}</p>}
          <p data-mesh-instead={failed} style={{ position: "absolute", bottom: 4, left: 4, padding: "2px 6px", borderRadius: 4, fontSize: 9, background: "var(--bg)", color: "var(--muted)" }}>{failed}</p>
        </div>
      ) : null}
    </div>
  );
}
`;
}

/** The stylesheet the shell's behaviours read: the reveal, the snap, the wipe, the burst, the button's rise. */
const SHELL_CSS = `/* Behaviours: what the shell in components/Shell.tsx switches on. */
[data-reveal="on"] [data-part] { opacity: 0; transform: translateY(14px); transition: opacity 520ms ease-out, transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1); }
[data-reveal="on"] [data-part].is-in { opacity: 1; transform: none; }
[data-snap] [data-part] { scroll-snap-align: start; }
@media (prefers-reduced-motion: reduce) {
  [data-reveal="on"] [data-part] { opacity: 1; transform: none; transition: none; }
}
@keyframes slide-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mo-wipe { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes mo-burst { to { transform: translate(var(--mo-x), var(--mo-y)) rotate(200deg); opacity: 0; } }
`;

/**
 * The shell a built site runs its behaviours through: the live page's
 * shell (`live/LiveShell.tsx`) written against the window rather than a
 * pinned scroller, with no dependency beyond React. A page mounts it with
 * the switches its tier-B parts set.
 */
const SHELL_TSX = `"use client";
import * as React from "react";

export interface Behaviours {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  tilt: boolean;
  confetti: boolean;
  described: { id: string; label: string }[];
  any: boolean;
}

/**
 * Runs the behaviours the page was given in the Builder: the reading
 * progress bar, back to top, reveal on scroll, parallax, smooth scrolling,
 * snapping, the opening wipe, a cursor of the site's own, hover tilt and a
 * burst on success (dispatch a "site:success" event on the window). The few
 * that cannot be run honestly are named in the corner rather than faked.
 */
export function Shell({ behaviours: b, children }: { behaviours: Behaviours; children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [progress, setProgress] = React.useState(0);
  const [past, setPast] = React.useState(false);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [intro, setIntro] = React.useState(b.intro);
  const [bursts, setBursts] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!(b.progress || b.backToTop || b.parallax)) return;
    const read = () => {
      const top = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, top / max) : 0);
      setPast(top > 220);
      if (b.parallax) document.body.style.backgroundPositionY = \`\${-top * b.parallax}px\`;
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [b.progress, b.backToTop, b.parallax]);

  React.useEffect(() => {
    const el = document.documentElement;
    const before = { behavior: el.style.scrollBehavior, snap: el.style.scrollSnapType };
    if (b.smooth) el.style.scrollBehavior = "smooth";
    if (b.snap) el.style.scrollSnapType = \`\${b.snap === "horizontal" ? "x" : "y"} proximity\`;
    return () => { el.style.scrollBehavior = before.behavior; el.style.scrollSnapType = before.snap; };
  }, [b.smooth, b.snap]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.reveal || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-in"); }), { threshold: 0.12 });
    root.querySelectorAll("[data-part]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [b.reveal, children]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.tilt) return;
    const onMove = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-part]") as HTMLElement | null;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = \`perspective(900px) rotateX(\${(-dy * 7).toFixed(2)}deg) rotateY(\${(dx * 9).toFixed(2)}deg)\`;
      node.style.transition = "transform 120ms ease-out";
    };
    const onLeave = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-part]") as HTMLElement | null;
      if (node) node.style.transform = "";
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave, true);
    return () => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", onLeave, true); };
  }, [b.tilt]);

  React.useEffect(() => {
    if (!b.cursor) return;
    const before = document.body.style.cursor;
    document.body.style.cursor = "none";
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    const onOut = () => setCursor(null);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onOut);
    return () => { window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onOut); document.body.style.cursor = before; };
  }, [b.cursor]);

  React.useEffect(() => {
    if (!b.intro) return;
    setIntro(true);
    const id = window.setTimeout(() => setIntro(false), 900);
    return () => window.clearTimeout(id);
  }, [b.intro]);

  React.useEffect(() => {
    if (!b.confetti) return;
    const onWin = () => {
      const id = Date.now();
      setBursts((xs) => [...xs, id]);
      window.setTimeout(() => setBursts((xs) => xs.filter((x) => x !== id)), 1400);
    };
    window.addEventListener("site:success", onWin);
    return () => window.removeEventListener("site:success", onWin);
  }, [b.confetti]);

  const spotlight = b.cursor === "spotlight";
  return (
    <div ref={rootRef} data-shell="" data-reveal={b.reveal ? "on" : undefined} data-snap={b.snap ?? undefined} style={{ display: "contents" }}>
      {children}
      {b.progress ? (
        <div role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 40, pointerEvents: "none" }}>
          <div style={{ width: \`\${progress * 100}%\`, height: "100%", background: "var(--accent)", transition: "width 90ms linear" }} />
        </div>
      ) : null}
      {b.backToTop && past ? (
        <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ position: "fixed", right: 18, bottom: 18, zIndex: 45, width: 38, height: 38, borderRadius: 999, border: "none", cursor: "pointer", background: "var(--accent)", color: "var(--surface)", fontSize: 16, boxShadow: "0 8px 22px oklch(0 0 0 / .35)", animation: "slide-up 200ms ease-out both" }}>
          ↑
        </button>
      ) : null}
      {b.cursor && cursor ? (
        <span aria-hidden style={{ position: "fixed", left: cursor.x, top: cursor.y, zIndex: 50, pointerEvents: "none", width: spotlight ? 220 : 16, height: spotlight ? 220 : 16, marginLeft: spotlight ? -110 : -8, marginTop: spotlight ? -110 : -8, borderRadius: 999, mixBlendMode: spotlight ? "screen" : "difference", background: spotlight ? "radial-gradient(circle, color-mix(in oklab, var(--accent) 27%, transparent), transparent 70%)" : "var(--accent)", transition: b.cursor === "trail" ? "left 140ms ease-out, top 140ms ease-out" : undefined }} />
      ) : null}
      {intro ? <span aria-hidden style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--surface)", animation: "mo-wipe 900ms cubic-bezier(0.7, 0, 0.2, 1) both", pointerEvents: "none" }} /> : null}
      {bursts.map((id) => (
        <span key={id} aria-hidden style={{ position: "fixed", left: "50%", top: "40%", zIndex: 55, pointerEvents: "none" }}>
          {Array.from({ length: 18 }, (_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            return <span key={i} style={{ position: "absolute", width: 7, height: 7, borderRadius: 1, background: i % 2 ? "var(--accent)" : "oklch(0.8 0.16 90)", "--mo-x": \`\${Math.cos(angle) * (90 + (i % 5) * 22)}px\`, "--mo-y": \`\${Math.sin(angle) * (70 + (i % 4) * 20)}px\`, animation: "mo-burst 1.3s cubic-bezier(0.2, 0.7, 0.3, 1) both" } as React.CSSProperties} />;
          })}
        </span>
      ))}
      {b.described.length ? (
        <span data-described="" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 35, maxWidth: 300, padding: "6px 10px", borderRadius: 8, background: "var(--surface)", border: "1px solid color-mix(in oklab, var(--accent) 27%, transparent)", color: "var(--accent)", fontSize: 11, lineHeight: 1.4, pointerEvents: "none", opacity: 0.9 }}>
          Described, not simulated here: {b.described.map((d) => d.label).join(", ")}.
        </span>
      ) : null}
    </div>
  );
}
`;

/** What was written from the document, and what is left to write. */
function buildMd(input: ScaffoldInput): string {
  const empties = input.parts.filter((p) => p.empty);
  const data = input.parts.filter((p) => p.data?.trim());
  return `# ${input.name || "The site"}, what this build is

This codebase was written **from the document**, not from a description of
it. \`site/document.json\` is the source: the palette, the type, every
part's options, its exact size and place, the line it is cut to and the
body written for it. Nothing about the look was inferred.

## What is deterministic

- \`app/globals.css\`, the design tokens, taken from the palette and the
  format. ${Object.keys(input.palette).length} colour roles, ${Object.keys(input.tokens).length} other tokens.
- \`components/parts/*.tsx\`, one component per part, ${input.parts.length} of them,
  each carrying the markup that part actually rendered: its styles, its
  shape, its clip, its texture, and the shadow the page's lamp casts on it.
- \`app/**/page.tsx\`, ${input.pages.length} page${input.pages.length === 1 ? "" : "s"}, each placing its parts where the board places them.
- \`components/Frame.tsx\`, the fixed-width canvas and how it meets a
  narrower screen.${input.parts.some((p) => p.mesh?.glb) ? `
- ${input.parts.filter((p) => p.mesh?.glb).length} solid${input.parts.filter((p) => p.mesh?.glb).length === 1 ? "" : "s"} you can turn, written as components that load three.js in the
  browser: the one dependency this build needs, \`npm install three\`. Without it
  each shows its still and says so.` : ""}

Re-running Build regenerates exactly these files, byte for byte, from the
same document.

## What is left for Claude, and why

A document holds what a site *is*, not everything it *does*. These are the
things it cannot hold, and the only things a model is asked for:

${empties.length ? empties.map((p) => `- **${p.label}**, an Idea part with no body written yet. The prompt says: ${p.prompt?.split("\n")[0] ?? "(nothing yet)"}`).join("\n") : "- No empty parts: every part on the board rendered something."}
${data.length ? `\n${data.map((p) => `- **${p.label}**, reads: ${p.data!.split("\n")[0]}. Where that comes from is a decision this document does not make.`).join("\n")}` : ""}

Behaviour beyond the state the board can show, what happens after a form
is sent, what a filter filters, what a cart does, is the other half, and
\`BLUEPRINT.md\` is the narrative for it. The screenshots that went with the
ask are the reference for anything that has to *look* like something.
`;
}
