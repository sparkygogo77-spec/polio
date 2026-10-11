#!/usr/bin/env node
/**
 * AN EDIT MADE JUST BEFORE SWITCHING SITES GOES WITH THE SITE IT WAS MADE ON.
 *
 * The audit (2026-10-11): on a site too big for localStorage (PonsStars:
 * the mirror holds a pointer, the document is in IndexedDB) an edit waits
 * 120 ms before it reaches IndexedDB. Switching sites inside that wait saved
 * the old site's slot from IndexedDB without the edit, and the switch then
 * dropped the waiting write: back on PonsStars, the edit was gone. A write
 * already queued could also land on the live key after the switch, so the
 * other site's live copy was PonsStars.
 *
 *   1. an edit on the PST board and, in the same moment, a press on the other
 *      site in the switcher: PST's own slot has the edit;
 *   2. the other site's live copy is its own (blank), not PST's;
 *   3. switching back, PST is on the board with the edit.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/builds-switch-flush.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/builds/store.ts, src/features/builds/SwitchButton.tsx, src/features/studio/docStore.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { readBoard, seedBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());

/* The PST board, and a second site beside it with nothing saved yet. */
const board = readBoard("pst");
const builds = JSON.parse(board.local["builder.builds"]);
const pst = builds.state.activeId;
builds.state.projects.push({ id: "other", name: "Other site", updatedAt: Date.now() });
board.local["builder.builds"] = JSON.stringify(builds);
await ui.goto(`${URL_BASE}/api/version`, { waitUntil: "load" });
await seedBoard(ui, board);
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
const until = async (fn, arg, ms = 30_000) => {
  for (const end = Date.now() + ms; Date.now() < end; await ui.waitForTimeout(200)) if (await ui.evaluate(fn, arg)) return true;
  return false;
};
await until(() => (window.__studioNodes?.()?.length ?? 0) > 0 && document.querySelectorAll("[data-node-id]").length > 0);
await ui.waitForTimeout(500);
const parts = await ui.evaluate(() => window.__studioNodes().length);

/** The document under a key in IndexedDB, parsed. */
const stored = (key) => ui.evaluate((key) => new Promise((done) => {
  const open = indexedDB.open("builder.docs");
  open.onsuccess = () => {
    const req = open.result.transaction("docs", "readonly").objectStore("docs").get(key);
    req.onsuccess = () => { open.result.close(); try { done(JSON.parse(req.result ?? "null")?.state ?? null); } catch { done(null); } };
    req.onerror = () => done(null);
  };
  open.onerror = () => done(null);
}), key);
const activeId = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.activeId ?? null);
const pressSite = (name) => ui.evaluate((name) => {
  const b = [...document.querySelectorAll("li > button")].find((x) => x.textContent?.includes(name));
  b?.click();
  return !!b;
}, name);

/* 1. The edit and the press in one tick: the edit has not reached IndexedDB when the switch starts. */
const MARK = `edited-${Date.now()}`;
await ui.click("[data-builds-switch]");
await ui.waitForTimeout(300);
const pressed = await ui.evaluate(({ mark }) => {
  window.__studioSetFormat("audit.switchFlush", mark);
  const b = [...document.querySelectorAll("li > button")].find((x) => x.textContent?.includes("Other site"));
  b?.click();
  return !!b;
}, { mark: MARK });
check("the switcher offers the other site", pressed);
await until((id) => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.activeId === id, "other");
/* Long enough for any write still queued from PST to have landed. */
await ui.waitForTimeout(3000);
const slotDoc = await stored(`builder.doc:${pst}`);
check("1. PST's slot has the edit made just before the switch", slotDoc?.format?.["audit.switchFlush"] === MARK, `${slotDoc?.format?.["audit.switchFlush"] ?? "missing"}, ${slotDoc?.nodes?.length ?? 0} parts`);

/* 2. */
const liveDoc = await stored("builder.studio");
check("2. the other site's live copy is its own, not PST's", (await activeId()) === "other" && (liveDoc?.nodes?.length ?? 0) === 0, `${liveDoc?.nodes?.length ?? 0} parts live under ${await activeId()}`);

/* 3. */
await ui.click("[data-builds-switch]");
await ui.waitForTimeout(300);
const back = await pressSite("PST");
await until((id) => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.activeId === id, pst);
await until(() => (window.__studioNodes?.()?.length ?? 0) > 0);
await ui.waitForTimeout(500);
const after = await ui.evaluate(() => ({ parts: window.__studioNodes().length, mark: window.__studioPublishDoc?.()?.format?.["audit.switchFlush"] ?? null }));
const liveBack = await stored("builder.studio");
check("3. back on PST: every part, and the edit", back && after.parts === parts && (after.mark ?? liveBack?.format?.["audit.switchFlush"]) === MARK, `${after.parts} of ${parts} parts, edit ${after.mark ?? liveBack?.format?.["audit.switchFlush"] ?? "missing"}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
