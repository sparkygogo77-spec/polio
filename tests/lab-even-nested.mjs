#!/usr/bin/env node
/**
 * EVEN OUT KEEPS A BROUGHT-IN PAGE IN ONE PIECE.
 *
 * J (2026-10-11): on the sunkcoin page, Lab > Rhythm > "Even out to 56px"
 * broke the page apart and made it far longer. The card listed gaps of
 * -900px above Dust (a canvas the page repainted) and above the header's
 * button: the rule measured a nested page flat, so every part inside a
 * panel sat "under" the panel and was dropped below it. Held here:
 *
 *   1. the rules, with no browser: a panel's contents stay in the panel and
 *      the panel grows to fit; a repainted canvas and a fixed part never
 *      move and make no gap; an overlap is no gap; an absolute badge rides
 *      with what holds it; Density keeps the same promises;
 *   2. in the Builder, on the saved PST board: Even out leaves every part
 *      inside the part that held it, the page grows by no more than its
 *      gaps did, and one undo puts every part back where it was.
 *
 *   npm run build && npx next start -p 3013
 *   node --experimental-strip-types tests/lab-even-nested.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/lab/index.ts, src/features/studio/lab/LabPanel.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { evenOut, flowOf, gapsOf, rhythmOf, scaleRhythm } from "../src/features/studio/lab/index.ts";
import { openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const holds = (a, b) => a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w >= b.x + b.w - 1 && a.y + a.h >= b.y + b.h - 1;
const after = (boxes, moves) => boxes.map((b) => ({ ...b, ...(moves.find((m) => m.id === b.id) ?? {}) }));

/* ------------------------------------------------------------ 1. the rules */
const page = [
  { id: "dust", x: 0, y: 0, w: 1440, h: 3000, flow: "still" },          // a canvas the page repainted, over everything
  { id: "bar", x: 0, y: 0, w: 1440, h: 80, flow: "still" },             // a fixed header
  { id: "hero", x: 0, y: 100, w: 1440, h: 400 },                        // a band holding a title and a button
  { id: "title", x: 100, y: 140, w: 600, h: 80 },
  { id: "go", x: 100, y: 300, w: 200, h: 60 },                          // 80 under the title: off
  { id: "badge", x: 270, y: 300, w: 24, h: 24, flow: "loose" },         // absolute, in the button's corner
  { id: "panel", x: 0, y: 556, w: 1440, h: 300 },                       // 56 under the hero
  { id: "p1", x: 100, y: 580, w: 600, h: 60 },
  { id: "p2", x: 100, y: 696, w: 600, h: 60 },                          // 56 under p1
  { id: "stamp", x: 500, y: 700, w: 300, h: 40 },                       // laid over p2: no gap
  { id: "foot", x: 0, y: 1000, w: 1440, h: 100 },                       // 144 under the panel: off
];
const r = rhythmOf(page);
check("1. rhythm: the usual gap is 56, measured only between parts that share a holder", r.usual === 56 && r.gaps.every((g) => g.gap >= 0), JSON.stringify(r.gaps));
check("…the canvas, the fixed bar, the badge and the stamp laid over a part make no gap", !r.gaps.some((g) => ["dust", "bar", "badge", "stamp"].includes(g.below) || ["dust", "bar"].includes(g.above)), JSON.stringify(r.gaps));
check("…the two that break it are the button (80) and the footer (144)", r.off.map((g) => `${g.below}:${g.gap}`).join() === "go:80,foot:144", JSON.stringify(r.off));
const ev = evenOut(page, 56);
const got = after(page, ev);
const at = (id) => got.find((b) => b.id === id);
check("even out: the canvas and the fixed bar never move", !ev.some((m) => m.id === "dust" || m.id === "bar"), JSON.stringify(ev));
check("…the button comes up to 56 under the title, its badge with it", at("go").y === 276 && at("badge").y === 276, `${at("go").y}, ${at("badge").y}`);
check("…the hero shrinks to keep its room under the button, so it still holds it", at("hero").h === 376 && holds(at("hero"), at("go")) && holds(at("hero"), at("title")), JSON.stringify(at("hero")));
check("…the panel follows 56 under the hero, its contents and the stamp with it", at("panel").y === 532 && at("p1").y === 556 && at("p2").y === 672 && at("stamp").y === 676, JSON.stringify([at("panel"), at("p1"), at("p2"), at("stamp")]));
check("…the footer comes up to 56 under the panel", at("foot").y === 532 + 300 + 56, `${at("foot").y}`);
check("…every part is still inside the part that held it", ["title", "go", "badge"].every((id) => holds(at("hero"), at(id))) && ["p1", "p2", "stamp"].every((id) => holds(at("panel"), at(id))));
check("…and evening twice changes nothing more", evenOut(got, 56).length === 0, JSON.stringify(evenOut(got, 56)));
const grown = after(page, evenOut(page, 120));
check("a panel grows to hold its contents when the gaps grow", holds(grown.find((b) => b.id === "hero"), grown.find((b) => b.id === "go")) && grown.find((b) => b.id === "hero").h === 400 + 40, JSON.stringify(grown.find((b) => b.id === "hero")));
const dense = after(page, scaleRhythm(page, 1.5));
check("density keeps the same promises: still parts stay, contents stay in their holders", !scaleRhythm(page, 1.5).some((m) => m.id === "dust" || m.id === "bar") && holds(dense.find((b) => b.id === "panel"), dense.find((b) => b.id === "p2")), JSON.stringify(dense.find((b) => b.id === "panel")));
check("flowOf: a Builder layer and a fixed part are still, an absolute one loose, the rest in the flow", flowOf({ inert: true }) === "still" && flowOf({ from: { position: "fixed" } }) === "still" && flowOf({ from: { position: "absolute" } }) === "loose" && flowOf({ from: { position: "sticky" } }) === undefined && flowOf({}) === undefined);
check("a flat page of boxes measures as it always did", gapsOf([{ id: "a", x: 0, y: 0, w: 100, h: 100 }, { id: "b", x: 0, y: 140, w: 100, h: 100 }]).map((g) => g.gap).join() === "40");

/* ------------------------------------------------------------ 2. in the Builder, on the saved PST board */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (rt) => rt.abort());
const st = await openBoard(ui, URL_BASE, readBoard("pst"));
const wait = (ms) => ui.waitForTimeout(ms);
const nodes = () => ui.evaluate(() => window.__studioNodes?.() ?? []);

await ui.locator("[data-side-panel] [role=radio]").filter({ hasText: "Lab" }).first().click();
await wait(600);
const panel = ui.locator("[data-lab-panel]");
const says = await panel.locator('[data-lab-card="rhythm"] [data-lab-says]').innerText();
const listed = await panel.locator("[data-lab-gap]").allInnerTexts();
check("2. the Rhythm card lists no overlap as a gap", listed.every((t) => !/^-/.test(t)), `${says} | ${listed.join(" | ")}`);

const pageId = st.activePageId ?? st.pages?.[0]?.id;
const before = (await nodes()).filter((n) => n.pageId === pageId);
const flowing = before.filter((n) => !n.locked && n.id !== "background" && flowOf(n) !== "still");
const holderOf = new Map(flowing.map((b) => {
  let h = null;
  for (const a of flowing) if (a !== b && holds(a, b) && !(holds(b, a) && flowing.indexOf(a) > flowing.indexOf(b)) && (!h || a.w * a.h < h.w * h.h)) h = a;
  return [b.id, h?.id ?? null];
}));
check("…the board is open on a page with parts to even out", flowing.length > 10, `${flowing.length} parts on ${pageId}`);
const bottom = (list) => Math.max(...list.map((n) => n.y + n.h));
const even = panel.locator("[data-lab-even]");
if (await even.count()) {
  const usual = Number(/(\d+)px/.exec(await even.innerText())?.[1]);
  const room = gapsOf(flowing.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, flow: flowOf(n) }))).reduce((s, g) => s + Math.max(0, usual - g.gap), 0);
  await even.click();
  await wait(500);
  const now = (await nodes()).filter((n) => n.pageId === pageId);
  const byId = new Map(now.map((n) => [n.id, n]));
  const strays = [...holderOf].filter(([id, h]) => h && !holds(byId.get(h), byId.get(id))).map(([id]) => id);
  check("Even out leaves every part inside the part that held it", strays.length === 0, `${strays.length} left their holder: ${strays.slice(0, 5).join(", ")}`);
  const still = before.filter((n) => flowOf(n) === "still" && (byId.get(n.id).y !== n.y || byId.get(n.id).h !== n.h));
  check("…fixed parts and the Builder's own layers did not move", still.length === 0, still.map((n) => n.id).join());
  check("…and the page grew by no more than its gaps did", bottom(now) - bottom(before) <= room + 1, `${bottom(before)} → ${bottom(now)}, gaps add up to ${room}`);
  await ui.keyboard.press("Control+z");
  await wait(500);
  const back = (await nodes()).filter((n) => n.pageId === pageId);
  const moved = back.filter((n) => { const o = before.find((b) => b.id === n.id); return !o || o.x !== n.x || o.y !== n.y || o.w !== n.w || o.h !== n.h; });
  check("one undo puts every part back where it was", moved.length === 0 && back.length === before.length, `${moved.length} still moved`);
} else {
  check("the page keeps its rhythm already (no Even out to press)", /keeps its rhythm|no rhythm/.test(says), says);
}
check("no page error", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
