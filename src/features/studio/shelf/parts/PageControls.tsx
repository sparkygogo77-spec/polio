"use client";
/**
 * A page's own form controls, one part each: a field (a text box, a
 * password, a number, a file, a text area, a list to choose from) and a
 * checkbox (or a radio) with its words beside it.
 *
 * Brought in from a page (`pageParts.ts`), a control is the real element,
 * not a picture of one: an `input`, a `textarea` or a `select` with its
 * choices, carrying the id and data-* attributes the page's code finds it by
 * (`hooks`) on the published page, so the code that read
 * `[data-hook="deposit-amount"]` still finds a field with a value. Its edge,
 * fill and padding are the box round it (`blocks.tsx`), as the page drew
 * them, so it is restyled like any other box; the element inside draws no
 * edge of its own.
 *
 * On the board it takes no typing and no press: the board is a layout
 * surface. Live, it does what the element does.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { saidRole } from "./theme";
import { opt, type PartProps } from "./types";

/** The attributes the page's code finds it by, on the live page only: two of the same id on the board would be one too many. */
const hooksFor = (hooks: Record<string, string> | null | undefined, mode: PartProps["mode"]): Record<string, string> => (mode === "live" && hooks ? hooks : {});

/** "* Label = value" lines, as `pageParts.ts` writes a list's choices. */
function choicesOf(raw: string): { text: string; value: string; selected: boolean }[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const selected = l.startsWith("* ");
    const body = selected ? l.slice(2) : l;
    const cut = body.lastIndexOf(" = ");
    return cut > 0 ? { text: body.slice(0, cut), value: body.slice(cut + 3), selected } : { text: body, value: body, selected };
  });
}

export function Field({ id, content, options, theme: t, mode, hooks }: PartProps) {
  const kind = opt(options, "kind", "text");
  /* Brought in from a page, its label is a part of its own beside it (`pageParts.ts` sets `kind`). Taken from the shelf, it has none: its words are its label, drawn above the box. */
  const shelf = !options.kind;
  const label = options.label ?? (shelf ? content : "");
  const disabled = options.disabled === "yes";
  const still = mode !== "live";
  const own = hooksFor(hooks, mode);
  const look: React.CSSProperties = {
    width: "100%", height: "100%", minHeight: 0, boxSizing: "border-box", margin: 0, padding: 0,
    border: 0, outline: "none", background: "transparent", color: "inherit", font: "inherit",
    pointerEvents: still ? "none" : undefined,
  };
  const name = label || content || kind;
  let el: React.ReactNode;
  if (kind === "select" || kind === "select-one" || kind === "select-multiple") {
    const choices = choicesOf(options.choices ?? "");
    const picked = choices.find((c) => c.selected)?.value ?? choices[0]?.value ?? "";
    /* Each choice's own hook, one line per choice, as the page had it (`pageParts.ts`): live only, as the list's own. */
    const choiceHooks = mode === "live" ? (options.choiceHooks ?? "").split("\n") : [];
    el = (
      <select {...own} aria-label={name} disabled={disabled} multiple={kind === "select-multiple"} tabIndex={still ? -1 : undefined} defaultValue={kind === "select-multiple" ? choices.filter((c) => c.selected).map((c) => c.value) : picked} style={look}>
        {choices.map((c, i) => <option key={`${c.value}${i}`} value={c.value} {...(choiceHooks[i]?.trim() ? { "data-hook": choiceHooks[i]!.trim() } : {})}>{c.text}</option>)}
      </select>
    );
  } else if (kind === "textarea") {
    el = <textarea {...own} aria-label={name} disabled={disabled} readOnly={still} tabIndex={still ? -1 : undefined} rows={Number(options.rows) || undefined} placeholder={options.placeholder} defaultValue={options.value ?? ""} style={{ ...look, resize: still ? "none" : undefined }} />;
  } else {
    el = <input {...own} type={kind} aria-label={name} disabled={disabled} readOnly={still && kind !== "file"} tabIndex={still ? -1 : undefined} placeholder={options.placeholder} {...(kind === "file" ? {} : { defaultValue: options.value ?? "" })} style={look} />;
  }
  if (shelf) {
    return (
      <Fill t={t} data-part={id} data-field={kind} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        {label ? <span style={{ fontSize: t.fontPx * 0.85, color: t.muted }}>{label}</span> : null}
        <span style={{ display: "flex", alignItems: "center", minHeight: t.fontPx * 2, padding: `0 ${t.fontPx * 0.6}px`, border: `1px solid ${t.line}`, borderRadius: Math.min(t.radius, 8), background: t.surface }}>{el}</span>
      </Fill>
    );
  }
  return (
    <Fill t={t} data-part={id} data-field={kind} style={{ display: "flex", alignItems: "center" }}>
      {el}
    </Fill>
  );
}

export function Checkbox({ id, content, options, theme: t, mode, hooks, h }: PartProps) {
  const kind = opt(options, "kind", "checkbox") === "radio" ? "radio" : "checkbox";
  const still = mode !== "live";
  /*
   * A box one line tall holds its words on one line. PST's "Approve
   * automatically with the test wallet" is 339x22 on the page; the box and
   * gap here run a few pixels past the page's, "wallet" wrapped, and the
   * board grew it to 45 and pushed the queue panel down. On one line, and
   * marked as one (`data-one-line`), the board widens the box to its words
   * when this machine's font runs wider (`textFit.ts#lineWidth`).
   */
  const oneLine = !!content && h > 0 && h < 2 * t.fontPx * t.lineHeight - 1;
  return (
    <Fill t={t} data-part={id} data-check={kind} style={{ display: "flex", alignItems: "center", ...(oneLine ? { overflow: "visible" } : {}) }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "0.25em", pointerEvents: still ? "none" : undefined, cursor: still ? undefined : "pointer" }}>
        <input
          {...hooksFor(hooks, mode)}
          type={kind}
          defaultChecked={options.checked === "yes"}
          disabled={options.disabled === "yes"}
          tabIndex={still ? -1 : undefined}
          style={{ margin: "3px 3px 3px 4px", ...(saidRole(t, "accent") ? { accentColor: t.accent } : {}) }}
        />
        {/* No words of its own: the box alone, never filler (the shelf gives it the words it shows: catalog.ts). */}
        {content ? <span data-one-line={oneLine ? "" : undefined} style={oneLine ? { whiteSpace: "nowrap" } : undefined}>{content}</span> : null}
      </label>
    </Fill>
  );
}
