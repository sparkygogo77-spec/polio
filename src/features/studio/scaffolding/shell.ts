import { standInHas } from "../standIn.ts";
import type { ScaffoldInput } from "./types.ts";

/** The stylesheet the shell's behaviours read: the reveal, the snap, the wipe, the burst, the button's rise. */
export const SHELL_CSS = `/* Behaviours: what the shell in components/Shell.tsx switches on. */
[data-reveal="on"] [data-part] { opacity: 0; transform: translateY(14px); transition: opacity 520ms ease-out, transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1); }
[data-reveal="on"] [data-part].is-in { opacity: 1; transform: none; }
[data-snap] [data-part] { scroll-snap-align: start; }
@media (prefers-reduced-motion: reduce) {
  [data-reveal="on"] [data-part] { opacity: 1; transform: none; transition: none; }
}
@keyframes slide-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mo-wipe { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes mo-burst { to { transform: translate(var(--mo-x), var(--mo-y)) rotate(200deg); opacity: 0; } }
`;

/**
 * The shell a built site runs its behaviours through: the live page's
 * shell (`live/LiveShell.tsx`) written against the window rather than a
 * pinned scroller, with no dependency beyond React. A page mounts it with
 * the switches its tier-B parts set.
 */
export const SHELL_TSX = `"use client";
import * as React from "react";

export interface Behaviours {
  progress: boolean;
  backToTop: boolean;
  reveal: boolean;
  parallax: number;
  smooth: boolean;
  snap: "vertical" | "horizontal" | null;
  intro: boolean;
  cursor: string | null;
  tilt: boolean;
  confetti: boolean;
  described: { id: string; label: string }[];
  any: boolean;
}

/**
 * Runs the behaviours the page was given in the Builder: the reading
 * progress bar, back to top, reveal on scroll, parallax, smooth scrolling,
 * snapping, the opening wipe, a cursor of the site's own, hover tilt and a
 * burst on success (dispatch a "site:success" event on the window). The few
 * that cannot be run honestly are named in the corner rather than faked.
 */
export function Shell({ behaviours: b, children }: { behaviours: Behaviours; children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [progress, setProgress] = React.useState(0);
  const [past, setPast] = React.useState(false);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [intro, setIntro] = React.useState(b.intro);
  const [bursts, setBursts] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!(b.progress || b.backToTop || b.parallax)) return;
    const read = () => {
      const top = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, top / max) : 0);
      setPast(top > 220);
      if (b.parallax) document.body.style.backgroundPositionY = \`\${-top * b.parallax}px\`;
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [b.progress, b.backToTop, b.parallax]);

  React.useEffect(() => {
    const el = document.documentElement;
    const before = { behavior: el.style.scrollBehavior, snap: el.style.scrollSnapType };
    if (b.smooth) el.style.scrollBehavior = "smooth";
    if (b.snap) el.style.scrollSnapType = \`\${b.snap === "horizontal" ? "x" : "y"} proximity\`;
    return () => { el.style.scrollBehavior = before.behavior; el.style.scrollSnapType = before.snap; };
  }, [b.smooth, b.snap]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.reveal || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-in"); }), { threshold: 0.12 });
    root.querySelectorAll("[data-part]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [b.reveal, children]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !b.tilt) return;
    const onMove = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-part]") as HTMLElement | null;
      if (!node) return;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      node.style.transform = \`perspective(900px) rotateX(\${(-dy * 7).toFixed(2)}deg) rotateY(\${(dx * 9).toFixed(2)}deg)\`;
      node.style.transition = "transform 120ms ease-out";
    };
    const onLeave = (e: PointerEvent) => {
      const node = (e.target as HTMLElement | null)?.closest("[data-part]") as HTMLElement | null;
      if (node) node.style.transform = "";
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave, true);
    return () => { root.removeEventListener("pointermove", onMove); root.removeEventListener("pointerleave", onLeave, true); };
  }, [b.tilt]);

  React.useEffect(() => {
    if (!b.cursor) return;
    const before = document.body.style.cursor;
    document.body.style.cursor = "none";
    const onMove = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    const onOut = () => setCursor(null);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onOut);
    return () => { window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onOut); document.body.style.cursor = before; };
  }, [b.cursor]);

  React.useEffect(() => {
    if (!b.intro) return;
    setIntro(true);
    const id = window.setTimeout(() => setIntro(false), 900);
    return () => window.clearTimeout(id);
  }, [b.intro]);

  React.useEffect(() => {
    if (!b.confetti) return;
    const onWin = () => {
      const id = Date.now();
      setBursts((xs) => [...xs, id]);
      window.setTimeout(() => setBursts((xs) => xs.filter((x) => x !== id)), 1400);
    };
    window.addEventListener("site:success", onWin);
    return () => window.removeEventListener("site:success", onWin);
  }, [b.confetti]);

  const spotlight = b.cursor === "spotlight";
  return (
    <div ref={rootRef} data-shell="" data-reveal={b.reveal ? "on" : undefined} data-snap={b.snap ?? undefined} style={{ display: "contents" }}>
      {children}
      {b.progress ? (
        <div role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 40, pointerEvents: "none" }}>
          <div style={{ width: "100%", height: "100%", background: "var(--accent)", transform: \`scaleX(\${progress})\`, transformOrigin: "0 50%" }} />
        </div>
      ) : null}
      {b.backToTop && past ? (
        <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ position: "fixed", right: 18, bottom: 18, zIndex: 45, width: 38, height: 38, borderRadius: 999, border: "none", cursor: "pointer", background: "var(--accent)", color: "var(--surface)", fontSize: 16, boxShadow: "0 8px 22px oklch(0 0 0 / .35)", animation: "slide-up 200ms ease-out both" }}>
          ↑
        </button>
      ) : null}
      {b.cursor && cursor ? (
        <span aria-hidden style={{ position: "fixed", left: cursor.x, top: cursor.y, zIndex: 50, pointerEvents: "none", width: spotlight ? 220 : 16, height: spotlight ? 220 : 16, marginLeft: spotlight ? -110 : -8, marginTop: spotlight ? -110 : -8, borderRadius: 999, mixBlendMode: spotlight ? "screen" : "difference", background: spotlight ? "radial-gradient(circle, color-mix(in oklab, var(--accent) 27%, transparent), transparent 70%)" : "var(--accent)", transition: b.cursor === "trail" ? "left 140ms ease-out, top 140ms ease-out" : undefined }} />
      ) : null}
      {intro ? <span aria-hidden style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--surface)", animation: "mo-wipe 900ms cubic-bezier(0.7, 0, 0.2, 1) both", pointerEvents: "none" }} /> : null}
      {bursts.map((id) => (
        <span key={id} aria-hidden style={{ position: "fixed", left: "50%", top: "40%", zIndex: 55, pointerEvents: "none" }}>
          {Array.from({ length: 18 }, (_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            return <span key={i} style={{ position: "absolute", width: 7, height: 7, borderRadius: 1, background: i % 2 ? "var(--accent)" : "oklch(0.8 0.16 90)", "--mo-x": \`\${Math.cos(angle) * (90 + (i % 5) * 22)}px\`, "--mo-y": \`\${Math.sin(angle) * (70 + (i % 4) * 20)}px\`, animation: "mo-burst 1.3s cubic-bezier(0.2, 0.7, 0.3, 1) both" } as React.CSSProperties} />;
          })}
        </span>
      ))}
      {b.described.length ? (
        <span data-described="" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 35, maxWidth: 300, padding: "6px 10px", borderRadius: 8, background: "var(--surface)", border: "1px solid color-mix(in oklab, var(--accent) 27%, transparent)", color: "var(--accent)", fontSize: 11, lineHeight: 1.4, pointerEvents: "none", opacity: 0.9 }}>
          Described, not simulated here: {b.described.map((d) => d.label).join(", ")}.
        </span>
      ) : null}
    </div>
  );
}
`;

/** What was written from the document, and what is left to write. */
export function buildMd(input: ScaffoldInput): string {
  const empties = input.parts.filter((p) => p.empty);
  const unwritten = input.parts.filter((p) => p.unwritten && !p.empty);
  const data = input.parts.filter((p) => p.data?.trim());
  return `# ${input.name || "The site"}, what this build is

This codebase was written **from the document**, not from a description of
it. \`site/document.json\` is the source: the palette, the type, every
part's options, its exact size and place, the line it is cut to and the
body written for it. Nothing about the look was inferred.

## What is deterministic

- \`package.json\`, \`tsconfig.json\`, \`next.config.mjs\` and \`vercel.json\`,
  what makes it an app Vercel runs: the packages at the versions the
  Builder renders the parts with, and the word to Vercel that this is
  Next.js.
- \`app/globals.css\`, the design tokens, taken from the palette and the
  format. ${Object.keys(input.palette).length} colour roles, ${Object.keys(input.tokens).length} other tokens.
- \`components/parts/*.tsx\`, one component per part, ${input.parts.length} of them,
  each carrying the markup that part actually rendered: its styles, its
  shape, its clip, its texture, and the shadow the page's lamp casts on it.
- \`app/**/page.tsx\`, ${input.pages.length} page${input.pages.length === 1 ? "" : "s"}, each placing its parts where the board places them.
- \`components/Frame.tsx\`, the fixed-width canvas and how it meets a
  narrower screen.${input.parts.some((p) => p.mesh?.glb) ? `
- ${input.parts.filter((p) => p.mesh?.glb).length} solid${input.parts.filter((p) => p.mesh?.glb).length === 1 ? "" : "s"} you can turn, written as components that load three.js in the
  browser: the one library this build adds, named in \`package.json\`. Without
  a 3D context each shows its still and says so.` : ""}${standInHas(input.standIn) ? `
- \`public/stand-in.js\`, the stand-in server: the ${input.standIn.reads.length} read${input.standIn.reads.length === 1 ? "" : "s"}${input.standIn.streams?.length ? ` and ${input.standIn.streams.length} live feed${input.standIn.streams.length === 1 ? "" : "s"} (replayed at their recorded pace, in a loop)` : ""} the capture
  recorded (${[...new Set([...input.standIn.reads, ...(input.standIn.streams ?? [])].map((r) => r.host))].join(", ")}) answered with their samples, so lists and
  buttons behave before a real backend exists. Writes and anything unrecorded
  go to the network. Turn it off with the Build option Stand-in server.` : ""}

Re-running Build regenerates exactly these files, byte for byte, from the
same document.

## How it runs

Go live pushes this as a Next.js app: \`vercel.json\` says so, and Vercel
builds it with \`next build\` and serves \`app/\` at the site's addresses. The
site's published HTML pages and its pictures go up beside it in \`public/\`,
served as they are, at \`/assets/pictures/...\` where the parts point.
\`npm install\`, then \`npm run dev\`, runs it on your own machine.

Every Go live writes these files again from the board. One changed in the
repository since Build wrote it is kept as it is, not written over
(\`site/build.json\` records what Build wrote): delete it and the next Go
live writes it from the board again. One Build no longer writes, for a part
or a page taken off the board, comes off the site unless it was changed.

## What is left for Claude, and why

A document holds what a site *is*, not everything it *does*. These are the
things it cannot hold, and the only things a model is asked for:

${empties.length || unwritten.length ? [
  ...empties.map((p) => `- **${p.label}**, an Idea part with no body written yet. The prompt says: ${p.prompt?.split("\n")[0] ?? "(nothing yet)"}`),
  ...unwritten.map((p) => `- **${p.label}**, words never written: its component leaves them out. Write them from the brief.${p.prompt?.trim() ? ` The prompt says: ${p.prompt.split("\n")[0]}` : ""}`),
].join("\n") : "- No empty parts: every part on the board rendered something."}
${data.length ? `\n${data.map((p) => `- **${p.label}**, reads: ${p.data!.split("\n")[0]}. Where that comes from is a decision this document does not make.`).join("\n")}` : ""}

Behaviour beyond the state the board can show, what happens after a form
is sent, what a filter filters, what a cart does, is the other half, and
\`BLUEPRINT.md\` is the narrative for it. The screenshots that went with the
ask are the reference for anything that has to *look* like something.
`;
}