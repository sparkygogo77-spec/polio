#!/usr/bin/env node
/**
 * THE OPEN SITE'S WEBSITE, ONE BUTTON IN THE TOP BAR.
 *
 * J (2026-10-05): "add a single button link to the header for the open
 * associated website link found in github to open in another tab, it was
 * previously there" (`LiveSiteLink.tsx`).
 *
 * Against a stand-in GitHub (nothing leaves the machine):
 *   · the website address is read as a link (scheme added, junk refused);
 *   · a site from code whose repository names a website: one link beside the
 *     GitHub button, opening that address in a new tab;
 *   · its repository names none: no link;
 *   · a site made here and already live: only Update live site's own link,
 *     never two;
 *   · on Builds, none.
 *
 *   node tests/live-site-link.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = await jiti.import(join(here, "..", "src", "features", "studio", "liveSite.ts"));
check("a website with no scheme gets https", L.websiteOf(" pst-server-beige.vercel.app ") === "https://pst-server-beige.vercel.app/");
check("an https website stays as it is", L.websiteOf("https://example.com/play") === "https://example.com/play");
check("none, or not a web address, is no link", L.websiteOf("") === null && L.websiteOf(null) === null && L.websiteOf("javascript:alert(1)") === null);

/* ------------------------------------------------------------ the browser */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const HOMES = { "them/app": "pst-server-beige.vercel.app", "them/bare": "", "him/site": "https://other.example" };

async function open(project, look) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/https:\/\/(api\.)?(vercel|github)\.com\/.*/, (r) => {
    const m = new URL(r.request().url()).pathname.match(/^\/repos\/([^/]+\/[^/]+)$/);
    if (m && m[1] in HOMES) return json(r, { full_name: m[1], default_branch: "main", homepage: HOMES[m[1]] });
    return json(r, {}, 404);
  });
  await page.route("**/api/studio/publish**", (r) => json(r, { github: { configured: true, token: "server", repo: null, branch: "main", missing: [] }, vercel: { hook: false } }));
  await page.route("**/api/studio/deploy**", (r) => json(r, { configured: true, source: "server", repo: null, hook: false }));
  await page.route("**/api/studio/repo", (r) => json(r, { ok: true, repos: [] }));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
    builds: env({ projects: [{ id: "s1", name: "Site", updatedAt: Date.now(), nudged: true, ...project }], activeId: "s1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [], frameWidth: 1440, ...(look ? { look } : {}) }),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const bar = (page) => page.evaluate(() => {
  const links = [...document.querySelectorAll("header [data-live-site]")];
  const a = links[0];
  const gh = document.querySelector("header [data-github-button]");
  const ra = a?.getBoundingClientRect(), rg = gh?.getBoundingClientRect();
  return {
    count: links.length,
    href: a?.getAttribute("href") ?? null,
    target: a?.getAttribute("target") ?? null,
    rel: a?.getAttribute("rel") ?? "",
    gap: ra && rg ? Math.round(ra.left - rg.right) : null,
    addresses: document.querySelectorAll("header [data-go-live-address]").length,
  };
});
const code = (repo) => ({ palette: {}, texture: [], target: "page", styleSource: { repo, ref: "main", dir: "web/", files: [] } });

{
  const { ctx, page } = await open({}, code("them/app"));
  const b = await bar(page);
  check("a site from code: one link to its repository's website, in a new tab", b.count === 1 && b.href === "https://pst-server-beige.vercel.app/" && b.target === "_blank" && /noopener/.test(b.rel), J(b));
  check("…right beside the GitHub button", b.gap !== null && b.gap >= 0 && b.gap <= 16, J(b));
  await page.screenshot({ path: ".screenshots/live-site-link-code.png", clip: { x: 700, y: 0, width: 740, height: 60 } });
  await page.evaluate(() => window.next?.router?.push("/builds"));
  await page.waitForURL(/\/builds$/);
  await page.waitForTimeout(800);
  check("on Builds it leaves the bar with the rest of the site's controls", (await bar(page)).count === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({}, code("them/bare"));
  check("a repository with no website: no link", (await bar(page)).count === 0);
  await ctx.close();
}
{
  const { ctx, page } = await open({ repo: { owner: "him", name: "site", branch: "main" }, bound: "made", live: { url: "https://site-live.example", at: Date.now() } }, null);
  const b = await bar(page);
  check("a site made here and live: Update live site's own link, never a second", b.count === 0 && b.addresses === 1, J(b));
  await ctx.close();
}
{
  const { ctx, page } = await open({ repo: { owner: "him", name: "site", branch: "main" } }, null);
  const b = await bar(page);
  check("a site made here, not yet live from here, whose repository names a website: the link", b.count === 1 && b.href === "https://other.example/", J(b));
  await ctx.close();
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
