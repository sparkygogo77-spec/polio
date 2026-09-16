"use client";
import * as React from "react";
import { GitBranch, Hand, RefreshCw } from "lucide-react";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useStudio } from "./store";
import { BAND_COLOUR, LANE_MODE, laneRects, lanesOf, nextIn, shown, type Item, type Lane, type Lanes as LanesData, type Rect } from "./lanes";
import { ITEMS } from "./lanesSample";
import { BODY, EDGE } from "./boxGround";
import { LANE_STRAND_WIDTH, paintStrand, strandBounds, strandEnvelope, type Point } from "./strand";

/**
 * The three lanes, hanging off the end of the timeline.
 *
 * They are drawn inside the plot, in the boards' own coordinates, fanned
 * off the last real box to its right, with a vine from that box into each
 * of them. They are not threads: nothing in the store knows them, nobody
 * places them, and when a box lands they move along and stay at the end.
 *
 * Each lane box is the same construct the iteration boxes are, at the
 * same size, in the azure that marks a lane's work (`molten.css`), so a
 * lane and the blue box its work becomes are one family: blue right
 * across, texture and all, the words straight on it as they are on a
 * green box, and no plate under them. Inside the rim is a second line in
 * the lane's colour, green at the top, yellow in the middle, red at the
 * bottom, and the vine into the lane is the same colour: the timeline's
 * own ribbon (`strand.ts`), slightly thinner, in the lane's hue. Nothing
 * else colours a lane. Refresh swaps in the next offer of the same lane.
 * Take control carries the work out: the lane's offer becomes a blue
 * iteration in the normal run of boxes, with what the work actually
 * changed as its content, and the lanes move out past it.
 *
 * The content is the checked-in sample (`lanesSample.ts`) read through one
 * typed structure (`lanes.ts`); swapping the source is one import.
 */
/** The checked-in offers, laned by band. */
const SAMPLE: LanesData = lanesOf(ITEMS);

export function Lanes({ from, fromId, size, gap, lanes = SAMPLE }: { from: Rect | null; fromId: string | null; size: { w: number; h: number }; gap: { x: number; y: number }; lanes?: LanesData }) {
  /*
   * The box they hang off is as tall as what it holds, not its nominal
   * size, and the middle lane's centre must be that box's centre to the
   * pixel. So its rendered height is read off the box itself, and read
   * again whenever it changes.
   */
  const [tall, setTall] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!fromId) { setTall(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-box="${fromId}"]`);
    if (!el) { setTall(null); return; }
    const read = () => setTall(el.offsetHeight || null);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fromId]);
  const rects = laneRects(from && tall ? { ...from, h: tall } : from, size, gap);
  return (
    <>
      {from ? <Vines from={from && tall ? { ...from, h: tall } : from} to={rects} lanes={lanes} /> : null}
      {lanes.map((lane, i) => (
        <LaneBox key={lane.id} lane={lane} at={rects[i]!} index={i} />
      ))}
    </>
  );
}

/**
 * The vines into the lanes: one from the latest box's right edge, at its
 * middle, into each lane at the lane's own middle. The same ribbon the
 * timeline joins its boxes with, painted by the same painter, so it is the
 * boxes' material and not a line drawn between them: lit where it leaves
 * and arrives, dark along its middle, bowed rather than pulled taut. His
 * two differences: a little thinner than the timeline's, and coloured by
 * the lane, green, yellow and red from the top down, which is also the
 * colour of the line inside that lane's rim.
 *
 * One canvas over the three, sized to what they can touch, painted again
 * whenever an end moves. Three vines are thirty fills; there is nothing
 * here worth a diff.
 */
function Vines({ from, to, lanes }: { from: Rect; to: [Rect, Rect, Rect]; lanes: LanesData }) {
  const el = React.useRef<HTMLCanvasElement>(null);
  /*
   * Three vines out of one edge, and not out of one point: the top lane's
   * leaves from the upper part of the box's right edge, the middle's from
   * its middle, the bottom's from the lower part, a quarter of the box's
   * height apart. Out of one point they were a knot for the first fifty
   * pixels, three ribbons over each other, and nothing in it could be told
   * green from red.
   */
  const starts: Point[] = [-1, 0, 1].map((k) => ({ x: from.x + from.w, y: from.y + from.h / 2 + (k * from.h) / 4 }));
  const ends = to.map((r) => ({ x: r.x, y: r.y + r.h / 2 }));
  const boxes = ends.map((e, i) => strandBounds(starts[i]!, e));
  const x0 = Math.floor(Math.min(...boxes.map((b) => b.x)));
  const y0 = Math.floor(Math.min(...boxes.map((b) => b.y)));
  const w = Math.ceil(Math.max(...boxes.map((b) => b.x + b.w)) - x0);
  const h = Math.ceil(Math.max(...boxes.map((b) => b.y + b.h)) - y0);
  const key = `${starts.map((p) => `${p.x},${p.y}`).join(";")}>${ends.map((e) => `${e.x},${e.y}`).join(";")},${lanes.map((l) => l.band).join(",")}`;
  React.useEffect(() => {
    const cv = el.current;
    const c = cv?.getContext("2d");
    if (!cv || !c) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(w * scale));
    cv.height = Math.max(1, Math.round(h * scale));
    c.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    c.clearRect(x0, y0, w, h);
    ends.forEach((e, i) => {
      const band = lanes[i]!.band;
      paintStrand(c, starts[i]!, e, { tone: "landed", ends: [band, band], width: LANE_STRAND_WIDTH });
    });
    // Everything the paint depends on is in `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  /*
   * The cloud over each vine, as the timeline lays it over its own: one
   * element per vine carrying the construct's drifting tile, clipped to the
   * ribbon's body, at the phase its place gives it, so a lane's vine is the
   * same weather as the box it leaves. Green and yellow take the verdant
   * tile, red the ember one: the tiles the construct has.
   */
  const period = 512;
  return (
    <>
      <canvas
        ref={el}
        data-lane-vines=""
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: x0, top: y0, width: w, height: h }}
      />
      {ends.map((e, i) => {
        const box = boxes[i]!;
        const band = lanes[i]!.band;
        const at = (p: Point) => ({ x: p.x - box.x, y: p.y - box.y });
        const d = [0, 1].map((side) => strandEnvelope(at(starts[i]!), at(e), side as 0 | 1, { ends: [band, band], width: LANE_STRAND_WIDTH })).filter(Boolean).join(" ");
        return (
          <div
            key={band}
            data-lane-vine-cloud={band}
            className="molten-vine"
            data-heat={band === "red" ? "ember" : "verdant"}
            style={{ left: box.x, top: box.y, width: box.w, height: box.h, clipPath: d ? `path("${d}")` : "inset(100%)" }}
          >
            <i style={{ backgroundPositionX: `${-(((box.x % period) + period) % period)}px` }} />
          </div>
        );
      })}
    </>
  );
}

function LaneBox({ lane, at, index }: { lane: Lane; at: Rect; index: number }) {
  const [item, setItem] = React.useState<Item | undefined>(lane.items[0]);
  const s = item ? shown(item) : null;
  const band = BAND_COLOUR[lane.band];
  const done = !!item?.did;
  const carryOut = () => {
    if (!item?.did) return;
    play("confirm");
    /*
     * The work becomes an iteration in the normal run: the same store
     * action every other iteration lands through, in the lane's own mode,
     * so the timeline colours it blue and the chain places it. Its content
     * is what the work actually changed, in the item's own words, and the
     * headline is the first sentence of that.
     */
    useStudio.getState().landThread({
      mode: LANE_MODE,
      ask: item.title,
      answer: item.did,
      changes: [item.did.split(/(?<=\.)\s/)[0] ?? item.did],
      state: "done",
    });
    setItem(nextIn(lane, item.id));
  };
  return (
    <div className="absolute" style={{ left: at.x, top: at.y, width: at.w, zIndex: 9 }}>
      <div
        data-lane-box={lane.id}
        data-lane-item={item?.id ?? ""}
        data-lane-kind={item?.kind ?? ""}
        data-lane-band={lane.band}
        className={cn(moltenClass("azure"), "flex w-full flex-col rounded-lg p-2 text-left")}
        style={{
          height: at.h,
          ...moltenSeed(`lane:${lane.id}`, index),
          color: BODY,
          boxShadow: "0 3px 6px oklch(0 0 0 / 0.5)",
          /*
           * The words sit straight on the blue, as they do on a green box:
           * no plate under them. His words. What makes them read is their
           * own contrast: near white, medium weight, and a dark edge cast
           * by the letter itself, which lifts a word off a bright filament
           * without putting anything behind it.
           */
          textShadow: EDGE,
        }}
      >
        <span data-molten="" />
        {/* The lane's line: the one line inside the rim, in the lane's colour, and nothing else is coloured. */}
        <div
          data-lane-band-line=""
          className="grid min-h-0 flex-1 rounded-md"
          style={{ border: `2px solid ${band}`, padding: "6px 10px", gridTemplateRows: "16px 18px 1fr 22px", rowGap: 4 }}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.14em]">
              <GitBranch className="size-3" /> {lane.label} · {item ? (item.kind === "fix" ? "an update" : "an improvement") : "nothing yet"}
            </span>
            <span className="font-mono text-[10px] tabular-nums">
              <span data-lane-cost="">{s?.costSaid ?? ""}</span> · <span data-lane-time="">{s?.timeSaid ?? ""}</span>
            </span>
          </div>
          <span data-lane-title="" className="truncate text-[13px] font-medium leading-[18px]">{item?.title ?? "Nothing in this lane yet"}</span>
          <div className="min-h-0 overflow-hidden">
            {!item ? null : item.kind === "fix" ? (
              <pre data-lane-detail="" className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] font-medium leading-[16px]" style={{ maxHeight: "100%" }}>{item.detail}</pre>
            ) : (
              <p data-lane-detail="" className="m-0 line-clamp-4 text-[12.5px] font-medium leading-[17px]">{item.detail}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span data-lane-model="" className="truncate font-mono text-[10px]">
              {s ? `${s.pick.name} · ${s.pick.effort}` : ""}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                data-lane-refresh=""
                title="Another offer from this lane"
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!item}
                onClick={(e) => { e.stopPropagation(); if (!item) return; play("tap"); setItem(nextIn(lane, item.id)); }}
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[10px] disabled:opacity-45"
                style={{ borderColor: "oklch(0.58 0.14 210)", background: "oklch(0.26 0.07 210)", color: "oklch(0.92 0.06 210)" }}
              >
                <RefreshCw className="size-2.5" /> Refresh
              </button>
              <button
                type="button"
                data-lane-take=""
                disabled={!done}
                title={done ? "Carry this out: it becomes a box in the timeline" : "Nothing has carried this out yet"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); carryOut(); }}
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[10px] disabled:opacity-45"
                style={{ borderColor: "oklch(0.58 0.14 210)", background: "oklch(0.26 0.07 210)", color: "oklch(0.92 0.06 210)" }}
              >
                <Hand className="size-2.5" /> Take control
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
