/**
 * A LAYER PLACED IN THE WINDOW'S UNITS STAYS PLACED IN THEM.
 *
 * THE OWNER'S REPORT, his published trumpmorty.fun beside the original: on
 * the site the hero's sky, both deserts, the big planet and the ringed planet
 * are placed in the window's units and in shares of the hero (the planet
 * `left: -16vw; top: -22vw; width: min(62vw, 860px)`, the far desert `left:
 * -5%; right: -5%; bottom: 13%; height: 36%`, the hero `min-height: 100svh`),
 * so at any window or browser zoom they keep their place while the content
 * scales. The export placed them in the px measured at 1440 × 900, and at
 * another size the planet was a huge disk cut by a straight edge and the
 * ringed planet stood on the TV's corner.
 *
 * Sink now records them (`node.units`, from 2521ca7): each placement as
 * written, where it is relative, and the block it is taken of (`units.of`:
 * the window, or the positioned ancestor by its part and its box). The
 * export stands every part on the page's frame rather than inside its
 * block, so a share of the block is re-said against the block's box as it
 * stands there: its left and width as the fluid page has them
 * (`fluidSite.ts`), its top and height as the hero's `100svh` rule has them.
 * A window unit (`vw`, `svh`) means the same on the frame and stays as it
 * is. What is placed in px keeps the px it was measured at.
 *
 * Only for a block that grows with the window (the hero, a band the page's
 * width) or the window itself: in a block of a fixed size a share is the px
 * already measured. `tests/layer-units.mjs`.
 */

export interface Units {
  left?: string; top?: string; right?: string; bottom?: string;
  width?: string; height?: string;
  backgroundSize?: string; backgroundPosition?: string;
  of?: { by?: string; part?: string | null; box?: number[] } | null;
}

/** The block's box on the frame, each side as CSS. */
export interface BlockBox { left: string; top: string; width: string; height: string }

export interface LayerStyle {
  left?: string; top?: string; width?: string; height?: string;
  backgroundSize?: string; backgroundPosition?: string;
}

/** An expression, inside a calc() if it is not one already. */
const bare = (v: string) => v.replace(/^calc(?=\()/, "");
const calc = (...terms: string[]) => `calc(${terms.join(" ")})`;

/** A written length against a reference: each `n%` becomes that share of it; anything else (px, vw, svh, min()) stands. */
export function against(v: string, ref: string): string {
  if (!/%/.test(v)) return v;
  const out = v.replace(/(-?\d*\.?\d+)%/g, (_m, n: string) => `(${bare(ref)} * ${+(Number(n) / 100).toFixed(6)})`);
  return /^(?:calc|min|max|clamp)\(/.test(out) ? out : `calc(${out})`;
}

/**
 * One axis: where it starts and how long it is, from what was written.
 * `near`/`far` are left/right or top/bottom, `size` width or height, `own`
 * the size measured (px) for when none is written or can be worked out.
 */
function axis(near: string | undefined, far: string | undefined, size: string | undefined, start: string, span: string, own: string, off: number | null = null): { at: string | null; size: string | null } {
  const len = size ? against(size, span) : near && far ? calc(bare(span), "-", bare(against(near, span)), "-", bare(against(far, span))) : null;
  const l = len ?? own;
  if (near) return { at: calc(bare(start), "+", bare(against(near, span))), size: len };
  if (far) return { at: calc(bare(start), "+", bare(span), "-", bare(against(far, span)), "-", bare(l)), size: len };
  /*
   * Sized by its block with no inset written (parasiteonsol.fun's hero canvas,
   * `width: 100%`, 2px in from its frame): it keeps the offset it stood at in
   * the block, so its place and its size come from the same block
   * (`tests/picture-in-box.mjs`).
   */
  if (len && off !== null) return { at: calc(bare(start), "+", `${+off.toFixed(3)}px`), size: len };
  return { at: null, size: len };
}

/**
 * The box a layer's units are taken of: the inside of its block, as the
 * capture measured it (`units.of.box`: parasiteonsol.fun's frame is 1251 wide
 * with a 2px border, its canvas's `100%` is of the 1247 inside). The block's
 * place on the frame, less the insets it had at the capture on each side.
 */
export function innerBlock(block: BlockBox, part: { x: number; y: number; w: number; h: number }, box?: number[] | null): BlockBox {
  if (!box || box.length < 4) return block;
  const l = box[0]! - part.x, r = part.x + part.w - (box[0]! + box[2]!), t = box[1]! - part.y, b = part.y + part.h - (box[1]! + box[3]!);
  if (![l, r, t, b].every((v) => Number.isFinite(v) && v >= 0 && v < 200)) return block;
  const inset = (v: string, a: number, z = 0) => (a || z ? calc(bare(v), "+", `${a}px`) : v);
  const less = (v: string, a: number) => (a ? calc(bare(v), "-", `${a}px`) : v);
  return { left: inset(block.left, l), top: inset(block.top, t), width: less(block.width, l + r), height: less(block.height, t + b) };
}

/**
 * The style a part placed in units takes on the frame, or null when it has
 * nothing to say. `w`/`h` are its measured size, kept where no unit sets one;
 * a picture with no height of its own keeps its shape (`ratio`, h / w) as
 * its width changes, as an img with `height: auto` does.
 */
export function layerStyle(u: Units | null | undefined, block: BlockBox, w: number, h: number, ratio: number | null = null, off: { x: number; y: number } | null = null): LayerStyle | null {
  if (!u) return null;
  const x = axis(u.left, u.right, u.width, block.left, block.width, `${w}px`, off?.x ?? null);
  let height = u.height;
  if (!height && !(u.top && u.bottom) && x.size && ratio) height = calc(bare(x.size), "*", String(+ratio.toFixed(6)));
  const y = axis(u.top, u.bottom, height, block.top, block.height, `${h}px`, off?.y ?? null);
  const out: LayerStyle = {};
  if (x.at) out.left = x.at;
  if (x.size) out.width = x.size;
  if (y.at) out.top = y.at;
  if (y.size) out.height = y.size;
  if (u.backgroundSize) out.backgroundSize = u.backgroundSize;
  if (u.backgroundPosition) out.backgroundPosition = u.backgroundPosition;
  return Object.keys(out).length ? out : null;
}
