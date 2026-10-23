#!/usr/bin/env node
/**
 * A HEADING'S "SIZE IN PIXELS" IS THE SIZE IT IS DRAWN AT.
 *
 * A heading (value-prop) is drawn at 1.6 times the size its part stores
 * (`Hero.tsx`), so the side panel showed 58 for a heading drawn at 92, and
 * typing 92 drew 147. The panel converts: it shows what is drawn and what is
 * typed is what is drawn. The part is not changed.
 *
 *   node tests/heading-size-panel.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(AT && existsSync(AT) ? { executablePath: AT } : {}) });
const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, featureId, size, from) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content: "Heading words", data: "", x: 100, y: 100, w: 700, h: 200, groupId: null, options: {}, priority: "must", custom: false, ...(size ? { font: { size } } : {}), ...(from ? { from: { selector: from } } : {}) });

async function run(label, featureId, from, N = 92) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${URL}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ doc }) => { localStorage.clear(); localStorage.setItem("builder.studio", doc); }, {
    doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [node("h", featureId, 2, from)], frameWidth: 1440 }),
  });
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const bb = await page.locator('[data-node-id="h"]').first().boundingBox();
  await page.mouse.click(bb.x + 20, bb.y + 20);
  await page.waitForTimeout(500);
  const input = page.locator('input[aria-label="Size in pixels"]').first();
  const drawn = () => page.evaluate(() => { const p = document.querySelector('[data-node-id="h"] p, [data-node-id="h"] [data-part] > *'); return p ? parseFloat(getComputedStyle(p).fontSize) : null; });
  const d0 = await drawn();
  check(`${label}: the box shows the size it is drawn at`, Math.abs(Number(await input.inputValue()) - d0) <= 1, `shows ${await input.inputValue()}, drawn ${d0}`);
  await input.fill(String(N));
  await page.waitForTimeout(500);
  const d1 = await drawn();
  check(`${label}: typing ${N} draws ${N}`, d1 !== null && Math.abs(d1 - N) <= 1, `drawn ${d1}`);
  await page.close();
}
await run("a captured heading", "value-prop", "h1");
/* A part made here keeps its size between 0.6 and 2 times the base, so 92 would be held at 51; 40 is inside. */
await run("a heading made here", "value-prop", null, 40);

await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
