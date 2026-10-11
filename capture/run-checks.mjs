#!/usr/bin/env node
/**
 * EVERY CAPTURE CHECK, THEN ONE TABLE.
 *
 * The checks came over from sink with the capturer: `site/capture/check-*.mjs`
 * and `site/capture/tools/check-tools.mjs`. Each serves its own stand-in
 * pages on 127.0.0.1 and opens a browser on them; none reaches a live site.
 * The ones that convert SOLCINERATOR or share.xyz again read the fixtures,
 * unpacked first (`fixtures/unpack.mjs`).
 *
 *   npm run capture:check                 every check
 *   npm run capture:check -- strokes svg  only the checks whose name holds a word
 *   JOBS=4 npm run capture:check          how many at once (default 3)
 *
 * The browser: CHROMIUM (default /opt/pw-browsers/chromium) and
 * PLAYWRIGHT_MODULE, as `site/capture/tools/browser.mjs` reads them; this
 * project's playwright-core is used when no playwright is named.
 */
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ensureFixtures } from "./fixtures/unpack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "site", "capture");
const words = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const all = [
  ...readdirSync(dir).filter((f) => /^check-.*\.mjs$/.test(f)).map((f) => join(dir, f)),
  join(dir, "tools", "check-tools.mjs"),
].filter((f) => !words.length || words.some((w) => relative(dir, f).includes(w)));
if (!all.length) { console.error(`no capture check named ${words.join(" ")}`); process.exit(1); }
const JOBS = Math.max(1, Number(process.env.JOBS) || 3);
const TIMEOUT = Number(process.env.CHECK_TIMEOUT_MS) || 600_000;

if (!ensureFixtures({ quiet: false })) process.exit(1);

const results = [];
const run = (file) => new Promise((done) => {
  const began = Date.now();
  let out = "";
  const child = spawn(process.execPath, [file], { cwd: join(here, ".."), env: { ...process.env, NODE_NO_WARNINGS: "1" } });
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  const timer = setTimeout(() => { out += "\n(timed out)"; child.kill("SIGKILL"); }, TIMEOUT);
  child.on("close", (code) => {
    clearTimeout(timer);
    const lines = out.split("\n");
    const ok = lines.filter((l) => /^\s*ok\b/.test(l)).length;
    const fail = lines.filter((l) => /^\s*FAIL\b/.test(l));
    results.push({ name: relative(dir, file), code, ok, fail, secs: Math.round((Date.now() - began) / 1000), tail: lines.filter(Boolean).slice(-3).join("\n") });
    process.stdout.write(code === 0 ? "." : "F");
    done();
  });
});

const queue = [...all];
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
process.stdout.write("\n\n");
results.sort((a, b) => a.name.localeCompare(b.name));
const w = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.code === 0 ? " pass" : " FAIL"}  ${r.name.padEnd(w)}  ${String(r.ok).padStart(3)} ok  ${String(r.fail.length).padStart(2)} failed  ${r.secs}s`);
const bad = results.filter((r) => r.code !== 0);
for (const r of bad) console.log(`\n${r.name}:\n${(r.fail.length ? r.fail.join("\n") : r.tail).slice(0, 2000)}`);
console.log(`\n${results.length - bad.length} of ${results.length} capture checks pass`);
process.exit(bad.length ? 1 : 0);
