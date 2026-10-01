"use client";
/**
 * The colours a picture paints under a box, for the words over it.
 *
 * `wordsContrast` (siteColours.ts) asks what is painted right behind a
 * part's words; when that is a picture, this reads it. Each picture a part
 * paints is drawn once into a small canvas, and a box over it is mapped
 * the way the board draws it (`boxPicture`: a strip three or more times
 * wider than tall is the box's height repeating across, anything else
 * covers the box, centred), then cut into a few cells, each averaged. The
 * contrast is the worst cell's, so a dark patch under one word counts.
 *
 * A picture not in this browser yet reads as null, and words over it are
 * left unjudged until it is.
 */
import * as React from "react";
import { reach, type Picture } from "./pictures";
import type { PictureSampler, Rect } from "./siteColours";

interface Held { data: ImageData; w: number; h: number; natural: { w: number; h: number } }
const MAX = 256;

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = url; });
}

/** Cells across and down a box: enough to find a dark patch, few enough to stay smooth. */
const CELLS = { x: 4, y: 2 };

export function sampleHeld(held: Held, part: { w: number; h: number }, under: Rect): string[] {
  const { w: iw, h: ih } = held.natural;
  const strip = ih > 0 && iw / ih >= 3;
  /* Page pixels of the part to the picture's own pixels. */
  const scale = strip ? ih / Math.max(1, part.h) : Math.min(iw / Math.max(1, part.w), ih / Math.max(1, part.h));
  const offX = strip ? (iw - part.w * scale) / 2 : (iw - part.w * scale) / 2;
  const offY = strip ? 0 : (ih - part.h * scale) / 2;
  const toData = held.w / iw;
  const out: string[] = [];
  for (let cy = 0; cy < CELLS.y; cy++) {
    for (let cx = 0; cx < CELLS.x; cx++) {
      const x0 = under.x + (under.w * cx) / CELLS.x, y0 = under.y + (under.h * cy) / CELLS.y;
      const x1 = x0 + under.w / CELLS.x, y1 = y0 + under.h / CELLS.y;
      let r = 0, g = 0, b = 0, n = 0;
      for (let py = y0; py < y1; py += Math.max(1, (y1 - y0) / 4)) {
        for (let px = x0; px < x1; px += Math.max(1, (x1 - x0) / 4)) {
          let ix = (px * scale + offX), iy = (py * scale + offY);
          if (strip) ix = ((ix % iw) + iw) % iw;
          if (ix < 0 || iy < 0 || ix >= iw || iy >= ih) continue;
          const dx = Math.min(held.w - 1, Math.floor(ix * toData)), dy = Math.min(held.h - 1, Math.floor(iy * toData));
          const k = (dy * held.w + dx) * 4;
          if (held.data.data[k + 3]! < 128) continue;
          r += held.data.data[k]!; g += held.data.data[k + 1]!; b += held.data.data[k + 2]!; n++;
        }
      }
      if (n) out.push(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
    }
  }
  return out;
}

/** A sampler for the pictures these parts paint; it fills in as each picture arrives. */
export function usePictureSampler(nodes: readonly { id: string; w: number; h: number; picture?: Picture | null }[]): PictureSampler {
  const [held, setHeld] = React.useState<Map<string, Held>>(new Map());
  const painters = React.useMemo(() => nodes.filter((n) => !!n.picture), [nodes]);
  const key = painters.map((n) => `${n.id}:${n.picture!.id}`).join(",");
  React.useEffect(() => {
    let live = true;
    void (async () => {
      const next = new Map<string, Held>();
      for (const n of painters) {
        try {
          const url = await reach(n.picture!);
          if (!url || !live) continue;
          const img = await load(url);
          const s = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const g = c.getContext("2d", { willReadFrequently: true });
          if (!g) continue;
          g.drawImage(img, 0, 0, w, h);
          next.set(n.id, { data: g.getImageData(0, 0, w, h), w, h, natural: { w: img.naturalWidth, h: img.naturalHeight } });
        } catch { /* unreadable: its words stay unjudged */ }
      }
      if (live) setHeld(next);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const size = React.useMemo(() => new Map(nodes.map((n) => [n.id, { w: n.w, h: n.h }])), [nodes]);
  return React.useCallback<PictureSampler>((id, under) => {
    const h = held.get(id);
    const part = size.get(id);
    return h && part ? sampleHeld(h, part, under) : null;
  }, [held, size]);
}
