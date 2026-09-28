/**
 * A motion crate says where it reaches (inventory B27).
 *
 * The Motion panel builds a crate: five keyframes, the Builder dissolves
 * between them, you scrub it, play it, take it away as a sprite sheet. The
 * crate then goes into the blueprint as a brief, and that is as far as it
 * goes: no live part on the page plays a crate, no part can be told to wear
 * one. Nothing in the panel said so, so a person who filled a crate and then
 * looked at the preview for it was left to guess. This holds the panel to
 * the code:
 *
 *   · that no renderer reads a crate is derived from the renderers' own
 *     source (a source read, named as one);
 *   · the blueprint carries the crate (a browser read of the compiled brief);
 *   · the panel says both, with a crate open and with none.
 *
 *   node tests/motion-reach.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. Who reads a crate, off the source. */
const files = (dir) => readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => `${dir}/${f}`);
const RENDERERS = [...files("src/features/studio/live"), ...files("src/features/studio/parts"), "src/features/studio/blocks.tsx"];
/* A crate is the studio's `motion` list, read off the store. A part's own
   `motion` — what a captured run did on the page it came from (a span's
   `s.motion.animation`, parts/capturedMotion.ts) — is not a crate, and
   reading it is not playing one. */
const readers = RENDERERS.filter((f) => /MotionAsset|useStudio\([^)]*\.motion\b|getState\(\)\.motion\b/.test(readFileSync(f, "utf8")));
check(`no renderer reads a crate: ${RENDERERS.length} renderer files, ${readers.length} mention one (source read)`, readers.length === 0, readers.join(", ") || "none");
const consumers = ["src/features/studio/spec.ts", "src/features/studio/BriefDialog.tsx"].filter((f) => /\bmotion\b/.test(readFileSync(f, "utf8")));
check("the blueprint compiler and its dialog do (source read)", consumers.length === 2, consumers.join(", "));

/* 2. The panel, with no crate. */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(500);
const panel = page.locator("[data-motion-panel]");
check("the Motion panel opens", (await panel.count()) === 1);
const reach = () => panel.locator("[data-motion-reach]");
const says = async () => ((await reach().count()) ? (await reach().first().innerText()).replace(/\s+/g, " ").trim() : "");
const honest = (t) => /blueprint/i.test(t) && /(preview|page)/i.test(t) && /(does not|no part|nothing)/i.test(t);
check("with no crate it says where a crate reaches: the blueprint, and no part of the page plays it", honest(await says()), (await says()) || "no such line");

/* 3. A crate, two sleeves filled: the line stays, the blueprint carries it. */
const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
await page.evaluate((px) => {
  const raw = localStorage.getItem("builder.studio");
  const d = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  d.state.motion = [{ id: "mo_reach", name: "Motion 1", frames: [px, px, null, null, null], duration: 1.5, fps: 30, loop: "wrap", hold: 2, gaps: [1, 1, 1, 1, 1], ease: "ease", use: "the header's backdrop" }];
  localStorage.setItem("builder.studio", JSON.stringify(d));
}, PX);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(500);
check("a crate with two sleeves filled plays in the panel", (await panel.locator("[data-motion-canvas]").count()) === 1 && (await panel.getByLabel(/play the sequence|pause/i).count()) === 1);
check("and the same line stands under it", honest(await says()), (await says()) || "no such line");

await page.keyboard.press("Control+Enter");
await page.waitForTimeout(1500);
const brief = (await page.locator("[data-brief-body]").allInnerTexts()).join("\n");
check("the blueprint carries the crate as a brief, on its own timing", /Motion assets/.test(brief) && /the header's backdrop/.test(brief) && /1\.5 ?s|45 frames|30 fps/.test(brief), brief.split("\n").find((l) => /backdrop/.test(l))?.slice(0, 120) ?? "not in the brief");
await page.keyboard.press("Escape");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
