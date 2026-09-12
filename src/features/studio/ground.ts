"use client";
/**
 * The weather. One implementation, one instance per surface, everywhere.
 *
 * Four surfaces stand on this: the workspace behind the page, the disc you
 * pull parts out of, and the disc you draw on. The workspace's is mounted
 * once in `StudioPage`, *outside* the switch between the board and the
 * timeline, so moving between them changes what stands on the ground and
 * never the ground itself. There is no second ground anywhere; if you are
 * counting canvases and get a different number in the timeline, the extra
 * one is the timeline's own wires.
 *
 * **How it moves, and why it is barely anything.**
 *
 * A layer is painted **once** and then slid by a CSS animation. That is the
 * whole mechanism. It works because a repeating pattern lands exactly back on
 * itself after one tile period: oversize the canvas by one period along the
 * layer's heading, animate a translation of exactly one period, loop. The
 * loop point is the same pixels in the same place, so it runs for ever with
 * no seam, and — the part that matters — **nothing is ever repainted**.
 *
 * What that deleted, all of which existed to manage a repaint that no longer
 * happens:
 *
 *  · the per-frame transform writes, and the clock that drove them
 *  · the recycle: `lay` on exhaustion, `spent`, the queue, `marginFor`,
 *    `REFRESH_S`, `MARGIN_MIN`
 *  · the turn limit `TURN_MAX` and the margin the corners swept
 *  · `carry`, which existed to undo the rotation of an offset baked into a
 *    paint that is no longer re-baked
 *  · with them, the whole class of bug that ate a night: the seam at a
 *    recycle, the black frame between a clear and a fill, the buffer swap
 *
 * **What was dropped from the look, deliberately.** The layers no longer turn
 * as they drift — `spin` is unused. A slow rotation is the one thing that
 * cannot be done by translating a repeating pattern, and it was the source of
 * the seam. The ask was nearly static, so the rotation went rather than the
 * mechanism being bent back around it. Each layer keeps its own fixed angle,
 * its own heading, its own scale and its own speed, so the parallax and the
 * shifting bloom where two layers cross are both still there — they change
 * more slowly, which is the point. Drift is `CALM` of what it was.
 *
 * **The embers are the only thing still on a clock**, and they are what says
 * the page is alive: their own canvas at the box's own size, thirty times a
 * second, which is what a streak needs.
 *
 * **On blending.** The cloud layers screen over the sky, inside a holder that
 * is `isolation: isolate`, so they screen against *the sky gradient* and not
 * against whatever the app happens to put behind. That isolation is what
 * makes `screen` the right mode rather than a guess. If the ground ever looks
 * black, the first thing to check is not the blend mode but whether something
 * opaque is painted on top of it — which is exactly what went wrong once.
 */
import * as React from "react";
import {
  CLOUD_LAYERS,
  cloudSpeed,
  cloudStep,
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
 * How much of the old drift speed is kept.
 *
 * Nearly static is the ask: a glance should show nothing and only time should
 * reveal it. The relative speeds are untouched, so the near clouds still pass
 * the far ones — everything is simply slower together.
 */
const CALM = 0.15;

/** One layer's canvas and the definition it was painted from. */
interface Live {
  el: HTMLCanvasElement;
  def: CloudLayer;
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
      el.style.cssText = "position:absolute;mix-blend-mode:screen;will-change:transform;";
      holder.appendChild(el);
      return { el, def };
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
    let clock = 0;
    let last = performance.now();
    let nextSpark = 0;

    /**
     * Size a layer, paint it once, and set it drifting.
     *
     * The canvas is the box plus one tile period along the heading, and it is
     * offset so the box stays covered at both ends of the slide: the layer
     * travels exactly that period and starts over, and because the pattern
     * repeats on it there is nothing to see at the loop.
     */
    const dress = (l: Live, w: number, h: number) => {
      const step = cloudStep(l.def);
      const cw = Math.round(w + Math.abs(step.x));
      const ch = Math.round(h + Math.abs(step.y));
      l.el.width = Math.max(1, Math.round(cw * CLOUD_SCALE));
      l.el.height = Math.max(1, Math.round(ch * CLOUD_SCALE));
      l.el.style.width = `${cw}px`;
      l.el.style.height = `${ch}px`;
      l.el.style.left = `${Math.min(0, -step.x)}px`;
      l.el.style.top = `${Math.min(0, -step.y)}px`;

      const c = l.el.getContext("2d");
      if (!c) return;
      c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
      // Painted at its own angle, with no travel baked in: the travel is the
      // animation's job now, so the paint never has to be redone for it.
      paintCloudLayer(c, l.def, { w: cw, h: ch, dim, turn: l.def.turn, dx: 0, dy: 0, alpha: 1 });
      c.setTransform(1, 0, 0, 1, 0, 0);

      /* The layer's weight, once, here, and visible in the DOM.
         The pattern goes onto the canvas at full strength and the weighting
         is this one property. It composites to the same thing — for a screen
         layer, scaling the source's alpha and scaling the element's opacity
         land in the same place — but it means the bitmap is the real picture.
         Reading a layer back used to show a maximum alpha of 42, which looks
         exactly like a broken paint and cost somebody an evening. */
      l.el.style.opacity = String(l.def.alpha * dim);

      l.el.style.setProperty("--gx", `${step.x.toFixed(2)}px`);
      l.el.style.setProperty("--gy", `${step.y.toFixed(2)}px`);
      const secs = step.len / Math.max(0.01, cloudSpeed(l.def) * CALM);
      l.el.style.animation = still ? "none" : `ground-drift ${secs.toFixed(0)}s linear infinite`;
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
      for (const l of layers) dress(l, w, h);
      embersField.current = embersField.current ? resizeField(embersField.current, w, h) : sparkField(shape, w, h);
      return true;
    };

    const embers = () => {
      const c = sp.getContext("2d");
      if (!c || !embersField.current) return;
      paintDarkMatter(c, { field: embersField.current, t: clock, vignette: false, dim, layers: "sparks" });
    };

    fit();
    embers();

    const ro = new ResizeObserver(() => { if (fit()) embers(); });
    ro.observe(box);

    if (still) {
      // One frame, and then the weather holds.
      return () => {
        ro.disconnect();
        holder.replaceChildren();
      };
    }

    /* The only clock left in the ground, and it drives the embers alone. The
       clouds are the compositor's business now. */
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
      last = t;
      if (document.hidden) return;
      clock += dt;
      if (clock >= nextSpark) {
        nextSpark = clock + SPARK_MS / 1000;
        embers();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.replaceChildren();
    };
  }, [host, clouds, spark, dim, shape]);
}
