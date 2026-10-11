"use client";
/**
 * The orb: one object, three ways to draw it.
 *
 * A dark sphere lit from one side, a couple of orbit rings cutting past it,
 * a glow under it and a small tag beside it. It is the thing a page like
 * this is built around, and it is also the clearest question a builder can
 * ask about its own parts: how far can a shape go before it has to stop
 * being CSS? So it exists three times, with the same four sliders on each —
 * size, tilt, colour, glow — and the same rings and tag, so the difference
 * between them is the drawing and nothing else.
 *
 *   orb-css     a planet drawn by the page on a plain canvas, a pixel at a
 *               time (`library/planetJs.ts`): no library, no GPU. It
 *               turns on its own axis and every way in the hand.
 *   orb-webgl   the same planet in a surface (glass, metal or matte), its
 *               light worked out on the graphics card, as sharp as its box.
 *               Where WebGL is missing it is drawn by the page in the same
 *               light, and the tag says so. It was three.js here and the
 *               plain planet on the published page; now both run the one
 *               script, so the site shows the orb the board does.
 *   orb-image   the same planet with a picture wrapped round it, the way
 *               a map wraps a globe ("Wrap it round" off: the picture laid
 *               flat in the circle, as it was).
 *
 * Board mode is one still frame in all three — no timers, no animation loop
 * — which is the rule every part keeps.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { items, withAlpha, type Theme } from "./theme";
import { num, opt, type PartMode, type PartProps } from "./types";
import { planet } from "../library/planetJs";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** What every orb is told, read off the options once. */
interface OrbSet {
  /** How much of the box the sphere fills, 0..1. */
  size: number;
  /** How far the whole thing leans, in degrees. */
  tilt: number;
  /** The hue of the light on it. */
  hue: number;
  /** How far the glow reaches, 0..1. */
  glow: number;
  rings: number;
  /** The idle turn, when he has left it on. */
  moving: boolean;
  /** Is it in anybody's hands? Only on a live page: the board is one still frame. */
  hands: boolean;
}

function settings(options: Record<string, string>, mode: PartMode, movingId: string): OrbSet {
  const ringWord = opt(options, "rings", "two");
  return {
    size: num(options, "size", 76, 30, 100) / 100,
    tilt: num(options, "tilt", -22, -60, 60),
    hue: num(options, "hue", 96, 0, 360),
    glow: num(options, "glow", 55, 0, 100) / 100,
    rings: ringWord === "none" ? 0 : ringWord === "one" ? 1 : ringWord === "three" ? 3 : 2,
    moving: mode === "live" && opt(options, movingId, "yes") === "yes",
    /*
     * Turning it off is about the idle spin, not about whether he can touch
     * it. With the two tied together, an orb with the spin switched off was
     * inert: no loop, no pointer, nothing. Measured at 0.0% of the sphere
     * moving under a drag right across it.
     */
    hands: mode === "live",
  };
}

/**
 * A colour with an alpha, built here rather than through `withAlpha`: that
 * one reads hex and oklch, and hands anything else back untouched, so an
 * `hsl()` would quietly lose its transparency and every soft edge on the orb
 * would come out solid.
 */
const hsl = (h: number, sat: number, light: number, alpha = 1) => `hsl(${((h % 360) + 360) % 360} ${sat}% ${light}% / ${alpha})`;

/**
 * How far round the wheel the second light sits from the first.
 *
 * Not 180: the true complement of a green is a magenta, and a magenta light
 * on a black sphere reads as a fault rather than as a second lamp. A long
 * step short of it lands on the blue that a green key light is usually
 * paired with, and does the same for any hue it is given.
 */
export const COOL_STEP = 145;

/** The lit side, the cooler light across from it, and the near-black the body is. */
function lights(hue: number) {
  return {
    key: (a = 1) => hsl(hue, 95, 55, a),
    keySoft: (a = 1) => hsl(hue, 95, 66, a),
    cool: (a = 1) => hsl(hue + COOL_STEP, 95, 55, a),
    body: (l: number) => hsl(hue, 16, l),
  };
}

/**
 * The rings: ellipses that cut past the sphere, each on its own lean — and
 * each drawn twice, because an orbit has a near side.
 *
 * Drawn once and behind, a ring is a halo pinned to the back of a flat disc:
 * measured, nought pixels of the sphere's face were ever covered by one, and
 * the ring's two halves came out 803 above the middle against 806 below,
 * which is what a halo looks like and not what an orbit looks like. So the
 * far half goes behind the sphere and the near half goes in front of it, and
 * the seam between them is the screen's own middle.
 *
 * The clip is on a wrapper that does not turn, never on the ellipse itself:
 * "near" means the lower half of what you are looking at, and a ring that
 * leans as it goes round would carry a clip of its own into the top of the
 * frame and be drawn in front up there.
 */
function Rings({ n, tilt, hue, turning, half }: { n: number; tilt: number; hue: number; turning: boolean; half: "far" | "near" }) {
  const c = lights(hue);
  const specs = [
    { w: 88, h: 29, deg: tilt, colour: c.key(0.3), secs: 34 },
    { w: 94, h: 39, deg: tilt + 80, colour: c.cool(0.42), secs: 46 },
    { w: 76, h: 18, deg: tilt - 38, colour: c.keySoft(0.22), secs: 27 },
  ].slice(0, n);
  /* A hair of overlap at the seam, so the two halves meet rather than leave
     a gap where the ellipse is steepest. */
  const clip = half === "near" ? "inset(49.8% -60% -60% -60%)" : "inset(-60% -60% 49.8% -60%)";
  return (
    <span aria-hidden style={{ position: "absolute", inset: 0, clipPath: clip, pointerEvents: "none" }}>
      {specs.map((r, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute", left: "50%", top: "50%", width: `${r.w}%`, height: `${r.h}%`,
            marginLeft: `-${r.w / 2}%`, marginTop: `-${r.h / 2}%`,
            border: `1px solid ${r.colour}`, borderRadius: "50%",
            transform: `rotate(${r.deg}deg)`,
            animation: turning ? `orb-ring-${i} ${r.secs}s linear infinite` : undefined,
          }}
        />
      ))}
      {/* Both halves run the same turn off the same keyframes, so they stay one ring. */}
      {turning && half === "far" ? (
        <style>{specs.map((r, i) => `@keyframes orb-ring-${i}{from{transform:rotate(${r.deg}deg)}to{transform:rotate(${r.deg + 360}deg)}}`).join("")}</style>
      ) : null}
    </span>
  );
}

/** The tag: a small pill low and left of the sphere, the way a label pinned to a photograph sits. */
function Tag({ t, text }: { t: Theme; text: string }) {
  if (!text) return null;
  return (
    <span
      style={{
        position: "absolute", bottom: "10%", left: "4%", zIndex: 4,
        padding: "6px 14px", borderRadius: 999,
        border: `1px solid ${t.line}`, background: withAlpha(t.surface, 0.85),
        color: t.muted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: Math.max(9, t.fontPx * 0.68), letterSpacing: "0.14em", textTransform: "uppercase",
        whiteSpace: "nowrap", backdropFilter: "blur(6px)",
      }}
    >
      {text}
    </span>
  );
}

/** The pool of light the sphere stands in. */
function Glow({ hue, glow, size }: { hue: number; glow: number; size: number }) {
  if (glow <= 0) return null;
  const c = lights(hue);
  return (
    <span
      aria-hidden
      style={{
        position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: `${size * 100 * (1 + glow)}%`, height: `${size * 100 * (1 + glow)}%`, borderRadius: "50%",
        background: `radial-gradient(circle, ${c.key(0.22 * glow)} 0%, ${c.cool(0.14 * glow)} 45%, transparent 70%)`,
        filter: `blur(${Math.round(14 + glow * 46)}px)`,
      }}
    />
  );
}

/** The box all three fill: the tilt, the glow, the rings, the tag, and the sphere in the middle. */
function Stage({
  t, id, s, tag, children,
}: { t: Theme; id: string; s: OrbSet; tag: string; children: React.ReactNode }) {
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", placeItems: "center" }}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", transform: `rotate(${s.tilt * 0.12}deg)` }}>
        <Glow hue={s.hue} glow={s.glow} size={s.size} />
        <Rings n={s.rings} tilt={s.tilt} hue={s.hue} turning={s.moving} half="far" />
      </div>
      <div style={{ position: "relative", zIndex: 2, width: `${s.size * 100}%`, aspectRatio: "1 / 1", maxHeight: "100%" }}>{children}</div>
      {/* The near half of every ring, over the sphere: the half that is in front of it. */}
      <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", transform: `rotate(${s.tilt * 0.12}deg)` }}>
        <Rings n={s.rings} tilt={s.tilt} hue={s.hue} turning={s.moving} half="near" />
      </div>
      <Tag t={t} text={tag} />
    </Fill>
  );
}

/* ------------------------------------------------------------------ */
/* The planet: all three orbs, turnable                                */
/* ------------------------------------------------------------------ */

/**
 * A ball that turns every way (J, 2026-10-10: "rotate every degree and be
 * draggable like a sphere to see all sides, like a planet"). Drawn by
 * `library/planetJs.ts`, the same lines the published page and a
 * builder-ready site run: its settings ride on `data-planet-*` and its
 * picture on a hidden `<img>`, so the page exported from this one still has
 * them once React is gone. On the board it is one still frame, out of
 * anyone's hands, as every part is there.
 *
 * A `surface` (the turnable orb's glass, metal or matte) rides the same way,
 * and the script draws it on the graphics card; `onFlat` hears when it could
 * not, and the page drew it instead.
 */
function PlanetBall({ s, src, onFail, recolour, surface, onFlat }: { s: OrbSet; src?: string | null; onFail?: () => void; recolour?: boolean; surface?: string; onFlat?: () => void }) {
  const host = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    const p = planet(el);
    if (surface && p && !p.gl) onFlat?.();
    return () => p?.stop();
  }, [s.hue, s.tilt, s.moving, s.hands, src, surface, onFlat]);
  return (
    <div
      ref={host}
      data-planet=""
      data-planet-hue={Math.round(s.hue)}
      data-planet-tilt={Math.round(s.tilt)}
      data-planet-spin={s.moving ? "yes" : "no"}
      data-planet-hands={s.hands ? "yes" : "no"}
      data-planet-surface={surface || undefined}
      style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 28px 56px rgba(0,0,0,0.6)", filter: recolour ? `hue-rotate(${Math.round(s.hue - 96)}deg) saturate(1.15)` : undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a part ships without next/image */}
      {src ? <img data-planet-picture="" src={src} alt="" onError={onFail} style={{ display: "none" }} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A picture, laid flat                                                */
/* ------------------------------------------------------------------ */

/**
 * The first thing in `content` that looks like a picture is the picture; the
 * rest is the tag. Nothing is fetched to find out whether it exists — the
 * image says so itself, and until it does, the drawn orb stands in its
 * place, so an empty part is never an empty box.
 */
function PictureBall({ s, src, recolour, onFail }: { s: OrbSet; src: string; recolour: boolean; onFail: () => void }) {
  const c = lights(s.hue);
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", animation: s.moving ? "orb-float 7s ease-in-out infinite" : undefined }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a part ships without next/image */}
      <img
        src={src}
        alt=""
        onError={onFail}
        style={{
          width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block",
          filter: recolour ? `hue-rotate(${Math.round(s.hue - 96)}deg) saturate(1.15)` : undefined,
        }}
      />
      {/* the rings and the glow are drawn round it; this is the light the picture cannot be told about */}
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 50% 50%, transparent 66%, ${c.key(0.5 * s.glow)} 92%, transparent 100%)`, mixBlendMode: "screen", pointerEvents: "none" }} />
      {s.moving ? <style>{"@keyframes orb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5%)}}"}</style> : null}
    </div>
  );
}

/** Is this word a picture? A path or an address ending in an image extension, or a data URL. */
function pictureOf(words: string[]): { src: string | null; tag: string } {
  const at = words.findIndex((w) => /^data:image\//i.test(w) || /^(https?:\/\/|\/)\S+\.(png|jpe?g|webp|avif|gif|svg)(\?\S*)?$/i.test(w));
  if (at < 0) return { src: null, tag: words.join(", ") };
  return { src: words[at]!, tag: words.filter((_, i) => i !== at).join(", ") };
}

/* ------------------------------------------------------------------ */
/* The part                                                            */
/* ------------------------------------------------------------------ */

export function Orb({ id, content, options, theme: t, mode }: PartProps) {
  const s = settings(options, mode, id === "orb-image" ? "float" : "spin");
  const [failed, setFailed] = React.useState(false);
  const fail = React.useCallback(() => setFailed(true), []);
  const words = items(content, ["The signal is live"]);

  if (id === "orb-image") {
    const { src, tag } = pictureOf(words);
    return (
      <Stage t={t} id={id} s={s} tag={tag || "The signal is live"}>
        {src && !failed && opt(options, "wrap", "yes") === "no" ? <PictureBall s={s} src={src} recolour={opt(options, "recolour", "no") === "yes"} onFail={fail} /> : <PlanetBall s={s} src={src && !failed ? src : null} onFail={fail} recolour={!!src && opt(options, "recolour", "no") === "yes"} />}
      </Stage>
    );
  }

  if (id === "orb-webgl") {
    /* The published page runs this same ball (the planet feature reads `data-planet-surface`), so what the board shows is what the site shows. */
    return (
      <Stage t={t} id={id} s={s} tag={failed ? "Drawn, no WebGL here" : words.join(", ")}>
        <PlanetBall s={s} surface={opt(options, "surface", "glass")} onFlat={fail} />
      </Stage>
    );
  }

  return (
    <Stage t={t} id={id} s={s} tag={words.join(", ")}>
      <PlanetBall s={s} />
    </Stage>
  );
}
