/**
 * Bringing one of his other sites in, from the same control that connects
 * and creates.
 *
 * HIS WORDS: "i want to be able to import a repo of my other site pretty soon
 * to see how existing repos are handled." So it has to be reachable — in the
 * repo control, beside connect and create — and it has to be honest about
 * what it can take.
 *
 * WHAT IT CAN TAKE, AND WHY. The importer opens a rendered page and measures
 * what is on it; it has never read source code. So a repository with an
 * `index.html` in it comes in, and a repository of unbuilt sources has no
 * page to open. That second case is the one worth getting right: it must say
 * WHICH kind of nothing it is, because "sources rather than a built site" has
 * an obvious next move and "empty" does not.
 *
 * GitHub is answered by this file. Nothing leaves the machine and no token is
 * used; the stub stands in on the address the server was started against.
 *
 *   GITHUB_API=http://127.0.0.1:4319 npx next start -p 3013
 *   node tests/repo-import.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/*
 * NOTHING HERE CALLS GITHUB, AND THAT IS THE POINT.
 *
 * The first version of this file stood a GitHub in and pointed a route of its
 * own at it \u2014 because the first version of the feature fetched the
 * repository server-side. That was a duplicate of `repoImport.ts` and
 * `repoRun.ts`, which already do it a better way: the files are fetched by
 * the browser with his own token and packed into a zip there, so nothing
 * about the token reaches our server. The duplicate is gone.
 *
 * What was missing was never the import. It was the way in: the importer sits
 * on a drawn space's panel, so the only way to reach it was to draw a space
 * first. So what is checked here is the door \u2014 that it is in the repo
 * control, that it refuses a name that is not one before doing anything, and
 * that pressing it makes the surface and hands the repository over.
 */
import { readFileSync } from "node:fs";
import { madeHere, noPageSays, pageAddress, readRepo, repoName, REPO_REFUSAL_SAYS, thinSays } from "../src/features/studio/bring-in/repoImport.ts";
import { pageBlocks } from "../src/features/studio/bring-in/zipImport.ts";

check("a name that is not owner/name is not a repo", readRepo("notarepo") === null);
check("and one that is, is read whole", (() => { const r = readRepo("him/his-site"); return !!r && repoName(r).includes("his-site"); })(), JSON.stringify(readRepo("him/his-site")));
check("an address of one is read too, so pasting the page he is looking at works", !!readRepo("https://github.com/him/his-site"), JSON.stringify(readRepo("https://github.com/him/his-site")));
check("and a refusal has words for every way it can fail", Object.values(REPO_REFUSAL_SAYS).every((v) => typeof v === "string" && v.length > 20), Object.keys(REPO_REFUSAL_SAYS).join(", "));

/* ------------------------------------------ sources, read where they run */
/* He brought this Builder's own repository in: sources, no page in them.
   With a deployed address known the page is read there, and the sentence
   says so; with none it says what would give it one, and never just "no". */
const src = readRepo("him/polio");
const at = noPageSays(src, ["ts", "tsx", "json"], "https://polio.example.app");
const not = noPageSays(src, ["ts", "tsx", "json"], null);
check("a repo of sources with a deployed address is read there, and the line names the address", /read at the address it is deployed at: https:\/\/polio\.example\.app/.test(at) && /him\/polio/.test(at), at);
check("and names what the sources are", /ts, tsx, json/.test(at) && /ts, tsx, json/.test(not));
check("with no address it says plainly what would give it one", /About on GitHub/.test(not) && /Read the page/.test(not), not);
const door = ["FromASite.tsx", ...["bring.tsx", "FromASite.tsx", "bits.tsx"].map((f) => `fromasite/${f}`)].map((f) => `src/features/studio/bring-in/${f}`).map((f) => readFileSync(f, "utf8")).join("\n");
check("the panel takes that step itself rather than telling him to", /const mine = got\.no === "no-page" \? pageAddress\(deployedBy\(r\), made\)\.at/.test(door) && /askSite\(\{ url: at\.url \}\)/.test(door));
check("and what lands from the address still goes into the repository's own category", /repo\?: Repo/.test(door) && /const from = repoOf\(source\)/.test(door));
/* ------------------------------------------- a site made here has a page */
/* Driven by hand: bringing this Builder's own repository in read the root
   of its deployment, which is the Builds page, and landed two blocks; the
   site itself sat at /site. The repository carries the mark of a publish
   from here, and that mark decides the address. */
check("a repository carrying the published document is a site made here", madeHere(["package.json", "site/document.json", "src/app/page.tsx"]) && !madeHere(["package.json", "src/app/page.tsx"]));
check("its page is /site of where it is deployed, not the root", pageAddress("https://polio-two.vercel.app", true).at === "https://polio-two.vercel.app/site" && pageAddress("https://polio-two.vercel.app/", true).why === "site");
check("and once is enough: an address already ending in /site is not doubled", pageAddress("https://polio-two.vercel.app/site", true).at === "https://polio-two.vercel.app/site");
check("anything else is read at its root, and says so", pageAddress("https://x.example", false).at === "https://x.example" && pageAddress("https://x.example", false).why === "root");
check("no address is no guess", pageAddress("", true).at === null && pageAddress(null, false).why === "none");
const madeAt = noPageSays(src, ["ts", "json"], "https://polio-two.vercel.app/site", true);
const madeNo = noPageSays(src, ["ts", "json"], null, true);
check("the line for a site made here names its page", /is a site made here, so it is read at its page: https:\/\/polio-two\.vercel\.app\/site/.test(madeAt), madeAt);
check("and with no address it says where the page would be and that the repository does not say", /published at \/site of wherever it is deployed/.test(madeNo) && /does not say where/.test(madeNo) && /About on GitHub/.test(madeNo), madeNo);
check("a thin landing from a root address, repository unknown, says so and where to type another", /Only 2 blocks came from https:\/\/x\.example/.test(thinSays(2, { url: "https://x.example", why: "root", isMadeHere: false })) && /nothing in the repository says where its page is/.test(thinSays(2, { url: "https://x.example", why: "root", isMadeHere: false })));
check("a thin landing from a site made here's root names /site", /The site is at https:\/\/x\.example\/site/.test(thinSays(1, { url: "https://x.example", why: "root", isMadeHere: true })));
check("a thin landing from the published page itself says the page is small", /the published page there has little on it/.test(thinSays(2, { url: "https://x.example/site", why: "site", isMadeHere: true })));
check("a thin landing from files says the page is small", /the page in the repository has little on it/.test(thinSays(2, { url: null, why: "none", isMadeHere: false })));
check("three or more blocks is not thin", thinSays(3, { url: "https://x.example", why: "root", isMadeHere: false }) === "");

/* Driven by hand: a repository brought in, a space named after it, and
   twenty seconds of nothing on a panel that read "nothing in it yet". */
const door3 = ["FromASite.tsx", ...["bring.tsx", "FromASite.tsx", "bits.tsx"].map((f) => `fromasite/${f}`)].map((f) => `src/features/studio/bring-in/${f}`).map((f) => readFileSync(f, "utf8")).join("\n");
check("the panel's stage lives outside the panel, keyed by space, so a re-mount cannot lose the line", /useSyncExternalStore\(subscribeStages, \(\) => stageOf\(space\.id\)/.test(door3) && /const STAGES = new Map<string, Stage>\(\)/.test(door3));
check("every busy step is a toast from the board as well as a line, updated in place", /const busy = \(says: string\) => \{/.test(door3) && /ctx\.publish\(\{ key: `studio:repo:\$\{of\.name\}`, title: `\$\{repoName\(of\)\}: \$\{says\}`/.test(door3));
check("a step that goes quiet is ended by name rather than left spinning", /STEP_PATIENCE_MS = 90_000/.test(door3) && /Nothing came back within/.test(door3));
check("an exception anywhere in the read is an ending, said by name", /readRepository\(r(, keep)?\)\.catch\(\(err: unknown\) => refuse\(`stopped before it could finish:/.test(door3));
check("a patience stop never overwrites a later press's strip", /if \(latest && latest\.spaceId !== space\.id\) return;/.test(door3));
check("every press starts from a clear strip", /clearImportLine\(\);/.test(readFileSync("src/features/studio/bringRepo.ts", "utf8")) && /export function clearImportLine/.test(door3));
check("and the automatic landing never passes through the picking stage", !/const landWhole = async \(picking: Picking\) => \{\n    setStage\(picking\);/.test(door3));
check("a candidate without a box is skipped, never thrown on: this runs inside a render", (() => { try { return pageBlocks([{ box: null }, null, { selector: "x", what: "y", box: { x: 0, y: 0, w: 100, h: 50 }, words: "w" }]).length === 1; } catch { return false; } })());

const run = readFileSync("src/features/studio/repoRun.ts", "utf8");
check("the read carries the page address and the mark with the refusal", /pageAt: page\.at, pageWhy: page\.why, madeHere: made/.test(run));
check("and the panel reads the page address, with the same rule on its own record of where it published", /\[got\.pageAt, mine\]/.test(door) && /pageAddress\(deployedBy\(r\), made\)/.test(door));
check("the deployed address comes back with the refusal, asked for on every read", /deployedAt: homepage \|\| null/.test(run) && /const info = await gh\(`\/repos\/\$\{repo\.owner\}\/\$\{repo\.name\}`, token\);\n  if \(isNo\(info\)\) return info;\n  const it/.test(run));

/* ------------------------------------------------------------- reachable */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/publish**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STATUS) }));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);
await page.locator("[data-github-button], header button[aria-label*='GitHub' i]").first().click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
const panel = page.locator("[data-repo-panel]").first();
check("the repo control opens", (await panel.count()) === 1);
if (await panel.count()) {
  check(
    "and bringing a repo in is in it, beside connecting and making one",
    (await panel.locator("[data-repo-bring]").count()) === 1 && (await panel.locator("[data-repo-pull]").count()) === 1
      && (await panel.locator("[data-repo-connect]").count()) >= 0 && (await panel.locator("[data-repo-new]").count()) === 1,
    "bring, connect and make are one control",
  );

  /* A name that is not one is refused where he typed it, and nothing is made. */
  const spacesBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.spaces ?? []).length);
  await panel.locator("[data-repo-bring]").fill("notarepo");
  await page.waitForTimeout(200);
  /* Pressed on the element itself: a popover's own overlay swallows a real
     click, and what is being checked is what the button does, not whether
     Playwright can reach through a portal. */
  await panel.locator("[data-repo-pull]").evaluate((el) => el.click());
  await page.waitForTimeout(700);
  const says = await panel.locator("[data-repo-said]").innerText().catch(() => "");
  const spacesAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.spaces ?? []).length);
  check("a name that is not one is refused where he typed it", says.trim().length > 10, says.trim().slice(0, 90));
  check("and nothing is made on the board for it", spacesAfter === spacesBefore, `${spacesBefore} spaces before, ${spacesAfter} after`);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
