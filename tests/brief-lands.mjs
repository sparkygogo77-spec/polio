/**
 * What the brief promises is what the published page carries — or the page
 * says, out loud, that it does not.
 *
 * He measured his own site on the deploy and found five faults, four of
 * them the same fault wearing different clothes: the brief says one thing
 * and the board carries another, and nothing anywhere admits the gap.
 *
 *   - the top bar and the footer printed "Logo" twice, though the brief
 *     binds every wordmark to the site's name
 *   - a card with a title and no body published nine words we made up
 *     ("Warm ledger clear orbit open ledger") under his heading
 *   - "the coordinates" and "join the transmission" are sections of the
 *     brief's own layout with no part on the board; the page went out
 *     without them and without a word about them
 *   - a part's prompt asked for an eyebrow, a pill and a meta row, all
 *     named in capitals; the page carried the part's plain text only
 *
 * So this builds that board, presses the real publish against a stand-in
 * for GitHub, serves what comes out the way a static host would, and reads
 * the page a visitor would get.
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3013
 *     node tests/brief-lands.mjs http://127.0.0.1:3013
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

const blobs = new Map();
const committed = new Map();
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
/* His board, in the four shapes that failed                            */
/* ------------------------------------------------------------------ */

const node = (id, f, l, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const HERO_PROMPT = 'A dark hero with a glossy orb. Above the headline an eyebrow reading "BUILT FOR THE NEXT BLOCK". A CONNECT WALLET pill on the right. Under it a meta row: CHAIN 4663 / COMMUNITY OWNED / ZERO TAX.';

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("top", "sticky-header", "Top bar", 0, 0, 1440, 64),
    node("hero", "hero-split", "Hero", 40, 90, 1360, 420, { prompt: HERO_PROMPT, content: "Headline: Blackorb\nBody: The orb is live." }),
    node("cards", "card-grid", "The thesis", 40, 560, 1360, 300, { content: "Warm start\nClear orbit\nOpen ledger" }),
    node("foot", "footer", "Foot", 0, 1300, 1440, 120),
  ],
  groups: [],
  shapes: [
    /* A region with words on it and nothing inside: a section of the
       brief's layout that no part carries. Drawn clear of every node so
       nothing falls inside it. */
    { id: "s1", pageId: "p0", kind: "frame", points: [[40, 900], [1400, 1120]], hue: 200, width: 2, label: "The coordinates", prompt: "The contract address, the chain and the explorer link.", fromNodeId: null, toNodeId: null, relation: "flow" },
  ],
  format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

for (let go = 0; go < 3; go++) {
  const panel = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await panel.count()) && (await panel.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_brief_lands_0");
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(700);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1200);

/* The brief itself, before anything is published: it is the thing the page
   is being measured against, so it has to carry the section and the binding
   line, or the measurement is against nothing. */
const briefText = await page.evaluate(() => (document.body.innerText || ""));
check("the brief binds every wordmark to the site's name", /never "Logo"/i.test(briefText) && /BLACKORB/.test(briefText));
check("and the brief lays out the section no part carries", /The coordinates/i.test(briefText), "the layout names it");

const push = page.getByRole("button", { name: /Push to GitHub/ }).first();
if (await push.count()) {
  await push.click();
  /* The push is eleven requests to the stand-in; on a slower machine than the one this was written on it outlasts any fixed wait. Wait for the page, up to a minute. */
  for (let i = 0; i < 120 && !committed.has("index.html"); i++) await page.waitForTimeout(500);
}
check("a publish commits a page", committed.has("index.html"), `${committed.size} files`);

/* ------------------------------------------------------------------ */
/* Read the page a visitor gets                                         */
/* ------------------------------------------------------------------ */

const site = http.createServer((rq, res) => {
  let p = new URL(rq.url, `http://127.0.0.1:${SERVE}`).pathname.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  const body = committed.get(p);
  if (body === undefined) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  res.writeHead(200, { "content-type": p.endsWith(".css") ? "text/css" : "text/html" });
  res.end(body);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));

const out = await context.newPage({ viewport: { width: 1500, height: 1000 } });
await out.goto(`http://127.0.0.1:${SERVE}/`, { waitUntil: "networkidle" });
const seen = await out.evaluate(() => ({
  text: (document.body.innerText || ""),
  marks: [...document.querySelectorAll("[data-live-section]")].map((e) => (e.textContent || "").trim()),
}));

/* 1. The wordmark. */
const logos = (seen.text.match(/\bLogo\b/g) ?? []).length;
check("the page never introduces his site as “Logo”", logos === 0, `${logos} on the page`);
check("it wears the name the brief binds", /BLACKORB/.test(seen.text), "BLACKORB");

/* 2. Words nobody wrote. Every one of these is ours, out of sample.ts, and
      none of them may reach a page a stranger reads. */
const OURS = ["signal", "harbour", "ledger", "orbit", "meadow", "compass", "lantern", "thread", "summit", "canvas"];
/*
 * He typed three card titles out of the same small vocabulary, and those are
 * his — the fault was never the words, it was that nobody typed them. So his
 * own contents come out of the page first, and what is left is ours.
 */
const his = seen.text.replace(/Warm start|Clear orbit|Open ledger/gi, " ");
const invented = OURS.filter((w) => new RegExp(`\\b(clear|steady|quiet|bright|warm|quick|plain|deep|open|sharp|soft|wide) ${w}\\b`, "i").test(his));
check("no sentence of ours is published under his headings", invented.length === 0, invented.join(", ") || "none");

/* ------------------------------------------------------------------ */
/* 3. And no scaffolding either: the page is the site, only             */
/* ------------------------------------------------------------------ */

/*
 * THE RULING. Fail loudly in the Builder, never on the published site. He
 * is the only person who needs to know a part did not render; a visitor
 * must never see the scaffolding, and a note saying "nothing has been
 * built for it yet" is a sentence about how the work is made, which his
 * site never mentions at all. This is the published half: everything the
 * audit found is measured for its absence here and for its presence in
 * the Builder below.
 */
const SCAFFOLD = [
  /not written yet/i,
  /nothing has been built/i,
  /in the layout/i,
  /no words written/i,
  /asked for in the prompt/i,
  /not on this page yet/i,
  /described rather than drawn/i,
  /nothing to publish/i,
];
const leaked = SCAFFOLD.filter((re) => re.test(seen.text)).map(String);
check("the published page says nothing about what was not built", leaked.length === 0, leaked.join(", ") || "none of the eight phrases");
check("and stands no note where a section of the layout was", seen.marks.length === 0, seen.marks.join(" | ") || "none");
check("the copy the prompt named is not on the page either, since it was never built", !/BUILT FOR THE NEXT BLOCK|CONNECT WALLET|CHAIN 4663/.test(seen.text));
/* A page that omits what was not built is not a page that omits everything:
   what WAS built is still there, or this check is passing on a blank page. */
check("what was built is still on it", /BLACKORB/.test(seen.text) && seen.text.trim().length > 120, `${seen.text.trim().length} characters of visible text`);

/* ------------------------------------------------------------------ */
/* 4. The same list, in the Builder, where it belongs                    */
/* ------------------------------------------------------------------ */

await out.close();
await page.bringToFront();
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1200);
const look = page.locator("[data-left-behind-look]").first();
check("the publish says, before you press it, that it will leave things out", (await look.count()) === 1);
if (await look.count()) {
  await look.click();
  await page.waitForTimeout(2500);
}
const said = await page.evaluate(() => (document.querySelector("[data-left-behind-list]")?.textContent ?? ""));
check("it names the section of his layout that has no part", /The coordinates/i.test(said), said.slice(0, 120) || "nothing said");
check("and the card whose words nobody wrote", /thesis|The thesis/i.test(said), said.slice(0, 200) || "nothing said");
check("and the copy the hero's prompt asked for", /BUILT FOR THE NEXT BLOCK/.test(said) && /CONNECT WALLET/.test(said) && /CHAIN 4663/.test(said), said.slice(0, 260) || "nothing said");

await page.screenshot({ path: ".screenshots/brief-lands.png", fullPage: false });
await browser.close();
stub.close();
site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/brief-lands.png");
process.exit(bad ? 1 : 0);
