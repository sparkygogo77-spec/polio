/**
 * Pressing publish puts a website in the repository, and it opens.
 *
 * He imported the repository at Vercel and every address answered
 * NOT_FOUND, because what a publish committed was three files in a `site/`
 * folder: the document and the blueprint. A description of a website is not
 * a website, and there was nothing at the root to serve.
 *
 * This presses the real button, in the real browser, against a stand-in for
 * GitHub that keeps what it is given — no real token, no real repository —
 * then takes the files out of that stand-in, serves them the way a static
 * host would, and opens the address. What it asks is not "were files sent"
 * but "does the thing that came out render as a page".
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3012
 *     node tests/site-lands.mjs http://127.0.0.1:3012
 */
import http from "node:http";
const req = (await import("node:module")).createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const PORT = Number(process.env.STUB_PORT ?? 4319);
const SERVE = Number(process.env.SERVE_PORT ?? 4320);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* A GitHub that keeps what it is handed                                */
/* ------------------------------------------------------------------ */

const blobs = new Map();          // sha -> content
const committed = new Map();      // path -> content
let n = 0;
const stub = http.createServer(async (rq, res) => {
  const body = await new Promise((ok) => { const c = []; rq.on("data", (d) => c.push(d)); rq.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(rq.url, `http://127.0.0.1:${PORT}`).pathname;
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (!/^Bearer .+/.test(rq.headers.authorization ?? "")) return send(401, { message: "Bad credentials" });
  if (path === "/user/repos" && rq.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && rq.method === "GET") return send(200, { default_branch: "main" });
  if (path.includes("/git/ref/") && rq.method === "GET") return send(409, { message: "Git Repository is empty." });
  if (path.endsWith("/git/blobs") && rq.method === "POST") {
    const sha = `blob${++n}`;
    blobs.set(sha, JSON.parse(body).content);
    return send(201, { sha });
  }
  if (path.endsWith("/git/trees") && rq.method === "POST") {
    for (const t of JSON.parse(body).tree ?? []) committed.set(t.path, blobs.get(t.sha) ?? "");
    return send(201, { sha: "tree1" });
  }
  if (path.endsWith("/git/commits") && rq.method === "POST") return send(201, { sha: "commit1", html_url: "https://example.invalid/c/1" });
  if (path.endsWith("/git/refs") && rq.method === "POST") return send(201, { object: { sha: "commit1" } });
  return send(404, { message: `no ${rq.method} ${path}` });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

/* ------------------------------------------------------------------ */
/* Press the button                                                     */
/* ------------------------------------------------------------------ */

/* A board with a site on it, so what comes out is a site and not the empty
   document a fresh Builder starts with. Two pages, so the second one has to
   land at its own address too. */
const node = (id, pageId, f, l, x, y, w, h) => ({
  id, pageId, featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "About", path: "/about", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    node("top", "p0", "sticky-header", "Top bar", 0, 0, 1440, 64),
    node("hero", "p0", "hero-split", "Hero", 40, 90, 1360, 420),
    node("cards", "p0", "feature-cards", "What it does", 40, 560, 1360, 300),
    node("cta", "p0", "cta-primary", "Join", 560, 920, 320, 64),
    node("about", "p1", "hero-split", "About us", 40, 90, 1360, 420),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/* A token, put in the way a person puts one in. */
for (let go = 0; go < 3; go++) {
  const panel = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await panel.count()) && (await panel.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_site_lands_00");
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(700);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1200);
const push = page.getByRole("button", { name: /Push to GitHub/ }).first();
check("the publish button is there to press", (await push.count()) > 0);
if (await push.count()) {
  await push.click();
  await page.waitForTimeout(6000);
}

const paths = [...committed.keys()].sort();
check("a publish commits files", paths.length > 0, `${paths.length} files`);
check("and a page at the root, which is the thing that was missing", committed.has("index.html"),
  paths.slice(0, 12).join(", ") || "nothing");
check("with a stylesheet beside it", committed.has("assets/site.css"), committed.has("assets/site.css") ? `${Math.round((committed.get("assets/site.css")?.length ?? 0) / 1024)} KB` : "none");
check("and the document and the blueprint are still there", committed.has("site/document.json") && committed.has("site/BLUEPRINT.md"));
check("every page of the board has its own address", committed.has("about/index.html"), paths.filter((p) => p.endsWith("index.html")).join(", "));

/* ------------------------------------------------------------------ */
/* Serve what came out, the way a static host does, and open it         */
/* ------------------------------------------------------------------ */

const site = http.createServer((rq, res) => {
  let p = new URL(rq.url, `http://127.0.0.1:${SERVE}`).pathname.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  const body = committed.get(p);
  if (body === undefined) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  res.writeHead(200, { "content-type": p.endsWith(".css") ? "text/css" : p.endsWith(".json") ? "application/json" : "text/html" });
  res.end(body);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));

const out = await context.newPage({ viewport: { width: 1400, height: 900 } });
const failed = [];
out.on("requestfailed", (r) => failed.push(r.url()));
const answer = await out.goto(`http://127.0.0.1:${SERVE}/`, { waitUntil: "networkidle" });
check("the address answers, where the deploy answered NOT_FOUND", answer?.status() === 200, `HTTP ${answer?.status()}`);
const look = await out.evaluate(() => {
  const b = document.body;
  const r = b.getBoundingClientRect();
  const paint = getComputedStyle(b).backgroundColor;
  const boxes = [...b.querySelectorAll("*")].filter((e) => {
    const q = e.getBoundingClientRect();
    return q.width > 40 && q.height > 20;
  }).length;
  return { h: Math.round(r.height), w: Math.round(r.width), paint, boxes, text: (b.innerText || "").trim().length, sheets: document.styleSheets.length };
});
check("it is a page and not a blank one", look.h > 300 && look.boxes > 3, `${look.w}×${look.h}, ${look.boxes} laid-out elements, ${look.text} characters of text`);
check("and it is painted rather than left to the browser's defaults", look.paint !== "rgba(0, 0, 0, 0)" && look.paint !== "rgb(255, 255, 255)", look.paint);
check("its stylesheet loaded", look.sheets > 0, `${look.sheets} sheets`);
check("nothing it asks for is missing", failed.length === 0, failed.slice(0, 4).join(", ") || "none");
/* Nothing of the Builder should be in a site: the export is the site's own
   markup, not a screenshot of the app around it. */
const chrome = await out.evaluate(() => [...document.querySelectorAll("[data-studio-pane], [data-timeline], [data-shelf], [role='dialog']")].length);
check("and none of the Builder came with it", chrome === 0, `${chrome} builder elements`);
await out.screenshot({ path: ".screenshots/site-lands.png", fullPage: false });

await browser.close();
stub.close();
site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/site-lands.png");
process.exit(bad ? 1 : 0);
