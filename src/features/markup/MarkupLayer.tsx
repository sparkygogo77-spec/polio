"use client";
/**
 * ✍️ MARK UP: J DRAWS ON THE BUILDER, AND EVERY STROKE SAYS WHAT IT TOUCHED (J, 2026-11-11, 6:08 pm: "id love to
 * be able to mark for you whats missing with something that you automatically register my drawn lines instead of
 * having to look and decide where they are"; 6:05 pm: "where is my snapshot to edit button").
 *
 * Mark up freezes the view (a layer over everything takes every press; the page's animations pause) and J draws
 * with the mouse or a pen: a free line, a loop (a circle: everything inside it), or an arrow (what its head points
 * at). Each stroke is registered as it ends (`register.ts`) and takes an optional note. Send saves one press for
 * the coordinator through the Helper: the strokes with what each touched, the note, and pictures (the board under
 * each stroke with the stroke drawn on it). Snapshot saves the whole view's picture and the map of every element
 * on screen, so the coordinator can publish it for comments. Nothing on the board moves or changes.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { HELPER_ORIGIN } from "@/features/agents/context";
import { shootBoard, type Crop } from "@/features/agents/shot";
import { boardFrame, boxOf, elementMap, isClosed, register, thin, toPage, type Box, type Pt, type Registered, type Shape } from "./register";
import { closeMarkup, useMarkup } from "./store";

type Stroke = { shape: Shape; points: Pt[]; note: string; elements: Registered[]; near: Registered[] };
type Pic = { mime: string; data: string };
type Tool = "auto" | "arrow";

const INK = "#ff3b6b";
const LIVE_BUILDER = "https://polio-two.vercel.app";
const PAD = 28;

/** A short name for what a stroke registered, for J to see at once. */
export function strokeWords(s: Pick<Stroke, "elements" | "near" | "shape">): string {
  const names = s.elements.map((e) => e.name || e.text || e.attr || e.tag).filter(Boolean);
  if (!names.length) return s.near.length ? `empty board, near ${s.near.map((e) => e.name || e.nodeId).slice(0, 2).join(", ")}` : "nothing named here";
  const first = names.slice(0, 3).map((n) => (n!.length > 28 ? `${n!.slice(0, 27)}…` : n)).join(", ");
  return names.length > 3 ? `${first} +${names.length - 3}` : first;
}

async function post(body: Record<string, unknown>): Promise<string> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20_000);
  try {
    const r = await fetch(`${HELPER_ORIGIN}/lanes/press`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: stop.signal });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (r.ok && j?.ok) return "";
    return r.status === 403 ? "Not saved: the Helper on your PC is older than this Builder. It takes mark-ups once it is updated." : `Not saved: ${j?.error ?? `the Helper answered ${r.status}`}.`;
  } catch {
    if (window.location.origin !== LIVE_BUILDER) return "Not saved: the Helper takes presses from the live Builder only.";
    return "Not saved: the Helper isn't running, or is older than this Builder. Start it from the dock's Helper tab, then press again.";
  } finally { clearTimeout(timer); }
}

/** The stroke's box with room round it, and never thinner than a readable strip: a flat line keeps what is above and below it. */
const pad = (b: Box, by = PAD, min = { w: 220, h: 140 }): Box => {
  const w = Math.max(b.w + 2 * by, min.w), h = Math.max(b.h + 2 * by, min.h);
  return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h };
};

/** Where each stroke's tag goes: right of the stroke, moved down past any tag already placed, on screen. */
export function tagPlaces(boxes: Box[], view: { w: number; h: number }, heights: readonly number[] = [], top = 8): { left: number; top: number }[] {
  const placed: Box[] = [];
  return boxes.map((b, i) => {
    const size = { w: 296, h: (heights[i] || 50) + 6 };
    const left = Math.min(view.w - size.w - 6, Math.max(6, b.x + b.w + 6));
    let y = Math.min(view.h - size.h - 70, Math.max(top, b.y));
    for (let i = 0; i < 40 && placed.some((p) => left < p.x + p.w && left + size.w > p.x && y < p.y + p.h && y + size.h > p.y); i++) y += 18;
    placed.push({ x: left, y, w: size.w, h: size.h });
    return { left, top: y };
  });
}
const union = (bs: Box[]): Box => boxOf(bs.flatMap((b) => [[b.x, b.y], [b.x + b.w, b.y + b.h]] as Pt[]));

function drawStroke(g: CanvasRenderingContext2D, s: Pick<Stroke, "points" | "shape">, map: (p: Pt) => Pt, width: number) {
  const pts = s.points.map(map);
  if (pts.length < 2) return;
  g.save();
  g.strokeStyle = INK; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
  g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 2;
  g.beginPath(); g.moveTo(...pts[0]!); for (const p of pts.slice(1)) g.lineTo(...p);
  if (s.shape === "circle") g.closePath();
  g.stroke();
  if (s.shape === "arrow") arrowHead(g, pts, width * 4);
  g.restore();
}

function arrowHead(g: CanvasRenderingContext2D, pts: Pt[], size: number) {
  const tip = pts[pts.length - 1]!;
  const from = [...pts].reverse().find((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1]) > size) ?? pts[0]!;
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  g.beginPath();
  g.moveTo(tip[0] - size * Math.cos(a - 0.45), tip[1] - size * Math.sin(a - 0.45));
  g.lineTo(...tip);
  g.lineTo(tip[0] - size * Math.cos(a + 0.45), tip[1] - size * Math.sin(a + 0.45));
  g.stroke();
}

const toPic = (c: HTMLCanvasElement): Pic => { const url = c.toDataURL("image/webp", 0.85); return { mime: url.slice(5, url.indexOf(";")), data: url.slice(url.indexOf(",") + 1) }; };

/**
 * The picture of an area of the screen with these strokes drawn on it: the board under it as it is drawn
 * (`shootBoard`), or, where the area is off the board, the boxes of what was registered, named.
 */
async function pictureOf(area: Box, strokes: Stroke[], missing: Set<string>, side = 640): Promise<Pic | null> {
  const f = boardFrame();
  const page = f ? toPage(area, f) : undefined;
  let base: HTMLImageElement | null = null, k = 1, crop: Crop | null = null;
  if (f && page) {
    try {
      const shot = await shootBoard({ x: Math.round(page.x), y: Math.round(page.y), w: Math.max(1, Math.round(page.w)), h: Math.max(1, Math.round(page.h)) }, side);
      for (const m of shot.missing) missing.add(m);
      base = new Image(); base.src = `data:${shot.mime};base64,${shot.data}`; await base.decode();
      crop = shot.crop; k = shot.scale;
    } catch { missing.add("the board under a stroke could not be drawn"); base = null; }
  }
  /* Screen pixels to the picture's pixels. */
  const scale = base && f && crop ? f.scale : 1;
  const sx = base && crop ? k / scale : Math.min(1, side / Math.max(area.w, area.h));
  const ox = base && f && crop ? f.rect.left + crop.x * scale : area.x, oy = base && f && crop ? f.rect.top + crop.y * scale : area.y;
  const map = (p: Pt): Pt => [(p[0] - ox) * sx, (p[1] - oy) * sx];
  const c = document.createElement("canvas");
  c.width = base ? base.naturalWidth : Math.max(1, Math.round(area.w * sx)); c.height = base ? base.naturalHeight : Math.max(1, Math.round(area.h * sx));
  const g = c.getContext("2d");
  if (!g) return null;
  if (base) g.drawImage(base, 0, 0);
  else {
    missing.add("a stroke off the board: its picture is the named boxes, not the screen");
    g.fillStyle = "#0b0814"; g.fillRect(0, 0, c.width, c.height);
    g.font = "11px ui-monospace, monospace";
    for (const s of strokes) for (const e of [...s.elements, ...s.near]) {
      const [x, y] = map([e.box.x, e.box.y]);
      g.strokeStyle = "#7fd3ff"; g.lineWidth = 1; g.strokeRect(x, y, e.box.w * sx, e.box.h * sx);
      g.fillStyle = "#cfeaff"; g.fillText((e.name || e.text || e.attr || e.tag).slice(0, 40), x + 3, y + 12);
    }
  }
  for (const s of strokes) drawStroke(g, s, map, Math.max(2, 3 * sx));
  return toPic(c);
}

/** Pause what moves on the page while J draws; play it again after. */
function freeze(): () => void {
  const paused = (document.getAnimations?.() ?? []).filter((a) => a.playState === "running");
  for (const a of paused) { try { a.pause(); } catch { /* gone already */ } }
  return () => { for (const a of paused) { try { a.play(); } catch { /* gone already */ } } };
}

export function MarkupLayer() {
  const on = useMarkup((s) => s.on);
  const [here, setHere] = React.useState(false);
  React.useEffect(() => setHere(true), []);
  if (!here || !on) return null;
  return createPortal(<Layer />, document.body);
}

function Layer() {
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [drawing, setDrawing] = React.useState<Pt[] | null>(null);
  const [tool, setTool] = React.useState<Tool>("auto");
  const [note, setNote] = React.useState("");
  const [said, setSaid] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);
  const pointer = React.useRef<number | null>(null);
  /* Each tag's real height, so the tags are placed clear of one another however their words wrap. */
  const [heights, setHeights] = React.useState<number[]>([]);
  const layer = React.useRef<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    const got = [...(layer.current?.querySelectorAll<HTMLElement>("[data-markup-tag]") ?? [])].map((e) => Math.ceil(e.offsetHeight));
    if (got.join() !== heights.join()) setHeights(got);
  });

  React.useEffect(() => freeze(), []);
  /* Escape leaves; the board's own keys never see what is typed here. */
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("input,textarea")) { e.preventDefault(); closeMarkup(); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, []);
  /* For the checks: the strokes as registered (`tests/markup.mjs`). */
  React.useEffect(() => {
    const w = window as unknown as { __markup?: unknown };
    w.__markup = { strokes: () => strokes };
    return () => { delete w.__markup; };
  }, [strokes]);

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0 || busy) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointer.current = e.pointerId;
    setEditing(null);
    setDrawing([[e.clientX, e.clientY]]);
  };
  const move = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId || !drawing) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const add: Pt[] = (events.length ? events : [e]).map((x) => [x.clientX, x.clientY]);
    setDrawing((d) => (d ? [...d, ...add] : d));
  };
  const up = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    const pts = drawing;
    setDrawing(null);
    if (!pts || pts.length < 2 || Math.hypot(boxOf(pts).w, boxOf(pts).h) < 4) return;
    const shape: Shape = tool === "arrow" ? "arrow" : isClosed(pts) ? "circle" : "line";
    const r = register(pts, shape);
    setStrokes((s) => [...s, { shape, points: pts, note: "", ...r }]);
    setEditing(strokes.length);
    setSaid("");
  };

  const send = async () => {
    if (!strokes.length || busy) return;
    setBusy(true); setSaid("Saving…");
    const missing = new Set<string>();
    const out = [];
    for (const s of strokes) {
      const area = pad(boxOf(s.points));
      out.push({ shape: s.shape, points: thin(s.points), note: s.note.trim() || undefined, box: boxOf(s.points), pageBox: toPage(boxOf(s.points)), elements: s.elements, near: s.near.length ? s.near : undefined, picture: await pictureOf(area, [s], missing, 520) });
    }
    const all = await pictureOf(pad(union(strokes.map((s) => boxOf(s.points)))), strokes, missing, 1100);
    const r = await post({ kind: "markup", target: "coordinator", note: note.trim() || undefined, strokes: out, picture: all, missing: [...missing], view: viewOf() });
    setBusy(false);
    if (r) { setSaid(r); return; }
    setSaid(`Sent ${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"}: the coordinator reads them on its next turn.`);
    setStrokes([]); setNote("");
  };

  const snapshot = async () => {
    if (busy) return;
    setBusy(true); setSaid("Taking the snapshot…");
    const missing = new Set<string>(["the Builder's own bars and panels are named in the map, not drawn: the picture is the board"]);
    const view: Box = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const f = boardFrame();
    const area = f ? { x: Math.max(0, f.rect.left), y: Math.max(0, f.rect.top), w: Math.min(view.w, f.rect.right) - Math.max(0, f.rect.left), h: Math.min(view.h, f.rect.bottom) - Math.max(0, f.rect.top) } : view;
    const picture = area.w > 0 && area.h > 0 ? await pictureOf(area, strokes, missing, 1400) : null;
    const r = await post({ kind: "snapshot", target: "coordinator", note: note.trim() || undefined, picture, map: elementMap(), missing: [...missing], view: viewOf() });
    setBusy(false);
    setSaid(r || "Snapshot saved: the coordinator can publish it for your comments.");
  };

  const places = tagPlaces(strokes.map((s) => boxOf(s.points)), { w: window.innerWidth, h: window.innerHeight }, heights);
  const live = drawing && drawing.length > 1 ? drawing : null;
  const pathOf = (pts: Pt[], closed = false) => `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}${closed ? "Z" : ""}`;
  const btn: React.CSSProperties = { height: 26, padding: "0 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)" };

  return (
    <div ref={layer} data-markup-layer="" className="fixed inset-0" style={{ zIndex: 90, cursor: "crosshair", touchAction: "none" }} onKeyDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <svg data-markup-ink={strokes.length} className="absolute inset-0 h-full w-full" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ background: "rgba(255,59,107,.04)", outline: `3px solid ${INK}`, outlineOffset: -3 }}>
        <defs><marker id="markup-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10" fill="none" stroke={INK} strokeWidth="2" /></marker></defs>
        {strokes.map((s, i) => (
          <g key={i} data-markup-stroke={i + 1} data-markup-shape={s.shape} data-markup-count={s.elements.length}>
            {s.elements.map((e, j) => <rect key={j} x={e.box.x} y={e.box.y} width={e.box.w} height={e.box.h} fill="none" stroke="#7fd3ff" strokeOpacity={0.55} strokeDasharray="4 3" />)}
            <path d={pathOf(s.points, s.shape === "circle")} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" markerEnd={s.shape === "arrow" ? "url(#markup-head)" : undefined} />
          </g>
        ))}
        {live ? <path d={pathOf(live)} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" markerEnd={tool === "arrow" ? "url(#markup-head)" : undefined} /> : null}
      </svg>
      {/* Each stroke's tag: its number, what it registered, and its note. */}
      {strokes.map((s, i) => {
        const { left, top } = places[i]!;
        return (
          <div key={i} data-markup-tag={i + 1} className="absolute flex flex-col gap-1" style={{ pointerEvents: "none", left, top, width: 290, fontSize: 11.5, color: "#fff", background: "rgba(10,6,18,.9)", border: `1px solid ${INK}`, borderRadius: 7, padding: "4px 7px", fontFamily: "ui-monospace, monospace" }}>
            <span className="flex items-center gap-1.5">
              <b style={{ color: INK }}>{i + 1}</b>
              <span data-markup-words="" style={{ overflowWrap: "anywhere" }}>{strokeWords(s)}</span>
              <button type="button" data-markup-remove={i + 1} aria-label={`Remove stroke ${i + 1}`} className="ml-auto" style={{ pointerEvents: "auto", color: "#ffb0c4", fontWeight: 900 }} onClick={() => { setStrokes((all) => all.filter((_, j) => j !== i)); setEditing(null); }}>×</button>
            </span>
            {editing === i ? (
              <input data-markup-stroke-note={i + 1} autoFocus value={s.note} placeholder="A note for this stroke (Enter)" maxLength={1000}
                onChange={(e) => { const v = e.target.value; setStrokes((all) => all.map((x, j) => (j === i ? { ...x, note: v } : x))); }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") setEditing(null); }}
                style={{ pointerEvents: "auto", background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 4, padding: "2px 5px", fontSize: 11.5 }} />
            ) : (
              <button type="button" data-markup-note-open={i + 1} className="self-start text-left" style={{ pointerEvents: "auto", color: s.note ? "#fff" : "#a9b6c8" }} onClick={() => setEditing(i)}>{s.note || "+ note"}</button>
            )}
          </div>
        );
      })}
      {/* The bar: how to draw, the note for the whole mark-up, Send, Snapshot, Done. */}
      <div data-markup-bar="" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg" style={{ background: "rgba(10,6,18,.94)", border: `2px solid ${INK}`, padding: "5px 7px", color: "#fff", fontFamily: "ui-monospace, monospace", maxWidth: "calc(100vw - 16px)", flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5 }}>✍️ Mark up</b>
        <button type="button" data-markup-tool="auto" aria-pressed={tool === "auto"} style={{ ...btn, background: tool === "auto" ? INK : btn.background }} title="Draw a line over things, or a loop round them" onClick={() => setTool("auto")}>Line / circle</button>
        <button type="button" data-markup-tool="arrow" aria-pressed={tool === "arrow"} style={{ ...btn, background: tool === "arrow" ? INK : btn.background }} title="Draw an arrow: its head names what it points at" onClick={() => setTool("arrow")}>Arrow</button>
        <button type="button" data-markup-undo="" disabled={!strokes.length} style={{ ...btn, opacity: strokes.length ? 1 : 0.45 }} onClick={() => { setStrokes((s) => s.slice(0, -1)); setEditing(null); }}>Undo</button>
        <input data-markup-note="" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="What is wrong (optional)" maxLength={4000}
          style={{ width: 220, height: 26, background: "#000", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "0 7px", fontSize: 12 }} />
        <button type="button" data-markup-send={strokes.length} disabled={!strokes.length || busy} style={{ ...btn, color: "#04121c", background: strokes.length ? "#fff" : "rgba(255,255,255,.4)" }} onClick={() => void send()}>Send{strokes.length ? ` · ${strokes.length}` : ""}</button>
        <button type="button" data-markup-snapshot="" disabled={busy} style={btn} title="Save the whole view and every element on it, for the coordinator to publish for your comments" onClick={() => void snapshot()}>📸 Snapshot</button>
        <button type="button" data-markup-close="" style={btn} title="Leave mark-up (Esc)" onClick={closeMarkup}>Done</button>
        {said ? <span data-markup-said="" style={{ fontSize: 11.5, color: "#ffe1ea", flexBasis: "100%" }}>{said}</span> : null}
      </div>
    </div>
  );
}

function viewOf() {
  const site = (document.querySelector("[data-site-name]") as HTMLElement | null)?.dataset.siteName;
  return { w: window.innerWidth, h: window.innerHeight, page: window.location.pathname, ...(site ? { site } : {}) };
}
