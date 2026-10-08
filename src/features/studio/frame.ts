/**
 * A FRAME FROM A PICTURE.
 *
 * J (2026-10-08): the light-construct boxes in the timeline were made from a
 * generated picture, and the only way to put one on a part was a code chat.
 * A picture of a box is a frame waiting to happen: its corners must stay as
 * drawn, and only its edges and middle may stretch. That is CSS
 * `border-image` (9-slice): four lines cut the picture into corners, edges
 * and a middle, and the browser stretches the edges to any size.
 *
 * So a frame is the picture, where the four lines sit (in % of the picture,
 * so a bigger copy of it keeps them), and how big its pixels draw. Every side
 * draws at the same scale, which is what keeps a corner its own shape: a
 * corner cut 90 by 60 out of the picture draws 45 by 30 at half size, never
 * 30 by 30.
 *
 * It goes out as tokens (`--frame-image`, `--frame-slice`, `--frame-width`,
 * `--frame-repeat`) read by the border-image slots, so a code chat or the
 * site's own CSS can retune it without the builder.
 *
 * Pure: no store, no browser. `tests/picture-frame.mjs` holds it.
 */

export type FrameRepeat = "stretch" | "round" | "repeat";

export interface PictureFrame {
  /** The picture, as a data URL. */
  src: string;
  /** Its own size in px, so the corners keep their shape. */
  size: { w: number; h: number };
  /** Where the four lines cut it, in % of its width or height: top, right, bottom, left. */
  slice: [number, number, number, number];
  /** How big its pixels draw: 0.5 is half size. */
  scale: number;
  /** The picture's middle fills the part too; off, the part's own colour shows there. */
  fill: boolean;
  /** How the edges reach: stretched, or repeated in whole pieces. */
  repeat: FrameRepeat;
}

/** The thickest side a new frame draws at, in px. */
export const NEW_FRAME_SIDE = 32;
/** A line may not pass the middle, or the two halves would cross. */
export const MAX_SLICE = 49;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** A frame for a picture just dropped in: lines a quarter of the way in, the thickest side 32px. */
export function newFrame(src: string, w: number, h: number): PictureFrame {
  const slice: PictureFrame["slice"] = [25, 25, 25, 25];
  const f: PictureFrame = { src, size: { w: Math.max(1, w), h: Math.max(1, h) }, slice, scale: 1, fill: false, repeat: "stretch" };
  const thickest = Math.max(...framePictureSides(f));
  return { ...f, scale: r1(clamp(NEW_FRAME_SIDE / Math.max(1, thickest), 0.05, 4) * 100) / 100 };
}

/** How deep each corner is cut, in the picture's own px: top, right, bottom, left. */
export function framePictureSides(f: Pick<PictureFrame, "size" | "slice">): [number, number, number, number] {
  const cut = (i: number) => clamp(f.slice[i] ?? 0, 0, MAX_SLICE) / 100;
  return [cut(0) * f.size.h, cut(1) * f.size.w, cut(2) * f.size.h, cut(3) * f.size.w];
}

/** How thick each side draws on the part, in px: the cut times the scale, the same for all four. */
export function frameSides(f: Pick<PictureFrame, "size" | "slice" | "scale">): [number, number, number, number] {
  const s = clamp(f.scale, 0.01, 8);
  return framePictureSides(f).map((v) => r1(v * s)) as [number, number, number, number];
}

/** A frame that can be drawn: a picture, a size, four numbers. Anything else is not a frame. */
export function isFrame(f: unknown): f is PictureFrame {
  const x = f as PictureFrame | null;
  return !!x && typeof x.src === "string" && !!x.src && !!x.size && x.size.w > 0 && x.size.h > 0
    && Array.isArray(x.slice) && x.slice.length === 4 && x.slice.every((v) => typeof v === "number") && typeof x.scale === "number";
}

/**
 * The frame as CSS declarations, by property: the tokens, then the slots
 * that read them. The border is see-through and as wide as the frame, so the
 * part's words sit inside it; with the middle left out, the part's own
 * colour stops at the frame's inner edge instead of showing round its glow.
 */
export function frameCss(f: PictureFrame): Record<string, string> {
  const sides = frameSides(f).map((v) => `${v}px`).join(" ");
  const slice = f.slice.map((v) => `${r1(clamp(v, 0, MAX_SLICE))}%`).join(" ") + (f.fill ? " fill" : "");
  const out: Record<string, string> = {
    "--frame-image": `url("${f.src.replace(/"/g, "%22")}")`,
    "--frame-slice": slice,
    "--frame-width": sides,
    "--frame-repeat": f.repeat,
    "border-style": "solid",
    "border-color": "transparent",
    "border-width": "var(--frame-width)",
    "border-image-source": "var(--frame-image)",
    "border-image-slice": "var(--frame-slice)",
    "border-image-width": "var(--frame-width)",
    "border-image-repeat": "var(--frame-repeat)",
  };
  if (!f.fill) out["background-clip"] = "padding-box";
  return out;
}

/** What a frame's slots are when it is taken off again. */
export const FRAME_UNSET: Record<string, string> = {
  "border-image-source": "none",
  "border-style": "none",
  "border-width": "0",
  "background-clip": "border-box",
};

/** The same, as a React style object, for the board and the published page. */
export function frameStyle(f: PictureFrame): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(frameCss(f))) out[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out;
}

/** In words, for the brief. */
export function describeFrame(f: PictureFrame): string {
  const [t, r, b, l] = frameSides(f);
  return `framed by a picture cut in nine (CSS border-image): its corners keep their shape and its edges ${f.repeat === "stretch" ? "stretch" : "repeat"} to any size; the frame draws ${t}px ${r}px ${b}px ${l}px thick${f.fill ? ", and the picture's middle fills the part" : ""}`;
}
