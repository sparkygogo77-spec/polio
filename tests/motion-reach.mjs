/**
 * A motion crate says where it reaches (inventory B27), and now it reaches
 * the page.
 *
 * The Motion panel builds a crate: five keyframes, the Builder mixes between
 * them, you scrub it, play it, take it away as a sprite sheet. It goes into
 * the blueprint as a brief and, put on a part, plays as that part's picture
 * on the board, in the preview and on the published page
 * (`crateLayer.tsx`). This holds the panel to the code:
 *
 *   · that the renderer draws a part's crate, and the export writes its
 *     strip, is read off their own source (a source read, named as one);
 *   · the blueprint carries the crate (a browser read of the compiled brief);
 *   · the panel says all of it, with a crate and with none, and a crate on
 *     no part says it is on no part yet.
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

/* 1. Who plays a crate, off the source. */
const blocks = readFileSync("src/features/studio/blocks.tsx", "utf8");
check("every part is drawn with the crate it wears, on every surface (source read)", /<CrateOn\b/.test(blocks));
check("the export writes each worn crate's strip as a file and its rule into the stylesheet (source read)", /assets\/crates\//.test(readFileSync("src/features/studio/exportSite.ts", "utf8")) && /CRATE_CSS/.test(readFileSync("src/features/studio/exportSite.ts", "utf8")));
const consumers = ["src/features/studio/spec.ts", "src/features/studio/BriefDialog.tsx"].filter((f) => /\bmotion\b/.test(readFileSync(f, "utf8")));
check("the blueprint compiler and its dialog read it too (source read)", consumers.length === 2, consumers.join(", "));

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
const honest = (t) => /blueprint/i.test(t) && /part/i.test(t) && /board/i.test(t) && /preview/i.test(t) && /published/i.test(t);
check("with no crate it says where a crate reaches: the blueprint, and the part it is put on, on the board, in the preview and published", honest(await says()), (await says()) || "no such line");

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
check("and the same line stands over it", honest(await says()), (await says()) || "no such line");
check("the crate's card says it is on no part yet", /Not on a part yet/.test(await panel.locator("[data-crate-card] [data-crate-worn]").innerText().catch(() => "")));
await panel.getByRole("button", { name: /Open editor/ }).first().click();
await page.waitForTimeout(700);
const editor = page.locator("[data-crate-editor]");
check("a crate with two sleeves filled plays in its editor", (await editor.locator("[data-motion-canvas]").count()) === 1 && (await editor.getByLabel(/play the sequence|pause/i).count()) === 1);
check("…which says where it would play once put on a part", /Not on a part yet.*board.*preview.*published/i.test((await editor.locator("[data-crate-worn]").innerText().catch(() => "")).replace(/\s+/g, " ")));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

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
