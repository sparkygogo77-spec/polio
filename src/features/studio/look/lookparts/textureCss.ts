import { DRIFT_CYCLE, shiftHue, GRAINY, svgUrl, channels } from "./texture.ts";
import type { TextureLayer } from "./texture.ts";
import { css, parseColor } from "./colour.ts";
import type { Palette } from "./colour.ts";
import { isLiving, liveLayers, liveStyle } from "../../living.ts";

/** A picture layer that is alive: cut into layers and given a motion (`TextureLayer.live`). */
export function liveTexture(l: TextureLayer): boolean {
  return l.kind === "image" && isLiving(l.live) && liveLayers(l.live).length > 0;
}

/** One layer as a CSS background image, plus how it is laid out. */
export function layerCss(layer: TextureLayer, colour: string): { image: string; size: string; repeat?: string } | null {
  const { kind, scale, angle, contrast: k } = layer;
  const s = Math.max(2, scale);
  const half = s / 2;
  const line = Math.max(0.5, s * (0.02 + k * 0.12));

  switch (kind) {
    /**
     * A flat colour. At contrast 0 it is exactly that — the static background
     * this stack was missing — and as contrast comes up it fades away along
     * the angle, over a distance the scale sets. So the two controls that
     * mean nothing to a solid fill are given something honest to do.
     */
    case "flat": {
      if (k < 0.02) return { image: `linear-gradient(${colour}, ${colour})`, size: "cover", repeat: "no-repeat" };
      const reach = Math.round(30 + (1 - k) * 170 + s);
      return {
        image: `linear-gradient(${angle}deg, ${colour} 0, ${withAlpha(colour, 0)} ${reach}%)`,
        size: "cover",
        repeat: "no-repeat",
      };
    }
    /**
     * Grain, in the layer's own colour.
     *
     * This used to desaturate the turbulence and lay the grey down as-is,
     * which meant three of the fourteen kinds quietly ignored the colour role
     * — a grain was always grey, and turned up it was an opaque grey lid over
     * whatever was under it. Now the noise's brightness becomes the *alpha*
     * and the role colour becomes the colour, so a grain is a scatter of holes
     * in the palette: it tints, and the layers beneath it still read.
     */
    case "noise":
    case "grain":
    case "paper": {
      const freq = kind === "noise" ? 0.9 : kind === "grain" ? 0.42 : 0.02;
      const octaves = kind === "paper" ? 4 : 2;
      const [r, g, b] = channels(colour);
      // Low contrast keeps the soft middle of the noise, so it reads as a
      // wash; high keeps only the peaks, so it reads as specks.
      const gamma = (0.5 + k * 2.5).toFixed(3);
      // Opacity lands on the tile rather than in the colour, because the
      // colour is already carrying the grain's own shape. The curve is steep
      // at the bottom, where a grain lives, and still reaches 1 — a straight
      // multiplier either made the useful end unusable or flattened out
      // halfway up, so the top half of the slider did nothing.
      const alpha = Math.pow(Math.max(0.01, Math.min(1, layer.opacity)), 0.7).toFixed(3);
      // Turbulence has no direction of its own, so the tile is turned instead —
      // which does change the grain, because the field is not symmetric.
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<filter id="f" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0.2126 0.7152 0.0722 0 0"/>` +
        `<feComponentTransfer><feFuncA type="gamma" exponent="${gamma}" amplitude="1" offset="0"/></feComponentTransfer>` +
        `</filter>` +
        `<g transform="rotate(${angle} ${s / 2} ${s / 2})">` +
        `<rect x="${-s}" y="${-s}" width="${s * 3}" height="${s * 3}" filter="url(#f)" opacity="${alpha}"/>` +
        `</g></svg>`;
      return { image: svgUrl(svg), size: `${s}px ${s}px` };
    }
    case "scanlines":
      return { image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${Math.max(line + 1, s / 4)}px)`, size: "auto" };
    case "stripes":
      return { image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px)`, size: "auto" };
    case "grid":
      return {
        image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${s}px), repeating-linear-gradient(${angle + 90}deg, ${colour} 0 ${line}px, transparent ${line}px ${s}px)`,
        size: "auto",
      };
    case "hatch":
      return {
        image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px), repeating-linear-gradient(${angle + 90}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px)`,
        size: "auto",
      };
    case "checks": {
      // Drawn as a tile rather than a conic gradient, so it can be turned; the
      // squares shrink inside their cells as contrast comes down, which is
      // what softens a check pattern without blurring it.
      const inset = (1 - (0.35 + k * 0.65)) * (s / 4);
      const q = s / 2;
      const sq = (x: number, y: number) =>
        `<rect x="${(x + inset).toFixed(2)}" y="${(y + inset).toFixed(2)}" width="${(q - inset * 2).toFixed(2)}" height="${(q - inset * 2).toFixed(2)}" fill="${colour}" rx="${(inset * 0.6).toFixed(2)}"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${angle} ${s / 2} ${s / 2})">${sq(0, 0)}${sq(q, q)}${sq(-s, 0)}${sq(s, 0)}${sq(0, -s)}${sq(0, s)}</g></svg>`;
      return { image: svgUrl(svg), size: `${s}px ${s}px` };
    }
    case "dots":
    case "halftone": {
      /*
       * Turned as a LATTICE, not as a tile. Rotating the drawing inside one
       * square tile turned each dot about its own centre and changed nothing
       * (J, 2026-10-09: "they remain in the same form and column rows"). The
       * rows turn when the tile holds a turned grid that still repeats:
       * `turnedLattice` picks the nearest angle whose grid closes on a square.
       */
      const r = Math.max(0.6, s * (kind === "halftone" ? 0.08 + k * 0.22 : 0.05 + k * 0.1));
      const half = kind === "halftone";
      const { tile, points } = turnedLattice(s, angle);
      const dot = (x: number, y: number, rr: number) =>
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rr.toFixed(2)}" fill="${colour}"/>`;
      const out: string[] = [];
      /* Each point and its copies one tile over, so a dot cut by the edge is whole across it. */
      for (const [px, py, small] of points.flatMap(([x, y, mx, my]) => [[x, y, false], ...(half ? [[mx, my, true]] : [])] as [number, number, boolean][])) {
        const rr = small ? r * 0.62 : r;
        for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
          const x = px + gx * tile, y = py + gy * tile;
          if (x + rr < 0 || y + rr < 0 || x - rr > tile || y - rr > tile) continue;
          out.push(dot(x, y, rr));
        }
      }
      const t = tile.toFixed(2);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}">${out.join("")}</svg>`;
      return { image: svgUrl(svg), size: `${t}px ${t}px` };
    }
    case "blobs": {
      // Three fields on a circle: the angle turns the circle, contrast pulls
      // their edges in, so both controls read on a shape that has no edges.
      const stop = Math.round(80 - k * 45);
      const at = (i: number) => {
        const a = ((angle + i * 120) * Math.PI) / 180;
        return `${(50 + Math.cos(a) * 30).toFixed(1)}% ${(50 + Math.sin(a) * 30).toFixed(1)}%`;
      };
      return {
        image: [0, 1, 2].map((i) => `radial-gradient(50% 58% at ${at(i)}, ${colour}, transparent ${stop}%)`).join(", "),
        size: `${s * 8}px ${s * 8}px`,
      };
    }
    case "mesh": {
      const stop = Math.round(75 - k * 35);
      const at = (i: number) => {
        const a = ((angle + i * 137) * Math.PI) / 180;
        return `${(50 + Math.cos(a) * 44).toFixed(1)}% ${(50 + Math.sin(a) * 44).toFixed(1)}%`;
      };
      return {
        image: [0, 1, 2].map((i) => `radial-gradient(80% 80% at ${at(i)}, ${colour}, transparent ${stop}%)`).join(", "),
        size: "cover",
      };
    }
    case "image": {
      const src = layer.baked ?? layer.src;
      if (!src) return null;
      const woven = Math.max(0, Math.min(1, layer.weave ?? 0));
      // Weave used to grow the tile as well as soften it, which meant it and
      // Size were two controls fighting over one number and neither of them
      // did what it said. Size sets the tile. Weave thins its edges so the
      // tiles bleed into each other (baked into the tile's alpha — see
      // `texture.ts`), and only at the very top does it become one picture
      // covering the whole surface.
      // (`texture.ts` bakes such a picture at its own size for this, `COVERS_AT`.)
      if (woven >= 0.98) return { image: `url(${JSON.stringify(src)})`, size: "cover", repeat: "no-repeat" };
      // An explicit height where the tile's shape is known: the same number
      // `auto` would work out, said out loud so a drift can move by a tile.
      const h = layer.aspect ? `${Math.max(1, Math.round(s / layer.aspect))}px` : "auto";
      return { image: `url(${JSON.stringify(src)})`, size: `${Math.round(s)}px ${h}`, repeat: "repeat" };
    }
    default:
      return null;
  }
}

/**
 * A square grid of points `s` apart, turned by `angle`, laid in a square tile
 * that repeats it exactly.
 *
 * A grid turned by an angle whose tangent is b/a (whole numbers, no common
 * factor) closes on a square tile of side s·√(a²+b²), holding a²+b² points.
 * So the angle is taken to the nearest such turn with a²+b² ≤ 50: within a
 * few degrees everywhere, and never more than 50 dots in a tile.
 * Returns each point, and the middle of its cell (where halftone puts its
 * small dot).
 */
export function turnedLattice(s: number, angle: number): { tile: number; points: [number, number, number, number][]; turned: number } {
  const want = ((angle % 90) + 90) % 90;
  let best = { a: 1, b: 0, off: want };
  for (let a = 1; a <= 7; a++) for (let b = 0; b <= 7; b++) {
    if (a * a + b * b > 50 || gcd(a, b) !== 1) continue;
    const at = (Math.atan2(b, a) * 180) / Math.PI;
    /* Turns a quarter apart draw the same grid, so the distance is taken round a quarter. */
    const off = Math.min(Math.abs(at - want), 90 - Math.abs(at - want));
    if (off < best.off - 1e-9) best = { a, b, off };
  }
  const { a, b } = best;
  const n = a * a + b * b;
  const tile = s * Math.sqrt(n);
  const step = tile / n;
  const mod = (v: number) => ((v % tile) + tile) % tile;
  const points: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = mod(i * a * step), y = mod(i * b * step);
    /* The middle of the cell: half of each of the grid's two steps, (a,b) and (−b,a). */
    points.push([x, y, mod(x + ((a - b) * step) / 2), mod(y + ((a + b) * step) / 2)]);
  }
  return { tile, points, turned: (Math.atan2(b, a) * 180) / Math.PI };
}

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x);

/**
 * The whole stack as one set of CSS properties, painted over `base`.
 *
 * The background colour is never replaced — it is the bottom of the stack and
 * every layer sits over it.
 *
 * Nothing a layer emits is allowed to be an opaque wash of that background
 * colour. It used to be: a picture was veiled with it to carry its opacity and
 * its weave, which worked on a single layer over a flat page and destroyed
 * every stack, because the veil covered the layers underneath as surely as it
 * faded the picture. Opacity and weave are cut into the tile's own alpha now
 * (`texture.ts`), so what is under a half-solid layer is the layer below it,
 * not the page colour painted over the top of it.
 */
export function textureCss(
  layers: TextureLayer[],
  palette: Palette,
  base: string,
  /* The page's fill, each layer with the size it is laid down at — structural
     rather than the `FillLayer` type itself, which lives in `parts/theme.ts`
     and imports this file. */
  under: { image: string; size: string }[] = [],
): React.CSSProperties {
  const on = layers.filter((l) => l.on);
  /*
   * `under` is the page's own FILL, and it is painted beneath the stack
   * rather than replaced by it.
   *
   * It used to be replaced, and in silence. The fill and the texture stack
   * are two different controls that paint the same page, and the moment any
   * page layer was switched on the fill was dropped on the floor — set a
   * mesh gradient, add a grain over it, and the mesh is gone with nothing
   * said. A control that stops doing anything without saying so is worse
   * than one that is not there.
   *
   * CSS paints background images front to back, so the fill goes on the END
   * of the list and everything else sits over it, which is what "before any
   * texture" always meant.
   *
   * The size comes in with the layer. It used to be forced to `auto` here,
   * on the reasoning that a fill is a gradient across the page rather than a
   * tile — true of the gradients, false of Grid, and the reason a grid with
   * a grain over it was a hairline with a grain over it.
   */
  const bed = under.map(({ image, size }) => ({ image, size, repeat: "repeat", blend: "normal", dx: 0, dy: 0 }));
  if (!on.length) return bed.length ? flat(bed, base) : { background: base };
  /*
   * A LIVING PICTURE IS THE WHOLE GROUND. Its back layer is the whole picture,
   * opaque, so nothing under it would show; and its keyframes move every
   * background layer in the list, so nothing else may sit in it. The front
   * layers and their motion are the living picture's own (`living.ts`).
   */
  const alive = on.find(liveTexture);
  if (alive) return { ...(liveStyle(alive.live!) as React.CSSProperties), backgroundColor: base };

  const parts = [...compose(on, palette), ...bed];
  if (!parts.length) return { background: base };
  const moving = parts.some((p) => p.dx || p.dy);
  return {
    backgroundImage: parts.map((p) => p.image).join(", "),
    backgroundSize: parts.map((p) => p.size).join(", "),
    backgroundRepeat: parts.map((p) => p.repeat).join(", "),
    backgroundPosition: parts.map(() => "center").join(", "),
    backgroundBlendMode: parts.map((p) => p.blend).join(", "),
    backgroundColor: base,
    ...(moving ? { animation: `${driftName(parts)} ${DRIFT_CYCLE}s linear infinite` } : {}),
  };
}

/** The fill on its own, with no texture over it. */
function flat(bed: Part[], base: string): React.CSSProperties {
  return {
    backgroundImage: bed.map((p) => p.image).join(", "),
    backgroundSize: bed.map((p) => p.size).join(", "),
    backgroundRepeat: bed.map((p) => p.repeat).join(", "),
    backgroundPosition: bed.map(() => "center").join(", "),
    backgroundColor: base,
  };
}

/** One background layer as CSS, and how far it travels in a cycle. */
interface Part { image: string; size: string; repeat: string; blend: string; dx: number; dy: number }

/**
 * The stack, walked once.
 *
 * Both the style and the keyframes that move it have to agree on the order and
 * the count of the background layers — a layer can push more than one — so
 * there is one walk and they both read it.
 */
function compose(on: TextureLayer[], palette: Palette): Part[] {
  const parts: Part[] = [];
  for (const l of on) {
    if (liveTexture(l)) continue;
    // A generated pattern carries its opacity in its own colour; a picture and
    // a grain carry theirs in the tile, because there is no single colour to
    // fade — see `texture.ts` and the grain case in `layerCss`.
    const picture = l.kind === "image";
    const role = shiftHue(l.colour ?? palette[l.role], l.hue ?? 0);
    const colour = withAlpha(role, GRAINY.has(l.kind) || picture ? 1 : l.opacity);
    const built = layerCss(l, colour);
    if (!built) continue;
    const repeat = built.repeat ?? "repeat";
    const images = splitLayers(built.image);
    const sizes = splitLayers(built.size);
    images.forEach((image, i) => {
      const size = (sizes[i] ?? sizes[0]!).trim();
      parts.push({ image: image.trim(), size, repeat, blend: l.blend, ...travel(l, size, repeat) });
    });
  }
  return parts;
}

/**
 * How far a layer moves in one cycle: a whole number of its own tiles, along
 * its own angle.
 *
 * Whole tiles, because a repeating background that has moved by exactly one
 * tile is the picture it started as — so the loop has no seam. A layer whose
 * tile is not a known size in both directions (one picture stretched to cover,
 * a tile with no shape written down) cannot be moved by a whole tile, so it
 * stays where it is rather than jumping once a cycle.
 */
function travel(l: TextureLayer, size: string, repeat: string): { dx: number; dy: number } {
  const drift = Math.max(0, Math.min(1, l.drift ?? 0));
  if (!drift || repeat !== "repeat") return { dx: 0, dy: 0 };
  /*
   * Lines drawn across the whole box (stripes, scan lines, grid, hatch) have
   * no tile, only a period across the lines, so Drift did nothing on them.
   * Moved along the gradient's own direction by a whole number of periods,
   * the lines are back where they started: no seam in the loop.
   */
  const period = linePeriod(l);
  if (period && size === "auto") {
    const d = driftTiles(drift) * period;
    const a = ((l.angle ?? 0) * Math.PI) / 180;
    return { dx: Number((Math.sin(a) * d).toFixed(3)), dy: Number((-Math.cos(a) * d).toFixed(3)) };
  }
  const [w, h] = size.split(/\s+/).map((v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : NaN));
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return { dx: 0, dy: 0 };
  const tiles = driftTiles(drift);
  const a = ((l.angle ?? 0) * Math.PI) / 180;
  return { dx: Math.round(Math.cos(a) * tiles) * w, dy: Math.round(Math.sin(a) * tiles) * h };
}

/**
 * How many tiles a layer travels in one cycle. It was up to six in ninety
 * seconds: a 24px dot moved under two pixels a second at full Drift, which
 * reads as still. Up to forty is a slow walk at the bottom of the dial and a
 * plain drift at the top.
 */
const driftTiles = (drift: number) => Math.max(1, Math.round(drift * 40));

/** How far apart a line kind's lines are, px, as `layerCss` draws them; null for every other kind. */
function linePeriod(l: TextureLayer): number | null {
  const s = Math.max(2, l.scale);
  const line = Math.max(0.5, s * (0.02 + l.contrast * 0.12));
  if (l.kind === "stripes" || l.kind === "hatch") return s / 2;
  if (l.kind === "grid") return s;
  if (l.kind === "scanlines") return Math.max(line + 1, s / 4);
  return null;
}

/** A name that changes when the movement does, so the keyframes are replaced with it. */
function driftName(parts: Part[]): string {
  let hash = 0;
  for (const p of parts) hash = (hash * 31 + p.dx * 7 + p.dy * 13) | 0;
  return `tex-drift-${(hash >>> 0).toString(36)}`;
}

/**
 * The keyframes a drifting stack needs, or nothing when it is still.
 *
 * Written out rather than kept in the stylesheet because there is one set per
 * stack: every layer has its own distance and they all have to be listed in
 * the one `background-position` the browser animates.
 */
export function driftKeyframes(layers: TextureLayer[], palette: Palette, under: { image: string; size: string }[] = []): { name: string; css: string } | null {
  /* With the page's fill under it when `textureCss` was given one: the same layers in the same order, so the name and the count agree. */
  const parts = [...compose(layers.filter((l) => l.on), palette), ...under.map(({ image, size }) => ({ image, size, repeat: "repeat", blend: "normal", dx: 0, dy: 0 }))];
  if (!parts.some((p) => p.dx || p.dy)) return null;
  const to = parts.map((p) => `calc(50% + ${p.dx}px) calc(50% + ${p.dy}px)`).join(", ");
  const name = driftName(parts);
  return { name, css: `@keyframes ${name}{to{background-position:${to}}}` };
}

/**
 * Split a background list on the commas that separate whole layers.
 *
 * A regex cannot do this: `linear-gradient(oklch(…), oklch(…))` has a comma at
 * depth two, and any lookahead cheap enough to write splits the gradient in
 * half — which then shifts every size and repeat one place along, so a tiled
 * texture silently comes out as `cover`. Count the brackets instead.
 */
function splitLayers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

/** Put an alpha on a colour however it was written. */
export function withAlpha(colour: string, alpha: number): string {
  const parsed = parseColor(colour);
  if (parsed) return css(parsed, alpha);
  return colour;
}

/* ------------------------------------------------------------------ */
/* The whole look                                                      */
/* ------------------------------------------------------------------ */

/**
 * A texture layer as CSS for one part the style layer writes (`send-out/
 * styleLayer.ts#wearTextures`): the layer's pictures over the part's own
 * background picture, if it has one, which keeps its size, place and repeat.
 * Its drift moves the whole list, so its keyframes name every layer in it.
 */
export function wornPaint(layer: TextureLayer, palette: Palette, own: { background?: string; options?: readonly string[] } = {}): { image?: string; size?: string; position?: string; repeat?: string; blend?: string; animation?: string; keyframes?: string } | null {
  const images = own.background ? splitLayers(own.background).map((s) => s.trim()).filter(Boolean) : [];
  const pick = (i: number, list: string | undefined, fallback: string) => (list ? splitLayers(list)[i]?.trim() || splitLayers(list)[0]?.trim() : undefined) || fallback;
  const under = images.map((image, i) => ({ image, size: pick(i, own.options?.[0], "auto") }));
  const one = [{ ...layer, on: true }];
  const st = textureCss(one, palette, "transparent", under) as Record<string, string | undefined>;
  if (!st.backgroundImage) return null;
  /* The part's own pictures keep where they sat and whether they repeat; the texture's are its own. */
  const count = splitLayers(st.backgroundImage).length;
  const mine = count - images.length;
  const list = (v: string | undefined, i: number, ownList: string | undefined, fallback: string) => (i < mine ? (v ? splitLayers(v)[i]?.trim() : undefined) ?? fallback : pick(i - mine, ownList, fallback));
  const position = Array.from({ length: count }, (_, i) => list(st.backgroundPosition, i, own.options?.[1], "0% 0%")).join(", ");
  const repeat = Array.from({ length: count }, (_, i) => list(st.backgroundRepeat, i, own.options?.[2], "repeat")).join(", ");
  const drift = driftKeyframes(one, palette, under);
  return { image: st.backgroundImage, size: st.backgroundSize, position, repeat, blend: st.backgroundBlendMode, ...(st.animation && drift ? { animation: st.animation, keyframes: drift.css } : {}) };
}
