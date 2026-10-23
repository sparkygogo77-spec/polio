/**
 * A PART THAT TURNS AS IT PLAYS KEEPS ITS WIDTH, EDIT AFTER EDIT.
 *
 * thesolface.site's "✳" on its first "how to buy" card spins (`rotate`, 22s,
 * forever). On a fresh import it widened by a few pixels at every edit made
 * anywhere on the page: 67 → 88 → 91 → 96 (the hand-edit pass, 2026-10-22).
 * The settle reads the width a one-line part's words need (`textFit.ts
 * #lineWidth`) off the words as drawn, and a turned glyph's box is wider at
 * every angle but the first; it only ever widens, so each read kept the last.
 *
 * Held here, a spinning one-line "✳" and a heading elsewhere edited by hand:
 *   · the "✳" is playing on the board (control);
 *   · as it lands, and after five edits elsewhere each followed by the settle,
 *     its width is the 67px it was given, which its words fit unturned.
 *
 *   npx next start -p 3013
 *   node tests/measure-still.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const from = (selector, position) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1, ...(position ? { position } : {}) } });
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("card", "box", "", 200, 200, 400, 400, { colour: { bg: "#10202a" }, ...from("body > main > article") }),
    node("star", "prose", "✳", 292, 250, 67, 106, {
      colour: { text: "rgb(32, 252, 125)" }, font: { face: "Arial Black", stack: "\"Arial Black\", Impact, sans-serif", size: 4.75, px: 76, weight: 400, leading: 1.36, leadingNormal: true },
      art: { origin: "33.76px 53px", animation: "rotate" },
      motion: { animation: [{ name: "rotate", duration: "3s", timing: "linear", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] },
      ...from("body > main > article > div:nth-of-type(2)", "absolute"),
    }),
    node("head", "value-prop", "EDIT ME", 700, 200, 400, 60, { ...from("body > main > h2") }),
  ],
  keyframes: [{ name: "rotate", frames: [{ key: "100%", style: { transform: "rotate(360deg)" } }] }],
  look: { keyframes: [{ name: "rotate", frames: [{ key: "100%", style: { transform: "rotate(360deg)" } }] }] },
  groups: [], shapes: [], format: {}, brief: { name: "STILL", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="star"]', { timeout: 20000 });
await page.waitForTimeout(3000);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);

const playing = await page.evaluate(() => document.querySelector('[data-node-id="star"]').getAnimations({ subtree: true }).length);
check("the ✳ is playing on the board (control)", playing > 0, `${playing} animation(s)`);
const w0 = (await nodeOf("star")).w;
const widths = [];
for (let i = 0; i < 5; i++) {
  const b = await page.locator('[data-node-id="head"]').boundingBox();
  await page.mouse.click(1420, 880);
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(400);
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700 + i * 310);
  widths.push((await nodeOf("star")).w);
}
check("as it lands and after five edits elsewhere, the ✳ keeps the 67px it was given (its words fit it, turned or not)", w0 === 67 && widths.every((w) => w === 67), `after landing ${w0}, then ${widths.join(", ")}`);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
