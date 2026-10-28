#!/usr/bin/env node
/**
 * BUILDS IS THE HOME: BIG ENTRIES TO START THINGS, AND STATUS ON EVERY SITE
 * (J, 2026-10-25).
 *
 *   1. pure: `builds/status.ts` reads a site's record, its document's System,
 *      the library's house style, the agents record and the other sites,
 *      and says live, export, style, agents and copies in words;
 *   2. the Start row shows five entries, and each opens the right flow:
 *      Import a site â†’ the capture dialog; Start from an idea â†’ a blank site
 *      with the idea dialog; Make variations â†’ a site picked, its Variations
 *      page; Blank site â†’ a blank site in the Builder; Agents â†’ the dock;
 *      the agents entry says "Set up agents" until the dock has paired;
 *   3. a card says, from seeded data: live and where, the last export with
 *      its mode and where, house style or its own, its copies with Compare,
 *      and the agents on it â€” the agents line only when the dock is paired
 *      and the record is fresh;
 *   4. the dock's message is taken into the record, from the helper's origin only;
 *   5. the page loads with no page errors and no request beyond what it
 *      made before (its own files, /api/version and /api/studio/repo).
 *
 *   npx next start -p 3281
 *   node tests/builds-home.mjs http://127.0.0.1:3281
 */
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3281").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` â€” ${detail}` : ""}`); };

/* 1. Pure. */
let S = null;
try { S = await import("../src/features/builds/status.ts"); } catch (e) { check("the status module loads", false, String(e?.message ?? e).slice(0, 120)); }
if (S) {
  const now = Date.parse("2026-10-25T12:00:00");
  const all = [
    { id: "a", name: "Sol face", live: { url: "https://solface.vercel.app/", at: now - 3600e3 }, exported: { at: now - 600e3, mode: "clean", to: "repo", repo: "j/solface" } },
    { id: "b", name: "Sol face copy", versionOf: { project: "a", made: now } },
    { id: "c", name: "Mochi" },
  ];
  const st = S.siteStatus({ site: all[0], doc: { systemId: "sysH" }, houseId: "sysH", agents: { at: now - 60e3, lanes: [{ lane: "calmer-hero", state: "running", note: "calmer hero" }, { lane: "done-one", state: "done", note: "old" }] }, all, now });
  check("live: the host and when", st.live?.host === "solface.vercel.app" && /^Live at solface\.vercel\.app, /.test(st.live.says), st.live?.says);
  check("export: mode and where", /Exported .*Clean code, to j\/solface\.$/.test(st.exportSays) && st.exportKind === "clean", st.exportSays);
  check("style: on the house style by id", st.style.kind === "house");
  check("agents: only the lanes still working, with their notes", st.agents?.count === 1 && /1 agent working now: calmer hero\./.test(st.agents.says), st.agents?.says);
  check("versions: its copies, by name", st.versions.copies.length === 1 && st.versions.copies[0].name === "Sol face copy" && /1 copy: Sol face copy/.test(st.versions.says), st.versions.says);
  const copy = S.siteStatus({ site: all[1], doc: { systemId: "sysB", system: { id: "sysB", name: "Sol face" } }, houseId: "sysH", agents: null, all, now });
  check("a copy names its original, and its own style", copy.versions.original?.id === "a" && copy.style.kind === "own" && copy.style.says === "Own style: Sol face.", `${copy.versions.says} ${copy.style.says}`);
  const none = S.siteStatus({ site: all[2], doc: null, houseId: null, agents: { at: now - S.AGENTS_FRESH_MS - 1, lanes: [{ lane: "x", state: "running", note: "x" }] }, all, now });
  check("nothing known: not live, not exported, no System, no copies; a stale agents record says nothing", !none.live && none.exportSays === "Not exported yet." && none.style.kind === "none" && none.agents === null && none.versions.says === "No copies yet.");
  check("a System carrying the house mark is the house style", S.styleOf({ system: { id: "s", name: "x", house: 5 } }, null).kind === "house");
  check("a zip export says so", /as a zip\.$/.test(S.exportWords({ at: now, mode: "exact", to: "zip" }, now)));
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];
const requests = [];
const fresh = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  /* The dock lives on the helper; the Builder may probe it (`no-cors`) when the dock opens. Answered as a page, so the frame can mount. */
  await page.route(/^http:\/\/127\.0\.0\.1:47821\/.*/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>dock</title>" }));
  await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  return { ctx, page };
};
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, x, y) => ({ id, pageId: "page_home", featureId: "prose", label: id, prompt: "", content: id, data: "", x, y, w: 200, h: 40, groupId: null, options: {}, priority: "must", custom: false });
const system = (id, name, house) => ({ kind: "polio-system", version: 1, id, name, from: "theme", rev: 1, editedAt: 1, ...(house ? { house } : {}), tokens: { colour: [], type: { faces: [], scale: null, steps: [] }, space: [], radius: [], shadow: [], motion: { durations: [], easings: [] } }, components: [] });
const NOW = Date.now();

/** Three sites: Sol face (live, exported, house style, open), its copy, and Mochi on its own style. */
const seedIn = async (page, o = {}) => {
  await page.goto(`${BASE}/builds`, { waitUntil: "domcontentloaded" });
  const doc = (sysId, sys) => env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [node("n1", 40, 40)], systemId: sysId, system: sys });
  await page.evaluate(({ NOW, o, docs, systems }) => {
    localStorage.clear();
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({
      projects: [
        { id: "a", name: "Sol face", updatedAt: NOW, editedAt: NOW - 7200e3, live: { url: "https://solface.vercel.app/", at: NOW - 3600e3 }, published: { at: NOW - 3600e3, repo: "j/solface", branch: "main", editedAt: NOW - 7200e3 }, repo: { owner: "j", name: "solface", branch: "main" }, exported: { at: NOW - 600e3, mode: "clean", to: "repo", repo: "j/solface" } },
        { id: "b", name: "Sol face copy", updatedAt: NOW - 100e3, versionOf: { project: "a", made: NOW - 100e3 } },
        { id: "c", name: "Mochi", updatedAt: NOW - 200e3 },
      ],
      activeId: "a",
    }));
    localStorage.setItem("builder.studio", docs.a);
    localStorage.setItem("builder.doc:b", docs.b);
    localStorage.setItem("builder.doc:c", docs.c);
    localStorage.setItem("builder.systems", env({ byId: systems }));
    if (o.agents !== null) localStorage.setItem("builder.agents", JSON.stringify(o.agents ?? { paired: true, at: NOW - 60e3, sites: { a: { at: NOW - 60e3, lanes: [{ lane: "calmer-hero", state: "running", note: "calmer hero" }] } } }));
  }, {
    NOW, o,
    docs: { a: doc("sysH", system("sysH", "House style", 5)), b: doc("sysH", system("sysH", "House style", 5)), c: doc("sysC", system("sysC", "Mochi's own", 0)) },
    systems: { sysH: system("sysH", "House style", 5), sysC: system("sysC", "Mochi's own", 0) },
  });
};
const open = async (page) => { await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" }); await page.waitForTimeout(800); };
const projectsIn = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.projects ?? []);

/* 2. The Start row. */
{
  const { ctx, page } = await fresh();
  await seedIn(page);
  await open(page);
  const row = page.locator("[data-start-row]");
  check("the Start row is on the page", (await row.count()) === 1);
  const ids = await row.locator("[data-start]").evaluateAll((els) => els.map((e) => e.getAttribute("data-start")));
  check("â€¦with the five entries, in order", JSON.stringify(ids) === JSON.stringify(["capture", "idea", "variations", "blank", "agents"]), ids.join(", "));
  check("the agents entry says Open the agents dock when the dock has paired lately", /Open the agents dock/.test(await row.locator('[data-start="agents"]').innerText()));

  /* Import a site â†’ the capture dialog. */
  await row.locator('[data-start="capture"]').click();
  await page.waitForURL(/\/builder/, { timeout: 15000 }).catch(() => {});
  await page.waitForSelector("[data-capture-url]", { timeout: 15000 }).catch(() => {});
  check("Import a site opens the Builder on the capture dialog", /\/builder/.test(page.url()) && (await page.locator("[data-capture-url]").count()) === 1, page.url());
  check("â€¦and the address is cleaned of ?start", !/start=/.test(page.url()), page.url());
  await page.keyboard.press("Escape");

  /* Start from an idea â†’ a blank site, the idea dialog over it. */
  await open(page);
  const before = (await projectsIn(page)).length;
  await row.locator('[data-start="idea"]').click();
  await page.waitForSelector("[data-idea-text]", { timeout: 15000 }).catch(() => {});
  const afterIdea = await projectsIn(page);
  check("Start from an idea makes a blank site and opens the idea dialog on it", /\/builder/.test(page.url()) && (await page.locator("[data-idea-text]").count()) === 1 && afterIdea.length === before + 1, `${page.url()}, ${afterIdea.length} sites`);
  await page.keyboard.press("Escape");

  /* Make variations â†’ pick a site â†’ its Variations page. */
  await open(page);
  await row.locator('[data-start="variations"]').click();
  await page.waitForSelector("[data-start-variations-list]", { timeout: 5000 }).catch(() => {});
  const listed = await page.locator("[data-start-variations-of]").evaluateAll((els) => els.map((e) => e.getAttribute("data-start-variations-of")));
  check("Make variations asks which site, listing every site", listed.includes("a") && listed.includes("c"), listed.join(", "));
  await page.locator('[data-start-variations-of="c"]').click();
  await page.waitForURL(/\/builder\/variations/, { timeout: 15000 }).catch(() => {});
  check("â€¦and opens that site's Variations page", /\/builder\/variations\?of=c/.test(page.url()), page.url());

  /* Blank site â†’ a new site, open in the Builder. */
  await open(page);
  const n0 = (await projectsIn(page)).length;
  await row.locator('[data-start="blank"]').click();
  await page.waitForURL(/\/builder(\?|$)/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const after = await projectsIn(page);
  const blankParts = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.nodes?.length ?? 0; } catch { return -1; } });
  check("Blank site makes a new site and opens the Builder on an empty board", /\/builder/.test(page.url()) && after.length === n0 + 1 && blankParts === 0, `${after.length} sites, ${blankParts} parts`);

  /* Agents â†’ the dock. */
  await open(page);
  await row.locator('[data-start="agents"]').click();
  await page.waitForSelector("[data-agents-dock]", { timeout: 15000 }).catch(() => {});
  check("the agents entry opens the Builder with the dock open", /\/builder/.test(page.url()) && (await page.locator("[data-agents-dock]").count()) === 1, page.url());
  await ctx.close();
}

/* The agents entry without a paired dock. */
{
  const { ctx, page } = await fresh();
  await seedIn(page, { agents: null });
  await open(page);
  check("with no paired dock, the agents entry says Set up agents", /Set up agents/.test(await page.locator('[data-start="agents"]').innerText()));
  await ctx.close();
}

/* 3. The cards. */
{
  const { ctx, page } = await fresh();
  await seedIn(page);
  errors.length = 0;
  requests.length = 0;
  await open(page);
  const card = (id) => page.locator(`[data-build-id="${id}"]`);
  const a = card("a"), c = card("c"), b = card("b");
  check("every card has its status block", (await page.locator("[data-site-status]").count()) === 3);
  const live = await a.locator("[data-status-live]").innerText();
  check("Sol face: live, and where", (await a.locator("[data-status-live]").getAttribute("data-status-live")) === "yes" && /Live at solface\.vercel\.app/.test(live), live);
  check("â€¦the live line links to the site", (await a.locator("[data-status-live] a").getAttribute("href")) === "https://solface.vercel.app/");
  const ex = await a.locator("[data-status-export]").innerText();
  check("â€¦its last export, with mode and where", /Clean code, to j\/solface/.test(ex) && /Exported /.test(ex), ex);
  check("â€¦on the house style", (await a.locator("[data-status-style]").getAttribute("data-status-style")) === "house" && /House style/.test(await a.locator("[data-status-style]").innerText()));
  const ag = await a.locator("[data-status-agents]").innerText().catch(() => "");
  check("â€¦the agents working on it now, from the paired dock's record", /1 agent working now: calmer hero/.test(ag), ag);
  const versions = (await a.locator("[data-status-versions]").innerText()).replace(/\s+/g, " ");
  check("â€¦its copy, with Compare one press away", /1 copy: Sol face copy/.test(versions) && /Compare/.test(versions), versions);
  const href = await a.locator('[data-status-compare="b"]').getAttribute("href");
  check("â€¦Compare opens the original beside the copy", !!href && /\/builder\/compare/.test(href) && href.includes("a") && href.includes("b"), href ?? "");
  check("the copy names its original, with Compare", /A copy of Sol face/.test(await b.locator("[data-status-versions]").innerText()) && (await b.locator('[data-status-compare="a"]').count()) === 1);
  check("Mochi: not live, not exported, on its own style, no copies", (await c.locator("[data-status-live]").getAttribute("data-status-live")) === "no" && /Not exported yet/.test(await c.locator("[data-status-export]").innerText()) && /Own style: Mochi's own/.test(await c.locator("[data-status-style]").innerText()) && /No copies yet/.test(await c.locator("[data-status-versions]").innerText()));
  check("â€¦and no agents line: none is on it", (await c.locator("[data-status-agents]").count()) === 0);

  /* 5. No page errors, no new request. */
  check("no page errors on the Builds page", errors.length === 0, errors.join(" | ").slice(0, 200));
  const base = new URL(BASE);
  const strange = requests.filter((u) => { const x = new URL(u); if (x.host !== base.host) return true; return /^\/api\//.test(x.pathname) && !/^\/api\/(version|studio\/repo)$/.test(x.pathname); });
  check("the page makes no request beyond its own files, /api/version and /api/studio/repo", strange.length === 0, strange.slice(0, 5).join(", "));

  /* 4. The dock's message is taken into the record. */
  const taken = await page.evaluate(() => new Promise((done) => {
    const after = () => { window.removeEventListener("builds:agents", after); done(JSON.parse(localStorage.getItem("builder.agents") ?? "null")); };
    window.addEventListener("builds:agents", after);
    /* As the dock frame would post it, from the helper's origin: a message event with that origin. */
    window.dispatchEvent(new MessageEvent("message", { origin: "http://127.0.0.1:47821", data: { source: "polio-dock", kind: "lanes", v: 1, site: "c", paired: true, lanes: [{ lane: "lane-1", state: "running", note: "bigger hero" }] } }));
    setTimeout(() => done("no event"), 2000);
  }));
  check("a lanes message from the helper's origin is written on the record", taken && taken.sites?.c?.lanes?.[0]?.note === "bigger hero", JSON.stringify(taken).slice(0, 120));
  await page.waitForTimeout(300);
  check("â€¦and Mochi's card shows it at once", /bigger hero/.test(await c.locator("[data-status-agents]").innerText().catch(() => "")));
  const spoofed = await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.test", data: { source: "polio-dock", kind: "lanes", v: 1, site: "b", lanes: [{ lane: "x", state: "running", note: "spoof" }] } }));
    return JSON.parse(localStorage.getItem("builder.agents") ?? "null")?.sites?.b ?? null;
  });
  check("a message from another origin is ignored", spoofed === null);
  await ctx.close();
}

/* A stale record says nothing, even when paired. */
{
  const { ctx, page } = await fresh();
  await seedIn(page, { agents: { paired: true, at: NOW - 60 * 60e3, sites: { a: { at: NOW - 60 * 60e3, lanes: [{ lane: "old", state: "running", note: "old" }] } } } });
  await open(page);
  check("an hour-old agents record shows no agents line and Set up agents", (await page.locator('[data-build-id="a"] [data-status-agents]').count()) === 0 && /Set up agents/.test(await page.locator('[data-start="agents"]').innerText()));
  await ctx.close();
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
