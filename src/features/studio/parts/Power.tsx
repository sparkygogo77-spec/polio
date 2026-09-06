"use client";
/**
 * Tools that reward fast hands: long lists, panes you drag, a console you
 * type into. Pointer maths here is done as ratios of the element's rect so it
 * survives the preview's scale transform.
 */
import * as React from "react";
import { Fill, useTicker } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, titled, FAMILY } from "./theme";
import { opt, type PartProps } from "./types";

/** Thousands of rows, only the visible ones in the DOM. */
export function VirtualList({ id, content, theme: t, h }: PartProps) {
  const total = 10000;
  const label = items(content, ["Row"])[0]!;
  const rowH = Math.round(t.fontPx * 1.9);
  const [top, setTop] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const viewport = Math.max(80, h - t.fontPx * 2.6);
  const first = Math.max(0, Math.floor(top / rowH) - 4);
  const count = Math.ceil(viewport / rowH) + 8;
  const r = React.useMemo(() => rng(hash(id + content)), [id, content]);

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.6}px`, borderBottom: `1px solid ${t.line}`, color: t.muted, fontSize: t.fontPx * 0.75 }}>
        <span>{total.toLocaleString()} rows</span>
        <span style={{ marginLeft: "auto" }}>showing {first + 1}–{Math.min(total, first + count)}</span>
      </div>
      <div ref={ref} onScroll={(e) => setTop(e.currentTarget.scrollTop)} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <div style={{ height: total * rowH, position: "relative" }}>
          <div style={{ position: "absolute", top: first * rowH, left: 0, right: 0 }}>
            {Array.from({ length: Math.min(count, total - first) }, (_, i) => {
              const n = first + i;
              return (
                <div key={n} style={{ height: rowH, display: "flex", alignItems: "center", gap: 8, padding: `0 ${t.fontPx * 0.6}px`, borderBottom: `1px solid ${t.line}`, fontSize: t.fontPx * 0.85 }}>
                  <span style={{ color: t.muted, fontVariantNumeric: "tabular-nums", width: t.fontPx * 3 }}>{n + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label} {sample.word(rng(hash(String(n))))}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Fill>
  );
}

/** Parallel streams, side by side, each arriving on its own. */
export function MultiColumnFeed({ id, content, options, theme: t, mode }: PartProps) {
  const columns = items(content, ["Mentions", "Orders", "Errors"]);
  const n = Math.max(1, Math.min(6, Number(opt(options, "columns", String(columns.length))) || columns.length));
  const [tick, setTick] = React.useState(0);
  useTicker(mode, 2200, () => setTick((v) => v + 1));
  return (
    <Fill t={t} data-part={id} style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(n, columns.length)}, 1fr)`, gap: t.fontPx * 0.5, overflow: "hidden" }}>
      {columns.slice(0, n).map((col, ci) => (
        <div key={col} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <span style={{ padding: `${t.fontPx * 0.3}px ${t.fontPx * 0.5}px`, borderBottom: `1px solid ${t.line}`, color: t.muted, fontSize: t.fontPx * 0.72, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{col}</span>
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0, padding: t.fontPx * 0.3, display: "flex", flexDirection: "column", gap: 3 }}>
            {Array.from({ length: 6 }, (_, i) => {
              const r = rng(hash(col + (tick + i) + id));
              return (
                <span key={`${tick}-${i}`} style={{ fontSize: t.fontPx * 0.78, color: i === 0 ? t.text : t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", animation: i === 0 && mode === "live" ? "slide-up var(--motion-base, 200ms) ease-out both" : undefined }}>
                  <span style={{ color: t.accent }}>·</span> {sample.word(r)}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </Fill>
  );
}

/** Named configurations you can switch between in one click. */
export function Presets({ id, content, theme: t, mode, emit }: PartProps) {
  const presets = items(content, ["Default: everything on", "Focused: chrome hidden", "Presenting: large type"]).map(titled);
  const [active, setActive] = React.useState(presets[0]!.title);
  const current = presets.find((p) => p.title === active) ?? presets[0]!;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.5, justifyContent: "center" }}>
      <div role="radiogroup" aria-label="Presets" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button
            key={p.title}
            type="button"
            role="radio"
            aria-checked={active === p.title}
            onClick={() => { setActive(p.title); emit?.({ type: "toast", text: `${p.title} applied` }); }}
            style={{ padding: `${t.fontPx * 0.3}px ${t.fontPx * 0.7}px`, borderRadius: 999, cursor: mode === "live" ? "pointer" : "default", font: "inherit", fontSize: t.fontPx * 0.82, border: `1px solid ${active === p.title ? t.accent : t.line}`, background: active === p.title ? `${t.accent}1e` : "transparent", color: active === p.title ? t.accent : t.text }}
          >
            {p.title}
          </button>
        ))}
      </div>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{current.body ?? "This preset's settings."}</span>
    </Fill>
  );
}

/** Every action has a key. In live mode the sheet lights up as you press. */
export function HotkeyFirst({ id, content, theme: t, mode }: PartProps) {
  const rows = items(content, ["⌘K: everything", "/: search", "g then h: home", "?: this sheet", "Esc: back"]).map(titled);
  const [last, setLast] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (mode !== "live") return;
    const onKey = (e: KeyboardEvent) => setLast(e.metaKey || e.ctrlKey ? `⌘${e.key.toUpperCase()}` : e.key === " " ? "Space" : e.key);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Shortcuts</strong>
        <span aria-live="polite" style={{ marginLeft: "auto", color: t.muted, fontSize: t.fontPx * 0.75 }}>{last ? `pressed ${last}` : "press a key"}</span>
      </div>
      {rows.map((row) => (
        <div key={row.title} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.85 }}>
          <kbd style={{ fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.75, padding: `2px ${t.fontPx * 0.4}px`, borderRadius: 5, border: `1px solid ${t.line}`, background: `${t.muted}18`, minWidth: t.fontPx * 2 , textAlign: "center" }}>{row.title}</kbd>
          <span style={{ color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.body ?? "does something"}</span>
        </div>
      ))}
    </Fill>
  );
}

/** Persistent state along an edge. */
export function StatusBar({ id, content, theme: t, mode }: PartProps) {
  const segments = items(content, ["Connected", "12 items", "Saved just now"]);
  const [clock, setClock] = React.useState("--:--");
  useTicker(mode, 1000, () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));
  return (
    <Fill
      t={t}
      data-part={id}
      style={{ display: "flex", alignItems: "center", gap: t.fontPx, padding: `0 ${t.fontPx * 0.8}px`, borderTop: `1px solid ${t.line}`, background: t.surface, fontSize: t.fontPx * 0.78, color: t.muted, fontFamily: FAMILY.monospace }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: t.accent }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: t.accent, animation: mode === "live" ? "pulse-soft 1.8s ease-in-out infinite" : undefined }} />
        {segments[0]}
      </span>
      {segments.slice(1).map((s) => <span key={s}>{s}</span>)}
      <span style={{ marginLeft: "auto" }}>{clock}</span>
    </Fill>
  );
}

/** Hide the numbers before you share your screen. */
export function BlurPrivacy({ id, content, theme: t, mode }: PartProps) {
  const rows = items(content, ["Balance: $18,402.55", "Revenue: $92,140.00", "Account: 4821 0093"]).map(titled);
  const [hidden, setHidden] = React.useState(false);
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.7, display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.92 }}>Private</strong>
        <button
          type="button"
          aria-pressed={hidden}
          aria-label={hidden ? "Show numbers" : "Hide numbers"}
          onClick={() => setHidden((v) => !v)}
          style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${t.line}`, borderRadius: 999, padding: `2px ${t.fontPx * 0.55}px`, color: t.muted, font: "inherit", fontSize: t.fontPx * 0.75, cursor: mode === "live" ? "pointer" : "default" }}
        >
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.title} style={{ display: "flex", gap: 8, fontSize: t.fontPx * 0.88 }}>
          <span style={{ color: t.muted, flex: 1, minWidth: 0 }}>{row.title}</span>
          <span style={{ filter: hidden ? "blur(6px)" : "none", transition: "filter 160ms", userSelect: hidden ? "none" : "text", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{row.body ?? "—"}</span>
        </div>
      ))}
    </Fill>
  );
}

/** Two regions and a divider you really drag. */
export function SplitPanes({ id, content, theme: t, mode }: PartProps) {
  const [left, right] = items(content, ["Editor", "Preview"]);
  const [ratio, setRatio] = React.useState(0.5);
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef(false);

  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setRatio(Math.max(0.15, Math.min(0.85, (clientX - r.left) / r.width)));
  };

  React.useEffect(() => {
    if (mode !== "live") return;
    const onMove = (e: PointerEvent) => { if (drag.current) move(e.clientX); };
    const onUp = () => { drag.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [mode]);

  const pane = (label: string) => (
    <div style={{ ...cardStyle(t), flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.85 }}>{label}</div>
  );

  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
      <div ref={ref} style={{ flex: 1, display: "flex", minWidth: 0 }}>
        <div style={{ width: `${ratio * 100}%`, display: "flex", minWidth: 0 }}>{pane(left!)}</div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={0}
          onPointerDown={mode === "live" ? () => { drag.current = true; } : undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setRatio((v) => Math.max(0.15, v - 0.05));
            if (e.key === "ArrowRight") setRatio((v) => Math.min(0.85, v + 0.05));
          }}
          style={{ width: 10, flexShrink: 0, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}
        >
          <span style={{ width: 2, height: "40%", borderRadius: 999, background: t.line }} />
        </div>
        <div style={{ width: `${(1 - ratio) * 100}%`, display: "flex", minWidth: 0 }}>{pane(right ?? "Preview")}</div>
      </div>
    </Fill>
  );
}

/** Type commands, see output. `help` lists what it knows. */
export function Console({ id, content, theme: t, mode, emit }: PartProps) {
  const known = items(content, ["help", "pages", "status", "clear"]);
  const [lines, setLines] = React.useState<{ id: number; text: string; kind: "in" | "out" }[]>([
    { id: 0, text: `ready — type "help"`, kind: "out" },
  ]);
  const [draft, setDraft] = React.useState("");
  const next = React.useRef(1);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [lines.length]);

  const run = () => {
    const cmd = draft.trim();
    if (!cmd) return;
    setDraft("");
    if (cmd === "clear") { setLines([]); return; }
    const out =
      cmd === "help" ? `commands: ${known.join(", ")}`
      : cmd === "pages" ? "home, about, contact"
      : cmd === "status" ? "all systems normal"
      : `${cmd}: not found`;
    setLines((xs) => [...xs, { id: next.current++, text: cmd, kind: "in" }, { id: next.current++, text: out, kind: "out" }]);
    if (out.endsWith("not found")) emit?.({ type: "toast", text: out, level: "error" });
  };

  return (
    <Fill
      t={t}
      data-part={id}
      style={{ ...cardStyle(t), background: t.light ? "oklch(0.21 0.01 260)" : "oklch(0.12 0.01 260)", color: "oklch(0.86 0.02 260)", fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.82, padding: t.fontPx * 0.6, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <div style={{ flex: 1, overflow: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {lines.map((l) => (
          <span key={l.id} style={{ color: l.kind === "in" ? t.accent : "inherit", whiteSpace: "pre-wrap" }}>
            {l.kind === "in" ? "› " : ""}{l.text}
          </span>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", borderTop: "1px solid oklch(1 0 0 / .08)", paddingTop: 4 }}>
        <span aria-hidden style={{ color: t.accent }}>›</span>
        <input
          aria-label="Command"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
          placeholder="help"
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "inherit", font: "inherit" }}
        />
      </div>
    </Fill>
  );
}
