/**
 * The dock's "Everything Claude is doing" tab, on the fake PC tree
 * (helper/pc/fake.ts), in a headless browser. No Builder, no helper.
 *
 * It shows the totals at the top and one collapsible group per app, session,
 * Terminal panel and "Left running", with every process labelled. The idle
 * dev server says "idle 40 min". Stop on it sends one good pc-stop and its
 * tree goes; nothing else does. The desktop app has no Stop. Stop on a
 * session's own claude.exe asks first and sends only after the yes. "Stop
 * all idle" asks, then sends pc-stop-idle. Cloud says why it isn't visible.
 *
 *   node tests/agents-pcview-panel.mjs        (SHOT=<png> also saves a picture)
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = (code) => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(code ?? (passed === results.length ? 0 : 1));
};

let serveDock = null, C = null, F = null;
try {
  ({ serveDock } = await import("../helper/dock/serve.mjs"));
  C = await import("../helper/contract.ts");
  F = await import("../helper/pc/fake.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the dock server, the contract and the fake PC load", !!(serveDock && C && F));
if (!serveDock || !C || !F) done(1);

const pc = F.fakePc();
const P = F.FAKE_PIDS;
const server = await serveDock({ port: 0 });
const BASE = `http://127.0.0.1:${server.address().port}`;
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath: existsSync(AT) ? AT : undefined });
const errors = [];

try {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 2200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(`${BASE}/dock?tab=pc&pc=fake`);
  await page.waitForSelector("[data-pcview-ready]", { timeout: 5000 }).catch(() => {});

  check("the tab is there and open", await page.locator('nav [data-tab="pc"]').count() === 1 && await page.locator('[data-tab-body="pc"]').isVisible());
  const totals = (await page.textContent("[data-pc-totals]").catch(() => "")) ?? "";
  check("the totals at the top count processes and sessions", totals.includes(`${pc.totals.processes} processes`) && totals.includes("2 sessions"), totals.replace(/\s+/g, " "));
  const groups = await page.$$eval("[data-pc-group]", (els) => els.map((e) => ({ id: e.dataset.pcGroup, kind: e.dataset.kind, title: e.querySelector("[data-group-title]")?.textContent ?? "" })));
  check("one group per app, session, Terminal panel and Left running, in order", groups.map((g) => g.id).join() === pc.groups.map((g) => g.id).join(), groups.map((g) => g.kind).join());
  check("each session group carries its title", groups.some((g) => g.title.includes("Polio coordinator #3")) && groups.some((g) => g.title.includes("export: send to repo")));
  const rows = await page.$$eval("[data-pc-item]", (els) => els.map((e) => Number(e.dataset.pcItem)));
  check("every process has a row", rows.length === pc.totals.processes, `${rows.length} of ${pc.totals.processes}`);
  const devRow = page.locator(`[data-pc-item="${P.devServer}"]`);
  check("the dev server's row says what it is for", (await devRow.textContent()).includes("Builder copy for lane export, port 3091"));
  check("and that it is idle 40 min", await devRow.locator("[data-idle]").textContent().then((t) => t.includes("idle 40 min"), () => false));
  const appStops = await page.locator('[data-pc-group="app"] [data-pc-stop], [data-pc-group="app"] [data-stop-group]').count();
  check("the desktop app has no Stop anywhere", appStops === 0, `${appStops}`);
  check("the cloud says why it isn't visible", (await page.textContent("[data-pc-cloud]")).includes("Not visible yet"));

  // collapse a group
  await page.click(`[data-pc-group="app"] summary`);
  check("a group collapses", !(await page.locator(`[data-pc-item="${P.renderer}"]`).isVisible()));

  if (process.env.SHOT) {
    await page.click(`[data-pc-group="app"] summary`);
    await page.locator("[data-tab-body=pc]").screenshot({ path: process.env.SHOT });
    await page.click(`[data-pc-group="app"] summary`);
  }

  // Stop on one item
  const sent = () => page.evaluate(() => window.__dock.pcSent);
  await devRow.locator("[data-pc-stop]").click();
  await page.waitForFunction((pid) => !document.querySelector(`[data-pc-item="${pid}"]`), P.devServer, { timeout: 3000 }).catch(() => {});
  let s = await sent();
  const last = s.at(-1);
  check("Stop on the dev server sends one good pc-stop for it", s.length === 1 && last?.kind === "pc-stop" && last.pid === P.devServer && C.problems(last).length === 0 && last.confirmSession === false, JSON.stringify(last));
  check("its row and its child's are gone", await page.locator(`[data-pc-item="${P.devServer}"], [data-pc-item="${P.devServerChild}"]`).count() === 0);
  check("nothing else went", await page.locator("[data-pc-item]").count() === pc.totals.processes - 2 && await page.locator(`[data-pc-item="${P.build}"]`).count() === 1);
  check("the panel says what ended", (await page.textContent("[data-pc-result]")).includes("Ended 2"));

  // a session's own claude.exe asks first
  const sess = page.locator(`[data-pc-item="${P.sessionNew}"]`);
  await sess.locator("[data-pc-stop]").click();
  check("Stop on a session's claude.exe asks first and sends nothing", (await sent()).length === 1 && await sess.locator("[data-pc-yes]").count() === 1, await sess.textContent());
  await sess.locator("[data-pc-yes]").click();
  await page.waitForFunction((pid) => !document.querySelector(`[data-pc-item="${pid}"]`), P.sessionNew, { timeout: 3000 }).catch(() => {});
  s = await sent();
  check("after the yes it sends pc-stop with the second yes", s.length === 2 && s[1].pid === P.sessionNew && s[1].confirmSession === true && C.problems(s[1]).length === 0, JSON.stringify(s[1]));
  check("the session's group is gone, the other session stays", await page.locator(`[data-pc-item="${P.build}"]`).count() === 0 && await page.locator(`[data-pc-item="${P.sessionResume}"]`).count() === 1);

  // stop all idle
  await page.click("[data-stop-idle]");
  check("Stop all idle asks first", (await sent()).length === 2 && await page.locator("[data-stop-idle-yes]").count() === 1);
  await page.click("[data-stop-idle-yes]");
  s = await sent();
  check("then sends one good pc-stop-idle for 10 min", s.length === 3 && s[2].kind === "pc-stop-idle" && s[2].minutes === 10 && C.problems(s[2]).length === 0, JSON.stringify(s[2]));
  check("the labelled live check (idle 90 min) is gone, the coordinator stays", await page.locator(`[data-pc-item="${P.labelled}"]`).count() === 0 && await page.locator(`[data-pc-item="${P.sessionResume}"]`).count() === 1);

  // the Agents tab is still the default
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/dock?demo=0`);
  await p2.waitForSelector("[data-dock-ready]");
  check("the Agents tab is the default", await p2.locator("[data-prompt-box]").isVisible() && !(await p2.locator('[data-tab-body="pc"]').isVisible()));
  await p2.click('nav [data-tab="pc"]');
  check("pressing the tab opens the panel", await p2.locator('[data-tab-body="pc"]').isVisible() && !(await p2.locator("[data-prompt-box]").isVisible()));
  await ctx.close();

  // ---- the live reader behind serve.mjs --pc ---------------------------------
  const live = await serveDock({ port: 0, pc: true });
  const LIVE = `http://127.0.0.1:${live.address().port}`;
  try {
    const now = await fetch(`${LIVE}/api/pc/now`).then((r) => r.json());
    check("--pc reads this PC into a good pc message", C.problems(now).length === 0 && now.totals.processes >= 0, C.problems(now).slice(0, 2).join("; "));
    const body = JSON.stringify({ v: C.CONTRACT_VERSION, kind: "pc-stop", by: "j", pid: process.pid, created: 1, confirmSession: false });
    const foreign = await fetch(`${LIVE}/api/pc/stop`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body }).then((r) => r.status);
    check("a Stop from another site is refused", foreign === 403, `${foreign}`);
    const plain = await fetch(`${LIVE}/api/pc/stop`, { method: "POST", headers: { "content-type": "application/json" }, body }).then((r) => r.status);
    check("a Stop without the dock's header is refused", plain === 403, `${plain}`);
    const off = await fetch(`${BASE}/api/pc/now`).then((r) => r.status);
    check("without --pc the PC isn't read at all", off === 404, `${off}`);
  } finally { live.close(); }
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("the walk ran to the end", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}
done();
