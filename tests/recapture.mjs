/**
 * RECAPTURE: A SITE BROUGHT IN FROM A CAPTURE, CAPTURED AGAIN FROM ITS ADDRESS.
 *
 * The coordinator's brief. Beside "Bring in again" in the repo menu, a site
 * brought in from a capture has Recapture:
 *
 *   · it captures the site's original address again — the live URL the
 *     capture recorded (`<folder>/capture/run.json`), shown and editable —
 *     with the same pages, through sink's own capture workflow;
 *   · the capture keeps the site's folder (its name); sink's workflow
 *     commits it to `captures/<name>` whatever branch it runs from, which is
 *     said before it starts when that is not the branch the site came from;
 *   · progress is shown while the run goes, read no faster than every 10 s;
 *   · when it ends it offers the same Replace prompt (what goes, what comes,
 *     one Ctrl+Z) and the site's publish settings stay as they were;
 *   · a key that cannot run workflows is told exactly which permission to
 *     add, and that a capture chat can do it instead, then Bring in again.
 *
 * GitHub is a stand-in in the browser; tokens are STANDIN_ placeholders.
 *
 *   node tests/recapture.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const SHOTS = process.env.SHOTS ?? join(here, "..", ".scratch");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The pure half                                                       */
/* ------------------------------------------------------------------ */

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const R = await jiti.import(join(here, "..", "src", "features", "studio", "recapture.ts"));
const OWNER = "sparkygogo77-spec", NAME = "sink";
const src = { owner: OWNER, name: NAME, branch: "claude/trumpmorty", dir: "sites/trumpmorty-fun" };

const plan = R.recapturePlan(src, { url: "https://trumpmorty.fun/", name: "trumpmorty-fun", pages: ["/", "/lore"] });
check("the plan is the recorded address, the same pages, the site's own folder name, run from its branch",
  plan.url === "https://trumpmorty.fun/" && plan.pages === "/, /lore" && plan.name === "trumpmorty-fun" && plan.ref === "claude/trumpmorty", JSON.stringify(plan));
check("…it says where sink commits it: captures/<name>, sites/<name>", plan.lands.ref === "captures/trumpmorty-fun" && plan.lands.path === "sites/trumpmorty-fun");
check("…and that this is not the branch the site came from, when it is not", /captures\/trumpmorty-fun/.test(plan.branchNote ?? "") && /claude\/trumpmorty/.test(plan.branchNote ?? ""), plan.branchNote);
check("a site already on captures/<name> needs no such note", R.recapturePlan({ ...src, branch: "captures/trumpmorty-fun" }, { url: "https://trumpmorty.fun/", pages: ["/"] }).branchNote === null);
check("a site recorded at the root of a repo is not a capture: no plan", R.recapturePlan({ ...src, dir: null }, null) === null);

const says = R.workflowPermissionSays({ owner: OWNER, name: NAME }, "https://trumpmorty.fun/", "trumpmorty-fun");
for (const [what, re] of [
  ["names the fine-grained permissions", /Actions: Read and write/],
  ["…and Contents", /Contents: Read and write/],
  ["…on sink", /sparkygogo77-spec\/sink/],
  ["names the classic scopes", /classic.*repo.*workflow/i],
  ["says a capture chat can do it, then Bring in again", /capture chat/.test(says) && /Bring in again/.test(says) ? /./ : /$^/],
]) check(`the no-workflow message ${what}`, re.test(says), says);

/* The watch: never faster than every 10 s. */
const slept = [];
let reads = 0;
const fetch403 = async () => new Response(JSON.stringify({ message: "Resource not accessible by personal access token" }), { status: 403 });
const refused = await R.runRecapture({ repo: { owner: OWNER, name: NAME }, token: "STANDIN_GITHUB_TOKEN", plan, onProgress: () => {}, fetch: fetch403, sleep: async (ms) => { slept.push(ms); } });
check("a key that may not dispatch is refused with the plain permission message", refused.ok === false && /Actions: Read and write/.test(refused.says) && /capture chat/.test(refused.says), refused.says);
const runs = [];
const gh = async (url, init = {}) => {
  const u = String(url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.includes("/dispatches")) { runs.push({ id: 9, html_url: "https://github.test/run/9", created_at: new Date().toISOString() }); return new Response(null, { status: 204 }); }
  if (u.includes("/runs?")) return json(200, { workflow_runs: runs });
  if (u.endsWith("/runs/9/jobs")) return json(200, { jobs: [{ steps: [{ name: "Capture", status: "in_progress" }] }] });
  if (u.endsWith("/runs/9")) { reads++; return json(200, { status: reads > 2 ? "completed" : "in_progress", conclusion: reads > 2 ? "success" : null, html_url: "https://github.test/run/9" }); }
  return json(404, {});
};
const steps = [];
const ran = await R.runRecapture({ repo: { owner: OWNER, name: NAME }, token: "STANDIN_GITHUB_TOKEN", plan, onProgress: (p) => steps.push(p.step), fetch: gh, sleep: async (ms) => { slept.push(ms); } });
check("a run is watched to its end, saying its step", ran.ok === true && steps.includes("Capture") && ran.ref === "captures/trumpmorty-fun" && ran.path === "sites/trumpmorty-fun", JSON.stringify(ran));
check("…and GitHub is never asked faster than every 10 s", slept.length > 0 && slept.every((ms) => ms >= 10_000), slept.join(","));

/* ------------------------------------------------------------------ */
/* The menu                                                            */
/* ------------------------------------------------------------------ */

const REPO = `/repos/${OWNER}/${NAME}`;
const node = (id, pageId, label) => ({ id, pageId, featureId: "prose", label, prompt: "", content: label, data: "", x: 100, y: 100, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null });
const small = (name, pages, parts) => ({
  pages: Array.from({ length: pages }, (_, i) => ({ id: `p${i}`, name: `${name} ${i}`, path: i ? `/p${i}` : "/", prompt: "", scroll: "inherit" })),
  nodes: Array.from({ length: parts }, (_, i) => node(`${name.toLowerCase()}_${i}`, `p${i % pages}`, `${name} part ${i}`)),
  groups: [], shapes: [], format: {}, brief: { name, gimmick: "", master: "" }, look: { palette: {}, texture: [], target: "page", light: { on: false, x: 0.5, y: 0.1, height: 0.5, strength: 0.4, lift: 10, warmth: 80, wash: 0 } },
  motion: [], activePageId: "p0", hiddenFeatures: [], frameWidth: 1440,
});
const RECAPTURED = small("RECAPTURED", 1, 5);
const RUN_JSON = { version: 1, url: "https://trumpmorty.fun/", name: "trumpmorty-fun", pages: ["/"], viewport: [1440, 900] };

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

async function session({ dispatchStatus }) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const log = { dispatch: null, statusAt: [], blobs: [] };
  let statusReads = 0;
  const runs = [];
  await page.route("https://api.github.com/**", (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
    if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
    const rest = decodeURIComponent(u.pathname.slice(REPO.length));
    if (!rest) return j({ default_branch: "main", homepage: "" });
    if (rest === "/contents/sites/trumpmorty-fun/capture/run.json") return j({ encoding: "base64", content: Buffer.from(JSON.stringify(RUN_JSON)).toString("base64") });
    if (rest.endsWith("/dispatches")) {
      log.dispatch = { ...JSON.parse(req.postData() || "{}"), status: dispatchStatus };
      if (dispatchStatus !== 204) return j({ message: "Resource not accessible by personal access token" }, dispatchStatus);
      runs.push({ id: 41, html_url: "https://github.test/run/41", created_at: new Date().toISOString() });
      return r.fulfill({ status: 204, body: "" });
    }
    if (/\/actions\/workflows\/.+\/runs$/.test(rest)) return j({ workflow_runs: runs });
    if (rest === "/actions/runs/41/jobs") return j({ jobs: [{ steps: [{ name: "Install the browser", status: "completed" }, { name: "Capture", status: statusReads < 2 ? "in_progress" : "completed" }] }] });
    if (rest === "/actions/runs/41") { statusReads++; log.statusAt.push(Date.now()); const done = statusReads >= 2; return j({ status: done ? "completed" : "in_progress", conclusion: done ? "success" : null, html_url: "https://github.test/run/41" }); }
    const tree = rest.match(/^\/git\/trees\/(.+)$/);
    if (tree) return j({ tree: tree[1] === "captures/trumpmorty-fun" ? [{ path: "sites/trumpmorty-fun/site/document.json", type: "blob", sha: "re", size: 100 }] : [] });
    if (rest === "/git/blobs/re") { log.blobs.push("re"); return j({ encoding: "base64", content: Buffer.from(JSON.stringify(RECAPTURED)).toString("base64") }); }
    return j({ message: "no" }, 404);
  });
  await page.route("**/api/studio/repo", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repos: [{ name: `${OWNER}/${NAME}`, private: false, branch: "main" }] }) }));
  await page.route("**/api/studio/repo/choices**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, base: "main", ref: "main", branches: ["main"], sites: [] }) }));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(([o, n]) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "trumpmorty.fun", updatedAt: Date.now(),
      source: { owner: o, name: n, branch: "claude/trumpmorty", dir: "sites/trumpmorty-fun" },
      repo: { owner: o, name: "trump-morty-trorty", branch: "main" }, bound: "connected" }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  }, [OWNER, NAME]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate((d) => window.__studioLoadDoc(d), small("MINE", 3, 7));
  await page.waitForTimeout(600);
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
  for (let i = 0; i < 3 && !(await page.locator("[data-repo-menu]").count()); i++) { await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(1200); }
  return { page, log };
}
const project = (page) => page.evaluate(() => { const b = JSON.parse(localStorage.getItem("builder.builds") || "{}").state ?? {}; return b.projects?.find((p) => p.id === b.activeId) ?? null; });
const nodes = (page) => page.evaluate(() => window.__studioPublishDoc?.().nodes ?? []);

/* 1. The button, the address, the run, the prompt, the undo. */
{
  const { page, log } = await session({ dispatchStatus: 204 });
  const btn = page.locator("[data-repo-recapture]");
  const again = page.locator("[data-repo-bring-own]");
  check("Recapture sits beside Bring in again", (await btn.count()) === 1 && (await again.count()) === 1);
  if (await btn.count()) {
    const a = await btn.boundingBox(), b = await again.boundingBox();
    await page.screenshot({ path: join(SHOTS, "recapture-button.png"), clip: { x: Math.min(a.x, b.x) - 16, y: Math.min(a.y, b.y) - 70, width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x) + 32, height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) + 86 } }).catch(() => {});
    await btn.click();
    await page.waitForTimeout(1200);
  }
  const url = page.locator("[data-recapture-url]");
  check("it shows the address the capture recorded, to edit", (await url.count()) === 1 && (await url.inputValue()) === "https://trumpmorty.fun/", await url.inputValue().catch(() => "none"));
  const note = await page.locator("[data-recapture]").innerText().catch(() => "");
  check("it says where the capture lands: sites/trumpmorty-fun on captures/trumpmorty-fun, not claude/trumpmorty", /sites\/trumpmorty-fun/.test(note) && /captures\/trumpmorty-fun/.test(note), note.replace(/\s+/g, " ").slice(0, 300));
  await url.fill("https://trumpmorty.fun/?fresh=1");
  await page.locator("[data-recapture-start]").click();
  await page.waitForTimeout(1500);
  check("it dispatches sink's capture: the edited address, the same pages, the site's folder name, from its branch",
    log.dispatch?.inputs?.url === "https://trumpmorty.fun/?fresh=1" && log.dispatch?.inputs?.pages === "/" && log.dispatch?.inputs?.name === "trumpmorty-fun" && log.dispatch?.ref === "claude/trumpmorty", JSON.stringify(log.dispatch));
  const progress = await page.locator("[data-recapture-progress]").innerText().catch(() => "");
  check("progress is shown while it runs", /Capture|Running|Waiting/.test(progress), progress);
  const prompt = page.locator("[data-repo-bring-confirm]");
  for (let t = 0; t < 60 && !(await prompt.count()); t++) await page.waitForTimeout(1000);
  const gaps = log.statusAt.slice(1).map((t, i) => t - log.statusAt[i]);
  check("…read no faster than every 10 s", log.statusAt.length >= 2 && gaps.every((g) => g >= 9_500), gaps.join(", ") || `${log.statusAt.length} reads`);
  const says = (await prompt.count()) ? (await prompt.innerText()).replace(/\s+/g, " ") : "";
  check("when it ends, the Replace prompt: what goes and what comes", /7 parts on 3 pages/.test(says) && /sites\/trumpmorty-fun on captures\/trumpmorty-fun/.test(says) && /Ctrl\+Z/.test(says), says);
  if (await prompt.count()) await page.locator("[data-repo-menu]").screenshot({ path: join(SHOTS, "recapture-prompt.png") }).catch(() => {});
  const mine = JSON.stringify(await nodes(page));
  if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
  for (let t = 0; t < 60 && (await nodes(page)).length !== RECAPTURED.nodes.length; t++) await page.waitForTimeout(500);
  check("Replace brings the new capture in", (await nodes(page)).length === RECAPTURED.nodes.length && log.blobs.includes("re"));
  const p = await project(page);
  check("the site's publish settings are kept", p?.repo?.name === "trump-morty-trorty" && p?.repo?.branch === "main", JSON.stringify(p?.repo));
  await page.mouse.click(10, 990);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(1200);
  check("one Ctrl+Z puts the board before it back", JSON.stringify(await nodes(page)) === mine);
  await page.close();
}

/* 2. A key that cannot run workflows. */
{
  const { page, log } = await session({ dispatchStatus: 403 });
  await page.locator("[data-repo-recapture]").click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator("[data-recapture-start]").click().catch(() => {});
  await page.waitForTimeout(2000);
  const said = await page.locator("[data-recapture]").innerText().catch(() => "");
  check("a key that cannot run workflows is told the exact permission, and the other way",
    log.dispatch?.status === 403 && /Actions: Read and write/.test(said) && /Contents: Read and write/.test(said) && /workflow/.test(said) && /capture chat/.test(said) && /Bring in again/.test(said), said.replace(/\s+/g, " ").slice(0, 400));
  await page.close();
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
