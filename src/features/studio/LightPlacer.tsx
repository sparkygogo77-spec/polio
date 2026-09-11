"use client";
/**
 * Carrying the page's lamp out of the menu and dropping it where it goes.
 *
 * A lamp has a place in a room, and the honest way to say where is to point at
 * it. So opening Light dims the board everywhere but the page — that is the
 * whole of the mode, arrived at by opening the tab rather than by pressing
 * anything — and the light sits on its button waiting to be picked up. Drag it
 * out, and it is in your hand: a small warm ball with its own glow, with the
 * page lighting and shadowing under it as it goes. Let go over the page and it
 * is placed; let go anywhere else and the lamp is exactly as it was.
 *
 * The menu stays up the whole time, which is the reason the dim sits *under*
 * it: you have to be able to see the thing you are dragging out of.
 *
 * What this never does is turn the page's own light on. The lamp throws
 * shadows; whether any of it lands on the background is a separate setting,
 * off by default, because a warm pool under a palette someone chose is the
 * fastest way to make that palette look like a mistake.
 */
import * as React from "react";
import { play } from "@/core/audio/engine";
import { aimLight, endLightRig, startLightRig } from "./lightRig";
import { useStudio } from "./store";

interface Rect { x: number; y: number; w: number; h: number }

const rectOf = (sel: string): Rect | null => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

const inside = (r: Rect | null, p: { x: number; y: number }) =>
  !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * Pick the light up.
 *
 * Called from whatever the light is sitting on — the button on the menu — with
 * that button's own pointer event, so the press that starts the drag is the
 * same press that would have been a click. The window is listened to rather
 * than the button, because the hand leaves the button immediately and has to
 * be followed all the way to the page.
 */
export function carryLight(e: React.PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const st = useStudio.getState;
  if (!st().placingLight) st().setPlacingLight(true);
  play("tap");

  /*
   * The board is taken hold of once, here, and let go on the way out.
   *
   * Everything between is `lightRig.ts`: one shadow pass per animation frame,
   * written to each part as a CSS variable, with the geometry measured when
   * the drag began. The store is not touched until the drop, so the page
   * lights under the ball without a single re-render behind it.
   */
  const held = startLightRig();

  const move = (m: PointerEvent) => {
    const p = { x: m.clientX, y: m.clientY };
    // The page lights under the ball as it passes, so what you are choosing is
    // the thing you are looking at rather than a pair of numbers.
    if (held) aimLight(p);
    else st().setLightCarry(p);
  };
  const up = (m: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    const p = { x: m.clientX, y: m.clientY };
    const landed = inside(rectOf("[data-frame]"), p);
    // The one store write of the whole gesture: the variables come off the
    // parts and the lamp goes in, in the same beat, so nothing flickers
    // between the two.
    if (held) { aimLight(p); endLightRig(landed); }
    st().setLightCarry(null);
    if (landed) {
      play("confirm");
      st().setPlacingLight(false);
    } else {
      // Dropped off the page: the lamp goes back, and the light is put back on
      // its button rather than the whole moment ending — it was a miss, not a
      // change of mind.
      play("close");
      const was = st().placedLight;
      if (was) st().setLook({ light: was });
    }
  };
  st().setLightCarry({ x: e.clientX, y: e.clientY });
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

export function LightPlacer() {
  const placing = useStudio((s) => s.placingLight);
  const carry = useStudio((s) => s.lightCarry);
  const light = useStudio((s) => s.look.light);
  const zoom = useStudio((s) => s.zoom);
  const pan = useStudio((s) => s.pan);
  const [page, setPage] = React.useState<Rect | null>(null);
  const [board, setBoard] = React.useState<Rect | null>(null);

  // The page moves under pan and zoom, so it is measured again whenever either
  // changes as well as on the way in.
  React.useEffect(() => {
    if (!placing) return;
    const measure = () => {
      setPage(rectOf("[data-frame]"));
      setBoard(rectOf("[data-studio-scroll]"));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [placing, zoom, pan]);

  React.useEffect(() => {
    if (!placing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      play("close");
      useStudio.getState().cancelPlacingLight();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [placing]);

  if (!placing) return null;
  const warm = Math.round(light.warmth);
  const ball = 14 + light.strength * 10;
  const glow = 30 + light.strength * 46;

  return (
    <>
      {/*
        The dark: the workspace, with the page cut out of it. Clipped to the
        board so the panels and the bars stay lit, under the menu so the light
        can be dragged out of it, and untouchable so a press meant for the
        board is still a press on the board.
      */}
      {board ? (
        <div
          data-light-dim=""
          className="pointer-events-none fixed z-[60] overflow-hidden"
          style={{ left: board.x, top: board.y, width: board.w, height: board.h }}
        >
          <div
            className="absolute rounded-[3px]"
            style={{
              left: (page?.x ?? board.x) - board.x,
              top: (page?.y ?? board.y) - board.y,
              width: page?.w ?? 0,
              height: page?.h ?? 0,
              boxShadow: "0 0 0 9999px oklch(0.05 0.01 280 / 0.86)",
              // A hairline round the hole in the lamp's own colour: on a dark
              // board a dark dim is not much of a difference, and the point of
              // the moment is that the page is the thing being lit.
              outline: `1px solid oklch(0.85 0.12 ${warm} / 0.55)`,
              transition: "box-shadow 200ms ease-out",
            }}
          />
        </div>
      ) : null}

      {/* The light, in the hand, over everything including the menu. */}
      {carry ? (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <div
            data-light-ball=""
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: carry.x,
              top: carry.y,
              width: ball,
              height: ball,
              background: `radial-gradient(circle at 38% 34%, oklch(1 0.05 ${warm}), oklch(0.88 0.17 ${warm}) 62%, oklch(0.74 0.19 ${warm}))`,
              boxShadow: `0 0 ${glow}px ${glow / 3}px oklch(0.9 0.17 ${warm} / 0.55), 0 0 2px 1px oklch(0.99 0.05 ${warm})`,
            }}
          />
          <div
            className="absolute whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              left: carry.x + 16,
              top: carry.y + 14,
              background: "oklch(0.16 0.02 280 / 0.9)",
              color: `oklch(0.92 0.06 ${warm})`,
              outline: "1px solid oklch(0.4 0.04 280)",
            }}
          >
            {inside(page, carry) ? "Let go to put the light here" : "Let go off the page to leave it"}
          </div>
        </div>
      ) : null}
    </>
  );
}
