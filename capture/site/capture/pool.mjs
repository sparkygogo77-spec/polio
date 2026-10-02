#!/usr/bin/env node
/**
 * Captures, a few at a time. Each is its own `capture-route.mjs` with its
 * own browser, so pages that do not wait on one another are not taken one
 * after another: PonsStars' 23 screens at three at a time take a third of
 * the time. `capture-site.mjs` runs this once (synchronously) for the
 * pages it was given.
 *
 *   node capture/site/capture/pool.mjs <jobs.json> [--jobs 3]
 *
 * jobs.json is [{ id, args }]; what each capture says goes to stderr as it
 * says it, and the ids that failed are written beside it, to <jobs.json>.failed.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const list = JSON.parse(readFileSync(args[0], "utf8"));
const at = args.indexOf("--jobs");
const jobs = Math.max(1, Number(at >= 0 ? args[at + 1] : 3) || 1);
const failed = [];
let next = 0;
const one = () => {
  if (next >= list.length) return Promise.resolve();
  const c = list[next++];
  return new Promise((done) => {
    const child = spawn(process.execPath, c.args, { stdio: ["ignore", 2, 2] });
    child.on("exit", (code) => { if (code !== 0) { failed.push(c.id); console.error(`${c.id}: capture failed`); } done(); });
    child.on("error", () => { failed.push(c.id); done(); });
  }).then(one);
};
await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, one));
writeFileSync(`${args[0]}.failed`, JSON.stringify(failed));
