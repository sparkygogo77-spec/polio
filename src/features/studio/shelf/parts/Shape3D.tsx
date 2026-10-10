"use client";
/**
 * The three shapes you can turn: a sphere, a cube and a pyramid (J,
 * 2026-10-10: "a pyramid, cube, and sphere should be the first 3 available
 * options"). Each is drawn by `library/planetJs.ts`, the same lines the
 * published page and a builder-ready site run (the "planet" feature): it
 * turns slowly on its own, a drag turns it any way to see every side, and a
 * throw carries on. Pictures go on it: the first wraps round the sphere; a
 * cube or a pyramid wears one per face, round again when there are fewer.
 *
 * On the board it is one still frame, out of the hand, as every part is.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { items } from "./theme";
import { num, opt, type PartProps } from "./types";
import { planet } from "../library/planetJs";

export const SHAPE_OF: Readonly<Record<string, string>> = { "shape-sphere": "sphere", "shape-cube": "cube", "shape-pyramid": "pyramid" };

/** The words that are pictures: a path or an address ending in an image extension. */
const isPicture = (w: string) => /^(https?:\/\/|\/)\S+\.(png|jpe?g|webp|avif|gif|svg)(\?\S*)?$/i.test(w);

export function Shape3D({ id, content, options, theme: t, mode }: PartProps) {
  const shape = SHAPE_OF[id] ?? "sphere";
  const size = num(options, "size", 80, 30, 100);
  const hue = num(options, "hue", shape === "sphere" ? 96 : shape === "cube" ? 200 : 38, 0, 360);
  const spin = mode === "live" && opt(options, "spin", "yes") === "yes";
  const hands = mode === "live";
  const pictures = items(content, []).filter(isPicture);
  const key = pictures.join(" ");
  const host = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    const p = planet(el);
    return () => p?.stop();
  }, [shape, hue, spin, hands, key]);
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", placeItems: "center" }}>
      <div style={{ position: "relative", width: `${size}%`, aspectRatio: "1 / 1", maxHeight: "100%" }}>
        <div
          ref={host}
          data-planet=""
          data-planet-shape={shape}
          data-planet-hue={Math.round(hue)}
          data-planet-spin={spin ? "yes" : "no"}
          data-planet-hands={hands ? "yes" : "no"}
          style={{ position: "absolute", inset: 0 }}
        >
          {pictures.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- a part ships without next/image
            <img key={`${i}-${src}`} data-planet-picture="" src={src} alt="" style={{ display: "none" }} />
          ))}
        </div>
      </div>
    </Fill>
  );
}
