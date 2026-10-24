"use client";
/**
 * COMPARE: two sites at the same width, scrolling as one.
 *
 * `/builder/compare?a=<site>&b=<site>`. It is for setting a hand-edited copy
 * beside the original, and for what the "better version" pass will make
 * (`handovers/CREATE-SYSTEM-PROPOSAL.md`, "Compare"). It shows the sites as
 * captured on the board, not the live originals, and says so.
 *
 * Side by side is the way it opens: two `SitePreview`s of the two documents,
 * each at half the room, in panes that scroll together. The slider lays B over
 * A in one pane and wipes between them at a handle: A to the left of it, B to
 * the right. One pane scrolls both, so there is no lock to keep.
 */
import * as React from "react";
import { Columns2, SplitSquareHorizontal } from "lucide-react";
import { Select } from "@/core/ui/select";
import { Segmented } from "@/core/ui/segmented";
import { Switch } from "@/core/ui/switch";
import { EmptyState } from "@/core/ui/empty-state";
import { useBuilds } from "@/features/builds/store";
import { SitePreview, type PreviewDoc } from "../SitePreview";
import { frameOf, matchPage, onPage, readSides, writeSides, type CompareMode, type Sides } from "./model";
import { useScrollLock, useInnerWidth } from "./scrollLock";
import { useSiteDoc } from "./useDocs";
import { Wipe } from "./Wipe";

const GAP = 16;
const NONE = "__none";

export interface Side { id: string; name: string; doc: PreviewDoc | null }

export function ComparePage() {
  const projects = useBuilds((s) => s.projects);
  const [sides, setSides] = React.useState<Sides | null>(null);
  const [lock, setLock] = React.useState(true);
  const [pageIx, setPageIx] = React.useState(0);

  React.useEffect(() => {
    void useBuilds.persist.rehydrate()?.then?.(() => useBuilds.getState().adopt());
    setSides(readSides(window.location.search));
  }, []);
  const change = (next: Sides) => {
    setSides(next);
    window.history.replaceState(null, "", `${window.location.pathname}${writeSides(next)}`);
  };

  const docA = useSiteDoc(sides?.a ?? null);
  const docB = useSiteDoc(sides?.b ?? null);
  const pageA = docA?.pages?.[pageIx] ?? docA?.pages?.[0] ?? null;
  const shownA = onPage(docA, pageA?.id ?? null);
  const shownB = onPage(docB, matchPage(docB, pageA ? { id: pageA.id, name: pageA.name, index: pageIx } : null));
  if (!sides) return <div className="mx-auto w-full max-w-[1600px] px-6 py-8" />;

  const options = [{ value: NONE, label: "Choose a site" }, ...projects.map((p) => ({ value: p.id, label: p.name }))];
  const nameOf = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "";
  return (
    <div data-compare="" data-compare-mode={sides.mode} className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-sm font-semibold uppercase tracking-[0.12em] text-fg-faint">Compare</h1>
        <Select aria-label="Site A" className="w-44" value={sides.a ?? NONE} options={options} onChange={(v) => change({ ...sides, a: v === NONE ? null : v })} />
        <span className="text-plain text-fg-faint">vs</span>
        <Select aria-label="Site B" className="w-44" value={sides.b ?? NONE} options={options} onChange={(v) => change({ ...sides, b: v === NONE ? null : v })} />
        <Segmented
          aria-label="How to compare"
          value={sides.mode}
          onChange={(v) => change({ ...sides, mode: v as CompareMode })}
          options={[
            { value: "side", label: "Side by side", icon: <Columns2 />, title: "Side by side" },
            { value: "slider", label: "Slider", icon: <SplitSquareHorizontal />, title: "Slider" },
          ]}
        />
        <label className="flex items-center gap-1.5 text-plain text-fg-muted" title="Both panes move together">
          <Switch size="sm" checked={lock} onCheckedChange={setLock} disabled={sides.mode === "slider"} aria-label="Scroll together" data-compare-lock="" />
          Scroll together
        </label>
        {docA?.pages && docA.pages.length > 1 ? (
          <Select
            aria-label="Page"
            className="w-36"
            value={String(pageIx)}
            options={docA.pages.map((p, i) => ({ value: String(i), label: p.name }))}
            onChange={(v) => setPageIx(Number(v))}
          />
        ) : null}
        <span className="text-plain text-fg-faint" data-compare-width="">
          drawn at <span className="num">{frameOf(docA ?? docB)}</span> px, as captured
        </span>
      </div>
      {sides.a && sides.b ? (
        <Stage mode={sides.mode} lock={lock} a={{ name: nameOf(sides.a), id: sides.a, doc: shownA }} b={{ name: nameOf(sides.b), id: sides.b, doc: shownB }} />
      ) : (
        <EmptyState className="mt-8" icon={Columns2} title="Choose two sites" body="Pick a site on each side. A copy made with Duplicate sits beside its original." />
      )}
    </div>
  );
}

function Stage({ mode, lock, a, b }: { mode: CompareMode; lock: boolean; a: Side; b: Side }) {
  return mode === "slider" ? <Wipe a={a} b={b} /> : <Pair a={a} b={b} lock={lock} />;
}

function Pair({ a, b, lock }: { a: Side; b: Side; lock: boolean }) {
  const [ea, setEa] = React.useState<HTMLDivElement | null>(null);
  const [eb, setEb] = React.useState<HTMLDivElement | null>(null);
  useScrollLock(ea, eb, lock);
  return (
    <div data-compare-stage="side" className="mt-4 grid sm:grid-cols-2" style={{ gap: GAP }}>
      <Pane which="a" side={a} refSet={setEa} />
      <Pane which="b" side={b} refSet={setEb} />
    </div>
  );
}

function Pane({ which, side, refSet }: { which: "a" | "b"; side: Side; refSet: (el: HTMLDivElement | null) => void }) {
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const width = useInnerWidth(el);
  return (
    <section data-compare-pane={which} data-site-id={side.id} aria-label={`${which === "a" ? "A" : "B"}: ${side.name}`} className="min-w-0">
      <h2 data-compare-name="" className="mb-1.5 truncate text-plain font-medium text-fg-muted">{side.name}</h2>
      <div
        ref={(n) => { setEl(n); refSet(n); }}
        data-compare-scroll=""
        className="h-[76vh] overflow-y-auto overflow-x-hidden rounded-md border border-border [scrollbar-gutter:stable]"
      >
        {width > 0 ? <SitePreview doc={side.doc} width={width} height={width} whole /> : null}
      </div>
    </section>
  );
}
