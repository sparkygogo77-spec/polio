"use client";
/**
 * The ground the board floats on.
 *
 * The space outside the page frame was flat: the app's own background with a
 * dot grid over it, which said "this is scratch" and nothing else. It stands
 * on the same dark matter the add disc opens into now — the same clouds, the
 * same embers, the same generator (`darkMatter.ts`) — so the workspace, the
 * hole you pull parts out of, and the void the wheel is cut from are one
 * place rather than three.
 *
 * **The page itself is untouched.** This paints behind the frame and stops
 * there: what a site's own background is stays the site's business, and the
 * frame draws over this at full opacity. Nothing here reaches the published
 * page, the preview, or a screenshot of either.
 *
 * It is dark in both themes, like the console and the wheel: the void is the
 * void. It stops when the tab is hidden, and holds one still frame when the
 * viewer has asked for less motion.
 */
import * as React from "react";
import { DRIFT_MS, paintDarkMatter, resizeField, sparkField, type SparkField } from "./darkMatter";

/**
 * How far back the weather sits here.
 *
 * The disc's own value is one. A wall of it at one is a lightbox: five times
 * the area in view and none of the disc's horizon to close it off, and every
 * panel round the board picks up a purple halo. Roughly half puts the same
 * sky at a distance — you can still watch a cloud pass and still catch an
 * ember, and the page in front of it is still the brightest thing on screen,
 * which is the whole arrangement.
 */
const DIM = 0.5;

/**
 * How often each half is drawn.
 *
 * The clouds cost what four full-surface pattern fills cost and change by
 * about a pixel a second; the embers cost a few dozen one-pixel streaks and
 * are the whole reason the ground moves at all. Drawing both thirty times a
 * second spent the frame on the half nobody could see moving. Two canvases,
 * two clocks: the embers keep the old thirty, the clouds drift at two, and
 * nothing about the sky reads differently.
 */
const SPARK_MS = DRIFT_MS;
const CLOUD_MS = 500;

/**
 * And neither of them runs while the board is being dragged.
 *
 * A pan is the one moment the main thread has somewhere better to be: every
 * part on the board is being moved under the hand, and a full-surface canvas
 * repaint in the middle of that is the stutter. The ground holds the frame it
 * is on until the hand lets go — which nobody sees, because they are looking
 * at the thing they are dragging. `Canvas.tsx` raises the flag.
 */
const dragging = () => document.documentElement.dataset.boardDrag === "1";

export function Workspace() {
  const host = React.useRef<HTMLDivElement>(null);
  const cloudRef = React.useRef<HTMLCanvasElement>(null);
  const sparkRef = React.useRef<HTMLCanvasElement>(null);
  const field = React.useRef<SparkField | null>(null);
  const born = React.useRef(0);
  if (!born.current) born.current = typeof performance !== "undefined" ? performance.now() : 0;

  React.useEffect(() => {
    const cloud = cloudRef.current;
    const spark = sparkRef.current;
    const box = host.current;
    if (!cloud || !spark || !box) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let size = { w: 0, h: 0 };

    /** Both canvases to the box, one backing pixel per CSS pixel, never two. */
    const fit = () => {
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      const changed = w !== size.w || h !== size.h;
      if (changed) {
        for (const el of [cloud, spark]) {
          el.width = w;
          el.height = h;
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
        }
        size = { w, h };
        field.current = field.current ? resizeField(field.current, w, h) : sparkField("ground", w, h);
      }
      return changed;
    };

    const seconds = () => (performance.now() - born.current) / 1000;

    const paintClouds = () => {
      const c = cloud.getContext("2d");
      if (!c || !field.current) return;
      paintDarkMatter(c, { field: field.current, t: seconds(), vignette: false, dim: DIM, layers: "clouds" });
    };
    const paintSparks = () => {
      const c = spark.getContext("2d");
      if (!c || !field.current) return;
      paintDarkMatter(c, { field: field.current, t: seconds(), vignette: false, dim: DIM, layers: "sparks" });
    };

    fit();
    paintClouds();
    paintSparks();

    if (still) {
      // One frame, and then the weather holds. A workspace is somewhere to
      // work; a viewer who has asked for less motion means it here most.
      const ro = new ResizeObserver(() => { if (fit()) { paintClouds(); paintSparks(); } });
      ro.observe(box);
      return () => ro.disconnect();
    }

    const sparkTimer = window.setInterval(() => {
      if (document.hidden || frame || dragging()) return;
      frame = requestAnimationFrame(() => { frame = 0; paintSparks(); });
    }, SPARK_MS);
    const cloudTimer = window.setInterval(() => {
      if (document.hidden || dragging()) return;
      requestAnimationFrame(paintClouds);
    }, CLOUD_MS);

    const ro = new ResizeObserver(() => {
      if (!fit()) return;
      paintClouds();
      paintSparks();
    });
    ro.observe(box);
    return () => {
      window.clearInterval(sparkTimer);
      window.clearInterval(cloudTimer);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={host} data-workspace-ground="" aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The dear half, drawn rarely, on its own layer so a spark never
          costs a cloud. */}
      <canvas ref={cloudRef} data-ground-clouds="" className="absolute left-0 top-0" />
      <canvas ref={sparkRef} data-ground-sparks="" className="absolute left-0 top-0" />
    </div>
  );
}
