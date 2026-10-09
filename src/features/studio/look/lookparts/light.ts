import type { CarriedFont } from "../fonts";
import type { CapturedKeyframes } from "../../shelf";
import type { Group, SiteTheme } from "../../siteTheme";
import type { TextureLayer } from "./texture.ts";
import type { RoleId, Palette } from "./colour.ts";

/**
 * One lamp, somewhere over the page.
 *
 * A flat site has every shadow pointing the same way, which is to say it has
 * no shadows at all — just a soft grey smear under everything. Put the light
 * somewhere and each part knows where it is standing relative to it: a card on
 * the left throws its shadow left, one under the lamp throws almost none, and
 * the lit edge of every button faces the same way across the whole page.
 *
 * `x` and `y` are fractions of the page, so the lamp stays where it was put
 * when the frame changes width. `height` is how high above the page it hangs:
 * low means long raking shadows, high means short ones straight down.
 */
export interface Light {
  on: boolean;
  x: number;
  y: number;
  /** 0 = at the page's own level, 1 = straight overhead. */
  height: number;
  /** How dark the shadows are, 0..1. */
  strength: number;
  /** How far a lit surface stands off the page, in px. Also the blur. */
  lift: number;
  /** Warmth of the lit face, in degrees around the wheel. */
  warmth: number;
  /**
   * How much of the lamp lands on the page itself, 0..1. None, by default.
   *
   * A lamp that throws shadows and a lamp that pools light on the background
   * are two different wants, and asking for the first almost never means
   * asking for the second: a pool of warm light under a page's own colour is
   * the fastest way to make a careful palette look like a mistake. So the
   * shadows come with the lamp and this comes only when it is asked for.
   */
  wash?: number;
}

export const defaultLight = (): Light => ({ on: false, x: 0.5, y: 0.12, height: 0.55, strength: 0.45, lift: 10, warmth: 80, wash: 0 });

/**
 * The pool of light the lamp puts on the page itself, or nothing.
 *
 * Painted under the parts, never over them, because a lamp lights a table and
 * the things on the table cast their shadows on to it. A high lamp pools wide
 * and soft; a low one throws a tighter spot.
 */
export function washCss(light: Light | undefined): string | null {
  const w = light?.wash ?? 0;
  if (!light?.on || w <= 0.005) return null;
  const r = Math.round(45 + light.height * 75);
  const a = (w * 0.5).toFixed(3);
  return `radial-gradient(${r}% ${r}% at ${(light.x * 100).toFixed(1)}% ${(light.y * 100).toFixed(1)}%, oklch(0.97 0.06 ${Math.round(light.warmth)} / ${a}), transparent 72%)`;
}

export interface Look {
  /** Empty strings mean "derive it from the accent hue", as before. */
  palette: Partial<Palette>;
  /** A site brought in from a code repository: what its code is written against, for the style layer sent back to it (`styleLayer.ts`). */
  styleSource?: import("../../send-out").StyleSource | null;
  texture: TextureLayer[];
  /** Where the texture is painted. */
  target: "page" | "surfaces" | "both";
  /** The lamp, and the depth it gives everything under it. */
  light: Light;
  /** A dark veil over the whole page, 0..0.85. Nothing, when absent. */
  veil?: number;
  /**
   * The faces carried with the site, one to one (`fonts.ts`): the file as
   * bytes, or the link that loads it, beside the textures. A part names a
   * face by name (`NodeFont.face`), so a carried face stays swappable.
   * Absent on every site that carried none, and nothing is drawn for it.
   */
  fonts?: CarriedFont[];
  /**
   * Where each role came from, on a site brought in (`paletteFrom.ts`): the
   * colour the rule picked off the site's own parts and how many parts
   * follow it, or the role it shows because the site gave none. Absent on a
   * site made here, and the panel says nothing about sources then.
   */
  paletteFrom?: Partial<Record<RoleId, { colour: string; parts: number; shows?: RoleId }>>;
  /**
   * Each part's colours before the Colours panel first changed them
   * (`siteColours.ts#ColoursWas`), by part id: what Reset puts back. Absent
   * until a colour is changed there; Reset empties it.
   */
  coloursWas?: Record<string, import("../siteColours.ts").ColoursWas>;
  /**
   * The page's own `@keyframes`, as a capture read them (sink `doc.keyframes`),
   * for the parts whose `node.motion` names them. Kept with the look so they
   * travel with the document; drawn under a prefixed name
   * (`parts/capturedMotion.ts`). Absent on a site made here.
   */
  keyframes?: CapturedKeyframes[];
  /**
   * A new site's theme (`siteTheme.ts`): the one record its colours, fonts,
   * shapes, layout and motion were rolled from, and how the next roll is to
   * be made (what is locked, how original, the philosophy, Try these).
   * Absent on a site brought in or made before themes existed.
   */
  theme?: SiteTheme | null;
  themeRoll?: ThemeRollSettings | null;
  /**
   * Colour palettes he saved by name (`SavedPalettes.tsx`), kept with the
   * site: all six roles as they stood, put back with one press. Absent until
   * the first is saved.
   */
  palettes?: SavedPalette[];
}

/** A palette saved by name: the six roles as they stood when it was saved. */
export interface SavedPalette {
  id: string;
  name: string;
  colours: Palette;
}

/** How the next roll is made, kept with the site. */
export interface ThemeRollSettings {
  locks: Group[];
  /** 0 Familiar … 1 Original. */
  originality: number;
  philosophy: string;
  tryThese: boolean;
}

/** A new site rolls in the middle of the slider, nothing locked, with parts to try. */
export const defaultRoll = (): ThemeRollSettings => ({ locks: [], originality: 0.5, philosophy: "", tryThese: true });

export const emptyLook = (): Look => ({ palette: {}, texture: [], target: "page", light: defaultLight() });

/**
 * Where a box at `(cx, cy)` on the page sits relative to the lamp, and what
 * that means for its shadow: a direction away from the light, a length that
 * grows with distance and with how low the lamp hangs, and a blur that grows
 * with both.
 */
export function castFrom(light: Light, cx: number, cy: number): { dx: number; dy: number; blur: number; spread: number } | null {
  if (!light.on) return null;
  const ox = cx - light.x;
  const oy = cy - light.y;
  const dist = Math.hypot(ox, oy) || 0.0001;
  const h = Math.max(0, Math.min(1, light.height));
  /*
   * HOW LONG THE SHADOW IS, and why this was rewritten.
   *
   * "How high it hangs" was dead, measured: moving it end to end changed
   * 0% of the pixels on a card. The length was `min(3, dist * reach) *
   * lift`, and `dist` is a fraction of the page — about 0.09 for a part
   * near the lamp — so `dist * reach` ran from 0.23 to 0.02 and the whole
   * control was worth 2.27px of shadow at the bottom and 0.21px at the
   * top. The `min(3, …)` was written as though `dist` were in pixels; it
   * never came near 3, and what was left was `lift * a small number`, so
   * lift was the only thing that moved.
   *
   * A shadow's length is a multiple of how far the thing stands off the
   * page, so that is what this is: `reach` runs from about 3.5 lifts with
   * the lamp raking to about a tenth of one overhead. Distance from the
   * lamp leans it a little further — the page is one unit across, so it is
   * a lean and not the whole of it — and the whole thing is capped so a
   * part in the far corner does not throw a shadow off the page.
   */
  const reach = (1 - h) ** 1.5 * 3.4 + 0.12;
  const away = 0.5 + Math.min(1, dist / 0.45) * 0.8;
  const len = Math.min(light.lift * 4.2, light.lift * reach * away);
  return {
    dx: Math.round((ox / dist) * len),
    // Overhead, most of what there is sits straight under the box; raking,
    // almost none of it does and the length carries the direction instead.
    dy: Math.round((oy / dist) * len + light.lift * (0.18 + 0.32 * h)),
    blur: Math.round(light.lift * (0.8 + 0.8 * h) + len * 0.55),
    spread: 0,
  };
}


/**
 * The two strings a lit surface wears: the shadow it throws and the wash on
 * the face turned toward the lamp.
 *
 * ONE COPY, and the reason for saying so. There were two — `liftVars` for
 * the board and `liftTheme` for the parts — and they had drifted: fixing
 * the lit face in one of them left "Warmth" dead on the board, because the
 * board reads the other. Both call this now.
 */
export function liftCss(light: Light, cx: number, cy: number): { shadow: string; sheen: string } | null {
  const cast = castFrom(light, cx, cy);
  if (!cast) return null;
  const dark = Math.max(0, Math.min(0.9, light.strength));
  const away = Math.hypot(cx - light.x, cy - light.y) || 0.0001;
  const from = { x: (light.x - cx) / away, y: (light.y - cy) / away };
  // Two shadows: a tight one that seats the box on the page, and a long one
  // that carries the direction. Both point away from the lamp.
  const near = `${Math.round(cast.dx * 0.35)}px ${Math.round(cast.dy * 0.35)}px ${Math.round(cast.blur * 0.4)}px oklch(0 0 0 / ${(dark * 0.5).toFixed(3)})`;
  const far = `${cast.dx}px ${cast.dy}px ${cast.blur}px oklch(0 0 0 / ${(dark * 0.55).toFixed(3)})`;
  /*
   * The lit face. It used to be `oklch(1 0.02 …)`, and at that chroma a hue
   * cannot be read at all — white is white whatever angle you take it
   * from — which is why "Warmth" measured as doing nothing even where the
   * wash was painted. Enough chroma to carry a colour now, and the alpha
   * still small: this is the light catching an edge, not a tint over the
   * page.
   */
  const deg = Math.round((Math.atan2(from.x, from.y) * 180) / Math.PI + 180);
  return {
    shadow: `${near}, ${far}`,
    sheen: `linear-gradient(${deg}deg, oklch(0.96 0.13 ${Math.round(light.warmth)} / ${(0.07 + dark * 0.13).toFixed(3)}), transparent 58%)`,
  };
}

/* ------------------------------------------------------------------ */
/* Entrances                                                           */
/* ------------------------------------------------------------------ */
