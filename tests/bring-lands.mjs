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
 *   · one of sources with no address anywhere: the refusal stays on screen;
 *   · one of sources deployed at an address this machine cannot open: the
 *     refusal names the address and why.
 *
 * The token held is a placeholder the stub never reads, saved through the
 * Keys panel exactly as his is; nothing leaves the machine.
 *
 *   node tests/bring-lands.mjs [url]
 */
import { existsSync } from "node:fs";
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
const repos = {
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

/* 1. A repository with a page in it lands, with no further press. */
const before = await doc();
await bring("him/page");
let landed = before;
for (let i = 0; i < 90 && landed.nodes === before.nodes; i++) { await page.waitForTimeout(1000); landed = await doc(); }
check("a repository with a page in it lands as parts on the board, with nothing more pressed", landed.nodes > before.nodes, `${before.nodes} → ${landed.nodes} parts`);
check("in a space of its own", landed.spaces === before.spaces + 1, `${landed.spaces} spaces`);
check("and its elements go to the shelf under the repository's name", landed.brought.includes("page"), landed.brought.join(", ") || "none");
await page.waitForTimeout(1500);
const line1 = await said();
check("and the panel says what landed", /block|part|element/i.test(line1), line1.slice(0, 160));
check("and so does a toast, seen from the board", await toast("landed on the board"));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

/* 1b. The same, pressed from the Builds page: the board opens and it lands there. */
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
check("with nothing landed", mid.nodes === landed.nodes && mid.spaces === landed.spaces + 1);

/* 3. Sources deployed at an address: read there, and when that fails, say so by name. */
await page.waitForTimeout(6500);
await bring("him/deployed");
let line3 = "";
for (let i = 0; i < 60 && !/polio-two\.vercel\.app/.test(line3) ; i++) { await page.waitForTimeout(1000); line3 = await said(); }
check("a repository of sources with a deployed address is read at that address", /read at the address it is deployed at: https:\/\/polio-two\.vercel\.app/.test(line3), line3.slice(0, 200));
const end = await doc();
const landedThere = end.nodes > mid.nodes;
check(landedThere ? "and its page landed as parts" : "and when this machine cannot open that address, the panel says so with the reason", landedThere || /could not be read/.test(line3), landedThere ? `${end.nodes} parts` : line3.slice(-160));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
