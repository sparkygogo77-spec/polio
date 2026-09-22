"use client";
/**
 * Every input a model takes, drawn from the table and never from a name.
 *
 * The one rule this file exists to keep: **there is no field name written
 * anywhere in it.** Not "prompt", not "aspect_ratio", not "output_format".
 * A model added to `imageRoute.ts` has to appear here, with its own fields
 * and its own allowed values, without this file changing at all. The moment
 * a name appears below, that stops being true for the next model.
 *
 * So what is written here is one control per `kind` — the eight the table
 * declares — and everything else comes off the `ModelField`: the label, the
 * values an enum allows, the bounds on a number, how many an images field
 * takes, and the default the model uses when nothing is said.
 *
 * The field counts run 5 to 13 across the seven rows, so this lays out a
 * variable set rather than a form. Nothing is positioned by index and
 * nothing assumes a count.
 *
 * `managed` fields — the ones the route fills from the need — are shown
 * rather than hidden, wearing what the route chose, and can still be taken
 * over. That is the whole point of an audit panel: a person should be able
 * to see that the ratio is 3:2 because their part is 600x400, and then say
 * 1:1 anyway.
 */
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Switch } from "@/core/ui/switch";
import { Textarea } from "@/core/ui/textarea";
import { Tooltip } from "@/core/ui/tooltip";
import type { ModelField } from "./imageRoute";
import { type FieldSource } from "./planEdit";

/** What the route filling a field is called, in a sentence, when it fills one. */
const MANAGED_MEANS: Record<NonNullable<ModelField["managed"]>, string> = {
  prompt: "the words this part was given",
  images: "the pictures this step was handed",
  ratio: "the shape of the part on the board",
  size: "the size the model is asked for",
  format: "the file the board can show",
  alpha: "whether the ground comes off",
  grounding: "whether it may look things up",
  pixels: "the part's real box, rounded to what the model takes",
};

export interface OptionRow {
  field: ModelField;
  value: unknown;
  from: FieldSource;
}

export function ModelOptions({
  rows, onSet, onClear, disabled,
}: {
  rows: OptionRow[];
  onSet: (name: string, value: unknown) => void;
  onClear: (name: string) => void;
  disabled?: boolean;
}) {
  if (!rows.length) return <p className="text-small text-fg-muted">This one takes nothing but the picture.</p>;
  return (
    <div data-model-options="" className="space-y-2">
      {rows.map((r) => (
        <Row key={r.field.name} row={r} onSet={onSet} onClear={onClear} disabled={disabled} />
      ))}
    </div>
  );
}

function Row({
  row, onSet, onClear, disabled,
}: {
  row: OptionRow;
  onSet: (name: string, value: unknown) => void;
  onClear: (name: string) => void;
  disabled?: boolean;
}) {
  const { field: f, value, from } = row;
  const set = (v: unknown) => { play("select"); onSet(f.name, v); };
  return (
    <div data-model-field={f.name} data-field-kind={f.kind} data-field-from={from} className="space-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-small font-medium uppercase tracking-wider text-fg-faint">{f.label}</span>
        {f.managed ? (
          <Tooltip content={`The route sets this from ${MANAGED_MEANS[f.managed]}. Change it and yours is used instead.`}>
            <span
              data-field-managed=""
              className={cn("rounded-sm px-1 text-fine", from === "set" ? "bg-accent/20 text-accent" : "bg-elevated text-fg-muted")}
            >
              {from === "set" ? "yours" : "routed"}
            </span>
          </Tooltip>
        ) : null}
        {from === "set" ? (
          <button
            type="button"
            data-field-clear={f.name}
            aria-label={`Let the route decide ${f.label}`}
            className="tactile ml-auto rounded-sm p-0.5 text-fg-faint hover:text-fg"
            onClick={() => { play("tap"); onClear(f.name); }}
          >
            <RotateCcw className="size-3" />
          </button>
        ) : null}
      </div>
      <Control f={f} value={value} set={set} disabled={disabled} />
      {f.note ? <p className="text-small leading-snug text-fg-muted">{f.note}</p> : null}
    </div>
  );
}

/**
 * One control per kind. Eight of them, and the table promises no ninth
 * without a change here — which is the only coupling this file has to it,
 * and the reason `kind` is a closed set rather than a free string.
 */
function Control({
  f, value, set, disabled,
}: {
  f: ModelField;
  value: unknown;
  set: (v: unknown) => void;
  disabled?: boolean;
}) {
  const label = `${f.label}`;
  /*
   * What an empty control is waiting for. "The model's own" is true of a
   * field nobody fills, and false of a managed one — the route fills that,
   * and a part with no words yet showed an empty prompt box promising the
   * model would decide, which is the opposite of what would happen.
   */
  const waiting = f.managed
    ? `from ${MANAGED_MEANS[f.managed]}`
    : f.default === null ? "the model's own" : String(f.default);
  switch (f.kind) {
    case "enum":
      return (
        <Select
          aria-label={label}
          disabled={disabled}
          className="w-full"
          value={typeof value === "string" ? value : ""}
          onChange={set}
          options={(f.values ?? []).map((v) => ({ value: v, label: v }))}
          placeholder={waiting}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch aria-label={label} disabled={disabled} checked={value === true} onCheckedChange={(v: boolean) => set(v)} />
          <span className="text-small text-fg-muted">{value === true ? "yes" : "no"}</span>
        </div>
      );
    case "integer":
    case "number":
      return (
        <Input
          type="number"
          aria-label={label}
          disabled={disabled}
          className="h-7 text-xs"
          min={f.min}
          max={f.max}
          step={f.kind === "integer" ? 1 : "any"}
          value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
          placeholder={waiting}
          onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "images":
      return (
        <Textarea
          aria-label={label}
          disabled={disabled}
          rows={2}
          className="text-xs"
          placeholder={f.managed ? waiting : `up to ${f.maxItems ?? "several"}, one address a line`}
          value={Array.isArray(value) ? value.join("\n") : ""}
          onChange={(e) => set(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        />
      );
    case "image":
      return (
        <Input
          aria-label={label}
          disabled={disabled}
          className="h-7 text-xs"
          placeholder="a picture's address"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "secret":
      /*
       * Never shown, never stored on the document. A key belongs to the
       * person and rides with the call from their browser, the way the
       * Replicate one does; a panel that put one in `node.plan` would write
       * it into the site's own file and publish it.
       */
      return (
        <p className="rounded-sm border border-border bg-elevated px-2 py-1 text-small text-fg-muted">
          Set in the Keys panel. A key is not kept on the part.
        </p>
      );
    case "text":
    default:
      return (
        <Textarea
          aria-label={label}
          disabled={disabled}
          rows={2}
          className="text-xs"
          placeholder={waiting}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value)}
        />
      );
  }
}
