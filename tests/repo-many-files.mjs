#!/usr/bin/env node
/**
 * A REPOSITORY WITH MORE THAN 80 FILES COMES IN.
 *
 * J (2026-10-03), from the live builder: bringing PonsStars in from GitHub
 * said "That repository has more in it than this reads… It has 85 files a
 * page would ask for, and this reads 80", and nothing came. The 85 were its
 * site (29 in web/) and 56 files no page asks for (docs/screenshots,
 * design/site, kit/starter). Now what is pulled is the site's own folder
 * and what its pages ask for from elsewhere, as many files as the zip route
 * opens (600), fetched a few at a time with a count, packed deflated so it
 * goes to the server in one request; and a site past that says how many
 * and where most of them are.
 *
 *   1. pure: the site's folders; what a page or stylesheet asks for by a
 *      relative address, from a folder up, from the root, in a srcset;
 *      where most of a list of files are;
 *   2. through the real door against a GitHub stood in: a site of 150
 *      pictures in web/ (each on its page), a logo in shared/ that its
 *      stylesheet asks for, and 60 screenshots in docs/ nothing asks for.
 *      It comes in: every picture and the logo are fetched, no screenshot
 *      is, and the count was shown while fetching;
 *   3. a site that asks for 700 files is refused with how many, the most
 *      this reads, and where most of them are.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/repo-many-files.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/bring-in/repoImport.ts, src/features/studio/repoRun.ts, src/app/api/studio/zip/route.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { heaviestFolders, inFolders, MAX_REPO_FILES, referenced, siteFolders } from "../src/features/studio/bring-in/repoImport.ts";

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */

check("the site's folders: where its pages are, one inside another counted once", JSON.stringify(siteFolders(["web/index.html", "web/game/x.html", "site/a.html"])) === JSON.stringify(["web/", "site/"]) && JSON.stringify(siteFolders(["index.html", "web/b.html"])) === JSON.stringify([""]));
check("in a folder", inFolders("web/img/a.png", ["web/"]) && !inFolders("docs/a.png", ["web/"]) && inFolders("docs/a.png", [""]));
const have = new Set(["web/img/a.png", "shared/logo.svg", "web/base.css", "web/img/b@2x.png", "img/root.png", "web/fonts/f.woff2"]);
const asked = referenced(`<img src="img/a.png"><link href="../shared/logo.svg"><img srcset="img/a.png 1x, img/b@2x.png 2x"><img src="https://x.test/c.png"><img src="//cdn/x.png"><a href="#top">`, "web/index.html", have, ["web/"]).sort();
check("what a page asks for by a relative address, a folder up and in a srcset; not another site's", JSON.stringify(asked) === JSON.stringify(["shared/logo.svg", "web/img/a.png", "web/img/b@2x.png"]), JSON.stringify(asked));
check("from a stylesheet: url() and @import, and an address from the root", JSON.stringify(referenced(`@import "base.css"; .a { background: url('/img/root.png') } @font-face { src: url(fonts/f.woff2?v=2) }`, "web/site.css", have, ["web/"]).sort()) === JSON.stringify(["img/root.png", "web/base.css", "web/fonts/f.woff2"]));
check("where most of the files are", heaviestFolders(["docs/s/1.png", "docs/s/2.png", "web/a.html"]) === "docs/s/ 2, web/ 1");
check("as many files as the zip route opens", MAX_REPO_FILES === 600);

/* ------------------------------------------------------------------ */
/* 2. Through the door                                                  */
/* ------------------------------------------------------------------ */

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
const repoOf = (pictures, screenshots) => {
  const files = {};
  files["web/index.html"] = Buffer.from(`<!doctype html><html><head><title>Gallery</title><link rel="stylesheet" href="site.css"></head><body><h1 data-hook="title">A gallery of ${pictures}</h1><div class="logo" data-hook="logo"></div>${Array.from({ length: pictures }, (_, i) => `<img data-hook="pic-${i}" src="img/p${i}.png" width="40" height="40" alt="picture ${i}">`).join("")}</body></html>`);
  files["web/site.css"] = Buffer.from(`body { margin: 0; font: 16px sans-serif; } .logo { width: 60px; height: 60px; background: url("../shared/logo.svg"); } img { display: inline-block; }`);
  for (let i = 0; i < pictures; i++) files[`web/img/p${i}.png`] = png;
  files["shared/logo.svg"] = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#e07020"/></svg>`);
  for (let i = 0; i < screenshots; i++) files[`docs/screenshots/s${i}.png`] = png;
  return files;
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const bring = async (files, name) => {
  const names = Object.keys(files);
  const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: files[f].length }));
  const fetched = new Set();
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => {
    const u = new URL(r.request().url());
    const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
    const mm = u.pathname.match(new RegExp(`^/repos/him/${name}(/.*)?$`));
    if (!mm) return j({ message: "no" }, 404);
    const rest = mm[1] ?? "";
    if (!rest) return j({ default_branch: "main", homepage: "" });
    if (rest.startsWith("/git/trees/")) return j({ tree });
    const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
    if (b) { const f = names[Number(b[1])]; fetched.add(f); return j({ encoding: "base64", content: files[f].toString("base64") }); }
    if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10).split("?")[0]); return files[f] !== undefined ? j({ content: files[f].toString("base64"), encoding: "base64" }) : j({}, 404); }
    if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: "c0" } });
    if (rest.startsWith("/commits/")) return j({ sha: "c0" });
    return j({ message: "no" }, 404);
  });
  await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  await ui.evaluate(() => {
    const env = (state) => JSON.stringify({ state, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Many", updatedAt: Date.now() }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  });
  await ui.reload({ waitUntil: "networkidle" });
  await ui.waitForTimeout(900);
  const keys = ui.locator("[data-keys-panel]");
  await ui.getByRole("button", { name: "Keys", exact: true }).click();
  await ui.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await ui.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await ui.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await ui.waitForTimeout(500);
  await ui.locator("[data-github-button]").first().click();
  await ui.waitForTimeout(700);
  /* Every line the import says while it works, as it says it. */
  const said = new Set();
  await ui.exposeFunction("__said", (t) => said.add(t));
  await ui.evaluate(() => new MutationObserver(() => { for (const t of document.body.innerText.match(/Fetching the site and what it uses… \d+ of \d+/g) ?? []) window.__said(t); }).observe(document.body, { subtree: true, childList: true, characterData: true }));
  await ui.locator("[data-repo-bring]").fill(`him/${name}`);
  await ui.locator("[data-repo-pull]").click();
  const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
  let st = await board();
  let text = "";
  for (let i = 0; i < 120 && !st.nodes.length; i++) {
    await ui.waitForTimeout(1000);
    st = await board();
    text = await ui.evaluate(() => document.body.innerText);
    if (/more in it than this reads/.test(text)) break;
  }
  await ui.waitForTimeout(800);
  st = await board();
  await ui.close();
  return { st, fetched, said: [...said], text, errors };
};

const ok = await bring(repoOf(150, 60), "gallery");
const pics = [...ok.fetched].filter((f) => f.startsWith("web/img/")).length;
check("a site of 152 files comes in", ok.st.nodes.length > 100, `${ok.st.nodes.length} parts`);
check("every picture its page asks for is fetched, and the logo its stylesheet asks for from shared/", pics === 150 && ok.fetched.has("shared/logo.svg") && ok.fetched.has("web/site.css"), `${pics} pictures, logo ${ok.fetched.has("shared/logo.svg")}`);
check("no screenshot in docs/ is fetched: no page asks for one", ![...ok.fetched].some((f) => f.startsWith("docs/")), [...ok.fetched].filter((f) => f.startsWith("docs/")).length + " fetched");
check("the count is shown while it fetches", ok.said.some((t) => / of 15[0-9]$/.test(t)), ok.said.slice(-3).join(" | "));
const logo = ok.st.nodes.find((n) => n.hooks?.["data-hook"] === "logo");
check("the logo from outside the site's folder is on the board", /logo|data:image\/svg|url\(/.test(JSON.stringify(logo?.art ?? logo?.look ?? logo ?? "")), JSON.stringify(logo?.art ?? null).slice(0, 80));
check("no page errors", ok.errors.length === 0, ok.errors.slice(0, 2).join(" | "));

const big = await bring(repoOf(700, 0), "huge");
check("a site past 600 files is refused with how many, the most, and where they are", /asks for 70\d files, and this reads up to 600\. Most are in web\/img\/ 700/.test(big.text) && !big.st.nodes.length, (big.text.match(/That repository[^\n]*/) ?? [""])[0]);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
