"use client";
import * as React from "react";
import { Check, GitBranch, Hand, RefreshCw } from "lucide-react";
import { moltenClass, moltenSeed } from "@/core/ui/molten";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { useStudio } from "./board/store";
import { BAND_COLOUR, LANE_MODE, laneArm, laneRects, laneSpine, lanesOf, nextIn, shown, type Item, type Lane, type Lanes as LanesData, type Rect } from "./lanes";
import { ITEMS } from "./lanesSample";
import { BODY, EDGE } from "./boxGround";
import { issueItem, toggleTick } from "./fixLoop";
import { setFixLoop, useFixLoop, useIssues } from "./useFixLoop";
import { bracketBounds, bracketEnvelope, LANE_STRAND_WIDTH, paintBracket, type VineEnd } from "./strand";

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
 * The content is the board's real problems (`fixLoop.ts`, from the check
 * before publish) whenever it has any: each card can be ticked, turns blue,
 * and Publish queues the ticked ones in the site's polio/NEXT.md for the
 * next code chat. With none, the checked-in sample (`lanesSample.ts`) stays,
 * read through the same typed structure (`lanes.ts`).
 */
/** The checked-in offers, laned by band. */
const SAMPLE: LanesData = lanesOf(ITEMS);

export function Lanes({ from, fromId, size, gap, lanes: given, fromEnd = "iteration" }: { from: Rect | null; fromId: string | null; size: { w: number; h: number }; gap: { x: number; y: number }; lanes?: LanesData; fromEnd?: VineEnd }) {
  const issues = useIssues();
  const real = React.useMemo(() => (issues.length ? lanesOf(issues.map(issueItem)) : null), [issues]);
  const lanes = given ?? real ?? SAMPLE;
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
      {from ? <Vines from={from && tall ? { ...from, h: tall } : from} to={rects} lanes={lanes} gap={gap} fromEnd={fromEnd} /> : null}
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
function Vines({ from, to, lanes, gap, fromEnd }: { from: Rect; to: [Rect, Rect, Rect]; lanes: LanesData; gap: { x: number; y: number }; fromEnd: VineEnd }) {
  const el = React.useRef<HTMLCanvasElement>(null);
  /*
   * ONE BRACKET, NOT THREE CURVES.
   *
   * A spine out of the middle of the box's right edge, a turn halfway
   * across the reach, and an arm into each lane's own left edge — square
   * corners, the same for the same pair every time, and nothing that moves.
   * It was three bowed vines out of three points a quarter of the box's
   * height apart, which is a fan however the lanes are arranged, and he
   * has asked for the bracket the lanes had first: the geometry was right
   * then, and what was wrong with it was that it was a flat line with no
   * body. So it is the bracket, in the vine's own material, thinner than
   * the timeline's (`LANE_STRAND_WIDTH`).
   *
   * The corners come from `laneBracket`, beside `laneRects`, so the shape
   * and the places it joins cannot disagree.
   */
  const spine = laneSpine(from, gap);
  const arms = to.map((r) => laneArm(from, r, gap));
  const runs = [spine, ...arms];
  const boxes = runs.map((r) => bracketBounds(r, LANE_STRAND_WIDTH));
  const x0 = Math.floor(Math.min(...boxes.map((b) => b.x)));
  const y0 = Math.floor(Math.min(...boxes.map((b) => b.y)));
  const w = Math.ceil(Math.max(...boxes.map((b) => b.x + b.w)) - x0);
  const h = Math.ceil(Math.max(...boxes.map((b) => b.y + b.h)) - y0);
  const key = `${runs.map((r) => r.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(">")).join(";")}|${fromEnd}|${lanes.map((l) => l.band).join(",")}`;
  React.useEffect(() => {
    const cv = el.current;
    const c = cv?.getContext("2d");
    if (!cv || !c) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(w * scale));
    cv.height = Math.max(1, Math.round(h * scale));
    c.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
    c.clearRect(x0, y0, w, h);
    // The spine first, in the box's own colour, then the three arms out of
    // it, each dissipating from that colour into its lane's. They meet only
    // at the turn, where all four are the box's colour, so nothing shows.
    paintBracket(c, spine, { ends: [fromEnd, fromEnd], width: LANE_STRAND_WIDTH });
    arms.forEach((r, i) => paintBracket(c, r, { ends: [fromEnd, lanes[i]!.band], width: LANE_STRAND_WIDTH }));
    // Everything the paint depends on is in `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  /*
   * The cloud over each arm, as the timeline lays it over its own: one
   * element per lane carrying the construct's drifting tile, clipped to the
   * ribbon's body, at the phase its place gives it, so a lane's bracket is
   * the same weather as the box it leaves. Green and yellow take the
   * verdant tile, red the ember one: the tiles the construct has.
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
      {arms.map((r, i) => {
        const box = boxes[i + 1]!;
        const band = lanes[i]!.band;
        const d = bracketEnvelope(r.map((p) => ({ x: p.x - box.x, y: p.y - box.y })), LANE_STRAND_WIDTH);
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
  const [held, setItem] = React.useState<Item | undefined>(lane.items[0]);
  /* The lane's items change as the board does: a card no longer in it gives way to the first that is. */
  const item = held && lane.items.some((it) => it.id === held.id) ? lane.items.find((it) => it.id === held.id) : lane.items[0];
  const s = item ? shown(item) : null;
  const loop = useFixLoop();
  const issue = item?.issue ?? null;
  const ticked = !!issue && loop.ticked.includes(issue.key);
  const queued = !!issue && loop.sent.some((i) => i.key === issue.key);
  const tick = () => {
    if (!issue) return;
    play(ticked ? "tap" : "confirm");
    setFixLoop(toggleTick(loop, issue.key));
  };
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
        data-lane-issue={issue ? issue.key : undefined}
        data-lane-ticked={issue ? String(ticked) : undefined}
        /* A real issue is a plain construct until it is ticked; ticked, it turns blue, the colour of a lane's work. */
        className={cn(moltenClass(issue && !ticked ? "lantern" : "azure"), "flex w-full flex-col rounded-lg p-2 text-left")}
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
              <GitBranch className="size-3" /> {lane.label} · {issue ? `issue ${lane.items.indexOf(item!) + 1} of ${lane.items.length}${queued ? " · in NEXT.md" : ticked ? " · ticked" : ""}` : item ? (item.kind === "fix" ? "an update" : "an improvement") : "nothing yet"}
            </span>
            <span className="font-mono text-small tabular-nums">
              <span data-lane-cost="">{s?.costSaid ?? ""}</span> · <span data-lane-time="">{s?.timeSaid ?? ""}</span>
            </span>
          </div>
          <span data-lane-title="" className="truncate text-[13px] font-medium leading-[18px]">{item?.title ?? "Nothing in this lane yet"}</span>
          <div className="min-h-0 overflow-hidden">
            {!item ? null : item.kind === "fix" ? (
              <pre data-lane-detail="" className="m-0 whitespace-pre-wrap break-words font-mono text-large font-medium leading-[16px]" style={{ maxHeight: "100%" }}>{item.detail}</pre>
            ) : (
              <p data-lane-detail="" className="m-0 line-clamp-4 text-[12.5px] font-medium leading-[17px]">{item.detail}</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span data-lane-model="" className="truncate font-mono text-small">
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
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-small disabled:opacity-45"
                style={{ borderColor: "oklch(0.58 0.14 210)", background: "oklch(0.26 0.07 210)", color: "oklch(0.92 0.06 210)" }}
              >
                <RefreshCw className="size-2.5" /> Refresh
              </button>
              {issue ? (
              <button
                type="button"
                data-lane-tick=""
                aria-pressed={ticked}
                title={ticked ? "Ticked: Publish puts it in polio/NEXT.md for the next code chat. Press to untick" : "Tick it for the next code chat: Publish puts it in polio/NEXT.md"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); tick(); }}
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-small"
                style={{ borderColor: "oklch(0.58 0.14 210)", background: ticked ? "oklch(0.5 0.15 230)" : "oklch(0.26 0.07 210)", color: "oklch(0.95 0.04 210)" }}
              >
                <Check className="size-2.5" /> {ticked ? "Ticked" : "Fix next"}
              </button>
              ) : (
              <button
                type="button"
                data-lane-take=""
                disabled={!done}
                title={done ? "Carry this out: it becomes a box in the timeline" : "Nothing has carried this out yet"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); carryOut(); }}
                className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-small disabled:opacity-45"
                style={{ borderColor: "oklch(0.58 0.14 210)", background: "oklch(0.26 0.07 210)", color: "oklch(0.92 0.06 210)" }}
              >
                <Hand className="size-2.5" /> Take control
              </button>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
