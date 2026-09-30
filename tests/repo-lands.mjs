/**
 * Connecting a repository, and its website landing on the board 1:1.
 *
 * His words: "the feature of connecting an existing repo website and the
 * subsequent website popping into my design board 1:1, and with a new
 * category specifically for the elements this repo imports".
 *
 * 1:1 here means: every block of the page arrives as a real, editable part
 * of this library at the position, size, words, colours and type the page
 * actually had — measured in a browser, never described to a model. So
 * this checks the page's own words are on the board, and that the parts
 * sit in the proportion the page had them in, not that some boxes appeared.
 *
 * GitHub is stood in for **in the browser**, which is the honest place for
 * it: that is exactly where the app talks to GitHub, with his own token,
 * and our server never sees either. Everything past the fetch is real —
 * the zip is written by the app, opened by the app's own route, measured
 * by a real browser, and turned into parts by `recreate.ts`.
 *
 *     npx next start -p 3013
 *     node tests/repo-lands.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* A repository, stood in for where the app actually asks: the browser  */
/* ------------------------------------------------------------------ */

/* Words nothing else in this app says, so finding them on the board is
   proof the page's own text travelled and not a plausible default. */
const WORDS = {
  mark: "Harbourline",
  nav: "Moorings",
  head: "Every berth accounted for",
  foot: "Built beside the water",
};
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Harbourline</title>
<link rel="stylesheet" href="assets/site.css"></head>
<body>
  <header class="bar"><span class="mark">${WORDS.mark}</span><nav><a href="#a">${WORDS.nav}</a><a href="#b">Tides</a><a href="#c">Log</a></nav></header>
  <section class="hero"><h1>${WORDS.head}</h1><p>A harbour that tells you what it is holding.</p></section>
  <footer class="foot"><span>${WORDS.foot}</span></footer>
</body></html>`;
const CSS = `
* { box-sizing: border-box; margin: 0; }
body { background: #0b0d12; color: #e8ecf2; font-family: Georgia, serif; }
.bar { display: flex; align-items: center; gap: 24px; height: 72px; padding: 0 32px; background: #11141b; border-bottom: 1px solid #222; }
.mark { font-weight: 800; font-size: 20px; }
.bar nav { display: flex; gap: 18px; }
.bar a { color: #9fb0c6; text-decoration: none; }
.hero { padding: 96px 32px; min-height: 420px; background: #0b0d12; }
.hero h1 { font-size: 56px; line-height: 1.05; max-width: 820px; }
.hero p { margin-top: 20px; color: #9fb0c6; font-size: 20px; }
.foot { height: 120px; display: flex; align-items: center; padding: 0 32px; background: #11141b; border-top: 1px solid #222; color: #9fb0c6; }
`;
const README = "# Harbourline\n\nA harbour that tells you what it is holding.\n";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const BLOBS = {
  sha_page: b64(PAGE),
  sha_css: b64(CSS),
  sha_readme: b64(README),
};
const TREE = {
  tree: [
    { path: "index.html", type: "blob", sha: "sha_page", size: PAGE.length },
    { path: "assets/site.css", type: "blob", sha: "sha_css", size: CSS.length },
    { path: "README.md", type: "blob", sha: "sha_readme", size: README.length },
    { path: "node_modules/x/index.html", type: "blob", sha: "sha_readme", size: 10 },
    { path: "src", type: "tree", sha: "sha_dir" },
  ],
};
const asked = [];

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.route("https://api.github.com/**", async (route) => {
  const url = new URL(route.request().url());
  asked.push(url.pathname);
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (/^\/repos\/[^/]+\/[^/]+$/.test(url.pathname)) return json({ default_branch: "main", homepage: "" });
  if (url.pathname.includes("/git/trees/")) return json(TREE);
  const blob = /\/git\/blobs\/(.+)$/.exec(url.pathname)?.[1];
  if (blob && BLOBS[blob]) return json({ content: BLOBS[blob], encoding: "base64" });
  return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "no" }) });
});

const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/* His token, put in the way a person puts one in. */
for (let go = 0; go < 3; go++) {
  const panel = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await panel.count()) && (await panel.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
await keys.locator('input[type="password"]').nth(2).fill("github_pat_NOTATOKEN_repo_lands_00");
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(700);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* A space to bring it into                                             */
/* ------------------------------------------------------------------ */

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const B = { x: 280, y: 90, w: 620, h: 300 };
const at = { x: PANE.x + B.x, y: PANE.y + B.y, w: B.w, h: B.h };
const pts = [[at.x, at.y], [at.x + at.w, at.y], [at.x + at.w, at.y + at.h], [at.x, at.y + at.h], [at.x, at.y]];
await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2);
await page.keyboard.press("s");
await page.waitForTimeout(300);
await page.mouse.move(pts[0][0], pts[0][1]);
await page.mouse.down();
for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(12); }
await page.mouse.up();
await page.waitForTimeout(450);
await page.keyboard.press("v");
await page.waitForTimeout(1900);
/* A space just drawn opens picked, with its panel up; the key in its middle is only drawn for an unpicked empty space, so it is pressed only when it is there. */
if (!(await page.locator("[data-space-panel]").count()) && (await page.locator("[data-space-fill]").count())) await page.locator("[data-space-fill]").first().click({ force: true });
await page.waitForTimeout(400);
const panel = page.locator("[data-space-panel]").first();
check("the space's panel offers a repository", (await panel.locator("[data-repo-name]").count()) === 1 && (await panel.locator("[data-repo-read]").count()) === 1);

/* ------------------------------------------------------------------ */
/* Connect it                                                           */
/* ------------------------------------------------------------------ */

await panel.locator("[data-repo-name]").fill("harbourworks/harbourline");
await panel.locator("[data-repo-read]").click();
/* A repository's page lands whole on its own now (tests/repo-import.mjs: the
   automatic landing never passes through the picking stage); a page that
   still offers the choice is taken whole below. */
const landedWhole = () => panel.locator("[data-site-said]").innerText().then((t) => /real parts of the library|copied whole|landed/.test(t)).catch(() => false);
for (let i = 0; i < 180 && !(await panel.locator("[data-site-take-all]").count()) && !(await landedWhole()); i++) await page.waitForTimeout(500);
const offered = (await panel.locator("[data-site-take-all]").count()) > 0;
const opened = offered || (await landedWhole());
check("the page in the repository opens", opened, (await panel.locator("[data-site-said]").innerText().catch(() => "")).slice(0, 160));
check("its files were fetched from GitHub by the browser, not by our server", asked.some((p) => p.includes("/git/trees/")) && asked.filter((p) => p.includes("/git/blobs/")).length >= 2, asked.join(" "));
check("and the readme and node_modules were left where they were", asked.filter((p) => p.includes("/git/blobs/")).length === 2, `${asked.filter((p) => p.includes("/git/blobs/")).length} files fetched`);

if (offered) {
  await panel.locator("[data-site-take-all]").click();
  await page.waitForTimeout(9000);
} else if (opened) await page.waitForTimeout(3000);

const st = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const nodes = st.nodes ?? [];
check("the website is on the board, as parts", nodes.length >= 3, `${nodes.length} parts`);
const words = nodes.map((n) => `${n.label} ${n.content}`).join(" | ");
for (const [what, w] of Object.entries(WORDS)) {
  check(`  — the page's own ${what} travelled`, words.includes(w), words.includes(w) ? w : `"${w}" is nowhere on the board`);
}
/* 1:1 is about the arrangement as much as the words: the bar is short and
   across the top, the hero is the tall one, the foot is at the bottom. */
const byY = [...nodes].sort((a, b) => a.y - b.y);
check("in the order the page had them, top to bottom", byY[0].h < byY[1].h && byY[byY.length - 1].y > byY[0].y,
  byY.map((n) => `${n.label} ${n.w}×${n.h}@${n.y}`).join("  "));

/* ------------------------------------------------------------------ */
/* A category of its own                                                */
/* ------------------------------------------------------------------ */

check("the repository is remembered on the document", (st.brought ?? []).length === 1, JSON.stringify(st.brought ?? []));
const kept = st.broughtParts ?? [];
check("and its elements with it, one per block", kept.length === nodes.length, `${kept.length} kept, ${nodes.length} on the board`);
check("each naming the real library part that draws it", kept.every((p) => p.basedOn && p.basedOn.length > 2), kept.map((p) => p.basedOn).join(", "));
check("the panel lists the repository, with a way to let it go", (await panel.locator("[data-brought-repo]").count()) === 1 && (await panel.locator("[data-brought-drop]").count()) === 1);

/* The shelf: a category named after the repository, holding its elements. */
const shelfOpen = async () => {
  const drawer = page.locator("[data-shelf]").first();
  if (await drawer.isVisible().catch(() => false)) return true;
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(600);
  return await page.locator("[data-shelf]").first().isVisible().catch(() => false);
};
check("the shelf is open to look in", await shelfOpen());

/* Searching is the flat view over every category, so it is the honest way
   to ask whether the repository's elements are in the library at all. */
const search = page.locator("[data-parts-search] input").first();
check("the shelf has a search box", (await search.count()) > 0);
if (await search.count()) {
  await search.fill("Harbourline");
  await page.waitForTimeout(800);
}
const cards = await page.evaluate(() =>
  [...document.querySelectorAll("[data-shelf] [data-ctx='studio-palette']")].map((e) => e.getAttribute("data-ctx-id")),
);
check("the repository's elements are in the library, found by its name", cards.some((c) => (c ?? "").startsWith("repo:")), cards.slice(0, 8).join(", ") || "nothing found");
check("and they are the blocks the page was made of, not the library's own", cards.filter((c) => (c ?? "").startsWith("repo:")).length === kept.length, `${cards.filter((c) => (c ?? "").startsWith("repo:")).length} of ${kept.length}`);

/* And one of them, dropped, is an ordinary part wearing the page's words. */
const drop = page.locator("[data-shelf] [data-ctx='studio-palette']").filter({ hasNot: page.locator("nothing") }).first();
const wasThere = (await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).length));
const repoCard = page.locator(`[data-shelf] [data-ctx-id^="repo:"]`).first();
if (await repoCard.count()) {
  await repoCard.click({ force: true });
  await page.waitForTimeout(700);
  /* A press on a card opens its detail card and adds nothing (tests/shelf-cards.mjs); Add to page there puts it down. */
  const addIt = page.locator("[data-part-detail] [data-add-to-page]").first();
  if (await addIt.count()) { await addIt.click(); await page.waitForTimeout(900); }
}
const afterDrop = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const added = (afterDrop.nodes ?? []).slice(wasThere);
check("dropping one puts down an ordinary part of the library", added.length === 1 && !!added[0] && !added[0].featureId.startsWith("repo:"), added.map((n) => n.featureId).join(", ") || "nothing landed");
check("wearing the words it was measured with", added.some((n) => `${n.label} ${n.content}`.includes(WORDS.mark) || `${n.label} ${n.content}`.includes(WORDS.head) || `${n.label} ${n.content}`.includes(WORDS.foot)),
  added.map((n) => `${n.label}: ${String(n.content).slice(0, 40)}`).join(" | ") || "nothing");
void drop;

/* Letting it go takes the elements out of the shelf and leaves the board.
   Dropping a part picked it, which swapped the space's panel for the
   part's, so the space is picked again first — the panel is the space's. */
const before = (afterDrop.nodes ?? []).length;
/* The surface is locked once the page has been taken, so its fill is gone;
   its grip is the handle that is always there. */
await page.locator("[data-space-grip]").first().click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
const back = page.locator("[data-space-panel]").first();
check("the space's panel comes back, still listing the repository", (await back.locator("[data-brought-drop]").count()) === 1);
await back.locator("[data-brought-drop]").first().click().catch(() => {});
await page.waitForTimeout(900);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
check("letting the repository go empties its category", (after.brought ?? []).length === 0 && (after.broughtParts ?? []).length === 0);
check("and leaves what is already on the board alone", (after.nodes ?? []).length === before, `${(after.nodes ?? []).length} of ${before} still there`);

await page.screenshot({ path: ".screenshots/repo-lands.png" });
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/repo-lands.png");
process.exit(bad ? 1 : 0);
