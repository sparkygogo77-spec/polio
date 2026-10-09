#!/usr/bin/env node
/**
 * A SHELF CARD CARRIED ONTO A PART, AND A CURSOR THAT WORKS.
 *
 * J (2026-10-09): dragging a Motion card showed a faint ghost and dropping
 * it made a new text box; "Add to page" on Push on press made a little text
 * box; the custom cursor hid the pointer in the preview and showed nothing;
 * and a cursor could not be a picture of his. PST's web/ is brought in
 * through a stand-in GitHub, at 1440:
 *
 *   · a Motion card lifted by the hand is a solid copy of the card, and the
 *     part under it is ringed;
 *   · let go on a part, the part takes the effect and no part is added;
 *   · "Pick a part to put it on" with nothing picked, then a press on a
 *     part: that part takes it, no text box;
 *   · Tilt on hover dropped on a part tilts that part;
 *   · the custom cursor on, the preview shows its dot under the hand;
 *   · a picture given to the cursor becomes a 32px PNG whose corners are
 *     see-through, and the preview's pointer is that picture.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/shelf-carry.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/cardCarry.ts, src/features/studio/cursorPicture.ts, src/features/studio/ShelfCards.tsx, src/features/studio/live/LiveShell.tsx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROOT = process.env.PST_ROOT ?? "tests/fixtures/pst-tv";
const FILES = {};
const walk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, r); else if (n !== "FROM.md") FILES[r] = readFileSync(p); } };
walk(ROOT);
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/pst(\/.*)?$/);
  if (!mm) return j({ message: "no" }, 404);
  const rest = mm[1] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: FILES[names[Number(b[1])]].toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10).split("?")[0]); return FILES[f] !== undefined ? j({ content: FILES[f].toString("base64"), encoding: "base64" }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: "c0" } });
  if (rest.startsWith("/commits/")) return j({ sha: "c0" });
  return j({ message: "no" }, 404);
});
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await ui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "PST", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
  localStorage.setItem("builder.shelf.folded", "0");
});
await ui.reload({ waitUntil: "networkidle" });
await ui.waitForTimeout(900);
const keys = ui.locator("[data-keys-panel]");
await ui.getByRole("button", { name: "Keys", exact: true }).click();
await ui.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await ui.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await ui.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await ui.waitForTimeout(500);
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(700);
await ui.locator("[data-repo-bring]").fill("him/pst");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 150 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(2500);
st = await board();
check("PST came in", st.nodes.length > 20, `${st.nodes.length} parts on ${st.pages?.length} pages`);


const wait = (ms) => ui.waitForTimeout(ms);
/* The document, from localStorage while it fits there and from IndexedDB once it does not (docStore.ts). */
const nodesOf = async () => {
  await wait(1200);
  return ui.evaluate(async () => {
    const mirror = JSON.parse(localStorage.getItem("builder.studio") ?? "{}");
    if (mirror.state?.nodes) return mirror.state.nodes;
    const db = await new Promise((ok, no) => { const r = indexedDB.open("builder.docs"); r.onsuccess = () => ok(r.result); r.onerror = no; });
    const v = await new Promise((ok, no) => { const r = db.transaction("docs").objectStore("docs").get("builder.studio"); r.onsuccess = () => ok(r.result); r.onerror = no; });
    return JSON.parse(v ?? "{}").state?.nodes ?? [];
  });
};
const openMotion = async () => {
  if (!(await ui.locator('[data-category-open="motion"]').count())) await ui.locator('[data-category="motion"]').first().click();
  await wait(1200);
};
await openMotion();

/* A part on the board, in view, on top under its own middle. */
const partInView = async (skip = []) => ui.evaluate((skip) => {
  const pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const id = el.getAttribute("data-node-id");
    if (skip.includes(id)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 20 || !pane || r.top < pane.top + 10 || r.bottom > pane.bottom - 10 || r.left < pane.left || r.right > pane.right) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") !== id) continue;
    return { id, x, y };
  }
  return null;
}, skip);

/* A point on the card that is the card's own, not under the shelf's sticky bar or off the screen. */
const grip = (sel) => ui.evaluate((sel) => {
  const c = document.querySelector(sel);
  if (!c) return null;
  const r = c.getBoundingClientRect();
  for (let y = r.top + 8; y < Math.min(r.bottom, innerHeight) - 4; y += 8) {
    const e = document.elementFromPoint(r.left + r.width / 2, y);
    if (e && c.contains(e) && !e.closest("[role=switch],a,input")) return { x: r.left + r.width / 2, y };
  }
  return null;
}, sel);
const carry = async (from, to) => {
  await ui.mouse.move(from.x, from.y);
  await ui.mouse.down();
  for (let i = 1; i <= 12; i++) { await ui.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12); await wait(16); }
};
const card = ui.locator('[data-work-card="press-push"]').first();
await card.scrollIntoViewIfNeeded();
const cb = await card.boundingBox();
const target = await partInView();
check("a part is in view to drop on", !!target && !!cb, JSON.stringify(target));
const before = await nodesOf();
await carry(await grip('[data-work-card="press-push"]'), target);
const mid = await ui.evaluate(() => {
  const c = document.querySelector("[data-card-carried]");
  const r = document.querySelector("[data-carry-ring]");
  return { carried: !!c, opacity: c ? getComputedStyle(c).opacity : "", ring: r ? r.style.display : "none", says: r?.textContent ?? "" };
});
check("lifted, the card is a solid copy following the hand", mid.carried && mid.opacity === "1", JSON.stringify(mid));
check("…and the part under it is ringed with what it will take", mid.ring === "block" && /Push on press/.test(mid.says), mid.says);
await ui.screenshot({ path: ".screenshots/shelf-carry-mid.png" });
await ui.mouse.up();
await wait(600);
let after = await nodesOf();
const took = after.find((n) => n.id === target.id);
const has = (n, id) => JSON.stringify(n?.work ?? null).includes(`"${id}"`);
check("let go on the part, the part takes Push on press", has(took, "press-push"), JSON.stringify(took?.work));
check("…and no part is added", after.length === before.length, `${before.length} -> ${after.length}`);
check("…and the carried copy is gone", (await ui.locator("[data-card-carried]").count()) === 0);

/* Nothing picked: the detail card's button picks a part instead of making a text box. */
await ui.mouse.click(320, 420);
await wait(300);
await openMotion();
const lift = ui.locator('[data-work-card="hover-lift"]').first();
await lift.scrollIntoViewIfNeeded();
const lg = await grip('[data-work-card="hover-lift"]');
await ui.mouse.click(lg.x, lg.y);
await wait(500);
const put = ui.locator("[data-part-detail] [data-add-to-page]");
const label = (await put.innerText()).trim();
check("with nothing picked, the button says to pick a part", /Pick a part/.test(label), label);
await put.click();
await wait(300);
check("…pressed, a chip by the hand says to press the part", (await ui.locator("[data-put-on-armed]").count()) === 1);
const second = await partInView([]);
await ui.mouse.move(second.x, second.y);
await wait(100);
await ui.mouse.click(second.x, second.y);
await wait(600);
after = await nodesOf();
check("…and the part pressed takes Lift on hover, no text box made", has(after.find((n) => n.id === second.id), "hover-lift") && after.length === before.length, `${after.length} parts`);

/* Tilt on hover, a whole-site card, dropped on a part. */
const tilt = ui.locator('[data-shelf-card="hover-tilt"]').first();
await tilt.scrollIntoViewIfNeeded();
const third = await partInView([]);
await carry(await grip('[data-shelf-card="hover-tilt"]'), third);
await ui.mouse.up();
await wait(600);
after = await nodesOf();
check("Tilt on hover dropped on a part tilts that part", has(after.find((n) => n.id === third.id), "tilt"), JSON.stringify(after.find((n) => n.id === third.id)?.work));

/* The cursor: on, then given a picture. */
await ui.locator('[data-shelf-card="cursor-effects"] [data-site-switch]').first().click();
await wait(400);
await ui.locator('[aria-label="Preview"]').first().click();
await wait(1500);
const surf = await ui.evaluate(() => {
  const s = document.querySelector("[data-live-shell]")?.parentElement?.getBoundingClientRect();
  return s ? { x: s.left + s.width / 2, y: s.top + Math.min(200, s.height / 2) } : null;
});
check("the preview opens", !!surf);
if (surf) {
  await ui.mouse.move(surf.x - 30, surf.y - 30);
  await ui.mouse.move(surf.x, surf.y, { steps: 4 });
  await wait(300);
  const dot = await ui.evaluate(() => {
    const d = document.querySelector("[data-live-cursor-dot]");
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { shown: getComputedStyle(d).visibility, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  check("cursor on, the preview shows its dot under the hand", !!dot && dot.shown === "visible" && Math.abs(dot.x - surf.x) < 6 && Math.abs(dot.y - surf.y) < 6, JSON.stringify(dot));
  await ui.screenshot({ path: ".screenshots/shelf-carry-cursor-dot.png" });
  await ui.locator('[aria-label="Preview"]').first().click();
  await wait(800);
}

/* A picture: an arrow drawn on a white plate. */
const png = await ui.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 200; c.height = 200;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 200);
  g.fillStyle = "#e11"; g.beginPath(); g.moveTo(60, 50); g.lineTo(150, 120); g.lineTo(100, 125); g.lineTo(75, 165); g.closePath(); g.fill();
  return c.toDataURL("image/png").split(",")[1];
});
await openMotion();
await ui.locator('[data-shelf-card="cursor-effects"] [data-tile]').first().click();
await wait(500);
await ui.locator("[data-part-detail] input[type=file]").setInputFiles({ name: "arrow.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
await wait(1200);
const cur = (await nodesOf()).find((n) => n.featureId === "cursor-effects");
const made = cur?.options?.picture ?? "";
const pix = made ? await ui.evaluate(async (src) => {
  const i = new Image(); i.src = src; await i.decode();
  const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
  const g = c.getContext("2d"); g.drawImage(i, 0, 0);
  const a = (x, y) => g.getImageData(x, y, 1, 1).data[3];
  return { w: i.width, h: i.height, tip: a(1, 1), far: a(i.width - 1, 0), low: a(0, i.height - 1) };
}, made) : null;
check("a picture given to the cursor becomes its picture", cur?.options?.style === "picture" && made.startsWith("data:image/png"), cur?.options?.style);
check("…32px, its plate see-through, its tip at the top left", !!pix && pix.w === 32 && pix.h === 32 && pix.far === 0 && pix.low === 0 && pix.tip > 0, JSON.stringify(pix));
await ui.keyboard.press("Escape");
await wait(300);
await ui.locator('[aria-label="Preview"]').first().click();
await wait(1500);
const pointer = await ui.evaluate(() => {
  const s = document.querySelector("[data-live-cursor]");
  const inner = s?.querySelector("button, a, p, div") ?? s;
  return s ? getComputedStyle(inner).cursor.slice(0, 40) : "";
});
check("…and in the preview the pointer is that picture", /^url\("data:image\/png/.test(pointer), pointer);
await ui.screenshot({ path: ".screenshots/shelf-carry-cursor-picture.png" });

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${results.length - bad}/${results.length} passed`);
process.exit(bad ? 1 : 0);
