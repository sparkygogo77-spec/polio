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
import { Blend, Eraser, Grid2x2, ImagePlus, Sparkles, Square, Waves, X } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Textarea } from "@/core/ui/textarea";
import { readImage } from "./ImageIntake";
import { lands, newLayer, parseColor, textureCss, TEXTURE_KINDS, type TextureLayer } from "./look";
import { useStudio, type StudioPage } from "./store";
import { resolvePalette } from "./parts/theme";
import {
  ArcChips, ArcSlider, Caption, CONSOLE, GridChips, Glued, phosphorAt, ScreenFace, SCREEN_KEY, SectorButton, type ArcItem, type Slab,
} from "./RingConsole";
import { centreOf, chipsAt, SpectrumSlab, wholeOf } from "./RingEditors";
import { PlateQuad, SCREEN, SCREEN_FIELD } from "./PlateEditors";

/** The fills the format paints under the page, as keys on a screen. */
const FILLS: ArcItem[] = [
  { id: "flat", label: "Flat colour", style: SCREEN_KEY, glyph: <Square className="size-3" /> },
  { id: "subtle gradient", label: "Soft gradient", style: SCREEN_KEY, glyph: <Blend className="size-3" /> },
  { id: "grid", label: "Fine grid", style: SCREEN_KEY, glyph: <Grid2x2 className="size-3" /> },
  { id: "mesh gradient", label: "Mesh gradient", style: SCREEN_KEY, glyph: <Waves className="size-3" /> },
];
/** How dark the veil can go. Past this the page is gone. */
const VEIL_MAX = 0.85;
const PAD = 0.014;

export function BackgroundEditor({ which, slabs, page }: { which: string; slabs: Slab[]; page: StudioPage }) {
  const look = useStudio((st) => st.look);
  const format = useStudio((st) => st.format);
  const recent = useStudio((st) => st.recentColours);
  const palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  const s = useStudio.getState;
  const [a, b, c] = [slabs[0]!, slabs[1] ?? slabs[0]!, slabs[2] ?? slabs[1] ?? slabs[0]!];
  const { hole, mid } = a.rings;
  const file = React.useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------ the colour */
  if (which === "bg-hue") {
    const override = look.palette.bg;
    const col = parseColor(palette.bg) ?? { l: 0.15, c: 0.02, h: 265 };
    const set = (next: string | null) => s().setLook({ palette: { ...look.palette, bg: next ?? undefined } });
    const items: ArcItem[] = [
      { id: "", label: "Derived from the accent", style: { background: CONSOLE.well }, glyph: <X className="size-3" style={{ color: CONSOLE.text }} /> },
      ...recent.map((r): ArcItem => ({ id: r, label: `Recent colour ${r}`, style: { background: r } })),
    ];
    return (
      <>
        <SpectrumSlab
          slab={a}
          colour={col}
          onChange={(next) => set(next)}
          onCommit={() => { const v = s().look.palette.bg; if (v) s().rememberColour(v); }}
          caption="Page colour"
        />
        <GridChips slab={b} items={items} value={override ?? ""} onPick={(id) => set(id || null)} />
        <SectorButton
          d={wholeOf(c)}
          at={centreOf(c, hole, "edge")}
          spin={c.spin}
          label="From the accent"
          icon={<Sparkles className="size-3.5" />}
          on={!override}
          onClick={() => set(null)}
        />
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

  /* -------------------------------------------------------- the veil */
  if (which === "veil") {
    const v = look.veil ?? 0;
    return (
      <>
        <ScreenFace slab={a} />
        <ScreenFace slab={b} />
        <ScreenFace slab={c} />
        <ArcSlider
          slab={a}
          tone="screen"
          from={a.from + PAD}
          to={a.to - PAD}
          rIn={mid - 6}
          rOut={mid + 12}
          label="Veil"
          value={v / VEIL_MAX}
          colourAt={phosphorAt}
          onChange={(f) => s().setLook({ veil: Math.round(f * VEIL_MAX * 100) / 100 })}
        />
        <Caption slab={a}>{`Veil · ${v > 0.005 ? `${Math.round(v * 100)}%` : "none"}`}</Caption>
      </>
    );
  }

  /* -------------------------------------------------------- the fill */
  if (which === "fill") {
    const fill = String(format["palette.background"] ?? "flat");
    return (
      <>
        <ScreenFace slab={a} />
        <ScreenFace slab={b} />
        <ScreenFace slab={c} />
        <ArcChips slab={a} tone="screen" items={FILLS} radius={chipsAt(a)} size={24} value={fill} onPick={(id) => s().setFormat("palette.background", id)} />
        <Caption slab={a}>{`Fill · ${FILLS.find((f) => f.id === fill)?.label ?? fill}`}</Caption>
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
