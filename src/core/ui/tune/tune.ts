/**
 * TUNE: SLIDERS, NOT QUESTIONS (J, 2026-11-10: "orientation, order, size,
 * textures, lighting, speeds, motion effects like gravity, resistance (this
 * applies to everything when being modeled) ... a proper slider to customize
 * it").
 *
 * The pure half of the Tune drawer: a schema of groups of controls (a slider
 * with its range and step, or a choice), the defaults it implies, reading
 * values back safely (clamped, unknown keys dropped), and one small JSON to
 * export and import a look. Nothing here knows about the Agents board: the
 * board hands in `BOARD_TUNE` (`agents/boardTune.ts`); a model on the Models
 * page would hand in its own schema and storage key.
 *
 * No React and no imports, so tests import it straight.
 */

export interface Slider { key: string; label: string; kind: "slider"; min: number; max: number; step: number; value: number; unit?: string }
export interface Choice { key: string; label: string; kind: "choice"; options: { value: string; label: string }[]; value: string }
export type Control = Slider | Choice;
export interface TuneGroup { id: string; label: string; controls: Control[] }
export interface TuneSchema { id: string; label: string; groups: TuneGroup[] }
export type TuneValues = Record<string, number | string>;

export const controlsOf = (s: TuneSchema) => s.groups.flatMap((g) => g.controls);

export function defaultsOf(s: TuneSchema): TuneValues {
  return Object.fromEntries(controlsOf(s).map((c) => [c.key, c.value]));
}

/** One value as the schema allows it: a slider's clamped to its range and snapped to its step, a choice one of its options; else the default. */
export function allowed(c: Control, v: unknown): number | string {
  if (c.kind === "slider") {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return c.value;
    const snapped = Math.round((Math.min(c.max, Math.max(c.min, n)) - c.min) / c.step) * c.step + c.min;
    return Number(snapped.toFixed(6));
  }
  return typeof v === "string" && c.options.some((o) => o.value === v) ? v : c.value;
}

/** Values read from anywhere (storage, a pasted JSON): every key the schema has, each allowed; nothing else. */
export function readValues(s: TuneSchema, raw: unknown): TuneValues {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const src = r.values && typeof r.values === "object" && r.tune === s.id ? (r.values as Record<string, unknown>) : r;
  return Object.fromEntries(controlsOf(s).map((c) => [c.key, allowed(c, src[c.key])]));
}

/** The look as one small JSON: which schema, and only the values that differ from its defaults. */
export function exportValues(s: TuneSchema, v: TuneValues): string {
  const d = defaultsOf(s);
  const values = Object.fromEntries(controlsOf(s).filter((c) => readValues(s, v)[c.key] !== d[c.key]).map((c) => [c.key, readValues(s, v)[c.key]]));
  return JSON.stringify({ tune: s.id, v: 1, values });
}

/** A pasted look: null when it isn't JSON, or is another schema's. */
export function importValues(s: TuneSchema, text: string): TuneValues | null {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return null; }
  if (!j || typeof j !== "object") return null;
  const r = j as { tune?: unknown; values?: unknown };
  if (r.tune !== undefined && r.tune !== s.id) return null;
  return readValues(s, r.tune === s.id ? r : j);
}

export const storageKey = (s: TuneSchema) => `polio.tune.${s.id}`;
