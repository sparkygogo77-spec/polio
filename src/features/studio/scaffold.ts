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

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface ScaffoldPage {
  id: string;
  name: string;
  path: string;
  prompt?: string;
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
  const faces = JSON.stringify(part.cube!.faces, null, 2).split("\n").join("\n");
  const turn = part.cube!.turn ?? { x: -18, y: -32 };
  return `import * as React from "react";

const SIDES = ["front", "right", "back", "left", "top", "bottom"] as const;
const PLACE: Record<string, { rx: number; ry: number }> = {
  front: { rx: 0, ry: 0 }, right: { rx: 0, ry: 90 }, back: { rx: 0, ry: 180 },
  left: { rx: 0, ry: -90 }, top: { rx: 90, ry: 0 }, bottom: { rx: -90, ry: 0 },
};

/** What is written on each side. Edit the words here; the shape looks after itself. */
const FACES: { heading: string; body: string; colour: string }[] = ${faces};

const SIDE = ${Math.round(Math.min(part.w, part.h) * 0.74)};
const quarter = (d: number) => Math.round(d / 90) * 90;

export function ${name}() {
  const [turn, setTurn] = React.useState({ x: ${turn.x}, y: ${turn.y} });
  const spin = React.useRef({ x: 0, y: 0 });
  const held = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    let id = 0;
    const tick = () => {
      id = requestAnimationFrame(tick);
      if (held.current) return;
      const s = spin.current;
      if (Math.abs(s.x) > 0.35 || Math.abs(s.y) > 0.35) {
        setTurn((v) => ({ x: v.x + s.x, y: v.y + s.y }));
        s.x *= 0.94;
        s.y *= 0.94;
        return;
      }
      s.x = 0; s.y = 0;
      setTurn((v) => {
        const dx = quarter(v.x) - v.x;
        const dy = quarter(v.y) - v.y;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return { x: quarter(v.x), y: quarter(v.y) };
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
      onPointerDown={(e) => { held.current = true; last.current = { x: e.clientX, y: e.clientY }; spin.current = { x: 0, y: 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!held.current || !last.current) return;
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        spin.current = { x: -dy * 0.42, y: dx * 0.42 };
        setTurn((v) => ({ x: v.x - dy * 0.42, y: v.y + dx * 0.42 }));
      }}
      onPointerUp={() => { held.current = false; last.current = null; }}
      onKeyDown={(e) => {
        const step: Record<string, [number, number]> = { ArrowLeft: [0, -90], ArrowRight: [0, 90], ArrowUp: [90, 0], ArrowDown: [-90, 0] };
        const s = step[e.key];
        if (!s) return;
        e.preventDefault();
        spin.current = { x: 0, y: 0 };
        setTurn((v) => ({ x: quarter(v.x) + s[0], y: quarter(v.y) + s[1] }));
      }}
      style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", perspective: SIDE * 3.4, touchAction: "none", cursor: "grab", outline: "none" }}
    >
      <div style={{ width: SIDE, height: SIDE, position: "relative", transformStyle: "preserve-3d", transform: \`translateZ(\${-SIDE / 2}px) rotateX(\${turn.x}deg) rotateY(\${turn.y}deg)\` }}>
        {SIDES.map((side, i) => {
          const face = FACES[i] ?? { heading: "", body: "", colour: "" };
          const place = PLACE[side];
          return (
            <div
              key={side}
              data-face={side}
              style={{
                position: "absolute", inset: 0, boxSizing: "border-box",
                transform: \`rotateX(\${place.rx}deg) rotateY(\${place.ry}deg) translateZ(\${SIDE / 2}px)\`,
                background: face.colour ? \`var(--\${face.colour})\` : "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: Math.round(SIDE * 0.1),
                display: "flex", flexDirection: "column", justifyContent: "center", gap: Math.round(SIDE * 0.03),
                backfaceVisibility: "hidden", overflow: "hidden",
              }}
            >
              {face.heading ? <span style={{ fontWeight: 650, fontSize: Math.max(11, Math.round(SIDE * 0.11)), lineHeight: 1.15, color: "var(--text)" }}>{face.heading}</span> : null}
              {face.body ? <span style={{ fontSize: Math.max(9, Math.round(SIDE * 0.062)), lineHeight: 1.35, opacity: 0.72, color: "var(--text)" }}>{face.body}</span> : null}
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
  const page = Object.entries(input.pageCss ?? {})
    .map(([k, v]) => `  ${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v};`)
    .join("\n");
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
`;
}

function layoutTsx(input: ScaffoldInput): string {
  return `import type { Metadata } from "next";
import "./globals.css";
import { paintRoles, roleVars } from "./bodyPaint.ts";

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
  if (part.cube) {
    // Its own preamble: the sentence about copied markup is untrue here,
    // and a comment that lies about the file under it is worse than none.
    return `/**
 * ${part.label}${part.prompt ? `, ${trim(part.prompt.split("\n")[0]!, 120)}` : ""}
 *
 * A cube, written as a component rather than copied as markup: six faces
 * and the behaviour that turns them. A snapshot of it would be a
 * photograph of one angle. Drag it, or use the arrow keys; it settles on
 * the nearest face. The words are the data at the top of the file, and the
 * colours are the site's own tokens.
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
  const placed = parts
    .map(
      (p) => `      <div
        data-part=${JSON.stringify(p.id)}
        style={{ position: "absolute", left: ${Math.round(p.x)}, top: ${Math.round(p.y)}, width: ${Math.round(p.w)}, height: ${Math.round(p.h)} }}
      >
        <${componentName(p)} />
      </div>`,
    )
    .join("\n");
  return `${imports}
import { Frame } from "@/components/Frame";

/**
 * ${page.name} (${page.path})${page.prompt ? `\n *\n * ${page.prompt.split("\n")[0]!.slice(0, 160)}` : ""}
 *
 * The parts sit where the board puts them, at the frame's own width
 * (${input.frameWidth}px); the frame scales the whole page down on a
 * narrower screen rather than reflowing it, which is what the Builder's
 * preview does. Reflow is a decision, not a default — make it here.
 */
export default function Page() {
  return (
    <Frame width={${input.frameWidth}} height={${Math.round(height)}}>
${placed}
    </Frame>
  );
}
`;
}

const FRAME_TSX = `"use client";
import * as React from "react";

/**
 * The page's own frame: a fixed-width canvas, centred, scaled down to fit
 * a narrower screen. The Builder's board is a fixed width and every
 * position in the document is in that frame, so this is the one place that
 * knows how a smaller screen is handled.
 */
export function Frame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => setScale(Math.min(1, window.innerWidth / width));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width]);
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ width, height, position: "relative", transform: \`scale(\${scale})\`, transformOrigin: "top left", marginBottom: (scale - 1) * height }}>
        {children}
      </div>
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
  narrower screen.

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
