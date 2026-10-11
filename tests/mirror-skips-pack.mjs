#!/usr/bin/env node
/**
 * A DOCUMENT TOO BIG TO MIRROR EVEN PACKED IS NOT PACKED ON EVERY SAVE.
 *
 * The audit (2026-10-11): on the PST board every letter typed in a side
 * tab and every arrow-key nudge re-saved the whole document, and each save
 * packed its paths for localStorage (a full read and write of 3 MB) only to
 * find it still past `MIRROR_MAX` and leave a pointer. `mirrorText` now
 * takes what the last pack of the key kept and skips a pack that cannot fit.
 *
 *   1. With nothing known, a big document is packed once and says how much
 *      the pack kept; the saved PST board leaves a pointer naming its shape.
 *   2. Told that, the next save skips the pack: the same pointer, quicker.
 *   3. A document that fits packed is still packed, and comes back exactly;
 *      a stale `kept` that would not fit does not stop a pack that might.
 *   4. One that fits whole is mirrored whole, whatever `kept` says.
 *
 *   node tests/mirror-skips-pack.mjs
 *
 * Covers: src/features/studio/docStore.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { boardDoc, readBoard } from "./lib/board.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { mirrorText, packDocText, unpackDocText, pointerOf } = await jiti.import(join(here, "..", "src", "features", "studio", "docStore.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const doc = boardDoc(readBoard("pst"));
const text = JSON.stringify({ state: doc, version: 0 });
const pages = doc.pages.length;
const parts = doc.nodes.length;
/* Just past the line, so the PST board is a big document on any machine whatever its size today. */
const max = Math.floor(text.length * 0.9);

/* 1. */
const first = mirrorText(text, max);
const p1 = pointerOf(first.text);
check("the PST board too big even packed leaves a pointer", first.kind === "pointer" && !!p1, first.kind);
check("…naming its shape", p1?.pages === pages && p1?.parts === parts && p1?.bytes === text.length, JSON.stringify(p1));
const packedLen = packDocText(text).length;
check("…and says what the pack kept", typeof first.kept === "number" && Math.abs(first.kept - packedLen / text.length) < 1e-9, String(first.kept));

/* 2. */
const time = (fn, n = 5) => { const t = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t) / n; };
const packing = time(() => mirrorText(text, max));
const skipping = time(() => mirrorText(text, max, first.kept));
const second = mirrorText(text, max, first.kept);
check("told what the last pack kept, the next save leaves the same pointer", second.kind === "pointer" && second.text === first.text && second.kept === first.kept);
check("…without packing (under half the time)", skipping * 2 < packing, `${skipping.toFixed(1)} ms, packing ${packing.toFixed(1)} ms`);

/* 3. */
const fits = Math.ceil(packedLen * 1.001);
const packed = mirrorText(text, fits);
check("a document that fits packed is packed", packed.kind === "packed" && packed.text.length <= fits, packed.kind);
check("…and comes back exactly", unpackDocText(packed.text) === text);
const stale = mirrorText(text, fits, packed.kept);
check("…and again on the next save, told what the last pack kept", stale.kind === "packed");
const near = mirrorText(text, fits, (packedLen / text.length) * 1.015);
check("a `kept` a little over the line still packs (slack for what changed)", near.kind === "packed", near.kind);

/* 4. */
const whole = mirrorText(text, text.length, 0.99);
check("a document that fits whole is mirrored whole", whole.kind === "full" && whole.text === text && whole.kept === undefined);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? "FAILED" : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
