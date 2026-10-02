/**
 * THE CAPTURE DIALOG REMEMBERS ITS RUNS, AND EACH FIELD KEEPS ITS KEYS.
 *
 * J, 2026-10-02: a finished capture was forgotten when the page was loaded
 * again or another site opened; a site that came from one capture would not
 * take another ("make a new site"); and pressing Name or Pages still typed
 * into Address. So:
 *
 *   · each run started is written down in this browser (captureRuns.ts),
 *     kept for GitHub's 30 days, newest first, one line per run;
 *   · a run still going when the page is loaded again is watched again,
 *     and listed under Recent captures once it ends;
 *   · each finished one has Bring into a new site: a new site, named for
 *     it, while the open site keeps its parts and its source;
 *   · Address, Name and Pages each take the keys when pressed;
 *   · Look only, no presses (under Advanced) reaches the workflow as `look`.
 *
 * GitHub is a stand-in in the browser; the token is a STANDIN_ placeholder.
 *
 *   node tests/capture-dialog.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The pure half. */
const R = await import("../src/features/studio/captureRuns.ts");
const DAY = 86400000, now = Date.parse("2026-10-02T12:00:00Z");
const run = (id, ago, extra = {}) => ({ capturer: "STANDIN-owner/polio", runId: id, name: `site-${id}`, url: "https://x.test", pages: "/", htmlUrl: `https://github.test/run/${id}`, startedAt: now - ago, at: "done", endedAt: now - ago + 60000, ...extra });
const kept = R.keptRuns([run(1, 31 * DAY), run(2, 2 * DAY), run(3, 1 * DAY), run(2, 2 * DAY, { at: "failed" })], now);
check("runs past GitHub's 30 days are dropped, newest first, one line per run", kept.map((x) => x.runId).join(",") === "3,2", kept.map((x) => x.runId).join(","));
const swapped = R.withRun([run(5, DAY, { at: "running", endedAt: undefined })], run(5, DAY, { ref: "run:5" }), now);
check("a run written again replaces its older line", swapped.length === 1 && swapped[0].at === "done" && swapped[0].ref === "run:5");
check("at most twelve are kept", R.keptRuns(Array.from({ length: 20 }, (_, i) => run(i + 1, i * 1000)), now).length === R.RUNS_MOST);
check("days left count down from 30", R.daysLeft(run(9, 10 * DAY), now) === 20 && R.agoWords(now - 2 * 3600000, now) === "2 hours ago");

/* The browser half. */
/* The default capturer, polio itself, which hands a capture back as its run's artifact; every call to it is answered here. */
const OWNER = "sparkygogo77-spec", NAME = "polio", REPO = `/repos/${OWNER}/${NAME}`;
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const gh = { dispatched: null, statusReads: 0, finishAfter: Infinity, artifactAsks: [] };
const runs = [];
await page.route("https://api.github.com/**", (r) => {
  const req = r.request();
  const u = new URL(req.url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = decodeURIComponent(u.pathname.slice(REPO.length));
  if (!rest) return j({ default_branch: "main" });
  if (rest.endsWith("/dispatches")) { gh.dispatched = JSON.parse(req.postData() || "{}"); runs.push({ id: 51, html_url: "https://github.test/run/51", created_at: new Date().toISOString() }); return r.fulfill({ status: 204, body: "" }); }
  if (/\/actions\/workflows\/.+\/runs$/.test(rest)) return j({ workflow_runs: runs });
  if (rest === "/actions/runs/51/jobs") return j({ jobs: [{ steps: [{ name: "Capture", status: "in_progress" }] }] });
  if (rest === "/actions/runs/51") { gh.statusReads++; const done = gh.statusReads > gh.finishAfter; return j({ status: done ? "completed" : "in_progress", conclusion: done ? "success" : null, html_url: "https://github.test/run/51" }); }
  if (rest === "/actions/runs/51/artifacts") return j({ artifacts: [{ id: 7051, name: "capture-pst-preview", size_in_bytes: 1000, expired: false }] });
  return j({ message: "no" }, 404);
});
await page.route("**/api/studio/capture-artifact**", (r) => { gh.artifactAsks.push(r.request().url()); return r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, says: "stand-in" }) }); });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
/* The open site came from another capture. */
await page.evaluate(([o, n]) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "trumpmorty.fun", updatedAt: Date.now(), source: { owner: o, name: n, branch: "run:42", dir: "sites/trumpmorty-fun" } }], activeId: "s1" }));
  localStorage.removeItem("builder.captureRuns.v1");
}, [OWNER, NAME]);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);

/* Each field keeps its keys. */
await page.locator("[data-capture-site]").first().click();
await page.waitForSelector("[data-capture-url]");
const val = (sel) => page.locator(sel).inputValue();
check("the address has the keys when the dialog opens", await page.evaluate(() => document.activeElement?.hasAttribute("data-capture-url")));
await page.keyboard.type("https://pst-server-beige.vercel.app");
await page.locator("[data-capture-name]").click();
await page.keyboard.press("Control+A");
await page.keyboard.type("pst-preview");
check("pressing Name and typing types into Name", (await val("[data-capture-name]")) === "pst-preview" && (await val("[data-capture-url]")) === "https://pst-server-beige.vercel.app", `${await val("[data-capture-url]")} | ${await val("[data-capture-name]")}`);
await page.getByText("Advanced", { exact: true }).click();
await page.locator("[data-capture-pages]").click();
await page.keyboard.press("Control+A");
await page.keyboard.type("/preview.html?still=1&screen=*, /gallery.html");
check("pressing Pages and typing types into Pages", (await val("[data-capture-pages]")) === "/preview.html?still=1&screen=*, /gallery.html" && (await val("[data-capture-url]")) === "https://pst-server-beige.vercel.app");
const look = page.locator("[data-capture-look] input");
check("Look only, no presses is there under Advanced, off until ticked", (await look.count()) === 1 && !(await look.isChecked()));
await look.check();
await page.getByRole("dialog").locator("label", { hasText: /^Name/ }).first().click();
await page.keyboard.type("-2");
check("pressing the word Name gives Name the keys", (await val("[data-capture-name]")) === "pst-preview-2", await val("[data-capture-name]"));
await page.locator("[data-capture-name]").fill("pst-preview");

/* A run, the page loaded again before it ends. */
await page.locator("[data-capture-start]").click();
await page.waitForSelector("[data-capture-running]", { timeout: 15000 }).catch(() => {});
check("the run starts with the pages as typed, looking only", gh.dispatched?.inputs?.pages === "/preview.html?still=1&screen=*, /gallery.html" && gh.dispatched?.inputs?.name === "pst-preview" && gh.dispatched?.inputs?.look === "true", JSON.stringify(gh.dispatched?.inputs) ?? await page.getByRole("dialog").innerText().catch(() => ""));
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.captureRuns.v1") || "[]"));
check("it is written down as it starts", stored.length === 1 && stored[0].runId === 51 && stored[0].at === "running" && !JSON.stringify(stored).includes("STANDIN_GITHUB_TOKEN"), JSON.stringify(stored));
gh.finishAfter = gh.statusReads + 1;
await page.reload({ waitUntil: "networkidle" });
let after = [];
for (let i = 0; i < 30; i++) { after = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.captureRuns.v1") || "[]")); if (after[0]?.at === "done") break; await page.waitForTimeout(1000); }
check("after a reload the run is watched again, and its end written down", after[0]?.at === "done" && after[0]?.ref === "run:51", JSON.stringify(after[0]));

/* Listed, and brought into a new site. */
await page.locator("[data-capture-site]").first().click();
await page.waitForSelector("[data-capture-recent]", { timeout: 5000 }).catch(() => {});
const row = page.locator('[data-capture-run="51"]');
check("Recent captures lists it, with Bring into a new site", (await row.count()) === 1 && (await row.locator("[data-capture-recent-bring]").count()) === 1, await row.innerText().catch(() => "none"));
const before = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.length ?? 0);
await row.locator("[data-capture-recent-bring]").click();
await page.waitForTimeout(3000);
const builds = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state ?? {});
const active = builds.projects?.find((p) => p.id === builds.activeId);
const old = builds.projects?.find((p) => p.id === "s1");
check("a new site is made for it, named for it, and opened", builds.projects?.length === before + 1 && active?.name === "pst-preview" && active?.id !== "s1", `${builds.projects?.length} sites, open: ${active?.name}`);
check("the site it came from keeps its own source", old?.source?.dir === "sites/trumpmorty-fun");
const refused = await page.locator('[role="status"]').allInnerTexts().catch(() => []);
check("nothing is refused, and the capture is read from its run", !refused.some((t) => /Make a new site/.test(t)) && gh.artifactAsks.some((u) => /id=7051/.test(u)), `${gh.artifactAsks.length} reads; ${refused.join(" | ")}`);

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
