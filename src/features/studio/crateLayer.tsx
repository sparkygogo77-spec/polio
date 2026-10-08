"use client";
/**
 * A crate, played as a part's picture.
 *
 * A crate put on a part (`MotionAsset.part`) is drawn over the part as a
 * strip of its frames (`crateDraw.ts#crateSheet`), stepped through by one
 * CSS animation: no player script, nothing that runs per frame, so it costs
 * the page one picture. The same element is drawn on the board, in the
 * preview and, through `LiveSite`, into the published page, where the strip
 * is a file of its own (`exportSite.ts`) and the rule below is in the site's
 * stylesheet. A visitor who asked for less motion sees the first frame.
 */
import * as React from "react";
import { useStudio } from "./board/store";
import { filled, type MotionAsset } from "./motion";
import { cellFor, crateSheet, crateSheetNow, type CrateSheet } from "./crateDraw";

/** The one rule every crate on a page shares; the rest is on the element. */
export const CRATE_CSS = [
  "@keyframes crate-run { from { background-position: 0 0; } to { background-position: 100% 0; } }",
  ".crate-play { position: absolute; inset: 0; pointer-events: none; background-repeat: no-repeat; }",
  "@media (prefers-reduced-motion: reduce) { .crate-play { animation: none !important; } }",
].join("\n");

/**
 * Where the published page finds a crate's strip. Set by the export for the
 * page it is writing (the path is relative to that page), and cleared when
 * it is done; while the Builder is open the strip is the one it just made.
 */
let publishedHref: ((asset: MotionAsset, sheet: CrateSheet) => string) | null = null;
export function setCrateHref(fn: typeof publishedHref): void {
  publishedHref = fn;
}

/** The crate a part wears, when there is one to play. */
export function crateOn(motion: readonly MotionAsset[], nodeId: string): MotionAsset | undefined {
  return motion.find((m) => m.part === nodeId && !m.off && filled(m).length >= 2);
}

/** How a strip is played on an element: its picture, its size in frames and its steps. */
export function crateStyle(sheet: CrateSheet, href: string): React.CSSProperties {
  const n = Math.max(2, sheet.frames);
  return {
    backgroundImage: `url("${href}")`,
    backgroundSize: `${n * 100}% 100%`,
    animation: `crate-run ${sheet.seconds.toFixed(3)}s steps(${n}, jump-none) ${sheet.once ? "1 forwards" : "infinite"}`,
  };
}

function useSheet(asset: MotionAsset | undefined, w: number, h: number): CrateSheet | null {
  const cell = cellFor(w, h);
  const now = asset ? crateSheetNow(asset, cell.w, cell.h) : null;
  const [sheet, setSheet] = React.useState<CrateSheet | null>(now ?? null);
  React.useEffect(() => {
    if (!asset) { setSheet(null); return; }
    let live = true;
    void crateSheet(asset, cell.w, cell.h).then((s) => { if (live) setSheet(s); });
    return () => { live = false; };
  }, [asset, cell.w, cell.h]);
  /* Made already (the export makes every strip before it renders): drawn in the same pass. */
  return now !== undefined ? now : sheet;
}

/** The crate a part wears, drawn over it; nothing when it wears none. */
export function CrateOn({ nodeId, w, h }: { nodeId: string; w: number; h: number }) {
  const asset = useStudio((s) => crateOn(s.motion, nodeId));
  const sheet = useSheet(asset, w, h);
  if (!asset || !sheet) return null;
  const href = publishedHref ? publishedHref(asset, sheet) : sheet.url;
  return (
    <>
      <style data-crate-css="">{CRATE_CSS}</style>
      <div aria-hidden className="crate-play" data-crate={asset.id} style={crateStyle(sheet, href)} />
    </>
  );
}
