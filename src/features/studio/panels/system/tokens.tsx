"use client";
/**
 * THE TOKENS, BY KIND, as the proposal draws them (CREATE-SYSTEM-PROPOSAL.md
 * (c)): Colours, Type, Space and shape, Motion.
 *
 * Each row is one token: its name (press to rename), its value (change it and
 * every part pointing at it changes, here and on every site using the
 * System, in one undo step), "used by" with how many fields point at it
 * (press: those parts light on the board), and take it out (the parts keep
 * the value they show).
 *
 * CLOSE SHADES FOLD. A captured site wears many near-identical greys; the
 * take groups them (`swatch`, `siteRoles.ts`) and marks one the lead. Only
 * the lead shows; the rest are one press away under it.
 */
import * as React from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { contrastOf } from "../../look";
import { addToken, removeToken, renameToken, setToken, usedBy } from "../../system/api";
import { valueOf, type ColourToken, type CssToken, type FaceToken, type SizeToken, type System, type TokenKind } from "../../system/model";
import { CommitInput, TokenValue, UsedBy, isSize } from "./values";

type AnyToken = ColourToken | SizeToken | CssToken | FaceToken;

/** What a person calls one of each kind, for labels and the add row. */
export const KIND_WORD: Record<TokenKind, string> = {
  colour: "colour", type: "text size", face: "face", space: "space step", radius: "corner", shadow: "shadow", duration: "duration", easing: "easing",
};
/** What a new token of a kind starts as. */
const START: Record<TokenKind, string | number> = { colour: "#888888", type: 16, face: "system-ui, sans-serif", space: 8, radius: 6, shadow: "0 2px 8px rgba(0, 0, 0, 0.2)", duration: "0.2s", easing: "ease-out" };

/** A token's name: a word you press to change. */
function TokenName({ token }: { token: AnyToken }) {
  const [editing, setEditing] = React.useState(false);
  if (editing) {
    return (
      <span className="w-24 shrink-0" onBlur={() => setEditing(false)}>
        <CommitInput autoFocus label={`Name of ${token.name}`} value={token.name} onCommit={(v) => { const r = renameToken(token.id, v); setEditing(false); return !("ok" in r && r.ok === false); }} />
      </span>
    );
  }
  return (
    <button type="button" data-token-name="" title="Rename" onClick={() => setEditing(true)} className="tactile w-24 shrink-0 truncate text-left text-small text-fg">
      {token.name}
    </button>
  );
}

export function TokenRow({ kind, token, counts, note, children }: { kind: TokenKind; token: AnyToken; counts: Map<string, number>; note?: React.ReactNode; children?: React.ReactNode }) {
  const label = `${token.name}, ${KIND_WORD[kind]}`;
  return (
    <div data-token-row={token.id} data-token-kind={kind} className="group flex min-w-0 items-center gap-1.5 py-0.5">
      <TokenName token={token} />
      <TokenValue kind={kind} value={valueOf(token)} label={label} onCommit={(v) => { const r = setToken(token.id, v); return !("ok" in r && r.ok === false); }} />
      {note}
      <UsedBy id={token.id} count={counts.get(token.id) ?? 0} ids={() => usedBy(token.id)} />
      {children}
      <button
        type="button" aria-label={`Take ${token.name} out`} title="Take it out: the parts keep the value they show"
        onClick={() => { play("close"); removeToken(token.id); }}
        className="tactile shrink-0 rounded-sm p-0.5 text-fg-faint opacity-0 hover:text-down focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/** "+ add a colour": a name and a value, then Add. */
function AddRow({ kind }: { kind: TokenKind }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [value, setValue] = React.useState<string | number>(START[kind]);
  const [says, setSays] = React.useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" data-add-token={kind} onClick={() => { play("open"); setOpen(true); }} className="tactile flex items-center gap-1 py-0.5 text-small text-fg-muted hover:text-fg">
        <Plus className="size-3" /> add a {KIND_WORD[kind]}
      </button>
    );
  }
  const add = () => {
    const r = addToken(kind, name || `New ${KIND_WORD[kind]}`, isSize(kind) ? Number(value) : value);
    if (!r.ok) { setSays(r.says); play("deny"); return; }
    play("confirm");
    setOpen(false); setName(""); setValue(START[kind]); setSays(null);
  };
  return (
    <div data-add-row={kind} className="space-y-1 rounded-sm border border-border p-1.5">
      <div className="flex items-center gap-1.5">
        <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-6 w-24 rounded-sm border border-border bg-elevated px-1.5 text-small" />
        <input aria-label="Value" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} className="h-6 min-w-0 flex-1 rounded-sm border border-border bg-elevated px-1.5 font-mono text-small" />
      </div>
      {says ? <p className="text-small text-down">{says}</p> : null}
      <div className="flex justify-end gap-1">
        <Button size="xs" variant="ghost" onClick={() => { setOpen(false); setSays(null); }}>Cancel</Button>
        <Button size="xs" variant="primary" data-add-confirm="" onClick={add}>Add</Button>
      </div>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <h4 className="pt-1.5 text-small uppercase tracking-[0.12em] text-fg-faint">{children}</h4>;
}

function List({ kind, tokens, counts, empty }: { kind: TokenKind; tokens: readonly AnyToken[]; counts: Map<string, number>; empty?: string }) {
  return (
    <div data-token-list={kind}>
      {tokens.length ? tokens.map((t) => <TokenRow key={t.id} kind={kind} token={t} counts={counts} />) : <p className="text-small text-fg-faint">{empty ?? `No ${KIND_WORD[kind]}s yet.`}</p>}
      <AddRow kind={kind} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

/** The colour tokens in folds: each swatch's lead, with its close shades under it. Tokens with no swatch stand alone. */
export function foldShades(list: readonly ColourToken[]): { lead: ColourToken; shades: ColourToken[] }[] {
  const out: { lead: ColourToken; shades: ColourToken[] }[] = [];
  const bySwatch = new Map<string, { lead: ColourToken; shades: ColourToken[] }>();
  for (const t of list) {
    if (!t.swatch || t.role) { out.push({ lead: t, shades: [] }); continue; }
    const had = bySwatch.get(t.swatch);
    if (!had) { const g = { lead: t, shades: [] as ColourToken[] }; bySwatch.set(t.swatch, g); out.push(g); continue; }
    /* The lead leads, wherever it came in the list. */
    if (t.lead && !had.lead.lead) { had.shades.unshift(had.lead); had.lead = t; } else had.shades.push(t);
  }
  return out;
}

/** The accent read on the background, as the drawing has it: "contrast on bg 5.1 ok". */
function contrastNote(s: System, t: ColourToken): React.ReactNode {
  if (t.role !== "accent") return null;
  const bg = s.tokens.colour.find((c) => c.role === "bg");
  if (!bg) return null;
  const r = contrastOf(t.value, bg.value);
  const ok = r >= 4.5;
  return (
    <span data-contrast={r.toFixed(1)} title="Contrast on the background: 4.5 or more reads as text" className={cn("shrink-0 whitespace-nowrap text-small tabular-nums", ok ? "text-up" : "text-down")}>
      {r.toFixed(1)} {ok ? "ok" : "low"}
    </span>
  );
}

function ColourFold({ s, lead, shades, counts }: { s: System; lead: ColourToken; shades: ColourToken[]; counts: Map<string, number> }) {
  const [open, setOpen] = React.useState(false);
  const all = shades.reduce((a, t) => a + (counts.get(t.id) ?? 0), 0);
  return (
    <div data-colour-fold={lead.id}>
      <TokenRow kind="colour" token={lead} counts={counts} note={contrastNote(s, lead)} />
      {shades.length ? (
        <button type="button" data-shades={shades.length} aria-expanded={open} onClick={() => { play(open ? "close" : "open"); setOpen(!open); }} className="tactile ml-[6.5rem] flex items-center gap-1 text-small text-fg-muted hover:text-fg">
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          {shades.length} close {shades.length === 1 ? "shade" : "shades"}
          <span className="flex">{shades.slice(0, 6).map((t) => <span key={t.id} className="-ml-0.5 size-2.5 rounded-full border border-border first:ml-0" style={{ background: t.value }} />)}</span>
          <span className="tabular-nums text-fg-faint">· {all.toLocaleString()}</span>
        </button>
      ) : null}
      {open ? <div className="ml-3 border-l border-border pl-2">{shades.map((t) => <TokenRow key={t.id} kind="colour" token={t} counts={counts} />)}</div> : null}
    </div>
  );
}

export function ColourTokens({ s, counts }: { s: System; counts: Map<string, number> }) {
  const folds = React.useMemo(() => foldShades(s.tokens.colour), [s.tokens.colour]);
  return (
    <div data-token-list="colour">
      {folds.map((g) => <ColourFold key={g.lead.id} s={s} lead={g.lead} shades={g.shades} counts={counts} />)}
      {folds.length ? null : <p className="text-small text-fg-faint">No colours yet.</p>}
      <AddRow kind="colour" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Type, space and shape, motion                                       */
/* ------------------------------------------------------------------ */

export function TypeTokens({ s, counts }: { s: System; counts: Map<string, number> }) {
  const scale = s.tokens.type.scale;
  return (
    <div className="space-y-1">
      <Head>Faces</Head>
      <List kind="face" tokens={s.tokens.type.faces} counts={counts} />
      <Head>Text sizes</Head>
      {/* The nearest even scale is offered, never forced: snapping the sizes to it is the better-version step's. */}
      {scale ? (
        <p data-type-scale={scale.ratio} className="text-small text-fg-muted">
          Nearest even scale {scale.ratio} from base {scale.base}px: {[3, 2, 1, 0, -1].map((k) => Math.round(scale.base * scale.ratio ** k)).join(" / ")}
        </p>
      ) : null}
      <List kind="type" tokens={s.tokens.type.steps} counts={counts} />
    </div>
  );
}

export function ShapeTokens({ s, counts }: { s: System; counts: Map<string, number> }) {
  return (
    <div className="space-y-1">
      <Head>Space steps</Head>
      <List kind="space" tokens={s.tokens.space} counts={counts} />
      <Head>Corners</Head>
      <List kind="radius" tokens={s.tokens.radius} counts={counts} />
      <Head>Shadows</Head>
      <div data-token-list="shadow">
        {s.tokens.shadow.map((t) => (
          <TokenRow key={t.id} kind="shadow" token={t} counts={counts}
            note={<span data-shadow-chip="" aria-hidden className="size-4 shrink-0 rounded-sm bg-elevated" style={{ boxShadow: t.css }} />} />
        ))}
        {s.tokens.shadow.length ? null : <p className="text-small text-fg-faint">No shadows yet.</p>}
        <AddRow kind="shadow" />
      </div>
    </div>
  );
}

export function MotionTokens({ s, counts }: { s: System; counts: Map<string, number> }) {
  return (
    <div className="space-y-1">
      <Head>Durations</Head>
      <List kind="duration" tokens={s.tokens.motion.durations} counts={counts} />
      <Head>Easings</Head>
      <List kind="easing" tokens={s.tokens.motion.easings} counts={counts} />
    </div>
  );
}
