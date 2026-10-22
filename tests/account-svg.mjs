#!/usr/bin/env node
/**
 * THE ACCOUNT KEEPS SVG PICTURES SAFELY, AND ONE REFUSED FILE NEVER BLOCKS A SITE.
 *
 * J (2026-10-21): the imported sol face site never synced. One of its pictures
 * is an SVG, the account answered it 415, the whole site failed, and the page
 * said nothing, every minute, for ever. Now:
 *
 *   1. an SVG with a <script>, an onload and a javascript: link is cleaned on
 *      the way in (`src/app/api/account/svg.ts`, DOMPurify's SVG profile): all
 *      three are gone when it is read back and the drawing is intact; a file
 *      that is not an SVG, or is over 4 MB, is refused in words; an <image>
 *      keeps its own raster pixels (data:image/png…), and an SVG in a data
 *      address (a script hidden in it) and any other address are stripped;
 *   2. it is served as image/svg+xml with nosniff and a policy that lets it
 *      run nothing (default-src 'none'; style-src 'unsafe-inline'; sandbox);
 *   3. a site with one SVG and one PNG syncs whole, and the page lists nothing
 *      as skipped;
 *   4. a site with a picture of a type the account does not keep (a BMP) and a
 *      PNG syncs: the BMP alone is skipped, the site and the PNG are saved, the
 *      page names the picture and the server's reason, and neither the next
 *      page load nor the next minute asks for the BMP again.
 *
 *   POLIO_OWNER_KEY=STANDIN_owner_key_for_tests_only_0123456789 POLIO_ACCOUNT_DIR=/tmp/polio-account-svg npx next start -p 3023
 *   node tests/account-svg.mjs http://127.0.0.1:3023 /tmp/polio-account-svg
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright-core");

const BASE = process.argv[2] ?? "http://127.0.0.1:3023";
const DIR = process.argv[3] ?? "/tmp/polio-account-svg";
const OWNER = "STANDIN_owner_key_for_tests_only_0123456789";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const call = (path, init = {}) => fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${OWNER}` } });
const put = (id, type, body) => call(`/api/account/data?path=data/pictures/${id}`, { method: "PUT", headers: { "content-type": type }, body });

const DIRTY = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" onload="alert(1)">
<script>alert(2)</script>
<a xlink:href="javascript:alert(3)"><circle id="face" cx="50" cy="50" r="40" fill="gold" onclick="alert(4)"/></a>
<path d="M30 60 Q50 80 70 60" stroke="black" fill="none"/>
</svg>`;
rmSync(DIR, { recursive: true, force: true });

// 1. the way in
const up = await put("svg_dirty", "image/svg+xml", DIRTY);
check("an SVG is accepted", up.status === 200, `${up.status} ${await up.clone().text()}`);
const down = await call("/api/account/data?path=data/pictures/svg_dirty");
const kept = await down.text();
check("read back, the <script> is gone", down.status === 200 && !/<script/i.test(kept) && !/alert\(2\)/.test(kept), kept.slice(0, 200));
check("the onload and onclick are gone", !/\son\w+\s*=/i.test(kept));
check("the javascript: link is gone", !/javascript:/i.test(kept));
check("the drawing is intact: the circle (id, size, fill) and the path", /<circle[^>]*id="face"/.test(kept) && /r="40"/.test(kept) && /fill="gold"/.test(kept) && /<path[^>]*d="M30 60 Q50 80 70 60"/.test(kept) && /viewBox="0 0 100 100"/.test(kept), kept);

const EXTERNAL = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><style>@import url(http://evil.test/a.css); .a{fill:red}</style><foreignObject><div>hi</div></foreignObject><use href="http://evil.test/x.svg#a"/><image id="pixels" xlink:href="data:image/png;base64,AAAA"/><image id="inner" href="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(3)</script></svg>').toString("base64")}"/><rect width="5" height="5" style="fill:url(http://evil.test/p)" fill="url(http://evil.test/q)"/><circle id="ok" cx="5" cy="5" r="2" fill="url(#g)"/></svg>`;
await put("svg_external", "image/svg+xml", EXTERNAL);
const ext = await (await call("/api/account/data?path=data/pictures/svg_external")).text();
check("foreignObject, external use/image/url() and an SVG in a data address (the script hidden in it) are gone", !/foreignObject|evil\.test|@import|image\/svg\+xml|PHN2Zy/i.test(ext) && /<circle[^>]*id="ok"/.test(ext), ext);
check("an <image> keeps its own raster pixels (data:image/png)", /<image[^>]*id="pixels"[^>]*href="data:image\/png;base64,AAAA"/.test(ext), ext);

const notSvg = await put("svg_not", "image/svg+xml", "<html><body>not a drawing</body></html>");
const notSvgBody = await notSvg.json();
check("something that is not an SVG is refused, in words", notSvg.status === 415 && /SVG/.test(notSvgBody.says), J(notSvgBody));
const broken = await put("svg_broken", "image/svg+xml", "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle");
check("an SVG that does not parse is refused", broken.status === 415, String(broken.status));
const huge = await put("svg_huge", "image/svg+xml", `<svg xmlns="http://www.w3.org/2000/svg"><desc>${"x".repeat(4200 * 1024)}</desc></svg>`);
const hugeBody = await huge.json();
check("an SVG over 4 MB is refused with a reason", huge.status === 413 && typeof hugeBody.says === "string" && hugeBody.says.length > 0, J(hugeBody));
check("a refused SVG is not kept", !existsSync(join(DIR, "data/pictures/svg_not")) && !existsSync(join(DIR, "data/pictures/svg_huge")));
check("a page is still not a picture", (await put("evil_html", "text/html", "<script>1</script>")).status === 415);

// 2. the way out
const h = down.headers;
check("it is served as image/svg+xml", h.get("content-type") === "image/svg+xml", h.get("content-type"));
check("nosniff", h.get("x-content-type-options") === "nosniff");
check("and a policy that lets it run nothing", h.get("content-security-policy") === "default-src 'none'; style-src 'unsafe-inline'; sandbox", h.get("content-security-policy"));

// 3 and 4. the page
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDIgBQAABgQB/1UzpsIAAAAASUVORK5CYII=";
const BMP = "Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAA==";
const pic = (id, type, bytes) => ({ id, path: `assets/pictures/${id}`, type, w: 2, h: 2, bytes, alt: id, from: "upload" });
const nodeFor = (n, p) => ({ id: `n_${n}`, pageId: "page_home", featureId: "picture", label: "", prompt: "", content: "", data: "", x: 100, y: 100 + n * 220, w: 200, h: 200, groupId: null, options: {}, priority: "must", custom: false, picture: p });

/** A fresh browser holding one site with these pictures (id, type, base64 of the bytes), signed in at the Account page. */
async function signedInWith(siteName, pics) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const asked = [];
  page.on("request", (r) => { if (r.method() === "PUT") asked.push(new URL(r.url()).searchParams.get("path")); });
  await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc, builds }) => {
    localStorage.clear();
    localStorage.setItem("builder.builds", builds);
    localStorage.setItem("builder.studio", doc);
  }, {
    builds: env({ projects: [{ id: "s1", name: siteName, updatedAt: Date.now(), nudged: true }], activeId: "s1" }),
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: pics.map((p, i) => nodeFor(i, pic(p.id, p.type, Buffer.from(p.data, "base64").length))) }),
  });
  await page.evaluate(async (all) => {
    for (const p of all) {
      const bin = atob(p.data); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await new Promise((done, no) => {
        const req = indexedDB.open("builder.pictures", 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("files")) req.result.createObjectStore("files"); };
        req.onerror = () => no(req.error);
        req.onsuccess = () => { const tx = req.result.transaction("files", "readwrite"); tx.objectStore("files").put(new Blob([bytes], { type: p.type }), p.id); tx.oncomplete = () => done(); tx.onerror = () => no(tx.error); };
      });
    }
  }, pics);
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  /* Typed again until the page has hydrated and keeps it: the button stays disabled until it does. */
  for (let i = 0; i < 40 && (await page.locator('[data-account="sign-in-button"]').isDisabled()); i++) { await page.fill('[data-account="key-input"]', OWNER); await page.waitForTimeout(500); }
  await page.click('[data-account="sign-in-button"]');
  await page.waitForSelector('[data-account="signed-in"]', { timeout: 15000 });
  await page.waitForFunction(() => /saved to the account|Could not save|was not saved/.test(document.querySelector('[data-account="says"]')?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
  return { ctx, page, asked };
}
const saysOf = async (page) => (await page.textContent('[data-account="says"]').catch(() => "")) ?? "";
const files = (sub) => (existsSync(join(DIR, sub)) ? readdirSync(join(DIR, sub)) : []);

// 3. one SVG and one PNG
{
  const svgB64 = Buffer.from(DIRTY).toString("base64");
  const { ctx, page } = await signedInWith("Sol Face", [{ id: "pic_svgone", type: "image/svg+xml", data: svgB64 }, { id: "pic_pngone", type: "image/png", data: PNG }]);
  const says = await saysOf(page);
  check("a site with one SVG and one PNG is saved to the account", /1 site saved to the account/.test(says) && !/Could not save/.test(says), says);
  check("both pictures and the site are in the account", files("data/pictures").includes("pic_svgone") && files("data/pictures").includes("pic_pngone") && files("data/sites").some((f) => f.endsWith(".json")), files("data/pictures").join(", "));
  const stored = existsSync(join(DIR, "data/pictures/pic_svgone")) ? readFileSync(join(DIR, "data/pictures/pic_svgone"), "utf8") : "";
  check("what the account holds of the SVG is the cleaned drawing", /<circle/.test(stored) && !/<script|onload|javascript:/i.test(stored));
  check("the page lists nothing as skipped", (await page.locator('[data-account="skipped-row"]').count()) === 0);
  await ctx.close();
}

// 4. a picture the account does not keep
{
  const { ctx, page, asked } = await signedInWith("Mixed Site", [{ id: "pic_bmptwo", type: "image/bmp", data: BMP }, { id: "pic_pngtwo", type: "image/png", data: PNG }]);
  const says = await saysOf(page);
  check("the site is saved though one picture was refused", /1 site saved to the account/.test(says) && !/Could not save/.test(says), says);
  check("the PNG and the site are in the account, the BMP is not", files("data/pictures").includes("pic_pngtwo") && !files("data/pictures").includes("pic_bmptwo") && files("data/sites").length >= 2, files("data/pictures").join(", "));
  check("the message names the skipped picture and the server's reason", /pic_bmptwo/.test(says) && /Only pictures/.test(says), says);
  const row = await page.locator('[data-account="skipped-row"]').allInnerTexts();
  check("the page lists it under the Account", row.length === 1 && /pic_bmptwo/.test(row[0]) && /Mixed Site/.test(row[0]) && /Only pictures/.test(row[0]), J(row));
  const asks = () => asked.filter((p) => p === "data/pictures/pic_bmptwo").length;
  check("it was asked for once", asks() === 1, String(asks()));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector('[data-account="signed-in"]', { timeout: 15000 });
  await page.waitForTimeout(2500);
  check("the next page load (a sync of its own) does not ask for it again", asks() === 1, String(asks()));
  check("and does not say it again as news, though the list still names it", !/pic_bmptwo/.test(await saysOf(page)) && (await page.locator('[data-account="skipped-row"]').count()) === 1, await saysOf(page));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
