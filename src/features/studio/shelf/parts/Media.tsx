"use client";
/**
 * Pictures, video, sound and maps. Until Stage 4's uploads exist these draw
 * seeded placeholders — but the behaviour (opening, sliding, playing) is real.
 */
import * as React from "react";
import { Fill, Placeholder, PictureSlot, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, standIn, withAlpha, tint } from "./theme";
import { num, opt, type PartProps } from "./types";
import { isWorld, WorldLayer } from "./World";

/**
 * The stand-in every picture-shaped hole wears until it has a picture.
 *
 * AND THE REASON THEY WERE GREY, WHICH IS NOT THE REASON ANYBODY THOUGHT.
 *
 * This built its colours by sticking a hex alpha on the end of the theme's
 * own: `${tint(t.accent, 0.2)}`. The theme's colours are `oklch(...)`, so that made
 * `oklch(0.7 0.1 150)33` \u2014 not a colour \u2014 and one bad colour in a
 * `background` shorthand throws the whole declaration away. Measured on a
 * gallery cell: `background-image: none`. Those cells were not painting a
 * faint gradient that read as grey; they were painting nothing at all, and
 * had been for as long as the theme has been in oklch.
 *
 * So the alpha goes through `withAlpha`, which knows both spellings, and on
 * top of it sits a crop of the one picture in the repository \u2014 a different
 * part of the same field for each slot, so a gallery reads as a gallery of
 * photographs rather than as six tinted boxes.
 */
const swatch = (t: { accent: string; muted: string }, i: number) => {
  const crop = standIn(`swatch-${i}`);
  return `${crop.backgroundImage} ${crop.backgroundPosition} / cover no-repeat, linear-gradient(${140 + i * 24}deg, ${withAlpha(t.accent, i % 2 ? 0.2 : 0.13)}, ${withAlpha(t.muted, 0.12)})`;
};

/** Grids of images; clicking one opens it full size inside the part. */
/**
 * One picture, at its own size.
 *
 * What Import's "shrink in" lands as. The picture rides on `node.texture`,
 * which `blocks.tsx` has already turned into `theme.surfacePaint` — so
 * there is nothing to fetch here and no second copy of the bytes: this
 * paints what the part is already wearing, edge to edge, and gets out of
 * the way. Without a renderer of its own the part fell through to the
 * dashed `Unknown` card, which paints the flat surface colour and drops
 * `surfacePaint` on the floor: a part carrying a picture, showing none.
 */
export function Picture({ id, label, theme: t, picture, media, world, mode, w, h }: PartProps) {
  /*
   * A captured video plays as the page's did: live (Preview and the
   * published page) a <video> of its source with its picture as the
   * poster, controls and autoplay as recorded; one that autoplayed plays
   * muted, looped and inline, as browsers allow autoplay. The board keeps
   * the picture. `tests/video-part.mjs`.
   */
  if (media?.kind === "video" && (media.local || media.src) && mode === "live") {
    const auto = !!media.autoplay;
    return (
      <Fill t={t} data-part={id} data-part-video="" style={{ padding: 0, overflow: "hidden", borderRadius: t.radius }}>
        <video
          src={media.local ?? media.src}
          poster={picture?.src ?? media.poster}
          controls={!!media.controls}
          autoPlay={auto}
          loop={!!media.loop}
          muted={auto || !!media.muted}
          playsInline={auto || !!media.playsinline}
          preload={auto ? "auto" : "none"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Fill>
    );
  }
  /*
   * A picture the node holds as a file (`node.picture`, the way the split
   * hero and the product page hold theirs) is drawn through `PictureSlot`,
   * the same as they draw it. It used to be ignored here: the part read
   * only the texture it might be wearing, so a carried image showed the
   * stand-in crop with the file's name on a plate, and his logo was missing
   * from the top of his own page.
   */
  /*
   * A captured canvas world: its flipbook, and over it, live, a press area
   * that follows each character and the dialog it opens (`parts/World.tsx`,
   * the `world-dialogs` feature, `tests/world-dialogs.mjs`). The board keeps
   * the picture alone.
   */
  if (picture?.pic && picture.src && mode === "live" && isWorld(world)) {
    return (
      <Fill t={t} data-part={id} data-part-picture="" data-part-worldhost="" style={{ padding: 0, overflow: "hidden", borderRadius: t.radius, position: "relative" }}>
        <PictureSlot t={t} pic={picture.pic} src={picture.src} label={label || "Picture"} mode={mode} />
        <WorldLayer world={world} part={`${id}-${hash(JSON.stringify(world.chars))}`} w={picture.pic.w ?? w} h={picture.pic.h ?? h} offsite={t.offsite} />
      </Fill>
    );
  }
  if (picture?.pic) {
    /* A see-through picture (its background cleared) stands on the page itself: no floor, no lit face, no corners behind it. */
    const clear = !!picture.pic.seeThrough;
    return (
      <Fill t={clear ? { ...t, sheen: undefined } : t} data-part={id} data-part-picture="" data-see-through={clear ? "" : undefined} style={{ padding: 0, overflow: "hidden", borderRadius: clear ? 0 : t.radius, ...(clear ? { background: "transparent" } : null) }}>
        <PictureSlot t={t} pic={picture.pic} src={picture.src} label={label || "Picture"} mode={mode} />
      </Fill>
    );
  }
  const painted = !!t.surfacePaint;
  return (
    <Fill
      t={t}
      data-part={id}
      data-part-picture={painted ? "" : undefined}
      style={{
        padding: 0, overflow: "hidden", borderRadius: t.radius,
        ...(painted ? t.surfacePaint : { ...standIn(id), display: "grid", placeItems: "center" }),
      }}
    >
      {painted ? null : (
        /* A name over the crop, on a plate, so it is readable whatever part
           of the field this one landed on. */
        <span style={{ color: t.text, fontSize: t.fontPx * 0.9, fontFamily: t.bodyFamily, background: withAlpha(t.surface, 0.72), padding: "2px 10px", borderRadius: 999, backdropFilter: "blur(4px)" }}>{label || "Picture"}</span>
      )}
    </Fill>
  );
}

export function Gallery({ id, content, options, theme: t, mode, w }: PartProps) {
  const n = Math.max(1, Math.min(6, Number(opt(options, "columns", "3")) || 3));
  const captions = items(content, []);
  const count = Math.max(captions.length, n * 2);
  const [open, setOpen] = React.useState<number | null>(null);
  const cols = w < 520 ? Math.min(2, n) : n;

  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: t.fontPx * 0.6, overflow: "auto" }}>
      {Array.from({ length: count }, (_, i) => (
        <figure key={i} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4, minHeight: 0 }}>
          <button
            type="button"
            aria-label={captions[i] ? `Open ${captions[i]}` : `Open image ${i + 1}`}
            onClick={() => setOpen(i)}
            style={{ flex: 1, minHeight: 40, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 10), background: swatch(t, i), cursor: "pointer", padding: 0 }}
          />
          {captions[i] || id === "photo-credit" ? (
            <figcaption style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{captions[i] ?? `Photo ${i + 1} · credit`}</figcaption>
          ) : null}
        </figure>
      ))}
      {open !== null && mode === "live" ? (
        <div
          role="dialog"
          aria-label="Image viewer"
          onClick={() => setOpen(null)}
          style={{ position: "absolute", inset: 0, zIndex: 20, background: "oklch(0 0 0 / .72)", display: "flex", alignItems: "center", justifyContent: "center", padding: t.fontPx, cursor: "zoom-out" }}
        >
          <div style={{ width: "80%", height: "80%", borderRadius: t.radius, background: swatch(t, open), border: `1px solid ${t.line}` }} />
          <button type="button" aria-label="Close" onClick={() => setOpen(null)} style={{ position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: "white", font: "inherit", fontSize: t.fontPx * 1.2, cursor: "pointer" }}>✕</button>
        </div>
      ) : null}
    </Fill>
  );
}

/** A slideshow that advances, with dots and optional autoplay. */
export function Carousel({ id, content, options, theme: t, mode }: PartProps) {
  const slides = items(content, ["Slide one", "Slide two", "Slide three"]);
  const [i, setI] = React.useState(0);
  const auto = opt(options, "autoplay", "no") === "yes";
  useTicker(mode, 2500, () => setI((v) => (v + 1) % slides.length), auto);
  const go = (d: number) => setI((v) => (v + d + slides.length) % slides.length);
  const nav = (label: string, d: number, side: "left" | "right"): React.ReactNode => (
    <button
      type="button"
      aria-label={label}
      onClick={() => go(d)}
      style={{ position: "absolute", top: "50%", [side]: 10, transform: "translateY(-50%)", width: 32, height: 32, borderRadius: 999, border: `1px solid ${t.line}`, background: t.surface, color: t.text, cursor: "pointer", font: "inherit" }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
  return (
    <Fill t={t} data-part={id} style={{ position: "relative", borderRadius: t.radius, overflow: "hidden", border: `1px solid ${t.line}` }}>
      <div style={{ position: "absolute", inset: 0, background: swatch(t, i), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.headingFamily, fontWeight: 700, fontSize: t.fontPx * 1.4, color: t.text, transition: "background 400ms ease" }}>
        {slides[i]}
      </div>
      {nav("Previous slide", -1, "left")}
      {nav("Next slide", 1, "right")}
      <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
        {slides.map((s, j) => (
          <button
            key={s + j}
            type="button"
            aria-label={`Go to slide ${j + 1}`}
            aria-current={j === i ? "true" : undefined}
            onClick={() => setI(j)}
            style={{ width: j === i ? 18 : 8, height: 8, borderRadius: 999, border: "none", cursor: "pointer", background: j === i ? t.accent : `${tint(t.muted, 0.533)}`, transition: "width 200ms" }}
          />
        ))}
      </div>
    </Fill>
  );
}

/**
 * Drag the handle; the split follows the pointer at any scale.
 *
 * Both pictures are the same scene at full size in the same place: the
 * after underneath, the before (the same picture, washed out) on top. The
 * handle only cuts the before off at its line (`clip-path`), so dragging
 * reveals it and nothing stretches (J, 2026-10-10). Before, the top layer's
 * width followed the handle and its `cover` picture was scaled to fit it.
 * The published page has no React: the `compare` feature drives the same
 * markup there (`data-compare-*`, `works.ts#PART_SCRIPT`); here the box is
 * marked as driven by this part so that script leaves it be.
 */
export function BeforeAfter({ id, content, theme: t }: PartProps) {
  const labels = items(content, ["Before", "After"]);
  const [pct, setPct] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current as (HTMLDivElement & { __compareOwned?: boolean }) | null;
    if (el) el.__compareOwned = true;
  }, []);
  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPct(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5;
    const to = e.key === "ArrowLeft" || e.key === "ArrowDown" ? pct - step : e.key === "ArrowRight" || e.key === "ArrowUp" ? pct + step : e.key === "Home" ? 0 : e.key === "End" ? 100 : null;
    if (to === null) return;
    e.preventDefault();
    setPct(Math.max(0, Math.min(100, to)));
  };
  const cut = `inset(0 ${100 - pct}% 0 0)`;
  const scene = swatch(t, 1);
  return (
    <Fill t={t} data-part={id} style={{ position: "relative", borderRadius: t.radius, overflow: "hidden", border: `1px solid ${t.line}` }}>
      <div
        ref={ref}
        data-compare=""
        role="slider"
        tabIndex={0}
        aria-label="Before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        onKeyDown={key}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); set(e.clientX); }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        style={{ position: "absolute", inset: 0, cursor: "ew-resize", touchAction: "pan-y", userSelect: "none" }}
      >
        <div data-compare-after="" style={{ position: "absolute", inset: 0, background: scene }} />
        <div data-compare-before="" style={{ position: "absolute", inset: 0, background: scene, filter: "grayscale(1) sepia(0.35) brightness(0.85)", clipPath: cut, WebkitClipPath: cut }} />
        <div data-compare-line="" style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, marginLeft: -1, background: t.accent, pointerEvents: "none" }}>
          <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: 999, background: t.surface, border: `2px solid ${t.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.text }}>⇔</span>
        </div>
        <span style={{ position: "absolute", left: 10, bottom: 10, color: t.text, fontSize: t.fontPx * 0.8, background: `${tint(t.surface, 0.8)}`, padding: "2px 8px", borderRadius: 999, pointerEvents: "none" }}>{labels[0]}</span>
        <span style={{ position: "absolute", right: 10, bottom: 10, color: t.text, fontSize: t.fontPx * 0.8, background: `${tint(t.surface, 0.8)}`, padding: "2px 8px", borderRadius: 999, pointerEvents: "none" }}>{labels[1]}</span>
      </div>
    </Fill>
  );
}

/** Video, audio and episode lists, with a transport that runs. */
export function Player({ id, content, theme: t, mode }: PartProps) {
  const [playing, setPlaying] = React.useState(false);
  const [pos, setPos] = React.useState(0);
  useTicker(mode, 250, () => setPos((p) => (p + 0.6) % 100), playing);

  if (id === "podcast") {
    const eps = items(content, ["Episode one", "Episode two", "Episode three"]);
    const [current, setCurrent] = React.useState(0);
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
        {eps.map((e, i) => (
          <button key={e + i} type="button" aria-current={i === current ? "true" : undefined} onClick={() => { setCurrent(i); setPlaying(true); }} style={{ ...cardStyle(t), display: "flex", alignItems: "center", gap: 10, padding: t.fontPx * 0.6, cursor: "pointer", color: t.text, font: "inherit", textAlign: "left", borderColor: i === current ? t.accent : t.line }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: i === current && playing ? t.accent : `${tint(t.accent, 0.2)}`, color: i === current && playing ? t.accentText : t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              {i === current && playing ? "❚❚" : "▶"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>{e}</span>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{sample.int(rng(hash(e)), 12, 58)} min</span>
          </button>
        ))}
      </Fill>
    );
  }

  const audio = id === "audio-player";
  return (
    <Fill
      t={t}
      data-part={id}
      style={{ ...cardStyle(t), background: audio ? t.surface : swatch(t, 2), display: "flex", flexDirection: audio ? "row" : "column", alignItems: audio ? "center" : "stretch", justifyContent: "center", gap: t.fontPx * 0.6, padding: audio ? t.fontPx * 0.7 : 0, overflow: "hidden" }}
    >
      {audio ? null : <div style={{ flex: 1 }} />}
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
        onClick={() => setPlaying((p) => !p)}
        style={{ alignSelf: "center", width: audio ? 34 : 56, height: audio ? 34 : 56, borderRadius: 999, border: "none", cursor: "pointer", background: t.accent, color: t.accentText, fontSize: audio ? 12 : 18 }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div style={{ flex: audio ? 1 : undefined, display: "flex", alignItems: "center", gap: 8, padding: audio ? 0 : `0 ${t.fontPx}px ${t.fontPx}px` }}>
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: `${tint(t.muted, 0.333)}`, overflow: "hidden" }}>
          <div style={{ width: `${pos}%`, height: "100%", background: t.accent }} />
        </div>
        <span className="num" style={{ color: audio ? t.muted : t.text, fontSize: t.fontPx * 0.75 }}>{String(Math.floor(pos / 10)).padStart(2, "0")}:{String(Math.floor(pos) % 60).padStart(2, "0")}</span>
      </div>
    </Fill>
  );
}

/** Maps and 3D: a frame with real controls, art to come from Stage 4. */
export function Viewer({ id, content, theme: t }: PartProps) {
  const [zoom, setZoom] = React.useState(1);
  const label = items(content, [id === "map-embed" ? "Map" : "3D model"])[0]!;
  return (
    <Fill t={t} data-part={id} style={{ position: "relative", borderRadius: t.radius, overflow: "hidden", border: `1px solid ${t.line}` }}>
      <div style={{ position: "absolute", inset: 0, background: id === "map-embed" ? `linear-gradient(${tint(t.muted, 0.133)} 1px, transparent 1px) 0 0 / ${24 * zoom}px ${24 * zoom}px, linear-gradient(90deg, ${tint(t.muted, 0.133)} 1px, transparent 1px) 0 0 / ${24 * zoom}px ${24 * zoom}px, ${t.bg}` : swatch(t, 3), display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.85, transition: "background-size 200ms" }}>
        {id === "map-embed" ? <span style={{ color: t.accent, fontSize: t.fontPx * 1.6 }}>◉</span> : <span style={{ transform: `scale(${zoom})`, transition: "transform 200ms" }}>{label}</span>}
      </div>
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {[["Zoom in", 0.2], ["Zoom out", -0.2]].map(([l, d]) => (
          <button key={l as string} type="button" aria-label={l as string} onClick={() => setZoom((z) => Math.max(0.6, Math.min(2.2, z + (d as number))))} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${t.line}`, background: t.surface, color: t.text, cursor: "pointer", font: "inherit" }}>
            {(d as number) > 0 ? "+" : "−"}
          </button>
        ))}
      </div>
    </Fill>
  );
}

/** A row of faces, overlapping. */
export function AvatarStack({ id, content, theme: t }: PartProps) {
  const names = items(content, sample.people(5, id).map((p) => p.name));
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}>
      {names.slice(0, 6).map((n, i) => (
        <span
          key={n + i}
          title={n}
          style={{
            width: t.fontPx * 2.2, height: t.fontPx * 2.2, borderRadius: 999, marginLeft: i ? -t.fontPx * 0.7 : 0,
            background: swatch(t, i), border: `2px solid ${t.bg}`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: t.fontPx * 0.7, fontWeight: 700, color: t.text,
          }}
        >
          {n.split(" ").map((x) => x[0]).join("").slice(0, 2)}
        </span>
      ))}
      <span style={{ marginLeft: t.fontPx * 0.6, color: t.muted, fontSize: t.fontPx * 0.85 }}>+{sample.int(rng(hash(id)), 8, 120)}</span>
    </Fill>
  );
}

/** Generated artwork: a deterministic pattern from the content as seed. */
export function Art({ id, content, theme: t, w, h }: PartProps) {
  const r = rng(hash(id + content));
  const shapes = Array.from({ length: 14 }, () => ({ x: r() * 100, y: r() * 100, s: 4 + r() * 22, o: 0.15 + r() * 0.5, round: r() > 0.5 }));
  return (
    <Fill t={t} data-part={id} style={{ borderRadius: t.radius, overflow: "hidden", border: `1px solid ${t.line}`, background: t.bg, position: "relative" }}>
      <svg width="100%" height="100%" viewBox={`0 0 100 ${Math.max(20, (h / Math.max(1, w)) * 100)}`} preserveAspectRatio="none" aria-label="Generated artwork">
        {shapes.map((s, i) =>
          s.round ? (
            <circle key={i} cx={s.x} cy={s.y} r={s.s / 2} fill={t.accent} opacity={s.o} />
          ) : (
            <rect key={i} x={s.x} y={s.y} width={s.s} height={s.s} fill={t.muted} opacity={s.o * 0.7} />
          ),
        )}
      </svg>
    </Fill>
  );
}

/**
 * A light off the edge of the page.
 *
 * A dark page with nothing behind it is flat, and the usual fix — a gradient
 * across the whole background — makes it look like a gradient. What a room
 * actually does is put a lamp somewhere out of frame and let one corner
 * carry more colour than the rest. So this is one wide disc of colour,
 * blurred far past its own size, sitting in a corner and mostly outside the
 * box; and a second, fainter one opposite, because a single light reads as a
 * mistake and two read as a room.
 *
 * It draws nothing that can be clicked and nothing that can be read: it is
 * the ground the rest of the page stands on, so it takes no pointer events
 * and no space in the reading order.
 */
export function CornerGlow({ id, options, theme: t }: PartProps) {
  const hue = num(options, "hue", 96, 0, 360);
  const reach = num(options, "reach", 46, 10, 100) / 100;
  const strength = num(options, "strength", 22, 0, 100) / 100;
  const corner = opt(options, "corner", "top right");
  const second = opt(options, "second", "opposite");

  const at = (which: string): { x: string; y: string } =>
    which === "top left" ? { x: "-8%", y: "-14%" }
      : which === "bottom left" ? { x: "-12%", y: "82%" }
        : which === "bottom right" ? { x: "88%", y: "84%" }
          : which === "middle" ? { x: "50%", y: "50%" }
            : { x: "88%", y: "-14%" };
  const opposite: Record<string, string> = { "top right": "bottom left", "top left": "bottom right", "bottom left": "top right", "bottom right": "top left", middle: "top right" };
  const beside: Record<string, string> = { "top right": "bottom right", "top left": "bottom left", "bottom left": "top left", "bottom right": "top right", middle: "bottom right" };

  const discs = [{ where: corner, h: hue, a: strength }];
  // A long step short of the complement: a green light pairs with a blue one
  // the way a room does, where the true complement reads as a fault.
  if (second !== "none") discs.push({ where: (second === "opposite" ? opposite : beside)[corner] ?? "bottom left", h: (hue + 145) % 360, a: strength * 0.85 });

  return (
    <Fill t={t} data-part={id} style={{ pointerEvents: "none" }} aria-hidden>
      {discs.map((d, i) => {
        const pos = at(d.where);
        return (
          <span
            key={i}
            style={{
              position: "absolute", left: pos.x, top: pos.y,
              width: `${Math.round(reach * 100)}%`, aspectRatio: "1 / 1",
              transform: d.where === "middle" ? "translate(-50%, -50%)" : undefined,
              borderRadius: "50%",
              background: `hsl(${d.h} 95% 55% / ${d.a})`,
              filter: `blur(${Math.round(60 + reach * 120)}px)`,
            }}
          />
        );
      })}
    </Fill>
  );
}
