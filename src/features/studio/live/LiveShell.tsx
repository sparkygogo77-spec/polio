"use client";
/**
 * Runs the behaviours a page has been given: the progress bar, back-to-top,
 * reveal on scroll, parallax, snapping, the opening sequence, a custom cursor,
 * tilt and the celebration burst. It wraps the live page and finds the nearest
 * `[data-live-scroller]` — the pinned window and the full-size route both mark
 * theirs, and it falls back to the window when neither is there.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { Behaviours } from "./behaviours";
import { tint } from "../shelf/run";
import { leanSet } from "./carry";
import { RAISE_JS } from "../shelf/library/raiseJs";
import { SCROLL_MOTION_JS } from "../shelf/library/scrollMotionJs";

/** Lifts a leaning card over the parts around it; returns what puts it back (`raiseJs.ts`, the same lines the published page runs). */
const raiseOver = new Function(`${RAISE_JS}; return raiseOver;`)() as (nodes: HTMLElement[]) => () => void;
/** Smooth, Snap and Depth scrolling (`scrollMotionJs.ts`, the same lines the published page runs); returns what turns it off. */
type ScrollMotion = (box: HTMLElement | null, o: { smooth: boolean; strength: string; stops: () => Element[]; snap: boolean; sections: () => Element[]; depth: number; layers: () => Element[][] }) => () => void;
const { scrollMotion, sectionsOf } = new Function(`${SCROLL_MOTION_JS}; return { scrollMotion, sectionsOf };`)() as { scrollMotion: ScrollMotion; sectionsOf: (els: Element[], box: HTMLElement | null) => Element[] };

interface Props {
  behaviours: Behaviours;
  /**
   * On the published page the chrome this draws is drawn by the page's own
   * script (`library/siteMotion.ts`), so none of it is written into the
   * markup: an opening wipe frozen over the page, a "described, not
   * simulated" note about how the Builder works, a bar stuck at 0.
   */
  published?: boolean;
  accent: string;
  surface: string;
  children: React.ReactNode;
}

export function LiveShell({ behaviours: b, accent, surface, children, published = false }: Props) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [past, setPast] = React.useState(false);
  /* How tall the visible window is, so the button and the note sit at its foot. */
  const [viewH, setViewH] = React.useState(0);
  const barRef = React.useRef<HTMLDivElement>(null);
  /*
   * PINNED CHROME RIDES THE SCROLLER, NOT THE PAGE (J, 2026-10-10: the progress
   * bar "doesn't stay at the top ... lags behind heavily" on a fast scroll).
   * It sat in the page at `top: scrollTop`, set from a scroll event, so it
   * trailed the compositor's scroll by a frame or more and, in a scaled
   * desktop frame, drifted by the scale. Now it lives in a sticky strip that
   * is the scroller's own first child: the browser keeps it at the top.
   */
  const [pin, setPin] = React.useState<HTMLElement | null>(null);
  const pinned = b.progress || b.backToTop || b.described.length > 0;
  React.useLayoutEffect(() => {
    const scroller = rootRef.current?.closest("[data-live-scroller]") as HTMLElement | null;
    if (!pinned || published) return;
    const host = document.createElement("div");
    host.setAttribute("data-live-pinned", "");
    host.style.cssText = scroller
      ? "position:sticky;top:0;left:0;height:0;z-index:40;pointer-events:none"
      : "position:fixed;top:0;left:0;right:0;height:100vh;z-index:40;pointer-events:none";
    if (scroller) scroller.insertBefore(host, scroller.firstChild); else document.body.appendChild(host);
    setPin(host);
    return () => { host.remove(); setPin(null); };
  }, [pinned, published]);
  const at = b.backToTopAt;
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [intro, setIntro] = React.useState(b.intro);
  const [bursts, setBursts] = React.useState<number[]>([]);

  /* The bar, the button, and the parallax offset all come off one scroll. */
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !(b.progress || b.backToTop || b.parallax || b.described.length)) return;
    const scroller = root.closest("[data-live-scroller]") as HTMLElement | null;
    const read = () => {
      const top = scroller ? scroller.scrollTop : window.scrollY;
      const height = scroller ? scroller.clientHeight : window.innerHeight;
      const max = scroller ? scroller.scrollHeight - scroller.clientHeight : document.body.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, top / max) : 0;
      /* Written straight onto the bar: no render, no easing, so it never trails the page. */
      const bar = barRef.current;
      if (bar) { (bar.firstChild as HTMLElement).style.transform = `scaleX(${p})`; bar.setAttribute("aria-valuenow", String(Math.round(p * 100))); }
      setPast(top > 220);
      setViewH(height);
      /* On the page element: the shell is `display: contents` and has no background to move. */
      if (b.parallax && root.parentElement) root.parentElement.style.backgroundPositionY = `${-top * b.parallax}px`;
    };
    read();
    const target: EventTarget = scroller ?? window;
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, [b.progress, b.backToTop, b.parallax, b.described.length, pin]);

  /* Scrolling style belongs to the scroller, not to us. */
  const stopsKey = `${b.smoothStops.join(",")}|${b.snapParts.join(",")}|${b.depthParts.join(",")}`;
  React.useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest("[data-live-scroller]") as HTMLElement | null;
    if (!root || !scroller) return;
    const before = { behavior: scroller.style.scrollBehavior, snap: scroller.style.scrollSnapType };
    if (b.smooth) scroller.style.scrollBehavior = "smooth";
    /* Sideways snapping stays the browser's; up and down is the script's, section by section. */
    if (b.snap === "horizontal") scroller.style.scrollSnapType = "x proximity";
    /*
     * A wheel notch eased its own distance and the browser already eases one,
     * so the Preview scrolled as if the switch were off. Now the parts given
     * an effect are what it acts on: stops, sections, background layers.
     */
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const page = root.parentElement ?? scroller;
    const all = () => Array.from(page.querySelectorAll<HTMLElement>("[data-live-node]"));
    const byId = (ids: string[]) => ids.map((id) => page.querySelector<HTMLElement>(`[data-live-node="${CSS.escape(id)}"]`)).filter((n): n is HTMLElement => !!n && n.getBoundingClientRect().height > 0);
    /* The Preview draws parts flat, side by side in one layer: a layer moves with every part drawn inside it. */
    const inside = (outer: Element) => {
      const r = outer.getBoundingClientRect();
      return all().filter((n) => { if (n === outer) return false; const q = n.getBoundingClientRect(); return q.height > 0 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1 && q.left >= r.left - 1 && q.right <= r.right + 1; });
    };
    const vertical = b.snap === "vertical";
    const off = (b.smooth || vertical || b.depthParts.length) && !still
      ? scrollMotion(scroller, {
          smooth: b.smooth,
          strength: b.smoothStrength,
          stops: () => byId(b.smoothStops),
          snap: vertical,
          sections: () => (b.snapParts.length ? byId(b.snapParts) : sectionsOf(all(), scroller)),
          depth: b.depthParts.length ? b.parallax || 0.18 : 0,
          layers: () => byId(b.depthParts).map((n) => [n, ...inside(n)]),
        })
      : null;
    return () => { off?.(); scroller.style.scrollBehavior = before.behavior; scroller.style.scrollSnapType = before.snap; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.smooth, b.smoothStrength, b.snap, b.parallax, stopsKey]);

  /* Each part comes in as it arrives. */
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.reveal || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-in"); }),
      { root: root.closest("[data-live-scroller]"), threshold: 0.12 },
    );
    const nodes = Array.from(root.querySelectorAll("[data-live-node]"));
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [b.reveal, children]);

  /*
   * Cards lean toward the pointer, using ratios so scale does not matter.
   * A CARD LEANS WHOLE. The parts are drawn on their own, so the part under
   * the pointer was a word or a button and only it leaned. The card is the
   * smallest part under the pointer that holds others (narrower than the
   * page, so a full-width band does not tip), and it leans with everything
   * drawn over it, all about the card's middle (`leanSet`).
   */
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.tilt) return;
    let boxes: { el: HTMLElement; r: DOMRect }[] | null = null;
    let leaning: { card: HTMLElement; set: { el: HTMLElement; origin: string }[]; lower: () => void } | null = null;
    const rest = () => {
      for (const x of leaning?.set ?? []) { x.el.style.transform = ""; x.el.style.transformOrigin = ""; }
      const lower = leaning?.lower;
      if (lower) setTimeout(lower, 160);
      leaning = null;
    };
    const forget = () => { rest(); boxes = null; };
    const onMove = (e: PointerEvent) => {
      if (!boxes) { rest(); boxes = Array.from(root.querySelectorAll<HTMLElement>("[data-live-node]")).map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.width && x.r.height); }
      const hit = leanSet(boxes, e.clientX, e.clientY, root.getBoundingClientRect().width * 0.9);
      if (!hit) { rest(); return; }
      if (leaning?.card !== hit.card.el) {
        rest();
        const r = hit.card.r, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const own = hit.set.filter((x) => !hit.set.some((o) => o !== x && o.el.contains(x.el)));
        leaning = { card: hit.card.el, lower: raiseOver(own.map((x) => x.el)), set: own.map((x) => {
          const kx = x.r.width ? x.el.offsetWidth / x.r.width : 1, ky = x.r.height ? x.el.offsetHeight / x.r.height : 1;
          return { el: x.el, origin: `${((cx - x.r.left) * kx).toFixed(2)}px ${((cy - x.r.top) * ky).toFixed(2)}px` };
        }) };
      }
      const r = hit.card.r;
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      const t = `perspective(900px) rotateX(${(-dy * 7).toFixed(2)}deg) rotateY(${(dx * 9).toFixed(2)}deg)`;
      for (const x of leaning!.set) { x.el.style.transformOrigin = x.origin; x.el.style.transform = t; x.el.style.transition = "transform 120ms ease-out"; }
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", forget);
    window.addEventListener("scroll", forget, { passive: true, capture: true });
    window.addEventListener("resize", forget);
    return () => { forget(); root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", forget); window.removeEventListener("scroll", forget, { capture: true }); window.removeEventListener("resize", forget); };
  }, [b.tilt]);

  /*
   * A cursor of the site's own. `display: contents` has no box, so it is
   * measured on the page element it sits in. It was measured on itself: a
   * box of no width, so the dot never moved, never showed, and the real
   * pointer was hidden all the same (J: "no cursor at all in the preview").
   * The dot is placed in the page's own pixels, so a scaled preview keeps it
   * under the hand. A picture cursor is the real pointer, drawn as his
   * picture with its tip at the top left, over everything on the page.
   */
  const dotRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const root = rootRef.current;
    const surface = root?.parentElement;
    if (!root || !surface || !b.cursor) return;
    if (b.cursor === "picture" && b.cursorPicture) {
      surface.setAttribute("data-live-cursor", "");
      const sheet = document.createElement("style");
      sheet.textContent = `[data-live-cursor],[data-live-cursor] *{cursor:url("${b.cursorPicture}") 0 0,auto !important}`;
      document.head.appendChild(sheet);
      return () => { sheet.remove(); surface.removeAttribute("data-live-cursor"); };
    }
    const before = surface.style.cursor;
    if (b.cursor !== "spotlight") surface.style.cursor = "none";
    const onMove = (e: PointerEvent) => {
      const host = (dotRef.current?.offsetParent as HTMLElement | null) ?? surface;
      const r = host.getBoundingClientRect();
      const sx = host.offsetWidth ? r.width / host.offsetWidth : 1;
      const sy = host.offsetHeight ? r.height / host.offsetHeight : 1;
      setCursor({ x: (e.clientX - r.left) / sx, y: (e.clientY - r.top) / sy });
    };
    const onOut = () => setCursor(null);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onOut);
    return () => {
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", onOut);
      surface.style.cursor = before;
    };
  }, [b.cursor, b.cursorPicture]);

  /* The opening sequence runs once, then gets out of the way. */
  React.useEffect(() => {
    if (!b.intro) return;
    setIntro(true);
    const id = window.setTimeout(() => setIntro(false), 900);
    return () => window.clearTimeout(id);
  }, [b.intro]);

  /* Anything that succeeds gets a burst, if the page asked for one. */
  React.useEffect(() => {
    if (!b.confetti) return;
    const onWin = () => {
      const id = Date.now();
      setBursts((xs) => [...xs, id]);
      window.setTimeout(() => setBursts((xs) => xs.filter((x) => x !== id)), 1400);
    };
    window.addEventListener("builder:success", onWin);
    return () => window.removeEventListener("builder:success", onWin);
  }, [b.confetti]);

  if (published) return <div ref={rootRef} data-live-shell="" style={{ display: "contents" }}>{children}</div>;
  return (
    <div
      ref={rootRef}
      data-live-shell=""
      data-reveal={b.reveal ? "on" : undefined}
      data-reveal-style={b.reveal ? b.revealStyle : undefined}
      data-snap={b.snap ?? undefined}
      style={{ display: "contents" }}
    >
      {children}

      {pin ? createPortal(
        <>
          {b.progress ? (
            <div ref={barRef} role="progressbar" aria-label="Reading progress" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3 }}>
              <div style={{ width: "100%", height: "100%", background: accent, transform: "scaleX(0)", transformOrigin: "0 50%", willChange: "transform" }} />
            </div>
          ) : null}
          {b.backToTop && past ? (
            <button
              type="button"
              aria-label="Back to top"
              onClick={() => {
                const scroller = rootRef.current?.closest("[data-live-scroller]") as HTMLElement | null;
                if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
                else window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              data-live-back-to-top={`${at.v}-${at.h}`}
              /* Where it was put on the board, from the nearest corner of the window (`live/corner.ts`). */
              style={{ position: "absolute", [at.h]: at.x, top: at.v === "top" ? at.y : viewH - at.y - at.size, pointerEvents: "auto", zIndex: 45, width: at.size, height: at.size, borderRadius: 999, border: "none", cursor: "pointer", background: accent, color: surface, fontSize: Math.round(at.size * 0.4), boxShadow: "0 8px 22px oklch(0 0 0 / .35)", animation: "slide-up var(--motion-base) ease-out both" }}
            >
              ↑
            </button>
          ) : null}
          {b.described.length ? (
            <span data-live-described="" style={{ position: "absolute", left: 12, top: viewH - 48, zIndex: 35, maxWidth: 300, padding: "6px 10px", borderRadius: 8, background: surface, border: `1px solid ${tint(accent, 0.267)}`, color: accent, fontSize: 11, lineHeight: 1.4, pointerEvents: "none", opacity: 0.9 }}>
              Described, not simulated here: {b.described.map((d) => d.label).join(", ")}.
            </span>
          ) : null}
        </>,
        pin,
      ) : null}



      {b.cursor && b.cursor !== "picture" ? (
        <span
          ref={dotRef}
          aria-hidden
          data-live-cursor-dot={b.cursor}
          style={{
            position: "absolute", left: cursor?.x ?? 0, top: cursor?.y ?? 0, zIndex: 50, pointerEvents: "none", visibility: cursor ? "visible" : "hidden",
            width: b.cursor === "spotlight" ? 220 : 16, height: b.cursor === "spotlight" ? 220 : 16,
            marginLeft: b.cursor === "spotlight" ? -110 : -8, marginTop: b.cursor === "spotlight" ? -110 : -8,
            borderRadius: 999, mixBlendMode: b.cursor === "spotlight" ? "screen" : "difference",
            background: b.cursor === "spotlight" ? `radial-gradient(circle, ${tint(accent, 0.267)}, transparent 70%)` : accent,
            transition: b.cursor === "trail" ? "left 140ms ease-out, top 140ms ease-out" : undefined,
          }}
        />
      ) : null}

      {intro ? (
        <span aria-hidden style={{ position: "absolute", inset: 0, zIndex: 60, background: surface, animation: "mo-wipe 900ms cubic-bezier(0.7, 0, 0.2, 1) both", pointerEvents: "none" }} />
      ) : null}

      {bursts.map((id) => (
        <span key={id} aria-hidden style={{ position: "absolute", left: "50%", top: "40%", zIndex: 55, pointerEvents: "none" }}>
          {Array.from({ length: 18 }, (_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            return (
              <span
                key={i}
                style={{
                  position: "absolute", width: 7, height: 7, borderRadius: 1,
                  background: i % 2 ? accent : "oklch(0.8 0.16 90)",
                  "--mo-x": `${Math.cos(angle) * (90 + (i % 5) * 22)}px`,
                  "--mo-y": `${Math.sin(angle) * (70 + (i % 4) * 20)}px`,
                  animation: "mo-burst 1.3s cubic-bezier(0.2, 0.7, 0.3, 1) both",
                } as React.CSSProperties}
              />
            );
          })}
        </span>
      ))}

    </div>
  );
}

