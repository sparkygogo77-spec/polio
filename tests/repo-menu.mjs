#!/usr/bin/env node
/**
 * ONE REPO MENU.
 *
 * THE OWNER'S COMPLAINT: two places did overlapping things. The "Bring a
 * repository in" sheet had a searchable list; the GitHub button's panel had
 * "The repo this site goes to", "Bring in one of your repos", "Make a new
 * repo" and "Bring a repo in" with an owner/name field; and a branch or a
 * site kept in a folder had to be typed as owner/sink@branch/sites/name.
 *
 * Held here, against a stand-in GitHub, in the real Builder:
 *   · both ways in (the board's door and the GitHub button, and the new
 *     site's offer) open the same one menu, with two sections: Bring in and
 *     Publish to;
 *   · Bring in: pick a repo from the searchable list and it opens out to its
 *     branches (the default one already chosen) and its sites/<name>
 *     folders; bringing it in needs no @ and no typed path; the typed
 *     owner/name field is still there as a fallback;
 *   · Publish to: pick one of your repos, or make a new one by name, with a
 *     branch, so a new site can publish to a branch that is not main first;
 *   · the rules stay: a site never publishes into the repo it was brought in
 *     from, and bringing into a site that has parts asks first, offering a
 *     new site for it.
 *
 *   GITHUB_API=http://127.0.0.1:4319 npx next start -p 3012
 *   node tests/repo-menu.mjs http://127.0.0.1:3012
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const PORT = Number(process.env.STUB_PORT ?? 4319);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ------------------------------------------------ a stand-in GitHub */
const made = [];
const REPOS = [
  { full_name: "him/sink", private: true, default_branch: "main", pushed_at: "2026-09-27T00:00:00Z" },
  { full_name: "him/site", private: false, default_branch: "main", pushed_at: "2026-09-26T00:00:00Z" },
  { full_name: "him/other", private: false, default_branch: "trunk", pushed_at: "2026-09-25T00:00:00Z" },
];
const stub = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const j = (b, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(b)); };
  let body = "";
  req.on("data", (d) => { body += d; });
  req.on("end", () => {
    if (u.pathname === "/user") return j({ login: "him" });
    if (u.pathname === "/user/repos" && req.method === "POST") {
      const name = JSON.parse(body || "{}").name;
      made.push(name);
      return j({ full_name: `him/${name}`, default_branch: "main", private: true }, 201);
    }
    if (u.pathname === "/user/repos") return j(REPOS);
    const m = /^\/repos\/him\/([\w.-]+)(\/.*)?$/.exec(u.pathname);
    const repo = m && REPOS.find((r) => r.full_name === `him/${m[1]}`);
    if (!repo) return j({ message: "Not Found" }, 404);
    const rest = m[2] ?? "";
    if (!rest) return j({ default_branch: repo.default_branch, full_name: repo.full_name });
    if (rest === "/branches") return j(m[1] === "sink" ? [{ name: "main" }, { name: "edit/look" }] : [{ name: repo.default_branch }]);
    if (rest === "/contents/sites") {
      if (m[1] !== "sink") return j({ message: "Not Found" }, 404);
      const ref = u.searchParams.get("ref");
      return j([
        { type: "dir", name: "solcinerator", path: "sites/solcinerator" },
        ...(ref === "edit/look" ? [{ type: "dir", name: "trumpmorty", path: "sites/trumpmorty" }] : []),
        { type: "file", name: "README.md", path: "sites/README.md" },
      ]);
    }
    return j({ message: "Not Found" }, 404);
  });
});
await new Promise((r) => stub.listen(PORT, "127.0.0.1", r));

/* --------------------------------------------------------- the page */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const section = async (fn) => { try { await fn(); } catch (e) { check("a section ran to its end", false, String(e).split("\n")[0]); } };

async function site({ source = null, nodes = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => void d.accept());
  /* What the importer asks GitHub from the browser: nothing real, and noted. */
  const asked = [];
  await page.route("https://api.github.com/**", (r) => { asked.push(r.request().url()); return r.fulfill({ status: 404, contentType: "application/json", body: "{}" }); });
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([source, nodes]) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now(), ...(source ? { source } : {}) }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({ pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes }));
  }, [source, nodes]);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(400);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(400);
  return { ctx, page, asked };
}
const builds = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state ?? {});
const menu = (page) => page.locator("[data-repo-menu]");
/* The space a Bring lands in is labelled with what was asked for: owner/name, its folder, @ its branch. */
/* What is being brought in, as the Builder says it: "Reading owner/name/folder@branch".
   It used to be a space on the board, labelled with the same name; the import
   runs out of sight now and says so in the toast (tests/bring-no-space.mjs). */
const NAME = String.raw`([\w.-]+\/[\w.-]+(?:\/[\w./-]+)?(?:@[\w./-]+)?)`;
const readingNow = (page) => page.evaluate((name) => [
  ...document.body.innerText.matchAll(new RegExp(String.raw`\bReading ${name}`, "g")),
  ...document.body.innerText.matchAll(new RegExp(String.raw`^${name}: GitHub has no such repository`, "gm")),
].map((m) => m[1]), NAME);
/* Watched from the press, every 100ms. The toast says "Reading …" only until
   the import answers, and the stand-in here serves no files to import, so it
   answers at once with the refusal — which names what it read just the same. */
const brought = async (page, ms) => {
  const seen = new Set();
  for (let t = 0; t < ms; t += 100) { for (const r of await readingNow(page).catch(() => [])) seen.add(r); await page.waitForTimeout(100); }
  return [...seen];
};
const close = async (page) => { await page.keyboard.press("Escape"); await page.waitForTimeout(300); };

/* ------------------------------------------- one menu, every way in */
await section(async () => {
  const { ctx, page } = await site();
  await page.locator("[data-bring-repo]").first().click();
  await page.waitForTimeout(700);
  check("the board's door opens the repo menu", await menu(page).count() === 1);
  const sections = await page.locator("[data-repo-menu] [data-repo-section]").evaluateAll((s) => s.map((e) => e.getAttribute("data-repo-section")));
  check("…with two sections, Bring in then Publish to", sections.join() === "bring,publish", sections.join());
  const words = (await menu(page).first().innerText().catch(() => "")).toLowerCase();
  check("…named in plain words", words.includes("bring in") && words.includes("publish to"), words.slice(0, 120));
  await close(page);
  check("…and it closes", await menu(page).count() === 0);
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  check("the GitHub button opens the same menu", await menu(page).count() === 1 && await page.locator("[data-repo-section]").count() === 2);
  check("…and there is no second repo panel beside it", await page.locator("[data-repo-panel]").count() === 1 && await page.locator("[data-repo-panel][data-repo-menu]").count() === 1 && await page.locator("[data-repo-picker]:not([data-repo-menu])").count() === 0);
  await close(page);
  const offer = page.locator("[data-offer-bring]");
  if (await offer.count()) {
    await offer.first().click();
    await page.waitForTimeout(700);
    check("the new site's offer opens the same menu", await menu(page).count() === 1);
    await close(page);
  } else check("the new site's offer opens the same menu", false, "no offer drawn");
  await ctx.close();
});

/* ---------------------------------------------------------- Bring in */
await section(async () => {
  const { ctx, page } = await site();
  await page.locator("[data-bring-repo]").first().click();
  await page.waitForTimeout(900);
  const listed = await page.locator("[data-repo-pick]").evaluateAll((b) => b.map((e) => e.getAttribute("data-repo-pick")));
  check("Bring in lists your repos", ["him/sink", "him/site", "him/other"].every((r) => listed.includes(r)), listed.join(", "));
  await page.locator('[data-repo-section="bring"] input[aria-label="Find a repository"]').fill("sin");
  await page.waitForTimeout(200);
  check("…searchable", (await page.locator("[data-repo-pick]").count()) === 1);
  await page.locator('[data-repo-pick="him/sink"]').click();
  await page.waitForTimeout(900);
  const choices = page.locator('[data-repo-choices="him/sink"]');
  check("picking one opens it out to its choices", await choices.count() === 1);
  const branch = choices.locator("select[data-repo-branch-pick]");
  const branches = await branch.locator("option").evaluateAll((o) => o.map((e) => e.value));
  check("…its branches, the default one already chosen", branches.join() === "main,edit/look" && (await branch.inputValue()) === "main", `${branches.join()} · ${await branch.inputValue().catch(() => "")}`);
  const folders = async () => choices.locator("[data-repo-folder]").evaluateAll((o) => o.map((e) => e.getAttribute("data-repo-folder")));
  check("…and its sites/ folders, beside the whole repo", (await folders()).join() === ",sites/solcinerator", (await folders()).join());
  await branch.selectOption("edit/look");
  await page.waitForTimeout(800);
  check("…read again for the branch chosen", (await folders()).join() === ",sites/solcinerator,sites/trumpmorty", (await folders()).join());
  await choices.locator('[data-repo-folder="sites/trumpmorty"]').click();
  await choices.locator("[data-repo-bring-chosen]").click();
  const landed = await brought(page, 1200);
  check("bringing it in needs no @ and no typed path: the branch and folder go with it", landed.includes("him/sink/sites/trumpmorty@edit/look"), landed.join(", "));
  check("…and the menu closes on it", await menu(page).count() === 0);
  await page.locator("[data-bring-repo]").first().click();
  await page.waitForTimeout(600);
  check("the typed owner/name field stays, as a fallback", await page.locator('[data-repo-section="bring"] [data-repo-bring]').count() === 1 && await page.locator('[data-repo-section="bring"] [data-repo-pull]').count() === 1);
  await ctx.close();
});

/* -------------------------------------------------------- Publish to */
await section(async () => {
  const { ctx, page } = await site({ source: { owner: "him", name: "sink", branch: "main" } });
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(900);
  const pub = page.locator('[data-repo-section="publish"]');
  check("Publish to says where this site goes", /no repo of its own yet/i.test(await pub.innerText().catch(() => "")));
  const row = (r) => pub.locator(`[data-repo-publish-pick="${r}"]`);
  check("…lists your repos to publish to", await row("him/site").count() === 1);
  check("…but never the one this site was brought in from", await row("him/sink").count() === 0 || await row("him/sink").isDisabled());
  const barred = await page.locator('[data-repo-section="bring"] [data-repo-pick="him/site"]').isDisabled().catch(() => false);
  check("and Bring in offers only the repo it was brought in from", barred);
  await pub.locator("[data-repo-publish-branch]").fill("first-draft");
  await row("him/site").click();
  await page.waitForTimeout(500);
  let b = await builds(page);
  check("picking one, with a branch, points publishing there", JSON.stringify(b.projects?.[0]?.repo) === JSON.stringify({ owner: "him", name: "site", branch: "first-draft" }), JSON.stringify(b.projects?.[0]?.repo));
  check("…and says so", /him\/site/.test(await pub.innerText()) && /first-draft/.test(await pub.innerText()));
  await ctx.close();
});
await section(async () => {
  /* Brought in from a folder of a repo: the whole repo is the capture, so it is never a publish target either. */
  const { ctx, page } = await site({ source: { owner: "him", name: "sink", branch: "main", dir: "sites/solcinerator" } });
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(900);
  const row = page.locator('[data-repo-section="publish"] [data-repo-publish-pick="him/sink"]');
  check("a site brought in from a sites/ folder never publishes into that repo either", await row.count() === 0 || await row.isDisabled());
  const refused = await page.evaluate(async () => {
    const { owner, name } = { owner: "him", name: "sink" };
    return (JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects ?? []).some((p) => p.source?.owner === owner && p.source?.name === name);
  });
  check("…(the site does carry that source)", refused);
  await ctx.close();
});
await section(async () => {
  const { ctx, page } = await site();
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(900);
  const pub = page.locator('[data-repo-section="publish"]');
  await pub.locator("[data-repo-new]").fill("fresh-one");
  await pub.locator("[data-repo-publish-branch]").fill("preview");
  await pub.locator("[data-repo-make]").click();
  /* Make it asks once, with the final name (tests/publish-target.mjs). */
  await page.waitForTimeout(300);
  if (await pub.locator("[data-repo-make-go]").count()) await pub.locator("[data-repo-make-go]").click();
  await page.waitForTimeout(1200);
  const b = await builds(page);
  check("a new repo, made by name, becomes where this site publishes, on the branch given", made.includes("fresh-one") && JSON.stringify(b.projects?.[0]?.repo) === JSON.stringify({ owner: "him", name: "fresh-one", branch: "preview" }), `${made.join()} ${JSON.stringify(b.projects?.[0]?.repo)}`);
  await ctx.close();
});

/* ------------------------------------------------- a site with parts */
await section(async () => {
  const part = { id: "n1", pageId: "page_home", featureId: "prose", label: "words", prompt: "", content: "Hello", data: "", x: 100, y: 100, w: 300, h: 60, groupId: null, options: {}, priority: "must", custom: false };
  const { ctx, page } = await site({ nodes: [part] });
  await page.locator("[data-bring-repo]").first().click();
  await page.waitForTimeout(900);
  await page.locator('[data-repo-pick="him/site"]').click();
  await page.waitForTimeout(700);
  await page.locator('[data-repo-choices="him/site"] [data-repo-bring-chosen]').click();
  await page.waitForTimeout(400);
  const ask = page.locator("[data-repo-bring-confirm]");
  check("bringing into a site that has parts asks first", await ask.count() === 1, await ask.first().innerText().catch(() => ""));
  check("…offering a new site for it", await ask.locator("[data-repo-bring-newsite]").count() === 1);
  const before = (await builds(page)).projects?.length ?? 0;
  await ask.locator("[data-repo-bring-newsite]").click().catch(() => {});
  const reading = (await brought(page, 2000)).includes("him/site");
  const b = await builds(page);
  check("…which makes the new site and brings the repo into it", (b.projects?.length ?? 0) === before + 1 && b.activeId !== "s1" && reading, `${before} → ${b.projects?.length} · ${b.activeId} · reading ${reading}`);
  await ctx.close();
});

check("the Builder raised no error", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
stub.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
