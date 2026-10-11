"use client";
/**
 * THE LAB TAB: five experiments, one card each, on the page that is open.
 *
 * Every card reads the page's parts, says what it found, and has one press
 * that changes the parts as a single undo (`patchNodes`). The board and the
 * Preview draw the same parts, so the change shows in both. Nothing here is
 * remembered between visits; the tab is temporary (see README.md).
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/core/ui/button";
import { Slider } from "@/core/ui/slider";
import { play } from "@/core/audio/engine";
import { BACKGROUND_ID, useStudio, type StudioNode } from "../board/store";
import { partName } from "../partNames";
import { getFeature } from "../shelf";
import { columnsOf, evenOut, flowOf, mirror, outOfOrder, readingOrder, rhythmOf, scaleRhythm, snapToColumns, type Move } from "./index";

const featureName = (id: string) => getFeature(id)?.name;

/** Selects the part and brings it into view on the board. */
function goTo(nodeId: string) {
  const s = useStudio.getState();
  if (s.mode !== "design") s.setMode("design");
  s.setSelection([nodeId]);
  requestAnimationFrame(() => {
    document.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  });
}

/** Applies a set of moves to the page as one undo step. */
function apply(moves: Move[]) {
  if (!moves.length) return;
  const by = new Map(moves.map((m) => [m.id, m]));
  useStudio.getState().patchNodes([...by.keys()], (n) => {
    const m = by.get(n.id)!;
    return { ...(m.x !== undefined ? { x: m.x } : {}), ...(m.y !== undefined ? { y: m.y } : {}), ...(m.w !== undefined ? { w: m.w } : {}), ...(m.h !== undefined ? { h: m.h } : {}) };
  });
}

function Card({ name, hook, children, says }: { name: string; hook: string; says: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section data-lab-card={hook} className="flex flex-col gap-1.5 border-b border-border px-3 py-2.5">
      <h3 className="text-plain font-medium text-fg">{name}</h3>
      <p data-lab-says="" className="text-small leading-relaxed text-fg-muted">{says}</p>
      {children ? <div className="flex flex-wrap items-center gap-1.5">{children}</div> : null}
    </section>
  );
}

export function LabPanel() {
  /* Picked whole, filtered below: a fresh array out of the selector re-renders for ever. */
  const { allNodes, activePageId, frameWidth } = useStudio(useShallow((s) => ({ allNodes: s.nodes, activePageId: s.activePageId, frameWidth: s.frameWidth })));
  const nodes = React.useMemo(() => allNodes.filter((n) => n.pageId === activePageId && n.id !== BACKGROUND_ID && !n.locked), [allNodes, activePageId]);
  /* The boxes Rhythm and Density restack: fixed parts and the Builder's own layers (a repainted canvas) stay still, absolute ones ride with what holds them. */
  const boxes = React.useMemo(() => nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, flow: flowOf(n as Parameters<typeof flowOf>[0]) })), [nodes]);
  const name = (n: StudioNode) => partName(n, allNodes, featureName);
  const byId = (id: string) => nodes.find((n) => n.id === id);

  /* 1. Rhythm */
  const rhythm = React.useMemo(() => rhythmOf(boxes), [boxes]);
  /* 2. Density: the slider's value is a factor on the page as it was when the hand took it; it is applied where the hand lets go, then the slider rests at 100 again. */
  const [density, setDensity] = React.useState(1);
  const base = React.useRef<typeof boxes | null>(null);
  const selection = useStudio((s) => s.selection);
  /* 4. Columns */
  const columns = React.useMemo(() => columnsOf(nodes), [nodes]);
  const snaps = React.useMemo(() => snapToColumns(nodes, columns), [nodes, columns]);
  /* 5. Reading order */
  const order = React.useMemo(() => readingOrder(nodes), [nodes]);
  const astray = React.useMemo(() => outOfOrder(nodes.map((n) => n.id), order), [nodes, order]);

  if (!nodes.length) {
    return (
      <div data-lab-panel="" className="flex flex-col">
        <p className="px-3 pt-3 text-small leading-relaxed text-fg-muted">Put some parts on the page and the Lab has something to measure.</p>
      </div>
    );
  }

  return (
    <div data-lab-panel="" className="flex flex-col">
      <p className="px-3 pt-3 pb-1 text-small leading-relaxed text-fg-muted">Five experiments on this page. Every press is one undo.</p>

      <Card
        name="Rhythm"
        hook="rhythm"
        says={rhythm.usual === null
          ? "One part on its own has no rhythm yet."
          : rhythm.off.length
            ? <>The usual gap is <span className="text-fg">{rhythm.usual}px</span>; {rhythm.off.length} gap{rhythm.off.length === 1 ? "" : "s"} break{rhythm.off.length === 1 ? "s" : ""} it.</>
            : <>Every gap is <span className="text-fg">{rhythm.usual}px</span>. The page keeps its rhythm.</>}
      >
        {rhythm.usual !== null && rhythm.off.length ? (
          <Button size="xs" variant="subtle" data-lab-even="" onClick={() => { play("tap"); apply(evenOut(boxes, rhythm.usual!)); }}>Even out to {rhythm.usual}px</Button>
        ) : null}
        {rhythm.off.slice(0, 4).map((g) => (
          <button key={g.below} type="button" data-lab-gap={g.below} onClick={() => { play("tap"); goTo(g.below); }} className="tactile rounded-sm border border-border px-1.5 py-0.5 text-small text-fg-muted hover:bg-hover" title="Select it on the board">
            {g.gap}px above {byId(g.below) ? name(byId(g.below)!) : g.below}
          </button>
        ))}
      </Card>

      <Card name="Density" hook="density" says="Tighten or spread the whole page: the gaps scale, the parts keep their size.">
        <Slider
          data-lab-density=""
          aria-label="Density"
          min={60} max={150} step={5}
          value={[Math.round(density * 100)]}
          readout={(v) => `${v}%`}
          onValueChange={([v]) => { if (!base.current) base.current = boxes; setDensity((v ?? 100) / 100); }}
          onValueCommit={([v]) => { const f = (v ?? 100) / 100; const from = base.current ?? boxes; base.current = null; setDensity(1); if (f !== 1) apply(scaleRhythm(from, f)); }}
        />
      </Card>

      <Card name="Mirror" hook="mirror" says="Flip the page left to right, to see whether the eye still lands where it should.">
        <Button size="xs" variant="subtle" data-lab-mirror="" onClick={() => { play("tap"); apply(mirror(nodes, frameWidth)); }}>Mirror the page</Button>
      </Card>

      <Card
        name="Columns"
        hook="columns"
        says={columns.length
          ? <>The page lines up on {columns.length} left edge{columns.length === 1 ? "" : "s"} ({columns.join(", ")}); {snaps.length ? <>{snaps.length} part{snaps.length === 1 ? " is" : "s are"} a little off.</> : "every part sits on one."}</>
          : "No two parts share a left edge yet, so there are no columns to snap to."}
      >
        {snaps.length ? <Button size="xs" variant="subtle" data-lab-snap="" onClick={() => { play("tap"); apply(snaps); }}>Snap {snaps.length} to the columns</Button> : null}
      </Card>

      <Card
        name="Reading order"
        hook="order"
        says={astray.length
          ? <>{astray.length} part{astray.length === 1 ? " is" : "s are"} drawn out of the order a person reads the page in.</>
          : "The parts are drawn in the order a person reads them."}
      >
        <ol data-lab-order="" className="flex w-full flex-col gap-0.5">
          {order.map((id, i) => (
            <li key={id}>
              <button type="button" data-lab-read={id} data-lab-astray={astray.includes(id) ? "" : undefined} data-lab-picked={selection.length === 1 && selection[0] === id ? "" : undefined} onClick={() => { play("tap"); goTo(id); }} className="tactile flex min-h-6 w-full items-center gap-2 rounded-sm px-1 text-left text-small hover:bg-hover" title="Select it on the board">
                <span className="w-5 shrink-0 text-right tabular-nums text-fg-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{byId(id) ? name(byId(id)!) : id}</span>
                {astray.includes(id) ? <span className="shrink-0 text-fg-muted">drawn late</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
