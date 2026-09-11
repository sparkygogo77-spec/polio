"use client";
/**
 * The weather. One implementation, everywhere it appears.
 *
 * Four surfaces stand on this: the workspace behind the page, the timeline's
 * own floor, the disc you pull parts out of, and the disc you draw on. They
 * used to be two implementations and four clocks — the walls repainted the
 * clouds every 420ms, the discs repainted *everything* on a 33ms
 * `setInterval`, which against a 16.7ms frame lands two frames on one beat
 * and none on the next. All four skipped, in their own ways, for the same
 * reason: the nebula was being **redrawn** to move it, and a redraw rate is
 * a frame rate however fast the page around it runs.
 *
 * So the clouds are not redrawn to move any more. They move:
 *
 *  · **A canvas per layer, bigger than the box.** Each of `CLOUD_LAYERS`
 *    gets its own, so each keeps its own heading, its own speed and its own
 *    slow turn. The near cloud passes the far one, the two near tiles
 *    counter-drift, and the bloom where they cross goes on shifting.
 *  · **Full resolution.** A pixel a pixel. The clouds were drawn at half
 *    size once so a whole repaint would fit inside a frame; there is no
 *    whole repaint any more, so there is no reason to.
 *  · **Screened together, as they always were.** `mix-blend-mode: screen`
 *    over a sky that is the same radial gradient, painted by the compositor
 *    instead of by us.
 *  · **Moved on the compositor.** `translate3d` for the drift and `rotate`
 *    for the turn, every frame, which the compositor does without touching
 *    the page: no layout, no paint, no main-thread raster.
 *  · **Repainted only when the material runs out** — or on a resize, or when
 *    the distance changes. A recycle re-lays that one layer with the turn
 *    and the drift it had reached baked in and its transform reset, so it is
 *    the same pixels in the same place and there is nothing to see. One
 *    layer to a frame, so even that moment fits in a frame.
 *
 * A disc is the same thing in a round hole: the holder is clipped to a
 * circle and wears its horizon as a static gradient, because a horizon does
 * not move either.
 *
 * **What it costs, and where that number came from.** Four window-sized
 * layers blended by the compositor every frame. On a graphics card that is
 * the compositor's day job. The container this repository is tested in has
 * **no GPU** — ANGLE/SwiftShader, software rasterisation — and there it
 * measures 13.9fps against a one-layer field's 60. That number is a floor
 * for software, not a verdict on the design: J runs hardware, and the call
 * was his. `docs/shelf/README.md` has the whole table.
 *
 * The embers are untouched: their own canvas at the box's own size, thirty
 * times a second, which is what a streak needs. The drag pause is kept and
 * is a held clock rather than a skipped frame, so letting go of the board
 * does not jump the weather forward by however long the drag was.
 */
import * as React from "react";
import {
  CLOUD_LAYERS,
  cloudSpeed,
  cloudTravel,
  DRIFT_MS,
  paintCloudLayer,
  paintDarkMatter,
  resizeField,
  skyGradient,
  sparkField,
  type CloudLayer,
  type Shape,
  type SparkField,
} from "./darkMatter";

/** How often the embers are redrawn. */
export const SPARK_MS = DRIFT_MS;

/**
 * The clouds' backing store, as a share of the box. One is a pixel a pixel.
 *
 * This is the one number in this file that anybody can see, so it does not
 * move to buy frames without somebody being told.
 */
const CLOUD_SCALE = 1;

/**
 * How long a layer's material should last before it needs more.
 *
 * Raising it costs memory and compositing — the canvas is oversized by the
 * layer's own speed times this, and the compositor samples the whole layer
 * every frame. Lowering it costs how often a recycle runs, and a recycle is
 * one pattern fill that cannot be seen.
 */
const REFRESH_S = 14;
/** A little room either way even for a layer that barely moves, for a resize. */
const MARGIN_MIN = 48;
/**
 * How far a layer may turn before it is laid again, in degrees.
 *
 * A recycle is exact — the turn it had reached is baked in and the transform
 * reset — so this is not a fidelity number, it is how often a full-resolution
 * pattern fill runs. Ten degrees is twelve seconds for the fastest-turning
 * layer, and costs about 150px of extra margin to keep the box covered while
 * the corners sweep.
 */
const TURN_MAX = 10;

/** How much material a layer needs past the box's edge, in CSS pixels. */
export function marginFor(l: CloudLayer, w: number, h: number): number {
  const drift = cloudSpeed(l) * REFRESH_S;
  // Turning sweeps the corners in: enough that the box stays covered at the
  // most this layer will have turned before it is laid again.
  const sweep = (Math.hypot(w, h) / 2) * Math.sin((TURN_MAX * Math.PI) / 180);
  return Math.round(Math.max(MARGIN_MIN, drift) + sweep);
}

/**
 * How long the clouds will hold for a drag before carrying on regardless.
 *
 * The pause is a flag another component sets and clears. A flag that goes on
 * and does not come off freezes the weather for good, and every way that can
 * happen is outside this file: a pointer released outside the window, a
 * handler that returns early, a component unmounted mid-drag. So this does
 * not trust the flag indefinitely. Six seconds is longer than any real drag
 * needs and short enough that a stuck flag is a hitch rather than a dead
 * ground.
 */
const HOLD_MAX_S = 6;

/** The flag another component sets while the hand is down on the board. */
const flagged = () => typeof document !== "undefined" && document.documentElement.dataset.boardDrag === "1";

/** One layer's canvas, and where its paint and its transform each stand. */
interface Live {
  el: HTMLCanvasElement;
  def: CloudLayer;
  /** How far past the box this one reaches. */
  m: number;
  /** The moment the paint has baked in. */
  at: number;
  /** What the transform is showing, so an unchanged one is not written again. */
  said: string;
}

export interface GroundOpts {
  /** How far away the weather is, 0..1. One is the disc's own. */
  dim?: number;
  /** A wall, or a round hole. A disc is clipped and wears a horizon. */
  shape?: Shape;
}

export function useGround(
  host: React.RefObject<HTMLElement | null>,
  clouds: React.RefObject<HTMLDivElement | null>,
  spark: React.RefObject<HTMLCanvasElement | null>,
  opts: number | GroundOpts = {},
) {
  const o: GroundOpts = typeof opts === "number" ? { dim: opts } : opts;
  const dim = o.dim ?? 1;
  const shape: Shape = o.shape ?? "ground";

  React.useEffect(() => {
    const box = host.current;
    const holder = clouds.current;
    const sp = spark.current;
    if (!box || !holder || !sp) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const disc = shape === "disc";

    /* The sky: the half of the weather that never moves, so it is not on a
       canvas at all. `isolate` keeps the screening inside this box rather
       than reaching the app behind it. */
    holder.replaceChildren();
    holder.style.isolation = "isolate";
    if (disc) {
      holder.style.borderRadius = "50%";
      holder.style.overflow = "hidden";
    }
    const sky = document.createElement("div");
    sky.dataset.groundSky = "";
    sky.style.cssText = `position:absolute;inset:0;background:${skyGradient(dim)};`;
    holder.appendChild(sky);

    const layers: Live[] = CLOUD_LAYERS.map((def) => {
      const el = document.createElement("canvas");
      el.dataset.cloudLayer = def.id;
      el.style.cssText = "position:absolute;mix-blend-mode:screen;will-change:transform;transform-origin:50% 50%;";
      holder.appendChild(el);
      return { el, def, m: 0, at: 0, said: "" };
    });

    /* A disc's horizon: the edge falls off to near black. It does not move
       either, so it is a gradient rather than a pass of the paint. */
    if (disc) {
      const edge = document.createElement("div");
      edge.dataset.groundHorizon = "";
      edge.style.cssText =
        "position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle closest-side at 50% 50%, rgba(0,0,0,0) 78%, rgba(4,2,8,0.5) 92.6%, rgba(3,1,6,0.9) 100%);";
      holder.appendChild(edge);
    }

    const embersField: { current: SparkField | null } = { current: null };
    let size = { w: 0, h: 0 };
    let raf = 0;
    /** Seconds of weather that have passed. Held while the hand is down. */
    let clock = 0;
    /** The embers' own, which is never held: nothing here is ever still. */
    let sparkClock = 0;
    let last = performance.now();
    let nextSpark = 0;
    /** Layers waiting to be laid again, one to a frame. */
    const queue: Live[] = [];

    /* The second buffer, swapped rather than copied.
     *
     * A recycle is the one moment a visible layer is rewritten, and it is a
     * full-resolution pattern fill — the most expensive thing in this file.
     * Doing it on the canvas the compositor is sampling means the layer's
     * pixels are in flux while it is on screen, and if any of that raster is
     * deferred, what shows is an empty canvas: a black hole in the ground
     * for a frame.
     *
     * So the fill happens on an `OffscreenCanvas` nothing displays, and the
     * visible layer takes the result through `transferFromImageBitmap`,
     * which hands over the buffer rather than copying it. That distinction
     * is the whole design: painting the buffer and then `drawImage`-ing it
     * onto the visible canvas was measured here at 33 stalls over 80ms in
     * forty seconds against 13 for painting in place, because a full-surface
     * blit is a second full-surface raster. A transfer is a pointer swap and
     * costs nothing, so the visible canvas is never mid-paint and never
     * cleared, and the recycle costs what it always did.
     *
     * One offscreen for all four layers: they recycle one to a frame, so
     * they never need it at once, and four more window-sized backing stores
     * is the memory that makes a browser start dropping them.
     *
     * Where `OffscreenCanvas` or the bitmap renderer is missing, the layer
     * keeps a plain 2D context and `paintCloudLayer` writes straight to it —
     * one `copy` fill, so even then there is no cleared canvas to catch. */
    const canSwap =
      typeof OffscreenCanvas !== "undefined" &&
      !!document.createElement("canvas").getContext("bitmaprenderer");
    let buf: OffscreenCanvas | null = null;

    const lay = (l: Live, at: number) => {
      const w = size.w + l.m * 2;
      const h = size.h + l.m * 2;
      const pw = Math.max(1, Math.round(w * CLOUD_SCALE));
      const ph = Math.max(1, Math.round(h * CLOUD_SCALE));
      const paint = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
        c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
        paintCloudLayer(c as CanvasRenderingContext2D, l.def, {
          w,
          h,
          dim,
          turn: l.def.turn + l.def.spin * at,
          dx: l.def.dx * at,
          dy: l.def.dy * at,
        });
        c.setTransform(1, 0, 0, 1, 0, 0);
      };

      if (canSwap) {
        if (!buf) buf = new OffscreenCanvas(pw, ph);
        // Sizing it resets it, which is what a fresh field wants anyway, and
        // a transfer detaches the old buffer regardless.
        buf.width = pw;
        buf.height = ph;
        const bc = buf.getContext("2d");
        if (!bc) return;
        paint(bc);
        const view = l.el.getContext("bitmaprenderer");
        if (!view) return;
        view.transferFromImageBitmap(buf.transferToImageBitmap());
      } else {
        const c = l.el.getContext("2d");
        if (!c) return;
        paint(c);
      }
      l.at = at;
    };

    /** Where the compositor has to carry this layer, from where it was laid. */
    const move = (l: Live, force = false) => {
      const now = cloudTravel(l.def, clock);
      const then = cloudTravel(l.def, l.at);
      const turn = l.def.spin * (clock - l.at);
      const said = `translate3d(${(now.x - then.x).toFixed(3)}px, ${(now.y - then.y).toFixed(3)}px, 0) rotate(${turn.toFixed(4)}deg)`;
      if (!force && said === l.said) return;
      l.el.style.transform = said;
      l.said = said;
    };

    /** Has this layer run out of the material it was laid with? */
    const spent = (l: Live) => {
      const now = cloudTravel(l.def, clock);
      const then = cloudTravel(l.def, l.at);
      return Math.hypot(now.x - then.x, now.y - then.y) >= l.m - MARGIN_MIN
        || Math.abs(l.def.spin * (clock - l.at)) >= TURN_MAX;
    };

    const fit = () => {
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      if (w === size.w && h === size.h) return false;
      size = { w, h };
      // The embers are a pixel across, so they get a pixel each.
      sp.width = w;
      sp.height = h;
      sp.style.width = `${w}px`;
      sp.style.height = `${h}px`;
      for (const l of layers) {
        l.m = marginFor(l.def, w, h);
        const cw = w + l.m * 2;
        const ch = h + l.m * 2;
        l.el.width = Math.max(1, Math.round(cw * CLOUD_SCALE));
        l.el.height = Math.max(1, Math.round(ch * CLOUD_SCALE));
        l.el.style.width = `${cw}px`;
        l.el.style.height = `${ch}px`;
        l.el.style.left = `${-l.m}px`;
        l.el.style.top = `${-l.m}px`;
      }
      embersField.current = embersField.current ? resizeField(embersField.current, w, h) : sparkField(shape, w, h);
      return true;
    };

    const layAll = () => {
      queue.length = 0;
      for (const l of layers) {
        lay(l, clock);
        move(l, true);
      }
    };

    const embers = () => {
      const c = sp.getContext("2d");
      if (!c || !embersField.current) return;
      paintDarkMatter(c, { field: embersField.current, t: sparkClock, vignette: false, dim, layers: "sparks" });
    };

    fit();
    layAll();
    embers();

    if (still) {
      // One frame, and then the weather holds.
      const ro = new ResizeObserver(() => { if (fit()) { layAll(); embers(); } });
      ro.observe(box);
      return () => {
        ro.disconnect();
        holder.replaceChildren();
      };
    }

    /* The pause, and coming out of it.
     *
     * Two changes from a plain "is the flag set". First, it is capped: a flag
     * that never comes off stops holding after `HOLD_MAX_S`, so the ground
     * always resumes by itself rather than waiting on somebody else's
     * cleanup. Second, a real pointer has to be down for it to count — the
     * pointerup and pointercancel below fire on the window whatever the
     * board's own handler does, and the blur covers a pointer released
     * outside it altogether. Any of the three failing resumes the weather.
     */
    let heldFrom = 0;
    /** Latched once a hold outstays the cap, so the resume is not undone. */
    let capped = false;
    let pointer = false;
    const down = () => { pointer = true; };
    const up = () => { pointer = false; };
    addEventListener("pointerdown", down, { capture: true, passive: true });
    addEventListener("pointerup", up, { capture: true, passive: true });
    addEventListener("pointercancel", up, { capture: true, passive: true });
    addEventListener("blur", up);

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
      last = t;
      if (document.hidden) return;

      /* The cap latches. Without that, exceeding it clears `heldFrom`, which
         makes the next frame look like a fresh hold — a one-frame twitch
         every six seconds rather than a resume. Once it has outstayed its
         welcome the hold is over until the flag itself goes. */
      const wants = flagged() && pointer;
      if (!wants) { heldFrom = 0; capped = false; }
      else if (heldFrom === 0) heldFrom = t;
      else if (t - heldFrom >= HOLD_MAX_S * 1000) capped = true;
      const held = wants && !capped;

      /* The embers run through a pause; only the clouds hold.
       *
       * The pause is there because a pan is the one moment the main thread
       * has somewhere better to be, and what costs it is a full-resolution
       * pattern fill, not thirty dots. Holding the embers too bought nothing
       * and stopped the ground dead, which is the thing that reads as broken.
       * So the embers keep their own clock and never stop; the clouds keep
       * the held one, so letting go carries on from where it was rather than
       * jumping the weather forward by the length of the drag. */
      sparkClock += dt;
      if (!held) {
        clock += dt;

        // One recycle to a frame, so the only expensive moment in this file
        // never doubles up.
        const due = queue.shift();
        if (due) {
          lay(due, clock);
          move(due, true);
        } else {
          for (const l of layers) if (spent(l) && !queue.includes(l)) queue.push(l);
        }
        for (const l of layers) if (l !== due) move(l);
      }

      if (sparkClock >= nextSpark) {
        nextSpark = sparkClock + SPARK_MS / 1000;
        embers();
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => { if (fit()) { layAll(); embers(); } });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointerdown", down, { capture: true });
      removeEventListener("pointerup", up, { capture: true });
      removeEventListener("pointercancel", up, { capture: true });
      removeEventListener("blur", up);
      holder.replaceChildren();
    };
  }, [host, clouds, spark, dim, shape]);
}
