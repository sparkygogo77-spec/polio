"use client";
/**
 * The editors the background's wheel opens.
 *
 * The page's background gets a copy of the part's wheel — the same seven
 * pieces, about the page instead of a part — and these are what its green
 * choices open on the console: the page's colour off the spectrum, the
 * texture layers that land on it, a veil that dims the whole page, the fill
 * the format paints under everything, and the page's own words. Each is
 * built from the same console pieces the part editors use, so the two
 * wheels are one object with two subjects.
 */
import * as React from "react";
import { Blend, Eraser, Grid2x2, ImagePlus, Lightbulb, Link2, Maximize2, Monitor, Smartphone, Square, Sun, Tablet, Waves, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Textarea } from "@/core/ui/textarea";
import { readImage } from "./ImageIntake";
import { lands, newLayer, parseColor, textureCss, TEXTURE_KINDS, type TextureLayer } from "./look";
import { useStudio, type StudioPage } from "./store";
import { resolvePalette } from "./parts/theme";
import {
  ArcChips, ArcSlider, Caption, CONSOLE, GridChips, Glued, keyOf, ScreenFace, SectorButton, SHRINK, type ArcItem, type Slab,
} from "./RingConsole";
import { centreOf, chipsAt, runOf, SpectrumSlab, stackedRuns, wholeOf } from "./RingEditors";
import { piece } from "./menuGeometry";
import { PlateQuad, SCREEN, SCREEN_FIELD } from "./PlateEditors";

/** The fills the format paints under the page, as keys on a screen, each in its own colour. */
const FILLS: ArcItem[] = [
  { id: "flat", label: "Flat color", style: keyOf(4), glyph: <Square className="size-3" /> },
  { id: "subtle gradient", label: "Soft gradient", style: keyOf(5), glyph: <Blend className="size-3" /> },
  { id: "grid", label: "Fine grid", style: keyOf(6), glyph: <Grid2x2 className="size-3" /> },
  { id: "mesh gradient", label: "Mesh gradient", style: keyOf(7), glyph: <Waves className="size-3" /> },
];
/** One run on a slab: the two radii it lives between. */
type Band = { rIn: number; rOut: number };

/** How dark the veil can go. Past this the page is gone. */
const VEIL_MAX = 0.85;

export function BackgroundEditor({ which, slabs, page }: { which: string; slabs: Slab[]; page: StudioPage }) {
  const look = useStudio((st) => st.look);
  const format = useStudio((st) => st.format);
  const recent = useStudio((st) => st.recentColours);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = useStudio.getState;
  const [a, b, c] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid } = a.rings;
  const file = React.useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------- the color */
  // One editor, three slabs, none empty: the page's colour off the
  // spectrum; the fill as keys with the recent colours and "from the
  // accent" on the band inside them; the veil as a slider.
  if (which === "bg-color") {
    const override = look.palette.bg;
    const col = parseColor(palette.bg) ?? { l: 0.15, c: 0.02, h: 265 };
    // "From the accent" takes the override away: the key goes, rather than
    // staying with nothing in it — a role set to undefined was read as a
    // colour and trimmed, and that took the whole page down.
    const set = (next: string | null) => {
      const { bg: _was, ...rest } = look.palette;
      void _was;
      s().setLook({ palette: next ? { ...rest, bg: next } : rest });
    };
    const swatches: ArcItem[] = [
      { id: "", label: "From the accent", style: { background: CONSOLE.well }, glyph: <X className="size-3" style={{ color: CONSOLE.text }} /> },
      ...recent.slice(0, 5).map((r): ArcItem => ({ id: r, label: `Recent colour ${r}`, style: { background: r } })),
    ];
    const fill = String(format["palette.background"] ?? "flat");
    const v = look.veil ?? 0;
    return (
      <>
        <SpectrumSlab
          slab={a}
          colour={col}
          onChange={(next) => set(next)}
          onCommit={() => { const cur = s().look.palette.bg; if (cur) s().rememberColour(cur); }}
          caption="Page color"
        />
        <ScreenFace slab={b} />
        <ArcChips slab={b} tone="screen" items={FILLS} radius={chipsAt(b)} size={24} value={fill} onPick={(id) => s().setFormat("palette.background", id)} />
        <ArcChips slab={b} tone="screen" items={swatches} radius={hole + 26} size={16} value={override ?? ""} onPick={(id) => set(id || null)} />
        <Caption slab={b}>{`Fill · ${FILLS.find((f) => f.id === fill)?.label ?? fill}`}</Caption>
        <ScreenFace slab={c} />
        <ArcSlider
          slab={c}
          tone="screen"
          from={c.from}
          to={c.to}
          rIn={mid - 6}
          rOut={mid + 12}
          label="Veil"
          value={v / VEIL_MAX}
         
          onChange={(f) => s().setLook({ veil: Math.round(f * VEIL_MAX * 100) / 100 })}
        />
        <Caption slab={c}>{`Veil · ${v > 0.005 ? `${Math.round(v * 100)}%` : "none"}`}</Caption>
      </>
    );
  }

  /* ------------------------------------------------------- the width */
  // How the page is built: the frame's width as three keys, and beside it
  // the two things the board does to the frame — fit it in view, and show
  // or hide the wires — so no slab is bare.
  if (which === "width") {
    const fw = useStudio.getState().frameWidth;
    const widths: ArcItem[] = [
      { id: "1440", label: "Desktop · 1440", style: keyOf(0), glyph: <Monitor className="size-3" /> },
      { id: "834", label: "Tablet · 834", style: keyOf(1), glyph: <Tablet className="size-3" /> },
      { id: "390", label: "Phone · 390", style: keyOf(2), glyph: <Smartphone className="size-3" /> },
    ];
    const wires = useStudio.getState().showWires;
    return (
      <>
        <ScreenFace slab={a} />
        <ArcChips slab={a} tone="screen" items={widths} radius={chipsAt(a)} size={24} value={String(fw)} onPick={(id) => s().setFrameWidth(Number(id))} />
        <Caption slab={a}>{`Width · ${fw}`}</Caption>
        <SectorButton d={wholeOf(b)} at={centreOf(b, hole, "edge")} spin={b.spin} label="Fit in view" icon={<Maximize2 className="size-3.5" />} onClick={() => s().requestFit()} />
        <SectorButton d={wholeOf(c)} at={centreOf(c, hole, "edge")} spin={c.spin} label={wires ? "Hide the wires" : "Show the wires"} icon={<Link2 className="size-3.5" />} on={wires} onClick={() => s().setShowWires(!wires)} />
      </>
    );
  }

  /* ------------------------------------------------------- the light */
  /*
   * One lamp over the page, and the two decisions worth making about it: where
   * it is, and how hard it is.
   *
   * Where it is is not a pair of numbers anyone can picture, so the big button
   * hands the board over instead — the workspace goes dark but the page, the
   * pointer becomes the light, and you point at the place. The numbers are
   * still here on the other two slabs for the times you want to nudge one.
   *
   * "On the page" is the setting kept deliberately apart from the rest: the
   * lamp throws shadows on its own, and whether any of its light lands on the
   * background is a separate answer, off unless it is asked for.
   */
  if (which === "bg-light") {
    const light = look.light;
    const placing = useStudio.getState().placingLight;
    const setLight = (patch: Partial<typeof light>) => s().setLook({ light: { ...useStudio.getState().look.light, ...patch } });
    const [tall, deep, dark] = stackedRuns(b, 3) as [Band, Band, Band];
    const [warm, onPage] = stackedRuns(c, 2) as [Band, Band];
    const wash = light.wash ?? 0;
    const height = light.height > 0.75 ? "overhead" : light.height > 0.4 ? "at an angle" : "low, raking";
    // Placing turns the lamp on: pointing at a place is asking for one.
    const placeD = piece(a.from, a.to, mid, "edge", a.shape, a.rings, SHRINK);
    const lampD = piece(a.from, a.to, hole, mid, a.shape, a.rings, SHRINK);
    return (
      <>
        <SectorButton
          d={placeD}
          at={centreOf(a, mid, "edge")}
          spin={a.spin}
          label="Place the light"
          icon={<Sun className="size-3.5" />}
          on={placing}
          onClick={() => useStudio.getState().setPlacingLight(true)}
        />
        <SectorButton
          d={lampD}
          at={centreOf(a, hole, mid)}
          spin={a.spin}
          label={light.on ? "Lamp on" : "Lamp off"}
          icon={<Lightbulb className="size-3.5" />}
          on={light.on}
          onClick={() => setLight({ on: !light.on })}
        />

        <ScreenFace slab={b} />
        <ArcSlider slab={b} tone="screen" {...runOf(b)} {...tall} label="How high it hangs"
          value={light.height} onChange={(f) => setLight({ height: f })} />
        <ArcSlider slab={b} tone="screen" {...runOf(b)} {...deep} label="How far things stand off"
          value={light.lift / 40} onChange={(f) => setLight({ lift: Math.round(f * 40) })} />
        <ArcSlider slab={b} tone="screen" {...runOf(b)} {...dark} label="Shadow strength"
          value={light.strength} onChange={(f) => setLight({ strength: f })} />
        <Caption slab={b}>{`${height} · ${light.lift}px · ${Math.round(light.strength * 100)}%`}</Caption>

        <ScreenFace slab={c} />
        <ArcSlider slab={c} tone="screen" {...runOf(c)} {...warm} label="Warmth"
          value={(((light.warmth % 360) + 360) % 360) / 360}
          colourAt={(f) => `oklch(0.86 0.13 ${Math.round(f * 360)})`}
          onChange={(f) => setLight({ warmth: Math.round(f * 360) })} />
        <ArcSlider slab={c} tone="screen" {...runOf(c)} {...onPage} label="Light on the page"
          value={wash} onChange={(f) => setLight({ wash: f })} />
        <Caption slab={c}>{`Warmth ${Math.round(light.warmth)}° · page ${Math.round(wash * 100)}%`}</Caption>
      </>
    );
  }

  /* ----------------------------------------------------- the texture */
  if (which === "bg-texture") {
    const layers = look.texture ?? [];
    const onPage = new Set(layers.filter((l) => l.on && lands(l, "page")).map((l) => l.id));
    const tile = (l: TextureLayer): React.CSSProperties => {
      const css = textureCss([{ ...l, on: true }], palette, palette.bg);
      return { ...css, backgroundSize: css.backgroundSize ?? "cover" };
    };
    const items: ArcItem[] = layers.map((l, i): ArcItem => ({
      id: l.id,
      label: `${TEXTURE_KINDS.find((k) => k.id === l.kind)?.label ?? l.kind} (layer ${i + 1})${lands(l, "page") ? "" : ", on the cards until it is picked"}`,
      style: tile(l),
    }));
    // A pick switches a layer on for the page; picking one that is on
    // switches it off. A layer that only dressed the cards comes to the
    // page as well.
    const toggle = (id: string) =>
      s().setLook({
        texture: layers.map((l) =>
          l.id !== id ? l : l.on && lands(l, "page") ? { ...l, on: false } : { ...l, on: true, target: lands(l, "page") ? l.target : "both" },
        ),
      });
    const take = (src: string) => {
      s().addTexture({ ...newLayer("image"), src, target: "page" });
      play("confirm");
    };
    return (
      <>
        {items.length ? <GridChips slab={a} items={items} value={null} values={onPage} onPick={toggle} /> : null}
        <Caption slab={a}>{items.length ? `${onPage.size} of ${items.length} on the page` : "No layers yet"}</Caption>
        <SectorButton d={wholeOf(b)} at={centreOf(b, hole, "edge")} spin={b.spin} label="Add a picture" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()} />
        <SectorButton
          d={wholeOf(c)}
          at={centreOf(c, hole, "edge")}
          spin={c.spin}
          label="Clear the page"
          icon={<Eraser className="size-3.5" />}
          disabled={!onPage.size}
          onClick={() => s().setLook({ texture: layers.map((l) => (l.on && lands(l, "page") ? { ...l, on: false } : l)) })}
        />
        <Glued at={[0, 0]} spin={0} w={1} h={1}>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Add a picture to the page"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readImage(f).then(take);
              e.target.value = "";
            }}
          />
        </Glued>
      </>
    );
  }

  /* ------------------------------------------------------- the words */
  if (which === "page-words") {
    const plate = slabs.find((sl) => Math.abs(((sl.from % 1) + 1) % 1 - 0.25) < 0.001) ?? a;
    return (
      <PlateQuad slab={plate} title="This page should…" sub={page.name}>
        <Textarea
          rows={6}
          value={page.prompt}
          aria-label="Page prompt"
          className={`min-h-0 w-full flex-1 resize-none text-[10px] leading-snug ${SCREEN_FIELD}`}
          placeholder="e.g. One continuous scroll; nothing is clickable until the reader reaches the bottom."
          onChange={(e) => s().updatePage(page.id, { prompt: e.target.value })}
        />
        <p className="text-[8px]" style={{ color: SCREEN.dim }}>Applies to everything on this page.</p>
      </PlateQuad>
    );
  }

  return null;
}
