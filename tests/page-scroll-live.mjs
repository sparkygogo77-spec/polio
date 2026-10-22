/**
 * A page's scroll setting reaches the preview.
 *
 * The Pages panel and the page menu offer a scroll behaviour per page:
 * normal, snap to sections, smooth / inertial, horizontal, scroll-driven
 * story, paged. It reached the blueprint and nothing else; the live page
 * scrolled the same whatever was chosen. The three the preview can do it
 * does now, and the two it cannot it names in the corner note beside the
 * other behaviours it describes rather than fakes.
 *
 *   node tests/page-scroll-live.mjs [url]
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const part = (id, pageId, y, h = 200) => ({ id, pageId, featureId: "cta", label: "Join", prompt: "", content: "", x: 0, y, w: 1440, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });

const seed = async (scroll) => {
  await page.evaluate((scroll) => {
    /*
     * The page is made here rather than found, because on a cold profile
     * there is nothing to find.
     *
     * This read the store, mapped over `st.pages ?? []` and wrote the result
     * back. That worked only while something wrote the store on load — and
     * the fit used to, on every mount, which is the very thing that was
     * overwriting people's saved boards and has since been stopped. With
     * nothing written, `pages` mapped over an empty list, the store was
     * replaced by `{state:{pages:[]}}`, and the preview answered "This page
     * couldn't load" with no [data-live-scroller] on it at all — so this
     * suite hung on a locator rather than failing a check.
     *
     * A page that does not exist is made, with the same shape `firstPage()`
     * gives it in store.ts.
     */
    const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    const st = doc.state ?? {};
    if (!st.pages?.length) {
      st.pages = [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
      st.activePageId = "page_home";
    }
    const pageId = st.activePageId ?? st.pages[0].id;
    st.pages = st.pages.map((p) => (p.id === pageId ? { ...p, scroll } : p));
    st.nodes ??= []; st.groups ??= []; st.shapes ??= []; st.spaces ??= [];
    st.format ??= {}; st.look ??= {}; st.motion ??= [];
    st.frameWidth ??= 1440;
    doc.state = st;
    doc.version ??= 0;
    localStorage.setItem("builder.studio", JSON.stringify(doc));
  }, scroll);
  await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  return page.locator("[data-live-scroller]").first().evaluate((el) => ({ snap: el.style.scrollSnapType, smooth: el.style.scrollBehavior, scripted: document.querySelector("[data-snap]")?.getAttribute("data-snap") ?? "" }));
};
const note = () => page.locator("[data-live-described]").evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? "").join(" | "));

const normal = await seed("normal");
check("a normal page neither snaps nor smooths", !normal.snap && !normal.smooth, JSON.stringify(normal));
const snap = await seed("snap to sections");
/* Up and down is the script's now, section by section (LiveShell: only sideways snapping stays the browser's), and the shell says so in data-snap. */
check("snap to sections makes the live page snap", /^y/.test(snap.snap) || snap.scripted === "vertical", JSON.stringify(snap));
const smooth = await seed("smooth / inertial");
check("smooth / inertial makes it scroll smoothly", smooth.smooth === "smooth", JSON.stringify(smooth));
const sideways = await seed("horizontal");
check("horizontal snaps along x", /^x/.test(sideways.snap), JSON.stringify(sideways));
await seed("paged");
check("paged is named in the corner note as described only", /paged/i.test(await note()), await note());
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
