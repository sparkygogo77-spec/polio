#!/usr/bin/env node
/**
 * EVERY MODULE IS ENTERED BY ITS FRONT DOOR.
 *
 * J (2026-10-08): the builder grew as loose files that all import each other,
 * so a change to states reached into look, publish and the timeline. Code now
 * moves into modules, one folder each (builder audit, item 4: states first).
 * A file outside a module may import only the module's doors; anything deeper
 * fails here, so the boundary holds after the move.
 *
 * The states module has two doors: `index.ts`, the pure rules (no React, no
 * store, every import ends in .ts, so node tests load it directly; checked
 * below by importing it), and `ui.ts`, its screens and store-bound helpers.
 *
 *   node tests/module-doors.mjs
 *
 * The board module (item 11) has four: `index.ts` (the pure press rules),
 * `store.ts` (the studio store), `ui.ts` (the board's screens) and `reads.ts`
 * (what the board reads off states, for the states module). The look module
 * has three: `index.ts` (pure looks maths, site colours, kits, fonts),
 * `parts.ts` (part looks, no store hooks) and `ui.ts` (the Look panel,
 * pasting and Make all like). Later modules (bring-in, ...) have `index.ts`
 * (pure) and `ui.ts` (screens and store-bound code), plus any door their README names.
 *
 * Covers: src/features/studio/states/index.ts, src/features/studio/states/ui.ts, src/features/studio/board/index.ts, src/features/studio/board/store.ts, src/features/studio/board/ui.ts, src/features/studio/board/reads.ts, src/features/studio/look/index.ts, src/features/studio/look/parts.ts, src/features/studio/look/ui.ts, src/features/studio/bring-in/index.ts, src/features/studio/bring-in/ui.ts, src/features/studio/send-out/index.ts, src/features/studio/send-out/run.ts, src/features/studio/shelf/index.ts, src/features/studio/shelf/run.ts, src/features/studio/shelf/ui.ts, src/features/studio/shelf/screens.ts, src/features/studio/loop/index.ts, src/features/studio/loop/run.ts, src/features/studio/loop/ui.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Each module: its folder and the files other modules may import. Add a row as each module moves (audit item 11). */
const MODULES = [
  { dir: "src/features/studio/states", doors: ["index.ts", "ui.ts"] },
  { dir: "src/features/studio/board", doors: ["index.ts", "store.ts", "ui.ts", "reads.ts"] },
  { dir: "src/features/studio/look", doors: ["index.ts", "parts.ts", "ui.ts"] },
  { dir: "src/features/studio/bring-in", doors: ["index.ts", "ui.ts"] },
  { dir: "src/features/studio/send-out", doors: ["index.ts", "run.ts"] },
  { dir: "src/features/studio/shelf", doors: ["index.ts", "run.ts", "ui.ts", "screens.ts"] },
  { dir: "src/features/studio/loop", doors: ["index.ts", "run.ts", "ui.ts"] },
];

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(["'])([^"']+)\1/gm;
const strip = (p) => p.replace(/\.(tsx?|mjs|js)$/, "").replace(/\/index$/, "");
/* Where an import lands, as a path from the repo root without its extension; null for packages. */
function target(fromFile, spec) {
  if (spec.startsWith("@/")) return strip(join("src", spec.slice(2)));
  if (spec.startsWith(".")) return strip(relative(ROOT, resolve(dirname(join(ROOT, fromFile)), spec)));
  return null;
}
/* The imports in one file's text that go past a module's doors. */
function trespasses(file, text) {
  const out = [];
  for (const m of text.matchAll(SPEC)) {
    const t = target(file, m[2]); if (t === null) continue;
    for (const { dir, doors } of MODULES) {
      if (file.startsWith(dir + "/")) continue;
      if (!t.startsWith(dir + "/")) continue;
      const ok = doors.some((d) => strip(`${dir}/${d}`) === t);
      if (!ok) out.push(`${file} imports ${m[2]}`);
    }
  }
  return out;
}
const walk = (d) => readdirSync(join(ROOT, d)).flatMap((f) => { const p = `${d}/${f}`; return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(tsx?|mjs|js)$/.test(f) ? [p] : []; });

const files = walk("src");
const bad = files.flatMap((f) => trespasses(f, readFileSync(join(ROOT, f), "utf8")));
check("no file outside a module imports past its doors", bad.length === 0, bad.slice(0, 8).join("; "));

/* The rule itself catches what it should, and lets through what it should. */
const S = "src/features/studio";
check("a deep relative import is caught", trespasses(`${S}/canvas/x.ts`, `import { a } from "../states/boardStates";`).length === 1);
check("a deep @/ import is caught", trespasses(`${S}/x.tsx`, `import { a } from "@/features/studio/states/PanelsPage";`).length === 1);
check("a type-only import() is caught", trespasses(`${S}/x.ts`, `let s: import("./states/stateRules.ts").Samples;`).length === 1);
check("the doors pass", trespasses(`${S}/x.ts`, `import { a } from "./states";\nimport { b } from "./states/index.ts";\nimport { c } from "./states/ui";`).length === 0);
check("files inside the module import each other freely", trespasses(`${S}/states/show.ts`, `import { a } from "./scenes.ts";`).length === 0);
check("a sibling named like a module file is not caught", trespasses(`${S}/x.ts`, `import { a } from "./structureKit";`).length === 0);

/* index.ts loads in plain node: no React, no store, nothing extensionless behind it. */
for (const { dir } of MODULES) {
  let err = "";
  try { await import(join(ROOT, dir, "index.ts")); } catch (e) { err = String(e?.message ?? e).split("\n")[0]; }
  check(`${dir}/index.ts loads in plain node`, err === "", err);
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
