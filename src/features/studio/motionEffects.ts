/**
 * What a hover or a press actually does, read off the parts that do it.
 *
 * The Motion tab used to list "On hover, 17 parts" and then each part by its
 * hook ("queue-join · How it moved under the pointer"). That says nothing
 * about the movement. This reads the declarations a part takes on under the
 * pointer (a captured `:hover` / `:active` rule, or a library feature's
 * inputs) and says them in words: "Lifts 2px", "Darkens", "Grows and casts a
 * shadow". Parts that do the same thing are one effect, which the tab shows,
 * loops on the board and lets the owner add parts to or take parts from.
 *
 * Pure: no store, no DOM. `motionShow.ts` plays an effect; `motionWrite.ts`
 * changes who has it.
 */
import type { StudioNode } from "./board/store";
import { usesOf } from "./shelf";
import type { MoveRow } from "./motionInventory";

export type EffectKind = "hover" | "press";

export interface Effect {
  /** Stable for a page: the kind and the words. */
  key: string;
  kind: EffectKind;
  /** What happens, in words: "Lifts 2px and darkens". */
  label: string;
  /** The declarations the effect puts on a part, for the loop on the board and for a part it is added to. */
  style: Record<string, string>;
  /** Library feature the effect comes from, when it is one ("hover-lift"); else it is a captured rule. */
  workId?: string;
  workInputs?: Record<string, string>;
  rows: MoveRow[];
}

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return v === undefined || v === "" || !Number.isFinite(n) ? d : n;
};

/** The declarations a library feature puts on a part under the pointer, from its inputs. */
export function workStyle(workId: string, inputs: Record<string, string>): Record<string, string> {
  if (workId === "hover-lift") {
    const lift = num(inputs.lift, 4), x = num(inputs.x, 0), turn = num(inputs.turn, 0), k = num(inputs.scale, 1);
    return { translate: `${x}px ${-lift}px`, ...(turn ? { rotate: `${turn}deg` } : {}), ...(k !== 1 ? { scale: String(k) } : {}) };
  }
  if (workId === "press-push") {
    const down = num(inputs.down, 2), x = num(inputs.x, 0), k = num(inputs.scale, 1);
    const sh = String(inputs.shadow ?? "").trim();
    return { translate: `${x}px ${down}px`, ...(k !== 1 ? { scale: String(k) } : {}), ...(sh ? { "box-shadow": sh } : {}) };
  }
  return {};
}

/** The declarations a captured part takes on when hovered or pressed: every rule of that kind, later ones winning. */
export function capturedStyle(node: Pick<StudioNode, "motion">, kind: EffectKind): Record<string, string> {
  const list = (kind === "press" ? node.motion?.active : node.motion?.hover) ?? [];
  const out: Record<string, string> = {};
  for (const st of list) if (!st.pseudo) Object.assign(out, st.style ?? {});
  return out;
}

const px = (v: string) => {
  const m = /(-?[\d.]+)(px)?/.exec(v.trim());
  return m ? Number(m[1]) : 0;
};
const round = (n: number) => Math.round(Math.abs(n) * 10) / 10;

/** Relative lightness of a colour from 0 to 1, or null when it is not one this can read. */
export function lightness(c: string | undefined | null): number | null {
  const s = (c ?? "").trim().toLowerCase();
  let r: number, g: number, b: number;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(s);
  const rgb = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split("").map((x) => x + x).join("") : hex[1]!;
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  } else if (rgb) [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  else if (s === "white") [r, g, b] = [255, 255, 255];
  else if (s === "black") [r, g, b] = [0, 0, 0];
  else return null;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** The movement a transform or translate/scale/rotate says, as phrases. */
function moves(style: Record<string, string>): string[] {
  let dx = 0, dy = 0, k = 1, turn = 0;
  const t = style.transform ?? "";
  for (const m of t.matchAll(/(translate(?:3d|X|Y)?|scale(?:3d|X|Y)?|rotate(?:Z)?)\(([^)]*)\)/g)) {
    const args = m[2]!.split(/[\s,]+/).filter(Boolean);
    if (m[1] === "translateY") dy += px(args[0] ?? "0");
    else if (m[1] === "translateX") dx += px(args[0] ?? "0");
    else if (m[1]!.startsWith("translate")) { dx += px(args[0] ?? "0"); dy += px(args[1] ?? "0"); }
    else if (m[1]!.startsWith("scale")) k *= Number(args[0]) || 1;
    else turn += parseFloat(args[0] ?? "0") || 0;
  }
  if (style.translate) {
    const a = style.translate.trim().split(/\s+/);
    dx += px(a[0] ?? "0");
    dy += px(a[1] ?? "0");
  }
  if (style.scale) k *= Number(style.scale.trim().split(/\s+/)[0]) || 1;
  if (style.rotate) turn += parseFloat(style.rotate) || 0;
  const out: string[] = [];
  if (dy < 0) out.push(`lifts ${round(dy)}px`);
  /* Down and to the right together is a button pressed into the page. */
  if (dy > 0 && dx > 0) out.push(`presses in ${round(dy)}px`);
  else if (dy > 0) out.push(`sinks ${round(dy)}px`);
  if (dx && !(dy > 0 && dx > 0)) out.push(`slides ${round(dx)}px ${dx > 0 ? "right" : "left"}`);
  if (k > 1) out.push("grows");
  if (k < 1) out.push("shrinks");
  if (turn) out.push("turns");
  return out;
}

/** What a set of declarations does, as one plain line; `base` is the part's fill at rest, when known. */
export function describe(style: Record<string, string>, base?: string | null): string {
  const out = moves(style);
  for (const [p, v] of Object.entries(style)) {
    const val = v.trim();
    if (["transform", "translate", "scale", "rotate", "transition", "cursor", "will-change"].includes(p) || p.startsWith("transition")) continue;
    if (p === "filter") {
      const b = /brightness\(\s*([\d.]+)(%?)/.exec(val);
      const k = b ? Number(b[1]) / (b[2] ? 100 : 1) : 1;
      out.push(k < 1 ? "darkens" : k > 1 ? "brightens" : /blur/.test(val) ? "blurs" : "changes its filter");
    } else if (p === "background" || p === "background-color" || p === "background-image") {
      const now = lightness(val), was = lightness(base);
      out.push(now !== null && was !== null && Math.abs(now - was) > 0.04 ? (now < was ? "darkens" : "lightens") : "changes its fill");
    } else if (p === "opacity") out.push(Number(val) < 1 ? "fades" : "shows");
    else if (p === "box-shadow") out.push(val === "none" ? "loses its shadow" : /^(0(px)?\s+){2}/.test(val) ? "glows" : "casts a shadow");
    else if (p === "color") out.push("text changes colour");
    else if (p.startsWith("border") || p.startsWith("outline")) out.push("edge changes");
    else if (p.startsWith("text-decoration")) out.push(/underline/.test(val) ? "underlines" : "changes its underline");
    else if (p === "letter-spacing") out.push("spreads its letters");
    else out.push(`changes ${p.replace(/-/g, " ")}`);
  }
  const seen = [...new Set(out)];
  if (!seen.length) return "Only eases its changes, nothing set";
  const said = seen.length > 3 ? `${seen.slice(0, 3).join(", ")} and more` : seen.length === 3 ? `${seen[0]}, ${seen[1]} and ${seen[2]}` : seen.join(" and ");
  return said[0]!.toUpperCase() + said.slice(1);
}

/** One row's effect: its words and its declarations. */
export function effectOfRow(row: MoveRow, node: StudioNode | undefined): { label: string; style: Record<string, string>; workId?: string; workInputs?: Record<string, string> } {
  const kind: EffectKind = row.kind === "press" ? "press" : "hover";
  if (row.source === "work" && row.workId) {
    const inputs = usesOf(node?.work).find((u) => u.id === row.workId)?.inputs ?? {};
    const style = workStyle(row.workId, inputs);
    return { label: Object.keys(style).length ? describe(style) : row.what, style, workId: row.workId, workInputs: inputs };
  }
  const style = node ? capturedStyle(node, kind) : {};
  return { label: describe(style, node?.colour?.bg ?? null), style };
}

/** The hover or press rows of a page, as effects: parts that do the same thing together, the biggest first. */
export function effectsOf(rows: readonly MoveRow[], nodes: readonly StudioNode[]): Effect[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map<string, Effect>();
  for (const r of rows) {
    if (r.kind !== "hover" && r.kind !== "press") continue;
    const kind: EffectKind = r.kind;
    const e = effectOfRow(r, byId.get(r.nodeId));
    const key = `${kind}:${e.workId ?? "rule"}:${e.label}`;
    const got = out.get(key);
    if (got) got.rows.push(r);
    else out.set(key, { key, kind, label: e.label, style: e.style, workId: e.workId, workInputs: e.workInputs, rows: [r] });
  }
  return [...out.values()].sort((a, b) => b.rows.length - a.rows.length);
}

type Box = Pick<StudioNode, "id" | "x" | "y" | "w" | "h">;
/** Whether `outer`'s box holds `inner`'s: a panel and the words and buttons inside it move as one. */
export function holds(outer: Box, inner: Box): boolean {
  return outer.id !== inner.id && inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;
}
