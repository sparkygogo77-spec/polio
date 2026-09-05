"use client";
/**
 * Pictures, video, sound and maps. Until Stage 4's uploads exist these draw
 * seeded placeholders — but the behaviour (opening, sliding, playing) is real.
 */
import * as React from "react";
import { Fill, Placeholder, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items } from "./theme";
import { opt, type PartProps } from "./types";

const swatch = (t: { accent: string; muted: string }, i: number) =>
  `linear-gradient(${140 + i * 24}deg, ${t.accent}${i % 2 ? "33" : "22"}, ${t.muted}1f)`;

/** Grids of images; clicking one opens it full size inside the part. */
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
            style={{ width: j === i ? 18 : 8, height: 8, borderRadius: 999, border: "none", cursor: "pointer", background: j === i ? t.accent : `${t.muted}88`, transition: "width 200ms" }}
          />
        ))}
      </div>
    </Fill>
  );
}

/** Drag the handle; the split follows the pointer at any scale. */
export function BeforeAfter({ id, content, theme: t }: PartProps) {
  const labels = items(content, ["Before", "After"]);
  const [pct, setPct] = React.useState(50);
  const ref = React.useRef<HTMLDivElement>(null);
  const set = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPct(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <Fill t={t} data-part={id} style={{ position: "relative", borderRadius: t.radius, overflow: "hidden", border: `1px solid ${t.line}` }}>
      <div
        ref={ref}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(e.clientX); }}
        onPointerMove={(e) => e.buttons === 1 && set(e.clientX)}
        style={{ position: "absolute", inset: 0, cursor: "ew-resize", background: swatch(t, 1) }}
      >
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: swatch(t, 4), overflow: "hidden" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, background: t.accent }}>
          <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: 999, background: t.surface, border: `2px solid ${t.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.text }}>⇔</span>
        </div>
        <span style={{ position: "absolute", left: 10, bottom: 10, color: t.text, fontSize: t.fontPx * 0.8, background: `${t.surface}cc`, padding: "2px 8px", borderRadius: 999 }}>{labels[0]}</span>
        <span style={{ position: "absolute", right: 10, bottom: 10, color: t.text, fontSize: t.fontPx * 0.8, background: `${t.surface}cc`, padding: "2px 8px", borderRadius: 999 }}>{labels[1]}</span>
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
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: i === current && playing ? t.accent : `${t.accent}33`, color: i === current && playing ? t.accentText : t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
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
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: `${t.muted}55`, overflow: "hidden" }}>
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
      <div style={{ position: "absolute", inset: 0, background: id === "map-embed" ? `linear-gradient(${t.muted}22 1px, transparent 1px) 0 0 / ${24 * zoom}px ${24 * zoom}px, linear-gradient(90deg, ${t.muted}22 1px, transparent 1px) 0 0 / ${24 * zoom}px ${24 * zoom}px, ${t.bg}` : swatch(t, 3), display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.85, transition: "background-size 200ms" }}>
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
