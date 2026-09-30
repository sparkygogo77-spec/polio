#!/usr/bin/env node
/**
 * NO FUNCTION CARRIES A BROWSER IT NEVER OPENS (2026-09-30).
 *
 * Vercel's Functions Storage is every kept deployment's functions, each with
 * what its trace holds. polio alone passed the free plan's 10 GB (11.05 GB;
 * 220 GB on Sep 22, with many deployments kept): next.config.ts put the
 * packed Chromium (66 MB) and playwright-core into every /api/studio/** and
 * /api/tweets/** function, 18 of them, 1394 MB a deployment. Five routes open
 * a browser. Held here on the last `next build`:
 *
 *   · only those five carry @sparticuz/chromium and playwright-core;
 *   · every other function is under 8 MB;
 *   · no function carries the repository's tests, docs, scripts or shots;
 *   · a deployment's functions come to under 500 MB in all.
 *
 *   npm run build && node tests/function-sizes.mjs
 */
import { execFileSync } from "node:child_process";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`); };
const { total, functions } = JSON.parse(execFileSync(process.execPath, ["scripts/function-sizes.mjs", "--json"], { encoding: "utf8", maxBuffer: 1 << 26 }));
const BROWSER = ["api/studio/element", "api/studio/preview-video", "api/studio/render", "api/studio/screenshot", "api/studio/zip"];
const carries = (f) => f.heaviest.some(([k]) => /@sparticuz\/chromium|playwright-core/.test(k));
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
check("the five routes that open a browser carry it", BROWSER.every((r) => carries(functions.find((f) => f.fn === r) ?? { heaviest: [] })), BROWSER.filter((r) => !carries(functions.find((f) => f.fn === r) ?? { heaviest: [] })).join(", "));
const others = functions.filter((f) => !BROWSER.includes(f.fn));
check("no other function carries it", others.every((f) => !carries(f)), others.filter(carries).map((f) => `${f.fn} ${mb(f.bytes)}`).join(", "));
check("every other function is under 8 MB", others.every((f) => f.bytes < 8 * 1048576), others.filter((f) => f.bytes >= 8 * 1048576).map((f) => `${f.fn} ${mb(f.bytes)}`).join(", "));
check("none carries the repository's tests, docs, scripts or shots", functions.every((f) => !f.heaviest.some(([k]) => /^(tests|docs|scripts|\.screenshots)\//.test(k))), functions.flatMap((f) => f.heaviest.filter(([k]) => /^(tests|docs|scripts)\//.test(k)).map(([k]) => `${f.fn}: ${k}`)).join(", "));
check("a deployment's functions come to under 500 MB", total < 500 * 1048576, mb(total));
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length} (${functions.length} functions, ${mb(total)})`);
process.exit(bad ? 1 : 0);
