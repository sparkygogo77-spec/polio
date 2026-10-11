/**
 * THE GITHUB ICON IS THE REPOSITORY CONTROL, not a link to his profile.
 *
 * HIS WORDS: "how do i create a new repo from the site, it should be apparent
 * to connect repo, this should be what the github icon does in the top
 * instead of taking me to my profile".
 *
 * Three states of the same complaint, and only one of them was a discovery
 * problem:
 *
 *   · the repo this site points at — it was in a tooltip;
 *   · connecting a different one — supported on the wire the whole time,
 *     because `publish` takes a repo from the browser, with nowhere on
 *     screen to name one and nowhere in the document to keep the answer;
 *   · MAKING one — not implemented anywhere. No `createRepo`, no
 *     `POST /user/repos`. Publishing to a name that does not exist failed.
 *     The honest answer to his question was no, and this is what makes it
 *     yes.
 *
 *   node --experimental-strip-types tests/repo-control.mjs [url]
 */
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { nameRefusal, repoNameFor } from "../src/features/studio/repoName.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. A name, and what to say when it is not one                       */
/* ------------------------------------------------------------------ */

check("a plain name is taken", nameRefusal("blackorb") === null);
check("dots, dashes and underscores are taken", nameRefusal("black.orb_2-x") === null);
check("an empty one is refused, in a sentence", /needs a name/.test(nameRefusal("") ?? ""), nameRefusal(""));
check("a space is refused, saying which characters are allowed", /no spaces/.test(nameRefusal("black orb") ?? ""), nameRefusal("black orb"));
check("a hundred and one characters is refused with the limit named", /100/.test(nameRefusal("a".repeat(101)) ?? ""));
check("and it is told BEFORE the call, not by a 422 afterwards",
  /nameRefusal/.test(readFileSync("src/app/api/studio/repo/route.ts", "utf8")));

check("a site's name becomes a name GitHub will take", repoNameFor("BLACKORB") === "blackorb");
check("…with the awkward characters turned into dashes", repoNameFor("A Site! (v2)") === "a-site-v2", repoNameFor("A Site! (v2)"));
check("…and something unusable still yields a name", repoNameFor("!!!") === "site", repoNameFor("!!!"));

/* ------------------------------------------------------------------ */
/* 2. The route, and whose token and account it uses                   */
/* ------------------------------------------------------------------ */

const route = readFileSync("src/app/api/studio/repo/route.ts", "utf8");
check("it can list what the token can see, and make one", /export async function GET/.test(route) && /export async function POST/.test(route));
/* Picked by the one shared rule every route uses (tests/key-precedence.mjs). */
check("his token first, the server's as the fallback, exactly as a publish does",
  /keyFor\(request, "x-github-token"\)/.test(route));
check("a repository is made under the TOKEN'S owner, not a name this file picked",
  /\/user\/repos/.test(route) && !/\bowner:\s*"/.test(route));
check("private, and with a first commit so a publish has somewhere to land",
  /private: priv/.test(route) && /auto_init: true/.test(route));
check("no token is a sentence rather than an error", /reason: "no-token"/.test(route));
check("and every way it can fail says which one in plain words",
  ["auth", "scope", "taken", "upstream", "network", "name"].every((r) => new RegExp(`reason: "${r}"`).test(route)),
  ["auth", "scope", "taken", "upstream", "network", "name"].filter((r) => !new RegExp(`reason: "${r}"`).test(route)).join(", ") || "all six");

/* One place. The document used to keep its own `siteRepo`, which nothing
   that shows a site's repository read; the builds store is where the Sites
   list, the Builds page and Publish look, so it is where a connect writes. */
/* HIS RULING: attaching is importing. And one answer about the token. */
const button0 = readFileSync("src/features/studio/GithubButton.tsx", "utf8");
/* One repo menu now (tests/repo-menu.mjs): the GitHub button opens it, and the menu holds what its panel held. */
const menu0 = readFileSync("src/features/studio/RepoPicker.tsx", "utf8");
/* Through `askBring`, the same path Bring it runs, which says what a Bring
   will replace before it runs; it never points publishing
   (tests/publish-source.mjs). */
check("choosing a repository from the list runs the same path Bring it runs", /data-repo-pick=\{r\.name\}/.test(menu0) && /onClick=\{bringChosen\}/.test(menu0) && /ask\(want, folder \|\| null\)/.test(menu0) && /bringRepoIn\(want, \{/.test(menu0));
check("and publishing is a separate control that binds without touching the board", /data-repo-publish-pick=\{r\.name\}/.test(menu0) && /The board is as it was\./.test(menu0));
check("the button reads the browser's key live, the same value the menu reads", /const mineNow = useKeys\(\(s\) => s\.unlocked && !!s\.values\.GITHUB_TOKEN\);/.test(button0) && /const unlocked = useKeys\(\(s\) => s\.unlocked && !!s\.values\.GITHUB_TOKEN\);/.test(menu0));
check("and when the key locks again the list is taken down with the reason, not left under a button that says no token", /The key is locked again after five minutes idle\. Open Keys to unlock it, and the list comes back\./.test(menu0));
const store = ["board/store.ts", ...readdirSync("src/features/studio/board/store").filter((f) => f.endsWith(".ts")).map((f) => `board/store/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
const builds = readFileSync("src/features/builds/store.ts", "utf8");
const button = readFileSync("src/features/studio/GithubButton.tsx", "utf8");
check("the choice is kept on the site in the builds store, the one place everything reads",
  /repo\?: \{ owner: string; name: string; branch: string \}/.test(builds) && /export const activeRepo/.test(builds));
check("and not on the document any more", !/siteRepo: s\.siteRepo/.test(store) && !/setSiteRepo/.test(store));
check("connecting and making both write there, with the branch",
  /useBuilds\.getState\(\)\.setRepo\(p\.id, repo, how\)/.test(menu0) && !/setSiteRepo/.test(menu0) && /repoFrom\(full, onBranch\)/.test(menu0) && /connect\(r\.name\)/.test(menu0) && /connect\(String\(a\.name\), "made"(, true)?\)/.test(menu0)
  /* …and neither may take a target another site already publishes to (the shared-target guard). */
  && /targetTakenBy\(p\.id, repo\)/.test(menu0));
check("an edit opens its branch by asking the same place", /activeRepo\(\) && !s\.siteBranch/.test(store));
check("a document that still names one is copied across once", /takeCarriedRepo/.test(store) && /function carryRepos/.test(builds));

/* ------------------------------------------------------------------ */
/* 3. On the bar                                                       */
/* ------------------------------------------------------------------ */

const URL_ = process.argv[2];
if (!URL_) {
  console.log("\n  --  the bar leg needs a url; skipped");
} else {
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    throw new Error("No Playwright found.");
  })();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  const left = [];
  page.on("popup", (q) => left.push(q.url()));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  check("the GitHub icon is on the bar", (await page.locator("[data-github-button]").count()) === 1);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(900);

  const seen = await page.evaluate(() => ({
    panel: document.querySelectorAll("[data-repo-panel]").length,
    points: document.querySelector("[data-repo-points]")?.textContent?.trim() ?? null,
    field: document.querySelectorAll("[data-repo-new]").length,
    make: document.querySelectorAll("[data-repo-make]").length,
    said: document.querySelector("[data-repo-picker-said], [data-repo-said]")?.textContent?.trim() ?? null,
    words: (document.querySelector("[data-repo-panel]")?.innerText ?? "").toLowerCase(),
  }));
  check("pressing it opens the repository control", seen.panel === 1);
  /* The whole complaint: it used to leave the product. */
  check("…and does not leave the product", left.length === 0, left.join(" ") || "no window opened");
  check("it says where this site goes", !!seen.points, seen.points ?? "-");
  check("it offers to bring in one of his repos, and to choose or move where this site publishes", /bring in/.test(seen.words) && /pick one of your repos to build from|brought in from/.test(seen.words) && /publish to/.test(seen.words) && /choose one of your repos|move it to another/.test(seen.words));
  check("and says that bringing one in lands it on the board, with publishing as the other section", /lands on the board/.test(seen.words) && /the board is as it was|publishes|no repo of its own yet/.test(seen.words));
  check("and it offers to make a new one, which was not possible before",
    seen.field === 1 && seen.make === 1);
  check("it calls them repos, which is what he calls them", /\brepo\b/.test(seen.words), seen.words.match(/\brepos?\b/g)?.join(" ") ?? "-");
  /* With no GitHub reachable from a test run, the panel must SAY so rather
     than sit empty — the same rule every other surface here keeps. */
  check("and when GitHub cannot be reached it says so rather than going quiet",
    !!seen.said, seen.said ?? "said nothing");

  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
