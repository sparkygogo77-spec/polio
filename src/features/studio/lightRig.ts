"use client";
/**
 * Moving the lamp without re-rendering the board.
 *
 * Dragging the sun used to write the light to the store on every pointermove
 * — twice, in fact, the carried ball and the lamp itself — and every one of
 * those writes re-rendered every part on the board, each part recomputing its
 * own shadow from the lamp's new position. Two React passes over a page of
 * parts per move event, at whatever rate the mouse reports, is the lag J
 * reported: the thing in your hand arrives late because the board is busy
 * being rebuilt behind it.
 *
 * Nothing about the shadow needs React. It is two CSS values per part, and
 * CSS values can be written straight onto the element:
 *
 *  · **One pass per frame.** Moves are recorded and coalesced; the pass runs
 *    in a `requestAnimationFrame` and never more than once in one.
 *  · **The geometry is cached.** Each part's centre, as a fraction of the
 *    page, is worked out once when the drag starts — it is the node's own
 *    x/y/w/h over the frame, not anything measured from the DOM — and the
 *    board's visible box with it.
 *  · **CSS variables, not props.** `liftTheme` writes its shadow and sheen as
 *    `var(--lift-shadow, …)`, with the committed value as the fallback, so a
 *    part reads the same thing whether or not a drag is on. The rig sets the
 *    variables; when it lets go it removes them and the fallback takes over.
 *  · **Off screen is skipped.** A part scrolled out of the board's box gets
 *    no work at all until it comes back.
 *
 * The store is written once, when the hand lets go.
 */
import { liftCss, type Light } from "./look";
import { useStudio } from "./board/store";
import { castsShadow, type CastNode } from "./lightCast";

/** One part, as the rig needs it: where to write, and where it stands. */
interface Surface {
  el: HTMLElement;
  /** Centre as a fraction of the page. */
  cx: number;
  cy: number;
  /** Its box on screen when the drag began, for the off-screen test. */
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Rig {
  page: { x: number; y: number; w: number; h: number };
  board: { x: number; y: number; w: number; h: number };
  surfaces: Surface[];
  /** The lamp as it was when the drag began, so only x and y move. */
  base: Light;
  at: { x: number; y: number } | null;
  frame: number;
  painted: number;
}

let rig: Rig | null = null;

const boxOf = (sel: string) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

/**
 * The two values a part's shadow is made of, for a lamp at (lx, ly) and a
 * part whose centre is at (cx, cy). The same arithmetic `liftTheme` does —
 * this is the one place it is done per frame rather than per render.
 */
/**
 * The two strings a part wears under the lamp. One formula, in `look.ts`:
 * this used to hold its own copy, and the copy drifted — the lit face was
 * fixed in the parts' version and stayed broken here, which is the board,
 * which is where anybody would have looked.
 */
export function liftVars(light: Light, cx: number, cy: number): { shadow: string; sheen: string } | null {
  return liftCss(light, cx, cy);
}

/** Take hold of the board: measure everything once, and nothing again. */
export function startLightRig(): boolean {
  const page = boxOf("[data-frame]");
  const board = boxOf("[data-studio-scroll]") ?? page;
  if (!page || !board) return false;
  const st = useStudio.getState();
  const w = st.frameWidth;
  /*
   * The lamp's own space is the page *window* — the screen of the site you
   * are pointing at — because that is what the placer measured its x and y
   * against. A part has to be put in the same space or the drag and the
   * render that follows it disagree, which showed up as every shadow
   * stepping a pixel or two the moment the hand let go.
   */
  const scale = page.w / Math.max(1, w);
  const h = page.h / Math.max(0.0001, scale);
  const surfaces: Surface[] = [];
  for (const n of st.nodes) {
    // Only what stands up under the lamp at rest is lit while it moves.
    if (!castsShadow(n as CastNode)) continue;
    const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(n.id)}"]`);
    if (!el) continue;
    surfaces.push({
      el,
      cx: (n.x + n.w / 2) / Math.max(1, w),
      cy: (n.y + n.h / 2) / Math.max(1, h),
      left: page.x + n.x * scale,
      top: page.y + n.y * scale,
      right: page.x + (n.x + n.w) * scale,
      bottom: page.y + (n.y + n.h) * scale,
    });
  }
  rig = { page, board, surfaces, base: st.look.light, at: null, frame: 0, painted: 0 };
  return true;
}

/** Point at a place. At most one pass per frame, however fast the hand is. */
export function aimLight(p: { x: number; y: number }) {
  if (!rig) return;
  rig.at = p;
  useStudio.getState().setLightCarry(p);
  if (rig.frame) return;
  rig.frame = requestAnimationFrame(pass);
}

function pass() {
  if (!rig) return;
  rig.frame = 0;
  const at = rig.at;
  if (!at) return;
  const { page, board } = rig;
  // Off the page is not a place for the lamp: the ball follows the hand but
  // nothing on the board changes until it is over the page again.
  if (at.x < page.x || at.x > page.x + page.w || at.y < page.y || at.y > page.y + page.h) return;
  const light: Light = {
    ...rig.base,
    on: true,
    x: Math.max(0, Math.min(1, (at.x - page.x) / page.w)),
    y: Math.max(0, Math.min(1, (at.y - page.y) / page.h)),
  };
  for (const s of rig.surfaces) {
    // Skipped entirely while it is off screen — it will be given its shadow
    // the moment it comes back, and nobody can see a shadow they cannot see.
    if (s.right < board.x || s.left > board.x + board.w || s.bottom < board.y || s.top > board.y + board.h) continue;
    const v = liftVars(light, s.cx, s.cy);
    if (!v) continue;
    s.el.style.setProperty("--lift-shadow", v.shadow);
    s.el.style.setProperty("--lift-sheen", v.sheen);
  }
  rig.painted++;
}

/**
 * Let go. The variables come off, and the lamp is written to the store once —
 * which is the one render this whole gesture costs.
 */
export function endLightRig(commit: boolean) {
  if (!rig) return;
  if (rig.frame) cancelAnimationFrame(rig.frame);
  const { at, page, base } = rig;
  const inside = !!at && at.x >= page.x && at.x <= page.x + page.w && at.y >= page.y && at.y <= page.y + page.h;
  const surfaces = rig.surfaces;
  rig = null;
  /*
   * On a hit the variables are left where they are: the render that follows
   * writes the same property with the committed value, and taking them off
   * first would blink every shadow on the board out for the frame between.
   *
   * On a miss the board goes back to the lamp it had — which means putting
   * that lamp's own values back, not removing the property. Removing it took
   * React's inline value with it (it is the same property on the same
   * element) and nothing re-rendered to put it back, so letting go off the
   * page stripped the shadows off a page that had a lamp.
   */
  if (!(commit && inside && at)) {
    for (const s of surfaces) {
      const was = base.on ? liftVars(base, s.cx, s.cy) : null;
      if (was) {
        s.el.style.setProperty("--lift-shadow", was.shadow);
        s.el.style.setProperty("--lift-sheen", was.sheen);
      } else {
        s.el.style.removeProperty("--lift-shadow");
        s.el.style.removeProperty("--lift-sheen");
      }
    }
  }
  if (commit && inside && at) {
    useStudio.getState().setLook({
      light: {
        ...base,
        on: true,
        x: Math.max(0, Math.min(1, (at.x - page.x) / page.w)),
        y: Math.max(0, Math.min(1, (at.y - page.y) / page.h)),
      },
    });
  }
}

/** How many passes the last drag actually ran. For the profiler, and the suite. */
export const rigPasses = () => rig?.painted ?? 0;
