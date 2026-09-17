/**
 * A picture is a file, and the document only says where.
 *
 * Every part that wanted one drew a hole, and there was no way to give it
 * one: not one `img` tag on his published site. So a part holds a picture
 * now — and the bytes are deliberately kept out of the document, because
 * the document lives in a browser's small storage beside his board, his
 * builds and his keys, and because bytes in the document are bytes in every
 * publish for ever, whether or not the picture changed.
 *
 * This puts a real picture on a part through the panel he would use, then
 * publishes to a stand-in for GitHub and reads what arrived: the file at its
 * own path with its own bytes, the page pointing at that path, and the
 * document holding a path and no bytes at all.
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3012
 *     node tests/pictures.mjs http://127.0.0.1:3012
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

/* A real PNG: 4×4, solid, small enough to read by eye in a diff. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC",
  "base64",
);

const node = (id, f, l, x, y, w, h) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("hero", "hero-split", "POWER IN THE DARK", 40, 40, 1360, 420)],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const blobs = new Map();
const committed = new Map();          // path -> { content, encoding }
let n = 0;
const stub = http.createServer(async (rq, res) => {
  const body = await new Promise((ok) => { const c = []; rq.on("data", (d) => c.push(d)); rq.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(rq.url, `http://127.0.0.1:${PORT}`).pathname;
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .+/.test(rq.headers.authorization ?? "")) return send(401, { message: "Bad credentials" });
  if (path === "/user/repos" && rq.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && rq.method === "GET") return send(200, { default_branch: "main" });
  if (path.includes("/git/ref/") && rq.method === "GET") return send(409, { message: "Git Repository is empty." });
  if (path.endsWith("/git/blobs") && rq.method === "POST") { const b = JSON.parse(body); const sha = `b${++n}`; blobs.set(sha, b); return send(201, { sha }); }
  if (path.endsWith("/git/trees") && rq.method === "POST") { for (const t of JSON.parse(body).tree ?? []) committed.set(t.path, blobs.get(t.sha) ?? {}); return send(201, { sha: "t1" }); }
  if (path.endsWith("/git/commits") && rq.method === "POST") return send(201, { sha: "c1", html_url: "https://example.invalid/c/1" });
  if (path.endsWith("/git/refs") && rq.method === "POST") return send(201, { object: { sha: "c1" } });
  return send(404, { message: "no" });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/* Pick the part, the way he would, and give it a picture. */
await page.locator('[data-node-id="hero"]').first().click({ force: true });
await page.waitForTimeout(600);
/* The panel's Element tab is where a part's own fields are. */
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
if (await tab.count()) { await tab.click({ force: true }); await page.waitForTimeout(600); }
const field = page.locator('input[type="file"][accept="image/*"]').first();
check("the part offers somewhere to put a picture", (await field.count()) > 0, (await field.count()) ? "" : "no picture field on the panel");
if (!(await field.count())) {
  await browser.close(); stub.close();
  console.log("\n1 FAILED — nothing to put a picture into");
  process.exit(1);
}
await field.setInputFiles({ name: "orb.png", mimeType: "image/png", buffer: PNG });
await page.waitForTimeout(1500);

/* WHERE THE BYTES ARE NOT. */
const inDoc = await page.evaluate(() => {
  const raw = localStorage.getItem("builder.studio") ?? "";
  const doc = JSON.parse(raw);
  const pic = doc?.state?.nodes?.[0]?.picture ?? null;
  return { chars: raw.length, base64: /data:image|iVBORw0/.test(raw), pic };
});
check("the document holds a path and not the picture", !!inDoc.pic?.path && !inDoc.base64,
  inDoc.pic ? `${inDoc.pic.path}, document ${inDoc.chars} characters${inDoc.base64 ? ", AND THE BYTES" : ", no bytes in it"}` : "no picture on the part");
check("and it says how big the real file is, so a publish can be judged before it happens",
  (inDoc.pic?.bytes ?? 0) === PNG.length, `${inDoc.pic?.bytes ?? 0} against ${PNG.length}`);

/* ------------------------------------------------------------------ */
/* Drawing one instead of choosing one                                  */
/* ------------------------------------------------------------------ */

/* The renderer answered by the test, so nothing real is called and no key
   is needed: what is being checked is where the picture lands and what is
   said about the money, not whether Replicate draws. */
let asked = null;
await page.route("**/api/studio/image", async (route) => {
  asked = JSON.parse(route.request().postData() ?? "{}");
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, image: `data:image/png;base64,${PNG.toString("base64")}`, cost: 0.04, model: "black-forest-labs/flux-2-pro" }),
  });
});
const drawIt = page.getByRole("button", { name: /Draw one/ }).first();
check("the part offers to draw one", (await drawIt.count()) > 0);
if (await drawIt.count()) {
  await drawIt.click();
  await page.waitForTimeout(400);
  const panelText = await page.locator("[data-side-panel]").first().innerText();
  check("and says what it will cost before it is pressed", /\$0\.04/.test(panelText), (panelText.match(/.{0,60}\$0\.0.{0,40}/) ?? ["nothing about money"])[0].replace(/\n/g, " "));
  await page.locator('input[placeholder="what the picture should be"]').first().fill("a black orb over a dark sea");
  await page.getByRole("button", { name: /^Draw it/ }).first().click();
  await page.waitForTimeout(2000);
  check("it asks the renderer for a raster of that part's size", asked?.kind === "raster" && asked?.prompt === "a black orb over a dark sea" && asked?.w === 1360,
    asked ? `${asked.kind}, ${asked.w}×${asked.h}` : "nothing was asked");
  const after = await page.evaluate(() => {
    const raw = localStorage.getItem("builder.studio") ?? "";
    return { pic: JSON.parse(raw)?.state?.nodes?.[0]?.picture ?? null, bytes: /iVBORw0/.test(raw) };
  });
  check("a drawn picture lands as a file like any other, and the document still holds no bytes",
    after.pic?.from === "drawn" && after.pic?.path?.startsWith("assets/pictures/") && !after.bytes,
    after.pic ? `${after.pic.from}, ${after.pic.path}` : "no picture on the part");
  check("and it says what it really cost, after", /cost \$0\.04/i.test(await page.locator("[data-side-panel]").first().innerText()));
}

/* Publish, and read what arrived. */
for (let go = 0; go < 3; go++) {
  const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await keys.count()) && (await keys.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_pictures_000");
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1200);
const push = page.getByRole("button", { name: /Push to GitHub/ }).first();
if (await push.count()) { await push.click(); await page.waitForTimeout(8000); }

const paths = [...committed.keys()];
const shot = paths.find((p) => p.startsWith("assets/pictures/"));
check("the picture is committed as a real file", !!shot, paths.join(", ") || "nothing committed");
if (shot) {
  const f = committed.get(shot);
  check("as bytes rather than as text", f.encoding === "base64", `encoding ${f.encoding}`);
  check("and they are the bytes that went in", Buffer.from(f.content, "base64").equals(PNG),
    `${Buffer.from(f.content, "base64").length} bytes against ${PNG.length}`);
}
const html = committed.get("index.html")?.content ?? "";
check("the page points at the file", shot ? html.includes(shot) : false, shot ? `${(html.match(/<img[^>]*>/) ?? ["no img tag"])[0].slice(0, 90)}` : "");
check("and carries no picture inside itself", !/data:image\/(png|jpe?g|webp)/.test(html));

/* And it renders where it is served. */
const site = http.createServer((rq, res) => {
  let p = new URL(rq.url, `http://127.0.0.1:${SERVE}`).pathname.replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  const f = committed.get(p);
  if (!f) { res.writeHead(404); res.end("NOT_FOUND"); return; }
  const bin = f.encoding === "base64";
  res.writeHead(200, { "content-type": p.endsWith(".css") ? "text/css" : p.endsWith(".png") ? "image/png" : "text/html" });
  res.end(bin ? Buffer.from(f.content, "base64") : f.content);
});
await new Promise((ok) => site.listen(SERVE, "127.0.0.1", ok));
const out = await context.newPage();
const failed = [];
out.on("requestfailed", (r) => failed.push(r.url()));
await out.goto(`http://127.0.0.1:${SERVE}/`, { waitUntil: "networkidle" });
await out.waitForTimeout(800);
const drawn = await out.evaluate(() => {
  const img = document.querySelector("img");
  return img ? { there: true, w: img.naturalWidth, h: img.naturalHeight, src: img.getAttribute("src") } : { there: false };
});
check("the published page draws it", drawn.there && drawn.w > 0, drawn.there ? `${drawn.w}×${drawn.h} from ${drawn.src}` : "no img on the page");
check("and nothing it asks for is missing", failed.length === 0, failed.join(", ") || "none");

await browser.close();
stub.close();
site.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
