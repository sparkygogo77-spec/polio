/**
 * The Agents dock (step 1 of the Agents panel), driven through the fake
 * runner in a headless browser. The dock is the page the helper serves at
 * /dock; here it serves itself on a free port, so no Builder is needed.
 *
 * Plans a request, presses Start, and walks the lane through the fake
 * script: the question (amber), the step under way (it breathes), Pause
 * (two bars), the only-you approval (a red notch), and done (full green).
 * At every stop the ring's filled segments match the steps done. Pause,
 * Resume, Approve and Stop each send one good contract message, signed by J.
 * Under reduced motion the step under way holds still. No page errors.
 *
 *   node tests/agents-dock.mjs
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { request } from "node:http";

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

let serveDock = null;
let problems = null;
try {
  ({ serveDock } = await import("../helper/dock/serve.mjs"));
  ({ problems } = await import("../helper/contract.ts"));
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the dock's server and the contract load", typeof serveDock === "function" && typeof problems === "function");
if (!serveDock || !problems) done(1);

const server = await serveDock({ port: 0 });
const BASE = `http://127.0.0.1:${server.address().port}`;
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath: existsSync(AT) ? AT : undefined });

const errors = [];
async function open({ reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 1400 }, reducedMotion });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(`${BASE}/dock?delay=0&demo=0`);
  await page.waitForSelector("[data-dock-ready]");
  return page;
}

const LANE = "export-gallery";
const row = (page) => page.locator(`[data-lane-row="${LANE}"]`);
const waitState = (page, state, stepsDone) =>
  page.waitForFunction(([l, s, n]) => {
    const r = document.querySelector(`[data-lane-row="${l}"]`);
    return r && r.dataset.state === s && Number(r.dataset.stepsDone) === n;
  }, [LANE, state, stepsDone], { timeout: 5000 }).then(() => true, () => false);

/** What the ring shows: segments filled, the one breathing, and its marks. */
const ring = (page) => row(page).evaluate((r) => {
  const svg = r.querySelector("svg.ring");
  const segs = [...svg.querySelectorAll(".seg")];
  const now = svg.querySelector(".seg.now");
  return {
    filled: segs.filter((s) => s.classList.contains("filled")).length,
    segs: segs.length,
    now: now ? Number(now.dataset.i) : null,
    moving: now ? now.getAnimations().length : 0,
    halo: !!svg.querySelector(".halo"),
    notch: !!svg.querySelector(".notch"),
    bars: svg.querySelectorAll(".bar").length,
    green: segs.every((s) => s.classList.contains("green")),
    eta: r.querySelector("[data-eta]")?.textContent ?? "",
  };
});
const sent = (page) => page.evaluate(() => window.__dock.sent);
const lastSent = async (page) => (await sent(page)).at(-1);
const goodFromJ = (m, d) => !!m && m.kind === "control" && m.do === d && m.by === "j" && m.lane === LANE && problems(m).length === 0;

async function planAndStart(page) {
  await page.fill("[data-prompt]", "Add a gallery page to the export");
  await page.check('[name="target"][value="builder-ui"]');
  await page.click("[data-plan-it]");
  await page.waitForSelector("[data-plan-card]", { timeout: 5000 });
  await page.click("[data-start]");
}

try {
  // ---- the walk through the fake script ---------------------------------
  const page = await open();
  await planAndStart(page);
  const req = await page.evaluate(() => window.__dock.request);
  check("Plan it sends a good request with the picked target and the chips", !!req && problems(req).length === 0 && req.target === "builder-ui" && req.chips.length === 3, req ? problems(req).join("; ") : "none");
  check("the plan card shows the lane and says it adds a control", (await page.textContent("[data-plan-card]")).includes(LANE) && (await page.textContent("[data-plan-card]")).includes("New control: yes"));

  check("the question arrives", await waitState(page, "question", 0));
  let r = await ring(page);
  check("the ring has 8 segments", r.segs === 8, `${r.segs}`);
  check("question: 0 segments filled, with the amber halo", r.filled === 0 && r.halo && !r.notch && r.bars === 0, JSON.stringify(r));
  check("question: the row shows the question and ~N min beside the ring", (await row(page).textContent()).includes("one per component") && r.eta === "~25 min", r.eta);

  await page.fill(`[data-lane-row="${LANE}"] [data-answer-text]`, "One long page");
  await page.click(`[data-lane-row="${LANE}"] [data-answer]`);
  const answer = await lastSent(page);
  check("Answer sends J's answer with its text", !!answer && answer.do === "answer" && answer.text === "One long page" && problems(answer).length === 0, JSON.stringify(answer));

  check("working at step 3 (fix)", await waitState(page, "working", 2));
  r = await ring(page);
  check("working: 2 segments filled, the 3rd under way", r.filled === 2 && r.now === 2, JSON.stringify(r));
  check("working: the step under way breathes", r.moving > 0, `${r.moving} animations`);

  await page.click(`[data-lane-row="${LANE}"] [data-do="pause"]`);
  const pause = await lastSent(page);
  check("Pause sends one good pause control, by J, for this lane", goodFromJ(pause, "pause"), JSON.stringify(pause));
  check("paused arrives", await waitState(page, "paused", 2));
  r = await ring(page);
  check("paused: two bars, 2 filled, nothing breathing", r.bars === 2 && r.filled === 2 && r.moving === 0, JSON.stringify(r));
  check("paused: the row offers Resume and Stop, not Pause", await row(page).locator('[data-do="resume"]').count() === 1 && await row(page).locator('[data-do="pause"]').count() === 0);

  await page.click(`[data-lane-row="${LANE}"] [data-do="resume"]`);
  check("Resume sends a good resume control", goodFromJ(await lastSent(page), "resume"));

  check("only-you arrives at step 7 (merge)", await waitState(page, "only-you", 6));
  r = await ring(page);
  check("only-you: the red notch, 6 filled", r.notch && r.filled === 6 && !r.halo, JSON.stringify(r));
  check("only-you: the row offers Approve", await row(page).locator('[data-do="approve"]').count() === 1);
  check("the merge feed shows the waiting line with its P-level", (await page.textContent("[data-merge-feed]")).includes("P2"));

  await page.click(`[data-lane-row="${LANE}"] [data-do="approve"]`);
  check("Approve sends a good approve control", goodFromJ(await lastSent(page), "approve"));

  check("done arrives", await waitState(page, "done", 8));
  r = await ring(page);
  check("done: all 8 filled, full green, nothing breathing", r.filled === 8 && r.green && r.moving === 0 && r.now === null, JSON.stringify(r));
  const feed = page.locator(`[data-merge-line="${LANE}"]`);
  await page.waitForFunction((l) => document.querySelector(`[data-merge-line="${l}"]`)?.dataset.status === "checked", LANE, { timeout: 5000 }).catch(() => {});
  check("the merge line is checked, with before and after shots and Undo", await feed.getAttribute("data-status") === "checked" && await feed.locator("[data-shot]").count() === 2 && await feed.locator("[data-undo]").count() === 1);
  await page.waitForSelector("[data-spend-row]", { timeout: 5000 }).catch(() => {});
  const spend = await page.textContent("[data-spend]");
  check("the cloud meter shows the request's dollars and tokens", spend.includes("$0.95") && spend.includes("272k"), spend.replace(/\s+/g, " ").slice(0, 160));
  check("there are two meters, plan and cloud", await page.locator("[data-meter]").count() === 2);
  const all = await sent(page);
  check("every message the dock sent is good", all.every((m) => problems(m).length === 0), all.map((m) => problems(m).join(";")).filter(Boolean).join(" | "));
  check("the dock sent exactly answer, pause, resume, approve", all.map((m) => m.do).join(",") === "answer,pause,resume,approve", all.map((m) => m.do).join(","));
  await page.context().close();

  // ---- Stop asks once, then sends stop ----------------------------------
  const p2 = await open();
  await planAndStart(p2);
  await waitState(p2, "question", 0);
  await p2.click(`[data-lane-row="${LANE}"] [data-do="stop"]`);
  check("Stop asks once before sending", (await sent(p2)).length === 0 && await row(p2).locator("[data-stop-yes]").count() === 1);
  await p2.click(`[data-lane-row="${LANE}"] [data-stop-yes]`);
  const stop = await lastSent(p2);
  check("then Stop sends a good stop control, by J, for this lane", goodFromJ(stop, "stop"), JSON.stringify(stop));
  check("the stopped row says so and has no buttons left", (await row(p2).getAttribute("data-stopped")) === "1" && await row(p2).locator("[data-do]").count() === 0);
  await p2.context().close();

  // ---- reduced motion ---------------------------------------------------
  const p3 = await open({ reducedMotion: "reduce" });
  await planAndStart(p3);
  await waitState(p3, "question", 0);
  await p3.fill(`[data-lane-row="${LANE}"] [data-answer-text]`, "One long page");
  await p3.click(`[data-lane-row="${LANE}"] [data-answer]`);
  await waitState(p3, "working", 2);
  r = await ring(p3);
  check("under reduced motion the step under way is marked but holds still", r.now === 2 && r.moving === 0 && r.filled === 2, JSON.stringify(r));
  await p3.context().close();

  // ---- the full dock, with its sample rows ------------------------------
  const p4 = await browser.newContext({ viewport: { width: 420, height: 1400 } }).then((c) => c.newPage());
  p4.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await p4.goto(`${BASE}/dock`);
  await p4.waitForSelector("[data-dock-ready]");
  const S = await import("../helper/dock/sample.ts");
  const samples = [...S.SAMPLE_LANES, ...S.SAMPLE_MERGES, ...S.SAMPLE_SPEND];
  const badSample = samples.map((m) => problems(m).join("; ")).filter(Boolean);
  check("every sample row is a good contract message", badSample.length === 0, badSample.join(" | "));
  const tags = await p4.$$eval("[data-lane-row] [data-where]", (els) => els.map((e) => e.textContent.trim()));
  check("each sample row carries a cloud or PC tag", tags.length >= 3 && tags.every((t) => t === "cloud" || t === "PC") && tags.includes("PC"), tags.join(","));
  const pc = await p4.$$eval("[data-pc-row]", (els) => els.map((e) => ({ mine: e.dataset.mine, buttons: e.querySelectorAll("button").length })));
  check("On your PC now lists processes, the ones it didn't start greyed with no buttons", pc.length > 0 && pc.some((p) => p.mine === "0") && pc.filter((p) => p.mine === "0").every((p) => p.buttons === 0), JSON.stringify(pc));
  await p4.context().close();

  // ---- the server --------------------------------------------------------
  // fetch drops a Host header it is given, so this one goes through node:http.
  const evil = await new Promise((ok) => request(`${BASE}/dock`, { headers: { Host: "evil.example" } }, (x) => { x.resume(); ok(x.statusCode); }).on("error", () => ok(0)).end());
  check("the server refuses a foreign Host header", evil === 403, `${evil}`);
  const out = await fetch(`${BASE}/../package.json`).then((x) => x.status);
  check("the server serves nothing outside helper/", out === 404 || out === 403, `${out}`);
  const head = await fetch(`${BASE}/dock`).then((x) => x.headers.get("content-security-policy") ?? "");
  check("the dock may be framed by the Builder only", head.includes("frame-ancestors https://polio-two.vercel.app"), head);

  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("the walk ran to the end", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
  server.close();
}
done();
