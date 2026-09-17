"use client";
/**
 * The add disc: the page's wheel, turned into a hole you pull parts out of.
 *
 * Press the middle of the background's wheel and the wheel is gone. In its
 * place is a disc the size of the drawing board, its ground the dark matter
 * camo: violet and magenta nebula clouds over black voids, drifting and
 * turning under a scatter of glinting flecks. The hole is the library. Down
 * the middle of it run the parts of one category, drawn as themselves at a
 * good size with a long gap between each, and they roll through the middle:
 * whatever is at the centre is full size, whatever is above or below it
 * shrinks toward the middle and dims, so the column reads as a drum turning
 * inside the hole and the one you are looking at is always the one that
 * fits.
 *
 * The drum turns like a slot machine's, only gently. One notch of the wheel
 * pushes the selection down and it rolls back up into place; two notches
 * and it flies on to the next part and settles there with a small
 * overshoot. A flick of several notches goes several parts. Nothing
 * teleports: the column is on a spring, never on the browser's scroll.
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
import { RimButton } from "./DrawBoard";
import { useGround } from "./ground";
import { BOARD_R } from "./menuGeometry";
import { addFeatureToCanvas } from "./Palette";
import { PartPreview, previewHeight } from "./PartPreview";
import { planetOf } from "./planets";
import { CONSOLE, keyForHue, SCREEN } from "./RingConsole";
import { useStudio } from "./store";

/** The hole the parts roll in: the disc less its dark edge. */
const WELL_R = BOARD_R - 8;
/** A part's width when it is at the middle. */
const COLUMN_W = 228;
/** The tallest a part is drawn; taller ones shrink to it, keeping their shape. */
const TALL = 150;
/** The gap between one part and the next — long, so each has the hole to itself as it passes. */
const GAP = 60;
/** Where the tabs run round the rim, in screen degrees (0 right, 90 down): down the left side, top to bottom. */
const TABS_FROM = 246;
const TABS_TO = 114;
/** One notch of a mouse wheel, in pixels: a mouse reports about a hundred a click, a trackpad adds up to it. */
const NOTCH = 50;
/** How long a lone notch waits for its partner before it is forgotten. */
const NOTCH_MS = 420;
/** The spring the drum sits on: stiff enough to settle in well under a second, loose enough to overshoot a little. */
const SPRING_K = 170;
const SPRING_ZETA = 0.64;
/** The push one notch gives the drum, in pixels per second — enough to lean, not enough to leave. */
const NUDGE = 600;

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

type Row = { kind: "head"; id: string; label: string } | { kind: "part"; id: string; feature: FeatureDef };

export function AddDisc({ at, onBack, onDone }: AddDiscProps) {
  const ctx = useActions();
  const hidden = useStudio((s) => s.hiddenFeatures);
  const [category, setCategory] = React.useState<CategoryId>(lastCategory);
  const [query, setQuery] = React.useState("");
  const [sel, setSel] = React.useState(0);
  // The disc's own weather, off the one implementation every surface uses
  // (`ground.ts`): its own embers, because the workspace behind it stands on
  // the same ground and one shared cast would tear in half.
  const face = React.useRef<HTMLDivElement>(null);
  const clouds = React.useRef<HTMLDivElement>(null);
  const embers = React.useRef<HTMLCanvasElement>(null);
  const well = React.useRef<HTMLDivElement>(null);
  const column = React.useRef<HTMLDivElement>(null);
  const size = BOARD_R * 2;
  const searching = query.trim().length > 0;

  /* ---------------------------------------------------------- the camo */
  useGround(face, clouds, embers, { shape: "disc" });

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
  /** The rows that can be chosen, as indexes into `rows`. */
  const parts = React.useMemo(() => rows.map((r, i) => (r.kind === "part" ? i : -1)).filter((i) => i >= 0), [rows]);

  /*
   * The drum. `pos` is the column offset at the middle of the hole, in
   * pixels down the column; `target` is where the chosen part's centre is.
   * A spring carries pos to target and the frame loop writes the column's
   * transform and every row's roll. All of it lives in refs: the hand and
   * the spring both move it many times a second, and none of that is state.
   */
  const drum = React.useRef({ pos: 0, vel: 0, target: 0, frame: 0, last: 0, acc: 0, pending: 0, dir: 0, timer: 0 });
  const centreOf = (rowIndex: number) => {
    const el = column.current?.children[rowIndex] as HTMLElement | undefined;
    return el ? el.offsetTop + el.offsetHeight / 2 : 0;
  };
  const apply = React.useCallback(() => {
    const col = column.current;
    if (!col) return;
    const { pos } = drum.current;
    // Nothing but the drum moves the column: undo any scroll a part inside it managed.
    if (well.current && (well.current.scrollTop || well.current.scrollLeft)) { well.current.scrollTop = 0; well.current.scrollLeft = 0; }
    col.style.transform = `translate3d(0, ${(size / 2 - pos).toFixed(2)}px, 0)`;
    // The roll: each row scaled to the chord of the hole where it is and to
    // a drum curve of its distance from the middle, and dimmed with it.
    for (const el of Array.from(col.children) as HTMLElement[]) {
      const d = el.offsetTop + el.offsetHeight / 2 - pos;
      const chord = 2 * Math.sqrt(Math.max(0, WELL_R * WELL_R - d * d));
      const w = Math.max(1, el.offsetWidth);
      const fit = Math.max(0.22, Math.min(1, (chord - 30) / w));
      const curve = 1 - 0.55 * Math.pow(Math.min(1, Math.abs(d) / WELL_R), 1.5);
      const near = Math.max(0, Math.min(1, 1 - (Math.abs(d) - 36) / (WELL_R - 36)));
      el.style.transform = `scale(${Math.min(fit, curve).toFixed(3)})`;
      el.style.opacity = (0.2 + 0.8 * near * near).toFixed(3);
      el.style.zIndex = String(Math.round(near * 10));
    }
  }, [size]);
  const settle = React.useCallback(() => {
    const d = drum.current;
    if (d.frame) return;
    d.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0.001, (now - d.last) / 1000));
      d.last = now;
      const damp = 2 * Math.sqrt(SPRING_K) * SPRING_ZETA;
      const acc = SPRING_K * (d.target - d.pos) - damp * d.vel;
      d.vel += acc * dt;
      d.pos += d.vel * dt;
      if (Math.abs(d.target - d.pos) < 0.2 && Math.abs(d.vel) < 3) {
        d.pos = d.target;
        d.vel = 0;
        d.frame = 0;
        apply();
        return;
      }
      apply();
      d.frame = requestAnimationFrame(step);
    };
    d.frame = requestAnimationFrame(step);
  }, [apply]);
  React.useEffect(() => () => { if (drum.current.frame) cancelAnimationFrame(drum.current.frame); window.clearTimeout(drum.current.timer); }, []);

  /** Choose a part by its place among the parts; the drum rolls there. */
  const choose = React.useCallback((i: number, jump = false) => {
    const n = Math.max(0, Math.min(parts.length - 1, i));
    const d = drum.current;
    d.target = centreOf(parts[n] ?? 0);
    setSel(n);
    if (jump) { d.pos = d.target; d.vel = 0; apply(); return; }
    settle();
  }, [parts, apply, settle]);

  // A new column opens with its first part at the middle and its heading above it.
  React.useLayoutEffect(() => {
    drum.current.acc = 0;
    drum.current.pending = 0;
    choose(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  /*
   * The wheel. A notch is NOTCH pixels of deltaY, so a trackpad's small
   * steps add up to one and a mouse's click is one. The first notch leans
   * the drum — a push, and the spring brings it back. The second, before
   * NOTCH_MS has passed, commits: the next part is chosen and the drum
   * rolls on to it. A flick of many notches commits once per pair.
   */
  React.useEffect(() => {
    const el = well.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const d = drum.current;
      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * size : e.deltaY;
      // A mouse's click of the wheel is one notch whatever size the browser
      // reports it as; a trackpad's small steps add up to one.
      let n: number;
      if (Math.abs(delta) >= NOTCH) {
        n = Math.sign(delta);
        d.acc = 0;
      } else {
        d.acc += delta;
        n = Math.trunc(d.acc / NOTCH);
        if (!n) return;
        d.acc -= n * NOTCH;
      }
      const dir = Math.sign(n);
      if (dir !== d.dir) { d.pending = 0; d.dir = dir; }
      let moved = 0;
      for (let i = 0; i < Math.abs(n); i++) {
        d.pending += 1;
        if (d.pending >= 2) { d.pending = 0; moved += dir; }
      }
      window.clearTimeout(d.timer);
      if (moved) {
        setSel((s) => {
          const next = Math.max(0, Math.min(parts.length - 1, s + moved));
          d.target = centreOf(parts[next] ?? 0);
          if (next !== s) play("tap");
          return next;
        });
        settle();
      }
      if (d.pending) {
        // The lean: a push down the column, and the spring rolls it back.
        d.vel += dir * NUDGE;
        settle();
        d.timer = window.setTimeout(() => { d.pending = 0; }, NOTCH_MS);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [parts, settle, size]);

  /* ---------------------------------------------------------- adding */
  const add = (f: FeatureDef) => {
    const st = useStudio.getState();
    let id: string;
    if (at) {
      // Centred on the spot; the store keeps every new part inside the page.
      const w = Math.min(f.w ?? 420, st.frameWidth);
      const h = f.h ?? 88;
      id = st.addNode(f.id, Math.round(at.x - w / 2), Math.round(at.y - h / 2), { w, h });
      play("confirm");
    } else {
      id = addFeatureToCanvas(f.id);
    }
    ctx.publish({ key: `studio:add:${id}`, title: `Added ${f.name}`, body: at ? "Where the wheel was opened." : "At the bottom of the page.", level: "success", source: "studio", toast: true });
    onDone();
  };
  const chosen = rows[parts[sel] ?? -1];
  const addChosen = () => { if (chosen?.kind === "part") add(chosen.feature); };

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
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); choose(sel + (e.key === "ArrowDown" ? 1 : -1)); }
        if (e.key === "Enter" && !(e.target as HTMLElement).closest("input")) { e.preventDefault(); addChosen(); }
      }}
    >
      {/* the disc, in dark matter: the same weather the workspace stands on,
          clipped round and moved rather than redrawn (`ground.ts`). */}
      <div
        ref={face}
        data-add-surface=""
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
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
      >
        <div ref={clouds} data-ground-clouds="" className="absolute inset-0" />
        <canvas ref={embers} data-ground-sparks="" className="absolute left-0 top-0" />
      </div>

      {/* the hole: the parts roll down the middle of it, on the drum */}
      <div
        ref={well}
        data-add-scroll=""
        role="listbox"
        aria-label={searching ? "Parts found" : `${CATEGORIES.find((c) => c.id === category)?.label ?? "Parts"} parts`}
        aria-activedescendant={chosen?.kind === "part" ? `add-part-${chosen.id}` : undefined}
        // `clip`, not `hidden`: a hidden overflow is still a scroll box, and a
        // part that scrolls itself into view on mount — a chat log, a console
        // — scrolled the whole well with it, and the column sat hundreds of
        // pixels off until the next wheel. A clipped overflow cannot scroll.
        className="absolute inset-0 overflow-clip"
        style={{ clipPath: `circle(${WELL_R}px at 50% 50%)` }}
      >
        <div ref={column} className="absolute left-0 top-0 flex w-full flex-col items-center will-change-transform" style={{ gap: GAP }}>
          {rows.map((row, i) =>
            row.kind === "head" ? (
              <div
                key={`h-${row.id}`}
                data-roll=""
                data-add-head={row.id}
                className="pointer-events-none select-none font-mono text-[9px] font-semibold uppercase"
                style={{ color: SCREEN.ink, letterSpacing: 1.8, textShadow: `0 0 6px ${SCREEN.line}`, willChange: "transform, opacity" }}
              >
                {row.label}
              </div>
            ) : (
              <Part
                key={row.id}
                feature={row.feature}
                chosen={parts[sel] === i}
                onPress={() => { if (parts[sel] === i) add(row.feature); else choose(parts.indexOf(i)); }}
              />
            ),
          )}
        </div>
      </div>

      {/* the search: a short bar in the top cap, no more */}
      <div className="absolute" style={{ top: 22, left: 116, width: 120 }}>
        <Input
          inputSize="sm"
          data-add-search=""
          value={query}
          aria-label="Search the parts"
          placeholder="Search"
          className="h-[22px] rounded-full border-[oklch(0.36_0.06_290)] bg-[oklch(0.1_0.03_300)] px-2.5 text-center font-mono text-[10px] text-[oklch(0.88_0.09_175)] placeholder:text-[oklch(0.5_0.03_285)]"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              if (query) setQuery(""); else (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Enter") { e.preventDefault(); addChosen(); }
          }}
        />
      </div>

      {/* the categories: tabs round the left of the rim, in their own colours */}
      <div role="tablist" aria-label="Categories" aria-orientation="vertical">
        {CATEGORIES.map((c, i) => {
          const on = !searching && c.id === category;
          const Mark = planetOf(c.id);
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
                width: on ? 30 : 24,
                height: on ? 30 : 24,
                zIndex: on ? 2 : 1,
                ...key,
                boxShadow: on
                  ? `0 0 0 2px oklch(0.99 0 0), 0 0 0 4px oklch(0.05 0.02 290), 0 0 12px ${String(key.background).replace(")", " / 0.6)")}, 0 2px 6px oklch(0 0 0 / 0.6)`
                  : "0 0 0 2px oklch(0.05 0.02 290), 0 2px 6px oklch(0 0 0 / 0.6)",
                filter: on || searching ? undefined : "saturate(0.9) brightness(0.92)",
              }}
            >
              <Mark size={on ? 17 : 14} />
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

/** One part in the column: drawn as itself, its name under it. A press on the chosen one adds it; on another, rolls to it. */
function Part({ feature, chosen, onPress }: { feature: FeatureDef; chosen: boolean; onPress: () => void }) {
  const natural = previewHeight(feature, COLUMN_W);
  const shrink = Math.min(1, TALL / Math.max(1, natural));
  const width = Math.max(110, Math.round(COLUMN_W * shrink));
  const height = Math.max(40, Math.round(natural * shrink));
  return (
    /*
       A div, not a button.

       A part is drawn as itself — the preview is the real component, and a
       real card, tab bar or form has buttons in it. A button inside a button
       is not HTML: the browser closes the outer one where the inner one
       starts, so what the server sends and what the browser builds are
       different trees, and React calls that a hydration error. The library
       hit the same wall and answered it the same way (`Palette.tsx`).

       Nothing is lost. `role="option"` is what this should have carried
       anyway inside a listbox, and the keys never came from being a button
       in the first place: the disc holds the focus and works the column with
       the arrows and Enter (`aria-activedescendant` above), which is the
       listbox pattern. What is left is the press.
    */
    <div
      role="option"
      tabIndex={-1}
      id={`add-part-${feature.id}`}
      aria-selected={chosen}
      data-roll=""
      data-add-item={feature.id}
      data-add-chosen={chosen ? "" : undefined}
      title={chosen ? `Add ${feature.name}` : feature.explain ?? feature.blurb}
      onClick={onPress}
      className="group/part flex cursor-pointer flex-col items-center gap-1.5 rounded-md outline-none"
      style={{ width: COLUMN_W, willChange: "transform, opacity" }}
    >
      <span
        className="block overflow-hidden rounded-[7px] transition-[box-shadow] duration-200 group-hover/part:shadow-[0_0_0_2px_oklch(0.72_0.16_205),0_0_18px_oklch(0.72_0.16_205/0.45)]"
        style={{
          width,
          height,
          boxShadow: chosen
            ? "0 0 0 1.5px oklch(0.72 0.16 205 / 0.9), 0 0 22px oklch(0.72 0.16 205 / 0.35), 0 8px 24px oklch(0 0 0 / 0.6)"
            : `0 0 0 1px ${CONSOLE.rim}, 0 6px 18px oklch(0 0 0 / 0.55)`,
        }}
      >
        <PartPreview feature={feature} width={width} height={height} />
      </span>
      <span className="line-clamp-1 text-[11px] font-semibold leading-tight" style={{ color: chosen ? "oklch(0.85 0.12 205)" : CONSOLE.text, textShadow: "0 1px 3px oklch(0 0 0 / 0.85)" }}>
        {feature.name}
      </span>
    </div>
  );
}
