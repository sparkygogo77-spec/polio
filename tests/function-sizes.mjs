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
 *   · a deployment's functions come to under 500 MB in all;
 *   · and each function starts from its trace alone: its traced files, and
 *     nothing else, are laid out in a folder of their own as Vercel lays
 *     them in /var/task, and what Vercel's launcher loads first
 *     (next/setup-node-env.js, which needs @swc/helpers) and the route itself
 *     are required there. fd301ea excluded `@swc/**` and every route answered
 *     500 with "Cannot find module '@swc/helpers/_/_interop_require_default'".
 *
 *   npm run build && node tests/function-sizes.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, linkSync, copyFileSync, rmSync, realpathSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

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
/* Each function from its trace alone. */
{
  const root = process.cwd();
  const nfts = [];
  (function walk(d) { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (/[/\\](route|page)\.js\.nft\.json$/.test(p)) nfts.push(p); } })(join(root, ".next", "server", "app"));
  /* Vercel lays Next's own server trace into every function beside the route's: the launcher loads next from it. */
  const serverTrace = ["next-server.js.nft.json", "next-minimal-server.js.nft.json"].flatMap((n) => { try { const at = join(root, ".next", n); return JSON.parse(readFileSync(at, "utf8")).files.map((f) => resolve(dirname(at), f)); } catch { return []; } });
  const missing = [];
  let swcless = 0;
  for (const nft of nfts) {
    const own = nft.replace(/\.nft\.json$/, "");
    const traced = JSON.parse(readFileSync(nft, "utf8")).files.map((f) => resolve(dirname(nft), f));
    const files = [own, ...traced, ...serverTrace];
    if (!files.some((f) => f.includes(`${sep}@swc${sep}helpers${sep}`))) swcless++;
    const box = mkdtempSync(join(tmpdir(), "fn-"));
    for (const f of files) {
      let st; try { st = statSync(f); } catch { continue; }
      if (!st.isFile()) continue;
      const rel = relative(root, f);
      if (rel.startsWith("..")) continue;
      const at = join(box, rel);
      mkdirSync(dirname(at), { recursive: true });
      try { linkSync(realpathSync(f), at); } catch { copyFileSync(f, at); }
    }
    const run = spawnSync(process.execPath, ["-e", `process.env.NODE_ENV="production"; require("./node_modules/next/dist/build/adapter/setup-node-env.external.js"); require(${JSON.stringify("./" + relative(root, own).split(sep).join("/"))});`], { cwd: box, encoding: "utf8", timeout: 60_000 });
    const lost = /Cannot find module '([^']+)'/.exec(`${run.stderr}`);
    if (lost) missing.push(`${relative(join(root, ".next", "server", "app"), own)}: ${lost[1]}`);
    rmSync(box, { recursive: true, force: true });
  }
  check("every function's trace holds @swc/helpers", swcless === 0, `${swcless} of ${nfts.length} lack it`);
  check("every function starts from its trace alone: the launcher's next/setup-node-env.js, then the route, find every module", missing.length === 0, missing.slice(0, 6).join(" | "));
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length} (${functions.length} functions, ${mb(total)})`);
process.exit(bad ? 1 : 0);
