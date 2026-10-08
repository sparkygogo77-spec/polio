"use client";
/**
 * Feedback, menus and the small mechanics that make a page feel answerable.
 * These are real: the palette filters, the list reorders, undo undoes. Pointer
 * maths is done as ratios of the element's rect so it survives the preview's
 * scale transform.
 */
import * as React from "react";
import { Btn, Fill, Placeholder, useTicker } from "./primitives";
import { hash, rng, sample, unwritten } from "./sample";
import { cardStyle, items, titled, FAMILY, type Theme, ghostStyle, tint } from "./theme";
import type { PartProps } from "./types";

const soft = (t: Theme): React.CSSProperties => ({ ...cardStyle(t), padding: t.fontPx * 0.7 });

/** Ctrl/Cmd-K to reach everything. Typing really filters. */
export function CommandPalette({ id, content, theme: t, mode, emit }: PartProps) {
  const commands = items(content, ["Go to home", "New page", "Open settings", "Toggle dark mode", "Sign out"]);
  const [query, setQuery] = React.useState("");
  const [cursor, setCursor] = React.useState(0);
  const matches = commands.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()));
  const run = (cmd: string) => { setQuery(""); emit?.({ type: "toast", text: cmd }); };

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: `0 18px 40px ${t.light ? "oklch(0 0 0 / .14)" : "oklch(0 0 0 / .5)"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.7}px`, borderBottom: `1px solid ${t.line}` }}>
        <span aria-hidden style={{ color: t.muted }}>⌕</span>
        <input
          aria-label="Command"
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          placeholder="Type a command…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(matches.length - 1, c + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
            if (e.key === "Enter" && matches[cursor]) run(matches[cursor]!);
          }}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: t.text, font: "inherit", fontSize: t.fontPx * 0.95 }}
        />
        <kbd style={{ fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.68, color: t.muted, border: `1px solid ${t.line}`, borderRadius: 4, padding: "1px 5px" }}>⌘K</kbd>
      </div>
      <ul id={`${id}-list`} role="listbox" style={{ flex: 1, margin: 0, padding: 4, listStyle: "none", overflow: "auto", minHeight: 0 }}>
        {matches.length === 0 ? <li style={{ padding: t.fontPx * 0.5, color: t.muted, fontSize: t.fontPx * 0.85 }}>No commands match.</li> : null}
        {matches.map((c, i) => (
          <li key={c}>
            <button
              type="button"
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => run(c)}
              style={{ width: "100%", textAlign: "left", display: "flex", gap: 8, alignItems: "center", padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.5}px`, borderRadius: Math.min(t.radius, 7), border: "none", background: i === cursor ? `${tint(t.accent, 0.11)}` : "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.88, cursor: mode === "live" ? "pointer" : "default" }}
            >
              <span aria-hidden style={{ color: t.accent }}>›</span>
              {c}
            </button>
          </li>
        ))}
      </ul>
    </Fill>
  );
}

/** Transient notices that replace each other instead of stacking up. */
export function Toasts({ id, content, theme: t, mode }: PartProps) {
  const texts = items(content, ["Saved", "Copied to clipboard", "Couldn't reach the server"]);
  const [shown, setShown] = React.useState<{ id: number; text: string }[]>([{ id: 0, text: texts[0]! }]);
  const next = React.useRef(1);
  const push = () => {
    const text = texts[next.current % texts.length]!;
    const nid = next.current++;
    setShown((xs) => [...xs.filter((x) => x.text !== text).slice(-2), { id: nid, text }]);
    if (mode === "live") window.setTimeout(() => setShown((xs) => xs.filter((x) => x.id !== nid)), 2600);
  };
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, padding: t.fontPx * 0.4 }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <Btn t={t} label="Do the thing" onClick={push} />
      </div>
      <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center", width: "100%" }}>
        {shown.map((x) => (
          <span key={x.id} style={{ padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.8}px`, borderRadius: 999, ...cardStyle(t), fontSize: t.fontPx * 0.82, boxShadow: `0 8px 20px ${t.light ? "oklch(0 0 0 / .12)" : "oklch(0 0 0 / .4)"}`, animation: mode === "live" ? "slide-up var(--motion-base, 200ms) ease-out both" : undefined }}>
            {x.text}
          </span>
        ))}
      </div>
    </Fill>
  );
}

/** Instant feedback: it reads as done, then quietly confirms. */
export function OptimisticUi({ id, content, theme: t, mode, emit }: PartProps) {
  const label = items(content, ["Save"])[0]!;
  const [state, setState] = React.useState<"idle" | "done" | "confirmed">("idle");
  const go = () => {
    setState("done");
    if (mode !== "live") return;
    window.setTimeout(() => { setState("confirmed"); emit?.({ type: "toast", text: "Confirmed by the server", level: "success" }); }, 1100);
  };
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
      <Btn t={t} label={state === "idle" ? label : "✓ " + label + "d"} primary={state === "idle"} onClick={go} />
      <span aria-live="polite" style={{ color: state === "confirmed" ? t.accent : t.muted, fontSize: t.fontPx * 0.78 }}>
        {state === "idle" ? "reads as done immediately" : state === "done" ? "syncing…" : "confirmed"}
      </span>
    </Fill>
  );
}

/** Sound on key actions — off unless someone asks for it. */
export function SoundCues({ id, content, options, theme: t, mode }: PartProps) {
  const [on, setOn] = React.useState(options.default === "on");
  const [ping, setPing] = React.useState(0);
  const label = items(content, ["Sound"])[0]!;
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn((v) => !v)}
        style={{ width: t.fontPx * 2.6, height: t.fontPx * 1.4, borderRadius: 999, border: `1px solid ${t.line}`, background: on ? t.accent : t.surface, position: "relative", cursor: mode === "live" ? "pointer" : "default", flexShrink: 0 }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? "calc(100% - 2px)" : 2, transform: on ? "translateX(-100%)" : "none", width: t.fontPx * 1.1, height: t.fontPx * 1.1, borderRadius: 999, background: on ? t.accentText : t.muted, transition: "left 150ms, transform 150ms" }} />
      </button>
      <span style={{ flex: 1, minWidth: 0, fontSize: t.fontPx * 0.85 }}>
        <strong style={{ display: "block", fontWeight: 600 }}>{label}</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{on ? "a short click on every action" : "silent"}</span>
      </span>
      <button
        type="button"
        onClick={() => setPing((p) => p + 1)}
        style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${t.line}`, background: "transparent", borderRadius: 999, padding: `2px ${t.fontPx * 0.55}px`, color: t.muted, font: "inherit", fontSize: t.fontPx * 0.75, cursor: mode === "live" ? "pointer" : "default" }}
      >
        Try it
      </button>
      <span key={ping} aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: on ? t.accent : `${tint(t.muted, 0.333)}`, animation: ping && mode === "live" ? "pop var(--motion-base, 160ms) ease-out" : undefined }} />
    </Fill>
  );
}

/** A short buzz where the device can do it. */
export function Haptics({ id, content, theme: t, mode, emit }: PartProps) {
  const patterns = items(content, ["Tap: 10", "Success: 10,40,10", "Error: 60,30,60"]).map(titled);
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>Vibration, on phones that support it</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {patterns.map((p) => (
          <Btn
            key={p.title}
            t={t}
            label={p.title}
            primary={false}
            onClick={() => {
              const ms = (p.body ?? "10").split(",").map((n) => Number(n.trim()) || 10);
              if (mode === "live") navigator.vibrate?.(ms);
              emit?.({ type: "toast", text: `${p.title}, ${ms.join("/")}ms` });
            }}
            style={{ fontSize: t.fontPx * 0.8 }}
          />
        ))}
      </div>
    </Fill>
  );
}

/** A menu of your own on right-click, instead of the browser's. */
export function ContextMenus({ id, content, theme: t, mode, emit }: PartProps) {
  const entries = items(content, ["Open", "Rename", "Duplicate", "Delete"]);
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <Fill
      t={t}
      data-part={id}
      ref={ref}
      onContextMenu={mode === "live" ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = ref.current?.getBoundingClientRect();
        if (!r || !r.width) return;
        setAt({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      } : undefined}
      onClick={() => setAt(null)}
      style={{ ...ghostStyle(t), display: "flex", alignItems: "center", justifyContent: "center", color: t.muted, fontSize: t.fontPx * 0.85, textAlign: "center", padding: t.fontPx * 0.5 }}
    >
      Right-click anywhere in here
      {at ? (
        <div
          role="menu"
          style={{ position: "absolute", left: `${Math.min(at.x, 62)}%`, top: `${Math.min(at.y, 55)}%`, minWidth: 128, ...cardStyle(t), padding: 4, textAlign: "left", boxShadow: `0 12px 30px ${t.light ? "oklch(0 0 0 / .16)" : "oklch(0 0 0 / .5)"}`, zIndex: 2 }}
        >
          {entries.map((e) => (
            <button
              key={e}
              type="button"
              role="menuitem"
              onClick={() => { setAt(null); emit?.({ type: "toast", text: e }); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: `${t.fontPx * 0.3}px ${t.fontPx * 0.5}px`, border: "none", background: "transparent", borderRadius: 5, color: /delete/i.test(e) ? "oklch(0.72 0.18 25)" : t.text, font: "inherit", fontSize: t.fontPx * 0.82, cursor: "pointer" }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </Fill>
  );
}

/** One click to copy, and a moment of proof. */
export function CopyButton({ id, content, theme: t, mode, emit }: PartProps) {
  /* Nothing typed: a sample on the board, nothing on the published page (never this tool's own command). */
  const value = items(content, [unwritten(mode, () => "npm create site@latest", "the value to copy", t.published)])[0] ?? "";
  const [copied, setCopied] = React.useState(false);
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: `${t.fontPx * 0.45}px ${t.fontPx * 0.6}px`, ...cardStyle(t), fontFamily: FAMILY.monospace, fontSize: t.fontPx * 0.82 }}>{value}</code>
      <Btn
        t={t}
        label={copied ? "Copied ✓" : "Copy"}
        primary={!copied}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          emit?.({ type: "toast", text: "Copied", level: "success" });
          if (mode === "live") window.setTimeout(() => setCopied(false), 1600);
        }}
      />
    </Fill>
  );
}

/** A richer look at what a link points to, without leaving the page. */
export function HoverCard({ id, content, theme: t, mode }: PartProps) {
  const [name, ...rest] = items(content, ["Ada Okafor", "Builds things that stay built."]);
  const [open, setOpen] = React.useState(false);
  return (
    <Fill t={t} data-part={id} overflow="visible" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: t.fontPx * 0.4 }}>
      <span style={{ position: "relative" }}>
        <button
          type="button"
          aria-describedby={open ? `${id}-card` : undefined}
          onMouseEnter={mode === "live" ? () => setOpen(true) : undefined}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          style={{ background: "transparent", border: "none", padding: 0, color: t.accent, font: "inherit", fontSize: t.fontPx * 0.95, textDecoration: "underline", textUnderlineOffset: 3, cursor: mode === "live" ? "pointer" : "default" }}
        >
          {name}
        </button>
        {open ? (
          <span id={`${id}-card`} role="tooltip" style={{ position: "absolute", left: "50%", top: "calc(100% + 8px)", transform: "translateX(-50%)", width: 200, ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", gap: 8, boxShadow: `0 12px 30px ${t.light ? "oklch(0 0 0 / .14)" : "oklch(0 0 0 / .45)"}`, zIndex: 3, textAlign: "left" }}>
            <span aria-hidden style={{ width: t.fontPx * 2.2, height: t.fontPx * 2.2, borderRadius: 999, background: `${tint(t.accent, 0.267)}`, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: "block", fontSize: t.fontPx * 0.85 }}>{name}</strong>
              <span style={{ color: t.muted, fontSize: t.fontPx * 0.76 }}>{rest[0] ?? unwritten(mode, () => sample.sentence(rng(hash(name!)), 8), name!, t.published)}</span>
            </span>
          </span>
        ) : null}
      </span>
    </Fill>
  );
}

/** Short explanations, on demand, never in the way. */
export function Tooltips({ id, content, theme: t, mode }: PartProps) {
  const entries = items(content, ["Bold: makes the text heavier", "Link: adds a web address", "Clear: removes all formatting"]).map(titled);
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <Fill t={t} data-part={id} overflow="visible" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: t.fontPx * 0.4 }}>
      {entries.map((e) => (
        <span key={e.title} style={{ position: "relative" }}>
          <button
            type="button"
            aria-label={e.title}
            aria-describedby={open === e.title ? `${id}-${e.title}` : undefined}
            onMouseEnter={mode === "live" ? () => setOpen(e.title) : undefined}
            onMouseLeave={() => setOpen(null)}
            onFocus={() => setOpen(e.title)}
            onBlur={() => setOpen(null)}
            style={{ padding: `${t.fontPx * 0.35}px ${t.fontPx * 0.6}px`, borderRadius: Math.min(t.radius, 8), border: `1px solid ${t.line}`, background: "transparent", color: t.text, font: "inherit", fontSize: t.fontPx * 0.82, cursor: mode === "live" ? "pointer" : "default" }}
          >
            {e.title}
          </button>
          {open === e.title ? (
            <span id={`${id}-${e.title}`} role="tooltip" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 6px)", transform: "translateX(-50%)", whiteSpace: "nowrap", padding: `${t.fontPx * 0.25}px ${t.fontPx * 0.5}px`, borderRadius: 6, background: t.text, color: t.bg, fontSize: t.fontPx * 0.72, zIndex: 3 }}>
              {e.body ?? "What this does"}
            </span>
          ) : null}
        </span>
      ))}
    </Fill>
  );
}

/** The shape of the content while it loads, not a spinner. */
export function Skeletons({ id, content, theme: t, mode }: PartProps) {
  const [loaded, setLoaded] = React.useState(false);
  const lines = items(content, ["A headline that arrives", "and the sentence under it that follows a moment later."]);
  useTicker(mode, 2600, () => setLoaded((v) => !v));
  const shimmer: React.CSSProperties = {
    borderRadius: 4,
    background: `linear-gradient(90deg, ${tint(t.muted, 0.122)} 25%, ${tint(t.muted, 0.227)} 37%, ${tint(t.muted, 0.122)} 63%)`,
    backgroundSize: "200% 100%",
    animation: mode === "live" ? "shimmer 1.4s linear infinite" : undefined,
  };
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", gap: 10, alignItems: "flex-start" }}>
      {loaded ? <Placeholder t={t} /> : <span style={{ ...shimmer, width: t.fontPx * 3.4, height: t.fontPx * 3.4, borderRadius: Math.min(t.radius, 8), flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {loaded ? (
          <>
            <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.98 }}>{lines[0]}</strong>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.85 }}>{lines[1]}</span>
          </>
        ) : (
          <>
            <span style={{ ...shimmer, height: t.fontPx * 1.1, width: "70%" }} />
            <span style={{ ...shimmer, height: t.fontPx * 0.8, width: "100%" }} />
            <span style={{ ...shimmer, height: t.fontPx * 0.8, width: "84%" }} />
          </>
        )}
      </div>
    </Fill>
  );
}

/** Rearrange by dragging. The order really changes. */
export function DragDrop({ id, content, theme: t, mode, emit }: PartProps) {
  const [order, setOrder] = React.useState(() => items(content, ["First", "Second", "Third", "Fourth"]));
  const from = React.useRef<number | null>(null);
  const drop = (to: number) => {
    const i = from.current;
    from.current = null;
    if (i === null || i === to) return;
    setOrder((xs) => { const next = [...xs]; const [moved] = next.splice(i, 1); next.splice(to, 0, moved!); return next; });
    emit?.({ type: "toast", text: "Reordered" });
  };
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 5, overflow: "auto" }}>
      {order.map((item, i) => (
        <div
          key={item}
          draggable={mode === "live"}
          onDragStart={() => { from.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); drop(i); }}
          style={{ ...cardStyle(t), padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.6}px`, display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.88, cursor: mode === "live" ? "grab" : "default" }}
        >
          <span aria-hidden style={{ color: t.muted, letterSpacing: 1 }}>⠿</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item}</span>
          <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>{i + 1}</span>
        </div>
      ))}
    </Fill>
  );
}

/** Every action reversible, with the history to prove it. */
export function UndoRedo({ id, content, theme: t, emit }: PartProps) {
  const label = items(content, ["Count"])[0]!;
  const [past, setPast] = React.useState<number[]>([]);
  const [value, setValue] = React.useState(0);
  const [future, setFuture] = React.useState<number[]>([]);
  const change = (delta: number) => { setPast((p) => [...p, value]); setValue((v) => v + delta); setFuture([]); };
  const undo = () => { if (!past.length) return; setFuture((f) => [value, ...f]); setValue(past[past.length - 1]!); setPast((p) => p.slice(0, -1)); emit?.({ type: "toast", text: "Undone" }); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, value]); setValue(future[0]!); setFuture((f) => f.slice(1)); emit?.({ type: "toast", text: "Redone" }); };
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: t.headingFamily, fontWeight: 800, fontSize: t.fontPx * 1.6, fontVariantNumeric: "tabular-nums" }}>{label} {value}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn t={t} label="Change" onClick={() => change(1)} />
        <Btn t={t} label="Undo" primary={false} onClick={undo} style={{ opacity: past.length ? 1 : 0.4 }} />
        <Btn t={t} label="Redo" primary={false} onClick={redo} style={{ opacity: future.length ? 1 : 0.4 }} />
      </div>
      <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>{past.length} back · {future.length} forward</span>
    </Fill>
  );
}

/** Points, a level, a streak — the reason to come back tomorrow. */
export function Gamification({ id, content, theme: t, emit }: PartProps) {
  const [pointsName, ...rest] = items(content, ["Points", "Level 4", "6-day streak"]);
  const [points, setPoints] = React.useState(340);
  const level = Math.floor(points / 100);
  const within = points % 100;
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.3, fontVariantNumeric: "tabular-nums" }}>{points.toLocaleString()}</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.8 }}>{pointsName}</span>
        <span style={{ marginLeft: "auto", background: `${tint(t.accent, 0.133)}`, color: t.accent, borderRadius: 999, padding: "1px 8px", fontSize: t.fontPx * 0.72, fontWeight: 700 }}>{rest[0] ?? `Level ${level}`}</span>
      </div>
      <span role="progressbar" aria-valuenow={within} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level" style={{ height: 6, borderRadius: 999, background: `${tint(t.muted, 0.149)}`, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${within}%`, height: "100%", background: `linear-gradient(90deg, ${t.accent}, ${t.highlight})`, transition: "width 240ms" }} />
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.76 }}>{rest[1] ?? "6-day streak"}</span>
        <span style={{ marginLeft: "auto" }}>
          <Btn t={t} label="+20" onClick={() => { setPoints((p) => p + 20); emit?.({ type: "toast", text: "+20", level: "success" }); }} style={{ fontSize: t.fontPx * 0.78 }} />
        </span>
      </div>
    </Fill>
  );
}

/** Wire steps together. Adding one really adds it. */
export function WorkflowBuilder({ id, content, theme: t, emit }: PartProps) {
  const [steps, setSteps] = React.useState(() => items(content, ["When a form is sent", "Add to the list", "Send an email"]));
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "auto" }}>
      {steps.map((step, i) => (
        <React.Fragment key={step + i}>
          <div style={{ ...cardStyle(t), padding: `${t.fontPx * 0.4}px ${t.fontPx * 0.6}px`, display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.85 }}>
            <span aria-hidden style={{ width: t.fontPx * 1.4, height: t.fontPx * 1.4, borderRadius: 999, background: i === 0 ? t.accent : `${tint(t.accent, 0.165)}`, color: i === 0 ? t.accentText : t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 0.7, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step}</span>
            <button type="button" aria-label={`Remove ${step}`} onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", color: t.muted, cursor: "pointer", font: "inherit" }}>×</button>
          </div>
          {i < steps.length - 1 ? <span aria-hidden style={{ alignSelf: "center", color: t.line, lineHeight: 0.6 }}>↓</span> : null}
        </React.Fragment>
      ))}
      <button
        type="button"
        onClick={() => { setSteps((xs) => [...xs, `Then ${sample.word(rng(hash(String(steps.length))))}`]); emit?.({ type: "toast", text: "Step added" }); }}
        style={{ ...ghostStyle(t), padding: t.fontPx * 0.4, color: t.muted, font: "inherit", fontSize: t.fontPx * 0.8, cursor: "pointer", background: "transparent" }}
      >
        + Add a step
      </button>
    </Fill>
  );
}

/** Let people change how the site behaves. */
export function SettingsPanel({ id, content, theme: t, emit }: PartProps) {
  const rows = items(content, ["Reduce motion: off", "Compact rows: off", "Text size: 100"]).map(titled);
  const [state, setState] = React.useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.title, r.body ?? "off"])));
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: t.fontPx * 0.45, overflow: "auto" }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.92 }}>Settings</strong>
      {rows.map((row) => {
        const numeric = /^\d+$/.test(state[row.title] ?? "");
        return (
          <label key={row.title} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.85 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: t.muted }}>{row.title}</span>
            {numeric ? (
              <input
                type="range"
                min={80}
                max={140}
                value={Number(state[row.title])}
                onChange={(e) => setState((s) => ({ ...s, [row.title]: e.target.value }))}
                style={{ width: "45%", accentColor: t.accent }}
              />
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={state[row.title] === "on"}
                aria-label={row.title}
                onClick={() => { const next = state[row.title] === "on" ? "off" : "on"; setState((s) => ({ ...s, [row.title]: next })); emit?.({ type: "toast", text: `${row.title} ${next}` }); }}
                style={{ width: t.fontPx * 2.4, height: t.fontPx * 1.3, borderRadius: 999, border: `1px solid ${t.line}`, background: state[row.title] === "on" ? t.accent : t.surface, position: "relative", cursor: "pointer", flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 2, left: state[row.title] === "on" ? "calc(100% - 2px)" : 2, transform: state[row.title] === "on" ? "translateX(-100%)" : "none", width: t.fontPx, height: t.fontPx, borderRadius: 999, background: state[row.title] === "on" ? t.accentText : t.muted, transition: "left 150ms, transform 150ms" }} />
              </button>
            )}
          </label>
        );
      })}
    </Fill>
  );
}

/** The first thirty seconds, and the guided walk through. */
export function Onboarding({ id, content, theme: t, mode, emit }: PartProps) {
  const tour = id === "onboarding-tour";
  const steps = items(content, tour ? ["This is the board", "Drop parts here", "Press Finish when it looks right"] : ["Start a page", "Pick a look", "Say what it is for"]).map(titled);
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState<Record<number, boolean>>({});

  if (tour) {
    const current = steps[Math.min(step, steps.length - 1)]!;
    return (
      <Fill t={t} data-part={id} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: Math.min(t.radius, 10), background: `${tint(t.muted, 0.071)}` }}>
        <span aria-hidden style={{ position: "absolute", left: `${18 + step * 26}%`, top: "26%", width: t.fontPx * 3, height: t.fontPx * 3, borderRadius: 8, boxShadow: `0 0 0 9999px ${t.light ? "oklch(0 0 0 / .45)" : "oklch(0 0 0 / .6)"}`, border: `2px solid ${t.accent}`, transition: "left 220ms" }} />
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "8%", ...cardStyle(t), padding: t.fontPx * 0.6, display: "flex", alignItems: "center", gap: 8, zIndex: 2 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: t.fontPx * 0.88 }}>{current.title}</strong>
            <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{current.body ?? `Step ${step + 1} of ${steps.length}`}</span>
          </span>
          <Btn
            t={t}
            label={step < steps.length - 1 ? "Next" : "Done"}
            onClick={() => (step < steps.length - 1 ? setStep((s) => s + 1) : emit?.({ type: "toast", text: "Tour finished", level: "success" }))}
            style={{ fontSize: t.fontPx * 0.78 }}
          />
        </div>
      </Fill>
    );
  }

  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: t.fontPx * 0.4, overflow: "auto" }}>
      <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 1.05 }}>Welcome, three things to try</strong>
      {steps.map((s, i) => (
        <button
          key={s.title}
          type="button"
          onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: `${t.fontPx * 0.3}px 0`, background: "transparent", border: "none", color: t.text, font: "inherit", fontSize: t.fontPx * 0.85, cursor: mode === "live" ? "pointer" : "default", textAlign: "left" }}
        >
          <span style={{ width: t.fontPx * 1.2, height: t.fontPx * 1.2, borderRadius: 999, border: `2px solid ${done[i] ? t.accent : t.line}`, background: done[i] ? t.accent : "transparent", color: t.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: t.fontPx * 0.6, flexShrink: 0 }}>{done[i] ? "✓" : ""}</span>
          <span style={{ flex: 1, minWidth: 0, textDecoration: done[i] ? "line-through" : "none", color: done[i] ? t.muted : t.text }}>{s.title}</span>
        </button>
      ))}
    </Fill>
  );
}

/** A button that leans toward the pointer. */
export function MagneticButton({ id, content, theme: t, mode, emit, link, onNavigate }: PartProps) {
  const label = items(content, ["Get started"])[0]!;
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const ref = React.useRef<HTMLDivElement>(null);
  return (
    <Fill
      t={t}
      data-part={id}
      ref={ref}
      onMouseMove={mode === "live" ? (e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !r.width) return;
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        setOffset({ x: dx * 26, y: dy * 16 });
      } : undefined}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <span style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, transition: "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {/* Where it links, when it links; its own name as a toast when it does not. */}
        <Btn t={t} label={label} onClick={() => (link ? onNavigate?.(link) : emit?.({ type: "toast", text: label }))} />
      </span>
    </Fill>
  );
}

/** Something for the people who poke around. */
export function EasterEgg({ id, content, theme: t, mode, emit }: PartProps) {
  const [prize, ...rest] = items(content, ["You found it.", "Click the mark three times"]);
  const [taps, setTaps] = React.useState(0);
  const found = taps >= 3;
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexDirection: "column", textAlign: "center" }}>
      <button
        type="button"
        aria-label="A mark"
        onClick={() => { const n = taps + 1; setTaps(n); if (n === 3) emit?.({ type: "toast", text: prize!, level: "success" }); }}
        style={{ width: t.fontPx * 2.6, height: t.fontPx * 2.6, borderRadius: found ? 8 : 999, border: "none", cursor: mode === "live" ? "pointer" : "default", background: found ? `linear-gradient(135deg, ${t.accent}, ${t.highlight})` : `${tint(t.muted, 0.165)}`, color: found ? t.accentText : t.muted, fontSize: t.fontPx * 1.1, transition: "border-radius 220ms, background 220ms" }}
      >
        {found ? "★" : "◆"}
      </button>
      <span style={{ color: found ? t.accent : t.muted, fontSize: t.fontPx * 0.8 }}>{found ? prize : rest[0] ?? "Nothing to see here"}</span>
    </Fill>
  );
}

/** Simple by default, everything there when you dig. */
export function Graduation({ id, content, theme: t, mode }: PartProps) {
  const rows = items(content, ["Title", "Web address", "Description", "Open Graph image", "Canonical URL", "Robots directives"]);
  const [deep, setDeep] = React.useState(false);
  const shown = deep ? rows : rows.slice(0, 2);
  return (
    <Fill t={t} data-part={id} style={{ ...soft(t), display: "flex", flexDirection: "column", gap: 5, overflow: "auto" }}>
      {shown.map((row) => (
        <label key={row} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.82 }}>
          <span style={{ width: "38%", color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row}</span>
          <span style={{ flex: 1, height: t.fontPx * 1.5, borderRadius: Math.min(t.radius, 7), border: `1px solid ${t.line}` }} />
        </label>
      ))}
      <button
        type="button"
        aria-expanded={deep}
        onClick={() => setDeep((v) => !v)}
        style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, color: t.accent, font: "inherit", fontSize: t.fontPx * 0.8, cursor: mode === "live" ? "pointer" : "default" }}
      >
        {deep ? "Show less" : `Advanced (${rows.length - 2} more)`}
      </button>
    </Fill>
  );
}
