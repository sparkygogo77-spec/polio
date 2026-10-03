#!/usr/bin/env node
// States stay in their frame (BUILDER-RULES.md): every state of a part (a part the record marks
// hidden, which the code shows later, and everything inside it) sits inside the frame around it, the
// part it is a state of. The builder moves and resizes states with that frame; a state whose box
// leaves it would spill over its neighbours when the code shows it. No dependencies.
//
//   node tools/state-frames.mjs design/record.json [--px 1]
//
// Reads a design record (DESIGN-RECORD.md) or a capture route file. Exits 1 when a state leaves its frame.
// kit:diff runs it on design/record.json whenever a pull request changes that file (a new design).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drawnBox, readRecord } from './record-diff.mjs';

// A template is not a state: its copies go into a list part, which grows with them (BUILDER-CONTRACT.md §4).
const isState = (n) => !!n?.states?.hidden && !String(n.hook ?? '').startsWith('template-') && !String(n.states.hidden.group ?? '').startsWith('template');
const sized = (b) => b && b.w > 1 && b.h > 1;

/** Every state that leaves its frame: { page, hook, frame, box, inFrame, over } for each part that does. */
export function stateFrames(record, { px = 1 } = {}) {
  const r = readRecord(record);
  const out = [];
  for (const page of r?.pages ?? []) {
    const byHook = new Map();
    const index = (n) => { if (!n) return; if (n.hook && !byHook.has(n.hook)) byHook.set(n.hook, n); for (const k of n.kids ?? []) index(k); };
    index(page.tree);
    // frame: the part a state sits in (its record parent, else the nearest hooked part around it).
    const walk = (n, around, state) => {
      if (!n) return;
      const box = drawnBox(n);
      let here = state;
      if (isState(n) && !state) {
        const frameNode = (n.parent && byHook.get(n.parent)) || around;
        if (frameNode) here = { hook: n.hook ?? n.label ?? n.p ?? '?', frame: frameNode.hook ?? frameNode.label ?? '?', box: drawnBox(frameNode) };
      }
      if (here && sized(box) && sized(here.box)) {
        const f = here.box;
        const over = Math.max(f.x - box.x, f.y - box.y, box.x + box.w - (f.x + f.w), box.y + box.h - (f.y + f.h));
        if (over > px) out.push({ page: page.file ?? page.url ?? '', hook: n.hook ?? n.label ?? '?', state: here.hook, frame: here.frame, box, inFrame: f, over: Math.round(over) });
      }
      const next = n.hook ? n : around;
      for (const k of n.kids ?? []) walk(k, next, here);
    };
    walk(page.tree, null, null);
  }
  return out;
}

export const sayFrame = (x) => `${x.page ? `${x.page}: ` : ''}${x.hook === x.state ? `state "${x.state}"` : `"${x.hook}" in state "${x.state}"`} leaves its frame "${x.frame}" by ${x.over}px (box ${x.box.x},${x.box.y} ${x.box.w}x${x.box.h}; frame ${x.inFrame.x},${x.inFrame.y} ${x.inFrame.w}x${x.inFrame.h}). Keep it inside the frame, or make it its own part.`;

if (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--px') ?? 'design/record.json';
  const pi = args.indexOf('--px');
  if (!existsSync(file)) { console.log(`kit:states: ${file} does not exist`); process.exit(2); }
  const bad = stateFrames(JSON.parse(readFileSync(file, 'utf8')), { px: pi >= 0 ? Number(args[pi + 1]) : 1 });
  for (const b of bad) console.log(`  ✗ ${sayFrame(b)}`);
  console.log(bad.length ? `kit:states failed: ${bad.length} part(s) leave their frame` : 'kit:states passed: every state stays in its frame');
  process.exit(bad.length ? 1 : 0);
}
