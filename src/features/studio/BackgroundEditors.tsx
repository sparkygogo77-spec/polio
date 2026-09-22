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
import { Blend, Eraser, Grid2x2, ImagePlus, Lightbulb, Square, Sun, Waves } from "lucide-react";
import { play } from "@/core/audio/engine";
import { Textarea } from "@/core/ui/textarea";
import { Input } from "@/core/ui/input";
import { readPicture, refusal } from "./ImageIntake";
import { lands, newLayer, parseColor, textureCss, TEXTURE_KINDS, type TextureLayer } from "./look";
import { useStudio, type StudioPage } from "./store";
import { resolvePalette } from "./parts/theme";
import {
  ArcChips, ArcSlider, Caption, CONSOLE, GridChips, Glued, keyOf, ScreenFace, SectorButton, SHRINK, type ArcItem, type Slab,
} from "./RingConsole";
import { inheritChip } from "./colourMenu";
import { centreOf, chipsAt, runOf, SpectrumSlab, stackedRuns, wholeOf } from "./RingEditors";
import { carryLight } from "./LightPlacer";
import { middleOf, piece } from "./menuGeometry";
import { PlateQuad, SCREEN, SCREEN_FIELD } from "./PlateEditors";

/** The fills the format paints under the page, as keys on a screen, each in its own colour. */
const FILLS: ArcItem[] = [
  { id: "flat", label: "Flat color", style: keyOf(4), glyph: <Square className="size-3" /> },
  { id: "subtle gradient", label: "Soft gradient", style: keyOf(5), glyph: <Blend className="size-3" /> },
  { id: "grid", label: "Fine grid", style: keyOf(6), glyph: <Grid2x2 className="size-3" /> },
  { id: "mesh gradient", label: "Mesh gradient", style: keyOf(7), glyph: <Waves className="size-3" /> },
];
/**
 * The light editor.
 *
 * A component of its own rather than a branch, because it has something to do
 * on the way in and on the way out: opening it arms the moment — the board
 * dims, the light comes up on its button — and closing it puts the board back
 * without touching the lamp.
 */
function LightEditor({ a, b, c }: { a: Slab; b: Slab; c: Slab }) {
  const light = useStudio((st) => st.look.light);
  const placing = useStudio((st) => st.placingLight);
  const s = useStudio.getState;
  const { hole, mid } = a.rings;
  const set = (patch: Partial<typeof light>) => s().setLook({ light: { ...s().look.light, ...patch } });

  React.useEffect(() => {
    s().setPlacingLight(true);
    return () => { if (useStudio.getState().placingLight) useStudio.getState().setPlacingLight(false); };
  }, [s]);

  // Two runs a slab, not three. Three fit on a square box and are slivers on a
  // round one, and the wheel is for the decisions you make while looking at the
  // page — where the lamp is, how hard it is, what colour, and whether any of
  // it lands on the background. How far things stand off is a number you set
  // once; it stays in the panel.
  const [dark, tall] = stackedRuns(b, 2, 16) as [Band, Band];
  const [warm, onPage] = stackedRuns(c, 2, 16) as [Band, Band];
  const wash = light.wash ?? 0;
  // Short: a caption bent round a quadrant's inner arc holds about thirteen
  // letters, and past that the two slabs' captions run into each other across
  // the middle of the wheel. The square layout names each band beside it, so
  // the caption only ever has to carry the numbers.
  const height = light.height > 0.75 ? "overhead" : light.height > 0.4 ? "angled" : "raking";
  const placeD = piece(a.from, a.to, mid, "edge", a.shape, a.rings, SHRINK);
  const lampD = piece(a.from, a.to, hole, mid, a.shape, a.rings, SHRINK);

  return (
    <>
      <SectorButton
        d={placeD}
        at={middleOf(a.from, a.to, mid, "edge", a.shape, a.rings, 0.42)}
        spin={a.spin} shape={a.shape}
        label="Drag the sun"
        icon={<Sun className="size-4" />}
        on={placing}
        hue={70}
        onClick={() => useStudio.getState().setPlacingLight(true)}
        onGrab={carryLight}
      />
      <SectorButton
        d={lampD}
        at={centreOf(a, hole, mid)}
        spin={a.spin} shape={a.shape}
        label={light.on ? "Lamp on" : "Lamp off"}
        icon={<Lightbulb className="size-3.5" />}
        on={light.on}
        onClick={() => set({ on: !light.on })}
      />

      <ArcSlider slab={b} {...runOf(b)} {...dark} name="Shadows" label="Shadow strength"
        value={light.strength} onChange={(f) => set({ strength: f })} />
      <ArcSlider slab={b} {...runOf(b)} {...tall} name="Height" label="How high it hangs"
        value={light.height} onChange={(f) => set({ height: f })} />
      <Caption slab={b}>{`${Math.round(light.strength * 100)}% · ${height}`}</Caption>

      <ArcSlider slab={c} {...runOf(c)} {...warm} name="Warmth" label="Warmth"
        value={(((light.warmth % 360) + 360) % 360) / 360}
        colourAt={(f) => `oklch(0.86 0.13 ${Math.round(f * 360)})`}
        onChange={(f) => set({ warmth: Math.round(f * 360) })} />
      <ArcSlider slab={c} {...runOf(c)} {...onPage} name="On the page" label="Light on the page"
        value={wash} onChange={(f) => set({ wash: f })} />
      <Caption slab={c}>{`${Math.round(light.warmth)}° · page ${Math.round(wash * 100)}%`}</Caption>
    </>
  );
}

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
  /* What the last picture door said on the caption: a refusal, or a note on what was kept. */
  const [said, setSaid] = React.useState<string | null>(null);

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
      // Not empty: the page has this background, derived rather than set.
      inheritChip("From the accent", palette.bg),
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
        <ArcChips slab={b} tone="screen" items={FILLS} radius={chipsAt(b)} value={fill} onPick={(id) => s().setFormat("palette.background", id)} />
        <ArcChips slab={b} tone="screen" items={swatches} radius={hole + 26} value={override ?? ""} onPick={(id) => set(id || null)} />
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

  /* ------------------------------------------------------- the light */
  /*
   * One lamp over the page, and the two decisions worth making about it: where
   * it is, and how hard it is.
   *
   * Where it is is not a pair of numbers anyone can picture, so opening this
   * dims the board everywhere but the page and puts the light on its button,
   * lit, waiting to be picked up. Drag it out and drop it where it goes. The
   * numbers are still here on the other two slabs, each band with its own word
   * beside it, for the times you want to nudge one.
   *
   * No screen on these slabs. The glass is for a slab you type on; under three
   * bars it is a teal rectangle behind a control that has nothing to do with
   * it, and the bars stop reading as bars.
   *
   * "On the page" is the setting kept deliberately apart from the rest: the
   * lamp throws shadows on its own, and whether any of its light lands on the
   * background is a separate answer, off unless it is asked for.
   */
  if (which === "bg-light") {
    return <LightEditor a={a} b={b} c={c} />;
  }

  /* ------------------------------------------------------- the glide */
  /*
   * How the page's texture moves, which is one number per layer.
   *
   * `drift` carries a tile a whole number of tiles along its own angle each
   * cycle, so the loop has no seam in it however long you watch. The stack
   * has always been able to do it; nothing on the wheel drove it, and the
   * button that should have was showing "Motion asset (soon)".
   *
   * One slider for the speed, and a still end on it rather than a separate
   * switch: nought IS still, and a control whose zero means the thing it
   * says does not need an off beside it. Layers that only dress the cards
   * are left alone — this is the page's own weather.
   *
   * Why this is safe to turn on now, recorded because it was held back once:
   * euler measured the idle cost and the law is "carry less translucent area,
   * not less motion" — a ground alone, however much of it moves, dropped no
   * frames at all; it is translucent layers stacked over a moving surface
   * that cost. A drift on the page's own texture is motion over area that is
   * already painted, which is the cheap half of that finding.
   */
  if (which === "bg-glide") {
    const layers = look.texture ?? [];
    const onPage = layers.filter((l) => l.on && lands(l, "page"));
    const speed = onPage.length
      ? onPage.reduce((m, l) => m + (l.drift ?? 0), 0) / onPage.length
      : 0;
    const setDrift = (v: number) =>
      s().setLook({
        texture: layers.map((l) => (l.on && lands(l, "page") ? { ...l, drift: Number(v.toFixed(2)) } : l)),
      });
    if (!onPage.length) {
      return (
        <>
          <Caption slab={a}>Nothing is painted on the page yet — Looks › Texture puts something there to move.</Caption>
        </>
      );
    }
    return (
      <>
        <ArcSlider
          slab={a}
          {...runOf(a)}
          rIn={hole}
          rOut={mid}
          name="Glide"
          label="How fast the texture drifts"
          value={Math.max(0, Math.min(1, speed))}
          onChange={setDrift}
        />
        <Caption slab={a}>
          {speed < 0.01
            ? `Still · ${onPage.length} layer${onPage.length === 1 ? "" : "s"} on the page`
            : `${Math.round(speed * 100)}% · ${onPage.length} layer${onPage.length === 1 ? "" : "s"} on the page`}
        </Caption>
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
    const take = (src: string, note?: string) => {
      setSaid(note ?? null);
      s().addTexture({ ...newLayer("image"), src, target: "page" });
      play("confirm");
    };
    return (
      <>
        {items.length ? <GridChips slab={a} items={items} value={null} values={onPage} onPick={toggle} /> : null}
        <Caption slab={a}>{said ? said : items.length ? `${onPage.size} of ${items.length} on the page` : "No layers yet"}</Caption>
        <SectorButton d={wholeOf(b)} at={centreOf(b, hole, "edge")} spin={b.spin} shape={b.shape} label="Add a picture" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()} />
        <SectorButton
          d={wholeOf(c)}
          at={centreOf(c, hole, "edge")}
          spin={c.spin} shape={c.shape}
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
              if (f) void readPicture(f).then((p) => take(p.src, p.note)).catch((err: unknown) => { play("deny"); setSaid(refusal(err)); });
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
          className={`min-h-0 w-full flex-1 resize-none text-small leading-snug ${SCREEN_FIELD}`}
          placeholder="e.g. One continuous scroll; nothing is clickable until the reader reaches the bottom."
          onChange={(e) => s().updatePage(page.id, { prompt: e.target.value })}
        />
        <p className="text-[8px]" style={{ color: SCREEN.dim }}>Applies to everything on this page.</p>
      </PlateQuad>
    );
  }

  /* ------------------------------------------------- what it is called */
  if (which === "page-name") {
    const plate = slabs.find((sl) => Math.abs(((sl.from % 1) + 1) % 1 - 0.25) < 0.001) ?? a;
    return (
      <PlateQuad slab={plate} title="What this page is called" sub={page.path}>
        <Input
          value={page.name}
          aria-label="Page name"
          className={`w-full text-plain ${SCREEN_FIELD}`}
          onChange={(e) => s().updatePage(page.id, { name: e.target.value })}
        />
        <p className="text-[8px]" style={{ color: SCREEN.dim }}>The name on its tab, and what the builder calls it.</p>
      </PlateQuad>
    );
  }

  /* ------------------------------------------------------ where it lives */
  if (which === "page-path") {
    const plate = slabs.find((sl) => Math.abs(((sl.from % 1) + 1) % 1 - 0.25) < 0.001) ?? a;
    return (
      <PlateQuad slab={plate} title="Where it lives" sub={page.name}>
        <Input
          value={page.path}
          aria-label="Page address"
          className={`w-full text-plain ${SCREEN_FIELD}`}
          placeholder="/"
          onChange={(e) => {
            // A path is one thing or it is a broken link: leading slash, no
            // spaces, and whatever a person types made into that rather than
            // refused.
            const raw = e.target.value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9/-]/g, "");
            s().updatePage(page.id, { path: raw.startsWith("/") ? raw : `/${raw}` });
          }}
        />
        <p className="text-[8px]" style={{ color: SCREEN.dim }}>The address on the live site.</p>
      </PlateQuad>
    );
  }

  return null;
}
