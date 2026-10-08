/**
 * A screenshot that was cut says so.
 *
 * The page screenshot that goes to Claude beside an ask is capped at 6000px
 * tall, and the window is sized to the page or to the cap, whichever is
 * less. A page taller than that lost the rest, and the picture went up
 * labelled "top to bottom". The route says when it cut and how tall the
 * page really was, and the label says what the picture is.
 *
 *   node tests/shot-cut.mjs [url]
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

const shoot = async (nodes) => {
  const res = await fetch(`${URL_}/api/studio/screenshot`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ doc: { pages: [{ id: "p1", name: "Home", path: "/" }], nodes, activePageId: "p1", frameWidth: 1440 }, path: "/builder/preview", device: "desktop", width: 1280 }),
  });
  return { ct: res.headers.get("content-type") ?? "", cut: res.headers.get("x-shot-cut"), height: res.headers.get("x-shot-height"), bytes: (await res.arrayBuffer()).byteLength };
};
const short = await shoot([part("a", "p1", 0)]);
check("a short page is photographed whole", short.ct.startsWith("image/png") && short.bytes > 1000, `${short.ct}, ${short.bytes} bytes`);
check("and is not marked as cut", short.cut === null, String(short.cut));
const tall = await shoot([part("a", "p1", 0), part("b", "p1", 7400)]);
check("a page past the cap is still photographed", tall.ct.startsWith("image/png") && tall.bytes > 1000, `${tall.ct}, ${tall.bytes} bytes`);
check("and the answer says it was cut", tall.cut === "1", String(tall.cut));
/* The site is drawn at 1440 and photographed at 1280, so the page is 1280/1440 of its own height: 7600 becomes about 6755. */
check("and how tall the page really was, past the cap", Number(tall.height) > 6000 && Number(tall.height) >= Math.floor(7600 * 1280 / 1440) - 10, String(tall.height));
check("the label the picture goes up with reads the cut", /x-shot-cut/.test(bare("src/features/studio/loop/agent.ts")) && !/top to bottom:`,/.test(bare("src/features/studio/loop/agent.ts")));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
