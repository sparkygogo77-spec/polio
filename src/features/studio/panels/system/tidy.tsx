"use client";
/**
 * "TIDY": the System's sizes folded onto a scale, shown first, then applied.
 *
 * A System taken from a site is exact and so unusable as a design language
 * (35 text sizes on sol face). Tidy reads a PLAN (`system/tidy.ts`) and
 * shows it before anything moves: per kind, how many steps become how many,
 * and for each step of the folded scale which old sizes fold into it, how
 * many parts move and what kinds of part they are. "Light them" lights those
 * parts on the board. Three switches say which kinds fold. Nothing on the
 * board moves until "Tidy it", which is one undo step ("tidy the System: 35
 * text sizes to 12"); a field set apart by hand stays, and so does every part
 * that points at no token.
 *
 * The approved shape (handovers/CREATE-SYSTEM-PROPOSAL.md (a), "One type
 * scale" and the changes list; the dry-run of what moves): a dialog with a
 * tick per kind and a list of what changes.
 */
import * as React from "react";
import { Shrink } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Dialog } from "@/core/ui/dialog";
import { Switch } from "@/core/ui/switch";
import { useStudio } from "../../board/store";
import { tidyPlanOf, tidySystem, type Refused } from "../../system/api";
import { TIDY_KINDS, type TidyKind, type TidyKindPlan, type TidyOn, type TidyPlan, type TidyStep } from "../../system/tidy";
import type { System } from "../../system/model";
import { UsedBy, light } from "./values";

const n = (x: number) => x.toLocaleString();
const plural = (x: number, one: string, many = `${one}s`) => `${n(x)} ${x === 1 ? one : many}`;
/** A size as a person reads it: whole pixels plain, a captured fraction to two places. */
export const px = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ""));

/** The one-line count for a kind: "35 → 12 steps, scale 1.25 from 11px". */
export function kindLine(k: TidyKindPlan): string {
  const steps = k.before === k.after ? `${n(k.after)} steps` : `${n(k.before)} → ${n(k.after)} steps`;
  const scale = k.kind === "type" && k.ratio && k.base ? `, scale ${k.ratio} from ${px(k.base)}px` : "";
  return `${steps}${scale}`;
}

/** One step of the folded scale that gathers or moves something: "20px ← 19, 20.16, 21 · 14 parts: word parts ×12, buttons ×2". */
function StepRow({ step }: { step: TidyStep }) {
  const gathered = step.gathers.map((g) => px(g.from)).join(", ");
  const kinds = step.kinds.map((k) => `${k.word} ×${k.parts}`).join(", ");
  const stays = step.gathers.reduce((a, g) => a + g.stays, 0);
  return (
    <div data-tidy-step={step.token} data-tidy-step-px={step.px} data-tidy-step-parts={step.parts.length} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 py-0.5 text-small">
      <span className="w-24 shrink-0 truncate text-fg">{step.name}</span>
      <span className="font-mono tabular-nums text-fg">{px(step.px)}px</span>
      <span className="text-fg-faint">←</span>
      <span className="min-w-0 flex-1 truncate font-mono tabular-nums text-fg-muted" title={gathered}>{gathered}</span>
      {step.parts.length ? (
        <>
          <UsedBy id={`tidy:${step.token}`} count={step.parts.length} ids={() => step.parts} word="moves" />
          <span className="min-w-0 truncate text-fg-faint" title={kinds}>{kinds}</span>
        </>
      ) : <span className="text-fg-faint">nothing moves</span>}
      {stays ? <span className="text-fg-faint" title="Set apart by hand: they keep their value">{n(stays)} stay</span> : null}
    </div>
  );
}

function KindBlock({ k, on, setOn }: { k: TidyKindPlan; on: boolean; setOn: (v: boolean) => void }) {
  const moving = k.steps.filter((s) => s.gathers.length);
  const still = k.steps.length - moving.length;
  return (
    <div data-tidy-kind={k.kind} data-tidy-before={k.before} data-tidy-after={k.after} className="space-y-0.5">
      <label className="flex items-center gap-1.5 text-xs text-fg">
        <Switch size="sm" data-tidy-on={k.kind} aria-label={`Fold the ${k.word}`} checked={on} onCheckedChange={(v) => { play(v ? "open" : "close"); setOn(v); }} />
        <span className="capitalize">{k.word}</span>
        <span className="tabular-nums text-fg-muted">{kindLine(k)}</span>
      </label>
      {on ? (
        <div className="ml-6 border-l border-border pl-2">
          {moving.map((s) => <StepRow key={s.token} step={s} />)}
          {still ? <p className="py-0.5 text-small text-fg-faint">{plural(still, "step")} already on the scale, unchanged.</p> : null}
          {!moving.length ? <p className="py-0.5 text-small text-fg-faint">Every {k.word.replace(/s$/, "")} already sits on the scale.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function TidyDialog({ open, onOpenChange, system }: { open: boolean; onOpenChange: (v: boolean) => void; system: System | null }) {
  const name = useStudio((s) => s.brief?.name?.trim() || system?.name || "this site");
  const nodes = useStudio((s) => s.nodes);
  const [on, setOn] = React.useState<TidyOn>({ type: true, space: true, radius: true });
  const [plan, setPlan] = React.useState<TidyPlan | Refused | null>(null);
  /* Read on open and whenever a switch turns (a frame later, so the dialog shows first: a large site's plan takes a moment). */
  React.useEffect(() => {
    if (!open) { setPlan(null); light(null, null); return; }
    const t = window.setTimeout(() => setPlan(tidyPlanOf()), 30);
    return () => window.clearTimeout(t);
  }, [open, system, nodes]);
  /* The light goes out with the dialog. */
  React.useEffect(() => () => light(null, null), []);
  const shown = plan && !("ok" in plan && plan.ok === false) ? (plan as TidyPlan) : null;
  const chosen = shown ? shown.kinds.filter((k) => on[k.kind]) : [];
  const fields = chosen.reduce((a, k) => a + k.fields, 0);
  const parts = new Set(chosen.flatMap((k) => k.parts)).size;
  const stays = chosen.reduce((a, k) => a + k.stays, 0);
  const folds = chosen.some((k) => k.before !== k.after || k.fields > 0);
  const tidy = () => {
    const r = tidySystem(on);
    if (!r.ok) { setPlan(r); play("deny"); return; }
    play("confirm");
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={`Tidy the System of “${name}”`}
      description="Fold its sizes onto a scale. Nothing moves until you press Tidy it."
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" data-tidy-confirm="" disabled={!shown || !folds} onClick={tidy}>Tidy it</Button>
        </>
      )}
    >
      <div data-tidy-plan="" className="space-y-2 text-xs text-fg">
        {!plan ? <p className="text-fg-muted">Reading the System…</p> : !shown ? <p className="text-down">{(plan as Refused).says}</p> : (
          <>
            {shown.kinds.length ? shown.kinds.map((k) => <KindBlock key={k.kind} k={k} on={on[k.kind]} setOn={(v) => setOn({ ...on, [k.kind]: v })} />) : <p className="text-fg-muted">This System has no sizes to fold.</p>}
            <p data-tidy-fields={fields} data-tidy-parts={parts} data-tidy-stays={stays} className={cn("pt-1", folds ? "text-fg" : "text-fg-muted")}>
              {folds ? <>{plural(fields, "value")} on {plural(parts, "part")} will move.{stays ? ` ${n(stays)} set apart by hand stay as they are.` : ""} Parts that point at no token stay.</> : "Every size already sits on the scale. Nothing to tidy."}
            </p>
            <p className="text-fg-muted">Nothing on the board moves until you press Tidy it. One undo takes it all back.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}

/** The bar's button: opens the dialog. Nothing until the site has a System with sizes in it. */
export function TidyButton({ system }: { system: System | null }) {
  const [open, setOpen] = React.useState(false);
  const has = !!system && TIDY_KINDS.some((k: TidyKind) => (k === "type" ? system.tokens.type.steps : system.tokens[k]).length > 0);
  return (
    <>
      <Button size="xs" variant="outline" data-tidy-open="" disabled={!has} title="Fold the text sizes, space steps and corners onto a scale. You see what would move first; nothing moves until you say so." onClick={() => { play("open"); setOpen(true); }}>
        <Shrink /> Tidy
      </Button>
      <TidyDialog open={open} onOpenChange={setOpen} system={system} />
    </>
  );
}
