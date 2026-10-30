#!/usr/bin/env node
/**
 * PART NAMES ARE WORKED OUT AFTER AN EDIT'S FRAME, AND COME OUT THE SAME.
 *
 * Every part's name looks at every other part (its holders, the heading
 * above it), and the board worked out all of them inside the task that
 * answered an edit: 0.4 s at 4× CPU on sol face's 800 parts, in an Enter
 * that kept typed words. The map is a deferred value now; the picked
 * parts' names, the tags in view, still come with the edit
 * (`board/DesktopCanvas.tsx`).
 *
 *   1. words typed into a part and kept (Enter): the board's names are worked
 *      out after the Enter's own task (the `studio:names` mark), and the
 *      words are kept;
 *   2. once the board is still, every part's tag is the tag a fresh load
 *      gives (all names worked out from nothing), after typing and after a
 *      drag;
 *   3. no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/names-after-edit.mjs http://127.0.0.1:3013 [board]   # default solface
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx
 */
import { chromium } from "playwright-core";
import { readBoard, seedBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const board = readBoard(process.argv[3] ?? "solface");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${URL_BASE}/api/version`, { waitUntil: "load" });
await seedBoard(page, board);

const still = async () => {
  const geo = () => page.evaluate(() => (window.__studioNodes?.() ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).join("|"));
  let g = await geo(), same = 0;
  for (let i = 0; i < 480 && same < 24; i++) { await page.waitForTimeout(250); const now = await geo(); same = now === g ? same + 1 : 0; g = now; }
  await page.waitForTimeout(1000);
};
const tags = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-node-id]")].map((n) => [n.getAttribute("data-node-id"), n.querySelector("[data-part-tag]")?.textContent ?? null])));
const sameTags = (a, b) => { const diff = Object.keys(b).filter((k) => a[k] !== b[k]); return { diff, n: Object.keys(b).length }; };

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await still();
/* A part of words in view. */
const target = await page.evaluate(() => {
  const nodes = new Map((window.__studioNodes?.() ?? []).map((n) => [n.id, n]));
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const n = nodes.get(el.getAttribute("data-node-id"));
    const r = el.getBoundingClientRect();
    if (!n || n.featureId !== "prose" || n.state || r.top < 120 || r.bottom > 760 || r.width < 60 || !(el.textContent ?? "").trim()) continue;
    const x = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2;
    if (document.elementFromPoint(x, y)?.closest("[data-node-id]") === el) return { id: n.id, x, y };
  }
  return null;
});
check("a part of words to type into", !!target, target?.id ?? "none in view");
if (target) {
  /* The Enter that keeps the words: when its task ends, and when the names are marked after it. Set up before the editor opens. */
  await page.evaluate(() => {
    performance.clearMarks("studio:names");
    window.__enterEnd = null;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "keydown" && window.__enterStart != null && e.startTime >= window.__enterStart - 1 && window.__enterEnd == null) window.__enterEnd = e.processingEnd; }).observe({ type: "event", durationThreshold: 16 });
    addEventListener("keydown", (e) => { if (e.key === "Enter" && window.__armed) window.__enterStart = performance.now(); }, { capture: true });
  });
  /* Picked, then Enter opens its words where they are drawn (`WordsInPlace.tsx`). */
  const open = () => page.evaluate(() => document.activeElement?.getAttribute("contenteditable") != null);
  for (let i = 0; i < 3 && !(await open()); i++) {
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  check("its words open where they are drawn", await open());
  await page.evaluate(() => { performance.clearMarks("studio:names"); window.__armed = true; });
  await page.keyboard.press("End");
  await page.keyboard.type(" AND MORE");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => ({ marks: performance.getEntriesByName("studio:names").map((m) => m.startTime), enterEnd: window.__enterEnd, enterStart: window.__enterStart }));
  const after = t.marks.length > 0 && t.enterEnd != null && t.marks.every((m) => m >= t.enterEnd);
  check("the names are worked out after the Enter's own task", after, `Enter ${Math.round(t.enterStart ?? -1)}–${Math.round(t.enterEnd ?? -1)} ms, names at ${t.marks.map(Math.round).join(", ") || "never marked"}`);
  const kept = await page.evaluate((id) => JSON.stringify((window.__studioNodes?.() ?? []).find((n) => n.id === id)?.content ?? ""), target.id);
  check("the typed words are kept", /AND MORE/.test(kept), kept.slice(0, 80));
  await still();
  /* The same part, dragged 40 px down and let go. */
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(target.x, target.y + 5 * i);
  await page.mouse.up();
  await still();
  const dragged = await tags();
  await page.reload({ waitUntil: "networkidle" });
  await still();
  const fresh = await tags();
  const { createHash } = await import("node:crypto");
  console.log(`  every tag after the edits hashes to ${createHash("sha1").update(JSON.stringify(Object.entries(dragged).sort())).digest("hex").slice(0, 12)}`);
  const a = sameTags(dragged, fresh);
  check("after typing and a drag, every tag is the tag a fresh load gives", a.diff.length === 0, a.diff.length ? `${a.diff.length} differ, e.g. ${a.diff[0]}: ${JSON.stringify(dragged[a.diff[0]])} vs ${JSON.stringify(fresh[a.diff[0]])}` : `${a.n} tags`);
}
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
