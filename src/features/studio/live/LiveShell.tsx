"use client";
/**
 * Runs the behaviours a page has been given: the progress bar, back-to-top,
 * reveal on scroll, parallax, snapping, the opening sequence, a custom cursor,
 * tilt and the celebration burst. It wraps the live page and finds the nearest
 * `[data-live-scroller]` — the pinned window and the full-size route both mark
 * theirs, and it falls back to the window when neither is there.
 */
import * as React from "react";
import type { Behaviours } from "./behaviours";
import { tint } from "../shelf/run";

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
  const [progress, setProgress] = React.useState(0);
  const [past, setPast] = React.useState(false);
  /* Where the visible window sits inside the page, so pinned chrome can follow it. */
  const [view, setView] = React.useState({ top: 0, height: 0 });
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
      setProgress(max > 0 ? Math.min(1, top / max) : 0);
      setPast(top > 220);
      setView({ top, height });
      if (b.parallax) root.style.backgroundPositionY = `${-top * b.parallax}px`;
    };
    read();
    const target: EventTarget = scroller ?? window;
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, [b.progress, b.backToTop, b.parallax, b.described.length]);

  /* Scrolling style belongs to the scroller, not to us. */
  React.useEffect(() => {
    const scroller = rootRef.current?.closest("[data-live-scroller]") as HTMLElement | null;
    if (!scroller) return;
    const before = { behavior: scroller.style.scrollBehavior, snap: scroller.style.scrollSnapType };
    if (b.smooth) scroller.style.scrollBehavior = "smooth";
    if (b.snap) scroller.style.scrollSnapType = `${b.snap === "horizontal" ? "x" : "y"} proximity`;
    return () => { scroller.style.scrollBehavior = before.behavior; scroller.style.scrollSnapType = before.snap; };
  }, [b.smooth, b.snap]);

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

  /* Cards lean toward the pointer, using ratios so scale does not matter. */
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.tilt) return;
    const onMove = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-live-node]") as HTMLElement | null;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = `perspective(900px) rotateX(${(-dy * 7).toFixed(2)}deg) rotateY(${(dx * 9).toFixed(2)}deg)`;
      node.style.transition = "transform 120ms ease-out";
    };
    const onLeave = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-live-node]") as HTMLElement | null;
      if (node) node.style.transform = "";
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave, true);
    return () => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", onLeave, true); };
  }, [b.tilt]);

  /* A cursor of the site's own. `display: contents` has no box, so the real
     cursor is hidden on the page element itself. */
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.cursor) return;
    const surface = root.parentElement;
    const before = surface?.style.cursor ?? "";
    if (surface) surface.style.cursor = "none";
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      if (!r.width) return;
      setCursor({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    };
    const onOut = () => setCursor(null);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onOut);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onOut);
      if (surface) surface.style.cursor = before;
    };
  }, [b.cursor]);

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
      data-snap={b.snap ?? undefined}
      style={{ display: "contents" }}
    >
      {children}

      {b.progress ? (
        <div role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ position: "absolute", top: view.top, left: 0, right: 0, height: 3, zIndex: 40, pointerEvents: "none" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: accent, transition: "width 90ms linear" }} />
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
          style={{ position: "absolute", right: 18, top: view.top + view.height - 56, zIndex: 45, width: 38, height: 38, borderRadius: 999, border: "none", cursor: "pointer", background: accent, color: surface, fontSize: 16, boxShadow: "0 8px 22px oklch(0 0 0 / .35)", animation: "slide-up var(--motion-base) ease-out both" }}
        >
          ↑
        </button>
      ) : null}

      {b.cursor && cursor ? (
        <span
          aria-hidden
          style={{
            position: "absolute", left: `${cursor.x}%`, top: `${cursor.y}%`, zIndex: 50, pointerEvents: "none",
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

      {b.described.length ? (
        <span data-live-described="" style={{ position: "absolute", left: 12, top: view.top + view.height - 48, zIndex: 35, maxWidth: 300, padding: "6px 10px", borderRadius: 8, background: surface, border: `1px solid ${tint(accent, 0.267)}`, color: accent, fontSize: 11, lineHeight: 1.4, pointerEvents: "none", opacity: 0.9 }}>
          Described, not simulated here: {b.described.map((d) => d.label).join(", ")}.
        </span>
      ) : null}
    </div>
  );
}
