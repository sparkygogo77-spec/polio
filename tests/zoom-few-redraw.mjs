/**
 * A zoom redraws the picked part, not every part on the board.
 *
 * THE OWNER'S ASK (2026-10-06): make the board lighter on big sites. Every
 * part took the zoom as a prop, only to size its hover chips at 1/zoom, so
 * each zoom step redrew all of them (on a PonsStars import, 399 parts). The
 * chips now read `--chip-scale` off the board, and only a picked part, or one
 * wearing a question, still takes the zoom for its mark and handles.
 *
 * Counted, not timed: the React DevTools hook counts the parts that did render
 * work during a Ctrl+wheel zoom with one part picked.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/zoom-few-redraw.mjs http://127.0.0.1:3013
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

/* One part picked */
const b = await page.locator('[data-node-id="n1"]').boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(400);
const scaleOf = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-board-zoom]")).getPropertyValue("--chip-scale").trim());
const zoomOf = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-board-zoom]")).zoom);
const z0 = await zoomOf();

await page.evaluate(() => { window.__counting = true; window.__partRenders = 0; window.__commits = 0; });
await page.mouse.move(760, 520);
await page.keyboard.down("Control");
await page.mouse.wheel(0, 300);
await page.keyboard.up("Control");
await page.waitForTimeout(500);
const zoomRenders = await page.evaluate(() => ({ renders: window.__partRenders, commits: window.__commits }));
const z1 = await zoomOf();
check("the board zoomed", z1 !== z0, `${z0} -> ${z1}`);
check("only the picked part redrew", zoomRenders.renders <= zoomRenders.commits * 2 && zoomRenders.renders < PARTS / 4, `${zoomRenders.renders} part renders over ${zoomRenders.commits} commits (was ${PARTS} a commit)`);
const sc = Number(await scaleOf());
check("the chips' scale follows the zoom", Math.abs(sc - Math.max(1, 1 / (Number(z1) || 1))) < 0.02, `--chip-scale ${sc}, zoom ${z1}`);
const chip = await page.evaluate(() => { const el = document.querySelector('[data-node-id="n7"]'); return [...el.querySelectorAll("div")].map((d) => d.style.transform).find((t) => t.includes("--chip-scale")) ?? ""; });
check("an unpicked part's chip reads the board's scale", chip.includes("var(--chip-scale"), chip);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
