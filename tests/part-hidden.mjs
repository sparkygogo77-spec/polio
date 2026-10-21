/**
 * A PART SET HIDDEN IS NOT DRAWN: NOT ON THE BOARD, NOT ON THE PUBLISHED PAGE.
 *
 * J (2026-10-21): the background of thesolface.site's hero is a stack of
 * parts — its fill, the frog picture, a fade, grid lines, two glows, and over
 * them the films the capture took — and he wants each one's eye in a layer
 * list (the Look panel's), to see the hero with and without it. The eye is a
 * flag on the part, `hidden`: the board stops drawing it (it keeps its place,
 * so it can still be picked, and shows faint while it is), the published
 * page leaves it out, and the blueprint says nothing of it, since the page
 * has nothing of it to build.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/part-hidden.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* thesolface's hero, cut down: its fill, one glow over it (set hidden), and its title. */
const at = Date.now();
const from = (selector, position) => ({ url: "https://thesolface.site/", host: "thesolface.site", selector, at, ...(position ? { position } : {}) });
const part = (id, featureId, x, y, w, h, extra = {}) => ({ id, pageId: "home", featureId, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, ...extra });
const doc = {
  pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  activePageId: "home",
  nodes: [
    part("hero", "box", 0, 0, 1440, 900, { from: from("body > main > section:nth-of-type(1)"), colour: { bg: "rgb(9, 13, 27)" } }),
    part("glow", "box", 0, 0, 1440, 900, { from: from("body > main > section:nth-of-type(1) > div:nth-of-type(3)", "absolute"), art: { background: "radial-gradient(circle at 70% 40%, rgba(76, 255, 131, 0.35), rgba(0, 0, 0, 0) 60%)" }, hidden: true }),
    part("title", "value-prop", 50, 300, 708, 267, { from: from("body > main > section:nth-of-type(1) > h1"), content: "THE SOL FACE", font: { size: 6, px: 96, weight: 900, leading: 0.9 } }),
  ],
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "hidden", name: "hidden", updatedAt: Date.now() }], activeId: "hidden" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(2000);

const opacity = (id) => page.evaluate((i) => { const el = document.querySelector(`[data-node-id="${i}"]`); return el ? Number(getComputedStyle(el).opacity) : null; }, id);
check("the hidden glow keeps its place on the board", (await opacity("glow")) !== null);
check("…and is not drawn there", (await opacity("glow")) === 0, `opacity ${await opacity("glow")}`);
check("control: the title beside it is drawn", (await opacity("title")) === 1, `opacity ${await opacity("title")}`);

const exported = await page.evaluate(async () => JSON.stringify(await window.__studioExport()));
check("the export says nothing of the hidden glow", !exported.includes("\"glow\"") && !/radial-gradient\(circle at 70% 40%/.test(exported));
check("control: the export carries the title", exported.includes("THE SOL FACE"));

await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const live = await page.evaluate(() => ({ glow: !!document.querySelector('[data-live-node="glow"]'), title: !!document.querySelector('[data-live-node="title"]') }));
check("the published page leaves the hidden glow out", live.glow === false, JSON.stringify(live));
check("control: the published page draws the title", live.title === true, JSON.stringify(live));
await browser.close();

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
