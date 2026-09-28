/**
 * A PART HANGING OFF THE PAGE DOES NOT MOVE THE PAGE ON THE BOARD.
 *
 * THE OWNER'S REPORT, trunk 2849a20 with his trumpmorty.fun: after he
 * resized the window or the board pane, the page frame started about halfway
 * down the screen, a big empty starfield above it. The site's big planet is a
 * part at (-355, -441), 1109 across, and the board keeps room above the page
 * for whatever is drawn up there (`frameTopReach`, `tests/part-above-reach`),
 * then every fit set the pane's scroll to 0 — the top of that room — so the
 * page opened 441 × zoom + 24 pixels lower than it does without the planet.
 *
 * The rule: the fit, a resize, a new page and the first scroll are about the
 * page frame, (0, 0) to its width and height. What hangs off it stays drawn,
 * stays selectable, and is a scroll up away; it never moves where the page
 * opens or how big it is drawn.
 *
 * Read: the same page with and without that part, each resized twice (the
 * window, then the board pane by opening the side panel's toggle), and the
 * frame's top-left on screen and the zoom compared after every step.
 *
 *   node tests/board-overhang-fit.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: "rgb(200, 120, 60)" }, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const docOf = (nodes) => JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "OVERHANG", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });
const tv = node("tv", 500, 300, 420, 320, { colour: { bg: "rgb(60, 160, 90)" } });
const planet = node("planet", -355, -441, 1109, 1109, { radius: 554 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/** The frame's top-left on screen and the zoom, after load and after each resize. */
async function walk(nodes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const doc = docOf(nodes);
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const read = () => page.evaluate(() => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    return { x: Math.round(f.left), y: Math.round(f.top), zoom: +(f.width / 1440).toFixed(4) };
  });
  const seen = { load: await read() };
  await page.setViewportSize({ width: 1300, height: 860 });
  await page.waitForTimeout(1200);
  seen.window = await read();
  await page.setViewportSize({ width: 1700, height: 1060 });
  await page.waitForTimeout(1200);
  seen.back = await read();
  /* The pane itself, narrower with the window unchanged: the side panel. */
  const paneW = () => page.evaluate(() => document.querySelector("[data-studio-pane]").clientWidth);
  const w0 = await paneW();
  await page.mouse.click(5, 500);
  await page.keyboard.press("l");
  await page.waitForTimeout(1500);
  seen.paneMoved = (await paneW()) !== w0;
  seen.pane = await read();
  /* And the overhang is still drawn and still a part you can pick: a press on its visible foot selects it. */
  const pick = nodes.includes(planet) ? await page.evaluate(() => {
    const e = document.querySelector('[data-node-id="planet"]');
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    if (!e) return { drawn: false };
    const r = e.getBoundingClientRect();
    const z = f.width / 1440;
    const x = Math.round(f.left + 60 * z), y = Math.round(f.top + 600 * z);
    return { drawn: r.height > 100, x, y, hit: document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null };
  }) : null;
  await ctx.close();
  return { seen, pick, errors };
}

const bare = await walk([tv]);
const hung = await walk([tv, planet]);
for (const step of ["load", "window", "back", "pane"]) {
  const a = bare.seen[step], b = hung.seen[step];
  check(`${step}: the frame's top-left is where it is without the overhang`, Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1, `with ${b.x},${b.y} · without ${a.x},${a.y}`);
  check(`${step}: the zoom is the same`, Math.abs(a.zoom - b.zoom) < 0.001, `with ${b.zoom} · without ${a.zoom}`);
}
check("the two resizes did change the fit, so the check can see a fault", bare.seen.window.zoom !== bare.seen.load.zoom && bare.seen.paneMoved && hung.seen.paneMoved,
  `${bare.seen.load.zoom} → ${bare.seen.window.zoom} → ${bare.seen.back.zoom}; the pane moved with the panel: ${bare.seen.paneMoved}/${hung.seen.paneMoved}`);
check("the overhang is still drawn, and the part on screen under a press", hung.pick?.drawn === true && hung.pick?.hit === "planet", JSON.stringify(hung.pick));
check("no page error", [...bare.errors, ...hung.errors].length === 0, [...bare.errors, ...hung.errors].join(" / "));

await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
