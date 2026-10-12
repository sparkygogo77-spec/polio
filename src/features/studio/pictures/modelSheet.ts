/**
 * MODEL SHEET (ALL SIDES).
 *
 * J (2026-10-12): "make a format check mark that automatically generates
 * these faces like i had it do for this ring ... it didnt understand me 100%
 * so whatever you need so it generates the most useful image it can when i
 * need it like this for a model image from gpt image 2". His example was a
 * labelled sheet of one ring from ten sides, where the top and bottom came
 * out the same picture and left and right could not be told apart.
 *
 * So the ask fixes what that sheet left open: one object, a fixed 3 by 3
 * grid in a fixed order, every view defined by where the camera is and where
 * the front ends up, the bottom told to be the underside and never the top
 * again, and nothing on the sheet but the views and their names.
 *
 * Because the grid is fixed, the sheet can be cut back into its views
 * (`splitSheet`) and the front, back, left and right handed to the
 * multi-view 3D step, instead of guessing those sides from one front.
 */

/** The nine views, in reading order, as the sheet is asked to lay them out. */
export const SHEET_VIEWS = [
  "FRONT", "BACK", "TOP",
  "LEFT", "RIGHT", "BOTTOM",
  "FRONT LEFT", "FRONT RIGHT", "BACK RIGHT",
] as const;
export type SheetView = (typeof SHEET_VIEWS)[number];
export const SHEET_COLS = 3;
export const SHEET_ROWS = 3;

/** Added after what he typed when "Model sheet (all sides)" is ticked. */
export const SHEET_ASK = [
  "Make this a model reference sheet (an orthographic turnaround) of exactly ONE object: the subject described above. It is for building a 3D model, so accuracy and consistency matter more than style.",
  "LAYOUT: a square picture split into an even 3 by 3 grid of equal cells, no borders or lines between them. Each cell holds one view of the same object, centred, whole, never cropped, at the same scale in every cell, with a small plain label in capitals centred above the object in that cell. Cells in this order, left to right, top to bottom:",
  "1 FRONT: camera straight in front, at the object's middle height, flat-on, no perspective tilt.",
  "2 BACK: camera straight behind. Show what the back really looks like; it is not a mirror of the front unless the object truly is symmetric.",
  "3 TOP: camera straight above looking down, the front facing the bottom edge of the cell.",
  "4 LEFT: the side that is on the left in the FRONT view, seen flat-on from that side, so the front points to the right edge of the cell.",
  "5 RIGHT: the side that is on the right in the FRONT view, seen flat-on from that side, so the front points to the left edge of the cell. LEFT and RIGHT must show which way the front points.",
  "6 BOTTOM: camera straight below looking up at the underside, the front facing the bottom edge of the cell. It shows the underside, never the top again: it must look different from TOP (the base, the inside of a band, the soles, the mounting) unless the object is truly the same both ways.",
  "7 FRONT LEFT: a three-quarter view from the front-left, slightly above.",
  "8 FRONT RIGHT: a three-quarter view from the front-right, slightly above.",
  "9 BACK RIGHT: a three-quarter view from the back-right, slightly above.",
  "CONSISTENCY: the identical object in all nine views: same design, proportions, colours, materials, details and art style. Every view agrees with every other one, as if photographed from a turntable.",
  "LOOK: even, soft, shadowless studio light from the front, no cast shadows, no reflections of a room, no glow. One plain flat background colour behind every view, the same in every cell, that contrasts clearly with the object: light grey, or dark grey when the object itself is light.",
  "NOTHING ELSE: no title, no border, no grid lines, no arrows, no measurements, no colour swatches, no hands, no stand, no extra objects, no text but the nine labels.",
].join("\n");

/** The views the multi-view 3D step takes, in the order it takes them. */
const FOR_SOLID: readonly SheetView[] = ["FRONT", "BACK", "LEFT", "RIGHT"];

/**
 * The tallest band of rows that holds something, in one cell's mask.
 *
 * A cell is a small label above the object, with background between them,
 * so the rows that hold anything fall into runs: the label's thin one and
 * the object's big one. The run holding the most is the object; a gap of a
 * row or two inside it (a thin bridge, an anti-aliased edge) does not split it.
 */
export function objectRows(ink: readonly number[], gap = 2): [number, number] | null {
  let best: [number, number, number] | null = null;
  let start = -1, end = -1, sum = 0, empty = 0;
  const close = () => { if (start >= 0 && (!best || sum > best[2])) best = [start, end, sum]; start = -1; sum = 0; empty = 0; };
  for (let y = 0; y < ink.length; y++) {
    if (ink[y]! > 0) {
      if (start < 0) start = y;
      end = y; sum += ink[y]!; empty = 0;
    } else if (start >= 0 && ++empty > gap) close();
  }
  close();
  const b = best as [number, number, number] | null;
  return b ? [b[0], b[1]] : null;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => no(new Error("The sheet could not be read."));
    img.src = src;
  });
}

/**
 * The sheet cut back into its views, each on its own plain square, keyed by
 * name. A cell with nothing found in it is left out, so a sheet the model
 * laid out wrong gives fewer views rather than wrong ones.
 */
export async function splitSheet(src: string): Promise<Partial<Record<SheetView, string>>> {
  const img = await load(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return {};
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H).data;
  const at = (x: number, y: number) => (y * W + x) * 4;
  // The ground is what the four corners agree on.
  const corners = [at(1, 1), at(W - 2, 1), at(1, H - 2), at(W - 2, H - 2)];
  const bg = [0, 1, 2].map((k) => corners.reduce((s, i) => s + px[i + k]!, 0) / 4);
  const isInk = (i: number) => px[i + 3]! > 24 && Math.abs(px[i]! - bg[0]!) + Math.abs(px[i + 1]! - bg[1]!) + Math.abs(px[i + 2]! - bg[2]!) > 60;
  const out: Partial<Record<SheetView, string>> = {};
  const cw = W / SHEET_COLS, ch = H / SHEET_ROWS;
  SHEET_VIEWS.forEach((name, n) => {
    // A small margin in from each cell's edge keeps a neighbour's overhang out.
    const m = Math.round(Math.min(cw, ch) * 0.02);
    const x0 = Math.round((n % SHEET_COLS) * cw) + m, y0 = Math.round(Math.floor(n / SHEET_COLS) * ch) + m;
    const x1 = Math.round((n % SHEET_COLS + 1) * cw) - m, y1 = Math.round((Math.floor(n / SHEET_COLS) + 1) * ch) - m;
    const rows: number[] = [];
    for (let y = y0; y < y1; y++) { let k = 0; for (let x = x0; x < x1; x++) if (isInk(at(x, y))) k++; rows.push(k); }
    const band = objectRows(rows);
    if (!band) return;
    const top = y0 + band[0], bottom = y0 + band[1];
    let left = x1, right = x0;
    for (let y = top; y <= bottom; y++) for (let x = x0; x < x1; x++) if (isInk(at(x, y))) { if (x < left) left = x; if (x > right) right = x; }
    const w = right - left + 1, h = bottom - top + 1;
    if (w < 8 || h < 8) return;
    const side = Math.round(Math.max(w, h) * 1.12);
    const v = document.createElement("canvas");
    v.width = side; v.height = side;
    const vg = v.getContext("2d");
    if (!vg) return;
    vg.fillStyle = "#ffffff";
    vg.fillRect(0, 0, side, side);
    vg.drawImage(c, left, top, w, h, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);
    out[name] = v.toDataURL("image/png");
  });
  return out;
}

/**
 * The front and the three views the 3D step takes as its others, from a
 * sheet. Null when the sheet has no front, or fewer than two of the others:
 * then it is not a sheet the 3D step can trust, and the caller falls back.
 */
export async function sheetForSolid(src: string): Promise<{ front: string; also: string[] } | null> {
  const views = await splitSheet(src).catch(() => ({} as Partial<Record<SheetView, string>>));
  const front = views.FRONT;
  const also = FOR_SOLID.slice(1).map((v) => views[v]).filter((v): v is string => !!v);
  return front && also.length >= 2 ? { front, also } : null;
}
