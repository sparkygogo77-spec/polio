/**
 * THE DESIGN CANVAS'S SELECTION, IN THE BUILDER.
 *
 * J (2026-11-03): "we need the same control select tech that is in the
 * artifacts". Held here:
 *
 *   · hover: the part under the pointer lights faintly and each part holding
 *     it fainter, at the right depth (`board/hoverOutlines.ts`), cheaply on
 *     sol face's 800 parts;
 *   · the picked part has eight handles, a square at each corner and in the
 *     middle of each edge;
 *   · a slow second click on the same spot goes one level in, Escape one
 *     level out, and the two climb the same ladder (`board/selectTools.ts`);
 *     a drag from the spot moves the part picked;
 *   · the floating toolbar (`board/PickBar.tsx`) sits above the picked part
 *     (below it at the pane's top edge, inside the pane at every edge), and
 *     its Looks, Duplicate, Delete and Step out do what the wheel and Escape
 *     do, each one step of undo;
 *   · the arrows nudge 1 px, 10 with Shift, a run within a second one undo
 *     step, a run after a pause a second step;
 *   · on sol face and every repo fixture: hover depth, click in and out,
 *     the toolbar's keys with undo restoring, a nudge undone, and a board
 *     that does not move by a pixel when nothing was nudged;
 *   · no page errors.
 *
 *   npx next start -p 3441
 *   node tests/builder-select.mjs http://127.0.0.1:3441 [fixtures folder]
 *
 * The fixtures folder holds `sites/<name>/site/document.json` (the sink, or
 * Pleo's `shared`). Without it: the made document and sol face. ONLY_SITE=<name>
 * runs one of them; each site has SITE_MINUTES (5) before it is called frozen,
 * so a hung headless renderer cannot hold the PC's heavy lock.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? null;
const ONLY = process.env.ONLY_SITE ?? null;
const SITE_MINUTES = Number(process.env.SITE_MINUTES ?? 5);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launch = () => chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
let browser = await launch();
const errors = [];

/* ------------------------------------------------------------ helpers */
const helpers = (page) => {
  const sel = () => page.evaluate(() => window.__studioSelection());
  const nodes = () => page.evaluate(() => window.__studioNodes());
  const boxes = () => page.evaluate(() => Object.fromEntries(window.__studioNodes().map((n) => [n.id, [n.x, n.y, n.w, n.h].join(",")])));
  const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  /* A click well past the double-press window (400 ms), so it is a slow second click, never two quick presses. */
  const click = async (at) => { await page.waitForTimeout(550); await page.mouse.click(at.x, at.y); await page.waitForTimeout(250); };
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const lit = () => page.evaluate(() => [...document.querySelectorAll("[data-hover-depth]")].map((el) => ({
    id: el.getAttribute("data-node-id"), depth: +el.getAttribute("data-hover-depth"),
    opacity: +getComputedStyle(el.querySelector(":scope > [data-hover-mark]") ?? el).opacity,
  })).sort((a, b) => a.depth - b.depth));
  const bar = () => page.evaluate(() => {
    const el = document.querySelector("[data-pick-bar]");
    if (!el || getComputedStyle(el).visibility === "hidden") return null;
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute("data-pick-bar"), below: el.hasAttribute("data-pick-bar-below"), left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const press = async (doing) => { await page.locator(`[data-pick-bar-do="${doing}"]`).click(); await page.waitForTimeout(300); };
  const undo = async () => { await key("Control+z"); await page.waitForTimeout(150); };
  /* A heavy board (parasite: 18,000 parts) takes a moment to undo: the boxes are read until they settle on `want`, five seconds at most. */
  const settlesTo = async (want) => { for (let i = 0; i < 20; i++) { if (JSON.stringify(await boxes()) === want) return true; await page.waitForTimeout(250); } return false; };
  /* A point on the board's bare ground: in the pane, off the page and off every part. */
  const ground = () => page.evaluate(() => {
    const pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
    if (!pane) return { x: 5, y: 5 };
    for (let y = pane.top + 8; y < pane.bottom - 8; y += 16) for (let x = pane.left + 8; x < pane.right - 8; x += 16) {
      const el = document.elementFromPoint(x, y);
      if (el && el.closest("[data-board-tool]") && !el.closest("[data-node-id], [data-frame], [data-shape-id], [data-pick-bar]")) return { x, y };
    }
    return { x: pane.left + 4, y: pane.top + 4 };
  });
  return { sel, nodes, boxes, centre, click, key, lit, bar, press, undo, ground, settlesTo };
};

/* ------------------------------------------------------------ part 1: a made page, every rule */
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("sec", "box", "", 100, 140, 800, 400, { colour: { bg: "#1b2240" } }),
    node("row", "box", "", 150, 190, 560, 220, { colour: { bg: "#27315c" } }),
    node("go", "box", "", 200, 240, 320, 72, { data: "button, named GO", colour: { bg: "#2f7de1" } }),
    node("go_words", "value-prop", "GO", 216, 252, 288, 48),
    node("top", "box", "", 1000, 0, 240, 60, { colour: { bg: "#3a2a55" } }),
    node("far", "box", "", 100, 700, 300, 120, { colour: { bg: "#203a30" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SELECT", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

async function madePage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`made: ${e.message}`));
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-node-id="go_words"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const h = helpers(page);
  const say = (name, ok, detail) => check(`made: ${name}`, ok, detail);
  const c = await h.centre("go_words");

  /* hover */
  await page.mouse.move(c.x, c.y);
  await page.waitForTimeout(200);
  const chain = await h.lit();
  say("hover lights the words and, up the page, the button, the row and the section", JSON.stringify(chain.map((l) => [l.id, l.depth])) === JSON.stringify([["go_words", 0], ["go", 1], ["row", 2], ["sec", 3]]), JSON.stringify(chain.map((l) => [l.id, l.depth])));
  say("…the part under the hand brightest, each holder fainter", chain.length === 4 && chain.every((l, i) => l.opacity > 0 && (i === 0 || l.opacity < chain[i - 1].opacity)), chain.map((l) => l.opacity).join(" > "));
  const rb = await page.locator('[data-node-id="row"]').boundingBox();
  await page.mouse.move(rb.x + rb.width * 0.92, rb.y + rb.height * 0.85);
  await page.waitForTimeout(150);
  const onRow = await h.lit();
  say("…over the row alone: the row and the section", JSON.stringify(onRow.map((l) => [l.id, l.depth])) === JSON.stringify([["row", 0], ["sec", 1]]), JSON.stringify(onRow.map((l) => [l.id, l.depth])));
  const off = await h.ground();
  await page.mouse.move(off.x, off.y);
  await page.waitForTimeout(150);
  say("…and off the parts nothing is lit", (await h.lit()).length === 0, JSON.stringify(await h.lit()));

  /* handles, click in, Escape out: the ladder at the words' spot, outermost first */
  const LADDER = ["sec", "row", "go", "go_words"];
  const rung = async () => LADDER.indexOf((await h.sel())[0] ?? "");
  await h.click(c);
  const first = await rung();
  say("one click picks what owns the words, as today (the button, or the row the board reads as a card)", first === 1 || first === 2, JSON.stringify(await h.sel()));
  const picked = LADDER[first];
  const handles = await page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); return { all: el?.querySelectorAll(":scope > [data-resize]").length, squares: el?.querySelectorAll(":scope > [data-resize] > [data-edge-square]").length }; }, picked);
  say("the picked part has eight handles: four corners and a square mid-edge on each side", handles.all === 8 && handles.squares === 4, JSON.stringify(handles));
  let climbed = true;
  for (let i = first + 1; i < LADDER.length; i++) { await h.click(c); if ((await rung()) !== i) climbed = false; }
  say("each second click on the same spot goes one level in, down to the words", climbed && (await rung()) === 3, JSON.stringify(await h.sel()));
  let out = true;
  for (let i = 2; i >= 0; i--) { await h.key("Escape"); if ((await rung()) !== i) out = false; }
  say("Escape steps out one level at a time: button, row, section", out, JSON.stringify(await h.sel()));
  await h.key("Escape");
  say("…and then to nothing picked", (await h.sel()).length === 0, JSON.stringify(await h.sel()));
  await h.click(c);
  for (let i = 0; i < 3 && (await rung()) > 0; i++) await h.key("Escape");
  let back = (await rung()) === 0;
  for (let i = 1; i <= 2; i++) { await h.click(c); if ((await rung()) !== i) back = false; }
  say("from the section, clicks on the spot climb back in: row, then button", back, JSON.stringify(await h.sel()));
  const go0 = (await h.nodes()).find((n) => n.id === "go");
  await page.waitForTimeout(550);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 20, c.y + 10, { steps: 5 });
  await page.mouse.move(c.x + 40, c.y + 20, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const go1 = (await h.nodes()).find((n) => n.id === "go");
  const words1 = (await h.nodes()).find((n) => n.id === "go_words");
  say("a drag from the spot moves the part picked, its words riding with it", JSON.stringify(await h.sel()) === '["go"]' && go1.x !== go0.x && words1.x - 16 === go1.x, `${JSON.stringify(await h.sel())} ${go0.x}→${go1.x}`);
  await h.undo();
  say("…one undo puts it back", (await h.nodes()).find((n) => n.id === "go").x === go0.x);
  await h.click(await h.ground());
  say("a click on the bare ground picks nothing", (await h.sel()).length === 0, JSON.stringify(await h.sel()));

  /* the toolbar, on the button */
  const toGo = async () => { await h.click(await h.ground()); await h.click(c); for (let i = 0; i < 3 && (await h.sel())[0] !== "go"; i++) await h.click(c); };
  await toGo();
  await page.waitForTimeout(550);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const midPress = await h.bar();
  await page.mouse.up();
  await page.waitForTimeout(250);
  /* That press was on the spot: it went in to the words. Back to the button. */
  await toGo();
  const gb = await page.locator('[data-node-id="go"]').boundingBox();
  let b = await h.bar();
  say("the toolbar stands aside while a press is down, and comes back on release", !midPress && !!b, `mid-press ${JSON.stringify(midPress)}`);
  say("…never under the pointer", !!b && !(c.x >= b.left && c.x <= b.right && c.y >= b.top && c.y <= b.bottom), `${JSON.stringify(b)} pointer ${c.x},${c.y}`);
  say("the toolbar shows over the picked part, inside the window", !!b && b.id === "go" && !b.below && b.bottom <= gb.y + 1 && b.left >= 0 && b.right <= 1440, JSON.stringify(b));
  const count = (await h.nodes()).length;
  const before = JSON.stringify(await h.boxes());
  await h.press("duplicate");
  const copy = (await h.sel())[0];
  say("Duplicate copies the button with its words, and picks the copy", (await h.nodes()).length === count + 2 && copy && copy !== "go", `${(await h.nodes()).length} parts, picked ${copy}`);
  await h.undo();
  say("…one undo takes the copy away", (await h.nodes()).length === count && JSON.stringify(await h.boxes()) === before);
  await toGo();
  await h.press("delete");
  const ids = (await h.nodes()).map((n) => n.id);
  say("Delete takes the button and its words", !ids.includes("go") && !ids.includes("go_words"), ids.join(","));
  await h.undo();
  say("…one undo brings them back where they were", JSON.stringify(await h.boxes()) === before);
  await toGo();
  await h.press("out");
  say("Step out picks the row, as Escape does", JSON.stringify(await h.sel()) === '["row"]', JSON.stringify(await h.sel()));
  await h.click(c);
  say("…and the spot climbs with it: the next click goes in to the button", JSON.stringify(await h.sel()) === '["go"]', JSON.stringify(await h.sel()));
  await h.press("looks");
  await page.waitForTimeout(300);
  const wheel = await page.evaluate(() => !!document.querySelector("[data-radial]"));
  say("Looks opens the wheel on the part, and the toolbar steps aside", wheel && !(await h.bar()), `wheel ${wheel}, bar ${JSON.stringify(await h.bar())}`);
  /* The wheel's own Escape: back from Looks to the wheel, then shut. */
  for (let i = 0; i < 3 && (await page.evaluate(() => !!document.querySelector("[data-radial]"))); i++) await h.key("Escape");
  await page.waitForTimeout(200);
  say("…once the wheel is shut the toolbar is back on the same part", !(await page.evaluate(() => !!document.querySelector("[data-radial]"))) && (await h.bar())?.id === "go", JSON.stringify(await h.bar()));

  /* the toolbar at the pane's top edge */
  await page.evaluate(() => { const pane = document.querySelector("[data-studio-pane]"); const top = document.querySelector('[data-node-id="top"]'); if (pane && top) pane.scrollTop += top.getBoundingClientRect().top - pane.getBoundingClientRect().top; });
  await page.waitForTimeout(300);
  const tc = await h.centre("top");
  await h.click(tc);
  b = await h.bar();
  const tb = await page.locator('[data-node-id="top"]').boundingBox();
  const pane = await page.evaluate(() => { const r = document.querySelector("[data-studio-pane]")?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; });
  say("at the pane's top edge the toolbar sits below the part", !!b && b.below && b.top >= tb.y + tb.height, JSON.stringify(b));
  say("…and inside the pane", !!b && !!pane && b.left >= pane.left && b.right <= pane.right && b.top >= pane.top && b.bottom <= pane.bottom, `${JSON.stringify(b)} in ${JSON.stringify(pane)}`);
  await page.evaluate(() => { const pane = document.querySelector("[data-studio-pane]"); if (pane) pane.scrollTop = 0; });
  await page.waitForTimeout(300);

  /* nudges (an undo leaves nothing picked, so the button is picked again before each run) */
  await toGo();
  const n0 = (await h.nodes()).find((n) => n.id === "go");
  await h.key("ArrowRight");
  await h.key("ArrowRight");
  await h.key("Shift+ArrowDown");
  const n1 = (await h.nodes()).find((n) => n.id === "go");
  say("two rights and a Shift+down nudge the button 2 across and 10 down", n1.x - n0.x === 2 && n1.y - n0.y === 10, `${n1.x - n0.x}, ${n1.y - n0.y}`);
  await h.undo();
  const n2 = (await h.nodes()).find((n) => n.id === "go");
  say("…the run is one undo step", n2.x === n0.x && n2.y === n0.y, `${n2.x},${n2.y}`);
  await toGo();
  await h.key("ArrowRight");
  await page.waitForTimeout(1300);
  await h.key("ArrowRight");
  await h.undo();
  const n3 = (await h.nodes()).find((n) => n.id === "go");
  say("a nudge after a pause of more than a second is a step of its own", n3.x === n0.x + 1, `${n3.x - n0.x}`);
  await h.undo();
  await ctx.close();
}

/* ------------------------------------------------------------ part 2: sol face and the fixtures */
async function onSite(label, siteDoc) {
  const say = (name, ok, detail) => check(`${label}: ${name}`, ok, detail);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  if (siteDoc) await page.evaluate((d) => window.__studioLoadDoc(d), { ...siteDoc, activePageId: siteDoc.pages[0].id });
  /* Settled: a board heals its words for a few seconds once it opens; the snapshot waits until two reads 2 s apart agree (30 s at most). */
  await page.waitForTimeout(4000);
  const h = helpers(page);
  let still = JSON.stringify(await h.boxes());
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(2000); const now = JSON.stringify(await h.boxes()); if (now === still) break; still = now; }
  const moved = async () => { const a = JSON.parse(still), b = await h.boxes(); const ids = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]); return ids.length ? `${ids.length} differ, e.g. ${ids.slice(0, 2).map((k) => `${k} ${a[k]} → ${b[k]}`).join("; ")}` : ""; };

  if (!siteDoc) {
    /* What a hover costs on 800 parts, over what it cost already: the board's own `data-hot` (hoverHot.ts) is the baseline. */
    const cost = await page.evaluate(() => {
      const board = document.querySelector("[data-board-tool]");
      const parts = [...document.querySelectorAll("[data-node-id]")].filter((el) => el.getClientRects().length).slice(0, 300);
      const time = (fn) => { const t = performance.now(); for (const el of parts) { fn(el); void getComputedStyle(el).opacity; } return (performance.now() - t) / parts.length; };
      const over = (el) => el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      const cold = time(over), warm = time(over);
      const hot = time((el) => board.setAttribute("data-hot", el.getAttribute("data-node-id")));
      board.dispatchEvent(new PointerEvent("pointerleave"));
      return { n: parts.length, cold, warm, hot };
    });
    say("a hover onto a part adds little to what the board already spends: under 3 ms the first time, under 1.5 ms after (headless, software drawing)", cost.cold - cost.hot < 3 && cost.warm - cost.hot < 1.5, `${cost.n} parts: ${cost.cold.toFixed(2)} then ${cost.warm.toFixed(2)} ms a part, of which ${cost.hot.toFixed(2)} ms is the board's own hover attribute`);
  }

  /* A part with words, in view, with at least one holder, found by hovering it. */
  const spots = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("[data-node-id]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 14 || r.top < 120 || r.bottom > 860 || r.left < 380 || r.right > 1100) continue;
      if (!(el.textContent ?? "").trim()) continue;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (document.elementFromPoint(x, y)?.closest("[data-node-id]") !== el) continue;
      out.push({ id: el.getAttribute("data-node-id"), x, y });
      if (out.length >= 40) break;
    }
    return out;
  });
  let spot = null, chain = [];
  for (const s of spots) {
    await page.mouse.move(s.x, s.y);
    await page.waitForTimeout(60);
    chain = await h.lit();
    if (chain.length >= 3 && chain[0].id === s.id) { spot = s; break; }
  }
  say("hover lights the part under the hand at depth 0 and its holders at 1, 2, …", !!spot && chain[0].depth === 0 && chain[1].depth === 1 && chain.every((l, i) => i === 0 || l.depth >= chain[i - 1].depth), spot ? JSON.stringify(chain.map((l) => [l.id, l.depth])) : `no part with two holders among ${spots.length}`);
  if (!spot) { await ctx.close(); return; }
  say("…each holder fainter than the part it holds", chain.every((l, i) => l.opacity > 0 && (i === 0 || l.depth === chain[i - 1].depth || l.opacity < chain[i - 1].opacity)), chain.map((l) => l.opacity).join(" "));

  await h.click(spot);
  const x = (await h.sel())[0];
  await h.key("Escape");
  const y = (await h.sel())[0];
  say("click picks a part and Escape steps out to what holds it", !!x && !!y && x !== y, `${x} → ${y}`);
  await h.click(spot);
  say("…a click on the same spot goes back in one level", (await h.sel())[0] === x, `${y} → ${(await h.sel())[0]}, wanted ${x}`);
  const b = await h.bar();
  say("the toolbar shows on the part, inside the window", !!b && b.id === x && b.left >= 0 && b.right <= 1440 && b.top >= 0 && b.bottom <= 900, JSON.stringify(b));
  await h.press("out");
  say("…Step out picks what holds it, as Escape did", (await h.sel())[0] === y, `${(await h.sel())[0]}`);
  await h.key("Escape");
  await h.key("Escape");
  await h.key("Escape");
  await h.click(await h.ground());
  await page.waitForTimeout(600);
  say("nothing nudged, nothing moved: every part where it was, to the pixel", JSON.stringify(await h.boxes()) === still, await moved());

  /* Edits through the toolbar and the arrows, each undone. */
  await h.click(spot);
  const count = (await h.nodes()).length;
  await h.press("duplicate");
  say("Duplicate adds the copy", (await h.nodes()).length > count, `${count} → ${(await h.nodes()).length}`);
  await h.undo();
  await page.waitForTimeout(300);
  say("…undo restores the board", (await h.settlesTo(still)) && (await h.nodes()).length === count, await moved());
  await h.click(spot);
  const picked = (await h.sel())[0];
  await h.press("delete");
  say("Delete takes the part", !(await h.nodes()).some((n) => n.id === picked), picked);
  await h.undo();
  await page.waitForTimeout(300);
  say("…undo restores the board", await h.settlesTo(still), await moved());
  await h.click(spot);
  const id = (await h.sel())[0];
  const at0 = (await h.nodes()).find((n) => n.id === id);
  const past0 = await page.evaluate(() => window.__agents?.board?.().past ?? "?");
  await h.key("ArrowRight");
  await h.key("Shift+ArrowRight");
  const at1 = (await h.nodes()).find((n) => n.id === id);
  say("a nudge and a Shift-nudge move the part 11 px", at1.x - at0.x === 11 || at0.locked, `${at1.x - at0.x}`);
  await h.undo();
  await page.waitForTimeout(300);
  say("…one undo puts the board back", await h.settlesTo(still), `${await moved()}; undo steps ${past0} → ${await page.evaluate(() => window.__agents?.board?.().past ?? "?")}`);
  await ctx.close();
}

async function guarded(label, siteDoc) {
  let t;
  const stall = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`stalled for ${SITE_MINUTES} minutes`)), SITE_MINUTES * 60_000); });
  try { await Promise.race([label === "made" ? madePage() : onSite(label, siteDoc), stall]); }
  catch (e) {
    check(`${label}: ran to the end (${e.message})`, false, String(e.stack ?? e).split("\n").slice(0, 2).join(" "));
    const old = browser;
    await Promise.race([old.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
    try { old.process()?.kill("SIGKILL"); } catch {}
    browser = await launch();
  } finally { clearTimeout(t); }
}

if (!ONLY || ONLY === "made") await guarded("made", null);
if (!ONLY || ONLY === "sol face") await guarded("sol face", null);
if (SINK) {
  for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
    if (ONLY && ONLY !== site) continue;
    const file = join(SINK, "sites", site, "site", "document.json");
    if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); continue; }
    await guarded(site, JSON.parse(readFileSync(file, "utf8")));
  }
} else console.log("  --   the repo fixtures skipped: no fixtures folder given (argv 3 or SINK)");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
