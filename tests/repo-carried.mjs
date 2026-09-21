/**
 * A SITE THAT WAS CONNECTED SHOWS ITS REPOSITORY, published or not.
 *
 * Four sites under the switcher all said "no repository" after he made a new
 * repository and connected an existing one. The GitHub control wrote the
 * choice into the document as `siteRepo`; the Sites list, the Builds page
 * and Publish read `project.repo` on the builds store, which only a publish
 * wrote. So a connected site showed nothing, and its first publish made a
 * second repository named after the site.
 *
 * The builds store is the one place now, and a document that still carries
 * the old field is copied across once, on load. This seeds a browser with
 * the four states his sites can be in and reads what each one shows:
 *
 *   1. connected, then switched away: the name sits in the site's own slot;
 *   2. connected and still open: the name sits in the live document;
 *   3. never connected, or the connect failed: nothing was ever stored;
 *   4. published: the builds store already holds it.
 *
 *   node tests/repo-carried.mjs [url]
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* The four sites, as local storage would hold them the morning after. */
const seed = () => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  /* No pages seeded: the store fills its own, and a bare page object is not one. */
  const doc = (siteRepo) => env({ nodes: [], ...(siteRepo ? { siteRepo } : {}) });
  const now = Date.now();
  localStorage.setItem("builder.builds", env({
    projects: [
      { id: "s1", name: "Site 1", updatedAt: now },
      { id: "s2", name: "Site 2", updatedAt: now },
      { id: "s3", name: "Site 3", updatedAt: now },
      { id: "s4", name: "Site 4", updatedAt: now, repo: { owner: "him", name: "four", branch: "main" } },
    ],
    activeId: "s2",
  }));
  localStorage.setItem("builder.doc:s1", doc("him/one"));
  localStorage.setItem("builder.studio", doc("him/two"));
  localStorage.setItem("builder.doc:s3", doc(null));
  localStorage.setItem("builder.doc:s4", doc(null));
};

const held = () => page.evaluate(() => {
  const v = JSON.parse(localStorage.getItem("builder.builds") || "null");
  const out = {};
  for (const p of v?.state?.projects ?? []) out[p.name] = p.repo ? `${p.repo.owner}/${p.repo.name}@${p.repo.branch}` : null;
  return out;
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(seed);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const after = await held();
check("a site connected then left recovers its repository from its own slot", after["Site 1"] === "him/one@main", after["Site 1"] ?? "none");
check("the open site recovers its repository from the live document", after["Site 2"] === "him/two@main", after["Site 2"] ?? "none");
check("a site that never stored one does not invent one", after["Site 3"] === null, after["Site 3"] ?? "none");
check("a published site keeps what it had", after["Site 4"] === "him/four@main", after["Site 4"] ?? "none");

/* What the switcher says, which is what he reads. */
await page.locator("[data-builds-switch]").first().click();
await page.waitForTimeout(400);
const rows = await page.evaluate(() => Array.from(document.querySelectorAll("[role=dialog] li, [data-radix-popper-content-wrapper] li")).map((li) => li.innerText.replace(/\s+/g, " ").trim()));
check("the switcher names the repository on each site that has one",
  rows.some((r) => /Site 1/.test(r) && /him\/one/.test(r)) && rows.some((r) => /Site 2/.test(r) && /him\/two/.test(r)) && rows.some((r) => /Site 4/.test(r) && /him\/four/.test(r)),
  rows.join(" | ") || "no rows");
check("and says in words that the one without has none", rows.some((r) => /Site 3/.test(r) && /no repository/.test(r)), rows.find((r) => /Site 3/.test(r)) ?? "-");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

/* The GitHub control on the open site, and on a site with none. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(600);
const own = await page.evaluate(() => document.querySelector("[data-repo-points]")?.textContent?.trim() ?? null);
check("the GitHub control shows the open site's own repository", own === "him/two", own ?? "-");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);

await page.evaluate(() => {
  const v = JSON.parse(localStorage.getItem("builder.builds"));
  v.state.activeId = "s3";
  localStorage.setItem("builder.builds", JSON.stringify(v));
  localStorage.setItem("builder.studio", localStorage.getItem("builder.doc:s3"));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(600);
const none = await page.evaluate(() => ({
  points: document.querySelector("[data-repo-points]")?.textContent?.trim() ?? null,
  own: document.querySelector("[data-repo-points]")?.getAttribute("data-repo-own") ?? null,
}));
check("a site with none says so in a sentence rather than a blank or a borrowed name", none.own === "" && /No repo of its own yet/.test(none.points ?? ""), none.points ?? "-");

/* A second load must not undo any of it. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const again = await held();
check("and it all survives a reload", again["Site 1"] === "him/one@main" && again["Site 2"] === "him/two@main" && again["Site 3"] === null && again["Site 4"] === "him/four@main");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
