"use client";
/**
 * Small building blocks parts are made of. No Radix, no core imports — see
 * types.ts for why.
 */
import * as React from "react";
import type { PartMode } from "./types";
import { radiusFor, withAlpha, type Theme } from "./theme";
import { FILM_STRETCH } from "./film";
/* Kept here too for what already reads them from this file. */
export { FILM_STRETCH, filmPic } from "./film";

/** Fills the part's box and sets the type. `overflow` is visible for parts that open things. */
export function Fill({
  t, children, style, overflow = "hidden", ref, ...rest
}: { t: Theme; children: React.ReactNode; style?: React.CSSProperties; overflow?: "hidden" | "visible"; ref?: React.Ref<HTMLDivElement> } & Omit<React.HTMLAttributes<HTMLDivElement>, "style">) {
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        width: "100%", height: "100%",
        /*
         * A BOX THAT HOLDS WORDS IS NEVER SHORTER THAN ITS WORDS.
         *
         * `height: 100%` alone made the part exactly as tall as the box it
         * was given, and a captured box carries the height the page it came
         * from measured on somebody else's machine. When the words needed
         * more — they wrapped, or the face resolved wider — they were cut
         * off or pushed under, invisible. His words: the geometry is a
         * starting size, never a ceiling.
         *
         * Where the box is laid out as a column (the board's parts and the
         * live page's, which set `min-height` rather than `height` now),
         * this grows past it and never shrinks below it. Where it is not —
         * a preview, a card, a part inside another part — the parent has a
         * definite height, `height: 100%` resolves against it exactly as it
         * always did, and `flex` says nothing at all.
         */
        flex: "1 0 auto",
        overflow, boxSizing: "border-box", position: "relative",
        color: t.text, fontFamily: t.bodyFamily, fontSize: t.fontPx, lineHeight: t.lineHeight,
        fontWeight: t.fontWeight, letterSpacing: t.letterSpacing,
        // The part's own background if it was given one, otherwise the floor
        // that keeps a page texture behind the site rather than through it.
        // Either way a part that paints its own box (see `cardStyle`) wins,
        // because its `style` lands after this one.
        background: t.ownBackground ?? t.partGround,
        ...style,
      }}
    >
      {/*
        THE LIT FACE, and why it is here.
        
        "Warmth" on the light panel was dead, measured: moving it end to end
        changed 0% of the pixels on a card and 0% on a call-to-action
        button, which was the one and only thing in the app that painted
        `t.sheen` at all. A control whose whole effect is the hue of a wash
        nothing paints is a control that does nothing.
        
        So the wash is painted where a person is looking: over the part, on
        the side turned toward the lamp, under whatever the part draws. It
        is a layer of its own rather than a background, because a part that
        paints its own box would cover a background and most of them do.
        Nothing when there is no lamp, and it never takes a pointer.
      */}
      {t.sheen ? <span aria-hidden data-lit-face="" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: t.sheen, borderRadius: "inherit" }} /> : null}
      {children}
    </div>
  );
}

export function Btn({
  t, label, primary = true, shape, onClick, style, ...rest
}: { t: Theme; label: React.ReactNode; primary?: boolean; shape?: string; onClick?: () => void; style?: React.CSSProperties } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style" | "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", cursor: "pointer",
        padding: `${Math.round(t.fontPx * 0.55)}px ${Math.round(t.fontPx * 1.1)}px`,
        fontSize: t.fontPx * 0.92, fontWeight: 600, fontFamily: t.bodyFamily, lineHeight: 1.2,
        borderRadius: radiusFor(shape, t) || Math.min(t.radius, 12),
        // The secondary button is where the highlight role lives. It used to
        // be a transparent box with a hairline, which meant `highlight` was
        // set on eight parts out of seventy and changing it on the other
        // sixty-two did nothing you could see.
        background: primary ? (t.sheen ? `${t.sheen}, ${t.accent}` : t.accent) : withAlpha(t.highlight, 0.18),
        color: primary ? t.accentText : t.text,
        border: primary ? "1px solid transparent" : `1px solid ${withAlpha(t.highlight, 0.85)}`,
        // Under a light a button is a thing standing on the page, not a
        // rectangle printed on it.
        ...(t.shadow ? { boxShadow: t.shadow } : {}),
        ...style,
      }}
    >
      {label}
    </button>
  );
}

/**
 * The empty slot a part leaves for something it does not have.
 *
 * The label on it is a note to whoever is building — "visual", "video",
 * "view 2" — and it is for the board only. It went out on his published
 * site: the word `visual` was in the delivered HTML, once, where a picture
 * should have been. A word like that is the Builder talking to itself in
 * front of a visitor, so live mode draws the slot and says nothing in it.
 */
export function Placeholder({ t, label, mode = "board" }: { t: Theme; label?: string; mode?: PartMode }) {
  return (
    <div
      style={{
        width: "100%", height: "100%", minHeight: 24, borderRadius: Math.min(t.radius, 10),
        background: `linear-gradient(140deg, ${withAlpha(t.accent, 0.17)}, ${withAlpha(t.highlight, 0.13)})`,
        border: `1px solid ${t.line}`,
        display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.75,
      }}
    >
      {mode === "board" ? label : null}
    </div>
  );
}

/**
 * The picture a part holds, or the reason there is not one.
 *
 * Three states and all of them are said out loud:
 *
 *  - IT IS HERE. The bytes are in this browser's file storage while the site
 *    is being built, and at the path the publish put them at once it has
 *    been published. Either way an `<img>` points at it and nothing is
 *    inlined into the document.
 *  - IT IS GONE. The part holds a reference and this browser no longer has
 *    the bytes — cleared site data, a private window, another machine. It
 *    says the picture needs adding again. It does not draw a hole and hope.
 *  - THERE IS NONE YET. The empty slot, as before: named on the board for
 *    whoever is building, silent on the live site.
 *
 * `src` is what the caller worked out: a browser address while the work is
 * happening, or a path relative to the page once published. Undefined means
 * the bytes could not be found.
 */
export function PictureSlot({ t, pic, src, label, mode = "board", box }: {
  t: Theme;
  pic?: { alt?: string; w?: number; h?: number; pixelated?: boolean; seeThrough?: boolean; depths?: { bands: number; band: number } | null; moving?: { kind: string; pinned?: boolean } | null } | null;
  src?: string;
  label?: string;
  mode?: PartMode;
  /** The part's own box, where the caller knows it: a film is held back when stretched far past its frames. */
  box?: { w: number; h: number };
}) {
  /*
   * A FILM IS NEVER STRETCHED FAR PAST THE FRAMES IT WAS FILMED AT. thesolface's
   * hero was filmed at 512×320 and laid over its 1440×991 part, 2.8 times its
   * size: a blurry copy of the whole hero over the board, which J could not
   * find (2026-10-21). Past 1.5 times its frames either way a film draws
   * nothing, and the part it was filmed over shows through (tests/film-stretch.mjs).
   */
  if (pic?.moving && (pic.moving.pinned || (box && pic.w && pic.h && (box.w > pic.w * FILM_STRETCH + 0.5 || box.h > pic.h * FILM_STRETCH + 0.5)))) return null;
  if (pic && src && pic.depths && pic.depths.bands > 1) {
    /*
     * A STRIP OF DEPTHS (`Picture.depths`): the picture is `bands` stills one
     * under another, each what a canvas pinned to the window showed at that
     * depth of the page. Drawn at the part's width and its own height, cut by
     * the part's box: the top band where the box is one band tall (the board,
     * the Preview as the page opens), the whole strip where the board has
     * stretched the layer over the page. The `scroll-depths` effect slides it
     * to the band for where the scroll is.
     */
    return (
      <div data-picture-depths={pic.depths.bands} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
        <img
          src={src}
          alt={pic.alt ?? ""}
          data-depth-strip=""
          style={{ width: "100%", height: "auto", display: "block", ...(pic.pixelated ? { imageRendering: "pixelated" as const } : {}) }}
        />
      </div>
    );
  }
  if (pic && src && pic.moving) {
    /*
     * THE FRAMES OF A MOVING PART (`Picture.moving`): the flipbook the
     * capture took of it, laid over the part edge to edge, no frame, no
     * corner, stretched to the layer's box, which is the part's own. A loop
     * plays itself here; the `moving-frames` feature takes a pointer's or a
     * scroll's run over on the page (it finds the picture by its mark).
     */
    return (
      <img
        src={src}
        alt={pic.alt ?? ""}
        data-moving-frames={pic.moving.kind}
        style={{ width: "100%", height: "100%", display: "block", objectFit: "fill", ...(pic.pixelated ? { imageRendering: "pixelated" as const } : {}) }}
      />
    );
  }
  if (pic && src) {
    /* A captured picture draws only the edge the capture recorded, which the
       box round the part draws; the line here is a default for a picture
       placed by hand, and on a captured one it outlined the SolWorks logo
       (`tests/published-site.mjs`). */
    return (
      <img
        src={src}
        alt={pic.alt ?? ""}
        /* A see-through picture wears no frame: the line round it was drawn
           over the picture's own edge, a pale rule along the top of a card
           whose background had been cleared, that no "How close" could reach. */
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: pic.seeThrough ? 0 : Math.min(t.radius, 10), border: t.captured || pic.seeThrough ? "none" : `1px solid ${t.line}`, ...(pic.pixelated ? { imageRendering: "pixelated" as const } : {}) }}
      />
    );
  }
  if (pic && !src) {
    return (
      <div
        data-picture-lost=""
        style={{
          width: "100%", height: "100%", minHeight: 24, borderRadius: Math.min(t.radius, 10),
          border: `1px dashed ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 12, textAlign: "center", color: t.muted, fontSize: t.fontPx * 0.75, lineHeight: 1.35,
        }}
      >
        This picture is not in this browser any more. Add it again to put it back.
      </div>
    );
  }
  return <Placeholder t={t} label={label} mode={mode} />;
}

/** A repeating timer that only runs in live mode. */
export function useTicker(mode: PartMode, ms: number, tick: () => void, enabled = true) {
  const ref = React.useRef(tick);
  ref.current = tick;
  React.useEffect(() => {
    if (mode !== "live" || !enabled) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [mode, ms, enabled]);
}

/** Shared focus ring that reads on any theme. */
export function focusRing(t: Theme): string {
  return `0 0 0 2px ${t.bg}, 0 0 0 4px ${t.accent}`;
}
