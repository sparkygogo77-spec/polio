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

export function Workspace() {
  const host = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const field = React.useRef<SparkField | null>(null);
  const born = React.useRef(0);
  if (!born.current) born.current = typeof performance !== "undefined" ? performance.now() : 0;

  React.useEffect(() => {
    const el = canvas.current;
    const box = host.current;
    if (!el || !box) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;

    const paint = () => {
      frame = 0;
      const c = el.getContext("2d");
      if (!c) return;
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      // One backing pixel per CSS pixel, never two. The clouds are soft and
      // the embers are a pixel across; four screen-sized pattern fills a
      // frame at twice the resolution buys nothing anybody can see and costs
      // what the canvas needs for dragging parts around.
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      field.current = field.current ? resizeField(field.current, w, h) : sparkField("ground", w, h);
      paintDarkMatter(c, { field: field.current, t: (performance.now() - born.current) / 1000, vignette: false, dim: DIM });
    };

    paint();
    if (still) {
      // One frame, and then the weather holds. A workspace is somewhere to
      // work; a viewer who has asked for less motion means it here most.
      const ro = new ResizeObserver(() => paint());
      ro.observe(box);
      return () => ro.disconnect();
    }
    const t = window.setInterval(() => {
      if (document.hidden || frame) return;
      frame = requestAnimationFrame(paint);
    }, DRIFT_MS);
    const ro = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(paint); });
    ro.observe(box);
    return () => {
      window.clearInterval(t);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={host} data-workspace-ground="" aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvas} className="absolute left-0 top-0" />
    </div>
  );
}
