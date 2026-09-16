"use client";
import * as React from "react";
import { GitBranch, Hand, RefreshCw } from "lucide-react";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useStudio } from "./store";
import { BAND_COLOUR, LANE_MODE, laneRects, nextIn, shown, type Item, type Lane, type Lanes as LanesData, type Rect } from "./lanes";
import { SAMPLE } from "./lanesSample";

/**
 * The three lanes, hanging off the end of the timeline.
 *
 * They are drawn inside the plot, in the boards' own coordinates, one slot
 * past the last real box and stacked down from its top, with a bracket
 * from that box fanning into them. They are not threads: nothing in the
 * store knows them, nobody places them, and when a box lands they move
 * along and stay at the end.
 *
 * Each lane box is the same construct the iteration boxes are, at the
 * same size, in the azure that marks a lane's work (`molten.css`), so a
 * lane and the blue box its work becomes are one family. Inside the rim
 * is a second line in the cost band's colour and nothing else colours it.
 * Refresh swaps in the next offer of the same lane. Take control carries
 * the work out: the lane's offer becomes a blue iteration in the normal
 * run of boxes, with what the work actually changed as its content, and
 * the lanes move out past it.
 *
 * The content is the checked-in sample (`lanesSample.ts`) read through one
 * typed structure (`lanes.ts`); swapping the source is one import.
 */
export function Lanes({ from, size, gap, lanes = SAMPLE }: { from: Rect | null; size: { w: number; h: number }; gap: { x: number; y: number }; lanes?: LanesData }) {
  const rects = laneRects(from, size, gap);
  return (
    <>
      {from ? <Fan from={from} to={rects} /> : null}
      {lanes.map((lane, i) => (
        <LaneBox key={lane.id} lane={lane} at={rects[i]!} index={i} />
      ))}
    </>
  );
}

/** The bracket: a stub out of the last box, a bar down the three centres, a stub into each. */
function Fan({ from, to }: { from: Rect; to: [Rect, Rect, Rect] }) {
  const x0 = from.x + from.w;
  const bar = x0 + (to[0]!.x - x0) / 2;
  const yFrom = from.y + from.h / 2;
  const centres = to.map((r) => r.y + r.h / 2);
  const top = Math.min(yFrom, centres[0]!) - 8;
  const bottom = Math.max(yFrom, centres[2]!) + 8;
  return (
    <svg
      data-lanes-fan=""
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: x0, top, width: to[0]!.x - x0, height: bottom - top, overflow: "visible" }}
      viewBox={`${x0} ${top} ${to[0]!.x - x0} ${bottom - top}`}
    >
      <g fill="none" stroke="var(--azure-hot)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
        <path d={`M${x0} ${yFrom} H${bar}`} />
        <path d={`M${bar} ${Math.min(yFrom, centres[0]!)} V${Math.max(yFrom, centres[2]!)}`} />
        {centres.map((y) => <path key={y} d={`M${bar} ${y} H${to[0]!.x}`} />)}
      </g>
    </svg>
  );
}

function LaneBox({ lane, at, index }: { lane: Lane; at: Rect; index: number }) {
  const [item, setItem] = React.useState<Item>(lane.items[0]!);
  const s = shown(item);
  const band = BAND_COLOUR[s.band];
  const done = !!item.did;
  const carryOut = () => {
    if (!item.did) return;
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
        data-lane-item={item.id}
        data-lane-kind={item.kind}
        data-lane-band={s.band}
        className={cn(moltenClass("azure"), "flex w-full flex-col rounded-lg p-2 text-left")}
        style={{
          minHeight: at.h,
          ...moltenSeed(`lane:${lane.id}`, index),
          color: "oklch(0.93 0.055 210)",
          boxShadow: "0 3px 6px oklch(0 0 0 / 0.5)",
        }}
      >
        <span data-molten="" />
        {/* The cost band: the one line inside the rim, and the one thing coloured by cost. */}
        <div
          data-lane-band-line=""
          className="grid min-h-0 flex-1 rounded-md"
          style={{ border: `2px solid ${band}`, padding: "6px 10px", gridTemplateRows: "16px 18px 1fr 22px", rowGap: 4 }}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.14em]" style={{ color: "oklch(0.9 0.05 210)" }}>
              <GitBranch className="size-3" /> {lane.label} · {item.kind === "fix" ? "an update" : "an improvement"}
            </span>
            <span className="font-mono text-[10px] tabular-nums">
              <span data-lane-cost="" style={{ color: "oklch(0.8 0.05 210)" }}>{s.costSaid}</span> · <span data-lane-time="">{s.timeSaid}</span>
            </span>
          </div>
          <span data-lane-title="" className="truncate text-[13px] font-medium leading-[18px]" style={{ color: "oklch(0.95 0.05 210)" }}>{item.title}</span>
          <div className="min-h-0 overflow-hidden">
            {item.kind === "fix" ? (
              <pre data-lane-detail="" className="m-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-[14px]" style={{ color: "oklch(0.88 0.04 210)", maxHeight: "100%" }}>{item.detail}</pre>
            ) : (
              <p data-lane-detail="" className="m-0 line-clamp-5 text-[11px] leading-[15px]" style={{ color: "oklch(0.88 0.04 210)" }}>{item.detail}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span data-lane-model="" className="truncate font-mono text-[10px]" style={{ color: "oklch(0.8 0.05 210)" }}>
              {s.pick.name} · {s.pick.effort}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                data-lane-refresh=""
                title="Another offer from this lane"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); play("tap"); setItem(nextIn(lane, item.id)); }}
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[10px]"
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
