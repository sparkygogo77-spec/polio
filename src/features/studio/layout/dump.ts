/**
 * THE LAYOUT TREE AS TEXT, for a person or a test to read (`read.ts`).
 *
 *   section n_box_9  0,0 1440×991  grouped 34, placed 2
 *     column gap 24 pad 110 0 0 0 align center
 *       n_prose_12  max 600
 *       row (made up) gap 16 align center
 *         n_cta_14  max 160 h 48
 *     placed n_picture_3 at 0,0 — over n_box_4
 *
 * Pure.
 */

import type { Flow, LayoutItem, LayoutTree, Placed } from "./tree.ts";

const r = (v: number) => String(Math.round(v * 10) / 10);
const pad = (f: Flow) => {
  const p = f.pad;
  return p.top || p.right || p.bottom || p.left ? ` pad ${r(p.top)} ${r(p.right)} ${r(p.bottom)} ${r(p.left)}` : "";
};

function flowLine(f: Flow): string {
  if (f.display === "grid") return `grid ${f.columns!.length} columns [${f.columns!.map(r).join(" ")}] gap ${r(f.gap ?? 0)} row gap ${r(f.rowGap ?? 0)}${pad(f)}`;
  return `${f.direction}${f.gap == null ? "" : ` gap ${r(f.gap)}`}${pad(f)} align ${f.align}${f.minHeight != null ? ` min-height ${r(f.minHeight)}` : ""}`;
}

export function dumpLayout(tree: LayoutTree, name: (id: string) => string = () => ""): string {
  const out: string[] = [];
  const nm = (id: string) => { const s = name(id); return s ? `  "${s.slice(0, 40)}"` : ""; };
  const item = (it: LayoutItem, depth: number) => {
    const ind = "  ".repeat(depth);
    const extra = [
      it.part ? `max ${r(it.maxWidth)}` : "(made up)",
      it.fill ? "fill" : "",
      it.height != null ? `h ${r(it.height)}` : "",
      it.before ? `before ${r(it.before)}` : "",
      it.self ? `self ${it.self}` : "",
      it.offset ? `offset ${r(it.offset)}` : "",
    ].filter(Boolean).join(" ");
    out.push(`${ind}${it.part ?? "group"}${it.part ? nm(it.part) : ""}  ${extra}`);
    if (it.flow) flow(it.flow, depth + 1);
  };
  const placed = (p: Placed, depth: number) => {
    out.push(`${"  ".repeat(depth)}placed ${p.id}${nm(p.id)} at ${r(p.left)},${r(p.top)} ${r(p.box.w)}×${r(p.box.h)} — ${p.why}`);
    if (p.flow) flow(p.flow, depth + 1);
  };
  const flow = (f: Flow, depth: number) => {
    out.push(`${"  ".repeat(depth)}${flowLine(f)}`);
    for (const it of f.items) item(it, depth + 1);
    for (const p of f.placed) placed(p, depth + 1);
  };
  const c = tree.counts;
  out.push(`page ${tree.pageId ?? ""} at ${tree.width}: ${c.parts} parts, ${c.grouped} grouped (${c.parts ? Math.round((c.grouped / c.parts) * 1000) / 10 : 0}%), ${c.placed} placed`);
  for (const s of tree.sections) out.push(`  section ${s.id}  ${r(s.box.x)},${r(s.box.y)} ${r(s.box.w)}×${r(s.box.h)}  grouped ${s.grouped}, placed ${s.placed}`);
  out.push("");
  flow(tree.root, 0);
  return out.join("\n");
}
