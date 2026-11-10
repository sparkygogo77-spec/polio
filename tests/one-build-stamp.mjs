#!/usr/bin/env node
/**
 * ONE BUILD, ONE STAMP.
 *
 * A local `next build --webpack` loads next.config.ts in more than one
 * process, and each load stamped `BUILD_TIME` with its own `new Date()`: the
 * pages and the server came out seconds apart, BuildGuard called every page
 * "an older build than the server", and the Builder refused every Bring (the
 * import tests then read 0 parts). Now the first load writes the stamp into
 * its environment and every process it starts reads the same one back.
 *
 *   1. a process loads the config, then starts another that loads it a
 *      second later: both carry the same stamp;
 *   2. a stamp set from outside the build is the one used;
 *   3. a fresh build (no stamp in the environment) gets a new stamp.
 *
 *   node tests/one-build-stamp.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const CONFIG = pathToFileURL(fileURLToPath(new URL("../next.config.ts", import.meta.url))).href;
/** Load the config in a fresh node, wait `delay` ms first, optionally start a second load after it; print the stamps. */
const LOADER = `
const delay = Number(process.env.STAMP_DELAY || 0);
await new Promise((r) => setTimeout(r, delay));
const c = (await import(${JSON.stringify(CONFIG)})).default;
const out = [c.env.BUILD_TIME];
if (process.env.STAMP_CHILD === "1") {
  const { execFileSync } = await import("node:child_process");
  const child = execFileSync(process.execPath, ["--input-type=module", "-e", process.env.STAMP_LOADER], { env: { ...process.env, STAMP_CHILD: "0", STAMP_DELAY: "1100" }, encoding: "utf8" });
  out.push(...JSON.parse(child));
}
console.log(JSON.stringify(out));
`;
const run = (env) => {
  const base = { ...process.env };
  delete base.BUILD_TIME;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", LOADER], { env: { ...base, STAMP_LOADER: LOADER, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
};

// 1.
const [parent, child] = run({ STAMP_CHILD: "1" });
check("a second process of the same build carries the first one's stamp", typeof parent === "string" && parent === child, `${parent} vs ${child}`);

// 2.
const [given] = run({ BUILD_TIME: "2026-01-02T03:04:05.000Z" });
check("a stamp set from outside is the one used", given === "2026-01-02T03:04:05.000Z", given);

// 3.
const [fresh] = run({});
check("a new build gets its own stamp", typeof fresh === "string" && !Number.isNaN(Date.parse(fresh)) && fresh !== parent, `${fresh} after ${parent}`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
