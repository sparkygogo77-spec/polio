/**
 * THE SPACE BETWEEN TWO RUNS SURVIVES THE DRAWING AND THE PUBLISH.
 *
 * A second defect could sit underneath the first and silently undo it.
 * `Runs.tsx` draws a sentence's runs as ADJACENT inline spans with nothing
 * between them — which is exactly right when the space is inside a run's own
 * text, and exactly wrong if anything along the way trims it. Until tonight
 * there was no test case, because no document carried a space between runs:
 * the reader threw it away. The price line does now, so this is the case.
 *
 * Three places the space has to survive, and only the last one ships:
 *   - the board, where he works
 *   - the live preview, which is a different renderer
 *   - the published page, which is serialised rather than mounted
 *
 * The published page is measured by committing to a GitHub that keeps what it
 * is given, serving the files back the way a static host would, and reading
 * the text off the real page in a real browser — never by inspecting markup,
 * because the question is what a reader sees.
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3012
 *     node tests/space-publishes.mjs http://127.0.0.1:3012
 */
import http from "node:http";
const req = (await import("node:module")).createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const PORT = Number(process.env.STUB_PORT ?? 4329);
const SERVE = Number(process.env.SERVE_PORT ?? 4330);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FROM = { url: "https://solworks.dev/", host: "solworks.dev", selector: "main > div", at: 1 };
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: FROM, byHand: false, ...extra,
});

/*
 * HIS PRICE LINE, as the two parts it still is. The sweep on open joins them,
 * so what is measured downstream is a real merged node with a real space
 * between its runs, arrived at the way his board arrives at it — rather than
 * a hand-written span array that might not match what the join produces.
 *
 * And a second sentence whose space sits at the START of a coloured run, so
 * the leading-edge case is covered too and not only the trailing one.
 */
const nodes = [
  node("n_prose_92", "prose", "$ 116.59", 120, 120, 59, 40),
  node("n_prose_95", "prose", "-1.94 %", 201, 120, 43, 32, { colour: { text: "rgb(239,68,68)" } }),
  node("n_prose_20", "prose", "Built for", 120, 300, 74, 32),
  node("n_prose_21", "prose", "everyone", 210, 300, 76, 32, { colour: { text: "rgb(34,197,94)" } }),
];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SOLWORKS", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

/* A GitHub that keeps what it is handed. */
const blobs = new Map();
const committed = new Map();
let n = 0;
const stub = http.createServer(async (rq, res) => {
  const body = await new Promise((ok) => { const c = []; rq.on("data", (d) => c.push(d)); rq.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(rq.url, `http://127.0.0.1:${PORT}`).pathname;
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .+/.test(rq.headers.authorization ?? "")) return send(401, { message: "Bad credentials" });
  if (path === "/user/repos" && rq.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && rq.method === "GET") return send(200, { default_branch: "main" });
  if (path.includes("/git/ref/") && rq.method === "GET") return send(409, { message: "Git Repository is empty." });
  if (path.endsWith("/git/blobs") && rq.method === "POST") { const sha = `b${++n}`; blobs.set(sha, JSON.parse(body).content); return send(201, { sha }); }
  if (path.endsWith("/git/trees") && rq.method === "POST") { for (const t of JSON.parse(body).tree ?? []) committed.set(t.path, blobs.get(t.sha) ?? ""); return send(201, { sha: "t1" }); }
  if (path.endsWith("/git/commits") && rq.method === "POST") return send(201, { sha: "c1", html_url: "https://example.invalid/c/1" });
  if (path.endsWith("/git/refs") && rq.method === "POST") return send(201, { object: { sha: "c1" } });
  return send(404, { message: "no" });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

/** The words a part actually shows, with runs of whitespace left as they are. */
const wordsOf = (p, sel) => p.evaluate((s) => {
  const out = {};
  for (const el of document.querySelectorAll(s)) {
    const id = el.getAttribute("data-node-id") || el.getAttribute("data-live-node");
    /* The part's own body, never the whole box: on the BOARD a selected part
       also carries a label chip with its id and size in it, and reading that
       as the part's words is how a check ends up measuring the chrome. */
    const body = el.querySelector("[data-part]") ?? el;
    const t = (body.innerText || body.textContent || "").replace(/\n/g, " ");
    if (id) out[id] = t;
  }
  return out;
}, sel);

/* ------------------------------------------------------------------ */
/* 1. The join happened, and the document carries the space            */
/* ------------------------------------------------------------------ */

const saved = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
  return Object.fromEntries((s.nodes ?? []).map((n) => [n.id, n.content]));
});
check("the sweep joined the price line on open", !!saved.n_prose_92 && !saved.n_prose_95, Object.keys(saved).join(", "));
check("…and the document carries the space INSIDE a run, which is the case this is about",
  Array.isArray(saved.n_prose_92) && /\s/.test(saved.n_prose_92.map((r) => r.text).join("").slice(8, 10)),
  JSON.stringify(saved.n_prose_92));
check("…with the second sentence joined too, its space at the START of a coloured run",
  Array.isArray(saved.n_prose_20) && saved.n_prose_20.map((r) => r.text).join("") === "Built for everyone",
  JSON.stringify(saved.n_prose_20));

/* ------------------------------------------------------------------ */
/* 2. The board                                                        */
/* ------------------------------------------------------------------ */

const onBoard = await wordsOf(page, "[data-node-id]");
check("the BOARD draws the price line with its space",
  onBoard.n_prose_92?.trim() === "$ 116.59 -1.94 %", JSON.stringify(onBoard.n_prose_92));
check("…and the coloured sentence with its space",
  onBoard.n_prose_20?.trim() === "Built for everyone", JSON.stringify(onBoard.n_prose_20));

/* ------------------------------------------------------------------ */
/* 3. The live preview, which is a different renderer                  */
/* ------------------------------------------------------------------ */

await page.locator('[aria-label="Preview"]').first().click();
await page.waitForTimeout(2500);
const inPreview = await wordsOf(page, "[data-live-node]");
check("the PREVIEW draws the price line with its space",
  inPreview.n_prose_92?.trim() === "$ 116.59 -1.94 %", JSON.stringify(inPreview.n_prose_92));
check("…and the coloured sentence with its space",
  inPreview.n_prose_20?.trim() === "Built for everyone", JSON.stringify(inPreview.n_prose_20));

/* ------------------------------------------------------------------ */
/* 4. The page that actually ships                                     */
/* ------------------------------------------------------------------ */

await page.locator('[aria-label="Design"]').first().click().catch(() => {});
await page.waitForTimeout(800);
for (let go = 0; go < 3; go++) {
  const k = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await k.count()) && (await k.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_space_0001");
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1200);
const push = page.getByRole("button", { name: /Push to GitHub/ }).first();
if (await push.count()) { await push.click(); await page.waitForTimeout(8000); }
check("a page was committed", committed.has("index.html"), [...committed.keys()].join(", ") || "nothing");

const site = http.createServer((rq, res) => {
  let f = new URL(rq.url, `http://127.0.0.1:${SERVE}`).pathname.replace(/^\/+/, "");
  if (!f || f.endsWith("/")) f += "index.html";
  const b = committed.get(f);
  if (b === undefined) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  res.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : "text/html" });
  res.end(b);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));
const out = await context.newPage();
await out.goto(`http://127.0.0.1:${SERVE}/`, { waitUntil: "networkidle" });
await out.waitForTimeout(1500);

const shipped = await wordsOf(out, "[data-live-node]");
check("the PUBLISHED page draws the price line with its space",
  shipped.n_prose_92?.trim() === "$ 116.59 -1.94 %", JSON.stringify(shipped.n_prose_92));
check("…and the coloured sentence with its space",
  shipped.n_prose_20?.trim() === "Built for everyone", JSON.stringify(shipped.n_prose_20));
check("…and nowhere along the way did a space become two",
  !/  /.test(`${shipped.n_prose_92 ?? ""}${shipped.n_prose_20 ?? ""}`.trim()),
  JSON.stringify([shipped.n_prose_92, shipped.n_prose_20]));

/* The serialised markup, said plainly, because it is the thing that would
   silently drop it: adjacent spans with the space inside one of them. */
const html = committed.get("index.html") ?? "";
console.log(`    the shipped markup around the price line: ${((html.match(/.{0,40}116\.59.{0,60}/) ?? [""])[0]).replace(/\s+/g, " ")}`);

await browser.close();
stub.close(); site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
