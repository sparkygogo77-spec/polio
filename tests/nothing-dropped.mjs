/**
 * Every part on the board reaches the published page, or the page says so.
 *
 * His site went live and four things were missing from it by name: the
 * Thesis eyebrow, Join the transmission whole, the Coordinates whole, and
 * Connect wallet out of a bar that otherwise rendered. A site that publishes
 * most of itself is worse than one that fails loudly.
 *
 * So this compares the two things that must agree: the preview, settled, and
 * the page that actually ships. Both are read with the same selector — every
 * part carries `data-live-node` — so the comparison is part by part and names
 * the ones that lose anything.
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3012
 *     node tests/nothing-dropped.mjs http://127.0.0.1:3012
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

const node = (id, f, l, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/*
 * A spread of the kinds that could each lose content a different way: a bar
 * with nav in it, a hero with a media slot and no picture, a part whose body
 * was written by the renderer (it renders in a frame), a part that is only an
 * idea in words, one that holds numbers, one that hides its content behind a
 * press, and a footer.
 */
const BODY = "<div style=\"padding:16px;color:#fff\"><h2>WRITTEN BODY</h2><p>A body the renderer drew, not a described one.</p></div>";
const nodes = [
  node("bar", "sticky-header", "Top bar", 0, 0, 1440, 64),
  node("hero", "hero-split", "POWER IN THE DARK", 40, 90, 1360, 420),
  node("written", "custom-idea", "THE COORDINATES", 40, 540, 1360, 300, {
    code: { html: BODY, overlap: 0, attempts: 1, at: 1_700_000_000_000, source: "renderer", kind: "vectorize" },
  }),
  node("idea", "custom-idea", "JOIN THE TRANSMISSION", 40, 870, 660, 240, { prompt: "A card inviting people to follow on X, with a FOLLOW ON X pill." }),
  node("numbers", "stat-tiles", "THE LEDGER", 740, 870, 660, 240),
  node("folded", "accordion", "QUESTIONS", 40, 1140, 1360, 260),
  node("foot", "footer", "Footer", 0, 1440, 1440, 220),
  /* Two ways a section can vanish rather than render badly: a part the
     registry does not know, and a part whose page no longer exists. The
     second is the shape of a section that is on the board and on no page. */
  node("unknown", "not-a-real-part", "CONNECT WALLET", 40, 1700, 400, 80),
  node("orphan", "stat-tiles", "THE COORDINATES", 40, 1820, 1360, 240, { pageId: "p9" }),
];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
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

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/** Every part, as the page has it: how much markup and how much text. */
const partsOf = (p) => p.evaluate(() => {
  const out = {};
  for (const el of document.querySelectorAll("[data-live-node]")) {
    const id = el.getAttribute("data-live-node");
    const frames = el.querySelectorAll("iframe").length;
    out[id] = {
      html: el.innerHTML.length,
      text: (el.textContent || "").replace(/\s+/g, " ").trim().length,
      words: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      frames,
      framed: [...el.querySelectorAll("iframe")].reduce((n, f) => n + (f.getAttribute("srcdoc")?.length ?? 0), 0),
      imgs: el.querySelectorAll("img").length,
    };
  }
  return out;
});

/* THE PREVIEW, settled: what he sees before he presses anything. */
await page.locator('[aria-label="Preview"]').first().click();
await page.waitForTimeout(2500);
const before = await partsOf(page);
/* The orphan belongs to no page, so the preview cannot draw it; that is the
   finding, not a failure of the check. */
const onPage = nodes.filter((n) => n.pageId === "p0");
check("the preview draws every part that belongs to the page", Object.keys(before).length === onPage.length,
  `${Object.keys(before).length} of ${onPage.length} on the page, ${nodes.length} on the board: ${Object.keys(before).join(", ")}`);
console.log(`    the board holds ${nodes.length - onPage.length} part(s) no page claims: ${nodes.filter((n) => n.pageId !== "p0").map((n) => n.label).join(", ")}`);

/* AND THE PAGE THAT SHIPS. */
await page.locator('[aria-label="Design"]').first().click().catch(() => {});
await page.waitForTimeout(800);
for (let go = 0; go < 3; go++) {
  const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await keys.count()) && (await keys.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_dropped_00");
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
  let p = new URL(rq.url, `http://127.0.0.1:${SERVE}`).pathname.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  const b = committed.get(p);
  if (b === undefined) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  res.writeHead(200, { "content-type": p.endsWith(".css") ? "text/css" : "text/html" });
  res.end(b);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));
const out = await context.newPage();
await out.goto(`http://127.0.0.1:${SERVE}/`, { waitUntil: "networkidle" });
await out.waitForTimeout(1200);
const after = await partsOf(out);

/* ------------------------------------------------------------------ */
/* Part by part                                                         */
/* ------------------------------------------------------------------ */

console.log("\n  part          preview → published");
for (const id of Object.keys(before)) {
  const a = before[id], b = after[id];
  console.log(`    ${id.padEnd(9)} text ${String(a.text).padStart(5)} → ${String(b?.text ?? 0).padStart(5)}   html ${String(a.html).padStart(6)} → ${String(b?.html ?? 0).padStart(6)}   frames ${a.frames}→${b?.frames ?? 0} (${a.framed}→${b?.framed ?? 0} chars)   imgs ${a.imgs}→${b?.imgs ?? 0}${b ? "" : "   ABSENT"}`);
}

const missing = Object.keys(before).filter((id) => !after[id]);
check("no part is absent from the published page", missing.length === 0, missing.join(", ") || "none");
const emptied = Object.keys(before).filter((id) => after[id] && before[id].text > 8 && after[id].text < before[id].text * 0.5);
check("no part loses half its words on the way", emptied.length === 0,
  emptied.map((id) => `${id} ${before[id].text}→${after[id].text}`).join(", ") || "none");
const lostFrames = Object.keys(before).filter((id) => before[id].frames > 0 && (after[id]?.framed ?? 0) < before[id].framed * 0.9);
check("a part whose body was drawn rather than described keeps it", lostFrames.length === 0,
  lostFrames.map((id) => `${id} ${before[id].framed}→${after[id]?.framed ?? 0} chars of body`).join(", ") || "none");
const lostImgs = Object.keys(before).filter((id) => before[id].imgs > (after[id]?.imgs ?? 0));
check("no picture is dropped", lostImgs.length === 0, lostImgs.map((id) => `${id} ${before[id].imgs}→${after[id]?.imgs ?? 0}`).join(", ") || "none");
/* The rule he asked for: a part that cannot be published faithfully says so
   where it stood. A fixture part with nothing but a written prompt is the
   case that used to go out as a gap. */
const unmade = await out.evaluate(() => [...document.querySelectorAll("[data-unmade]")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()));
/* innerText is the *rendered* text, and the heading is uppercased by CSS. */
const named = await out.evaluate(() => /not on this page yet/i.test(document.body.innerText || ""));
check("a part that could not be published names itself on the page rather than leaving a gap",
  unmade.length === 0 || unmade.every((t) => t.length > 10), unmade.join(" · ") || "every part published as itself");
/* The fixture puts one part on a page that does not exist, which is the one
   shape that vanished without trace. Written as an assertion and not as a
   note: the first version of this line passed `true` and could only ever
   agree with itself. */
const orphanNames = nodes.filter((x) => x.pageId !== "p0").map((x) => x.label);
const said = await out.evaluate(() => document.body.innerText || "");
check("a part on the board that no page claims is named on the published page",
  orphanNames.every((nm) => said.includes(nm)),
  `${orphanNames.join(", ")} — ${named ? "the page lists them" : "the page says nothing about them"}`);
check("and nothing prints a builder's placeholder word into the page",
  !/\bvisual\b/i.test(await out.evaluate(() => document.body.innerText)),
  (await out.evaluate(() => document.body.innerText)).match(/.{0,24}visual.{0,24}/i)?.[0] ?? "none");

await browser.close();
stub.close();
site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
