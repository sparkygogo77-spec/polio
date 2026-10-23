/**
 * WHAT A PART HOLDS GOES WITH IT: DELETE, CUT AND DUPLICATE, AS MOVE AND COPY.
 *
 * Found in the hand-edit pass on fresh imports (mochi, sunkcoin, sol face):
 * a drag and Ctrl+C/Ctrl+V took a button with the words and icon it holds
 * (`owner.ts#ridersOf`), but Backspace deleted the button and left its words
 * and icon standing on the page with nothing round them; Ctrl+X did the same
 * and its paste brought back a bare button; Ctrl+D copied the button alone.
 *
 * Held here, on a button with its words over it and a card holding a heading:
 *   · Backspace on the button takes its words too, and one Ctrl+Z brings both back;
 *   · Backspace on the card takes the heading it holds;
 *   · Ctrl+D copies the button with its words, and the copy of the button is
 *     what is picked;
 *   · Ctrl+X takes the button and its words, and Ctrl+V puts both back;
 *   · a copy holds only its own: on a captured link (its words its by page
 *     path), deleting the Ctrl+D copy, or the pasted copy, leaves the
 *     original's words where they are.
 *
 *   npx next start -p 3013
 *   node tests/held-go-along.mjs http://127.0.0.1:3013
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
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("go", "box", "", 200, 200, 320, 72, { data: "button, named GO", colour: { bg: "#2f7de1" } }),
    node("go_words", "value-prop", "GO", 216, 212, 288, 48),
    node("card", "box", "", 700, 200, 400, 300, { colour: { bg: "#e1a12f" } }),
    node("card_head", "value-prop", "A CARD", 720, 220, 300, 48),
    /* A captured link: the words are its by page path, as an import has them. */
    node("ln", "box", "", 200, 600, 240, 60, { data: "button, named SIGN IN", colour: { bg: "#22aa66" }, from: { url: "https://x.test/", host: "x.test", selector: "body > nav > a", at: 1 } }),
    node("ln_words", "value-prop", "SIGN IN", 212, 606, 216, 48, { from: { url: "https://x.test/", host: "x.test", selector: "body > nav > a > span", at: 1 } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "HELD", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="go_words"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const nodes = async () => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])) ?? [];
const has = async (id) => (await nodes()).some((n) => n.id === id);
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(350); };
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const pick = async (id) => {
  await page.mouse.click(1420, 880); await page.waitForTimeout(200);
  /* A press on a free corner of the part: the words over a button pick the button anyway. */
  const b = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  await page.mouse.click(b.x + b.width - 6, b.y + b.height - 6); await page.waitForTimeout(300);
  return selection();
};
const words = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));

/* Delete */
check("the button is picked", JSON.stringify(await pick("go")) === '["go"]', JSON.stringify(await selection()));
await press("Backspace");
check("Backspace takes the button and the words it holds", !(await has("go")) && !(await has("go_words")), `go ${await has("go")}, words ${await has("go_words")}`);
await press("Control+z");
check("…one Ctrl+Z brings both back", (await has("go")) && (await has("go_words")));
check("the card is picked", JSON.stringify(await pick("card")) === '["card"]', JSON.stringify(await selection()));
await press("Backspace");
check("Backspace on a card takes the heading it holds", !(await has("card")) && !(await has("card_head")), `card ${await has("card")}, heading ${await has("card_head")}`);
await press("Control+z");

/* Duplicate */
const ORIG = ["go", "go_words", "card", "card_head", "ln", "ln_words"];
const n0 = (await nodes()).length;
await pick("go");
await press("Control+d");
const after = await nodes();
const copies = after.filter((n) => !ORIG.includes(n.id));
check("Ctrl+D copies the button with its words", after.length === n0 + 2 && copies.some((n) => words(n) === "GO"), `${n0} -> ${after.length}: ${copies.map((n) => `${n.id}:${words(n)}`).join(", ")}`);
const sel = await selection();
check("…and the copy of the button is what is picked", sel.length === 1 && copies.some((c) => c.id === sel[0] && c.featureId === "box"), JSON.stringify(sel));
await press("Escape"); await press("Control+z");

/* Cut and paste */
await pick("go");
await press("Control+x");
check("Ctrl+X takes the button and its words", !(await has("go")) && !(await has("go_words")));
await page.mouse.click(1420, 880);
await press("Control+v");
const pasted = (await nodes()).filter((n) => !["card", "card_head", "ln", "ln_words"].includes(n.id));
check("…and Ctrl+V puts both back", pasted.length === 2 && pasted.some((n) => words(n) === "GO"), pasted.map((n) => `${n.id}:${words(n)}`).join(", "));

/* A copy holds only its own: the captured link, copied and the copy deleted. */
for (const how of ["Control+d", "copy-paste"]) {
  await press("Escape");
  await pick("ln");
  const before = (await nodes()).map((n) => n.id);
  if (how === "Control+d") await press("Control+d");
  else { await press("Control+c"); await page.mouse.click(1420, 880); await press("Control+v"); }
  const made = (await nodes()).filter((n) => !before.includes(n.id));
  const copyLink = made.find((n) => n.featureId === "box");
  check(`${how === "Control+d" ? "Ctrl+D" : "Ctrl+C, Ctrl+V"} on the captured link copies it with its words`, made.length === 2 && !!copyLink, made.map((n) => `${n.id}:${words(n)}`).join(", "));
  if (!copyLink) continue;
  await page.mouse.click(1420, 880); await page.waitForTimeout(200);
  await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), copyLink.id);
  await page.waitForTimeout(200);
  await press("Backspace");
  const left = await nodes();
  check("…deleting the copy takes the copy's words, and the original keeps its words", (await has("ln")) && (await has("ln_words")) && !left.some((n) => made.some((m) => m.id === n.id)), `original ${await has("ln")}/${await has("ln_words")}, copies left ${left.filter((n) => made.some((m) => m.id === n.id)).length}`);
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
