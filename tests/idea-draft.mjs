#!/usr/bin/env node
/**
 * START FROM A NEW IDEA, THROUGH THE REAL DOORS (create system (b)).
 *
 * The draft call is stubbed in the browser (`/api/studio/draft` never
 * reaches the server, so no Claude call is made or paid for). Held here:
 *
 *   · a new site's offer has "Start from an idea", which opens the dialog
 *     J approved: what it is, sections, a site liked;
 *   · Make a draft sends one call with those words, and the stubbed plan
 *     becomes the site: its sections in order, each part the catalogue part
 *     the plan named, a labelled placeholder where nothing fits;
 *   · the draft is drawn in the house style (the library System marked
 *     "House style"): the site points at it, every word, button and band is
 *     linked to its tokens, and changing its accent repaints the main
 *     button, one undo step, undone by one undo;
 *   · it publishes with no page errors, every draft part on the published
 *     page, words and the house style's accent included;
 *   · with no key the plain draft is made, in the house style, and says why.
 *
 *   npm run build && npx next start -p 3121
 *   node tests/idea-draft.mjs http://127.0.0.1:3121
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3121").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const finish = async (browser) => {
  await browser?.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

/* The house style, made the way a theme makes a System; on base there is no such module, so the house style is written by hand there. */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const T = await jiti.import(join(studio, "siteTheme.ts"));
let house;
try {
  const H = await jiti.import(join(studio, "idea", "houseStyle.ts"));
  house = { ...H.systemFromTheme(T.rollTheme({ seed: 4242 }), "House style"), id: "sys_house" };
} catch {
  house = { kind: "polio-system", version: 1, id: "sys_house", name: "House style", from: "theme", rev: 1, editedAt: Date.now(), tokens: { colour: [{ id: "col_1", name: "Background", value: "rgb(250, 248, 244)", role: "bg" }, { id: "col_5", name: "Accent", value: "rgb(150, 60, 30)", role: "accent" }], type: { faces: [], scale: null, steps: [] }, space: [], radius: [], shadow: [], motion: { durations: [], easings: [] } }, components: [] };
}
const accent = house.tokens.colour.find((c) => c.role === "accent");

/* The plan the stub answers with: what Claude would send back, already read (`idea/plan.ts#readPlan`). */
const PLAN = {
  name: "Clay Room",
  description: "Pottery classes, a shop and a gallery in Leeds.",
  sections: [
    { name: "Header", parts: [{ kind: "part", featureId: "sticky-header", label: "Header", content: "Classes, Shop, Gallery", options: {} }] },
    { name: "First screen", parts: [
      { kind: "heading", level: 1, text: "Make something with your hands this week" },
      { kind: "text", text: "Small classes at the wheel, in a calm room in Leeds." },
      { kind: "button", text: "Book a class", main: true },
      { kind: "button", text: "See the shop", main: false },
    ] },
    { name: "Classes", parts: [
      { kind: "heading", level: 2, text: "Classes" },
      { kind: "part", featureId: "card-grid", label: "Class cards", content: "", options: {} },
      { kind: "placeholder", name: "Class calendar", why: "Booking a date needs a calendar that takes bookings." },
    ] },
    { name: "Questions", parts: [{ kind: "heading", level: 2, text: "Questions" }, { kind: "part", featureId: "faq", label: "Questions", content: "Do I need to bring anything?, Can I come alone?", options: {} }] },
    { name: "Footer", parts: [{ kind: "part", featureId: "footer", label: "Footer", content: "", options: {} }] },
  ],
  missing: [{ name: "Class calendar", why: "Booking a date needs a calendar that takes bookings." }],
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ set: {}, repo: null, branch: "main" }) }));
let answer = { ok: true, plan: PLAN, usage: { model: "claude-opus-5-5", input: 1000, output: 800, cached: 0, written: 0 } };
const calls = [];
await page.route("**/api/studio/draft", (r) => { calls.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ status: 200, contentType: "application/json", body: J(answer) }); });
const wait = (ms) => page.waitForTimeout(ms);
const doc = () => page.evaluate(() => window.__studioPublishDoc());

/* A new site, with the house style in the library. */
const newSite = async () => {
  await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
  await page.evaluate((house) => { localStorage.clear(); localStorage.setItem("builder.systems", JSON.stringify({ state: { byId: { [house.id]: house } }, version: 0 })); }, house);
  await page.reload({ waitUntil: "networkidle" });
  await wait(800);
  await page.getByRole("button", { name: "New site" }).first().click();
  await wait(1500);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await wait(2500);
};
await newSite();
check("a new site's offer stands over its sample page", (await page.locator("[data-new-site-offer]").count()) === 1);
const door = page.locator("[data-offer-idea]");
check("…with a door to start from an idea", (await door.count()) === 1);
if (!(await door.count())) await finish(browser);

await door.click();
await wait(400);
check("the dialog asks what it is, the sections and a site liked", (await page.locator("[data-idea-text]").count()) === 1 && (await page.locator("[data-idea-sections]").count()) === 1 && (await page.locator("[data-idea-ref]").count()) === 1);
check("…Make a draft waits for words", await page.locator("[data-idea-make]").isDisabled());
await page.locator("[data-idea-text]").fill("A booking site for a small pottery studio in Leeds. Classes, a shop, a gallery. Warm, hand-made, calm.");
await page.locator("[data-idea-sections]").fill("Classes, Questions");
await page.locator("[data-idea-ref]").fill("https://example.com");
await page.locator("[data-idea-make]").click();
await page.locator("[data-idea-made]").waitFor({ timeout: 20000 }).catch(() => {});
check("one draft call, with the words, the sections and the site liked", calls.length === 1 && /pottery/.test(calls[0].idea?.text) && J(calls[0].idea?.sections) === J(["Classes", "Questions"]) && calls[0].idea?.ref === "https://example.com", J(calls[0]?.idea));
const said = (await page.locator("[data-idea-made]").innerText().catch(() => "")) ?? "";
check("the dialog says what it made and that it is in the house style", /Clay Room/.test(said) && /house style/.test(said) && /Class calendar/.test(said), said.replace(/\s+/g, " "));
await page.locator("[data-idea-done]").click().catch(() => {});
await wait(1200);

let d = await doc();
const drafted = d.nodes.filter((n) => n.id.startsWith("dr_"));
check("the plan is the site: no sample page left, the draft's parts on it", drafted.length > 10 && !d.nodes.some((n) => n.id.startsWith("st_")), `${drafted.length} parts`);
const byLabel = (l) => drafted.filter((n) => n.label === l).map((n) => n.featureId);
check("…each catalogue part the plan named", J(byLabel("Header")) === J(["sticky-header"]) && J(byLabel("Class cards")) === J(["card-grid"]) && J(byLabel("Questions")) === J(["faq"]) && J(byLabel("Footer")) === J(["footer"]));
check("…a labelled placeholder where nothing fits", drafted.some((n) => n.featureId === "custom-idea" && n.label === "Class calendar"));
const ys = ["sticky-header", "cta-primary", "card-grid", "faq", "footer"].map((f) => Math.min(...drafted.filter((n) => n.featureId === f).map((n) => n.y)));
check("…its sections in the plan's order", ys.every((v, i) => i === 0 || v > ys[i - 1]), J(ys));
check("…and the site is named for it", d.brief?.name === "Clay Room");

const sys = await page.evaluate(() => ({ doc: window.__polioSystem?.doc(), broken: window.__polioSystem?.broken(), system: window.__polioSystem?.system() }));
check("the site points at the house style", sys.doc?.systemId === "sys_house" && sys.system?.name === "House style", J(sys.doc));
const words = drafted.filter((n) => n.featureId === "prose");
const buttons = drafted.filter((n) => n.featureId === "cta-primary");
const bands = drafted.filter((n) => n.featureId === "box");
check("every word, button and band is linked to its tokens", words.length >= 4 && words.every((n) => n.sys?.s === "sys_house" && n.sys.f?.["font.px"] && n.sys.f?.["font.stack"] && n.sys.f?.["colour.text"]) && buttons.every((n) => n.sys?.f?.["colour.bg"] && n.sys.f?.radius && n.sys.f?.["pad.left"]) && bands.every((n) => n.sys?.f?.["colour.bg"]));
check("…and every link holds", Array.isArray(sys.broken) && sys.broken.length === 0, J(sys.broken?.slice(0, 3)));
const main = buttons.find((n) => n.content === "Book a class");
check("the main button is the house style's accent", main?.sys?.f?.["colour.bg"] === accent.id && main?.colour?.bg === accent.value);
check("nothing to undo back to", await page.locator("[data-history-undo]").isDisabled());

/* Change the accent once: the draft follows. */
await page.evaluate((id) => window.__polioSystem.setToken(id, "rgb(200, 0, 200)"), accent.id);
await wait(600);
d = await doc();
check("changing the house style's accent repaints the main button", d.nodes.find((n) => n.id === main.id)?.colour?.bg === "rgb(200, 0, 200)");
await page.locator("[data-frame]").first().click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
await page.keyboard.press("Escape");
await page.keyboard.press("Control+z");
await wait(800);
d = await doc();
check("…and one undo puts it back", d.nodes.find((n) => n.id === main.id)?.colour?.bg === accent.value);

/* Publish: the static site as Go live writes it. */
const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("it publishes", Array.isArray(files) && files.some((f) => f.path === "index.html"), `${files?.length ?? 0} files`);
const out = mkdtempSync(join(tmpdir(), "idea-draft-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const siteErrors = [];
site.on("pageerror", (e) => siteErrors.push(e.message));
site.on("console", (m) => { if (m.type() === "error" && !/favicon|404/.test(m.text())) siteErrors.push(m.text()); });
await site.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
for (let y = 0; y < 6000; y += 600) { await site.evaluate((y) => scrollTo(0, y), y); await site.waitForTimeout(80); }
await site.waitForTimeout(600);
const live = await site.evaluate((ids) => ids.map((id) => { const el = document.getElementById(id); return { id, on: !!el, text: el?.innerText ?? "", bg: el ? [el, ...el.querySelectorAll("*")].map((e) => getComputedStyle(e).backgroundColor).find((c) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) ?? null : null }; }), drafted.map((n) => n.id));
const missing = live.filter((x) => !x.on).map((x) => x.id);
check("every draft part is on the published page", missing.length === 0, missing.slice(0, 5).join(", "));
check("…with its words", ["Make something with your hands this week", "Book a class", "Class calendar"].every((w) => live.some((x) => x.text.includes(w))));
check("…and the house style's accent on the main button", live.find((x) => x.id === main.id)?.bg === accent.value, live.find((x) => x.id === main.id)?.bg);
check("the published page has no page errors", siteErrors.length === 0, J(siteErrors.slice(0, 3)));
server.close();

/* No key: the plain draft, in the house style, saying why. */
answer = { ok: false, reason: "no-key", message: "No Claude key, so the draft is the plain one: your sections, in the house style." };
await newSite();
await page.locator("[data-offer-idea]").click();
await page.locator("[data-idea-text]").fill("A small bakery in York. Bread, cakes, opening hours.");
await page.locator("[data-idea-sections]").fill("Bread, Cakes, Hours");
await page.locator("[data-idea-make]").click();
await page.locator("[data-idea-made]").waitFor({ timeout: 20000 }).catch(() => {});
check("with no key, the dialog says why the draft is plain", /No Claude key/.test(await page.locator("[data-idea-plain]").innerText().catch(() => "")));
d = await doc();
const plain = d.nodes.filter((n) => n.id.startsWith("dr_"));
check("…and the plain draft has the sections asked for, in the house style", ["Bread", "Cakes", "Hours"].every((w) => plain.some((n) => n.content === w)) && plain.filter((n) => n.featureId === "prose").every((n) => n.sys?.s === "sys_house"));

check("no page errors in the Builder", errors.length === 0, J(errors.slice(0, 3)));
await finish(browser);
