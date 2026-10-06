/**
 * THE FOUR SLOT KINDS A SCRIPT READS (kit/BUILDER-RULES.md, rule 28): sound,
 * key, format and line. The kit's `starter/parts/slots.js` reads them on the
 * site; this reads and writes them in the part's Settings (`SlotKindEditor`
 * in StyleLayerPanel.tsx), so what the builder writes is what the site reads.
 *
 *   sound   none | beep [hz] [volume] | "file.mp3" [volume]
 *   key     none | "q"
 *   format  "+0,0.00%"
 *   line    none | 2px dashed
 */

export const SCRIPT_SLOT_KINDS = ["sound", "key", "format", "line"] as const;
export type ScriptSlotKind = (typeof SCRIPT_SLOT_KINDS)[number];
export const isScriptSlotKind = (k: unknown): k is ScriptSlotKind => SCRIPT_SLOT_KINDS.includes(k as ScriptSlotKind);

export type Sound = { kind: "none" } | { kind: "beep"; hz: number; volume: number } | { kind: "file"; src: string; volume: number };

export function parseSound(value: string): Sound | null {
  const v = value.trim();
  if (!v || v === "none") return { kind: "none" };
  const beep = /^beep(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d*\.?\d+))?$/.exec(v);
  if (beep) return { kind: "beep", hz: Number(beep[1] ?? 880), volume: Math.min(1, Number(beep[2] ?? 0.5)) };
  const file = /^(['"])([^'"]+)\1(?:\s+(\d*\.?\d+))?$/.exec(v);
  if (file) return { kind: "file", src: file[2]!, volume: Math.min(1, Number(file[3] ?? 1)) };
  return null;
}

export function writeSound(s: Sound): string {
  if (s.kind === "none") return "none";
  const vol = Math.round(Math.max(0, Math.min(1, s.volume)) * 100) / 100;
  return s.kind === "beep" ? `beep ${Math.round(s.hz)} ${vol}` : `"${s.src.replace(/"/g, "")}" ${vol}`;
}

/** A key slot's key, "" for none; null when the value is not a key. */
export function parseKey(value: string): string | null {
  const v = value.trim();
  if (!v || v === "none") return "";
  const m = /^(['"])(.+)\1$/.exec(v);
  return m ? m[2]! : null;
}
export const writeKey = (key: string) => (key ? `"${key.replace(/"/g, "")}"` : "none");

export interface NumberFormat { before: string; sign: boolean; group: boolean; decimals: number; after: string }

export function parseFormat(value: string): NumberFormat | null {
  const m = /^([^0+]*)(\+?)(0(?:,0)?)(?:\.(0+))?([^0]*)$/.exec(value.trim().replace(/^(['"])(.*)\1$/, "$2"));
  return m ? { before: m[1]!, sign: m[2] === "+", group: m[3] === "0,0", decimals: (m[4] ?? "").length, after: m[5]! } : null;
}

export function writeFormat(f: NumberFormat): string {
  return `"${f.before}${f.sign ? "+" : ""}${f.group ? "0,0" : "0"}${f.decimals ? `.${"0".repeat(f.decimals)}` : ""}${f.after}"`;
}

/** A number the way a format slot writes it, and its sign, as the site shows it. */
export function formatNumber(n: number, value: string): { text: string; sign: "up" | "down" | "flat" } {
  const f = parseFormat(value) ?? { before: "", sign: false, group: false, decimals: 0, after: "" };
  const fixed = Math.abs(n).toFixed(f.decimals);
  const sign = Number(fixed) === 0 ? "flat" : n > 0 ? "up" : "down";
  const [whole, part] = fixed.split(".");
  const digits = f.group ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole!;
  const mark = sign === "down" ? "-" : sign === "up" && f.sign ? "+" : "";
  return { text: `${mark}${f.before}${digits}${part ? `.${part}` : ""}${f.after}`, sign };
}

export const LINE_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export type Line = { width: number; style: (typeof LINE_STYLES)[number] | "none" };

export function parseLine(value: string): Line | null {
  const v = value.trim();
  if (v === "none") return { width: 0, style: "none" };
  const m = /^(\d*\.?\d+)px\s+(solid|dashed|dotted|double)$/.exec(v);
  return m ? { width: Number(m[1]), style: m[2] as Line["style"] } : null;
}
export const writeLine = (l: Line) => (l.style === "none" || l.width <= 0 ? "none" : `${l.width}px ${l.style}`);

/** Plays a sound slot in the builder, so J hears what he picked (a file plays from the site's own address, when it has one). */
export function playSound(value: string, base?: string) {
  const s = parseSound(value);
  if (!s || s.kind === "none" || typeof window === "undefined") return;
  if (s.kind === "file") {
    try { const a = new Audio(base ? new URL(s.src, base).href : s.src); a.volume = s.volume; void a.play().catch(() => {}); } catch { /* not playable here */ }
    return;
  }
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = s.hz;
  gain.gain.setValueAtTime(s.volume * 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
  osc.onended = () => void ctx.close();
}
