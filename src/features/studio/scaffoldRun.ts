"use client";
/**
 * Writing the codebase out of the document, in the browser that drew it.
 *
 * The parts are React components with a client's worth of state in them,
 * and the browser already has every one of them mounted and painted. So
 * the markup is taken from there rather than re-derived on a server:
 * each part is rendered once into a detached container at the size it
 * will be on the page, its DOM is read, and that is what goes into its
 * component file. What the board shows and what Build writes are then the
 * same thing by construction, not by agreement.
 *
 * Everything after that is arithmetic (`scaffold.ts`): tokens off the
 * palette, a component per part, a page per page. No key, no model, no
 * network. What Claude is asked for afterwards is only what a document
 * cannot hold.
 */
import { fontFaceCss } from "./fonts";
import * as React from "react";
import { driftKeyframes, lands } from "./look";
import { deriveBehaviours } from "./live/behaviours";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Block } from "./blocks";
import { themeFrom } from "./parts";
import { resolvePalette } from "./parts/theme";
import { placeNodes } from "./live/layout";
import { scaffold, type ScaffoldFile, type ScaffoldPart } from "./scaffold";
import { useStudio } from "./board/store";
import { standInOn } from "./standIn";

export interface ScaffoldResult {
  files: ScaffoldFile[];
  stats: { pages: number; parts: number; empty: number; bodies: number; clipped: number; bytes: number; ms: number };
}

/** Render one part offscreen and read the markup it made. */
function markupOf(el: React.ReactElement, w: number, h: number): string {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px;pointer-events:none;opacity:0`;
  document.body.appendChild(host);
  const root = createRoot(host);
  let html = "";
  try {
    flushSync(() => root.render(el));
    html = host.innerHTML;
  } finally {
    root.unmount();
    host.remove();
  }
  return html;
}

/** The whole codebase, from the document as it stands. */
export function buildScaffold(): ScaffoldResult {
  const began = typeof performance !== "undefined" ? performance.now() : Date.now();
  const s = useStudio.getState();
  const theme = themeFrom(s.format, s.look, s.brief.name);
  const palette = resolvePalette(s.format, s.look);
  const parts: ScaffoldPart[] = [];

  for (const page of s.pages) {
    const { placed } = placeNodes(s.nodes.filter((n) => n.pageId === page.id), "desktop", s.frameWidth);
    for (const p of placed) {
      const n = p.node;
      const html = n.code
        ? ""
        : markupOf(
            React.createElement(Block, {
              node: n, t: theme, mode: "board", size: { w: p.w, h: p.h },
              palette, light: s.look?.light, page: { w: s.frameWidth, h: 900 }, layers: s.look?.texture,
            }),
            p.w,
            p.h,
          );
      parts.push({
        id: n.id, pageId: page.id, featureId: n.featureId, label: n.label, prompt: n.prompt,
        x: p.x, y: p.y, w: p.w, h: p.h, html,
        outline: n.outline ?? null,
        code: n.code ? { html: n.code.html, note: n.code.note } : null,
        // A cube is not markup. Its faces are data and its turning is
        // behaviour, so the scaffold writes a component rather than a
        // snapshot of one angle of it.
        cube: n.cube ? { faces: n.cube.faces, turn: n.cube.turn } : null,
        // A solid is not markup either: the GLB, the still and the angle it was left at.
        mesh: n.mesh?.glb ? { glb: n.mesh.glb, still: n.mesh.still, turn: n.mesh.turn, from: n.mesh.from } : null,
        // An Idea part with nothing written for it is the one thing the
        // document does not hold: that is what the model is for.
        empty: n.featureId === "custom-idea" && !n.code,
        data: n.data,
        // What the live page puts round it, so the export shows it as Preview does.
        anim: n.anim, animSpeed: n.animSpeed, animDelay: n.animDelay, animEase: n.animEase,
        aura: n.aura, auraSize: n.auraSize, auraStyle: n.auraStyle,
        link: n.link,
      });
    }
  }

  const files = scaffold({
    name: s.brief.name,
    gimmick: s.brief.gimmick,
    master: s.brief.master,
    frameWidth: s.frameWidth,
    // Each page's behaviours, derived exactly as the live page derives them, so the built site runs what Preview runs.
    pages: s.pages.map((p) => {
      const own = s.nodes.filter((n) => n.pageId === p.id);
      // The page at a tablet and a phone, placed exactly as the live page places it, so the built site reflows as Preview does.
      const layout = (device: "tablet" | "phone") => {
        const { width, height, placed } = placeNodes(own, device, s.frameWidth);
        return { width, height, placed: placed.map((q) => ({ id: q.node.id, x: q.x, y: q.y, w: q.w, h: q.h })) };
      };
      return { id: p.id, name: p.name, path: p.path, prompt: p.prompt, behaviours: deriveBehaviours(own, p.scroll), layouts: { tablet: layout("tablet"), phone: layout("phone") } };
    }),
    parts,
    palette: palette as unknown as Record<string, string>,
    tokens: {
      radius: theme.radius,
      fontPx: theme.fontPx,
      bodyFamily: theme.bodyFamily,
      headingFamily: theme.headingFamily,
      line: theme.line,
      surface: theme.surface,
      muted: theme.muted,
    },
    // The page's own ground, texture and all, exactly as the live page
    // paints it: the properties themselves, not a description of them.
    pageCss: theme.surfaceStyle
      ? Object.fromEntries(Object.entries(theme.surfaceStyle).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
      : undefined,
    // The keyframes that paint names, the wash and the veil over the page,
    // and the backdrop chosen with no texture: all of it used to stop here.
    fontCss: fontFaceCss(s.look?.fonts ?? []) || undefined,
    keyframes: [driftKeyframes((s.look?.texture ?? []).filter((l) => l.on && lands(l, "page")), palette)?.css].filter((k): k is string => !!k),
    overlayCss: theme.overlayStyle
      ? Object.fromEntries(Object.entries(theme.overlayStyle).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
      : undefined,
    veil: theme.veil,
    backdrop: theme.backdrop || undefined,
    // The recorded reads answered with their samples, only with the Build option Stand-in server on.
    standIn: standInOn(s.format as Record<string, unknown>, s.standIn) ? s.standIn : null,
  });

  return {
    files,
    stats: {
      pages: s.pages.length,
      parts: parts.length,
      empty: parts.filter((p) => p.empty).length,
      bodies: parts.filter((p) => p.code).length,
      clipped: parts.filter((p) => p.outline).length,
      bytes: files.reduce((n, f) => n + f.content.length, 0),
      // How long the whole thing took, because "deterministic and fast" is
      // a claim, and the note under the button is where it is kept honest.
      ms: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - began),
    },
  };
}

/** What is left for Claude, in the words the ask uses. */
export function gapsOf(result: ScaffoldResult): string[] {
  const out: string[] = [];
  if (result.stats.empty) out.push(`${result.stats.empty} Idea part${result.stats.empty === 1 ? "" : "s"} with no body written yet`);
  out.push("where the data each part reads comes from");
  out.push("what happens after an interaction, sending, filtering, adding to a cart, signing in");
  return out;
}
