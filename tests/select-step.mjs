/**
 * STEPPING THE PICK OUT AND BACK IN BY WHEEL AND KEY (J, 2026-11-08).
 *
 * With a part picked:
 *   · Alt + wheel down steps the pick out to the box that holds it, one box a
 *     notch, out to nothing picked; Alt + wheel up steps back in along the
 *     same path (words → button → row → section, and back the same way);
 *   · `[` steps out and `]` steps in, the same ladder;
 *   · a plain wheel scrolls the pane as it always did and moves no pick;
 *   · stepping is not a step of undo (the history is as deep after as before);
 *   · the first time a part is picked a small hint sits by the toolbar; it
 *     goes on the first step and does not come back;
 *   · on sol face and every repo fixture: out and back in by wheel and by key,
 *     a plain wheel scrolls, nothing moves by a pixel, no page errors.
 *
 *   npx next start -p 3471
 *   node tests/select-step.mjs http://127.0.0.1:3471 [fixtures folder]
 *
 * Red on `claude/builder-select` (Alt + wheel scrolls, `[` does nothing, no
 * hint). ONLY_SITE=<name> runs one site; SITE_MINUTES (5) each.
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

const helpers = (page) => {
  const sel = () => page.evaluate(() => window.__studioSelection());
  const boxes = () => page.evaluate(() => Object.fromEntries(window.__studioNodes().map((n) => [n.id, [n.x, n.y, n.w, n.h].join(",")])));
  const depth = () => page.evaluate(() => window.__agents?.board?.().past ?? "?");
  const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const click = async (at) => { await page.waitForTimeout(550); await page.mouse.click(at.x, at.y); await page.waitForTimeout(250); };
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  /* One notch of the wheel, 100 px as a mouse gives it; with Alt held when asked. A pause before, so notches never add up. */
  const wheel = async (dy, alt) => { await page.waitForTimeout(450); if (alt) await page.keyboard.down("Alt"); await page.mouse.wheel(0, dy); if (alt) await page.keyboard.up("Alt"); await page.waitForTimeout(250); };
  const scrollTop = () => page.evaluate(() => document.querySelector("[data-studio-pane]")?.scrollTop ?? 0);
  const hint = () => page.evaluate(() => { const el = document.querySelector("[data-step-hint]"); return el ? el.textContent : null; });
  const ground = () => page.evaluate(() => {
    const pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
    if (!pane) return { x: 5, y: 5 };
    for (let y = pane.top + 8; y < pane.bottom - 8; y += 16) for (let x = pane.left + 8; x < pane.right - 8; x += 16) {
      const el = document.elementFromPoint(x, y);
      if (el && el.closest("[data-board-tool]") && !el.closest("[data-node-id], [data-frame], [data-shape-id], [data-pick-bar]")) return { x, y };
    }
    return { x: pane.left + 4, y: pane.top + 4 };
  });
  return { sel, boxes, depth, centre, click, key, wheel, scrollTop, hint, ground };
};

/* ------------------------------------------------------------ part 1: a made page */
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
    node("other", "box", "", 560, 240, 120, 72, { colour: { bg: "#2f7d61" } }),
    node("far", "box", "", 100, 1400, 300, 120, { colour: { bg: "#203a30" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "STEP", gimmick: "", master: "" },
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
  const LADDER = ["sec", "row", "go", "go_words"];
  const rung = async () => LADDER.indexOf((await h.sel())[0] ?? "");
  const c = await h.centre("go_words");

  /* Down to the words by clicks on the spot. */
  await h.click(c);
  for (let i = 0; i < 3 && (await rung()) < 3; i++) await h.click(c);
  say("clicks on the spot reach the words", (await rung()) === 3, JSON.stringify(await h.sel()));
  const hint0 = await h.hint();
  say("the first pick shows the hint by the toolbar: Alt + scroll, bigger box / smaller box", !!hint0 && /Alt \+ scroll/.test(hint0) && /bigger box/.test(hint0), JSON.stringify(hint0));
  const depth0 = await h.depth();
  const still = JSON.stringify(await h.boxes());

  /* Out by Alt + wheel down, one box a notch. */
  await page.mouse.move(c.x, c.y);
  let out = true;
  for (let i = 2; i >= 0; i--) { await h.wheel(100, true); if ((await rung()) !== i) out = false; }
  say("Alt + wheel down steps out: button, row, section", out, JSON.stringify(await h.sel()));
  say("…and the hint is gone on the first step", (await h.hint()) === null, JSON.stringify(await h.hint()));
  await h.wheel(100, true);
  say("…one more and nothing is picked", (await h.sel()).length === 0, JSON.stringify(await h.sel()));
  /* Back in by Alt + wheel up, along the same path. */
  let back = true;
  for (let i = 0; i < 4; i++) { await h.wheel(-100, true); if ((await rung()) !== i) back = false; }
  say("Alt + wheel up steps back in the same way: section, row, button, words", back && (await rung()) === 3, JSON.stringify(await h.sel()));
  await h.wheel(-100, true);
  say("…and stops at the words, where the path began", (await rung()) === 3, JSON.stringify(await h.sel()));

  /* The keys. */
  await h.key("[");
  await h.key("[");
  say("[ steps out: to the row", (await rung()) === 1, JSON.stringify(await h.sel()));
  await h.key("]");
  say("] steps back in: to the button", (await rung()) === 2, JSON.stringify(await h.sel()));
  await h.key("Escape");
  await h.key("Escape");
  say("Escape climbs the same ladder: the section", (await rung()) === 0, JSON.stringify(await h.sel()));
  await h.wheel(-100, true);
  await h.wheel(-100, true);
  say("…and Alt + wheel up comes back in along it: the button", (await rung()) === 2, JSON.stringify(await h.sel()));

  /* A pick made by a click starts a path of its own: in from there goes nowhere. */
  const oc = await h.centre("other");
  await h.click(oc);
  const onOther = (await h.sel())[0];
  await h.wheel(-100, true);
  say("after a click on another part there is no way back in: the pick stays", onOther === (await h.sel())[0] && (await h.sel()).length === 1, `${onOther} → ${JSON.stringify(await h.sel())}`);
  await h.wheel(100, true);
  say("…but out still works from it", (await rung()) <= 1 && (await h.sel()).length === 1, JSON.stringify(await h.sel()));

  /* Not an undo step; nothing moved. */
  say("stepping is no step of undo: the history is as deep as before", (await h.depth()) === depth0, `${depth0} → ${await h.depth()}`);
  say("…and nothing moved by a pixel", JSON.stringify(await h.boxes()) === still);

  /* A plain wheel scrolls the pane and moves no pick. */
  await h.click(c);
  const pickedBefore = JSON.stringify(await h.sel());
  const top0 = await h.scrollTop();
  await page.mouse.move(c.x, c.y);
  await h.wheel(300, false);
  await page.waitForTimeout(400);
  say("a plain wheel scrolls the page", (await h.scrollTop()) > top0, `${top0} → ${await h.scrollTop()}`);
  say("…and leaves the pick where it was", JSON.stringify(await h.sel()) === pickedBefore, JSON.stringify(await h.sel()));
  await h.wheel(-300, false);
  await page.waitForTimeout(300);
  await h.key("Escape");
  await h.key("Escape");
  await h.key("Escape");
  await h.key("Escape");

  /* The hint does not come back. */
  await h.click(c);
  say("a later pick shows no hint", (await h.hint()) === null, JSON.stringify(await h.hint()));
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
  await page.waitForTimeout(4000);
  const h = helpers(page);
  let still = JSON.stringify(await h.boxes());
  for (let i = 0; i < 15; i++) { await page.waitForTimeout(2000); const now = JSON.stringify(await h.boxes()); if (now === still) break; still = now; }
  const moved = async () => { const a = JSON.parse(still), b = await h.boxes(); const ids = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]); return ids.length ? `${ids.length} differ, e.g. ${ids.slice(0, 2).map((k) => `${k} ${a[k]} → ${b[k]}`).join("; ")}` : ""; };

  /* A part with words, in view, with two holders. */
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
  let spot = null;
  for (const s of spots) {
    await page.mouse.move(s.x, s.y);
    await page.waitForTimeout(60);
    const lit = await page.evaluate(() => document.querySelectorAll("[data-hover-depth]").length);
    if (lit >= 3) { spot = s; break; }
  }
  say("a part with two holders is in view", !!spot, spot ? spot.id : `none among ${spots.length}`);
  if (!spot) { await ctx.close(); return; }

  await h.click(spot);
  const a = (await h.sel())[0];
  const depth0 = await h.depth();
  await page.mouse.move(spot.x, spot.y);
  await h.wheel(100, true);
  const b = (await h.sel())[0];
  await h.wheel(100, true);
  const c = (await h.sel())[0];
  say("Alt + wheel down steps out twice, to a bigger box each time", !!a && !!b && !!c && a !== b && b !== c, `${a} → ${b} → ${c}`);
  await h.wheel(-100, true);
  const b2 = (await h.sel())[0];
  await h.wheel(-100, true);
  const a2 = (await h.sel())[0];
  say("Alt + wheel up comes back in the same way", b2 === b && a2 === a, `${c} → ${b2} → ${a2}, wanted ${b} → ${a}`);
  await h.key("[");
  say("[ steps out", (await h.sel())[0] === b, `${(await h.sel())[0]}`);
  await h.key("]");
  say("] steps back in", (await h.sel())[0] === a, `${(await h.sel())[0]}`);
  say("no step of undo among them", (await h.depth()) === depth0, `${depth0} → ${await h.depth()}`);
  const top0 = await h.scrollTop();
  await h.wheel(300, false);
  await page.waitForTimeout(400);
  say("a plain wheel scrolls the page and keeps the pick", (await h.scrollTop()) > top0 && (await h.sel())[0] === a, `${top0} → ${await h.scrollTop()}, ${(await h.sel())[0]}`);
  await h.wheel(-300, false);
  for (let i = 0; i < 6 && (await h.sel()).length; i++) await h.key("Escape");
  await page.waitForTimeout(600);
  say("nothing moved by a pixel", JSON.stringify(await h.boxes()) === still, await moved());
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
