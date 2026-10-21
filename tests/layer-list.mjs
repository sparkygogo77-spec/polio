/**
 * THE LOOK PANEL'S LAYER LIST: A SECTION'S BACKGROUND, OR THE PAGE'S, EACH LAYER WITH ITS EYE.
 *
 * J (2026-10-21): no eye in Elements; hide lives in a layer list in the Look
 * panel's preview, as the background's layers. With thesolface.site's hero
 * picked, the Look panel lists its background top first: the film, Glow,
 * Lines, Fade, Picture, and its Fill at the foot. Each row has a swatch, a
 * plain name and an eye. The eye shuts a layer: the board stops drawing it,
 * and the published page leaves it out. The hero's film shows shut (the
 * stretch guard holds it), saying why. A layer dragged onto another moves in
 * the stack, in one undo step; the fill does not move. With nothing picked,
 * the page's own layers: the cursor glow, the grain, the bar.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/layer-list.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const H = "body > main > section:nth-of-type(1)";
const at = Date.now();
const part = (id, featureId, selector, x, y, w, h, extra = {}) => {
  const { position, ...rest } = extra;
  return { id, pageId: "home", featureId, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, from: { url: "https://thesolface.site/", host: "thesolface.site", selector, at, ...(position ? { position } : {}) }, ...rest };
};
const doc = {
  pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  activePageId: "home",
  nodes: [
    part("fade", "box", `${H} > div:nth-of-type(1)::after`, 0, 0, 1440, 900, { position: "absolute", art: { background: "linear-gradient(0deg, rgb(8, 11, 19) 0%, rgba(0, 0, 0, 0) 40%)" } }),
    part("grid", "box", `${H} > div:nth-of-type(2)`, 0, 0, 1440, 900, { position: "absolute", art: { background: "linear-gradient(rgba(86, 235, 218, 0.3) 1px, rgba(0, 0, 0, 0) 1px)", mask: "radial-gradient(black, transparent)" } }),
    part("glows", "box", `${H} > div:nth-of-type(3)`, 0, 0, 1440, 900, { position: "absolute", art: { background: "radial-gradient(circle at 70% 40%, rgba(76, 255, 131, 0.5), rgba(0, 0, 0, 0) 60%)" } }),
    part("hero", "box", H, 0, 0, 1440, 900, { colour: { bg: "rgb(9, 13, 27)" } }),
    part("title", "value-prop", `${H} > div:nth-of-type(4) > h1`, 50, 300, 708, 267, { content: "THE SOL FACE", font: { size: 6, px: 96, weight: 900, leading: 0.9 } }),
    part("cursorGlow", "box", "body > div:nth-of-type(3)", 327, 320, 450, 450, { position: "fixed", art: { background: "radial-gradient(circle, rgba(53, 255, 138, 0.2), rgba(0, 0, 0, 0) 70%)" } }),
    part("bar", "box", "body > div:nth-of-type(1)", 0, 0, 1440, 3, { position: "fixed", colour: { bg: "rgb(27, 32, 49)" } }),
    part("heroFilm", "picture", `${H}::frames`, 0, 0, 1440, 900, { label: "Moving picture of the hero", inert: true, picture: { id: "pic_f", path: "assets/pictures/pic_f.svg", type: "image/svg+xml", w: 512, h: 320, bytes: 0, alt: "", from: "upload", seeThrough: true, moving: { kind: "pointer" } } }),
  ],
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "layers", name: "layers", updatedAt: Date.now() }], activeId: "layers" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1500);
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForTimeout(600);

const rows = () => page.evaluate(() => [...document.querySelectorAll("[data-layer-list] [data-layer]")].map((r) => ({ id: r.getAttribute("data-layer"), name: r.querySelector("[data-layer-name]")?.textContent, on: r.hasAttribute("data-on"), why: r.getAttribute("title") ?? "" })));
const node = (id) => page.evaluate((i) => window.__studioNodes().find((n) => n.id === i), id);
const opacity = (id) => page.evaluate((i) => Number(getComputedStyle(document.querySelector(`[data-node-id="${i}"]`)).opacity), id);

/* With nothing picked: the page's own layers. */
const pg = await rows();
check("with nothing picked, the page's layers: the bar over the cursor glow", pg.map((r) => r.name).join(" | ") === "Bar | Glow", JSON.stringify(pg));

await page.evaluate(() => window.__studioSelect(["hero"]));
await page.waitForTimeout(700);
const hero = await rows();
check("with the hero picked, its background top first: the film, Glow, Lines, Fade, Fill", hero.map((r) => r.name).join(" | ") === "Moving picture | Glow | Lines | Fade | Fill", hero.map((r) => r.name).join(" | "));
check("…the film shut, held back by the stretch guard, saying why", hero[0]?.on === false && /stretched/.test(hero[0]?.why), JSON.stringify(hero[0]));
check("…every other eye open", hero.slice(1).every((r) => r.on), JSON.stringify(hero));
check("the panel says whose layers they are", !!(await page.locator("[data-layer-of]").innerText()).trim());

/* The eye. */
check("before: the glow is drawn on the board", (await opacity("glows")) === 1);
await page.locator('[data-layer="glows"] [data-layer-eye]').click();
await page.waitForTimeout(500);
check("shutting the glow's eye sets it hidden", (await node("glows"))?.hidden === true, JSON.stringify((await node("glows"))?.hidden));
check("…and the board stops drawing it", (await opacity("glows")) === 0, String(await opacity("glows")));
check("…and its row reads shut", (await rows()).find((r) => r.id === "glows")?.on === false);
await page.locator('[data-layer="glows"] [data-layer-eye]').click();
await page.waitForTimeout(500);
check("opening it again draws it again", (await opacity("glows")) === 1 && !(await node("glows"))?.hidden);

/* Opening a held film's eye draws it. */
await page.locator('[data-layer="heroFilm"] [data-layer-eye]').click();
await page.waitForTimeout(600);
check("opening the held film's eye sets it shown on purpose (hidden: false)", (await node("heroFilm"))?.hidden === false);
/* That it is then drawn is `filmPic`'s (tests/look-layers.mjs): this board has no bytes for the film's frames. */
check("…and its row reads open", (await rows()).find((r) => r.id === "heroFilm")?.on === true);

/* Dragging a layer. */
const order = () => page.evaluate(() => window.__studioNodes().map((n) => n.id).filter((id) => ["fade", "grid", "glows"].includes(id)).join(","));
check("before: the fade under the lines under the glow", (await order()) === "fade,grid,glows", await order());
await page.locator('[data-layer="fade"]').dragTo(page.locator('[data-layer="glows"]'), { targetPosition: { x: 20, y: 3 } });
await page.waitForTimeout(600);
check("the fade dragged onto the top half of the glow's row now paints over the glow", (await order()) === "grid,glows,fade", await order());
check("…and the list reads it at the top", (await rows()).map((r) => r.id).slice(0, 2).join(",") === "heroFilm,fade", (await rows()).map((r) => r.id).join(","));
await page.keyboard.press("Control+z");
await page.waitForTimeout(600);
check("one undo puts it back", (await order()) === "fade,grid,glows", await order());
/* An undo puts back what was picked with the document; the hero is picked again to read its list. */
await page.evaluate(() => window.__studioSelect(["hero"]));
await page.waitForTimeout(500);
check("the fill cannot be picked up", (await page.locator('[data-layer="hero"]').getAttribute("draggable")) === "false");

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
