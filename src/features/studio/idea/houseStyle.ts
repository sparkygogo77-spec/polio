/**
 * WHICH SYSTEM A NEW IDEA IS DRAWN IN.
 *
 * J chose one house style shared by every site (2026-10-24): one System in
 * the library, marked as the house style, and every new draft is drawn in its
 * tokens. Until a System is marked, a draft uses the open site's System, and
 * failing that a System made from a theme rolled on the brief's words (the
 * same roll a new site's sample page gets, `siteTheme.ts`), so a draft is
 * always linked to tokens from the start.
 *
 * THE MARK. The system-panel lane owns how a System is marked: `house`, the
 * time it was marked, the latest mark winning (`system/store.ts#houseOf` on
 * that lane's branch). This reads that mark, and until it lands a System
 * named "House style". When both are absent nothing is marked.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { emptySystem, type ColourToken, type CssToken, type FaceToken, type SizeToken, type System } from "../system/model.ts";
import { motionOf, pairingOf, radii, readPhilosophy, rollTheme, shadowCss, space, themeColours, typeSize, type SiteTheme } from "../siteTheme.ts";

/** When this System was marked the house style (0: never, 1: named so but not marked). */
function markOf(s: System): number {
  if (typeof s.house === "number" && s.house > 0) return s.house;
  return /^\s*house style\s*$/i.test(s.name) ? 1 : 0;
}

/** Is this System the house style? */
export const isHouseStyle = (s: System): boolean => markOf(s) > 0;

/** The library's house style: the latest marked, then the latest changed; or null. */
export function houseStyleOf(library: readonly System[]): System | null {
  return [...library].filter(isHouseStyle).sort((a, b) => markOf(b) - markOf(a) || b.editedAt - a.editedAt)[0] ?? null;
}

export type StyleFrom = "house" | "site" | "theme";

/**
 * The System a draft is drawn in, and where it came from: the house style,
 * else the open site's, else one made from a theme rolled on the idea's
 * words.
 */
export function pickStyle(o: { library: readonly System[]; site: System | null; words: string; seed: number; name?: string }): { system: System; from: StyleFrom; theme: SiteTheme | null } {
  const house = houseStyleOf(o.library);
  if (house) return { system: house, from: "house", theme: null };
  if (o.site && o.site.tokens.colour.length) return { system: o.site, from: "site", theme: null };
  const phil = readPhilosophy(o.words);
  const theme = rollTheme({ seed: o.seed, ranges: phil.ranges, philosophy: o.words.trim() || null });
  return { system: systemFromTheme(theme, o.name), from: "theme", theme };
}

/**
 * A theme as a System: the six roles and the ink on the accent, the type
 * steps from small print to display, the two faces (heading first), the
 * space steps, the corners, three depths of shadow and the motion.
 */
export function systemFromTheme(t: SiteTheme, name?: string, at = Date.now()): System {
  const c = themeColours(t);
  const pair = pairingOf(t.fonts.pairing);
  const r = radii(t);
  const mo = motionOf(t);
  const s = emptySystem(name?.trim() || t.name, "brief", undefined, at);
  const colour: ColourToken[] = [
    { id: "col_1", name: "Background", value: c.bg, role: "bg" },
    { id: "col_2", name: "Surface", value: c.surface, role: "surface" },
    { id: "col_3", name: "Text", value: c.text, role: "text" },
    { id: "col_4", name: "Muted text", value: c.muted, role: "muted" },
    { id: "col_5", name: "Accent", value: c.accent, role: "accent" },
    { id: "col_6", name: "Highlight", value: c.highlight, role: "highlight" },
    { id: "col_7", name: "On accent", value: c.onAccent, use: "Buttons" },
    { id: "col_8", name: "Outline", value: c.line, use: "Outline" },
  ];
  const STEPS: [number, string][] = [[5, "Display"], [4, "Heading 1"], [3, "Heading 2"], [2, "Heading 3"], [1, "Lead"], [0, "Body"], [-1, "Small"]];
  const seen = new Set<number>();
  const steps: SizeToken[] = [];
  for (const [n, label] of STEPS) { const px = typeSize(t, n); if (!seen.has(px)) { seen.add(px); steps.push({ id: `typ_${steps.length + 1}`, name: label, px }); } }
  const faces: FaceToken[] = [{ id: "fac_1", name: "Headings", stack: pair.heading }];
  if (pair.body !== pair.heading) faces.push({ id: "fac_2", name: "Body", stack: pair.body });
  const spaceSteps: SizeToken[] = [];
  const spaced = new Set<number>();
  for (const n of [1, 2, 3, 4, 6, 8, 12, 16]) { const px = space(t, n); if (!spaced.has(px)) { spaced.add(px); spaceSteps.push({ id: `spc_${spaceSteps.length + 1}`, name: `Space ${spaceSteps.length + 1}`, px }); } }
  const radius: SizeToken[] = [];
  for (const [label, px] of [["Small", r.small], ["Box", r.box], ["Button", r.button]] as const) if (!radius.some((x) => x.px === px)) radius.push({ id: `rad_${radius.length + 1}`, name: label, px });
  const shadow: CssToken[] = ([1, 2, 3] as const).map((d, i) => ({ id: `shd_${i + 1}`, name: ["Low", "Medium", "High"][i]!, css: shadowCss(t, c, d) })).filter((x) => x.css);
  return {
    ...s,
    tokens: {
      colour,
      type: { faces, scale: { ratio: t.layout.scale, base: typeSize(t, 0) }, steps },
      space: spaceSteps,
      radius,
      shadow,
      motion: { durations: [{ id: "dur_1", name: "Normal", css: mo.duration }], easings: [{ id: "eas_1", name: "Ease", css: mo.timing }] },
    },
  };
}
