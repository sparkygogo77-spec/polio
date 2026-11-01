/**
 * A CLICK-THROUGH PART GIVES WAY TO THE WORDS UNDER THE HAND.
 *
 * sol face's hero has a 450×450 moving picture the page made
 * `pointer-events: none`, laid over the line "THE OFFICIAL FACE OF SEEING
 * GREEN". On the page a click there reaches the words; on the board the
 * picture caught it (an inert part narrower than a sheet is picked,
 * `tests/inert-picture-press.mjs`), so one press picked the picture, two
 * presses dug through to the words but did not open them (EDIT-ISSUES #50),
 * and a model driving the Builder typed into the picture three times
 * without a sign (INTERFACE-OPTIONS.md section 4: "words written into an
 * invisible box").
 *
 * Now a press on an inert part lands on the part under the hand inside it,
 * as the page's own click did (`pressRead.ts`); where nothing lies under
 * the hand the inert part is still picked and moved (trumpmorty's planet
 * keeps its rule). And two presses that go in to words open them
 * (`DesktopCanvas.tsx#go-in`): a transparent holder over words no longer
 * needs Enter after the dig.
 *
 * Held here, on a section with words under an inert picture and words under
 * a transparent holder:
 *   · the picture is what the browser hits at the words' centre (the case is real);
 *   · one press there picks the words, not the picture;
 *   · two presses there open the words in place;
 *   · one press on the picture where nothing is under picks the picture, and a drag moves it;
 *   · two presses on the holder over its words open those words.
 *
 *   npx next start -p 3013
 *   node tests/press-through-inert.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  from: { url: "https://x.test/", host: "x.test", selector: `body > main > ${id}`, at: 1 },
  ...extra,
});
const FONT = { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 500, leading: 1.3 };
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("hero", "box", 0, 0, 1440, 900, { colour: { bg: "#182030" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section", at: 1 } }),
    /* The line under the moving picture, as sol face has it. */
    node("line", "prose", 50, 181, 319, 35, { content: "THE OFFICIAL FACE OF SEEING GREEN", font: FONT, colour: { text: "#f0f0f0" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(4) > div", at: 1 } }),
    /* The click-through picture over it: fixed on the page, 450 square, narrower than a sheet. */
    node("frames", "picture", -98, 131, 450, 450, { inert: true, colour: { bg: "#60a060" }, from: { url: "https://x.test/", host: "x.test", selector: "body > div:nth-of-type(3)::frames", at: 1, position: "fixed" } }),
    /* Words under a see-through holder that is not inert: a glass panel. */
    node("hold", "prose", 700, 500, 300, 40, { content: "HOLD ME", font: FONT, colour: { text: "#f0f0f0" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(6) > p", at: 1 } }),
    node("glass", "box", 650, 450, 400, 140, { colour: { bg: "transparent" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(7)", at: 1, position: "absolute" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "THROUGH", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const doc = () => page.evaluate(() => window.__studioHistory?.doc() ?? { nodes: [] });
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const clear = async () => { await page.evaluate(() => window.__studioHistory.act("clearSelection")); await page.waitForTimeout(250); };
const centre = (id) => page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const hitAt = ([x, y]) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, [x, y]);
const editor = () => page.locator("[data-words-in-place]").count();
const closeWords = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(300); await clear(); };

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="frames"]', { timeout: 20000 });
await page.waitForTimeout(1500);

/* The words under the inert picture. */
const at = await centre("line");
check("the browser hits the inert picture at the words' centre (the case is real)", (await hitAt(at)) === "frames", `hit ${await hitAt(at)}`);
await clear();
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press there picks the words, not the picture", JSON.stringify(await selection()) === '["line"]', JSON.stringify(await selection()));
await clear();
await page.mouse.dblclick(at[0], at[1]); await page.waitForTimeout(700);
check("two presses there open the words in place", (await editor()) === 1 && JSON.stringify(await selection()) === '["line"]', `editor ${await editor()}, picked ${JSON.stringify(await selection())}`);
await closeWords();

/* The picture where nothing lies under the hand: still its own part. */
const bare = await page.evaluate(() => { const r = document.querySelector('[data-node-id="frames"]').getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.85]; });
check("nothing but the picture lies there", (await hitAt(bare)) === "frames" && (await page.evaluate(([x, y]) => { const fr = document.querySelector("[data-frame]").getBoundingClientRect(); const z = fr.width / 1440; const px = (x - fr.left) / z, py = (y - fr.top) / z; return window.__studioHistory.doc().nodes.filter((n) => n.id !== "frames" && n.id !== "hero" && px >= n.x && px <= n.x + n.w && py >= n.y && py <= n.y + n.h).length; }, bare)) === 0);
await page.mouse.click(bare[0], bare[1]); await page.waitForTimeout(500);
check("one press on the bare picture picks the picture", JSON.stringify(await selection()) === '["frames"]', JSON.stringify(await selection()));
const before = (await doc()).nodes.find((n) => n.id === "frames");
await page.mouse.move(bare[0], bare[1]); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(bare[0] + 10 * i, bare[1] + 5 * i); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(800);
const after = (await doc()).nodes.find((n) => n.id === "frames");
check("a drag there moves the picture", after.x > before.x + 20 && after.y > before.y + 10, `${before.x},${before.y} -> ${after.x},${after.y}`);
await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
await clear();

/* Words under a see-through holder that is not inert: two presses go in and open them. */
const hold = await centre("hold");
const over = await hitAt(hold);
check("the glass holder is what the browser hits over its words", over === "glass", `hit ${over}`);
await page.mouse.dblclick(hold[0], hold[1]); await page.waitForTimeout(700);
check("two presses on the holder open the words under the hand", (await editor()) === 1 && JSON.stringify(await selection()) === '["hold"]', `editor ${await editor()}, picked ${JSON.stringify(await selection())}`);
await closeWords();

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
