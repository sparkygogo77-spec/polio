"use client";
/**
 * Dark matter: the ground the Builder stands on.
 *
 * Violet and magenta nebula clouds over black voids in two depths, with red
 * embers blown through the near cloud. It was drawn for the add disc — the
 * hole you pull parts out of — and it is here rather than there because the
 * workspace behind the page now stands on the same ground. One generator,
 * one cast of sparks, two surfaces: a disc, and the whole canvas.
 *
 * **The two depths.** Two tiles of fractal noise are made once, each already
 * coloured and cut to its own alpha — a soft mask for the violet, a sharper
 * one for the magenta — and every frame lays them over the black ground as
 * repeating patterns, screened together so where they cross they bloom. The
 * far depth is one huge slow mass, drawn large and barely moving, turning
 * about the middle over minutes: a planet at the back with no edge to see,
 * only weather. The near depth is cloud you can watch pass: smaller,
 * drifting across in a few tens of seconds, turning the other way. Nothing
 * is white.
 *
 * **The sparks are per surface.** They were module state when there was one
 * disc and never two of it; a workspace and a disc open at once would have
 * shared one set and each seen it teleport. A `SparkField` holds its own
 * cast, its own clock and its own bounds, and how many it holds grows with
 * the square root of the area — a wall of a screen at the disc's density
 * would be a swarm, and the embers are meant to be something you are not
 * sure moved.
 */
import { oklchToRgb, parseColor } from "./look";
import { PROCESS } from "./threads";

/* ------------------------------------------------------------------ */
/* The clouds                                                          */
/* ------------------------------------------------------------------ */

const TILE = 256;
let tiles: { violet: HTMLCanvasElement; magenta: HTMLCanvasElement } | null = null;

function noiseTile(seed: number): Float32Array {
  // Value noise, four octaves, smooth-stepped, on a grid that wraps so the tile repeats.
  const out = new Float32Array(TILE * TILE);
  const rand = (x: number, y: number, s: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let o = 0, cells = 4, amp = 0.5; o < 4; o++, cells *= 2, amp *= 0.5) {
    const cell = TILE / cells;
    for (let y = 0; y < TILE; y++) {
      const gy = Math.floor(y / cell), fy = y / cell - gy;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < TILE; x++) {
        const gx = Math.floor(x / cell), fx = x / cell - gx;
        const sx = fx * fx * (3 - 2 * fx);
        const a = rand(gx % cells, gy % cells, seed + o);
        const b = rand((gx + 1) % cells, gy % cells, seed + o);
        const c = rand(gx % cells, (gy + 1) % cells, seed + o);
        const d = rand((gx + 1) % cells, (gy + 1) % cells, seed + o);
        out[y * TILE + x]! += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
  }
  return out;
}

function colourTile(noise: Float32Array, rgb: [number, number, number], from: number, to: number, gamma: number): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = TILE;
  el.height = TILE;
  const c = el.getContext("2d")!;
  const img = c.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    const n = Math.max(0, Math.min(1, (noise[i]! - from) / (to - from)));
    const a = Math.pow(n, gamma);
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  c.putImageData(img, 0, 0);
  return el;
}

function darkMatterTiles() {
  if (tiles) return tiles;
  const a = noiseTile(3);
  const b = noiseTile(11);
  tiles = {
    violet: colourTile(a, [112, 50, 204], 0.3, 0.78, 1.35),
    magenta: colourTile(b, [176, 58, 198], 0.42, 0.84, 1.6),
  };
  return tiles;
}

/* ------------------------------------------------------------------ */
/* The sparks                                                          */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
type Kind = "gust" | "drift" | "fall" | "rise" | "dart";

/**
 * One ember in five is green; the other four stay red.
 *
 * Not a second palette: it is `PROCESS.done`, the same green the Finish flag
 * and the timeline's finished boxes are drawn in, converted here because a
 * canvas takes a colour as a string and silently keeps the last one it
 * understood if it cannot read the new one. Deriving it rather than writing
 * `0,197,91` down means the ground follows the palette if the palette moves.
 */
const GREEN_INK: string = (() => {
  const c = parseColor(PROCESS.done);
  const rgb = c ? oklchToRgb(c) : [0, 0.773, 0.357];
  return rgb.map((v) => Math.round(v * 255)).join(",");
})();

/**
 * One in how many. Fixed at the cast, not rolled per life: a spark that
 * re-rolled its colour every few seconds would flicker between the two, and
 * a coin flipped per spark would land on 14% one minute and 27% the next.
 * The stride is five against a cast of seventeen, so the green walks through
 * all five kinds instead of settling on one, and since every spark is lit at
 * a fresh random spot there is no band or clump to it.
 */
const GREEN_IN = 5;

/**
 * How fast a darter idles between kicks, in pixels a second.
 *
 * Slow enough that the kick is still the event, fast enough that the eye
 * never catches it parked. About a pixel every three frames.
 */
const DART_IDLE = 7;

/**
 * The embers: small red sparks, no two ways of moving alike.
 *
 * Five kinds. **Gust riders** come in small knots, each knot on a gust of its
 * own that lives near it — a direction that wanders, a strength that is calm
 * most of the time and blows now and then — so three sparks in one corner
 * lean the same way while three in another do something else. **Drifters**
 * wander alone on a heading of their own, slowly, and are almost always a
 * dot. **Fallers** sink with a sway, like an ember dropping out of a fire.
 * **Risers** climb, gathering speed and flickering, and burn out sooner.
 * **Darters** sit still, then go — a short quick dart in some direction —
 * and sit again. Every spark streaks by its own speed: a dot when it drifts,
 * a short line when it goes. Each burns a few seconds, fades in and out, and
 * where it dies another of its kind is lit. Small and dim on purpose: you
 * should not be sure it moved, only that it is not where it was.
 */
const CAST: { kind: Kind; group: number }[] = [
  { kind: "gust", group: 0 }, { kind: "gust", group: 0 }, { kind: "gust", group: 0 },
  { kind: "gust", group: 1 }, { kind: "gust", group: 1 }, { kind: "gust", group: 1 },
  { kind: "drift", group: 0 }, { kind: "drift", group: 0 }, { kind: "drift", group: 0 }, { kind: "drift", group: 0 },
  { kind: "fall", group: 0 }, { kind: "fall", group: 0 }, { kind: "fall", group: 0 },
  { kind: "rise", group: 0 }, { kind: "rise", group: 0 },
  { kind: "dart", group: 0 }, { kind: "dart", group: 0 },
];

type Spark = { kind: Kind; group: number; green: boolean; x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; warm: number; phase: number; heading: number; next: number };

export type Shape = "disc" | "ground";

/** One surface's worth of embers: its own cast, its own clock, its own bounds. */
export interface SparkField {
  shape: Shape;
  w: number;
  h: number;
  sparks: Spark[];
  clock: number;
  /** How many knots the gust riders are divided between. */
  knots: number;
}

/** The disc this was drawn for, and the unit the density is quoted in. */
const DISC_AREA = 320 * 320;

/**
 * How many sparks a surface gets.
 *
 * Not linear in area: the disc's density across a whole screen is a swarm,
 * and a swarm is a fire, not embers. The square root keeps the scatter
 * reading the same at both sizes — more of them, further apart.
 */
export function castSize(w: number, h: number): number {
  const scale = Math.sqrt(Math.max(1, (w * h) / DISC_AREA));
  return Math.max(CAST.length, Math.min(96, Math.round(CAST.length * scale)));
}

export function sparkField(shape: Shape, w: number, h: number): SparkField {
  const n = castSize(w, h);
  const sparks: Spark[] = [];
  // The cast repeats, so the proportions hold however many there are: knots
  // of riders, then the loners, then the fallers, risers and darters.
  const knots = Math.max(2, Math.round((n / CAST.length) * 2));
  for (let i = 0; i < n; i++) {
    const role = CAST[i % CAST.length]!;
    sparks.push({
      kind: role.kind,
      group: role.kind === "gust" ? (role.group + Math.floor(i / CAST.length) * 2) % knots : 0,
      green: i % GREEN_IN === 0,
      x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 0, warm: 0, phase: 0, heading: 0, next: 0,
    });
  }
  return { shape, w, h, sparks, clock: 0, knots };
}

/** The same field at a new size: the sparks keep going, the walls move. */
export function resizeField(f: SparkField, w: number, h: number): SparkField {
  if (Math.abs(f.w - w) < 1 && Math.abs(f.h - h) < 1) return f;
  const next = sparkField(f.shape, w, h);
  // Carry over what still fits, so a resize is not a blackout.
  for (let i = 0; i < Math.min(next.sparks.length, f.sparks.length); i++) next.sparks[i] = f.sparks[i]!;
  next.clock = f.clock;
  return next;
}

/** A knot's gust: where it lives (a slow orbit), which way it blows, how hard right now. */
function gustOf(group: number, t: number, f: SparkField): { cx: number; cy: number; vx: number; vy: number } {
  const p = group * 2.1 + 0.6;
  const cx = f.w / 2 + Math.cos(t * 0.05 + p) * f.w * 0.45;
  const cy = f.h / 2 + Math.sin(t * 0.037 + p * 1.7) * f.h * 0.45;
  const dir = p * 1.9 + 1.1 * Math.sin(t * 0.13 + p) + 0.7 * Math.sin(t * 0.041 + p * 3);
  const breath = 0.5 + 0.5 * Math.sin(t * (0.27 + group * 0.08) + p * 5);
  const blow = 6 + 150 * breath * breath * breath;
  return { cx, cy, vx: Math.cos(dir) * blow, vy: Math.sin(dir) * blow };
}

function lightSpark(f: SparkField, t: number, s: Spark): Spark {
  const r = Math.min(f.w, f.h) / 2;
  // Riders are lit near their gust; everyone else anywhere on the surface.
  if (s.kind === "gust") {
    const g = gustOf(s.group, t, f);
    const a = Math.random() * TAU;
    const d = Math.random() * r * 0.22;
    s.x = g.cx + Math.cos(a) * d;
    s.y = g.cy + Math.sin(a) * d;
  } else if (f.shape === "disc") {
    // Square-rooted, so the disc fills evenly instead of clumping in the middle.
    const a = Math.random() * TAU;
    const d = Math.sqrt(Math.random()) * r * 0.88;
    s.x = f.w / 2 + Math.cos(a) * d;
    s.y = f.h / 2 + Math.sin(a) * d;
  } else {
    s.x = Math.random() * f.w;
    s.y = Math.random() * f.h;
  }
  s.vx = 0;
  s.vy = 0;
  s.age = 0;
  s.life = s.kind === "rise" ? 1.4 + Math.random() * 1.2 : s.kind === "dart" ? 4 + Math.random() * 4 : 2.2 + Math.random() * 3;
  s.size = 0.45 + Math.random() * 0.6;
  s.warm = Math.random();
  s.phase = Math.random() * TAU;
  s.heading = Math.random() * TAU;
  s.next = t + 0.6 + Math.random() * 2.5;
  return s;
}

/** Has it left? A disc loses them at its horizon, a wall at its edges. */
function gone(f: SparkField, s: Spark): boolean {
  if (f.shape === "disc") {
    const r = Math.min(f.w, f.h) / 2;
    const dx = s.x - f.w / 2;
    const dy = s.y - f.h / 2;
    return dx * dx + dy * dy > r * r * 0.9;
  }
  const m = 24;
  return s.x < -m || s.y < -m || s.x > f.w + m || s.y > f.h + m;
}

export function paintEmbers(c: CanvasRenderingContext2D, f: SparkField, t: number) {
  if (!f.sparks[0]?.life) for (const s of f.sparks) lightSpark(f, t, s);
  // The clock restarts with every surface; a step backwards is no step.
  const dt = Math.min(0.1, Math.max(0.001, t - f.clock));
  f.clock = t;
  c.save();
  c.lineCap = "round";
  for (const s of f.sparks) {
    // Where this one wants to go, and how quickly it takes to it.
    let tx = 0, ty = 0, lag = 3;
    switch (s.kind) {
      case "gust": {
        const g = gustOf(s.group, t, f);
        // The knot's gust, and a pull back toward the knot when a spark strays.
        const px = (g.cx - s.x) * 0.25, py = (g.cy - s.y) * 0.25;
        tx = g.vx + px + 6 * Math.sin(t * 1.7 + s.phase);
        ty = g.vy + py + 6 * Math.cos(t * 1.3 + s.phase);
        lag = 4;
        break;
      }
      case "drift": {
        s.heading += (0.8 * Math.sin(t * 0.6 + s.phase) + 0.5 * Math.sin(t * 0.17 + s.phase * 2)) * dt;
        const v = 9 + 11 * s.warm;
        tx = Math.cos(s.heading) * v;
        ty = Math.sin(s.heading) * v;
        lag = 1.5;
        break;
      }
      case "fall": {
        tx = 14 * Math.sin(t * 1.3 + s.phase);
        ty = 24 + 12 * s.warm;
        lag = 2;
        break;
      }
      case "rise": {
        const p = s.age / s.life;
        tx = 8 * Math.sin(t * 2.3 + s.phase);
        ty = -(30 + 70 * p);
        lag = 3;
        break;
      }
      case "dart": {
        // Waiting, then its moment; then a kick, and the kick dies away.
        if (t >= s.next) {
          const a = Math.random() * TAU;
          const v = 150 + Math.random() * 80;
          s.vx = Math.cos(a) * v;
          s.vy = Math.sin(a) * v;
          s.next = t + 1.2 + Math.random() * 3;
        }
        s.vx *= Math.exp(-5.5 * dt);
        s.vy *= Math.exp(-5.5 * dt);
        /* It used to sit at a dead stop between kicks, which read as the
           ground freezing rather than as an ember waiting. It idles now: a
           slow wander on its own heading that the kick swamps and then
           decays back into. Nothing on this ground is ever completely
           still. */
        s.heading += 0.5 * Math.sin(t * 0.4 + s.phase) * dt;
        s.vx += (Math.cos(s.heading) * DART_IDLE - s.vx) * Math.min(1, dt * 0.9);
        s.vy += (Math.sin(s.heading) * DART_IDLE - s.vy) * Math.min(1, dt * 0.9);
        lag = 0;
        break;
      }
    }
    if (lag) {
      const k = Math.min(1, dt * lag);
      s.vx += (tx - s.vx) * k;
      s.vy += (ty - s.vy) * k;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.age += dt;
    // Relit and drawn in the same frame. Skipping it left a hole for a
    // frame, and with a small cast that reads as a spark blinking out.
    if (s.age > s.life || gone(f, s)) lightSpark(f, t, s);
    const flicker = s.kind === "rise" ? 0.75 + 0.25 * Math.sin(t * 9 + s.phase) : 1;
    const fade = Math.min(1, s.age / 0.5, (s.life - s.age) / 0.7) * flicker;
    const speed = Math.hypot(s.vx, s.vy);
    const tail = Math.min(7, speed * 0.05);
    const ux = speed ? s.vx / speed : 0;
    const uy = speed ? s.vy / speed : 0;
    const tone = s.green ? GREEN_INK : s.warm > 0.7 ? "255,138,68" : s.warm > 0.35 ? "240,78,58" : "212,40,60";
    if (tail > 1) {
      c.strokeStyle = `rgba(${tone},${(0.5 * fade).toFixed(2)})`;
      c.lineWidth = s.size * 1.3;
      c.beginPath();
      c.moveTo(s.x - ux * tail, s.y - uy * tail);
      c.lineTo(s.x, s.y);
      c.stroke();
    }
    c.fillStyle = `rgba(${tone},${(0.82 * fade).toFixed(2)})`;
    c.beginPath();
    c.arc(s.x, s.y, s.size, 0, TAU);
    c.fill();
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* The cloud layers                                                    */
/* ------------------------------------------------------------------ */

/**
 * One depth's worth of cloud: which tile, how big, which way round, where it
 * goes and how strongly it reads.
 *
 * Written down as a table rather than as four lines of paint because there
 * are now two readers of it. `paintDarkMatter` draws all four onto one
 * surface, turning as it goes, which is what a disc drawn every frame wants.
 * The ground (`ground.ts`) gives each layer a canvas of its own and moves it
 * with a transform, which means the layer can only *translate* — so it uses
 * `turn` and ignores `spin`. Nobody can see 0.8 degrees a second on a cloud;
 * everybody can see a cloud redrawn twice a second.
 */
export interface CloudLayer {
  id: string;
  tile: "violet" | "magenta";
  /** Drawn this many times its tile's own size. */
  scale: number;
  /** Turned this many degrees about the middle, at the start. */
  turn: number;
  /** And this many more degrees every second — only where the whole surface is repainted. */
  spin: number;
  /** Where it goes, in tile pixels a second, before the turn and the scale. */
  dx: number;
  dy: number;
  alpha: number;
}

export const CLOUD_LAYERS: CloudLayer[] = [
  // The far depth: the planet. Huge, slow, turning once in about half an hour.
  { id: "far-violet", tile: "violet", scale: 2.8, turn: 0, spin: 0.2, dx: 0.5, dy: -0.25, alpha: 0.9 },
  { id: "far-magenta", tile: "magenta", scale: 2.3, turn: 70, spin: -0.15, dx: -0.35, dy: 0.4, alpha: 0.7 },
  // The near depth: cloud you can see pass, across in half a minute or so.
  { id: "near-violet", tile: "violet", scale: 0.95, turn: 30, spin: -0.8, dx: 7.5, dy: -2.5, alpha: 0.55 },
  { id: "near-magenta", tile: "magenta", scale: 0.75, turn: 150, spin: 0.6, dx: 5.5, dy: 3.5, alpha: 0.45 },
];

/**
 * Where a layer has travelled by second `t`, in screen pixels.
 *
 * Its own `dx, dy` are tile pixels applied *after* the turn and the scale,
 * so the direction you see is the drawn direction turned by whatever the
 * turn is at that moment, and the distance is it scaled. The turn is itself
 * moving, which is why this takes a time rather than being a constant.
 */
export function cloudTravel(l: CloudLayer, t: number): { x: number; y: number } {
  const a = ((l.turn + l.spin * t) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = l.dx * t;
  const dy = l.dy * t;
  return { x: l.scale * (dx * cos - dy * sin), y: l.scale * (dx * sin + dy * cos) };
}

/**
 * The nebula, generated once at the size it is actually shown.
 *
 * **Why it is not a small tile any more.** It was: two 256px noise tiles,
 * coloured, then screened together at scales 3, 2, 1 and 0.75. That is four
 * periods of 768, 512, 256 and 192 pixels, and a 192px period repeats
 * thirteen times across a 2560 screen. Enlarging the *composite* cannot fix
 * it, because the sub-patterns inside keep their own periods — which is why
 * the field read as repeating squares and repeating circles whatever the
 * outer tile was sized at. The circles are what value noise looks like when
 * you can see its lattice: a puff at every cell, on a grid.
 *
 * The straight lines were a second fault with the same cure. Filling with a
 * `createPattern` that carries a `setTransform` scale makes the browser
 * filter across the tile's edge, and at the edge it samples *clamped* pixels
 * rather than wrapping ones — a hard seam every period, in a straight line.
 * Nothing here scales a pattern now; the field is drawn one to one.
 *
 * So the field is generated at the size it is shown, with the octaves being
 * the depth rather than four scaled copies of one tile, and the rule its
 * width has to satisfy is: **at least the box's extent along the direction of
 * travel, and comfortably more.** `FIELD_ROOM` is the comfortably.
 *
 * **The look is matched, not re-invented.** The octaves are named by the size
 * of their features in pixels rather than by a cell count, so a wide box and
 * a tall one get the same clouds rather than clouds stretched to their shape,
 * and the two colours keep the relationship the old tile had: violet through
 * the body of the cloud, magenta only where it is thickest, screened. The
 * numbers below were fitted against a render of the tile they replace, on
 * mean, spread, the three channel means, and how much detail sits at 4, 8,
 * 16, 32, 64 and 128 pixels — eleven measures, not an opinion. The fit is
 * 5%; the gammas came out at the values that were already authored, so only
 * the size of a puff and the two strengths actually moved.
 *
 * **What it costs**, measured, because it is the real trade.
 *
 * *Memory.* On a 2332×1079 board the field is 3072×1152 (13.5MB) and the
 * layer canvas it fills is 5404×1079 (22.2MB): 35.7MB, against 25.4MB for
 * the 1536px tile it replaces and about 90MB for the four-layer ground
 * before that. So ten megabytes more than the immediate predecessor, and
 * fifty-four less than the thing everyone actually complained about. On a
 * 1054×556 board it is 9.2MB.
 *
 * *Time.* Generating one is a long task of about 280ms — against 53ms for a
 * small tile — and that is why `fieldPeriod` and `fieldHeight` step in 256
 * and 128 and the last two fields are kept. Dragging a pane across 260px of
 * width crosses one step: twelve of thirteen sizes on the way are free, one
 * generates. It is never on a frame; nothing here runs per frame at all.
 *
 * Two things bought most of that time back and neither costs anything you
 * can see: the noise is made at half size and read bilinearly (`COARSE`),
 * and the curve from a noise value to an alpha is a lookup rather than a
 * `Math.pow` per pixel (`CURVE`). Together, 790ms to 280.
 */

/** The field's width steps in this, so a resize drag does not re-generate every pixel. */
const FIELD_STEP = 256;

/** And its height in this. The extra below the box is simply clipped. */
const FIELD_ROW = 128;

/**
 * How much wider than the box the field must be before it may repeat.
 *
 * At one, the same cloud would touch both edges of the screen at once. A
 * quarter more is the margin that stops that being a near miss, and it costs
 * a quarter of a screen of canvas.
 */
const FIELD_ROOM = 1.25;

/** The width the field wraps on, for a box this wide. */
export function fieldPeriod(w: number): number {
  return Math.max(1024, Math.ceil((w * FIELD_ROOM) / FIELD_STEP) * FIELD_STEP);
}

/** The height the field is generated at, for a box this tall. */
export function fieldHeight(h: number): number {
  return Math.max(512, Math.ceil(h / FIELD_ROW) * FIELD_ROW);
}

/**
 * Value noise wrapping on `w × h`, in octaves named by the size of their
 * features in pixels.
 *
 * Naming octaves by feature size rather than by a cell count is what keeps
 * the clouds the same size whatever shape the box is: a count divides the
 * width and the height by the same number, so on a 2816×1079 field the cells
 * come out two and a half times wider than they are tall and the whole sky
 * is smeared sideways. Rounding a size to a whole number of cells per axis
 * keeps them square and still wraps.
 */
function nebulaNoise(w: number, h: number, seed: number, feature: number, oct: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let o = 0, amp = 0.5; o < oct; o++, amp *= 0.5) {
    const f = feature / (1 << o);
    const cx = Math.max(2, Math.round(w / f));
    const cy = Math.max(2, Math.round(h / f));
    /* The lattice once, then read: the hash is a `sin`, and calling it four
       times per pixel per octave was most of the generation. */
    const lat = new Float32Array(cx * cy);
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        const v = Math.sin(i * 127.1 + j * 311.7 + (seed + o * 13) * 74.7) * 43758.5453;
        lat[j * cx + i] = v - Math.floor(v);
      }
    }
    const sw = w / cx, sh = h / cy;
    for (let y = 0; y < h; y++) {
      const v = y / sh, j0 = Math.floor(v), fy = v - j0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (j0 % cy) * cx, r1 = ((j0 + 1) % cy) * cx;
      for (let x = 0; x < w; x++) {
        const u = x / sw, i0 = Math.floor(u), fx = u - i0;
        const sx = fx * fx * (3 - 2 * fx);
        const c0 = i0 % cx, c1 = (i0 + 1) % cx;
        const a = lat[r0 + c0]!, b = lat[r0 + c1]!, c = lat[r1 + c0]!, d = lat[r1 + c1]!;
        out[y * w + x]! += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
  }
  return out;
}

/**
 * The two clouds, and how they are cut out of their noise.
 *
 * `feature` is the size of the largest puff in pixels; each octave halves it,
 * so six octaves reach a couple of pixels and the cloud has detail all the
 * way down. `from`/`to` is the slice of the noise the colour occupies and
 * `gamma` how hard the edge of that slice is; `alpha` is how much of it
 * survives. Violet takes the body of the cloud, magenta only the thick of it.
 */
const CLOUDS = [
  { rgb: [112, 50, 204], seed: 3, feature: 120, from: 0.3, to: 0.78, gamma: 1.35, alpha: 0.74 },
  { rgb: [176, 58, 198], seed: 11, feature: 80, from: 0.42, to: 0.84, gamma: 1.6, alpha: 0.6 },
] as const;

/** How many octaves deep, i.e. down to `feature / 32`. */
const OCTAVES = 6;

/**
 * The noise is generated at half the field's size and read bilinearly.
 *
 * It costs nothing that can be measured — the fit against the tile this
 * replaces is 5.0% either way, across all eleven measures — and it is the
 * difference between 330ms of noise and 87ms, because a cloud has no detail
 * at the pixel level to lose.
 */
const COARSE = 2;

/** How finely the noise-to-alpha curve is sampled before it is looked up. */
const CURVE = 1024;

/**
 * Two of them, at the two sizes the app asks for: the workspace's, and
 * whichever disc is open. A third would be a resize in flight, and the older
 * of the two is the one that goes.
 */
const fields = new Map<string, HTMLCanvasElement>();
const FIELDS_KEPT = 2;

/**
 * The whole nebula at `pw × ph`, wrapping on both.
 *
 * Kept between calls because a resize drag asks for one every frame, and
 * generating it is a third of a second. `fieldPeriod` and `fieldHeight` step
 * in 256 and 128, so a drag crosses a boundary rarely and hits this the rest
 * of the time.
 */
export function nebulaField(pw: number, ph: number): HTMLCanvasElement {
  const key = `${pw}x${ph}`;
  const had = fields.get(key);
  if (had) return had;

  const el = document.createElement("canvas");
  el.width = pw;
  el.height = ph;
  const c = el.getContext("2d");
  if (!c) return el;

  const nw = Math.max(64, Math.round(pw / COARSE));
  const nh = Math.max(64, Math.round(ph / COARSE));
  const [V, M] = CLOUDS;
  const nv = nebulaNoise(nw, nh, V.seed, V.feature / COARSE, OCTAVES);
  const nm = nebulaNoise(nw, nh, M.seed, M.feature / COARSE, OCTAVES);

  /* The curve from a noise value to an alpha is one dimensional, so it is
     sampled a thousand times here rather than raised to a power three million
     times below. That one change took the colouring pass from 460ms to 90. */
  const curve = (cl: (typeof CLOUDS)[number]) => {
    const t = new Float32Array(CURVE + 1);
    for (let i = 0; i <= CURVE; i++) {
      const n = i / CURVE;
      t[i] = Math.pow(Math.max(0, Math.min(1, (n - cl.from) / (cl.to - cl.from))), cl.gamma) * cl.alpha;
    }
    return t;
  };
  const lv = curve(V), lm = curve(M);
  const [v0, v1, v2] = V.rgb;
  const [m0, m1, m2] = M.rgb;

  const img = c.createImageData(pw, ph);
  const px = img.data;
  const sx = nw / pw, sy = nh / ph;
  for (let y = 0, p = 0; y < ph; y++) {
    const v = y * sy, y0 = v | 0, fy = v - y0;
    const r0 = (y0 % nh) * nw, r1 = ((y0 + 1) % nh) * nw;
    for (let x = 0; x < pw; x++, p += 4) {
      const u = x * sx, x0 = u | 0, fx = u - x0;
      const c0 = x0 % nw, c1 = (x0 + 1) % nw;
      const a00 = nv[r0 + c0]!, a10 = nv[r0 + c1]!, a01 = nv[r1 + c0]!, a11 = nv[r1 + c1]!;
      const b00 = nm[r0 + c0]!, b10 = nm[r0 + c1]!, b01 = nm[r1 + c0]!, b11 = nm[r1 + c1]!;
      const av = lv[(((a00 + (a10 - a00) * fx) * (1 - fy) + (a01 + (a11 - a01) * fx) * fy) * CURVE) | 0]!;
      const am = lm[(((b00 + (b10 - b00) * fx) * (1 - fy) + (b01 + (b11 - b01) * fx) * fy) * CURVE) | 0]!;
      const ao = am + av * (1 - am);
      if (ao <= 0) continue;
      /* Magenta screened over violet, in colour scaled 0..255 because screen
         is linear in one term and the other is divided back out — the same
         operation the old tile did once at build time, so the two clouds
         bloom where they cross instead of one hiding the other. */
      const k = am * (1 - av), q = am * av, z = (1 - am) * av;
      px[p] = ((k * m0 + q * (v0 + m0 - (v0 * m0) / 255) + z * v0) / ao + 0.5) | 0;
      px[p + 1] = ((k * m1 + q * (v1 + m1 - (v1 * m1) / 255) + z * v1) / ao + 0.5) | 0;
      px[p + 2] = ((k * m2 + q * (v2 + m2 - (v2 * m2) / 255) + z * v2) / ao + 0.5) | 0;
      px[p + 3] = (ao * 255 + 0.5) | 0;
    }
  }
  c.putImageData(img, 0, 0);

  fields.set(key, el);
  for (const k of fields.keys()) {
    if (fields.size <= FIELDS_KEPT) break;
    fields.delete(k);
  }
  return el;
}

export function cloudStep(l: CloudLayer): { x: number; y: number; len: number } {
  const a = (l.turn * Math.PI) / 180;
  const len = TILE * l.scale;
  return { x: Math.cos(a) * len, y: Math.sin(a) * len, len };
}

export function cloudSpeed(l: CloudLayer): number {
  const { vx, vy } = cloudDrift(l);
  return Math.hypot(vx, vy);
}

/**
 * Where a layer actually goes, in screen pixels a second.
 *
 * Its own `dx, dy` are in tile pixels and are applied *after* the turn and
 * the scale, so the direction you see is the drawn direction turned and the
 * distance is it scaled. The near violet works out at about 7.5px a second
 * and the far magenta at 1.2, which is the whole of the parallax.
 */
export function cloudDrift(l: CloudLayer): { vx: number; vy: number } {
  const a = (l.turn * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { vx: l.scale * (l.dx * cos - l.dy * sin), vy: l.scale * (l.dx * sin + l.dy * cos) };
}

/**
 * One cloud layer, alone on a transparent canvas, laid exactly as
 * `paintDarkMatter` lays it: the same tile, the same scale, turned `turn`
 * degrees about the middle and shifted `dx, dy` tile pixels.
 *
 * This is the whole of what a recycle does. Between recycles the layer is
 * turned and moved by the compositor, which is why the turn and the shift
 * are arguments rather than being worked out from a clock in here.
 */
export function paintCloudLayer(
  c: CanvasRenderingContext2D,
  layer: CloudLayer,
  opts: {
    w: number; h: number; dim?: number; turn: number; dx: number; dy: number;
    /**
     * How strongly to bake the layer in, 0..1. Defaults to the layer's own
     * weight times the distance, which is what a single-canvas render needs.
     *
     * A layer on its own element passes 1 and carries the weight as CSS
     * `opacity` instead. The composite is identical — for a `screen` layer,
     * scaling the source's alpha and scaling the element's opacity land in
     * the same place — but the bitmap is then the real picture at full
     * strength rather than a picture at 16% that looks broken to anyone who
     * reads it back. Which is exactly what happened: a probe of the bitmap
     * showed a maximum alpha of 42 and was reasonably taken for a fault.
     */
    alpha?: number;
  },
) {
  const { w, h } = opts;
  const dim = opts.dim ?? 1;
  const T = darkMatterTiles();
  const p = c.createPattern(layer.tile === "violet" ? T.violet : T.magenta, "repeat");
  if (!p) return;
  p.setTransform(new DOMMatrix().translate(w / 2, h / 2).rotate(opts.turn).scale(layer.scale).translate(opts.dx, opts.dy));
  c.globalAlpha = opts.alpha ?? layer.alpha * dim;
  c.fillStyle = p;
  /* `copy` rather than a `clearRect` and then a blend. Same pixels, but the
     canvas is never in a cleared state: a clear followed by a fill is two
     operations with an empty canvas between them, and an empty canvas is a
     black hole in the ground if anything at all gets between the two — a
     deferred raster, a compositor commit landing early. One operation
     cannot be interrupted halfway. */
  const was = c.globalCompositeOperation;
  c.globalCompositeOperation = "copy";
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = was;
  c.globalAlpha = 1;
}

/**
 * The ground under the clouds, as one CSS gradient.
 *
 * `farthest-corner` from the middle is exactly the radius the canvas version
 * used — half the diagonal — so this is the same gradient, drawn by the
 * compositor instead of by us. It is the half of the weather that never
 * moves, so it should not be on a canvas that does.
 */
export function skyGradient(dim = 1): string {
  const mix = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const to = [6, 3, 10];
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(to[i]! + (v - to[i]!) * dim));
    return `rgb(${rgb.join(",")})`;
  };
  return `radial-gradient(circle farthest-corner at 50% 50%, ${mix("#180a2c")} 0%, ${mix("#0c0616")} 60%, #06030a 100%)`;
}

/* ------------------------------------------------------------------ */
/* The paint                                                           */
/* ------------------------------------------------------------------ */

export interface PaintOptions {
  field: SparkField;
  /**
   * Which half to draw.
   *
   * The clouds are two full-surface pattern fills, rotated and screened —
   * the expensive half, and the half that barely changes: the near cloud
   * crosses in half a minute and the far one turns once in half an hour. The
   * embers are a few dozen one-pixel streaks, and they are what has to be
   * drawn thirty times a second. Painting them onto separate canvases means
   * the cheap half can run at thirty and the dear half at two, instead of
   * both at thirty. "all" is the old behaviour, and is what a surface that
   * is drawn once (a screenshot, the reduced-motion still) wants.
   */
  layers?: "all" | "clouds" | "sparks";
  /** Seconds since this surface was born. */
  t: number;
  /** The disc's edge falls off to near black; a wall's corners only darken. */
  vignette?: boolean;
  /**
   * How far away the weather is, 0..1. One is the disc.
   *
   * The same cloud that is the whole point of a two-hundred-pixel hole is a
   * lightbox across a whole screen — five times the area of it in view at
   * once, and none of the disc's horizon to close it off. The workspace is
   * the same sky seen from further back: the ground darker, the clouds
   * fainter, the embers untouched, because an ember that dims to nothing is
   * not an ember.
   */
  dim?: number;
}

export function paintDarkMatter(c: CanvasRenderingContext2D, opts: PaintOptions) {
  const { field: f, t } = opts;
  const dim = opts.dim ?? 1;
  const w = f.w;
  const h = f.h;
  const disc = f.shape === "disc";
  const r = Math.min(w, h) / 2;
  const T = darkMatterTiles();
  const layers = opts.layers ?? "all";
  const clouds = layers !== "sparks";
  const sparks = layers !== "clouds";
  c.clearRect(0, 0, w, h);
  c.save();
  if (disc) {
    c.beginPath();
    c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    c.clip();
  }

  // The ground: black, a breath of violet toward the middle.
  const reach = disc ? r : Math.hypot(w, h) / 2;
  if (clouds) {
  const ground = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, reach);
  const mix = (hex: string) => {
    // Toward the void's own near-black as the weather recedes.
    const n = parseInt(hex.slice(1), 16);
    const to = [6, 3, 10];
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(to[i]! + (v - to[i]!) * dim));
    return `rgb(${rgb.join(",")})`;
  };
  ground.addColorStop(0, mix("#180a2c"));
  ground.addColorStop(0.6, mix("#0c0616"));
  ground.addColorStop(1, "#06030a");
  c.fillStyle = ground;
  c.fillRect(0, 0, w, h);

  // A pattern laid over the surface: drawn `scale` times its tile, shifted by
  // (dx, dy) tile-pixels and turned `turn` degrees about the middle,
  // screened so the clouds bloom where they cross.
  const lay = (tile: HTMLCanvasElement, scale: number, dx: number, dy: number, turn: number, alpha: number) => {
    const p = c.createPattern(tile, "repeat");
    if (!p) return;
    const m = new DOMMatrix().translate(w / 2, h / 2).rotate(turn).scale(scale).translate(dx, dy);
    p.setTransform(m);
    c.globalAlpha = alpha * dim;
    c.globalCompositeOperation = "screen";
    c.fillStyle = p;
    c.fillRect(0, 0, w, h);
  };
  // Both depths, off the one table, turning as they go: this is the surface
  // that is repainted whole, so it can afford the spin.
  for (const l of CLOUD_LAYERS) lay(l.tile === "violet" ? T.violet : T.magenta, l.scale, l.dx * t, l.dy * t, l.turn + l.spin * t, l.alpha);
  c.globalAlpha = 1;
  c.globalCompositeOperation = "source-over";
  }

  // The embers, blown through the near cloud.
  if (sparks) paintEmbers(c, f, t);

  if (clouds && (opts.vignette ?? disc)) {
    // The horizon: the edge falls off to near black.
    const edge = c.createRadialGradient(w / 2, h / 2, reach * 0.78, w / 2, h / 2, reach);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(0.7, "rgba(4,2,8,0.5)");
    edge.addColorStop(1, "rgba(3,1,6,0.9)");
    c.fillStyle = edge;
    c.fillRect(0, 0, w, h);
  }
  c.restore();
}

/** How often the ground moves: thirty times a second, enough for an ember to streak rather than hop. */
export const DRIFT_MS = 33;
