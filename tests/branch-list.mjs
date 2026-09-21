/**
 * THE BRANCH LIST, WITH DELETE.
 *
 * He cleans branches up by hand today, on GitHub. Every edit opens one and
 * every merge closes one, so the ones left are the ones opened and walked
 * away from. The repo control lists them now, each with the two facts he
 * decides on: whether main already has its work, and if not, how many
 * updates and how many lines. Delete is the one thing there that cannot be
 * undone, so it wears the Merge button's red ring and asks by name.
 *
 * GitHub is answered by this file: a stub on a port of its own, and a
 * server started against it. No token is used; the header the browser
 * sends is a placeholder the stub never reads. Nothing leaves the machine.
 *
 *   node tests/branch-list.mjs
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the stub */
const GH_PORT = 4321;
const APP_PORT = 3013;
const deleted = [];
const compare = {
  "edit/site-2026-09-20": { ahead_by: 2, behind_by: 0, files: [{ additions: 30, deletions: 1 }, { additions: 10, deletions: 2 }] },
  "edit/site-2026-09-19": { ahead_by: 0, behind_by: 3, files: [] },
  "old/done": { ahead_by: 0, behind_by: 12, files: [] },
  "edit/site-2026-09-18": { ahead_by: 1, behind_by: 1, files: [{ additions: 4, deletions: 4 }] },
};
const stub = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const json = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  const path = decodeURIComponent(url.pathname);
  if (req.method === "GET" && path === "/repos/him/site") return json(200, { default_branch: "main", full_name: "him/site" });
  if (req.method === "GET" && path === "/repos/him/site/branches") return json(200, [{ name: "main" }, ...Object.keys(compare).map((name) => ({ name }))]);
  const cmp = path.match(/^\/repos\/him\/site\/compare\/main\.\.\.(.+)$/);
  if (req.method === "GET" && cmp) return compare[cmp[1]] ? json(200, compare[cmp[1]]) : json(404, { message: "no" });
  const del = path.match(/^\/repos\/him\/site\/git\/refs\/heads\/(.+)$/);
  if (req.method === "DELETE" && del) { deleted.push(del[1]); delete compare[del[1]]; return json(204); }
  return json(404, { message: `stub has no ${req.method} ${path}` });
});
await new Promise((r) => stub.listen(GH_PORT, "127.0.0.1", r));

/* ------------------------------------------------- a server against it */
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP_PORT)], {
  env: { ...process.env, GITHUB_API: `http://127.0.0.1:${GH_PORT}`, GITHUB_TOKEN: "" },
  stdio: "ignore",
});
const BASE = `http://localhost:${APP_PORT}`;
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  try { up = (await fetch(`${BASE}/builder`)).ok; } catch { /* not yet */ }
  if (!up) await new Promise((r) => setTimeout(r, 500));
}
check("a server started against the stub answers", up);
const stop = async () => { app.kill(); stub.close(); };
if (!up) { await stop(); process.exit(1); }

/* ------------------------------------------------------------ the route */
const HEAD = { "x-github-token": "not-a-token", "content-type": "application/json" };
const listed = await (await fetch(`${BASE}/api/studio/branches?repo=him/site`, { headers: HEAD })).json();
check("the route lists every branch but main", listed.ok === true && listed.branches?.length === 4 && !listed.branches.some((b) => b.name === "main"), JSON.stringify(listed).slice(0, 200));
const top = listed.branches?.[0];
check("unmerged work first, most of it at the top", top?.name === "edit/site-2026-09-20" && top.updates === 2, top?.name);
check("each carries its updates and its added and removed lines", top?.added === 40 && top?.removed === 3 && listed.branches.find((b) => b.name === "old/done")?.updates === 0);
const noToken = await (await fetch(`${BASE}/api/studio/branches?repo=him/site`)).json();
check("no token is a sentence rather than an error", noToken.ok === false && noToken.reason === "no-token");
const mainGone = await (await fetch(`${BASE}/api/studio/branches`, { method: "DELETE", headers: HEAD, body: JSON.stringify({ repo: "him/site", branch: "main" }) })).json();
check("main is never deleted from here, whatever the call says", mainGone.ok === false && mainGone.reason === "is-main" && deleted.length === 0, mainGone.message);

/* -------------------------------------------------------------- the bar */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
/* The placeholder header rides on the browser's own calls, the way a held
   key would, so nothing about a token is put in any store. */
await page.route("**/api/studio/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-github-token": "not-a-token" } }));
const asked = [];
await page.exposeFunction("__asked", (m) => { asked.push(m); });
await page.addInitScript(() => { window.confirm = (m) => { window.__asked(m); return window.__answer !== false; }; });

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now(), repo: { owner: "him", name: "site", branch: "main" } }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [], siteBranch: "edit/site-2026-09-20" }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(1500);

const rows = await page.evaluate(() => Array.from(document.querySelectorAll("[data-repo-branch-row]")).map((li) => ({
  name: li.getAttribute("data-repo-branch-row"),
  unmerged: li.getAttribute("data-repo-branch-unmerged"),
  text: li.innerText.replace(/\s+/g, " ").trim(),
  ring: getComputedStyle(li.querySelector("[data-repo-branch-delete]")).borderColor,
})));
check("the list is on the repo control, one row per branch besides main", rows.length === 4, rows.map((r) => r.name).join(", "));
const open = rows.find((r) => r.name === "edit/site-2026-09-20");
check("a branch carrying unmerged work says how many updates and lines", !!open && open.unmerged === "1" && /2 updates not in main/.test(open.text) && /\+40/.test(open.text) && /−3/.test(open.text), open?.text);
check("and is marked as the branch this site's edits are on", /open here/.test(open?.text ?? ""));
const done = rows.find((r) => r.name === "old/done");
check("a branch main already has reads differently, in words", !!done && done.unmerged === "0" && /everything in main/.test(done.text), done?.text);
const mergeRing = await page.evaluate(() => getComputedStyle(document.querySelector("[data-repo-merge]")).borderColor);
check("Delete wears the same red ring as Merge", rows.every((r) => r.ring === mergeRing) && mergeRing !== "", `${rows[0]?.ring} vs ${mergeRing}`);

/* Saying no is honoured. */
await page.evaluate(() => { window.__answer = false; });
await page.locator("[data-repo-branch-delete='old/done']").click();
await page.waitForTimeout(500);
check("delete asks first, by name, and says main already has this one", /Delete old\/done\?/.test(asked[0] ?? "") && /already in main/.test(asked[0] ?? ""), asked[0]);
check("and no is no: nothing was deleted", deleted.length === 0);

/* Saying yes on the unmerged one names what goes with it. */
await page.evaluate(() => { window.__answer = true; });
await page.locator("[data-repo-branch-delete='edit/site-2026-09-20']").click();
await page.waitForTimeout(1200);
check("on a branch with unmerged work it says the updates and lines that go with it", /Delete edit\/site-2026-09-20\?/.test(asked[1] ?? "") && /2 updates/.test(asked[1] ?? "") && /\+40 −3/.test(asked[1] ?? "") && /not in main/.test(asked[1] ?? ""), asked[1]);
check("and yes deletes that branch on GitHub, and only that one", deleted.length === 1 && deleted[0] === "edit/site-2026-09-20", deleted.join(", "));
const left = await page.evaluate(() => Array.from(document.querySelectorAll("[data-repo-branch-row]")).map((li) => li.getAttribute("data-repo-branch-row")));
check("the row leaves the list", left.length === 3 && !left.includes("edit/site-2026-09-20"), left.join(", "));
const branchHere = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("builder.studio")).state.siteBranch ?? null; } catch { return "?"; } });
check("deleting the branch this site's edits were on closes it here too, so the next edit opens a fresh one", branchHere === null, String(branchHere));

await browser.close();
await stop();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
