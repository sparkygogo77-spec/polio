#!/usr/bin/env node
/**
 * EVERY ANIMATION, STOP FOR STOP, ON EVERY SITE CAPTURED (the owner's (4),
 * 2026-09-30). trumpmorty.fun's LIVE dots ran two stages in the copy where
 * the page runs three: the capture carried the keyframes whole, but the dot
 * was read mid-blink (`opacity: .5`), and a rule with no 0% or 100% of its
 * own starts from and returns to that. An audit of each site's committed
 * document (`sites/<name>/site/document.json`), not a check: a document is
 * only as fresh as its last capture.
 *
 * For every animation a part (or a letter of a folded title) runs, it says:
 *
 *   · its keyframes rule is in the document, with every stop the page wrote
 *     (`--css <file or url>`: against the page's own stylesheet, parsed by
 *     the browser, each stop's key and declarations);
 *   · its longhands are all there (duration, timing, delay, iterations,
 *     direction, fill), `steps()` and `cubic-bezier()` kept as written;
 *   · and whether the part's look at rest was caught mid-animation: a
 *     property the rule animates with no 0% (or 100%) stop of its own,
 *     where the part's own value is not what the page sets at rest (an
 *     opacity under 1 on a part whose rule only takes it to 0, the way a
 *     `steps(2)` blink read on its half step is .5). Retake such a site;
 *     the capture now reads what an animation drives at rest (`dump.mjs`,
 *     `atRest`).
 *
 *   node capture/site/capture/audit-keyframes.mjs [--site <name>] [--css <stylesheet>] [--json]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = opt("--site");
const LONG = ["duration", "timing", "delay", "iterations", "direction", "fill"];
const stopsOf = (k) => k.frames.flatMap((f) => f.key.split(",").map((s) => s.trim())).map((s) => (s === "from" ? "0%" : s === "to" ? "100%" : s));

/* The page's own rules, parsed by a browser, when asked for. */
let pageRules = null;
if (opt("--css")) {
  const src = opt("--css");
  const text = /^https?:/.test(src) ? await (await fetch(src)).text() : readFileSync(src, "utf8");
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let pw = null;
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { pw = req(c); break; } catch { /* next */ } }
  if (!pw) { console.error("--css needs Playwright"); process.exit(2); }
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  pageRules = await page.evaluate((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css.replace(/@import[^;]*;/g, ""));
    const out = {};
    const walk = (list) => { for (const r of Array.from(list)) { if (r instanceof CSSKeyframesRule) out[r.name] = Array.from(r.cssRules).map((f) => ({ key: f.keyText, props: Array.from(f.style) })); else if (r.cssRules) walk(r.cssRules); } };
    walk(sheet.cssRules);
    return out;
  }, text);
  await browser.close();
}

const sites = readdirSync(join(root, "sites")).filter((s) => existsSync(join(root, "sites", s, "site", "document.json")) && (!only || s === only));
const report = [];
for (const site of sites) {
  const doc = JSON.parse(readFileSync(join(root, "sites", site, "site", "document.json"), "utf8"));
  const kf = new Map((doc.keyframes ?? []).map((k) => [k.name, k]));
  const runs = [];
  for (const n of doc.nodes) {
    for (const a of n.motion?.animation ?? []) runs.push({ n, a, where: "node" });
    for (const a of n.motion?.letter?.animation ?? []) runs.push({ n, a, where: "letters" });
    if (Array.isArray(n.content)) n.content.forEach((r, i) => { for (const a of r.motion?.animation ?? []) runs.push({ n, a, where: `run ${i}` }); });
  }
  /* A blink polio plays as a feature is still the page's own animation (captured.ts gives it `css`). */
  const handed = new Set((doc.behaviours?.idle ?? []).filter((i) => i.part && !i.folded).map((i) => `${i.part}|${i.name}`));
  for (const i of doc.behaviours?.idle ?? []) {
    const n = doc.nodes.find((x) => x.id === i.part);
    if (n && !i.folded && !(n.motion?.animation ?? []).some((a) => a.name === i.name)) runs.push({ n, a: { name: i.name }, where: "idle (behaviours)" });
  }
  for (const { n, a, where } of runs) {
    const k = kf.get(a.name);
    const issues = [];
    if (!k) issues.push("no keyframes rule");
    const missing = where === "idle (behaviours)" ? [] : LONG.filter((l) => a[l] === undefined || a[l] === "");
    if (missing.length) issues.push(`missing ${missing.join(", ")}`);
    if (k && pageRules?.[a.name]) {
      const theirs = pageRules[a.name].map((f) => `${f.key}:${f.props.sort().join("+")}`).join(" | ");
      const ours = k.frames.map((f) => `${f.key}:${Object.keys(f.style).sort().join("+")}`).join(" | ");
      if (theirs !== ours) issues.push(`stops differ from the page's: ${ours} ≠ ${theirs}`);
    }
    if (k) {
      const stops = new Set(stopsOf(k));
      const props = new Set(k.frames.flatMap((f) => Object.keys(f.style)));
      const open = !stops.has("0%") || !stops.has("100%");
      if (open && props.has("opacity") && typeof n.opacity === "number" && n.opacity < 1) issues.push(`rest caught mid-animation: opacity ${n.opacity} (the rule has no ${!stops.has("0%") ? "0%" : "100%"} stop, so it starts from this)`);
    }
    report.push({ site, part: n.id, where, name: a.name, stops: k ? stopsOf(k).join(" ") : "", timing: a.timing ?? "", ...(handed.has(`${n.id}|${a.name}`) ? { feature: "blink" } : {}), issues });
  }
}
if (args.includes("--json")) { console.log(JSON.stringify(report, null, 1)); process.exit(0); }
for (const site of sites) {
  const mine = report.filter((r) => r.site === site);
  const bad = mine.filter((r) => r.issues.length);
  console.log(`${site}: ${mine.length} animations, ${new Set(mine.map((r) => r.name)).size} rules, ${bad.length} with an issue`);
  for (const r of bad) console.log(`  ${r.part} (${r.where}) ${r.name} ${r.timing} [${r.stops}]: ${r.issues.join("; ")}`);
}
const bad = report.filter((r) => r.issues.length).length;
console.log(`\n${report.length} animations on ${sites.length} sites, ${bad} with an issue`);
