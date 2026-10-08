"use client";
/**
 * The small reader for `partOptions.ts`: a part's editable fields, drawn
 * from the data, one section or a few sources at a time.
 *
 * The side panel places it: today the Element panel shows the Version row
 * with it (every other source already has its control there), and a panel
 * built in sections (Content, Position and size, Look, Motion) draws
 * `<PartFields node={n} section="look" />` for each. Every change is one
 * `updateNode` patch, so the board, the preview and the export follow.
 */
import * as React from "react";
import { useStudio, type StudioNode } from "./board/store";
import { editablesOf, readField, writeField, type Field, type Section } from "./partOptions";
import { play } from "@/core/audio/engine";

export function PartFields({ node, section, only, linkable, ids, except }: {
  node: StudioNode;
  section?: Section;
  only?: readonly Field["source"][];
  linkable?: boolean;
  /** Only these fields, by id. */
  ids?: readonly string[];
  /** Every field but these, by id (they are drawn somewhere else). */
  except?: readonly string[];
}) {
  const fields = React.useMemo(
    () => editablesOf(node, { linkable }).filter((f) => (!section || f.section === section) && (!only || only.includes(f.source)) && (!ids || ids.includes(f.id)) && !except?.includes(f.id)),
    [node, section, only, linkable, ids, except],
  );
  if (!fields.length) return null;
  const set = (f: Field, v: string) => {
    const patch = writeField(node, f, v);
    if (!patch) return;
    play("select");
    useStudio.getState().updateNode(node.id, patch as Partial<StudioNode>);
  };
  return (
    <div data-part-fields={section ?? only?.join(",") ?? ""} className="flex flex-col gap-2">
      {fields.map((f) => <FieldRow key={f.id} field={f} value={readField(node, f)} onChange={(v) => set(f, v)} />)}
    </div>
  );
}

function FieldRow({ field: f, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  if (f.kind === "one" && f.values) {
    return (
      <div data-field={f.id} className="flex flex-col gap-1">
        <span className="text-small text-fg-muted">{f.label}</span>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={f.label}>
          {f.values.map((v) => {
            const on = v === value;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={on}
                data-value={v}
                onClick={() => onChange(v)}
                className="tactile rounded-full px-2 py-0.5 text-small"
                style={{
                  background: on ? "oklch(0.78 0.14 150 / 0.22)" : "oklch(1 0 0 / 0.04)",
                  boxShadow: `inset 0 0 0 1px ${on ? "oklch(0.78 0.14 150 / 0.6)" : "var(--border)"}`,
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (f.kind === "range" && f.range) {
    return (
      <label data-field={f.id} className="flex items-center justify-between gap-2 text-small text-fg-muted">
        <span>{f.label}</span>
        <input type="range" min={f.range.min} max={f.range.max} step={f.range.step} value={Number(value) || f.range.min} onChange={(e) => onChange(e.target.value)} className="w-32" />
        <span className="num w-12 text-right text-fg">{value}{f.range.unit ?? ""}</span>
      </label>
    );
  }
  return (
    <label data-field={f.id} className="flex flex-col gap-1 text-small text-fg-muted">
      <span>{f.label}</span>
      <input
        type="text"
        defaultValue={value}
        placeholder={f.placeholder}
        onBlur={(e) => { if (e.target.value !== value) onChange(e.target.value); }}
        className="rounded-sm border border-border bg-bg px-2 py-1 text-fg"
      />
    </label>
  );
}
