"use client";
/**
 * THE TUNE DRAWER (Orbs 2, piece D): live sliders for anything with a look,
 * grouped, with Reset, and the look as one small JSON to copy out or paste
 * in. Values are kept per browser under `polio.tune.<schema id>`.
 *
 * It knows nothing about what it tunes: hand it a `TuneSchema` (`tune.ts`)
 * and read the values back with `useTune(schema)`. The Agents board is the
 * first user (`agents/boardTune.ts`); a model's own values on the Models page
 * would be a second schema with its own id, drawn by this same drawer.
 */
import * as React from "react";
import { controlsOf, defaultsOf, exportValues, importValues, readValues, storageKey, type Control, type TuneSchema, type TuneValues } from "./tune";

const subscribers = new Map<string, Set<() => void>>();
const cache = new Map<string, TuneValues>();

function load(s: TuneSchema): TuneValues {
  const had = cache.get(s.id);
  if (had) return had;
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(storageKey(s)) ?? "null"); } catch { /* private window, or not JSON */ }
  const v = readValues(s, raw);
  cache.set(s.id, v);
  return v;
}

/** Set some values (each allowed by the schema), keep them for this browser, and tell every reader. */
export function setTune(s: TuneSchema, patch: TuneValues | null) {
  const next = patch === null ? defaultsOf(s) : readValues(s, { ...load(s), ...patch });
  cache.set(s.id, next);
  try { localStorage.setItem(storageKey(s), JSON.stringify(next)); } catch { /* not kept, still live */ }
  for (const f of subscribers.get(s.id) ?? []) f();
}

/** The schema's values now, re-read on every change from any drawer. Defaults until the browser is there. */
export function useTune(s: TuneSchema): TuneValues {
  const sub = React.useCallback((f: () => void) => {
    let set = subscribers.get(s.id);
    if (!set) { set = new Set(); subscribers.set(s.id, set); }
    set.add(f);
    return () => { set!.delete(f); };
  }, [s]);
  const defaults = React.useMemo(() => defaultsOf(s), [s]);
  return React.useSyncExternalStore(sub, () => load(s), () => defaults);
}

const mono = "ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";

export function TuneDrawer({ schema, onClose }: { schema: TuneSchema; onClose: () => void }) {
  const values = useTune(schema);
  const [said, setSaid] = React.useState("");
  const [pasting, setPasting] = React.useState(false);
  const [text, setText] = React.useState("");
  const copy = async () => {
    const json = exportValues(schema, values);
    try { await navigator.clipboard.writeText(json); setSaid("Copied. Paste it in another browser's Tune drawer."); }
    catch { setText(json); setPasting(true); setSaid("Couldn't copy: here it is to select."); }
  };
  const paste = () => {
    const v = importValues(schema, text);
    if (!v) { setSaid(`That isn't a look for ${schema.label}.`); return; }
    setTune(schema, v); setPasting(false); setText(""); setSaid("Look set.");
  };
  return (
    <section data-tune={schema.id} aria-label={`Tune ${schema.label}`} className="flex flex-col gap-3 rounded-2xl p-3 text-[12px]"
      style={{ fontFamily: mono, background: "oklch(0.15 0.05 300 / 0.96)", border: "1px solid rgba(255,255,255,.18)", color: "#f2ecff" }}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[13px] font-bold text-white">Tune · {schema.label}</h3>
        <span className="flex gap-1.5">
          <button type="button" data-tune-reset="" onClick={() => { setTune(schema, null); setSaid("Back to the defaults."); }} className="rounded-full px-2.5 py-1 font-bold" style={{ color: "#1a1204", background: "oklch(0.87 0.17 85)" }}>Reset</button>
          <button type="button" data-tune-close="" aria-label="Close tune" onClick={onClose} className="rounded-full px-2.5 py-1" style={{ border: "1px solid rgba(255,255,255,.4)" }}>Close</button>
        </span>
      </header>
      {schema.groups.map((g) => (
        <fieldset key={g.id} data-tune-group={g.id} className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1 p-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9fd8ff" }}>{g.label}</legend>
          {g.controls.map((c) => <Row key={c.key} c={c} v={values[c.key]} onChange={(x) => setTune(schema, { [c.key]: x })} />)}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" data-tune-export="" onClick={() => void copy()} className="rounded-full px-2.5 py-1 font-bold" style={{ color: "#021018", background: "oklch(0.85 0.17 205)" }}>Copy look (JSON)</button>
        <button type="button" data-tune-import-open="" onClick={() => setPasting((x) => !x)} className="rounded-full px-2.5 py-1" style={{ border: "1px solid rgba(255,255,255,.4)" }}>Paste a look</button>
        <span data-tune-count="" className="ml-auto" style={{ color: "#9fb8c8" }}>{controlsOf(schema).length} values</span>
      </div>
      {pasting ? (
        <div className="flex flex-col gap-1.5">
          <textarea data-tune-json="" aria-label="A look as JSON" value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-lg p-2" style={{ font: `11px ${mono}`, background: "rgba(0,0,0,.35)", color: "#fff", border: "1px solid rgba(255,255,255,.25)" }} />
          <button type="button" data-tune-import="" onClick={paste} className="self-start rounded-full px-2.5 py-1 font-bold" style={{ color: "#021018", background: "oklch(0.85 0.17 205)" }}>Set this look</button>
        </div>
      ) : null}
      {said ? <p data-tune-said="" role="status" className="m-0" style={{ color: "#9fb8c8" }}>{said}</p> : null}
    </section>
  );
}

function Row({ c, v, onChange }: { c: Control; v: number | string | undefined; onChange: (v: number | string) => void }) {
  const id = `tune-${c.key}`;
  if (c.kind === "choice") {
    return (
      <label htmlFor={id} className="flex items-center gap-2">
        <span className="w-24 shrink-0">{c.label}</span>
        <select id={id} data-tune-key={c.key} value={String(v ?? c.value)} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded-md px-1.5 py-1" style={{ background: "rgba(0,0,0,.35)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", font: `12px ${mono}` }}>
          {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    );
  }
  const n = typeof v === "number" ? v : c.value;
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="w-24 shrink-0">{c.label}</span>
      <input id={id} type="range" data-tune-key={c.key} min={c.min} max={c.max} step={c.step} value={n} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1" style={{ accentColor: "oklch(0.85 0.17 205)" }} />
      <span data-tune-value={c.key} className="w-12 shrink-0 text-right tabular-nums">{n}{c.unit ?? ""}</span>
    </label>
  );
}
