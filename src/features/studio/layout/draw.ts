/**
 * THE LAYOUT TREE DRAWN AS FLEX AND GRID, to check it (`read.ts`).
 *
 * Every part is an empty box of its own height; every holder is a flex or
 * grid box whose height comes from what it holds; every width is a
 * max-width. Placed parts are the only `position: absolute` boxes. Each
 * part's box carries `data-part`, so a page can measure where the flow put
 * it and compare with where the board has it (tests/layout-reader.mjs).
 *
 * This is the check, not the export: the export writes the same tree as
 * Tailwind classes and real markup.
 *
 * Pure: returns a string.
 */

import type { Align, Flow, LayoutItem, LayoutTree, Placed } from "./tree.ts";

const px = (v: number) => `${Math.round(v * 100) / 100}px`;
const flexAlign = (a: Align) => (a === "start" ? "flex-start" : a === "end" ? "flex-end" : a);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function flowStyle(f: Flow): string {
  const p = f.pad;
  const s = [`padding:${px(p.top)} ${px(p.right)} ${px(p.bottom)} ${px(p.left)}`];
  if (f.minHeight != null) s.push(`min-height:${px(f.minHeight)}`);
  if (f.display === "grid") {
    s.push("display:grid", `grid-template-columns:${f.columns!.map(px).join(" ")}`, `column-gap:${px(f.gap ?? 0)}`, `row-gap:${px(f.rowGap ?? 0)}`, "align-items:start", "justify-items:start", "justify-content:start");
  } else {
    s.push("display:flex", `flex-direction:${f.direction}`, `align-items:${flexAlign(f.align)}`, "justify-content:flex-start");
    if (f.gap != null) s.push(`gap:${px(f.gap)}`);
  }
  return s.join(";");
}

function inner(f: Flow): string {
  return f.items.map((it) => item(it, f)).join("") + f.placed.map(placed).join("");
}

function item(it: LayoutItem, parent: Flow): string {
  const s = ["box-sizing:border-box", "position:relative", "min-width:0", "min-height:0", "margin:0"];
  const self = it.self ?? parent.align;
  if (parent.display === "grid") {
    s.push("width:100%", `max-width:${px(it.maxWidth)}`);
    if (it.before) s.push(`margin-top:${px(it.before)}`);
    if (it.offset) s.push(`margin-left:${px(it.offset)}`);
  } else if (parent.direction === "column") {
    s.push("width:100%", `max-width:${px(it.maxWidth)}`, "flex:none");
    if (it.self) s.push(`align-self:${flexAlign(it.self)}`);
    if (it.before) s.push(`margin-top:${px(it.before)}`);
    if (it.offset && (self === "start" || self === "stretch")) s.push(`margin-left:${px(it.offset)}`);
  } else {
    s.push(`flex:0 1 ${px(it.maxWidth)}`);
    s.push(`align-self:${flexAlign(self === "stretch" ? "start" : self)}`);
    if (it.before) s.push(`margin-left:${px(it.before)}`);
    if (it.offset && (self === "start" || self === "stretch")) s.push(`margin-top:${px(it.offset)}`);
  }
  if (it.height != null) s.push(`height:${px(it.height)}`);
  if (it.flow) s.push(flowStyle(it.flow));
  const part = it.part ? ` data-part="${esc(it.part)}"` : "";
  return `<div data-lay="${esc(it.id)}"${part} style="${s.join(";")}">${it.flow ? inner(it.flow) : ""}</div>`;
}

function placed(p: Placed): string {
  const s = ["box-sizing:border-box", "position:absolute", `left:${px(p.left)}`, `top:${px(p.top)}`, `width:${px(p.box.w)}`, `height:${px(p.box.h)}`, "margin:0"];
  if (p.flow) s.push(flowStyle(p.flow));
  return `<div data-lay="${esc(p.id)}" data-part="${esc(p.id)}" data-placed style="${s.join(";")}">${p.flow ? inner(p.flow) : ""}</div>`;
}

/** The whole page as one HTML document, the page's top-left at the window's. */
export function drawLayout(tree: LayoutTree): string {
  const root = `<div data-lay-root style="box-sizing:border-box;position:relative;width:${px(tree.width)};${flowStyle(tree.root)}">${inner(tree.root)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style></head><body>${root}</body></html>`;
}
