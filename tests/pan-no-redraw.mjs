/**
 * A pan moves the board, and redraws none of the parts on it.
 *
 * THE OWNER'S REPORT (2026-10-06): panning was extremely laggy. Every part is
 * a `React.memo`, but the board handed each one a fresh `page={{ w, h }}` and
 * a fresh lead-in copy of its node on every render, and a pan renders the
 * board on every move — so all of them redrew every time. With 300 parts one
 * short pan cost about 2s of script and ran near 30 frames a second; with the
 * props kept stable, about 0.2s and 90.
 *
 * Counted, not timed, so it holds on any machine: a React DevTools hook is put
 * in before the page loads, and each commit during a middle-button pan counts
 * the parts (the memo whose first element carries `data-node-id`) that did
 * render work.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/pan-no-redraw.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx, src/features/studio/board/NodeView.tsx
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const PARTS = 120;
const node = (id, featureId, label, x, y, w, h) => ({
  id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const kinds = ["feature-cards", "cta-primary", "hero-split"];
const nodes = Array.from({ length: PARTS }, (_, i) => node(`n${i}`, kinds[i % 3], `Part ${i}`, 40 + (i % 4) * 340, 40 + Math.floor(i / 4) * 120, 320, 110));
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "PAN", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

/* Runs in the page before React: React finds the hook and reports each commit. */
const HOOK = () => {
  window.__counting = false;
  window.__partRenders = 0;
  window.__commits = 0;
  const firstHost = (f) => { while (f && f.tag !== 5) f = f.child; return f; };
  const walk = (f) => {
    for (; f; f = f.sibling) {
      if (f.tag === 14 || f.tag === 15) {
        const host = firstHost(f.child);
        if (host?.stateNode?.hasAttribute?.("data-node-id") && (f.flags & 1)) window.__partRenders++;
      }
      walk(f.child);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), isDisabled: false, checkDCE() {},
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    onScheduleFiberRoot() {}, onPostCommitFiberRoot() {}, onCommitFiberUnmount() {},
    onCommitFiberRoot(_id, root) { if (!window.__counting) return; window.__commits++; walk(root.current.child); },
  };
};

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}),
});
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript(HOOK);
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const drawn = await page.locator("[data-node-id]").count();
check("the parts are on the board", drawn >= PARTS, `${drawn} of ${PARTS}`);

const before = await page.locator("[data-frame]").first().boundingBox();
await page.mouse.move(760, 520);
await page.mouse.down({ button: "middle" });
await page.evaluate(() => { window.__counting = true; window.__partRenders = 0; window.__commits = 0; });
for (let i = 0; i < 30; i++) await page.mouse.move(760 - i * 6, 520);
await page.waitForTimeout(100);
const pan = await page.evaluate(() => ({ renders: window.__partRenders, commits: window.__commits }));
await page.mouse.up({ button: "middle" });
const after = await page.locator("[data-frame]").first().boundingBox();
const moved = before && after ? Math.round(Math.abs(after.x - before.x)) : 0;

check("the pan moved the board", moved > 60, `${moved}px`);
check("the board rendered under the hand (so the count means something)", pan.commits >= 10, `${pan.commits} commits`);
check("no part redrew while panning", pan.renders === 0, `${pan.renders} part renders over ${pan.commits} commits (was ${PARTS} a commit)`);

/* And the hook does see parts that should redraw: picking every part changes each one's `selected`. */
await page.evaluate(() => { window.__partRenders = 0; window.__commits = 0; });
await page.mouse.click(1420, 880);
await page.keyboard.press("Control+a");
await page.waitForTimeout(400);
const picked = await page.evaluate(() => window.__partRenders);
check("picking every part redraws them (the counter is live)", picked >= PARTS, `${picked} part renders`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
