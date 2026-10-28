"use client";
/**
 * COMPONENTS: the list, and one component opened, as the proposal draws them.
 *
 *   Button   3 variants  5 states   41 on the board   [open]
 *   + make a component from the picked part
 *
 * Opened: the variants as keys (+ add copies the one shown), the states
 * (rest, hover, pressed, focus, disabled), a preview drawn from the
 * variant's look, its slots with the token each points at, and for a state
 * other than rest its editor: how far it moves, turns and grows, and its
 * shadow. Focus and disabled are not captured, so they start as "nothing"
 * and are set here. [Show all] lights the instances; [Detach the picked one]
 * takes the picked instance out of the System.
 *
 * EDITING A SLOT EDITS THE VARIANT (the parts-bind lane): the value typed
 * becomes the variant's (pointing at the token that holds it, when one
 * does), and every instance of the variant follows in the same undo step,
 * here and on each site sharing the System; an instance changed by hand
 * keeps its own value (`system/bind.ts`). Other parts using the same token
 * are not this variant's, and do not change. A token's own value is changed
 * in its row above, where "used by" says who follows.
 *
 * The Element panel's "Edit the component" opens this on the picked part's
 * variant (`open.ts`). States drawn by instances are not yet followed.
 */
import * as React from "react";
import { ChevronLeft, Plus, Unlink } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { useStudio } from "../../board/store";
import { addVariant, detachPart, makeComponent, setVariantSlot, setVariantState, usedBy } from "../../system/api";
import { slotKind } from "../../system/bind";
import {
  STATE_NAMES, kindOfToken, tokenById, valueOf,
  type LookRef, type LookRefs, type LookSlot, type StateLook, type StateName, type System, type SystemComponent, type Variant,
} from "../../system/model";
import { CommitInput, TokenValue, UsedBy, light } from "./values";

const SLOT_WORD: Record<LookSlot, string> = { fill: "Fill", words: "Words", outline: "Outline", shadow: "Shadow", radius: "Corners", face: "Face", size: "Text size" };
const SLOTS: LookSlot[] = ["fill", "words", "outline", "radius", "shadow", "face", "size"];
const STATE_WORD: Record<StateName, string> = { rest: "Rest", hover: "Hover", pressed: "Pressed", focus: "Focus", disabled: "Disabled" };

/** What a slot draws: its token's value, or its own. */
function slotValue(s: System, r: LookRef | undefined): string | number | undefined {
  if (!r) return undefined;
  if ("token" in r) { const t = tokenById(s, r.token); return t ? valueOf(t) : undefined; }
  return r.value;
}

/** How many states a variant has a look for: rest always, and each the page did. */
const stateCount = (v: Variant | undefined) => 1 + (v ? Object.values(v.states).filter(Boolean).length : 0);

export function ComponentList({ s, onOpen }: { s: System; onOpen: (id: string) => void }) {
  const nodes = useStudio((st) => st.nodes);
  const picked = useStudio((st) => (st.selection.length === 1 ? st.selection[0]! : null));
  const [says, setSays] = React.useState<string | null>(null);
  const on = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) { const c = n.sys?.s === s.id ? n.sys?.c?.component : null; if (c) m.set(c, (m.get(c) ?? 0) + 1); }
    return m;
  }, [nodes, s.id]);
  return (
    <div data-component-list="" className="space-y-0.5">
      {s.components.map((c) => (
        <div key={c.id} data-component-row={c.id} className="flex items-center gap-1.5 py-0.5 text-small">
          <span className="w-20 shrink-0 truncate text-fg">{c.name}</span>
          <span className="shrink-0 text-fg-muted">{c.variants.length} {c.variants.length === 1 ? "variant" : "variants"}</span>
          <span className="shrink-0 text-fg-muted">{Math.max(0, ...c.variants.map(stateCount))} states</span>
          <span className="min-w-0 flex-1 truncate text-right tabular-nums text-fg-muted">{(on.get(c.id) ?? 0).toLocaleString()} on the board</span>
          <Button size="xs" variant="outline" data-component-open={c.id} onClick={() => { play("open"); onOpen(c.id); }}>open</Button>
        </div>
      ))}
      {s.components.length ? null : <p className="text-small text-fg-faint">No components yet.</p>}
      <button
        type="button" data-make-component="" disabled={!picked}
        title={picked ? "The picked part becomes the first of a new component" : "Pick a part on the board first"}
        onClick={() => {
          if (!picked) return;
          const r = makeComponent(picked);
          if (!r.ok) { setSays(r.says); play("deny"); return; }
          setSays(null); play("confirm"); onOpen(r.id);
        }}
        className="tactile flex items-center gap-1 py-0.5 text-small text-fg-muted hover:text-fg disabled:opacity-50"
      >
        <Plus className="size-3" /> make a component from the picked part
      </button>
      {says ? <p className="text-small text-down">{says}</p> : null}
    </div>
  );
}

/** The variant drawn small, in the state shown. */
function Preview({ s, c, look, state }: { s: System; c: SystemComponent; look: LookRefs; state: StateLook | null }) {
  const v = (slot: LookSlot) => slotValue(s, look[slot]);
  const shadow = state?.shadow ?? v("shadow");
  const size = v("size");
  return (
    <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-sm bg-[repeating-conic-gradient(var(--color-elevated)_0_25%,transparent_0_50%)] bg-[length:12px_12px]">
      <span
        data-component-preview=""
        className="truncate px-3 py-1.5"
        style={{
          background: v("fill") as string | undefined,
          color: v("words") as string | undefined,
          border: v("outline") ? `1px solid ${v("outline")}` : undefined,
          borderRadius: typeof v("radius") === "number" ? Math.min(Number(v("radius")), 999) : undefined,
          boxShadow: typeof shadow === "string" && !/^(rgb|#|hsl|oklch)/.test(shadow) ? shadow : undefined,
          fontFamily: v("face") as string | undefined,
          fontSize: typeof size === "number" ? Math.min(size, 20) : 13,
          transform: state ? `translate(${state.dx}px, ${state.dy}px) rotate(${state.rotate}deg) scale(${state.scale})` : undefined,
        }}
      >
        {c.name}
      </span>
    </div>
  );
}

function SlotRow({ s, c, v, slot, r }: { s: System; c: SystemComponent; v: Variant; slot: LookSlot; r: LookRef | undefined }) {
  if (!r) return null;
  const tid = "token" in r ? r.token : null;
  const t = tid ? tokenById(s, tid) : null;
  const kind = tid ? kindOfToken(tid) ?? slotKind(slot, r) : slotKind(slot, r);
  const value = slotValue(s, r);
  /* One undo step: the variant, and every instance of it. */
  const commit = (x: string | number) => {
    const out = setVariantSlot(c.id, v.id, slot, { value: kind === "colour" || kind === "face" || kind === "shadow" || kind === "duration" || kind === "easing" ? String(x) : Number(x) });
    const ok = !("ok" in out && out.ok === false);
    play(ok ? "tick" : "deny");
    return ok;
  };
  return (
    <div data-slot={slot} data-slot-ref={tid ?? "own"} className="flex min-w-0 flex-wrap items-center gap-1.5 py-0.5">
      <span className="w-16 shrink-0 text-small text-fg-muted">{SLOT_WORD[slot]}</span>
      {t ? <span className="w-16 shrink-0 truncate text-small text-fg" title={t.name}>{t.name}</span> : null}
      {value === undefined ? <span className="min-w-0 flex-1 text-small text-fg-faint">a token no longer here</span>
        : <TokenValue kind={kind} value={value} label={`${c.name} ${v.name}: ${SLOT_WORD[slot]}`} onCommit={commit} />}
      <span className="shrink-0 text-small text-fg-faint">{t ? "(token)" : "(own)"}</span>
    </div>
  );
}

/** A state's editor: how far it moves, turns and grows, and its shadow. "Nothing" until set. */
function StateEditor({ c, v, state }: { c: SystemComponent; v: Variant; state: Exclude<StateName, "rest"> }) {
  const look = v.states[state];
  const put = (patch: Partial<StateLook> | null) => {
    const next = patch === null ? null : { dx: 0, dy: 0, rotate: 0, scale: 1, shadow: null, ...(look ?? {}), ...patch };
    const r = setVariantState(c.id, v.id, state, next);
    const ok = !("ok" in r && r.ok === false);
    play(ok ? "tick" : "deny");
    return ok;
  };
  if (!look) {
    return (
      <div data-state-editor={state} className="flex items-center gap-2 py-1 text-small text-fg-muted">
        <span>The page does nothing here.</span>
        <Button size="xs" variant="outline" data-state-set={state} onClick={() => put({})}>Set one</Button>
      </div>
    );
  }
  const num = (k: "dx" | "dy" | "rotate" | "scale", word: string, unit: string) => (
    <label className="flex items-center gap-1 text-small text-fg-muted">
      <span className="w-10 shrink-0">{word}</span>
      <CommitInput numeric mono label={`${STATE_WORD[state]} ${word}`} value={look[k]} className="w-14"
        onCommit={(x) => { const n = Number(x); return Number.isFinite(n) && put({ [k]: n }); }} />
      <span className="text-fg-faint">{unit}</span>
    </label>
  );
  return (
    <div data-state-editor={state} className="space-y-1 py-1">
      <div className="grid grid-cols-2 gap-1">
        {num("dx", "Across", "px")}
        {num("dy", "Down", "px")}
        {num("rotate", "Turn", "°")}
        {num("scale", "Grow", "×")}
      </div>
      <label className="flex items-center gap-1 text-small text-fg-muted">
        <span className="w-10 shrink-0">Shadow</span>
        <CommitInput mono label={`${STATE_WORD[state]} shadow`} value={look.shadow ?? ""} className="flex-1" onCommit={(x) => put({ shadow: x || null })} />
      </label>
      <Button size="xs" variant="ghost" data-state-clear={state} onClick={() => put(null)}>Back to nothing</Button>
    </div>
  );
}

export function ComponentEditor({ s, id, variant, onBack }: { s: System; id: string; variant?: string | null; onBack: () => void }) {
  const c = s.components.find((x) => x.id === id);
  const [variantId, setVariantId] = React.useState<string | null>(variant ?? null);
  React.useEffect(() => { if (variant) setVariantId(variant); }, [variant]);
  const [state, setState] = React.useState<StateName>("rest");
  const picked = useStudio((st) => (st.selection.length === 1 ? st.nodes.find((n) => n.id === st.selection[0]) ?? null : null));
  const instances = useStudio((st) => st.nodes.filter((n) => n.sys?.s === s.id && n.sys?.c?.component === id).length);
  React.useEffect(() => () => light(null, null), []);
  if (!c) return <div className="p-1 text-small text-fg-faint">That component is gone. <button type="button" className="underline" onClick={onBack}>Back</button></div>;
  const v = c.variants.find((x) => x.id === variantId) ?? c.variants[0];
  const pickedIsMine = !!picked && picked.sys?.s === s.id && picked.sys?.c?.component === c.id;
  return (
    <div data-component-editor={c.id} data-variant-shown={v?.id ?? ""} className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Button size="iconXs" variant="ghost" aria-label="Back to the System" data-component-back="" onClick={() => { play("close"); onBack(); }}><ChevronLeft /></Button>
        <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-[0.12em] text-fg">{c.name}</span>
        <span className="shrink-0 text-small tabular-nums text-fg-muted">{instances.toLocaleString()} on the board</span>
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Variant">
        <span className="w-12 text-small text-fg-muted">Variant</span>
        {c.variants.map((x) => (
          <button key={x.id} type="button" data-variant={x.id} aria-pressed={x.id === v?.id} onClick={() => { play("select"); setVariantId(x.id); }}
            className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", x.id === v?.id ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg")}>
            {x.name}
          </button>
        ))}
        {v ? (
          <button type="button" data-variant-add="" title="A copy of this variant to change" onClick={() => { const r = addVariant(c.id, v.id); if (r.ok) { play("confirm"); setVariantId(r.id); } else play("deny"); }}
            className="tactile flex items-center gap-0.5 text-small text-fg-muted hover:text-fg"><Plus className="size-3" /> add</button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="State">
        <span className="w-12 text-small text-fg-muted">State</span>
        {STATE_NAMES.map((x) => (
          <button key={x} type="button" data-state={x} aria-pressed={x === state} onClick={() => { play("select"); setState(x); }}
            className={cn("tactile rounded-sm border px-1.5 py-0.5 text-small", x === state ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg",
              x !== "rest" && v && !v.states[x] && x !== state && "opacity-60")}>
            {STATE_WORD[x]}
          </button>
        ))}
      </div>

      {v ? (
        <div className="flex gap-2">
          <Preview s={s} c={c} look={v.look} state={state === "rest" ? null : v.states[state]} />
          <div className="min-w-0 flex-1">
            {state === "rest" ? SLOTS.map((slot) => <SlotRow key={slot} s={s} c={c} v={v} slot={slot} r={v.look[slot]} />) : <StateEditor c={c} v={v} state={state} />}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <UsedBy id={c.id} count={instances} ids={() => usedBy(c.id)} word="Show all" />
        <Button size="xs" variant="outline" data-detach-picked="" disabled={!pickedIsMine} title={pickedIsMine ? "The picked part leaves the System and keeps every value it shows" : "Pick one of its parts on the board first"}
          onClick={() => { if (picked) { const r = detachPart(picked.id); play("ok" in r && r.ok === false ? "deny" : "confirm"); } }}>
          <Unlink /> Detach the picked one
        </Button>
      </div>
    </div>
  );
}
