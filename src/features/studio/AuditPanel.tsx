"use client";
/**
 * Prompt and audit one part, with the model's real options in front of you.
 *
 * The left panel already had the prompt — four of them, for the page, a
 * drawing, a group and an element — and nothing at all about what happens to
 * it after it is typed. Which model the route would take, what it would send,
 * and what else that model can be told were facts the table knew and no
 * screen said. That is the whole gap this fills, so there is no fifth prompt
 * box here: this sits under the one that is already there.
 *
 * Everything is rendered from `imageRoute.ts`'s table. `modelsFor` gives the
 * models that serve this part in the route's own order, first being what
 * would be taken unasked; `ModelOptions` draws a control per field from the
 * field's own kind. No model and no field is named in this file, so a row
 * added to the table appears here with nothing changed.
 *
 * It writes `node.plan` through `planEdit.ts`, which is the same field and
 * the same writer create space's right panel uses, so the two cannot drift.
 *
 * One thing it does not do. A drawing and the page have a prompt but no
 * plan — `plan` is a field on a node — so for those this audits and says
 * where the setting would land, rather than inventing a second place to keep
 * it that the right panel would not read.
 */
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Tooltip } from "@/core/ui/tooltip";
import { MAKING_MEANS, model, type ModelCard } from "./imageRoute";
import { STEP_MEANS, planFor, type Planned } from "./space";
import { ModelOptions, type OptionRow } from "./ModelOptions";
import {
  choicesFor, clearOption, readingOf, routeFills, valueOf, writeOption, writePlan,
} from "./planEdit";
import type { StudioNode } from "./store";

/* ------------------------------------------------------------------ */
/* A part                                                              */
/* ------------------------------------------------------------------ */

export function AuditPanel({ node }: { node: StudioNode }) {
  const reading = React.useMemo(() => readingOf(node), [node]);
  const choices = React.useMemo(() => choicesFor(node, reading), [node, reading]);
  const picked = reading.model;
  const filled = React.useMemo(() => (picked ? routeFills(picked, node, reading) : {}), [picked, node, reading]);

  const rows: OptionRow[] = React.useMemo(() => {
    if (!picked) return [];
    return picked.fields.map((f) => ({ field: f, ...valueOf(f, node, filled) }));
  }, [picked, node, filled]);

  const set = React.useCallback(
    (name: string, value: unknown) => writeOption(node, reading, picked?.slug ?? null, name, value),
    [node, reading, picked],
  );
  const clear = React.useCallback((name: string) => clearOption(node, reading, name), [node, reading]);

  return (
    <div data-audit-panel="" className="space-y-2.5">
      <Line
        what={reading.making ? MAKING_MEANS[reading.making] : "—"}
        steps={reading.steps.map((st) => STEP_MEANS[st])}
      />

      {/* Which model. The route's own pick is marked, so choosing it back is
          not a guess about which of them was the default. */}
      <div className="space-y-1">
        <span className="block text-small font-medium uppercase tracking-wider text-fg-faint">Model</span>
        {choices.length ? (
          <div data-model-choices="" className="flex flex-wrap gap-1">
            {choices.map((c, i) => (
              <ModelKey
                key={c.slug}
                card={c}
                first={i === 0}
                on={picked?.slug === c.slug}
                mine={node.plan?.model === c.slug}
                onPick={() => { play("select"); writePlan(node, reading, { model: c.slug }); }}
              />
            ))}
          </div>
        ) : (
          <p data-no-model="" className="text-small text-fg-muted">
            {reading.why ?? "Nothing in the table serves this one."}
          </p>
        )}
      </div>

      {/* What that model takes. Straight off its own row. */}
      {picked ? (
        <div className="space-y-1.5 border-t border-border pt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-small font-medium uppercase tracking-wider text-fg-faint">Its options</span>
            <span className="text-small text-fg-faint">{rows.length}</span>
            {node.plan ? (
              <button
                type="button"
                data-plan-reset=""
                aria-label="Let the route decide everything"
                className="tactile ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-small text-fg-faint hover:text-fg"
                onClick={() => { play("tap"); writePlan(node, reading, { model: null, steps: [], options: null }); }}
              >
                <RotateCcw className="size-3" /> route decides
              </button>
            ) : null}
          </div>
          <ModelOptions rows={rows} onSet={set} onClear={clear} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A drawing, or the page                                              */
/* ------------------------------------------------------------------ */

/**
 * The audit half, for a subject with no plan to write to.
 *
 * A drawing carries words and becomes a part when it is made real; the page
 * carries words that every part on it reads. Neither has a `plan`, so this
 * shows what the route would do with what is there and says where a setting
 * would live, instead of offering a control that writes somewhere the right
 * panel does not look.
 */
export function AuditReadout({ subject, planned }: { subject: string; planned: Planned }) {
  const reading = React.useMemo(() => planFor(planned), [planned]);
  return (
    <div data-audit-readout="" className="space-y-1.5">
      <Line
        what={reading.making ? MAKING_MEANS[reading.making] : "—"}
        steps={reading.steps.map((st) => STEP_MEANS[st])}
      />
      <p className="text-small text-fg-muted">
        {reading.model
          ? <>The route would send {subject} to <span className="text-fg">{reading.model.name}</span>.</>
          : <>{reading.why ?? "Nothing in the table serves this one."}</>}
      </p>
      <p className="text-small leading-snug text-fg-faint">
        Settings live on a part. Pick one to choose its model and what it is told.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Line({ what, steps }: { what: string; steps: string[] }) {
  return (
    <div className="space-y-1">
      <p data-audit-what="" className="text-small text-fg-muted">{what}</p>
      <ol data-audit-steps="" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-small text-fg-faint">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            {i ? <span aria-hidden className="text-fg-faint/60">›</span> : null}
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ModelKey({
  card, first, on, mine, onPick,
}: {
  card: ModelCard;
  first: boolean;
  on: boolean;
  mine: boolean;
  onPick: () => void;
}) {
  const m = model(card.slug);
  const note = [
    card.returns === "mesh" ? "returns a solid" : null,
    card.alpha ? "can drop the ground" : null,
    card.references ? `takes ${card.references} reference${card.references > 1 ? "s" : ""}` : "words only",
    card.grounding ? "can look things up" : null,
    `${card.fields.length} options`,
  ].filter(Boolean).join(" · ");
  return (
    <Tooltip content={`${card.note || m?.name || card.slug} — ${note}`}>
      <button
        type="button"
        data-model-key={card.slug}
        aria-pressed={on}
        onClick={onPick}
        className={cn(
          "tactile rounded-sm border px-1.5 py-0.5 text-small",
          on ? "border-fg text-fg" : "border-border text-fg-muted hover:text-fg",
        )}
      >
        {card.name}
        {first ? <span data-model-default="" className="ml-1 text-fg-faint">·route's</span> : null}
        {mine ? <span data-model-mine="" className="ml-1 text-accent">·yours</span> : null}
      </button>
    </Tooltip>
  );
}
