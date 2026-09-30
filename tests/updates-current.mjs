#!/usr/bin/env node
/**
 * WHAT HAS LANDED IS CURRENT ON ITS OWN.
 *
 * From the owner's walk-through: the Updates page stopped at "V1.6" and read
 * like developer notes. It was a snapshot someone had to regenerate, and no
 * one did. Now `/api/updates` asks GitHub for the history of the very commit
 * the deployment was built from (whatever depth Vercel cloned at), keeps the
 * answer, and the panel shows the live version and build time on top, then
 * one plain line per change, newest first, under the day it landed.
 *
 * GitHub is a stand-in on port 4337 serving a small history with a merge, a
 * failing-check commit, a line about the making, and a repeat. No token.
 * When GitHub fails, the route falls back (here to `git log`) and says so.
 *
 * Server: GITHUB_API=http://127.0.0.1:4337 VERCEL_GIT_REPO_OWNER=someone VERCEL_GIT_REPO_SLUG=builder VERCEL_GIT_COMMIT_SHA=abc1234def5678 VERCEL_GIT_COMMIT_REF=trunk npx next start -p 3013
 *
 *   node tests/updates-current.mjs http://127.0.0.1:3013
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
mkdirSync(".screenshots", { recursive: true });

const { shapeLines, dayOf } = await import("../src/features/studio/landed.ts");

/* ------------------------------------------------------------ the lines themselves */
{
  const { changes, counted } = shapeLines([
    { id: "a".repeat(40), says: "Old change", when: "2026-09-01T10:00:00Z" },
    { id: "b".repeat(40), says: "Merge pull request #9 from x/y", when: "2026-09-30T10:00:00Z", parents: 2 },
    { id: "c".repeat(40), says: "Newest change\n\nits body", when: "2026-09-30T09:00:00Z" },
    { id: "d".repeat(40), says: "A thing works: the check, red", when: "2026-09-29T09:00:00Z" },
    { id: "e".repeat(40), says: "Regenerate the passes record from the commit log", when: "2026-09-29T08:00:00Z" },
    { id: "f".repeat(40), says: "Old change", when: "2026-08-01T10:00:00Z" },
  ]);
  check("newest first, one line each, the subject only", J(changes.map((c) => c.says)) === J(["Newest change", "Old change"]), J(changes.map((c) => c.says)));
  check("merges, a check committed red, and repeats are left out", !changes.some((c) => /Merge|the check, red/.test(c.says)));
  check("a line about the making is counted, not shown", counted === 1, `${counted}`);
  check("the day reads the way a person says it", dayOf("2026-09-30T09:00:00Z") === "30 September 2026", dayOf("2026-09-30T09:00:00Z"));
}

/* ------------------------------------------------------------ the stand-in GitHub */
let mode = "fail";
const asked = [];
const iso = (d) => new Date(Date.UTC(2026, 8, d, 12)).toISOString();
const history = [
  { sha: "abc1234def5678".padEnd(40, "0"), parents: [{}, {}], commit: { message: "Merge pull request #12 from lane/a", committer: { date: iso(30) } } },
  { sha: "1".repeat(40), parents: [{}], commit: { message: "The top bar says where a publish is, in plain steps", committer: { date: iso(30) } } },
  { sha: "2".repeat(40), parents: [{}], commit: { message: "Two sites never share a publish target: the check, red", committer: { date: iso(29) } } },
  { sha: "3".repeat(40), parents: [{}], commit: { message: "Two sites never share a publish target", committer: { date: iso(29) } } },
  { sha: "4".repeat(40), parents: [{}], commit: { message: "Regenerate the passes record", committer: { date: iso(28) } } },
  { sha: "5".repeat(40), parents: [{}], commit: { message: "A card on Builds is a picture of its site", committer: { date: iso(2) } } },
];
const stub = createServer((req, res) => {
  asked.push(req.url);
  const u = new URL(req.url, "http://x");
  if (mode === "fail") { res.writeHead(500, { "content-type": "application/json" }); res.end("{}"); return; }
  if (u.pathname === "/repos/someone/builder/commits") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(u.searchParams.get("page") === "1" || !u.searchParams.get("page") ? history : []));
    return;
  }
  res.writeHead(404); res.end("{}");
});
await new Promise((r) => stub.listen(4337, "127.0.0.1", r));

/* ------------------------------------------------------------ the route */
{
  const a = await (await fetch(`${BASE}/api/updates`)).json();
  check("with GitHub failing it still answers, from the history it has, and says so", a.source !== "github" && a.changes.length > 0 && /GitHub could not be asked/.test(a.note ?? ""), `${a.source} ${J(a.note)}`);
}
mode = "ok";
const a = await (await fetch(`${BASE}/api/updates`)).json();
check("GitHub is asked from the very commit that is live", asked.some((u) => u.includes("sha=abc1234def5678")), asked.at(-1));
check("the answer names the live version", a.source === "github" && a.live.short === "abc1234", `${a.source} ${a.live.short}`);
check("newest first, the merge and the red check left out, the making counted", J(a.changes.map((c) => c.says)) === J(["The top bar says where a publish is, in plain steps", "Two sites never share a publish target", "A card on Builds is a picture of its site"]) && a.counted === 1, J(a.changes.map((c) => c.says)));
const n = asked.length;
await fetch(`${BASE}/api/updates`);
check("the list for one commit is kept: asked again, GitHub is not", asked.length === n, `${asked.length - n} more`);

/* ------------------------------------------------------------ the panel */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("[data-updates-toggle]").first().click();
await page.waitForSelector("[data-updates-panel][data-updates-source='github']", { timeout: 8000 }).catch(() => null);
const panel = await page.evaluate(() => ({
  live: document.querySelector("[data-updates-live]")?.textContent ?? null,
  lines: [...document.querySelectorAll("[data-change]")].map((e) => e.textContent),
  days: [...document.querySelectorAll("[data-updates-day]")].map((e) => e.getAttribute("data-updates-day")),
  text: document.querySelector("[data-updates-panel]")?.textContent ?? "",
}));
check("on top: the live version and when it was built", /^Live version abc1234, built /.test(panel.live ?? ""), J(panel.live));
check("then one line per change, newest first", J(panel.lines) === J(a.changes.map((c) => c.says)), J(panel.lines));
check("under the day each landed", J(panel.days) === J(["30 September 2026", "29 September 2026", "2 September 2026"]), J(panel.days));
check("no numbered passes or version boxes", !/\bv\d+\.\d\b|\bpasses?\b/i.test(panel.text));
await page.screenshot({ path: ".screenshots/updates-current.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Escape closes it", (await page.locator("[data-updates-panel]").count()) === 0);
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stub.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
