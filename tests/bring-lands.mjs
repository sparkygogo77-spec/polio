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
/* The shipped document is empty now; the sample it used to hold, BLACKORB, is kept beside the suite as its fixture. */
const DOC = JSON.parse(readFileSync("tests/fixtures/blackorb.document.json", "utf8"));
const EMPTY = { pages: [], nodes: [] };
DOC.nodes.push({ ...DOC.nodes[0], id: "n_pic_test", featureId: "orb-image", content: "", picture: { id: "pic_test1", path: "assets/pictures/pic_test1.png", type: "image/png", w: 1, h: 1, bytes: 70, alt: "", from: "upload" } });
const DOC2 = { ...DOC, brief: { ...DOC.brief, name: "Madeless" }, nodes: DOC.nodes.slice(0, 3), publishedTo: { repo: "someone/else", branch: "main", at: "2026-09-21T00:00:00Z" } };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const repos = {
  /* A site made here, deployed: copied whole from its document, pictures and all. */
  "him/made": { homepage: "https://polio-two.vercel.app", tree: [{ path: "package.json", type: "blob", sha: "m1", size: 10 }, { path: "site/document.json", type: "blob", sha: "m2", size: 1000 }, { path: "assets/pictures/pic_test1.png", type: "blob", sha: "m4", size: 70 }, { path: "src/app/page.tsx", type: "blob", sha: "m3", size: 100 }] },
  /* A site made here that says nowhere it is deployed: the document needs no address. */
  "him/madeless": { homepage: "", tree: [{ path: "package.json", type: "blob", sha: "n1", size: 10 }, { path: "site/document.json", type: "blob", sha: "n2", size: 1000 }] },
  /* A page in its files AND a deployed address: the address is tried first, and the files are the fallback, said as such. */
  "him/pagedeployed": { homepage: "https://polio-two.vercel.app", tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }] },
  /* A Builder itself, with the empty document a fresh one ships: nothing published, and said so. */
  "him/builder": { homepage: "https://polio-two.vercel.app", tree: [{ path: "package.json", type: "blob", sha: "u1", size: 10 }, { path: "site/document.json", type: "blob", sha: "u2", size: 30 }, { path: "src/features/studio/published.ts", type: "blob", sha: "u3", size: 100 }] },
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
  if (rest === "/git/blobs/u2") return j({ encoding: "base64", content: Buffer.from(JSON.stringify(EMPTY)).toString("base64") });
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
const bring = async (name) => {
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill(name);
  await page.locator("[data-repo-pull]").click();
};

/* 1. A repository with a page in it lands, with no further press: CARRIED EXACTLY, the default. */
const before = await doc();
await bring("him/page");
let landed = before;
for (let i = 0; i < 90 && landed.nodes === before.nodes; i++) { await page.waitForTimeout(1000); landed = await doc(); }
check("a repository with a page in it lands on the board, with nothing more pressed", landed.nodes > before.nodes, `${before.nodes} → ${landed.nodes} parts`);
check("in a space of its own", landed.spaces === before.spaces + 1, `${landed.spaces} spaces`);
await page.waitForTimeout(1500);
const carriedNodes = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.filter((n) => n.code && n.code.kind === "carried").map((n) => ({ w: n.w, h: n.h, own: n.code.carried && n.code.carried.w, html: n.code.html.length, hasWords: /Blackorb/.test(n.code.html) || /Say hello/.test(n.code.html), styled: /style="/.test(n.code.html), from: n.code.carried && n.code.carried.from })));
check("each block is carried as itself: its own markup with the page's styles inlined, in a part that knows its size on the page", carriedNodes.length === 2 && carriedNodes.every((n) => n.styled && n.own > 0 && n.html > 200) && carriedNodes.some((n) => n.hasWords), JSON.stringify(carriedNodes));
const line1 = await said();
check("the panel names the route first: from its files", /^From its files, index\.html:/.test(line1.replace(/^him\/page@main: /, "")), line1.slice(0, 120));
check("and says what came in exactly and what could not", /2 blocks carried exactly: markup and styles as the page had them/.test(line1) && /Not carried: behaviour: no scripts ran; anything past the 1280×/.test(line1), line1.slice(0, 260));
check("and so does a toast, seen from the board", await toast("carried onto the board"));
check("two blocks is thin, and the panel says so", /Only 2 blocks came from it: the page in the repository has little on it/.test(line1), line1.slice(-120));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

/* 1a. His other choice: the same page remade from library parts. */
await page.waitForTimeout(8000);
await page.locator("[data-import-parts]").first().click();
await page.waitForTimeout(300);
check("library parts can be chosen on the panel, and the choice is remembered", (await page.evaluate(() => localStorage.getItem("builder.import.how"))) === "parts");
const beforeParts = await doc();
await bring("him/page");
let partsLanded = beforeParts;
for (let i = 0; i < 90 && partsLanded.nodes === beforeParts.nodes; i++) { await page.waitForTimeout(1000); partsLanded = await doc(); }
await page.waitForTimeout(1200);
const partsLine = await said();
check("chosen, the page comes in as library parts instead, said as such, with its elements on the shelf", partsLanded.nodes > beforeParts.nodes && /real parts of the library|band of words/.test(partsLine) && partsLanded.brought.includes("page"), partsLine.slice(0, 160));
await page.locator("[data-import-exact]").first().click();
await page.waitForTimeout(300);

/* 1d. A page in its files and a deployed address: the address first, then the files, said as such. */
await page.waitForTimeout(6500);
const beforeDeployedFiles = await doc();
await bring("him/pagedeployed");
let viaFiles = beforeDeployedFiles;
for (let i = 0; i < 90 && viaFiles.nodes === beforeDeployedFiles.nodes; i++) { await page.waitForTimeout(1000); viaFiles = await doc(); }
await page.waitForTimeout(1200);
const fallbackLine = await said();
check("with an address that cannot be read and a page in the files, the files are read, and the line says the address failed first", viaFiles.nodes > beforeDeployedFiles.nodes && /Its address could not be read \(.+\), so from its files, index\.html:/.test(fallbackLine) && /carried exactly/.test(fallbackLine), fallbackLine.slice(0, 220));

/* 1b. The same, pressed from the Builds page: the board opens and it lands there. */
landed = await doc();
await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await bring("him/page");
await page.waitForTimeout(1500);
check("pressed on the Builds page, Bring it opens the board", /\/builder/.test(page.url()), page.url());
check("and says so", await toast("Opening the board to bring him/page in") || await toast("Reading him/page"));
let again = landed;
for (let i = 0; i < 90 && again.nodes === landed.nodes; i++) { await page.waitForTimeout(1000); again = await doc(); }
check("and the page lands there, in a space of its own", again.nodes > landed.nodes && again.spaces === landed.spaces + 1, `${landed.nodes} → ${again.nodes} parts, ${again.spaces} spaces`);
landed = again;

/* 1c. A page with nothing on it: said as a toast, not only on the aside. */
await page.waitForTimeout(8000);
await bring("him/blank");
let blankLine = "";
for (let i = 0; i < 60 && !/could be made into a (part|block)/.test(blankLine); i++) { await page.waitForTimeout(1000); blankLine = await said(); }
check("a page nothing can be made from is said on the panel, with its route named", /^him\/blank@main: From its files, index\.html: nothing on the page could be made into a block/.test(blankLine), blankLine.slice(0, 160));
check("and as a toast", await toast("could be made into a block"));
landed = await doc();

/* 2. Sources with no address anywhere: refused in words that stay. */
await bring("him/sources");
await page.waitForTimeout(3500);
const line2 = await said();
check("a repository of sources with no address is refused on the panel, naming what would give it one", /him\/sources/.test(line2) && /About on GitHub/.test(line2), line2.slice(0, 160));
check("and the refusal is still on screen as a toast three seconds later", await toast());
const mid = await doc();
check("with nothing landed", mid.nodes === landed.nodes && mid.spaces === landed.spaces + 1);

/* 2b. A SITE MADE HERE IS COPIED WHOLE, as a new site, from its document. */
await page.waitForTimeout(6500);
const before2 = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); const s = JSON.parse(localStorage.getItem("builder.studio")).state; return { sites: v.state.projects.length, active: v.state.activeId, spaces: (s.spaces ?? []).length }; });
await bring("him/made");
let sites = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  sites = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); return { list: v.state.projects.map((p) => ({ name: p.name, repo: p.repo ? `${p.repo.owner}/${p.repo.name}@${p.repo.branch}` : null, id: p.id })), active: v.state.activeId }; });
  if (sites.list.length > before2.sites) break;
}
const made = sites?.list[0];
check("a repository carrying the published document becomes a new site in the switcher, named from its brief", sites.list.length === before2.sites + 1 && made?.name === DOC.brief.name, JSON.stringify(made));
check("and the Builder is on it", sites.active === made?.id);
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
check("and the toast says what was copied and where it is connected", await toast("is a new site now, copied whole from him/made"));
check("a document sitting alone, without the blueprint a publish writes, is named as the Builder's own sample and copied anyway", await toast("the Builder's own sample rather than something published there. Copied anyway"));
const old = await page.evaluate((id) => { const v = JSON.parse(localStorage.getItem(`builder.doc:${id}`) || "null"); return v ? (v.state.spaces ?? []).length : null; }, before2.active);
check("the site he was on keeps its board as it was, without the space made for the hand-off", old === before2.spaces, `${old} spaces, was ${before2.spaces}`);

/* 2c. A site made here with no address anywhere copies just the same: the document needs no address. */
await page.waitForTimeout(8000);
await bring("him/madeless");
let less = null;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1000);
  less = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem("builder.builds")); const p = v.state.projects[0]; return { name: p.name, repo: p.repo ? `${p.repo.owner}/${p.repo.name}` : null, n: v.state.projects.length }; });
  if (less.n > sites.list.length) break;
}
check("a site made here with no deployed address copies just the same", less.n === sites.list.length + 1 && less.name === "Madeless" && less.repo === "him/madeless", JSON.stringify(less));
check("and a document stamped as published elsewhere says so", await toast("It says it was published to someone/else, not this repository"));

/* 2d. A Builder with nothing published: said, not read at an address that would show the tool's own front. */
await page.waitForTimeout(8000);
const beforeBuilder = await doc();
await bring("him/builder");
let builderLine = "";
for (let i = 0; i < 40 && !/nothing published|could not be read|carried/.test(builderLine); i++) { await page.waitForTimeout(1000); builderLine = await said(); }
check("a Builder with an empty document is refused in words: nothing published into it yet", /him\/builder is a Builder with nothing published into it yet\. Publish a site to it first, or bring in the address of a page\./.test(builderLine), builderLine.slice(0, 200));
check("and its address is never read", !/From its address|polio-two/.test(builderLine));
check("with nothing landed", (await doc()).nodes === beforeBuilder.nodes);

/* 3. Sources deployed at an address: read there, and when that fails, say so by name. */
await page.waitForTimeout(6500);
await bring("him/deployed");
let line3 = "";
for (let i = 0; i < 60 && !/could not be read|landed|carried/.test(line3) ; i++) { await page.waitForTimeout(1000); line3 = await said(); }
check("a repository of sources with a deployed address is read at that address, and the route is named", /From its address, https:\/\/polio-two\.vercel\.app\/?:/.test(line3), line3.slice(0, 200));
const end = await doc();
const landedThere = end.nodes > mid.nodes;
check(landedThere ? "and its page landed as parts" : "and when this machine cannot open that address, the panel says so with the reason", landedThere || /could not be read/.test(line3), landedThere ? `${end.nodes} parts` : line3.slice(-160));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
