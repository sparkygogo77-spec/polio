"use client";
/**
 * A token's value as a control, and the light on the board its "used by"
 * press gives.
 *
 * Every control writes on the commit only (Enter, leaving the field, a
 * colour picker closing), never on each keystroke or each step of a drag, so
 * one change is one undo step (`system/api.ts`), and a value the System
 * refuses puts the field back to what the token holds.
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { pointAt } from "../../SiteColours";
import { parseColor, toHex } from "../../look";
import type { TokenKind } from "../../system/model";

const hexOf = (v: string) => { const c = parseColor(v); return c ? toHex(c) : "#000000"; };
export const isSize = (k: TokenKind) => k === "type" || k === "space" || k === "radius";

/** Text or a number, written when it is committed. */
export function CommitInput({ value, onCommit, mono, className, label, numeric, autoFocus }: {
  value: string | number; onCommit: (v: string) => boolean | void; mono?: boolean; className?: string; label: string; numeric?: boolean; autoFocus?: boolean;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(value);
  const commit = () => {
    if (draft === null) return;
    const ok = draft.trim() !== String(value) ? onCommit(draft.trim()) : true;
    if (ok === false) play("deny");
    setDraft(null);
  };
  return (
    <Input
      aria-label={label}
      autoFocus={autoFocus}
      mono={mono}
      inputMode={numeric ? "decimal" : undefined}
      className={cn("h-6 min-w-0", className)}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
        if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

/** A colour box: the box is the colour. Written when the picker closes (the native `change`), not on every hue it passes. */
export function ColourBox({ value, onCommit, label }: { value: string; onCommit: (hex: string) => void; label: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const commit = React.useRef(onCommit);
  commit.current = onCommit;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => commit.current(el.value);
    el.addEventListener("change", on);
    return () => el.removeEventListener("change", on);
  }, []);
  return (
    <label className="tactile relative size-6 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-border" style={{ background: value }} title={label}>
      <input ref={ref} type="color" aria-label={label} defaultValue={hexOf(value)} key={hexOf(value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
    </label>
  );
}

/** The control for a token's value, by its kind. `onCommit` says whether the System took it. */
export function TokenValue({ kind, value, onCommit, label }: { kind: TokenKind; value: string | number; onCommit: (v: string | number) => boolean; label: string }) {
  if (kind === "colour") {
    return (
      /* Never narrower than a colour's words: the row wraps first (tokens.tsx). */
      <span className="flex min-w-[8.5rem] flex-1 items-center gap-1">
        <ColourBox value={String(value)} label={label} onCommit={(hex) => { if (!onCommit(hex)) play("deny"); }} />
        <CommitInput mono label={label} value={value} onCommit={(v) => onCommit(v)} className="flex-1" />
      </span>
    );
  }
  if (isSize(kind)) {
    return (
      <span className="flex items-center gap-1">
        <CommitInput numeric mono label={label} value={value} onCommit={(v) => onCommit(Number(v))} className="w-14" />
        <span className="text-small text-fg-muted">px</span>
      </span>
    );
  }
  return <CommitInput mono label={label} value={value} onCommit={(v) => onCommit(v)} className="min-w-[8.5rem] flex-1" />;
}

/* ------------------------------------------------------------------ */
/* Lighting parts on the board                                         */
/* ------------------------------------------------------------------ */

/** Which press has the board lit now: one at a time, so a second press on another count moves the light. */
let litBy: string | null = null;
const litListeners = new Set<() => void>();
export function light(key: string | null, ids: string[] | null) {
  litBy = key;
  pointAt(key ? ids : null);
  for (const l of litListeners) l();
}
export function useLit(): string | null {
  return React.useSyncExternalStore(
    (l) => { litListeners.add(l); return () => { litListeners.delete(l); }; },
    () => litBy,
    () => null,
  );
}

/** "used by 23": pressing it lights those parts on the board; pressing again puts the light out. */
export function UsedBy({ id, count, ids, word = "used by" }: { id: string; count: number; ids: () => string[]; word?: string }) {
  const lit = useLit() === id;
  return (
    <button
      type="button"
      data-used-by={id}
      aria-pressed={lit}
      disabled={!count}
      title={count ? "Light them on the board" : "Nothing points at it"}
      onClick={() => { play("tap"); light(lit ? null : id, lit ? null : ids()); }}
      className={cn("tactile shrink-0 whitespace-nowrap rounded-sm px-1 text-small tabular-nums", lit ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg", !count && "opacity-50")}
    >
      {word} {count.toLocaleString()}
    </button>
  );
}
