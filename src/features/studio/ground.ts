"use client";
/**
 * The weather, on two layers and one clock.
 *
 * Both the workspace behind the page and the timeline's own floor stand on
 * the same dark matter, and they used to run it two different ways: the
 * timeline repainted everything — four full-surface pattern fills and the
 * embers — thirty times a second, and the workspace painted the embers at
 * thirty and the clouds at two. Measured, the timeline was serving 23fps flat
 * and the workspace 30 with a twenty-millisecond hitch twice a second, which
 * is why the workspace looked like the stuttery one: a hitch in otherwise
 * smooth motion is what an eye catches, and uniformly slow motion is not.
 *
 * So both use this, and it does three things about it:
 *
 *  · **One `requestAnimationFrame` loop**, with the clocks checked inside it.
 *    A `setInterval` at 33ms against a 16.7ms frame lands two frames on one
 *    beat and none on the next, which is a stutter nobody wrote.
 *  · **The clouds are drawn at half resolution** and scaled up by the
 *    browser. They are soft by nature — the sharpest edge in them is a
 *    gradient — so a backing store at half size is invisible and costs a
 *    quarter as much, which takes the hitch under a frame.
 *  · **Never both in one frame.** If a cloud pass is due on the same tick as
 *    an ember pass, the embers go first and the clouds wait for the next one.
 */
import * as React from "react";
import { DRIFT_MS, paintDarkMatter, resizeField, sparkField, type SparkField } from "./darkMatter";

/** How often each layer is redrawn. */
export const SPARK_MS = DRIFT_MS;
export const CLOUD_MS = 420;

/** The clouds' backing store, as a share of the box. Soft things do not need pixels. */
const CLOUD_SCALE = 0.5;

/** True while the hand is down on the board: the ground holds whatever frame it is on. */
const dragging = () => typeof document !== "undefined" && document.documentElement.dataset.boardDrag === "1";

export function useGround(
  host: React.RefObject<HTMLDivElement | null>,
  cloud: React.RefObject<HTMLCanvasElement | null>,
  spark: React.RefObject<HTMLCanvasElement | null>,
  dim: number,
) {
  React.useEffect(() => {
    const box = host.current;
    const cl = cloud.current;
    const sp = spark.current;
    if (!box || !cl || !sp) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const born = performance.now();
    const field: { current: SparkField | null } = { current: null };
    let size = { w: 0, h: 0 };
    let raf = 0;
    let lastCloud = 0;
    let lastSpark = 0;

    const fit = () => {
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      if (w === size.w && h === size.h) return false;
      // The embers are a pixel across, so they get a pixel each.
      sp.width = w;
      sp.height = h;
      sp.style.width = `${w}px`;
      sp.style.height = `${h}px`;
      // The clouds are drawn small and blown up.
      cl.width = Math.max(1, Math.round(w * CLOUD_SCALE));
      cl.height = Math.max(1, Math.round(h * CLOUD_SCALE));
      cl.style.width = `${w}px`;
      cl.style.height = `${h}px`;
      size = { w, h };
      field.current = field.current ? resizeField(field.current, w, h) : sparkField("ground", w, h);
      return true;
    };

    const seconds = () => (performance.now() - born) / 1000;

    const clouds = () => {
      const c = cl.getContext("2d");
      if (!c || !field.current) return;
      // A field of the small canvas's own size, so the clouds are laid out
      // for the box they will be seen at rather than for half of it.
      c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
      paintDarkMatter(c, { field: field.current, t: seconds(), vignette: false, dim, layers: "clouds" });
      c.setTransform(1, 0, 0, 1, 0, 0);
    };
    const sparks = () => {
      const c = sp.getContext("2d");
      if (!c || !field.current) return;
      paintDarkMatter(c, { field: field.current, t: seconds(), vignette: false, dim, layers: "sparks" });
    };

    fit();
    clouds();
    sparks();

    if (still) {
      // One frame, and then the weather holds.
      const ro = new ResizeObserver(() => { if (fit()) { clouds(); sparks(); } });
      ro.observe(box);
      return () => ro.disconnect();
    }

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || dragging()) return;
      if (t - lastSpark >= SPARK_MS) {
        lastSpark = t;
        sparks();
        return; // never two passes in one frame
      }
      if (t - lastCloud >= CLOUD_MS) {
        lastCloud = t;
        clouds();
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => { if (fit()) { clouds(); sparks(); } });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [host, cloud, spark, dim]);
}
