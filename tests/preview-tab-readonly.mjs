#!/usr/bin/env node
/**
 * A PREVIEW IN A TAB OF ITS OWN FOLLOWS THE BUILDER AND NEVER WRITES OVER IT.
 *
 * "Open the site in a new tab" (the eye in the Preview bar) gave a second tab
 * with its own copy of the document, read once as it opened. He went on
 * restyling in the Builder tab and the Preview tab still showed the old look;
 * worse, turning a cube there saved that older copy over his newer one, and
 * the restyle was gone on the next reload. Now a tab that opened on the
 * Preview only looks (`pen.lookingOnly`, `useLookingOnly` in `load.ts`):
 *   · an edit saved in the Builder tab reaches the Preview tab without a reload;
 *   · a cube turned in the Preview tab turns there and writes nothing;
 *   · the Builder's edit is still the saved document after the Preview tab
 *     closes, and still there when the Builder reloads.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-tab-readonly.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/store/load.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/history.ts, src/features/studio/live/PreviewPage.tsx, src/features/studio/live/PublishedPage.tsx, src/features/studio/live/LiveStage.tsx
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const faces = Array.from({ length: 6 }, (_, i) => ({ heading: i ? "" : "Speed", body: "", colour: "" }));
const DOC = {
  pages: [{ id: "p", name: "Home", path: "/" }],
  activePageId: "p",
  nodes: [{ id: "n1", pageId: "p", featureId: "cube-3d", label: "Pillars", x: 40, y: 40, w: 420, h: 420, cube: { faces, turn: { x: -18, y: -32 } } }],
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const builder = await ctx.newPage();
await builder.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await builder.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "tab", name: "Tab", updatedAt: Date.now() }], activeId: "tab" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await builder.reload({ waitUntil: "networkidle" });
await builder.waitForFunction(() => typeof window.__studioLoadDoc === "function" && typeof window.__studioSetFormat === "function", null, { timeout: 30000 });
await builder.evaluate((d) => window.__studioLoadDoc(d), DOC);
await builder.evaluate(() => window.__studioSetFormat("concept.audience", "first"));
await builder.waitForTimeout(1500);

/** The saved document as the next load reads it (small enough to sit whole in the mirror). */
const saved = (pg) => pg.evaluate(() => localStorage.getItem("builder.studio"));
const savedState = async (pg) => { try { return JSON.parse(await saved(pg)).state ?? {}; } catch { return {}; } };
check("the Builder saved the seeded cube and its edit", (await savedState(builder)).format?.["concept.audience"] === "first" && (await savedState(builder)).nodes?.some((n) => n.id === "n1"));

const preview = await ctx.newPage();
await preview.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await preview.waitForFunction(() => typeof window.__studioLiveTurn === "function", null, { timeout: 30000 });
await preview.waitForTimeout(800);
check("the Preview tab opens on the saved document", (await preview.evaluate(() => window.__studioLiveFormat("concept.audience"))) === "first");

/* The Builder goes on editing after the Preview tab opened. */
await builder.bringToFront();
await builder.evaluate(() => window.__studioSetFormat("concept.audience", "second"));
await builder.waitForTimeout(1500);
check("the Builder saved its later edit", (await savedState(builder)).format?.["concept.audience"] === "second");
await preview.bringToFront();
const seen = await preview.waitForFunction(() => window.__studioLiveFormat("concept.audience") === "second", null, { timeout: 5000 }).then(() => true, () => false);
check("the Preview tab shows the later edit without a reload", seen, String(await preview.evaluate(() => window.__studioLiveFormat("concept.audience"))));

/* Turning the cube in the Preview tab writes nothing; the Builder edits again so a stale tab has something to overwrite. */
await builder.evaluate(() => window.__studioSetFormat("concept.audience", "third"));
await builder.waitForTimeout(1500);
const before = await saved(builder);
await preview.evaluate(() => window.__studioLiveTurn("n1", { x: 30, y: 60 }));
await preview.waitForTimeout(1200);
check("the turn writes nothing from the Preview tab", (await saved(builder)) === before);
await preview.close({ runBeforeUnload: true });
await builder.waitForTimeout(800);
check("the Builder's edit is still the saved document after the Preview tab closes", (await savedState(builder)).format?.["concept.audience"] === "third", String((await savedState(builder)).format?.["concept.audience"]));
await builder.reload({ waitUntil: "networkidle" });
await builder.waitForFunction(() => typeof window.__studioPublishDoc === "function", null, { timeout: 30000 });
await builder.waitForTimeout(1000);
const after = await savedState(builder);
check("and the Builder reloads on it", after.format?.["concept.audience"] === "third" && after.nodes?.some((n) => n.id === "n1"), String(after.format?.["concept.audience"]));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
