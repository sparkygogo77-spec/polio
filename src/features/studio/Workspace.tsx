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
import { useGround } from "./ground";

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
  const cloud = React.useRef<HTMLCanvasElement>(null);
  const spark = React.useRef<HTMLCanvasElement>(null);
  useGround(host, cloud, spark, DIM);

  return (
    <div ref={host} data-workspace-ground="" aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The dear half, drawn rarely and small, on its own layer so a spark
          never costs a cloud. */}
      <canvas ref={cloud} data-ground-clouds="" className="absolute left-0 top-0" />
      <canvas ref={spark} data-ground-sparks="" className="absolute left-0 top-0" />
    </div>
  );
}
