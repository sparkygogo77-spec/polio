#!/usr/bin/env node
/**
 * UNDO OF A TEXT-SIZE CHANGE GIVES EVERY FIELD BACK (EDIT-ISSUES #55).
 *
 * After "Tidy it" (it folds the System's text sizes) and one undo, the word
 * fitter measured the words again and wrote a new w or h on a few prose
 * parts (sol face n_prose_342: w 1440 → 1681; n_prose_97: h 19 → 20), so
 * their box was not the captured one. A box the history puts back is the
 * box the board had settled to when it was checked in; the fitter now
 * leaves parts undo or redo put back alone until the next edit
 * (`store/history.ts#asPutBack`). Held, on each capture folder given:
 *
 *   1. the System taken and the board settled; Tidy, settled; one undo,
 *      settled: every field of every part is as it was before the tidy;
 *   2. redo then undo again: the same;
 *   3. on the first capture, the fitter still works after an edit: longer
 *      words in a prose part make it taller (or wider, on one line).
 *
 *   npx next start -p 3590
 *   node tests/undo-exact.mjs http://localhost:3590 capture/sites/thesolface3 [more capture folders]
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { importSink } from "./lib/sink.mjs";
const { chromium } = createRequire(import.meta.url)("playwright-core");

const BASE = (process.argv[2] ?? "http://localhost:3590").replace(/\/$/, "");
const SITES = process.argv.slice(3);
if (!SITES.length) { console.error("usage: node tests/undo-exact.mjs <builder url> <capture folder> [more]"); process.exit(2); }
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });

for (const SINK of SITES) {
  const name = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await importSink(page, BASE, SINK);
  const storeOf = () => page.evaluate(() => Object.fromEntries(window.__studioHistory.doc().nodes.map((n) => { const { sys, ...rest } = n; return [n.id, JSON.stringify(rest)]; })));
  const sys = (fn, arg) => page.evaluate(([f, a]) => new Function("S", "a", `return (${f})(S, a);`)(window.__polioSystem, a), [fn.toString(), arg]);
  /* The document once two reads 1.5 s apart agree. */
  const settled = async () => {
    let a = await storeOf();
    for (let i = 0, still = 0; i < 40 && still < 2; i++) {
      await page.waitForTimeout(1500);
      const b = await storeOf();
      still = JSON.stringify(a) === JSON.stringify(b) ? still + 1 : 0;
      a = b;
    }
    return a;
  };
  const differ = (a, b) => Object.keys(a).filter((id) => a[id] !== b[id]);
  const fields = (a, b, id) => { const x = JSON.parse(a[id] ?? "{}"), y = JSON.parse(b[id] ?? "{}"); return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map((k) => `${k} ${JSON.stringify(x[k])?.slice(0, 20)}→${JSON.stringify(y[k])?.slice(0, 20)}`).join("/"); };
  const say = (a, b, ids) => ids.slice(0, 4).map((id) => `${id} ${fields(a, b, id)}`).join(", ");

  const took = await sys((S) => S.take());
  if (!took?.ok) { check(`${name}: the System was taken`, false, JSON.stringify(took).slice(0, 120)); await page.close(); continue; }
  const before = await settled();
  const tidy = await sys((S) => S.tidy());
  const tidied = await settled();
  const changed = differ(before, tidied).length;
  await page.evaluate(() => window.__studioHistory.act("undo"));
  const undone = await settled();
  const back = differ(before, undone);
  check(`${name}: Tidy changed ${changed} parts; one undo puts every field of every part back`, tidy?.ok === true && changed > 0 && back.length === 0, `${back.length} differ: ${say(before, undone, back)}`);

  await page.evaluate(() => window.__studioHistory.act("redo"));
  await settled();
  await page.evaluate(() => window.__studioHistory.act("undo"));
  const again = await settled();
  const back2 = differ(before, again);
  check(`${name}: redo, then undo again: every field back`, back2.length === 0, `${back2.length} differ: ${say(before, again, back2)}`);

  /* 3. An edit after: the fitter fits the words again. */
  /* Only on the first capture (sol face, as run): some sites' words sit in rows that hold their height whatever is
     typed (share.xyz's centred labels do not grow after an edit on a fresh import either), so there is nothing to see. */
  if (SINK !== SITES[0]) { check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ")); await page.close(); continue; }
  /* On the open page: the board draws (and so fits) only that one. */
  const doc = await page.evaluate(() => { const d = window.__studioHistory.doc(); return d.nodes.filter((n) => n.pageId === d.activePageId); });
  /* Five of them: a part in a row that holds its height, or words cut by their box, may not grow, and one that does is enough. */
  const proses = doc.filter((n) => n.featureId === "prose" && typeof n.content === "string" && n.content.length > 20 && n.w > 60 && !n.byHand).slice(0, 5);
  for (const p of proses) await page.evaluate(([id, c]) => window.__studioHistory.act("updateNode", id, { content: c }), [p.id, `${p.content} ${p.content} ${p.content} ${p.content}`]);
  const edited = await settled();
  const grew = proses.filter((p) => { const q = JSON.parse(edited[p.id]); return q.h > p.h || q.w > p.w; });
  check(`${name}: after an edit the fitter still fits the words`, grew.length > 0, proses.map((p) => { const q = JSON.parse(edited[p.id]); return `${p.id} ${p.w}×${p.h} → ${q.w}×${q.h}`; }).join(", "));
  check(`${name}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.close();
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
