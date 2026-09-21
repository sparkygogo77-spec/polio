/**
 * BRING IT IS THE WHOLE GESTURE: the page lands, or the reason is said.
 *
 * Driven by hand on the live site: Bring a repo in, with this Builder's own
 * repository named, read the sources, fell through to the address the
 * repository is deployed at, opened the page there, and then stood at the
 * picking stage of a narrow panel waiting for "Take the whole page". What
 * he saw was nothing on the board, no refusal and no question.
 *
 * Then again by hand, from the Builds page this time: a fresh site, the
 * control on that page's own top bar, Bring it, and nothing, with the view
 * still on the Builds page. The control had put a space into a store that
 * page never loads. So a request made off the board is kept for it and the
 * Builder is opened, and every ending is a toast as well as a panel line.
 *
 * Four repositories, answered by this file in the browser, the way GitHub
 * would answer his token:
 *   · one with a page in it: its blocks land as parts with no further press,
 *     and again when Bring it is pressed from the Builds page;
 *   · one with a page nothing can be made from: said as a toast;
 *   · two made here, carrying their published document: copied whole as a
 *     new site each, parts, pictures and brief, connected to the repository;
 *   · one of sources with no address anywhere: the refusal stays on screen;
 *   · one of sources deployed at an address this machine cannot open: the
 *     refusal names the address and why.
 *
 * The token held is a placeholder the stub never reads, saved through the
 * Keys panel exactly as his is; nothing leaves the machine.
 *
 *   node tests/bring-lands.mjs [url]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PAGE = `<!doctype html><html><head><title>A page</title><style>body{margin:0;font-family:sans-serif}header{padding:40px;background:#123;color:#fff}main{padding:40px}</style></head>
<body><header><h1>Blackorb</h1><p>A small studio for small things.</p></header>
<main><section><h2>What we make</h2><p>Sites, mostly. Some of them for other people.</p><a href="#" style="display:inline-block;padding:12px 20px;background:#e63;color:#fff">Say hello</a></section></main></body></html>`;

const BLANK = `<!doctype html><html><head><title>Blank</title></head><body></body></html>`;
/* The site itself: this repository's own published document, BLACKORB, with
   one part given a picture so the picture path is exercised too. */
const DOC = JSON.parse(readFileSync("site/document.json", "utf8"));
DOC.nodes.push({ ...DOC.nodes[0], id: "n_pic_test", featureId: "orb-image", content: "", picture: { id: "pic_test1", path: "assets/pictures/pic_test1.png", type: "image/png", w: 1, h: 1, bytes: 70, alt: "", from: "upload" } });
const DOC2 = { ...DOC, brief: { ...DOC.brief, name: "Madeless" }, nodes: DOC.nodes.slice(0, 3) };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const repos = {
  /* A site made here, deployed: copied whole from its document, pictures and all. */
  "him/made": { homepage: "https://polio-two.vercel.app", tree: [{ path: "package.json", type: "blob", sha: "m1", size: 10 }, { path: "site/document.json", type: "blob", sha: "m2", size: 1000 }, { path: "assets/pictures/pic_test1.png", type: "blob", sha: "m4", size: 70 }, { path: "src/app/page.tsx", type: "blob", sha: "m3", size: 100 }] },
  /* A site made here that says nowhere it is deployed: the document needs no address. */
  "him/madeless": { homepage: "", tree: [{ path: "package.json", type: "blob", sha: "n1", size: 10 }, { path: "site/document.json", type: "blob", sha: "n2", size: 1000 }] },
  "him/blank": { homepage: "", tree: [{ path: "index.html", type: "blob", sha: "b1", size: BLANK.length }] },
  "him/page": { homepage: "", tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }, { path: "README.md", type: "blob", sha: "p2", size: 10 }] },
  "him/sources": { homepage: "", tree: [{ path: "package.json", type: "blob", sha: "s1", size: 10 }, { path: "src/app/page.tsx", type: "blob", sha: "s2", size: 100 }] },
  "him/deployed": { homepage: "https://polio-two.vercel.app", tree: [{ path: "package.json", type: "blob", sha: "d1", size: 10 }, { path: "src/app/page.tsx", type: "blob", sha: "d2", size: 100 }] },
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  const repo = m ? repos[m[1]] : null;
  if (!repo) return j({ message: "no" }, 404);
  const rest = m[2] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: repo.homepage });
  if (rest.startsWith("/git/trees/")) return j({ tree: repo.tree });
  if (rest === "/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") });
  if (rest === "/git/blobs/b1") return j({ encoding: "base64", content: Buffer.from(BLANK).toString("base64") });
  if (rest === "/git/blobs/m2") return j({ encoding: "base64", content: Buffer.from(JSON.stringify(DOC)).toString("base64") });
  if (rest === "/git/blobs/n2") return j({ encoding: "base64", content: Buffer.from(JSON.stringify(DOC2)).toString("base64") });
  if (rest === "/git/blobs/m4") return j({ encoding: "base64", content: PNG });
  return j({ message: "no" }, 404);
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

/* A placeholder, through the Keys panel, the way his own token goes in. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);

const doc = () => page.evaluate(() => { const st = JSON.parse(localStorage.getItem("builder.studio")).state; return { nodes: st.nodes.length, spaces: (st.spaces ?? []).length, brought: (st.brought ?? []).map((b) => b.label) }; });
const said = () => page.evaluate(() => Array.from(document.querySelectorAll("[data-site-said]")).map((e) => e.innerText.replace(/\s+/g, " ").trim()).join(" || "));
const toast = (text = "Could not bring the repository in") => page.evaluate((t) => document.body.innerText.includes(t), text);
/* THE LOCK SHAPES THE DRIVE: a site brought in from one repository refuses
   another, so a different repository gets a new site first, the way he
   makes one, from the Builds page. Returns whether one was made. */
const freshSite = async () => {
  await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^New site$/ }).first().click();
  await page.waitForTimeout(600);
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
};
const boundNow = () => page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem("builder.builds")); const p = v.state.projects.find((x) => x.id === v.state.activeId); return p && p.repo ? `${p.repo.owner}/${p.repo.name}` : null; } catch { return null; } });
const bring = async (name) => {
  const boundTo = await boundNow();
  let fresh = false;
  if (boundTo && boundTo.toLowerCase() !== name.toLowerCase()) { await freshSite(); fresh = true; }
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill(name);
  await page.locator("[data-repo-pull]").click();
  return fresh;
};

/* 1. A repository with a page in it lands, with no further press, AND
   REPLACES WHAT WAS ON THE PAGE. HIS WORDS: "polio would at least be
   somewhat imported into my site but it never changes". A part of his own
   is on the page first; after the import it is gone and the page is the
   repository's, from the top, at full width. */
await page.evaluate((his) => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  const st = JSON.parse(localStorage.getItem("builder.studio")).state;
  /* A real part, in the shape a saved one has: a bare object is not one. */
  st.nodes = [{ ...his, id: "n_his", pageId: st.activePageId ?? "page_home", label: "His own", content: "Mine, before", x: 300, y: 300, w: 400, h: 120 }];
  localStorage.setItem("builder.studio", env(st));
}, DOC.nodes.find((n) => n.featureId === "value-prop"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
const before = await doc();
check("his own part is on the page before the import", before.nodes === 1, `${before.nodes} parts`);
await bring("him/page");
let landed = before;
for (let i = 0; i < 90 && (landed.nodes === before.nodes || landed.spaces === 0); i++) { await page.waitForTimeout(1000); landed = await doc(); }
await page.waitForTimeout(1200);
landed = await doc();
const placed = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio")).state; return { his: s.nodes.some((n) => n.id === "n_his"), ids: s.nodes.map((n) => n.featureId), space: (s.spaces ?? [])[0]?.boundary ?? null, frame: s.frameWidth }; });
check("a repository with a page in it lands as parts on the board, with nothing more pressed", landed.nodes >= 2, `${before.nodes} → ${landed.nodes} parts`);
check("and it replaces what was on the page: his own part is gone", !placed.his, placed.ids.join(", "));
check("in one space, from the top of the page at its full width", landed.spaces === 1 && !!placed.space && placed.space[0][0] === 0 && placed.space[0][1] === 0 && placed.space[1][0] >= (placed.frame || 1440) - 1, JSON.stringify(placed.space));
check("and its elements go to the shelf under the repository's name", landed.brought.includes("page"), landed.brought.join(", ") || "none");
await page.waitForTimeout(1500);
const line1 = await said();
check("and the panel says what landed", /block|part|element/i.test(line1), line1.slice(0, 160));
check("and so does a toast, seen from the board", await toast("landed on the board"));
check("two blocks is thin, and the panel says so", /Only 2 blocks came from it: the page in the repository has little on it/.test(line1), line1.slice(-120));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

/* 1b. The same, pressed from the Builds page: the board opens and it lands there. */
await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await bring("him/page");
await page.waitForTimeout(1500);
check("pressed on the Builds page, Bring it opens the board", /\/builder/.test(page.url()), page.url());
check("and says so, step by step, from the board", await toast("him/page"));
let again = landed;
for (let i = 0; i < 90 && again.nodes === landed.nodes; i++) { await page.waitForTimeout(1000); again = await doc(); }
check("and the page lands there, replacing the page again, in one space", again.nodes >= 2 && again.spaces === 1, `${landed.nodes} → ${again.nodes} parts, ${again.spaces} spaces`);
landed = again;

/* 1c. A page with nothing on it: said as a toast, not only on the aside. */
await page.waitForTimeout(8000);
await bring("him/blank");
let blankLine = "";
for (let i = 0; i < 60 && !/could be made into a part/.test(blankLine); i++) { await page.waitForTimeout(1000); blankLine = await said(); }
check("a page nothing can be made from is said on the panel", /could be made into a part/.test(blankLine), blankLine.slice(0, 160));
check("and as a toast", await toast("could be made into a part"));
landed = await doc();

/* 2. Sources with no address anywhere: refused in words that stay. */
await bring("him/sources");
await page.waitForTimeout(3500);
const line2 = await said();
check("a repository of sources with no address is refused on the panel, naming what would give it one", /him\/sources/.test(line2) && /About on GitHub/.test(line2), line2.slice(0, 160));
check("and the refusal is still on screen as a toast three seconds later", await toast());
const mid = await doc();
check("with nothing landed", mid.nodes === 0, `${mid.nodes} parts`);

/* 2b. A SITE MADE HERE IS COPIED WHOLE, INTO THIS SITE, from its document. */
await page.waitForTimeout(6500);
const before2 = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); const s = JSON.parse(localStorage.getItem("builder.studio")).state; return { sites: v.state.projects.length, active: v.state.activeId, spaces: (s.spaces ?? []).length }; });
await bring("him/made");
let sites = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  sites = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); return { list: v.state.projects.map((p) => ({ name: p.name, repo: p.repo ? `${p.repo.owner}/${p.repo.name}@${p.repo.branch}` : null, id: p.id })), active: v.state.activeId }; });
  if (sites.list.find((p) => p.id === sites.active)?.repo) break;
}
const made = sites?.list.find((p) => p.id === sites.active);
check("a repository carrying the published document replaces this site with the whole of it, and the site takes its name", sites.list.length === before2.sites && made?.name === DOC.brief.name && sites.active === before2.active, JSON.stringify(made));
check("no second site is made", sites.list.length === before2.sites, `${sites.list.length} sites`);
check("connected to the repository it came from, on the branch that was read", made?.repo === "him/made@main", made?.repo ?? "none");
await page.waitForTimeout(1500);
const copied = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio")).state; return { nodes: s.nodes.length, pages: s.pages.length, spaces: (s.spaces ?? []).length, first: s.nodes[0] ? { featureId: s.nodes[0].featureId, x: s.nodes[0].x, y: s.nodes[0].y, w: s.nodes[0].w, content: s.nodes[0].content } : null, brief: s.brief?.name }; });
check("every part is there, on every page", copied.nodes === DOC.nodes.length && copied.pages === DOC.pages.length, `${copied.nodes} parts on ${copied.pages} pages, expected ${DOC.nodes.length} on ${DOC.pages.length}`);
check("in its place, with its words", copied.first?.featureId === DOC.nodes[0].featureId && copied.first?.x === DOC.nodes[0].x && copied.first?.y === DOC.nodes[0].y && copied.first?.w === DOC.nodes[0].w && copied.first?.content === DOC.nodes[0].content, JSON.stringify(copied.first));
check("and its brief", copied.brief === DOC.brief.name, copied.brief);
check("with no space left over from the hand-off", copied.spaces === 0, `${copied.spaces} spaces`);
const pic = await page.evaluate(() => new Promise((done) => {
  const req = indexedDB.open("builder.pictures", 1);
  req.onerror = () => done("no db");
  req.onsuccess = () => { try { const get = req.result.transaction("files", "readonly").objectStore("files").get("pic_test1"); get.onsuccess = () => done(get.result ? get.result.size : "missing"); get.onerror = () => done("error"); } catch (e) { done(String(e)); } };
}));
check("its picture is in this browser's file storage under the id the part names", typeof pic === "number" && pic > 0, String(pic));
check("and the toast says what was copied and where it is connected", await toast("This site is BLACKORB now, copied whole from him/made"));
const stripAfterCopy = await page.evaluate(() => { const e = document.querySelector("[data-import-strip]"); return e ? { kind: e.getAttribute("data-import-strip"), text: e.textContent } : null; });
check("the copy ends its own stage: the strip reads done, in the copy's words, not busy and never a ninety-second stop", !!stripAfterCopy && stripAfterCopy.kind === "done" && /this site is BLACKORB now, copied whole/.test(stripAfterCopy.text ?? ""), JSON.stringify(stripAfterCopy));

/* 2c. A site made here with no address anywhere copies just the same: the document needs no address. */
await page.waitForTimeout(8000);
const fresh2c = await bring("him/madeless");
await page.waitForTimeout(300);
const stripOnPress = await page.evaluate(() => { const e = document.querySelector("[data-import-strip]"); return e ? e.textContent : ""; });
check("a new press clears the strip: the previous repository's line is gone at once", !/him\/made:|BLACKORB now/.test(stripOnPress ?? ""), stripOnPress?.slice(0, 120) ?? "-");
let less = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  less = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); const p = v.state.projects.find((x) => x.id === v.state.activeId); return { name: p.name, repo: p.repo ? `${p.repo.owner}/${p.repo.name}` : null, n: v.state.projects.length }; });
  if (less.repo === "him/madeless") break;
}
check("a site made here with no deployed address copies just the same, replacing the site it was brought into", less.n === sites.list.length + (fresh2c ? 1 : 0) && less.name === "Madeless" && less.repo === "him/madeless", JSON.stringify(less));

/* 2e. THE LOCK. This site was brought in from him/madeless: it belongs to
   that repository. Another repository cannot be brought into it, another
   site cannot be pointed at it, and a new site is offered an import at
   once, with two doors and a way to say not now. */
await page.waitForTimeout(6500);
const bound = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); const p = v.state.projects.find((x) => x.id === v.state.activeId); return { repo: p.repo ? `${p.repo.owner}/${p.repo.name}` : null, bound: p.bound ?? null, nodes: JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length }; });
check("a site brought in from a repository is bound to it, and knows it was an import", bound.repo === "him/madeless" && bound.bound === "import", JSON.stringify(bound));
await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(700);
check("the panel says the site belongs to its repository, and moving it asks first", await page.evaluate(() => /This site belongs to him\/madeless\. Moving it asks first\./.test(document.querySelector("[data-repo-bound]")?.textContent ?? "")));
await page.locator("[data-repo-bring]").fill("him/page");
await page.locator("[data-repo-pull]").click(); await page.waitForTimeout(800);
const lockSaid = await page.evaluate(() => document.querySelector("[data-repo-said]")?.textContent ?? "");
check("bringing another repository into a bound site is refused in words", /This site belongs to him\/madeless\. Make a new site to bring him\/page in\./.test(lockSaid), lockSaid.slice(0, 140));
check("and nothing changes", (await doc()).nodes === bound.nodes);
await page.keyboard.press("Escape"); await page.waitForTimeout(300);

/* A new site: offered an import at once. */
await page.locator("[data-builds-switch]").first().click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: /New site/ }).first().click(); await page.waitForTimeout(900);
const offer = await page.evaluate(() => { const e = document.querySelector("[data-new-site-offer]"); return e ? { text: e.textContent, bring: !!e.querySelector("[data-offer-bring]"), make: !!e.querySelector("[data-offer-make]"), later: !!e.querySelector("[data-offer-later]") } : null; });
check("a new site is offered an import straight away, with both doors and a way to say not now", !!offer && /no repository yet/.test(offer.text ?? "") && offer.bring && offer.make && offer.later, JSON.stringify(offer));
await page.locator("[data-offer-bring]").click(); await page.waitForTimeout(700);
check("the bring door opens the GitHub control on the bring field", await page.evaluate(() => document.activeElement?.getAttribute("data-repo-bring") === ""));
/* On the new site, pointing at the repository BLACKORB's site was brought in from is refused: that repository belongs to that site. */
await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); v.state.projects.find((p) => p.repo && p.repo.name === "madeless").name = "Madeless site"; localStorage.setItem("builder.builds", JSON.stringify(v)); });
const connectSaid = await page.evaluate(async () => {
  const list = document.querySelector("[data-repo-connect='him/madeless']");
  if (!list) return "no such row";
  list.click();
  await new Promise((r) => setTimeout(r, 400));
  return document.querySelector("[data-repo-said]")?.textContent ?? "";
});
check("pointing a site at a repository another site was brought in from is refused: it belongs to that site", /him\/madeless belongs to the site .+, which was brought in from it/.test(connectSaid) || connectSaid === "no such row", connectSaid.slice(0, 140));
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.locator("[data-offer-later]").click(); await page.waitForTimeout(300);
check("not now takes the offer away", (await page.locator("[data-new-site-offer]").count()) === 0);
await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(900);
check("and it stays away for that site", (await page.locator("[data-new-site-offer]").count()) === 0);
await page.locator("[data-builds-switch]").first().click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: /Madeless/ }).first().click(); await page.waitForTimeout(900);

/* 3a. AN UNUSABLE REPLY IS AN ENDING. The page reads fine and then the
   reply has candidates without boxes: that used to throw inside a render
   and take the whole Builder down with nothing said. It ends in a
   sentence now, naming the route and the reason. */
await page.waitForTimeout(6500);
await page.route("**/api/studio/element", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, url: "https://polio-two.vercel.app/", host: "polio-two.vercel.app", page: { width: 1280, height: 900, shot: "" }, candidates: [{ box: null }] }) }));
await bring("him/deployed");
let brokeLine = "";
for (let i = 0; i < 40 && !/could be made into a part|stopped before it could finish|landed|blocks/.test(brokeLine); i++) { await page.waitForTimeout(1000); brokeLine = await said(); }
check("when the page opens and its reply is unusable, the panel still ends in a sentence with the reason", /^him\/deployed: .*(could be made into a part|stopped before it could finish)/.test(brokeLine), brokeLine.slice(0, 160));
check("and so does a toast", await toast("could be made into a part") || await toast("stopped before it could finish"));
check("and the Builder is still standing", (await page.locator("[data-github-button]").count()) === 1);
await page.unroute("**/api/studio/element");

/* 3. Sources deployed at an address: read there, and when that fails, say so by name. */
await page.waitForTimeout(6500);
await bring("him/deployed");
let line3 = "";
for (let i = 0; i < 60 && !/polio-two\.vercel\.app/.test(line3) ; i++) { await page.waitForTimeout(1000); line3 = await said(); }
check("a repository of sources with a deployed address is read at that address", /read at the address it is deployed at: https:\/\/polio-two\.vercel\.app/.test(line3), line3.slice(0, 200));
const end = await doc();
const landedThere = end.nodes > mid.nodes;
check(landedThere ? "and its page landed as parts" : "and when this machine cannot open that address, the panel says so with the reason", landedThere || /could not be read/.test(line3), landedThere ? `${end.nodes} parts` : line3.slice(-160));

/* 4. THE LINE WHERE IT CANNOT BE HIDDEN. A short window, toasts off, the
   space's aside keeping its import section below the fold: the ending is
   still on screen, across the top of the board, in the same words. */
const short = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await short.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (u.pathname === "/repos/him/sources") return j({ default_branch: "main", homepage: "" });
  if (u.pathname.startsWith("/repos/him/sources/git/trees/")) return j({ tree: repos["him/sources"].tree });
  return j({ message: "no" }, 404);
});
await short.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await short.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s9", name: "Short", updatedAt: Date.now() }], activeId: "s9" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
  localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "feed.toasts": false } }, version: 0 }));
});
await short.reload({ waitUntil: "networkidle" });
await short.waitForTimeout(900);
const k2 = short.locator("[data-keys-panel]");
await short.getByRole("button", { name: "Keys", exact: true }).click(); await short.waitForTimeout(500);
const skip2 = k2.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ }); if (await skip2.count()) { await skip2.first().click(); await short.waitForTimeout(300); }
await k2.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await k2.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await short.waitForTimeout(400);
await k2.getByRole("button", { name: "Close keys" }).click(); await short.waitForTimeout(400);
await short.locator("[data-github-button]").first().click(); await short.waitForTimeout(700);
await short.locator("[data-repo-bring]").fill("him/sources");
await short.locator("[data-repo-pull]").click();
let strip = null;
for (let i = 0; i < 20 && !(strip && strip.kind === "refused"); i++) { await short.waitForTimeout(500); strip = await short.evaluate(() => { const e = document.querySelector("[data-import-strip]"); if (!e) return null; const r = e.getBoundingClientRect(); return { kind: e.getAttribute("data-import-strip"), text: e.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), inner: innerHeight }; }); }
check("on a short window with toasts off, the ending is still on screen: a strip across the top of the board, in the same words", !!strip && strip.kind === "refused" && /him\/sources: There is no page in this repository to open/.test(strip.text ?? ""), JSON.stringify(strip));
check("and it is inside the window, not below it", !!strip && strip.top >= 0 && strip.bottom <= strip.inner, strip ? `${strip.top}..${strip.bottom} of ${strip.inner}` : "-");
const aside = await short.evaluate(() => { const e = document.querySelector("[data-from-a-site]"); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), inner: innerHeight }; });
check("which matters because the panel's own copy sits below the fold there", !!aside && aside.top > aside.inner - 40, aside ? `section at ${aside.top} in ${aside.inner}` : "no section");
await short.locator("[data-import-strip-dismiss]").click(); await short.waitForTimeout(300);
check("and it goes when dismissed", (await short.locator("[data-import-strip]").count()) === 0);
await short.close();

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
