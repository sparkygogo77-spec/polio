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
import { standInFiles, standInHas } from "../standIn.ts";
import type { ScaffoldFile, ScaffoldPart, ScaffoldInput } from "./types.ts";
import { componentName, slug } from "./jsx.ts";
import { tokensCss, layoutTsx, partTsx, pageTsx } from "./pages.ts";
import { FRAME_TSX } from "./frameMesh.ts";
import { SHELL_TSX, buildMd } from "./shell.ts";

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
  /* The stand-in server, only when it is asked for: the runtime and the samples, loaded before the page's scripts. */
  if (standInHas(input.standIn)) files.push(...standInFiles(input.standIn));
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
export function cubeTsx(part: ScaffoldPart, name: string): string {
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

