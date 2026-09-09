"use client";
/**
 * The add disc: the page's wheel, turned into a hole you pull parts out of.
 *
 * Press the middle of the background's wheel and the wheel is gone. In its
 * place is a disc the size of the drawing board, the same void, only alive:
 * the clouds go round, and a scatter of faint motes falls in toward the
 * middle. The hole is the library. Down the middle of it run the parts of
 * one category, drawn as themselves at a good size with a long gap between
 * each, and as you scroll they roll through the middle: whatever is at the
 * centre is full size, whatever is above or below it shrinks toward the
 * middle and dims, so the column reads as a drum turning inside the hole
 * and the one you are looking at is always the one that fits. Press a part
 * and it lands on the page where the wheel was opened.
 *
 * The categories are tabs round the left of the rim, straddling it the way
 * the drawing board's Back does: fourteen round keys, each in its
 * category's own colour with the library's own planet mark on it, the one
 * that is open a size larger with a white ring. The search is a short bar in
 * the top cap and no more: the parts are what you are here to see, and they
 * stay large. Back is on the rim, top right; the way out is also Escape.
 */
import * as React from "react";
import { Undo2 } from "lucide-react";
import { play } from "@/core/audio/engine";
import { useActions } from "@/core/actions";
import { Input } from "@/core/ui/input";
import { CATEGORIES, featuresByCategory, searchFeatures, SUBGROUPS, type CategoryId, type FeatureDef } from "./catalog";
import { paintSpace, RimButton } from "./DrawBoard";
import { BOARD_R } from "./menuGeometry";
import { addFeatureToCanvas } from "./Palette";
import { PartPreview, previewHeight } from "./PartPreview";
import { PLANET } from "./planets";
import { CONSOLE, keyForHue, SCREEN } from "./RingConsole";
import { useStudio } from "./store";

/** How often the void moves. Alive, so faster than the board's; still not every frame. */
const DRIFT_MS = 40;
/** The hole the parts scroll in: the disc less its dark edge. */
const WELL_R = BOARD_R - 8;
/** A part's width when it is at the middle. */
const COLUMN_W = 184;
/** The tallest a part is drawn; taller ones shrink to it, keeping their shape. */
const TALL = 118;
/** The gap between one part and the next — long, so each has the hole to itself as it passes. */
const GAP = 54;
/** Where the tabs run round the rim, in screen degrees (0 right, 90 down): down the left side, top to bottom. */
const TABS_FROM = 242;
const TABS_TO = 118;

/** The category the disc opens on: the last one used, this session. */
let lastCategory: CategoryId = "structure";

export interface AddDiscProps {
  /** Where a part lands, in canvas space. Null lands it at the bottom of the page like the library does. */
  at: { x: number; y: number } | null;
  /** Back to the wheel. */
  onBack: () => void;
  /** A part was added; the menu can go. */
  onDone: () => void;
}

export function AddDisc({ at, onBack, onDone }: AddDiscProps) {
  const ctx = useActions();
  const hidden = useStudio((s) => s.hiddenFeatures);
  const [category, setCategory] = React.useState<CategoryId>(lastCategory);
  const [query, setQuery] = React.useState("");
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const scroller = React.useRef<HTMLDivElement>(null);
  const born = React.useRef(0);
  if (!born.current) born.current = typeof performance !== "undefined" ? performance.now() : 0;
  const size = BOARD_R * 2;
  const searching = query.trim().length > 0;

  /* ---------------------------------------------------------- the void */
  React.useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const el = canvas.current;
      const c = el?.getContext("2d");
      if (!el || !c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (el.width !== size * dpr || el.height !== size * dpr) {
        el.width = size * dpr;
        el.height = size * dpr;
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintSpace(c, size, (performance.now() - born.current) / 1000, "lively");
    };
    paint();
    const t = window.setInterval(() => {
      if (document.hidden || frame) return;
      frame = requestAnimationFrame(paint);
    }, DRIFT_MS);
    return () => {
      window.clearInterval(t);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [size]);

  /* ---------------------------------------------------------- the column */
  const rows = React.useMemo<Row[]>(() => {
    const keep = (f: FeatureDef) => !hidden.includes(f.id);
    if (searching) {
      const found = searchFeatures(query).filter(keep);
      return [{ kind: "head", id: "found", label: found.length ? `${found.length} found` : "Nothing by that name" }, ...found.map((f) => ({ kind: "part" as const, id: f.id, feature: f }))];
    }
    const inCategory = featuresByCategory(category).filter(keep);
    const groups = SUBGROUPS[category] ?? [];
    const out: Row[] = [];
    const placed = new Set<string>();
    for (const g of groups) {
      const parts = g.ids.map((id) => inCategory.find((f) => f.id === id)).filter((f): f is FeatureDef => !!f);
      if (!parts.length) continue;
      out.push({ kind: "head", id: g.id, label: g.label });
      for (const f of parts) { out.push({ kind: "part", id: f.id, feature: f }); placed.add(f.id); }
    }
    for (const f of inCategory) if (!placed.has(f.id)) out.push({ kind: "part", id: f.id, feature: f });
    return out;
  }, [category, query, searching, hidden]);

  // The roll: each row scaled to the chord of the hole where it is, and
  // dimmed with its distance from the middle. Read off the scroll, written
  // straight to style, one pass per frame — no state, no transitions.
  const roll = React.useCallback(() => {
    const sc = scroller.current;
    if (!sc) return;
    const mid = sc.scrollTop + size / 2;
    for (const el of Array.from(sc.querySelectorAll<HTMLElement>("[data-roll]"))) {
      const d = el.offsetTop + el.offsetHeight / 2 - mid;
      const chord = 2 * Math.sqrt(Math.max(0, WELL_R * WELL_R - d * d));
      const w = Math.max(1, el.offsetWidth);
      const fit = Math.max(0.22, Math.min(1, (chord - 30) / w));
      // The drum: past the middle a row shrinks with its distance, the way
      // the far side of a turning cylinder does, whatever the chord allows.
      const drum = 1 - 0.55 * Math.pow(Math.min(1, Math.abs(d) / WELL_R), 1.5);
      const near = Math.max(0, Math.min(1, 1 - (Math.abs(d) - 36) / (WELL_R - 36)));
      el.style.transform = `scale(${Math.min(fit, drum).toFixed(3)})`;
      el.style.opacity = (0.2 + 0.8 * near * near).toFixed(3);
      el.style.zIndex = String(Math.round(near * 10));
    }
  }, [size]);
  React.useEffect(() => {
    roll();
    const sc = scroller.current;
    if (!sc) return;
    let frame = 0;
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; roll(); }); };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => { sc.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [roll, rows]);
  // A new category opens with its first part at the middle and its heading above it.
  React.useEffect(() => {
    const sc = scroller.current;
    const first = sc?.querySelector<HTMLElement>("[data-add-item]");
    if (!sc) return;
    sc.scrollTo({ top: first ? first.offsetTop + first.offsetHeight / 2 - size / 2 : 0 });
    roll();
  }, [category, searching, size, roll]);

  /* ---------------------------------------------------------- adding */
  const add = (f: FeatureDef) => {
    const st = useStudio.getState();
    let id: string;
    if (at) {
      const fw = st.frameWidth;
      const w = Math.min(f.w ?? 420, fw);
      const h = f.h ?? 88;
      id = st.addNode(f.id, Math.max(0, Math.min(fw - w, Math.round(at.x - w / 2))), Math.max(0, Math.round(at.y - h / 2)), { w, h });
      play("confirm");
    } else {
      id = addFeatureToCanvas(f.id);
    }
    ctx.publish({ key: `studio:add:${id}`, title: `Added ${f.name}`, body: at ? "Where the wheel was opened." : "At the bottom of the page.", level: "success", source: "studio", toast: true });
    onDone();
  };

  const pick = (c: CategoryId) => {
    play("select");
    lastCategory = c;
    setCategory(c);
    setQuery("");
  };

  /* ---------------------------------------------------------- the disc */
  const rimAt = (deg: number, r = BOARD_R): React.CSSProperties => ({
    left: BOARD_R + Math.cos((deg * Math.PI) / 180) * r,
    top: BOARD_R + Math.sin((deg * Math.PI) / 180) * r,
  });
  const step = (TABS_TO - TABS_FROM) / Math.max(1, CATEGORIES.length - 1);

  return (
    <div
      data-add-disc=""
      className="pointer-events-auto absolute"
      style={{ left: -BOARD_R, top: -BOARD_R, width: size, height: size, animation: "el-grow 160ms ease-out" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* the disc, alive */}
      <canvas
        ref={canvas}
        data-add-surface=""
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          width: size,
          height: size,
          boxShadow: [
            "0 0 0 1px oklch(0.58 0.17 38 / 0.55)",
            "0 0 5px 1.5px oklch(0.62 0.19 35 / 0.32)",
            "0 0 16px 5px oklch(0.52 0.17 30 / 0.2)",
            "0 0 36px 12px oklch(0.42 0.14 26 / 0.12)",
            "0 12px 40px oklch(0 0 0 / 0.45)",
          ].join(", "),
        }}
      />

      {/* the hole: the parts roll down the middle of it */}
      <div
        ref={scroller}
        data-add-scroll=""
        role="listbox"
        aria-label={searching ? "Parts found" : `${CATEGORIES.find((c) => c.id === category)?.label ?? "Parts"} parts`}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        style={{
          clipPath: `circle(${WELL_R}px at 50% 50%)`,
          scrollbarWidth: "none",
          scrollSnapType: "y proximity",
          // The rows are measured against this box, so it has to be the offset parent.
          position: "absolute",
        }}
      >
        <div className="flex flex-col items-center" style={{ paddingTop: size / 2 - 40, paddingBottom: size / 2 - 40, gap: GAP }}>
          {rows.map((row) =>
            row.kind === "head" ? (
              <div
                key={`h-${row.id}`}
                data-roll=""
                data-add-head={row.id}
                className="pointer-events-none select-none font-mono text-[8.5px] font-semibold uppercase"
                style={{ color: SCREEN.ink, letterSpacing: 1.6, textShadow: `0 0 6px ${SCREEN.line}`, willChange: "transform, opacity" }}
              >
                {row.label}
              </div>
            ) : (
              <Part key={row.id} feature={row.feature} onAdd={() => add(row.feature)} />
            ),
          )}
        </div>
      </div>

      {/* the search: a short bar in the top cap, no more */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 20, width: 132 }}>
        <Input
          inputSize="sm"
          data-add-search=""
          value={query}
          aria-label="Search the parts"
          placeholder="Search"
          className="h-[22px] rounded-full border-[oklch(0.36_0.06_290)] bg-[oklch(0.13_0.03_288)] px-2.5 text-center font-mono text-[10px] text-[oklch(0.88_0.09_175)] placeholder:text-[oklch(0.5_0.03_285)]"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              if (query) setQuery(""); else (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter") {
              const first = rows.find((r): r is Extract<Row, { kind: "part" }> => r.kind === "part");
              if (first) { e.preventDefault(); add(first.feature); }
            }
          }}
        />
      </div>

      {/* the categories: tabs round the left of the rim, in their own colours */}
      <div role="tablist" aria-label="Categories" aria-orientation="vertical">
        {CATEGORIES.map((c, i) => {
          const on = !searching && c.id === category;
          const Mark = PLANET[c.id];
          const key = keyForHue(c.hue);
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={c.label}
              title={`${c.label} · ${c.blurb}`}
              data-add-tab={c.id}
              onClick={() => pick(c.id)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none transition-[width,height,box-shadow,filter] duration-150 hover:brightness-110 active:scale-95"
              style={{
                ...rimAt(TABS_FROM + step * i),
                width: on ? 28 : 22,
                height: on ? 28 : 22,
                ...key,
                boxShadow: on
                  ? `0 0 0 2px oklch(0.99 0 0), 0 0 0 4px oklch(0.05 0.02 290), 0 0 12px ${String(key.background).replace(")", " / 0.6)")}, 0 2px 6px oklch(0 0 0 / 0.6)`
                  : "0 0 0 2px oklch(0.05 0.02 290), 0 2px 6px oklch(0 0 0 / 0.6)",
                filter: on || searching ? undefined : "saturate(0.9) brightness(0.92)",
              }}
            >
              <Mark size={on ? 15 : 12} />
            </button>
          );
        })}
      </div>

      {/* the way back, on the rim, top right */}
      <RimButton at={rimAt(318)} label="Back to the wheel" onClick={() => { play("close"); onBack(); }} testId="add-back">
        <Undo2 className="size-3.5" />
      </RimButton>
    </div>
  );
}

type Row = { kind: "head"; id: string; label: string } | { kind: "part"; id: string; feature: FeatureDef };

/** One part in the column: drawn as itself, its name under it, a press adds it. */
function Part({ feature, onAdd }: { feature: FeatureDef; onAdd: () => void }) {
  const natural = previewHeight(feature, COLUMN_W);
  const shrink = Math.min(1, TALL / Math.max(1, natural));
  const width = Math.max(96, Math.round(COLUMN_W * shrink));
  const height = Math.max(36, Math.round(natural * shrink));
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      data-roll=""
      data-add-item={feature.id}
      title={feature.explain ?? feature.blurb}
      onClick={onAdd}
      className="group/part flex flex-col items-center gap-1.5 rounded-md outline-none"
      style={{ width: COLUMN_W, scrollSnapAlign: "center", willChange: "transform, opacity" }}
    >
      <span
        className="block overflow-hidden rounded-[6px] transition-[box-shadow] duration-150 group-hover/part:shadow-[0_0_0_2px_oklch(0.72_0.16_205),0_0_18px_oklch(0.72_0.16_205/0.45)] group-focus-visible/part:shadow-[0_0_0_2px_oklch(0.72_0.16_205)]"
        style={{ width, height, boxShadow: `0 0 0 1px ${CONSOLE.rim}, 0 6px 18px oklch(0 0 0 / 0.55)` }}
      >
        <PartPreview feature={feature} width={width} height={height} />
      </span>
      <span className="line-clamp-1 text-[10px] font-semibold leading-tight" style={{ color: CONSOLE.text, textShadow: "0 1px 3px oklch(0 0 0 / 0.8)" }}>
        {feature.name}
      </span>
    </button>
  );
}
