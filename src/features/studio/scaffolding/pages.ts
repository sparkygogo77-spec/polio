import { paintRoles, roleVars } from "../bodyPaint.ts";
import { auraStyle, entranceCss, type Palette } from "../look.ts";
import { standInHas } from "../standIn.ts";
import { EXPORT_KEYFRAMES } from "./types.ts";
import type { ScaffoldPage, ScaffoldPart, ScaffoldInput } from "./types.ts";
import { styleJsx, hrefOf, htmlToJsx, componentName, trim } from "./jsx.ts";
import { meshTsx } from "./frameMesh.ts";
import { SHELL_CSS } from "./shell.ts";
import { cubeTsx } from "./scaffold.ts";

/** The design tokens: the palette, the type, the shape, as CSS variables. */
export function tokensCss(input: ScaffoldInput): string {
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

export function layoutTsx(input: ScaffoldInput): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(input.name || "Site")},
  description: ${JSON.stringify(input.gimmick || input.master || "")},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
${standInHas(input.standIn) ? `      {/* The stand-in server (public/stand-in.js): recorded reads answered with samples until a real backend exists. */}
      <head><script src="/stand-in.js" /></head>
` : ""}      <body>{children}</body>
    </html>
  );
}
`;
}

/** One part, exactly as the Builder renders it. */
export function partTsx(part: ScaffoldPart, palette: Record<string, string>): string {
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
export function pageTsx(page: ScaffoldPage, parts: ScaffoldPart[], input: ScaffoldInput): string {
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
