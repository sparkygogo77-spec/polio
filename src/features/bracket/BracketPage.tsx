"use client";
import * as React from "react";
import { RefreshCw, Hand } from "lucide-react";
import { VOID } from "@/core/ui/void";
import { cn } from "@/core/lib/cn";
import { BAND_COLOUR, RIM, nextIn, shown, type Generation, type Item, type Lane } from "./model";
import { SAMPLE } from "./sample";

/**
 * The bracket, drawn from the owner's own sketch.
 *
 * The latest box on the timeline sprouts a bracket to the right that fans
 * into three stacked boxes. Every box wears the same blue outer rim, so a
 * bracket reads as one generation; inside that rim is a second line in
 * green, yellow or red, and that line is the cost band and nothing else.
 * Time is a figure inside the box, never a colour. The model's name and
 * its effort sit along the bottom edge. A fix prints what failed, in
 * mono; a step prints a recommendation. Each box has its own Refresh,
 * which swaps in the next item of its lane, and its own Take control.
 *
 * Every box is the same shape whatever it holds: the same outer size, the
 * same rim widths, the same inner padding, the same rows. Words that do
 * not fit are cut, never allowed to grow the box. The page reads one
 * `Generation` (`model.ts`) and today that is the checked-in sample
 * (`sample.ts`); swapping the source is one import.
 */

/** The one shape every box has. Pixels, so three boxes stack to a known height and the bracket can be drawn to it. */
export const BOX = { w: 320, h: 176, gap: 16 } as const;
/** The bracket's own column: the stub out of the latest box, the bar, the stubs into each box. */
const BRACKET_W = 56;
const STACK_H = BOX.h * 3 + BOX.gap * 2;

export function BracketPage() {
  return <Bracket generation={SAMPLE} />;
}

export function Bracket({ generation }: { generation: Generation }) {
  return (
    <div data-bracket="" className="mx-auto max-w-[1180px] px-6 py-8">
      <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-fg-faint">The timeline, and what the latest box could become</p>
      <h1 className="mb-6 text-[15px] font-medium text-fg">One generation: three ways on from {generation.from.label.toLowerCase()}</h1>
      <div className="flex items-center" style={{ minHeight: STACK_H }}>
        <Timeline generation={generation} />
        <Fan />
        <div className="flex flex-col" style={{ gap: BOX.gap }}>
          {generation.lanes.map((lane) => (
            <Box key={lane.id} lane={lane} />
          ))}
        </div>
      </div>
      <p className="mt-6 max-w-[640px] text-[10px] leading-relaxed text-fg-faint">
        Blue rim: one generation. The line inside it is the cost band: green under ${"0.05"}, yellow under ${"0.50"}, red past that.
        Difficulty picks the model, the model and the tokens give the cost, the cost sets the colour. Time is the figure at the top right.
        Refresh swaps in the next item of that row; Take control marks the box as yours.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The timeline the bracket grows from: three boxes, the latest last     */
/* ------------------------------------------------------------------ */

function Timeline({ generation }: { generation: Generation }) {
  const older = [
    { id: "it_zen_15", label: "The Zen Garden zip, fifteen blocks" },
    { id: "it_harbour", label: "The harbour zip, six blocks" },
  ];
  const box = (id: string, label: string, latest: boolean) => (
    <div
      key={id}
      data-bracket-from={latest ? id : undefined}
      className="flex shrink-0 flex-col justify-between rounded-lg border p-2"
      style={{
        width: 148,
        height: 72,
        borderColor: latest ? "oklch(0.7 0.17 152)" : "oklch(0.4 0.09 152)",
        background: latest ? "oklch(0.24 0.06 152)" : "oklch(0.15 0.03 152)",
        color: "oklch(0.93 0.055 150)",
        boxShadow: latest ? "0 6px 18px oklch(0 0 0 / 0.5)" : "0 3px 6px oklch(0 0 0 / 0.5)",
      }}
    >
      <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "oklch(0.9 0.05 152)" }}>{latest ? "latest" : "iteration"}</span>
      <span className="line-clamp-2 text-[11px] font-medium leading-snug">{label}</span>
    </div>
  );
  const link = (k: string) => <span key={k} className="h-px w-5 shrink-0" style={{ background: "oklch(0.4 0.09 152)" }} />;
  return (
    <div className="flex items-center">
      {box(older[0]!.id, older[0]!.label, false)}
      {link("l1")}
      {box(older[1]!.id, older[1]!.label, false)}
      {link("l2")}
      {box(generation.from.id, generation.from.label, true)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The fan: one stub out, one bar, three stubs in                        */
/* ------------------------------------------------------------------ */

function Fan() {
  const mid = STACK_H / 2;
  const centres = [0, 1, 2].map((i) => BOX.h / 2 + i * (BOX.h + BOX.gap));
  const bar = 24;
  return (
    <svg data-bracket-fan="" width={BRACKET_W} height={STACK_H} viewBox={`0 0 ${BRACKET_W} ${STACK_H}`} className="shrink-0" aria-hidden>
      <g fill="none" stroke={RIM} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={`M0 ${mid} H${bar}`} />
        <path d={`M${bar} ${centres[0]} V${centres[2]}`} />
        {centres.map((y) => <path key={y} d={`M${bar} ${y} H${BRACKET_W}`} />)}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* One box                                                              */
/* ------------------------------------------------------------------ */

function Box({ lane }: { lane: Lane }) {
  const [item, setItem] = React.useState<Item>(lane.items[0]!);
  const [taken, setTaken] = React.useState(false);
  const s = shown(item);
  const band = BAND_COLOUR[s.band];
  return (
    <div
      data-bracket-box={lane.id}
      data-bracket-item={item.id}
      data-bracket-kind={item.kind}
      data-bracket-band={s.band}
      data-taken={taken ? "" : undefined}
      className="shrink-0 rounded-lg"
      style={{ width: BOX.w, height: BOX.h, padding: 3, border: `2px solid ${RIM}`, background: VOID.face, boxShadow: "0 3px 6px oklch(0 0 0 / 0.5)", color: VOID.text }}
    >
      <div
        className="grid h-full w-full rounded-md"
        style={{ border: `2px solid ${band}`, padding: "8px 12px", gridTemplateRows: "16px 18px 1fr 22px", rowGap: 6, minHeight: 0 }}
      >
        {/* Row one: the lane's label; the cost and the time as figures. The cost's colour is the line round this, not these digits. */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>{lane.label} · {item.kind === "fix" ? "a fix" : "a step"}</span>
          <span className="font-mono text-[10px] tabular-nums" style={{ color: VOID.text }}>
            <span data-bracket-cost="" style={{ color: VOID.muted }}>{s.costSaid}</span> · <span data-bracket-time="">{s.timeSaid}</span>
          </span>
        </div>
        {/* Row two: what it would do, one line. */}
        <span data-bracket-title="" className="truncate text-[12px] font-medium leading-[18px]">{item.title}</span>
        {/* Row three: the error as it was seen, or the recommendation. Cut, never grown. */}
        <div className="min-h-0 overflow-hidden">
          {item.kind === "fix" ? (
            <pre data-bracket-detail="" className="m-0 whitespace-pre-wrap break-words font-mono text-[9.5px] leading-[13px]" style={{ color: "oklch(0.84 0.03 285)", maxHeight: "100%" }}>{item.detail}</pre>
          ) : (
            <p data-bracket-detail="" className="m-0 line-clamp-4 text-[10.5px] leading-[14px]" style={{ color: "oklch(0.84 0.03 285)" }}>{item.detail}</p>
          )}
        </div>
        {/* Row four, the bottom edge: the model and its effort, then the keys. */}
        <div className="flex items-center justify-between gap-2">
          <span data-bracket-model="" className="truncate font-mono text-[9.5px]" style={{ color: VOID.muted }}>
            {s.pick.name} · {s.pick.effort}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              data-bracket-refresh=""
              title="Another item from this row"
              disabled={taken}
              onClick={() => setItem(nextIn(lane, item.id))}
              className={cn("tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[9.5px] disabled:opacity-45")}
              style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
            >
              <RefreshCw className="size-2.5" /> Refresh
            </button>
            <button
              type="button"
              data-bracket-take=""
              aria-pressed={taken}
              title={taken ? "Hand it back" : "Take control of this one"}
              onClick={() => setTaken((v) => !v)}
              className="tactile flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[9.5px]"
              style={taken
                ? { borderColor: "oklch(0.7 0.19 27)", background: "oklch(0.42 0.16 27)", color: "oklch(0.97 0.02 27)" }
                : { borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
            >
              <Hand className="size-2.5" /> {taken ? "Yours" : "Take control"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
