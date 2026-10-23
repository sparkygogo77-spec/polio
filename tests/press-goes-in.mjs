/**
 * TWO PRESSES PICK THE PICTURE INSIDE A LINK OR A CARD.
 *
 * Found in the hand-edit pass on fresh imports: one press on sol face's logo
 * picture picks the logo link that holds it, as one press on anything in a
 * control does (`owner.ts#ownerOf`). Two presses on words open the words, and
 * two on a part that holds others go in; but two presses on a picture or an
 * icon kept the link, so the logo picture, the stickers on the "how to buy"
 * cards, mochi's nav icons and sunkcoin's wallet icon could not be picked at
 * all: not swapped, not resized, not deleted on their own.
 *
 * Held here, on a captured link holding a picture and a card holding one:
 *   · one press on the picture picks the link (and the card);
 *   · two presses pick the picture itself;
 *   · Escape steps back out to the link;
 *   · two presses on a button's words still open the words.
 *
 *   npx next start -p 3013
 *   node tests/press-goes-in.mjs http://127.0.0.1:3013
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
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("logo", "box", "", 100, 100, 300, 80, { data: "link, named HOME", link: { kind: "page", target: "p0" }, colour: { bg: "#223355" }, ...from("body > header > a") }),
    node("logo_pic", "picture", "", 110, 110, 60, 60, { ...from("body > header > a > img") }),
    node("logo_words", "value-prop", "THE SITE", 190, 120, 180, 40, { ...from("body > header > a > span") }),
    node("card", "box", "", 600, 100, 320, 400, { data: "article", colour: { bg: "#553322" }, ...from("body > main > article") }),
    node("sticker", "picture", "", 640, 140, 200, 150, { ...from("body > main > article > img") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "IN", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="sticker"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const away = async () => { await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.mouse.click(1420, 880); await page.waitForTimeout(300); };

for (const [pic, owner] of [["logo_pic", "logo"], ["sticker", "card"]]) {
  await away();
  const c = await centre(pic);
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(400);
  check(`one press on ${pic} picks the ${owner} that holds it`, JSON.stringify(await selection()) === JSON.stringify([owner]), JSON.stringify(await selection()));
  await page.waitForTimeout(600);
  await page.mouse.dblclick(c.x, c.y); await page.waitForTimeout(400);
  check(`two presses pick ${pic} itself`, JSON.stringify(await selection()) === JSON.stringify([pic]), JSON.stringify(await selection()));
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check(`…and Escape steps back out to the ${owner}`, JSON.stringify(await selection()) === JSON.stringify([owner]), JSON.stringify(await selection()));
}

await away();
const w = await centre("logo_words");
await page.mouse.dblclick(w.x, w.y); await page.waitForTimeout(500);
check("two presses on a link's words still open the words", await page.locator('[data-words-in-place="logo_words"]').count() === 1);

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
