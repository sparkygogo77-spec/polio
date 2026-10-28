#!/usr/bin/env node
/**
 * SEVERAL VERSIONS OF ONE IDEA, THROUGH THE REAL DOORS.
 *
 * The draft call is stubbed in the browser (`/api/studio/draft` never
 * reaches the server, so no Claude call is made or paid for). Held here:
 *
 *   · Ask Claude sends ONE call asking for versions, and a stubbed answer
 *     with 3 versions shows 3 named versions side by side, page thumbnails;
 *   · ticking Home from version 2 and Pricing from version 1 and pressing
 *     Build makes exactly those two pages the site, with working links;
 *   · no suggested word is on the site until its line is accepted, and an
 *     accepted line puts in that line only;
 *   · one Ctrl+Z undoes the accepted line, one more undoes the whole build;
 *   · the site publishes with no page errors, and its links go page to page;
 *   · Make variations opens on it, and Lock and Randomize work there;
 *   · the free local option makes 3 versions with no call; with no key,
 *     Ask Claude says why and offers the free ones.
 *
 *   npm run build && npx next start -p 3261
 *   node tests/idea-versions-site.mjs http://127.0.0.1:3261 [capture/sites/<name> …]
 *
 * With capture folders: each site brought in (as tests/builder-whats-new.mjs
 * brings one), then the Look panel opened: it shows Make variations once, as
 * before (a built idea site's extra link never shows on a captured site),
 * and nothing on the board moved.
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3261").replace(/\/$/, "");
const SITES = process.argv.slice(3);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const finish = async (browser) => {
  await browser?.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

/* The house style, as a theme makes a System. */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const T = await jiti.import(join(studio, "siteTheme.ts"));
const H = await jiti.import(join(studio, "idea", "houseStyle.ts"));
const house = { ...H.systemFromTheme(T.rollTheme({ seed: 4242 }), "House style"), id: "sys_house" };

const header = { name: "Header", parts: [{ kind: "part", featureId: "sticky-header", label: "Header", content: "", options: {} }] };
const footer = { name: "Footer", parts: [{ kind: "part", featureId: "footer", label: "Footer", content: "", options: {} }] };
/* What the route answers with, already read (`idea/versions.ts#readVersions`). */
const VERSIONS = {
  name: "Clay Room", description: "Pottery classes in Leeds.", by: "claude", missing: [],
  versions: [
    { name: "Calm editorial", pitch: "Quiet and roomy.", pages: [
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Slow hands, good clay" }, { kind: "text", text: "A quiet room for learning the wheel." }] }, footer] },
      { name: "Pricing", sections: [header, { name: "Prices", parts: [{ kind: "heading", level: 2, text: "Calm prices for every week" }, { kind: "part", featureId: "pricing-table", label: "Prices", content: "Taster, Course, Studio", options: {} }] }, footer] },
      { name: "About", sections: [header, { name: "About", parts: [{ kind: "heading", level: 2, text: "Who we are" }] }, footer] },
    ] },
    { name: "Bold product", pitch: "A big promise.", pages: [
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Make a pot this week" }, { kind: "text", text: "Two hours, one wheel, your own pot." }, { kind: "button", text: "Book a class", main: true }] }, footer] },
      { name: "Pricing", sections: [header, { name: "Prices", parts: [{ kind: "heading", level: 2, text: "Bold prices" }] }, footer] },
      { name: "FAQ", sections: [header, { name: "Questions", parts: [{ kind: "part", featureId: "faq", label: "Questions", content: "Do I bring clay?", options: {} }] }, footer] },
    ] },
    { name: "Warm and personal", pitch: "A person first.", pages: [
      { name: "Home", sections: [header, { name: "First screen", parts: [{ kind: "heading", level: 1, text: "Hello, I'm Ann" }] }, footer] },
      { name: "Contact", sections: [header, { name: "Contact", parts: [{ kind: "heading", level: 2, text: "Find me" }] }, footer] },
    ] },
  ],
};
const SUGGESTED = ["Make a pot this week", "Two hours, one wheel, your own pot.", "Book a class", "Calm prices for every week", "Taster, Course, Studio"];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: J({ set: {}, repo: null, branch: "main" }) }));
let answer = { ok: true, versions: VERSIONS, usage: { model: "claude-opus-5-5", input: 1000, output: 3000, cached: 0, written: 0 } };
const calls = [];
await page.route("**/api/studio/draft", (r) => { calls.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ status: 200, contentType: "application/json", body: J(answer) }); });
const wait = (ms) => page.waitForTimeout(ms);
const doc = () => page.evaluate(() => window.__studioPublishDoc());

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
const describe = async () => {
  await page.locator("[data-offer-idea]").click();
  await wait(400);
  await page.locator("[data-idea-text]").fill("Pottery classes in Leeds. Calm, hand-made.");
};

await newSite();
const sample = (await doc()).nodes.length;
const door = page.locator("[data-offer-idea]");
check("a new site's offer has the door to start from an idea", (await door.count()) === 1);
if (!(await door.count())) await finish(browser);
await describe();
check("…with Ask Claude and a free option made here", (await page.locator("[data-idea-make]").count()) === 1 && (await page.locator("[data-idea-local]").count()) === 1);
await page.locator("[data-idea-make]").click();
await page.locator("[data-versions]").waitFor({ timeout: 20000 }).catch(() => {});

/* ------------------------------------------------------------ three named versions */
const names = await page.locator("[data-version-name]").allInnerTexts();
check("a stubbed plan with 3 versions shows 3 named versions", J(names) === J(["Calm editorial", "Bold product", "Warm and personal"]), J(names));
if (!names.length) await finish(browser);
check("…all from one call, asking for versions", calls.length === 1 && calls[0].versions === true && /Pottery/.test(calls[0].idea?.text));
const cells = await page.locator("[data-page-cell][data-page]").count();
check("…side by side as page thumbnails, one a page each version proposes", cells === 8 && (await page.locator("[data-page-cell][data-page] [data-frame], [data-page-cell][data-page] *").count()) > cells, `${cells} cells`);
check("…Build waits for a tick", await page.locator("[data-idea-build]").isDisabled());

/* ------------------------------------------------------------ Home from version 2, Pricing from version 1 */
await page.locator('[data-page-cell][data-page="home"][data-from="1"]').click();
await page.locator('[data-page-cell][data-page="pricing"][data-from="0"]').click();
await page.locator('[data-page-cell][data-page="faq"][data-from="1"]').click();
await page.locator('[data-page-cell][data-page="faq"][data-from="1"]').click();
check("ticking a page twice takes it off; one tick a row", (await page.locator('[data-page-cell][aria-pressed="true"]').count()) === 2);
await page.locator("[data-idea-build]").click();
await page.locator("[data-idea-made]").waitFor({ timeout: 10000 }).catch(() => {});
let d = await doc();
check("picking pages from two versions builds exactly those pages", J(d.pages.map((p) => p.name)) === J(["Home", "Pricing"]), J(d.pages.map((p) => [p.name, p.path])));
check("…no sample page left", !d.nodes.some((n) => n.id.startsWith("st_")) && d.nodes.every((n) => d.pages.some((p) => p.id === n.pageId)));
const navs = d.nodes.filter((n) => n.link?.kind === "page");
check("…with links between them on every page", d.pages.every((p) => J(navs.filter((n) => n.pageId === p.id).map((n) => n.link.target).sort()) === J(d.pages.map((x) => x.id).sort())), J(navs.map((n) => [n.pageId, n.content, n.link.target])));
check("…Home is version 2's, Pricing version 1's", d.nodes.some((n) => n.pageId === d.pages[1].id && n.featureId === "pricing-table") && !(await page.locator("[data-word-offer]").allInnerTexts()).some((t) => /Slow hands|Bold prices|Who we are/.test(t)));
check("…in the house style", (await page.evaluate(() => window.__polioSystem?.doc()?.systemId)) === "sys_house" && d.nodes.filter((n) => n.featureId === "prose").every((n) => n.sys?.s === "sys_house"));

/* ------------------------------------------------------------ words: offered, not written */
const contents = () => d.nodes.map((n) => n.content).filter((c) => typeof c === "string");
check("no word lands before it's accepted", SUGGESTED.every((w) => !contents().includes(w)), J(SUGGESTED.filter((w) => contents().includes(w))));
const offers = await page.locator("[data-word-offer]").allInnerTexts();
check("…each suggested line is offered", SUGGESTED.every((w) => offers.some((t) => t.includes(w))), J(offers));
await page.locator("[data-word-offer]").filter({ hasText: "Make a pot this week" }).locator("[data-word-accept]").click();
await wait(400);
d = await doc();
check("accepting a line puts in that line only", contents().includes("Make a pot this week") && SUGGESTED.slice(1).every((w) => !contents().includes(w)));
check("…and says it is in", (await page.locator("[data-word-offer]").filter({ hasText: "Make a pot this week" }).locator("[data-word-taken]").count()) === 1);
const varHref = await page.locator("[data-idea-made] [data-variations-open]").getAttribute("href").catch(() => null);
check("the result offers Make variations", !!varHref && /\/builder\/variations\?of=/.test(varHref));
await page.locator("[data-idea-done]").click();
await wait(600);

/* ------------------------------------------------------------ one undo */
await page.locator("[data-frame]").first().click({ position: { x: 4, y: 4 }, force: true }).catch(() => {});
await page.keyboard.press("Escape");
await page.keyboard.press("Control+z");
await wait(600);
d = await doc();
check("one Ctrl+Z takes the accepted line back out", !contents().includes("Make a pot this week") && d.pages.length === 2);
await page.keyboard.press("Control+z");
await wait(800);
d = await doc();
check("one Ctrl+Z more undoes the whole build", d.pages.length === 1 && d.nodes.some((n) => n.id.startsWith("st_")) && !d.nodes.some((n) => n.id.startsWith("dr_")) && d.nodes.length === sample, `${d.pages.length} pages, ${d.nodes.length} parts`);
await page.locator("[data-history-redo]").click();
await wait(600);
await page.locator("[data-history-redo]").click();
await wait(800);
d = await doc();
check("…and redo puts it all back", d.pages.length === 2 && contents().includes("Make a pot this week"));

/* The house style drives it: one accent change repaints the main button, one undo puts it back. */
const accent = house.tokens.colour.find((c) => c.role === "accent");
const main = d.nodes.find((n) => n.featureId === "cta-primary" && n.sys?.f?.["colour.bg"] === accent.id && !n.link);
check("the main button is the house style's accent", !!main && main.colour?.bg === accent.value, J(main?.colour));
await page.evaluate((id) => window.__polioSystem.setToken(id, "rgb(200, 0, 200)"), accent.id);
await wait(600);
d = await doc();
check("…changing the accent repaints it", d.nodes.find((n) => n.id === main?.id)?.colour?.bg === "rgb(200, 0, 200)");
await page.keyboard.press("Control+z");
await wait(800);
d = await doc();
check("…and one undo puts it back, the build untouched", d.nodes.find((n) => n.id === main?.id)?.colour?.bg === accent.value && d.pages.length === 2 && contents().includes("Make a pot this week"));

/* ------------------------------------------------------------ publish */
const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("it publishes both pages", Array.isArray(files) && files.some((f) => f.path === "index.html") && files.some((f) => /^pricing\/index\.html$|^pricing\.html$/.test(f.path)), J(files?.map((f) => f.path).filter((p) => p.endsWith(".html"))));
const out = mkdtempSync(join(tmpdir(), "idea-versions-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f) && existsSync(`${f}.html`)) f = `${f}.html`;
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
/* Reduced motion: the published pages fade into each other (`@view-transition { navigation: auto }`, siteMotion.ts), and the headless shell cannot draw a cross-page fade, so Chrome throws "Transition was aborted" into the page on every link. With reduced motion the same stylesheet turns the fade off and the links are followed as a visitor follows them. */
const site = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const siteErrors = [];
site.on("pageerror", (e) => siteErrors.push(e.message));
site.on("console", (m) => { if (m.type() === "error" && !/favicon|404/.test(m.text())) siteErrors.push(m.text()); });
await site.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
for (let y = 0; y < 3000; y += 600) { await site.evaluate((y) => scrollTo(0, y), y); await site.waitForTimeout(80); }
const homeText = await site.evaluate(() => document.body.innerText);
check("the published Home has the accepted line and no line not accepted", homeText.includes("Make a pot this week") && !homeText.includes("Two hours, one wheel"));
const toPricing = site.locator("a", { hasText: /^\s*Pricing\s*$/ }).first();
check("…a link to Pricing", (await toPricing.count()) === 1);
await toPricing.click().catch(() => {});
await site.waitForTimeout(1200);
const pricingText = await site.evaluate(() => document.body.innerText);
check("…which goes to the Pricing page", /pricing/i.test(new URL(site.url()).pathname) || pricingText.includes("Prices"), site.url());
const toHome = site.locator("a", { hasText: /^\s*Home\s*$/ }).first();
await toHome.click().catch(() => {});
await site.waitForTimeout(1200);
check("…and its link to Home goes back", (await site.evaluate(() => document.body.innerText)).includes("Make a pot this week"), site.url());
check("the result publishes with no page errors", siteErrors.length === 0, J(siteErrors.slice(0, 3)));
server.close();

/* ------------------------------------------------------------ Lock and Randomize on the result */
if (varHref) {
  await page.goto(`${BASE}${varHref}`, { waitUntil: "networkidle" });
  await wait(1500);
  await page.locator("[data-variations-roll]").click();
  await page.locator("[data-variation]").first().waitFor({ timeout: 30000 }).catch(() => {});
  check("Randomize makes variations of the built site", (await page.locator("[data-variation]").count()) >= 1);
  const lock = page.locator("[data-variation-lock]").first();
  await lock.click().catch(() => {});
  await wait(300);
  check("…a layer locks", (await lock.getAttribute("aria-pressed").catch(() => null)) === "true");
  await page.locator("[data-variation-again]").first().click().catch(() => {});
  await wait(2500);
  check("…and rolling again keeps the lock with no page errors", (await lock.getAttribute("aria-pressed").catch(() => null)) === "true" && errors.length === 0, J(errors.slice(0, 2)));
}

/* ------------------------------------------------------------ the free option, and no key */
await newSite();
await describe();
const before = calls.length;
await page.locator("[data-idea-local]").click();
await page.locator("[data-versions]").waitFor({ timeout: 10000 }).catch(() => {});
check("the free option makes 3 named versions with no call", (await page.locator("[data-version-name]").count()) === 3 && calls.length === before, J(await page.locator("[data-version-name]").allInnerTexts()));
await page.locator("[data-version-all]").filter({ hasNotText: /\b1 page\b/ }).first().click();
await page.locator("[data-idea-build]").click();
await page.locator("[data-idea-made]").waitFor({ timeout: 10000 }).catch(() => {});
d = await doc();
check("…and taking a whole version builds all its pages", d.pages.length >= 2 && d.nodes.some((n) => n.link?.kind === "page"), J(d.pages.map((p) => p.name)));

answer = { ok: false, reason: "no-key", message: "No Claude key, so the draft is the plain one." };
await newSite();
await describe();
await page.locator("[data-idea-make]").click();
await page.locator("[data-versions]").waitFor({ timeout: 10000 }).catch(() => {});
check("with no key, Ask Claude says why and shows the free versions", /No Claude key/.test(await page.locator("[data-idea-plain]").innerText().catch(() => "")) && (await page.locator("[data-version-name]").count()) === 3);

check("no page errors in the Builder", errors.length === 0, J(errors.slice(0, 3)));

/* ------------------------------------------------------------ every capture folder: imports are untouched */
const boardOf = (p) => p.evaluate(() => (window.__studioHistory?.doc().nodes ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).join("|"));
for (const SINK of SITES) {
  const name = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
  if (!existsSync(join(SINK, "site/document.json"))) { check(`${name}: a capture folder`, false, SINK); continue; }
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 }))];
  const c2 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const p2 = await c2.newPage();
  const errs = [];
  p2.on("pageerror", (e) => errs.push(e.message));
  await p2.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
    if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
    const rest = u.pathname.slice(REPO.length);
    if (!rest) return j({ default_branch: "main", homepage: "" });
    if (rest.startsWith("/git/trees/")) return j({ tree });
    if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
    const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
    if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
    return j({ message: "no" }, 404);
  });
  await p2.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await p2.evaluate(() => { const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await p2.reload({ waitUntil: "networkidle" }); await p2.waitForTimeout(1200);
  const keys = p2.locator("[data-keys-panel]");
  await p2.getByRole("button", { name: "Keys", exact: true }).click(); await p2.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await p2.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await p2.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await p2.waitForTimeout(500);
  await p2.locator("[data-github-button]").first().click(); await p2.waitForTimeout(700);
  await p2.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await p2.locator("[data-repo-pull]").click(); await p2.waitForTimeout(300);
  if (await p2.locator("[data-repo-bring-go]").count()) await p2.locator("[data-repo-bring-go]").click();
  const count = () => p2.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
  for (let i = 0; i < 1500 && (await count()) < 20; i++) await p2.waitForTimeout(1000);
  /* Settled: the stored board the same twice, 3s apart. */
  let a = await boardOf(p2);
  for (let i = 0; i < 60; i++) { await p2.waitForTimeout(3000); const b = await boardOf(p2); if (a === b) break; a = b; }
  for (let i = 0; i < 4 && (await p2.locator("[data-repo-panel], [role='dialog']").count()); i++) { await p2.keyboard.press("Escape"); await p2.waitForTimeout(300); }
  await p2.waitForTimeout(1500);
  const s0 = await boardOf(p2);
  await p2.getByRole("tab", { name: "Look" }).first().click({ force: true }).catch(() => {});
  await p2.waitForTimeout(1200);
  const links = await p2.locator("[data-look-panel] [data-variations-open]").count();
  check(`${name}: ${s0.split("|").length} parts; the Look panel shows Make variations once`, links === 1, `${links} links`);
  check(`${name}: nothing on the board moved`, (await boardOf(p2)) === s0);
  check(`${name}: no page errors`, errs.length === 0, errs.join(" | ").slice(0, 200));
  await c2.close();
}
await finish(browser);
