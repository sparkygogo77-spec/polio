"use client";
/**
 * Capturing what people type. Fields come from content; validation, steps and
 * the success state are real, so the preview shows what submitting feels like.
 */
import * as React from "react";
import { Btn, Fill } from "./primitives";
import { hash, rng, sample } from "./sample";
import { cardStyle, items, radiusFor, ghostStyle} from "./theme";
import { opt, type PartProps } from "./types";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function fieldStyle(t: PartProps["theme"], shape: string, invalid: boolean): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", padding: `${t.fontPx * 0.5}px ${t.fontPx * 0.7}px`,
    background: shape === "underlined" ? "transparent" : t.bg, color: t.text, font: "inherit", fontSize: t.fontPx * 0.92,
    border: shape === "underlined" ? "none" : `1px solid ${invalid ? "oklch(0.65 0.2 25)" : t.line}`,
    borderBottom: `${shape === "underlined" ? 2 : 1}px solid ${invalid ? "oklch(0.65 0.2 25)" : shape === "underlined" ? t.line : t.line}`,
    borderRadius: radiusFor(shape, t), outline: "none",
  };
}

/** Contact forms, wizards, bookings and surveys. */
export function Form({ id, content, options, theme: t, mode, emit }: PartProps) {
  const steps = id === "multi-step-form" ? items(content, ["Details", "Address", "Payment", "Confirm"]) : null;
  const fields = items(content, id === "booking" ? ["Date", "Time", "Party size"] : id === "survey" ? ["How did you hear about us?", "What would you change?"] : ["Name", "Email", "Message"]);
  const shape = opt(options, "shape", "rounded");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [touched, setTouched] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const uid = React.useId();

  const errorFor = (f: string) => {
    if (!touched) return null;
    const v = (values[f] ?? "").trim();
    if (!v) return `${f} is required`;
    if (/mail/i.test(f) && !isEmail(v)) return "That email doesn't look right";
    return null;
  };
  const errors = fields.map(errorFor).filter(Boolean);

  const submit = () => {
    setTouched(true);
    const bad = fields.some((f) => {
      const v = (values[f] ?? "").trim();
      return !v || (/mail/i.test(f) && !isEmail(v));
    });
    if (bad) return;
    setSent(true);
    emit?.({ type: "toast", text: "Sent — thank you", level: "success" });
  };

  if (sent) {
    return (
      <Fill t={t} data-part={id} style={{ ...cardStyle(t), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: t.fontPx }}>
        <span aria-hidden style={{ fontSize: t.fontPx * 2, color: t.accent }}>✓</span>
        <strong style={{ fontFamily: t.headingFamily }}>Thank you</strong>
        <span style={{ color: t.muted, fontSize: t.fontPx * 0.9 }}>We&apos;ll be in touch.</span>
        <Btn t={t} label="Send another" primary={false} onClick={() => { setSent(false); setTouched(false); setValues({}); setStep(0); }} />
      </Fill>
    );
  }

  const shownFields = steps ? [fields[Math.min(step, fields.length - 1)] ?? fields[0]!] : fields;

  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, overflow: "auto" }}>
      {steps ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s + i}>
              <span aria-current={i === step ? "step" : undefined} style={{ fontSize: t.fontPx * 0.78, color: i === step ? t.text : t.muted, fontWeight: i === step ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
              {i < steps.length - 1 ? <span aria-hidden style={{ flex: 1, height: 1, background: i < step ? t.accent : t.line }} /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {shownFields.map((f, i) => {
        const err = errorFor(f);
        const long = /message|change|why|about/i.test(f);
        return (
          <label key={f + i} style={{ display: "flex", flexDirection: "column", gap: 3, flex: long ? 1 : undefined, minHeight: 0 }}>
            <span style={{ fontSize: t.fontPx * 0.78, color: t.muted }}>{f}</span>
            {long ? (
              <textarea
                aria-label={f}
                aria-invalid={!!err}
                value={values[f] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                style={{ ...fieldStyle(t, shape, !!err), flex: 1, minHeight: t.fontPx * 3, resize: "none" }}
              />
            ) : (
              <input
                aria-label={f}
                aria-invalid={!!err}
                aria-describedby={err ? `${uid}-${i}` : undefined}
                value={values[f] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                style={fieldStyle(t, shape, !!err)}
              />
            )}
            {err ? <span id={`${uid}-${i}`} role="alert" style={{ color: "oklch(0.7 0.19 25)", fontSize: t.fontPx * 0.75 }}>{err}</span> : null}
          </label>
        );
      })}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "auto", paddingTop: 4 }}>
        {steps && step > 0 ? <Btn t={t} label="Back" primary={false} onClick={() => setStep((s) => s - 1)} /> : null}
        {steps && step < steps.length - 1 ? (
          <Btn t={t} label="Next" onClick={() => setStep((s) => s + 1)} />
        ) : (
          <Btn t={t} label={id === "booking" ? "Book" : "Send"} onClick={submit} />
        )}
      </div>
      {id === "autosave" && mode === "live" ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.75 }}>{Object.keys(values).length ? "Saved just now" : "Changes save as you type"}</span> : null}
      {errors.length && !steps ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.72 }}>{errors.length} field{errors.length > 1 ? "s" : ""} to fix</span> : null}
    </Fill>
  );
}

/** Email signup: one field, one button, a real thank-you. */
export function Newsletter({ id, content, options, theme: t, emit }: PartProps) {
  const label = items(content, ["Email"])[0]!;
  const shape = opt(options, "shape", "rounded");
  const [v, setV] = React.useState("");
  const [state, setState] = React.useState<"idle" | "error" | "done">("idle");
  const submit = () => {
    if (!isEmail(v.trim())) {
      setState("error");
      return;
    }
    setState("done");
    emit?.({ type: "toast", text: "Subscribed", level: "success" });
  };
  if (state === "done") {
    return (
      <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: t.text }}>
        <span aria-hidden style={{ color: t.accent }}>✓</span> You&apos;re on the list.
      </Fill>
    );
  }
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
      <input
        aria-label={label}
        aria-invalid={state === "error"}
        placeholder={`${label}…`}
        value={v}
        onChange={(e) => { setV(e.target.value); setState("idle"); }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ ...fieldStyle(t, shape, state === "error"), flex: 1 }}
      />
      <Btn t={t} label="Subscribe" shape={shape} onClick={submit} />
      {state === "error" ? <span role="alert" style={{ position: "absolute", bottom: -18, left: 0, color: "oklch(0.7 0.19 25)", fontSize: t.fontPx * 0.75 }}>Enter a valid email</span> : null}
    </Fill>
  );
}

/** A drop zone that accepts a drop and lists what it got. */
export function FileDrop({ id, content, theme: t, emit }: PartProps) {
  const [over, setOver] = React.useState(false);
  const [files, setFiles] = React.useState<string[]>([]);
  const label = items(content, ["Drop files here"])[0]!;
  const add = (names: string[]) => {
    if (!names.length) return;
    setFiles((f) => [...f, ...names].slice(0, 5));
    emit?.({ type: "toast", text: `${names.length} file${names.length > 1 ? "s" : ""} added`, level: "success" });
  };
  return (
    <Fill
      t={t}
      data-part={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files).map((f) => f.name)); }}
      style={{ ...ghostStyle(t, over ? t.accent : t.line), background: over ? `${t.accent}12` : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: t.fontPx, textAlign: "center" }}
    >
      <span aria-hidden style={{ fontSize: t.fontPx * 1.6, color: t.accent }}>⤓</span>
      <span style={{ fontSize: t.fontPx * 0.92 }}>{label}</span>
      <label style={{ color: t.accent, fontSize: t.fontPx * 0.82, cursor: "pointer", textDecoration: "underline" }}>
        or choose a file
        <input type="file" multiple aria-label="Choose files" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} onChange={(e) => add(Array.from(e.target.files ?? []).map((f) => f.name))} />
      </label>
      {files.length ? <span style={{ color: t.muted, fontSize: t.fontPx * 0.78 }}>{files.join(", ")}</span> : null}
    </Fill>
  );
}

/** Filters that toggle and report how many are on. */
export function FilterPanel({ id, content, theme: t }: PartProps) {
  const groups = items(content, ["Category", "Price", "Colour"]);
  const [on, setOn] = React.useState<Record<string, boolean>>({});
  const count = Object.values(on).filter(Boolean).length;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx, display: "flex", flexDirection: "column", gap: t.fontPx * 0.6, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontFamily: t.headingFamily, fontSize: t.fontPx * 0.95 }}>Filters</strong>
        {count ? (
          <button type="button" onClick={() => setOn({})} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.accent, font: "inherit", fontSize: t.fontPx * 0.8 }}>Clear {count}</button>
        ) : null}
      </div>
      {groups.map((g) => {
        const r = rng(hash(g));
        return (
          <div key={g} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: t.fontPx * 0.75, textTransform: "uppercase", letterSpacing: 1, color: t.muted }}>{g}</span>
            {Array.from({ length: 3 }, (_, i) => {
              const key = `${g}:${i}`;
              const name = sample.word(r);
              return (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: t.fontPx * 0.88, cursor: "pointer", textTransform: "capitalize" }}>
                  <input type="checkbox" checked={!!on[key]} onChange={(e) => setOn((o) => ({ ...o, [key]: e.target.checked }))} style={{ accentColor: t.accent }} />
                  {name}
                </label>
              );
            })}
          </div>
        );
      })}
    </Fill>
  );
}

/** A month you can page through and pick a day from. */
export function DatePicker({ id, theme: t }: PartProps) {
  const [month, setMonth] = React.useState(0);
  const [day, setDay] = React.useState<number | null>(null);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = 30;
  return (
    <Fill t={t} data-part={id} style={{ ...cardStyle(t), padding: t.fontPx * 0.8, display: "flex", flexDirection: "column", gap: 6, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => (m + 11) % 12)} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.muted, font: "inherit" }}>‹</button>
        <strong style={{ fontSize: t.fontPx * 0.9, fontFamily: t.headingFamily }}>{MONTHS[month]}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth((m) => (m + 1) % 12)} style={{ background: "transparent", border: "none", cursor: "pointer", color: t.muted, font: "inherit" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} style={{ textAlign: "center", color: t.muted, fontSize: t.fontPx * 0.7 }}>{d}</span>
        ))}
        {Array.from({ length: days }, (_, i) => {
          const n = i + 1;
          const on = day === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => setDay(n)}
              style={{ aspectRatio: "1", border: "none", cursor: "pointer", borderRadius: Math.min(t.radius, 8), background: on ? t.accent : "transparent", color: on ? t.accentText : t.text, font: "inherit", fontSize: t.fontPx * 0.78 }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </Fill>
  );
}

/** Stars that fill on hover and stay when clicked. */
export function Rating({ id, theme: t, emit }: PartProps) {
  const [value, setValue] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const shown = hover || value;
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", alignItems: "center", gap: 4 }} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => { setValue(n); emit?.({ type: "toast", text: `Rated ${n}/5`, level: "success" }); }}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, fontSize: t.fontPx * 1.5, lineHeight: 1, color: n <= shown ? t.accent : `${t.muted}66` }}
        >
          ★
        </button>
      ))}
      {value ? <span style={{ marginLeft: 6, color: t.muted, fontSize: t.fontPx * 0.85 }}>{value}/5</span> : null}
    </Fill>
  );
}
