/**
 * THE BOARD'S TAGS AND THE PICKED PART'S HEADER USE THE SIDE PANEL'S NAMES.
 *
 * A captured part arrives named by the capture: "div · 1 inside", or a
 * link's role and name with the count after it, "link “BUY ON PUMP.FUN” · 4
 * inside". The side panel already had a readable name for each
 * (`partNames.ts`), but the tag over a part on the board printed the raw
 * label, and a label with words before the count slipped past the helper,
 * so even the panel's header printed it. Held here:
 *
 *   · the helper counts "… · N inside" as the capture's, whatever precedes it;
 *   · the tag over every part on the board is the readable name;
 *   · the picked part's header in the side panel says the same;
 *   · a name somebody typed is still shown as typed.
 *
 *   npx next start -p 3013
 *   node tests/part-tags.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";
import { isMachineLabel, partName } from "../src/features/studio/partNames.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
mkdirSync(".screenshots", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* the helper, on its own */
check("\"link “BUY” · 4 inside\" is the capture's, not a name", isMachineLabel("link “BUY ON PUMP.FUN” · 4 inside"));
check("…as are \"div · 1 inside\" and \"main · 7 inside (h)\"", isMachineLabel("div · 1 inside") && isMachineLabel("main · 7 inside (h)"));
check("…and a typed name is not", !isMachineLabel("Buy button") && !isMachineLabel("Inside out"));

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const nodes = [
  node("buy", "box", "", 200, 200, 320, 72, {
    label: "link “BUY ON PUMP.FUN” · 4 inside", data: "link, BUY ON PUMP.FUN",
    prompt: "The browser computes it as a link, named “BUY ON PUMP.FUN”.",
    link: { kind: "url", target: "https://example.test/" }, colour: { bg: "#e0306a" },
  }),
  node("buy_words", "value-prop", "BUY ON PUMP.FUN", 216, 212, 288, 48, { label: "span · 0 inside" }),
  node("panel", "box", "", 700, 160, 420, 300, { label: "div · 1 inside" }),
  node("panel_head", "value-prop", "Meet the team", 720, 190, 380, 60, { label: "h2 · 0 inside", font: { size: 32 } }),
  node("typed", "value-prop", "Hello", 200, 600, 300, 80, { label: "Greeting" }),
];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "TAGS", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });
const want = Object.fromEntries(nodes.map((n) => [n.id, partName(n, nodes)]));
check("the helper names the link by what the browser calls it", /BUY ON PUMP\.FUN/.test(want.buy) && !/inside/.test(want.buy), want.buy);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="buy"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const tags = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-node-id]")].map((n) => [n.getAttribute("data-node-id"), n.querySelector(":scope > * [data-part-tag], :scope [data-part-tag]")?.textContent ?? null])));
check("no tag on the board says \"inside\"", Object.values(tags).every((t) => t && !/·\s*\d+\s+inside/.test(t)), JSON.stringify(tags));
check("every tag is the side panel's name", Object.keys(want).every((id) => tags[id] === want[id]), JSON.stringify({ tags, want }));
check("a typed name stays as typed", tags.typed === "Greeting", tags.typed);

/* the picked part's header */
const b = await page.locator('[data-node-id="buy_words"]').boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(700);
const header = await page.locator("[data-element-name]").first().textContent().catch(() => null);
check("the picked link's header in the side panel is its readable name", header === want.buy, `${header}`);
const chip = await page.locator('[data-node-id="buy"] [data-part-tag]').first().textContent();
check("…and the tag over it on the board says the same", chip === header, chip);
await page.screenshot({ path: ".screenshots/part-tags.png" });

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
