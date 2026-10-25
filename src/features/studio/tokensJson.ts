/**
 * READING tokens.json BACK IN (create-system "(d) Export", "Staying in sync").
 *
 * An export writes the System as `tokens/tokens.json` (`send-out/tokensOut.ts`).
 * A person or a code chat may change a value there; on Refresh the Builder
 * reads the file back and the System shows the change. This is that reader,
 * beside `kitRun.ts#takeTokens`, which reads a repository's `tokens.css` the
 * same way:
 *
 *   · `readTokensJson`: every token in the file, with its CSS variable, its
 *     System id when Polio wrote it, and its value as CSS. A value nobody
 *     changed comes back as the exact CSS Polio wrote (kept in
 *     `$extensions["app.polio"].css`), so a round trip changes nothing;
 *   · `tokensJsonValues`: CSS variable → value, the shape `KitSeen.values`
 *     has, so `takeTokens` takes a tokens.json as it takes a tokens.css;
 *   · `tokenChanges`: what to do to a System to match the file — values to
 *     set (`api.ts#setToken`) and tokens the file adds (`api.ts#addToken`).
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { KIND_OUT, colourCss, durationCss, easingCss, facesCss, shadowCss, w3cValue, type W3cColour, type W3cShadow } from "./send-out/index.ts";
import { tokenById, valueOf, type System, type TokenKind } from "./system/model.ts";

export interface ReadToken {
  kind: TokenKind;
  /** Its key in its group (`accent`). */
  key: string;
  /** Its CSS variable (`--colour-accent`). */
  css: string;
  /** Its id in the System, when Polio wrote it. */
  id: string | null;
  /** The name a person gave it, when Polio wrote it. */
  name: string | null;
  /** The value as CSS. */
  value: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const KIND_OF_GROUP = new Map((Object.keys(KIND_OUT) as TokenKind[]).map((k) => [KIND_OUT[k].group, k]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A W3C `$value` as CSS, or null when it is not one this kind can hold. */
function asCss(kind: TokenKind, v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (kind === "colour") return isObj(v) && Array.isArray(v.components) && v.components.length >= 3 ? colourCss(v as unknown as W3cColour) : null;
  if (kind === "type" || kind === "space" || kind === "radius") {
    if (typeof v === "number") return `${v}px`;
    return isObj(v) && typeof v.value === "number" ? (v.unit === "rem" ? `${v.value * 16}px` : `${v.value}px`) : null;
  }
  if (kind === "face") return Array.isArray(v) && v.every((x) => typeof x === "string") ? facesCss(v as string[]) : null;
  if (kind === "shadow") {
    const layers = Array.isArray(v) ? v : isObj(v) ? [v] : null;
    return layers && layers.every((l) => isObj(l) && isObj(l.color)) ? shadowCss(layers as W3cShadow[]) : null;
  }
  if (kind === "duration") return isObj(v) && typeof v.value === "number" ? durationCss({ value: v.value, unit: v.unit === "s" ? "s" : "ms" }) : null;
  return Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === "number") ? easingCss(v as number[]) : null;
}

/** Every token in a tokens.json, or `{ ok: false, says }` for a file that is not one. */
export function readTokensJson(text: string): { ok: true; tokens: ReadToken[] } | { ok: false; says: string } {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch { return { ok: false, says: "tokens.json is not readable JSON." }; }
  if (!isObj(doc)) return { ok: false, says: "tokens.json holds no groups of tokens." };
  const tokens: ReadToken[] = [];
  for (const [group, body] of Object.entries(doc)) {
    const kind = KIND_OF_GROUP.get(group);
    if (!kind || !isObj(body)) continue;
    for (const [key, t] of Object.entries(body)) {
      if (key.startsWith("$") || !isObj(t) || !("$value" in t)) continue;
      const ext = isObj(t.$extensions) && isObj(t.$extensions["app.polio"]) ? t.$extensions["app.polio"] : {};
      const wrote = typeof ext.css === "string" ? ext.css : null;
      /* Untouched since Polio wrote it: the exact CSS, not a rounding of it. */
      const value = wrote !== null && same(w3cValue(kind, wrote).$value, t.$value) ? wrote : asCss(kind, t.$value);
      if (value === null) continue;
      tokens.push({ kind, key, css: `--${KIND_OUT[kind].css}-${key}`, id: typeof ext.id === "string" ? ext.id : null, name: typeof ext.name === "string" ? ext.name : null, value });
    }
  }
  return { ok: true, tokens };
}

/** CSS variable → value: the shape of `KitSeen.values`, for `takeTokens`. */
export function tokensJsonValues(tokens: readonly ReadToken[]): Record<string, string> {
  return Object.fromEntries(tokens.map((t) => [t.css, t.value]));
}

/** A value as a System token holds it: px as a number for sizes, CSS for the rest. */
function held(kind: TokenKind, css: string): string | number {
  if (kind === "type" || kind === "space" || kind === "radius") {
    const n = parseFloat(css);
    return Number.isFinite(n) ? n : css;
  }
  return css;
}

/** A name for a token the file adds: its key in words ("words-light-grey" → "Words light grey"). */
const nameOf = (key: string) => key.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * What a System needs to match a tokens.json: each of its tokens the file
 * holds at another value (`set`), and each token the file has that the
 * System does not (`add`). A token the file leaves out is not taken off:
 * the file is a code chat's to trim, the System is J's.
 */
export function tokenChanges(system: System, text: string): { ok: true; set: { id: string; value: string | number }[]; add: { kind: TokenKind; name: string; value: string | number }[] } | { ok: false; says: string } {
  const read = readTokensJson(text);
  if (!read.ok) return read;
  const set: { id: string; value: string | number }[] = [];
  const add: { kind: TokenKind; name: string; value: string | number }[] = [];
  for (const t of read.tokens) {
    const now = t.id ? tokenById(system, t.id) : null;
    const value = held(t.kind, t.value);
    if (!now) { add.push({ kind: t.kind, name: t.name ?? nameOf(t.key), value }); continue; }
    if (valueOf(now) !== value) set.push({ id: now.id, value });
  }
  return { ok: true, set, add };
}
