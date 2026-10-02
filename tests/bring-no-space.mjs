#!/usr/bin/env node
/**
 * A REPOSITORY COMES IN WITHOUT A SPACE, AND LANDS WHERE IT ALWAYS DID.
 *
 * The audit (B): Bring it in drew a square space on the board, picked it,
 * and opened its panel on the right — the box and green menu of the drawing
 * tool it borrowed the importer from — and a plain page's import left that
 * space locked round the page afterwards. The import runs out of sight now:
 * at no moment is there a space or a space's panel, what it is doing is
 * said in the toast and the strip across the top of the board, and every
 * part lands exactly where it landed before (measured on trunk b69ae07).
 *
 * GitHub is a stand-in served in the browser; the token is a placeholder.
 *
 *   node tests/bring-no-space.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
/* Where him/page's parts land: its header's box at the page's width from the top, then its heading and line inside the header's 40px padding.
   On trunk b69ae07 the page landed as two bands of words (value-prop 0,0,1440,218.25 and 0,218.25,1440,252); a page read from a
   repository's files comes in element by element now (`pageParts.ts`, tests/plain-page.mjs), so these are the parts it lands as. */
const BEFORE = process.env.BRING_BASELINE ? JSON.parse(process.env.BRING_BASELINE) : [{"featureId":"box","x":0,"y":0,"w":1440,"h":196},{"featureId":"prose","x":40,"y":61,"w":1360,"h":38},{"featureId":"prose","x":40,"y":121,"w":1360,"h":19}];

const PAGE = `<!doctype html><html><head><title>A page</title><style>body{margin:0;font-family:sans-serif}header{padding:40px;background:#123;color:#fff}main{padding:40px}</style></head>
<body><header><h1>Blackorb</h1><p>A small studio for small things.</p></header>
<main><section><h2>What we make</h2><p>Sites, mostly. Some of them for other people.</p><a href="#" style="display:inline-block;padding:12px 20px;background:#e63;color:#fff">Say hello</a></section></main></body></html>`;
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: J(b) });
  if (u.pathname === "/repos/him/page") return j({ default_branch: "main", homepage: "" });
  if (u.pathname.startsWith("/repos/him/page/git/trees/")) return j({ tree: [{ path: "index.html", type: "blob", sha: "p1", size: PAGE.length }] });
  if (u.pathname === "/repos/him/page/git/blobs/p1") return j({ encoding: "base64", content: Buffer.from(PAGE).toString("base64") });
  return j({ message: "no" }, 404);
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); const env = (state) => JSON.stringify({ state, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(500);

await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(600);
await page.locator("[data-repo-bring]").fill("him/page");
await page.locator("[data-repo-pull]").click();
/* Watched every 100ms from the press until the parts are down. */
const seen = { spaces: 0, panels: 0, toast: false, strip: false };
let parts = [];
for (let i = 0; i < 200; i++) {
  await page.waitForTimeout(100);
  const now = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
    return {
      spaces: Math.max((st.spaces ?? []).length, document.querySelectorAll("[data-space-id]").length),
      panels: document.querySelectorAll("[data-space-panel]").length,
      toast: /him\/page/.test(document.body.innerText),
      strip: !!document.querySelector("[data-import-strip]"),
      nodes: (window.__studioPublishDoc?.().nodes ?? []).map((n) => ({ featureId: n.featureId, x: n.x, y: n.y, w: n.w, h: n.h })),
    };
  });
  seen.spaces = Math.max(seen.spaces, now.spaces); seen.panels = Math.max(seen.panels, now.panels);
  seen.toast ||= now.toast; seen.strip ||= now.strip;
  parts = now.nodes;
  if (parts.length >= 2 && i > 20) break;
}
await page.waitForTimeout(2500);
parts = await page.evaluate(() => (window.__studioPublishDoc?.().nodes ?? []).map((n) => ({ featureId: n.featureId, x: n.x, y: n.y, w: n.w, h: n.h })));
const after = await page.evaluate(() => ({ spaces: (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.spaces ?? []).length, panel: !!document.querySelector("[data-space-panel]"), picked: JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.selection ?? [] }));
console.log(`  (parts: ${J(parts)})`);
check("the page's parts landed", parts.length >= 2, `${parts.length} parts`);
check("at no moment was there a space on the board", seen.spaces === 0 && after.spaces === 0, `${seen.spaces} seen, ${after.spaces} after`);
check("…nor a space's panel on the right", seen.panels === 0 && !after.panel, `${seen.panels} seen`);
check("what it was doing was said in the toast", seen.toast);
check("…and in the strip across the top of the board", seen.strip);
check("every part lands exactly where it landed before", J(parts.slice(0, BEFORE.length)) === J(BEFORE), `${J(parts)} against ${J(BEFORE)}`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
