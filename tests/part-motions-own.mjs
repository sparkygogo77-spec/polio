/**
 * A PART'S OWN MOTIONS ARE WORKED OUT FOR THAT PART, AND COME OUT THE SAME.
 *
 * The side panel's motion list for a picked part (`partFields.tsx#PartMotions`)
 * asked `movingParts` for every moving part on the page, named and placed in
 * its section, and kept the one part's rows: on sol face, a few hundred names
 * worked out again on every edit (0.2 s of a 1× Enter, profiling build).
 * `movingParts(…, only)` works out the one part's rows, and a row is its part,
 * the page and the crates, so they are the page's rows filtered to it.
 *
 *   1. on the saved sol face and PST boards, for every part on every page,
 *      `movingParts(nodes, crates, page, id)` equals the page's rows kept to
 *      that part, field for field;
 *   2. the boards have moving parts to compare (not a vacuous pass).
 *
 *   node tests/part-motions-own.mjs
 *
 * Covers: src/features/studio/motionInventory.ts, src/features/studio/panels/inspector/partFields.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { boardDoc, readBoard } from "./lib/board.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { movingParts } = await jiti.import(join(here, "..", "src", "features", "studio", "motionInventory.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

for (const name of ["solface", "pst"]) {
  const doc = boardDoc(readBoard(name));
  const crates = doc.motion ?? [];
  let parts = 0, moving = 0, rows = 0;
  const wrong = [];
  for (const page of doc.pages ?? []) {
    const all = movingParts(doc.nodes, crates, page.id);
    rows += all.length;
    for (const n of doc.nodes.filter((x) => x.pageId === page.id)) {
      parts++;
      const want = all.filter((r) => r.nodeId === n.id);
      const got = movingParts(doc.nodes, crates, page.id, n.id);
      if (want.length) moving++;
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${n.id}: ${got.length} rows, want ${want.length}`);
    }
  }
  check(`${name}: every part's own rows are the page's kept to it`, wrong.length === 0, wrong.length ? `${wrong.length} differ, e.g. ${wrong[0]}` : `${parts} parts`);
  check(`${name}: there are moving parts to compare`, moving > 0 && rows > 0, `${moving} moving parts, ${rows} rows`);
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
