/**
 * A FREE CONCEPT, DRAFTED: words from the subject, drawn in its direction's
 * theme, moved onto its direction's spec by the variations' own build.
 *
 *   conceptVersions   the pages, every part with its words (`copy.ts`)
 *   themeFor          the direction's System (`taste.ts`)
 *   systemFor         the variations' taste pass over that System
 *                     (`variations/tokens.ts`): colours on the spec's hue,
 *                     type on its ratio and pairing, space on the grid,
 *                     motion; done BEFORE the page is drawn, so every box is
 *                     measured at the size its words really are
 *   buildSite         the page as real parts in that System (`idea/versions.ts`)
 *   alignFirstScreen  the first screen centred where the direction says
 *
 * No Claude, no store, no browser: `run.ts` writes what this answers, and
 * `tests/concept-taste.mjs` measures it.
 */
import { buildSite, wholeVersion, type Versions } from "../idea/versions.ts";
import { formatOf } from "../starterPage.ts";
import { themeColours } from "../siteTheme.ts";
import { systemFor, type FaceRoles } from "../variations/tokens.ts";
import type { System } from "../system/model.ts";
import { DIRECTIONS, conceptVersions, directionOf, type Voice } from "./copy.ts";
import { specFor, themeFor } from "./taste.ts";
import { conceptName } from "./model.ts";

export const FRAME = 1440;

export interface Drafted {
  name: string;
  direction: string;
  pitch: string;
  voice: Voice;
  doc: Record<string, unknown> & { nodes: unknown[]; pages: unknown[]; system?: System | null; systemId?: string | null };
  system: System;
}

/** One version of `v` drawn whole in `system`, as a site document. */
export function docOf(v: Versions, i: number, system: System, theme: ReturnType<typeof themeFor>["theme"] | null, name: string): Drafted["doc"] {
  const site = buildSite(v, wholeVersion(v, i), system, { frameWidth: FRAME, words: "fill" });
  return {
    pages: site.pages,
    nodes: site.nodes,
    groups: [],
    look: { palette: site.palette },
    ...(theme ? { format: formatOf(theme, themeColours(theme)) } : {}),
    brief: { name, description: v.versions[i]?.pitch ?? v.description },
    systemId: system.id,
    system,
    activePageId: (site.pages[0] as { id?: string } | undefined)?.id,
    frameWidth: FRAME,
  };
}

/**
 * A picture or a gallery with corners is drawn inside a box wrapper whose
 * height is "auto", and a part that fills its box ends 8 px tall (seen on
 * the canvas: a thin bar where the picture should be). Until that wrapper
 * is fixed, a drafted picture keeps square corners: its radius and the
 * link to the radius token come off.
 */
export function squarePictures<N extends { featureId?: string; radius?: unknown; sys?: { f?: Record<string, string>; v?: Record<string, unknown>; s?: string } | null }>(nodes: readonly N[]): N[] {
  return nodes.map((n) => {
    if (n.featureId !== "picture" && n.featureId !== "gallery") return n;
    const f = { ...(n.sys?.f ?? {}) }; delete f.radius;
    const v = { ...(n.sys?.v ?? {}) }; delete v.radius;
    return { ...n, radius: null, sys: n.sys ? { ...n.sys, f, v } : n.sys };
  });
}

/** Where each direction's first screen sits: centred on its one message, or set left. */
export const FIRST_SCREEN_ALIGN: Record<Voice, "start" | "center"> = { calm: "start", bold: "center", warm: "center", night: "start" };

/**
 * The first screen's parts centred (or left as laid): the heading and words
 * centred on the frame with their text centred, the buttons' row centred as
 * one. A drafted page has no layout tree yet, so `relayout` cannot do this.
 */
export function alignFirstScreen<N extends { label?: string; featureId?: string; x: number; y: number; w: number; text?: unknown }>(nodes: readonly N[], align: "start" | "center", width = FRAME): N[] {
  if (align !== "center") return [...nodes];
  const mine = nodes.filter((n) => /^First screen: /.test(n.label ?? ""));
  const buttons = mine.filter((n) => n.featureId === "cta-primary");
  const row = buttons.length ? { left: Math.min(...buttons.map((b) => b.x)), right: Math.max(...buttons.map((b) => b.x + b.w)) } : null;
  const shift = row ? Math.round((width - (row.right - row.left)) / 2 - row.left) : 0;
  return nodes.map((n) => {
    if (!mine.includes(n)) return n;
    if (n.featureId === "cta-primary") return { ...n, x: n.x + shift };
    return { ...n, x: Math.round((width - n.w) / 2), text: { ...((n.text as Record<string, unknown> | undefined) ?? {}), align: "center" } };
  });
}

/** Each face token's job, by its name: the theme names its heading face "Headings". */
export function faceRolesOf(system: System): FaceRoles {
  const out: FaceRoles = new Map();
  for (const f of system.tokens.type.faces) out.set(f.id, /head|title|display/i.test(f.name) ? "heading" : "body");
  return out;
}

/** The variations' taste pass over the direction's System: its spec's colours, type, space and motion, before anything is drawn. */
export function tastedSystem(system: System, voice: Voice): System {
  return systemFor(system, specFor(voice, 6), faceRolesOf(system));
}

/** Three (or `count`) concepts of the prompt, free, each drafted whole. */
export function draftConcepts(prompt: string, o: { seed: number; count?: number; allowed: ReadonlySet<string>; siteName?: string }): Drafted[] {
  const v = conceptVersions(prompt, { seed: o.seed, count: o.count, allowed: o.allowed });
  return v.versions.map((ver, i) => draftOne(v, i, o.seed + i * 104729, o.siteName));
}

/** One version of `v` drafted in its direction. */
export function draftOne(v: Versions, i: number, seed: number, siteName?: string): Drafted {
  const ver = v.versions[i]!;
  const voice: Voice = directionOf(ver.name)?.id ?? DIRECTIONS[i % DIRECTIONS.length]!.id;
  const d = DIRECTIONS.find((x) => x.id === voice)!;
  const name = conceptName(siteName ?? v.name, ver.name);
  const { theme, system: themed } = themeFor(voice, d.philosophy, seed, `${name} System`);
  const system = tastedSystem(themed, voice);
  const drawn = docOf(v, i, system, theme, name);
  drawn.nodes = squarePictures(alignFirstScreen(drawn.nodes as { label?: string; featureId?: string; x: number; y: number; w: number }[], FIRST_SCREEN_ALIGN[voice]));
  return { name, direction: ver.name, pitch: ver.pitch, voice, doc: drawn, system };
}
