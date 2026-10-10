#!/usr/bin/env node
/**
 * BACK TO TOP IS A BUTTON YOU PUT WHERE IT GOES.
 *
 * J (2026-10-10): "The back to top motion element should also instead of
 * being a switch for this site allow me to place where the button will be
 * since it is too close to the border for me in the preview".
 *
 *   1. Where it was put becomes a distance from the nearest corner
 *      (`live/corner.ts`), never closer than 16px; an old page-wide strip
 *      keeps the default, bottom right 24px in.
 *   2. Publish names that corner on :root, and the kit's file
 *      (vendor/builder-motion.js) puts the button there, fixed, with a
 *      stable hook.
 *   3. The board draws it as a part (no chip in the whole-site row), and the
 *      Preview keeps it at that corner of the window once scrolled.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/back-to-top-placed.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/corner.ts, src/features/studio/live/behaviours.ts, src/features/studio/live/LiveShell.tsx, src/features/studio/send-out/kitMotion.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/shelf/library/siteMotion.ts, src/features/studio/board/DesktopCanvas.tsx, kit/starter/vendor/builder-motion.js
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "live", "corner.ts"));
const S = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* 1. */
const btn = (x, y) => ({ featureId: "back-to-top", x, y, w: 44, h: 44 });
const br = C.cornerOf(btn(1440 - 44 - 60, 900 - 44 - 80), 1440, 2000);
check("1. Put low on the right of the first screen: bottom right, 60 in and 80 up", br.v === "bottom" && br.h === "right" && br.x === 60 && br.y === 80 && br.size === 44, JSON.stringify(br));
const tl = C.cornerOf(btn(40, 120), 1440, 2000);
check("…put high on the left: top left, 40 and 120 in", tl.v === "top" && tl.h === "left" && tl.x === 40 && tl.y === 120, JSON.stringify(tl));
const tight = C.cornerOf(btn(1440 - 44 - 2, 900 - 44), 1440, 2000);
check("…never against the border: 16px at least", tight.x === 16 && tight.y === 16, JSON.stringify(tight));
const foot = C.cornerOf(btn(1300, 1900), 1440, 2000);
check("…put at the foot of a long page: bottom, measured from the page's foot", foot.v === "bottom" && foot.y === 56, JSON.stringify(foot));
const strip = C.cornerOf({ featureId: "back-to-top", x: 0, y: 0, w: 1440, h: 64 }, 1440, 2000);
check("…an old page-wide strip keeps the default, bottom right 24px in", JSON.stringify(strip) === JSON.stringify(C.CORNER_DEFAULT) && strip.x === 24 && strip.y === 24, JSON.stringify(strip));

/* 2. */
const saved = readBoard("pst");
const doc = boardDoc(saved);
const home = doc.pages[0];
const palette = { ...(doc.look.palette ?? {}), accent: "#e8ff6a", surface: "#101010" };
const placed = { id: "n_back", pageId: home.id, featureId: "back-to-top", label: "Back to top", content: "", prompt: "", options: {}, x: 40, y: 900 - 44 - 100, w: 44, h: 44 };
const layer = S.buildLayer([...doc.nodes, placed], palette, doc.look.styleSource, { kit: true });
const root = layer.rules.find((r) => r.selector === ":root")?.declarations ?? [];
check("2. Publish names the corner on :root", root.includes('--builder-site-motion: "back-to-top?h=left&x=40&y=100"'), root.join("; "));
const kit = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p.setContent(`<!doctype html><html><head><style>:root { --builder-site-motion: "back-to-top?v=top&h=left&x=40&y=60"; --builder-motion-accent: #e8ff6a; }</style></head>
    <body data-hook="page" style="margin:0"><div data-hook="spacer" style="height:3000px"></div><script>${kit.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.evaluate(() => window.scrollTo(0, 800));
  await p.waitForTimeout(100);
  const got = await p.evaluate(() => { const b = document.querySelector('[data-builder-motion="back-to-top"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { left: r.left, top: r.top, pos: getComputedStyle(b).position, shown: getComputedStyle(b).display }; });
  check("…the kit's file puts the button there, fixed, marked data-builder-motion (a script never sets a hook, kit rule)", !!got && got.left === 40 && got.top === 60 && got.pos === "fixed" && got.shown === "block", JSON.stringify(got));
  await p.setContent(`<!doctype html><html><head><style>:root { --builder-site-motion: "back-to-top"; }</style></head><body style="margin:0"><div style="height:3000px"></div><script>${kit.replace(/<\/script/g, "<\\/script")}</script></body></html>`);
  await p.evaluate(() => window.scrollTo(0, 800));
  await p.waitForTimeout(100);
  const plain = await p.evaluate(() => { const r = document.querySelector('[data-builder-motion="back-to-top"]').getBoundingClientRect(); return { right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
  check("…with no corner named: bottom right, 24px in", plain.right === 24 && plain.bottom === 24, JSON.stringify(plain));

  /* 3. */
  const board = structuredClone(saved);
  const put = (raw) => { const v = JSON.parse(raw); v.state.nodes = [...v.state.nodes, placed]; return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = put(row.value);
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  const onBoard = await ui.evaluate(() => ({ box: !!document.querySelector('[data-node-id="n_back"]'), chip: !!document.querySelector('[data-site-wide-chip="back-to-top"]') }));
  check("3. The board draws it as a part you can drag, not a whole-site chip", onBoard.box === true && onBoard.chip === false, JSON.stringify(onBoard));
  await ui.locator('[aria-label="Preview"]').first().click();
  await ui.waitForTimeout(2500);
  await ui.evaluate(() => { const s = document.querySelector("[data-live-shell]")?.closest("[data-live-scroller]"); if (s) s.scrollTop = 600; });
  await ui.waitForTimeout(600);
  const live = await ui.evaluate(() => {
    const s = document.querySelector("[data-live-shell]")?.closest("[data-live-scroller]");
    const b = document.querySelector("[data-live-back-to-top]");
    if (!s || !b) return null;
    const w = s.getBoundingClientRect(), r = b.getBoundingClientRect();
    return { corner: b.getAttribute("data-live-back-to-top"), left: Math.round(r.left - w.left), bottom: Math.round(w.top + s.clientHeight - r.bottom) };
  });
  check("…the Preview keeps it at that corner of the window once scrolled", !!live && live.corner === "bottom-left" && Math.abs(live.left - 40) <= 2 && Math.abs(live.bottom - 100) <= 2, JSON.stringify(live));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
