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
 *   orb-css     layered gradients in a round box. No canvas, no download,
 *               renders anywhere including in a screenshot with no GPU.
 *               The light is painted, so it cannot move round the sphere.
 *   orb-webgl   a real sphere in three.js. It turns, and the key light
 *               follows the pointer, because the light is a light. Needs a
 *               GPU context and the library, and falls back to the drawn
 *               orb when either is missing.
 *   orb-image   a picture, with the rings, the glow and the tag drawn round
 *               it. Whatever a renderer can make, this can show; nothing
 *               about it responds to anything.
 *
 * Board mode is one still frame in all three — no timers, no animation loop
 * — which is the rule every part keeps.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { items, withAlpha, type Theme } from "./theme";
import { num, opt, type PartMode, type PartProps } from "./types";

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
  moving: boolean;
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

/** The rings: ellipses that cut past the sphere, each on its own lean. */
function Rings({ n, tilt, hue, turning }: { n: number; tilt: number; hue: number; turning: boolean }) {
  const c = lights(hue);
  const specs = [
    { w: 88, h: 29, deg: tilt, colour: c.key(0.3), secs: 34 },
    { w: 94, h: 39, deg: tilt + 80, colour: c.cool(0.42), secs: 46 },
    { w: 76, h: 18, deg: tilt - 38, colour: c.keySoft(0.22), secs: 27 },
  ].slice(0, n);
  return (
    <>
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
      {turning ? (
        <style>{specs.map((r, i) => `@keyframes orb-ring-${i}{from{transform:rotate(${r.deg}deg)}to{transform:rotate(${r.deg + 360}deg)}}`).join("")}</style>
      ) : null}
    </>
  );
}

/** The tag: a small pill low and left of the sphere, the way a label pinned to a photograph sits. */
function Tag({ t, text }: { t: Theme; text: string }) {
  if (!text) return null;
  return (
    <span
      style={{
        position: "absolute", bottom: "10%", left: "4%", zIndex: 3,
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
        <Rings n={s.rings} tilt={s.tilt} hue={s.hue} turning={s.moving} />
      </div>
      <div style={{ position: "relative", zIndex: 2, width: `${s.size * 100}%`, aspectRatio: "1 / 1", maxHeight: "100%" }}>{children}</div>
      <Tag t={t} text={tag} />
    </Fill>
  );
}

/* ------------------------------------------------------------------ */
/* (a) Drawn: layered gradients                                        */
/* ------------------------------------------------------------------ */

/**
 * The sphere, drawn: a dark body, two crescents hugging the rim, a bounce
 * off the underside, one specular, and the far edge falling into the dark.
 *
 * The crescents are the thing to get right, and a plain radial gradient
 * cannot make one: a circle of light on a sphere is a blob, and a blob reads
 * as a stain rather than as a lit edge. Each crescent here is a *conic*
 * gradient — light through one arc of the turn and nothing through the rest
 * — masked to the outer band of the disc, so what is left is a band of
 * colour following the rim through the arc it was given. That is what the
 * WebGL orb gets for free from a reflection, done by hand.
 */
const ARC = { ring: 48, blur: 8, span: 120, mid: 70 };

function DrawnBall({ s, spin }: { s: OrbSet; spin: boolean }) {
  const c = lights(s.hue);
  // The lit arcs sit either side of the sphere, turning with the tilt.
  const from = 30 + s.tilt * 0.5;
  const mask = `radial-gradient(circle at 50% 50%, transparent ${ARC.ring}%, #000 ${ARC.ring + 12}%, #000 100%)`;
  const crescent = (start: number, colour: (a?: number) => string): React.CSSProperties => ({
    position: "absolute", inset: 0, borderRadius: "50%", mixBlendMode: "screen", filter: `blur(${ARC.blur}px)`,
    background: `conic-gradient(from ${start}deg at 50% 50%, transparent 0deg, ${colour(0.15)} 18deg, ${colour(1)} ${ARC.mid}deg, ${colour(0.15)} ${ARC.span}deg, transparent ${ARC.span + 20}deg)`,
    WebkitMaskImage: mask,
    maskImage: mask,
  });
  return (
    <div
      style={{
        position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden",
        background: `radial-gradient(circle at 34% 28%, ${c.body(13)} 0%, ${c.body(6)} 34%, #000 74%)`,
        boxShadow: `inset 0 0 0 1px ${c.key(0.14)}, 0 28px 56px rgba(0,0,0,0.6)`,
        animation: spin ? "orb-float 7s ease-in-out infinite" : undefined,
      }}
    >
      <span style={crescent(from, c.key)} />
      <span style={crescent(from + 150, c.cool)} />
      {/* the bounce: what the two lights leave on the underside */}
      <span
        style={{
          position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.55, filter: "blur(14px)",
          background: `radial-gradient(circle at 62% 74%, ${c.key(0.5)} 0%, transparent 26%), radial-gradient(circle at 34% 70%, ${c.cool(0.45)} 0%, transparent 28%)`,
        }}
      />
      {/* the specular: small, hard, high and left */}
      <span style={{ position: "absolute", left: "17%", top: "11%", width: "30%", height: "19%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.08) 42%, transparent 68%)", filter: "blur(3px)" }} />
      {/* the terminator: the far side falls into the dark */}
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 34% 26%, transparent 34%, rgba(0,0,0,0.5) 100%)" }} />
      {/* the rim: a hair of light right at the edge */}
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", mixBlendMode: "screen", background: `radial-gradient(circle at 50% 50%, transparent 78%, ${c.keySoft(0.18)} 95%, transparent 100%)` }} />
      {spin ? <style>{"@keyframes orb-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5%)}}"}</style> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* (b) WebGL: a real sphere                                            */
/* ------------------------------------------------------------------ */

/**
 * three.js, loaded when the part is first drawn and never during the build:
 * the import is dynamic so the library is a chunk of its own, and a page
 * with no orb on it never pays for it. If the import fails, or the browser
 * gives no WebGL context, the drawn orb takes over and says so in the tag.
 *
 * The sphere is a black mirror and the picture on it is a *reflection*, not
 * a highlight. Point lights were tried first and are the wrong instrument:
 * on a smooth sphere they give three white pinpricks and nothing else, and
 * turning them up only makes the pinpricks bigger and whiter. What makes the
 * long coloured crescents is an environment — two wide coloured lamps and a
 * white slash painted into a canvas, wrapped round the scene — so the orb
 * reflects a room. Moving the pointer turns that room (`environmentRotation`)
 * rather than moving a lamp, which is the same gesture and a truer one: the
 * crescents slide round the sphere the way they do on a real black ball.
 */

/** Where the two lamps hang, in the wrapped picture. Found by sweeping and looking. */
const LAMP = { key: { u: 0.42, v: 0.68 }, cool: { u: 0.17, v: 0.72 }, white: { u: 0.5, v: 0.12 } };

function GlBall({ s, surface, onFail }: { s: OrbSet; surface: string; onFail: () => void }) {
  const host = React.useRef<HTMLDivElement>(null);
  // Where the pointer is, as a fraction of the box: how far the room is turned.
  const aim = React.useRef({ x: 0.5, y: 0.5 });
  const live = s.moving;

  React.useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stop = false;
    let frame = 0;
    let dispose: (() => void) | null = null;

    void (async () => {
      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch {
        if (!stop) onFail();
        return;
      }
      if (stop) return;
      const box = el.getBoundingClientRect();
      const width = Math.max(64, Math.round(box.width));
      const height = Math.max(64, Math.round(box.height));

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        if (!stop) onFail();
        return;
      }
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      // Filmic, so a bright crescent stays its own colour instead of
      // clipping to white the moment it is bright enough to see.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      el.append(renderer.domElement);

      /* The room, painted: two wide lamps in the part's colours and a white slash. */
      const c = lights(s.hue);
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;
      const g2 = canvas.getContext("2d")!;
      g2.fillStyle = "#000";
      g2.fillRect(0, 0, 1024, 512);
      const lamp = (at: { u: number; v: number }, rad: number, colour: string, alpha: number) => {
        const x = at.u * 1024;
        const y = at.v * 512;
        const grad = g2.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, colour);
        grad.addColorStop(0.5, colour);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g2.globalAlpha = alpha;
        g2.fillStyle = grad;
        g2.beginPath();
        g2.arc(x, y, rad, 0, Math.PI * 2);
        g2.fill();
        g2.globalAlpha = 1;
      };
      const reach = 120 + s.glow * 90;
      lamp(LAMP.key, reach, c.key(), 1);
      lamp(LAMP.cool, reach * 1.1, c.cool(), 0.9);
      lamp(LAMP.white, reach * 0.45, "#ffffff", 0.55);
      const env = new THREE.CanvasTexture(canvas);
      env.mapping = THREE.EquirectangularReflectionMapping;
      env.colorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.environment = env;
      scene.environmentIntensity = 1.5 + s.glow;
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.4);

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(1, 128, 128),
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(0x000000),
          roughness: surface === "matte" ? 0.38 : surface === "metal" ? 0.18 : 0.08,
          metalness: 1,
          clearcoat: surface === "glass" ? 1 : 0.3,
          clearcoatRoughness: 0.04,
        }),
      );
      scene.add(ball, new THREE.AmbientLight(0xffffff, 0.03));

      const draw = (t: number) => {
        // The room turns with the pointer; the sphere turns on its own.
        scene.environmentRotation.set(0, (s.tilt * Math.PI) / 180 + (aim.current.x - 0.5) * 2.2, 0);
        ball.rotation.y = t * 0.00012;
        ball.rotation.x = (0.5 - aim.current.y) * 0.5;
        renderer.render(scene, camera);
      };

      if (live) {
        const loop = (t: number) => {
          if (stop) return;
          draw(t);
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      } else {
        // Board mode: one frame, held. No loop, nothing running under a drag.
        draw(2400);
      }

      dispose = () => {
        cancelAnimationFrame(frame);
        env.dispose();
        ball.geometry.dispose();
        (ball.material as import("three").Material).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      stop = true;
      dispose?.();
    };
  }, [s.hue, s.tilt, s.glow, live, surface, onFail]);

  return (
    <div
      ref={host}
      style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", cursor: live ? "crosshair" : undefined }}
      onPointerMove={(e) => {
        if (!live) return;
        const r = e.currentTarget.getBoundingClientRect();
        aim.current = { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) };
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* (c) A picture                                                       */
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
        {src && !failed ? <PictureBall s={s} src={src} recolour={opt(options, "recolour", "no") === "yes"} onFail={fail} /> : <DrawnBall s={s} spin={s.moving} />}
      </Stage>
    );
  }

  if (id === "orb-webgl") {
    return (
      <Stage t={t} id={id} s={s} tag={failed ? "Drawn — no WebGL here" : words.join(", ")}>
        {failed ? <DrawnBall s={s} spin={s.moving} /> : <GlBall s={s} surface={opt(options, "surface", "glass")} onFail={fail} />}
      </Stage>
    );
  }

  return (
    <Stage t={t} id={id} s={s} tag={words.join(", ")}>
      <DrawnBall s={s} spin={s.moving} />
    </Stage>
  );
}
