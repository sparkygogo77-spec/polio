#!/usr/bin/env node
/**
 * WORDS TYPED INTO ONE PART REDRAW A FEW PARTS, NOT THE BOARD.
 *
 * Every part's stack (`themeDraw.tsx#stacksOf`: how it rides the view, its
 * level) was made anew on every change to the parts, and a new object is a
 * new prop for the part's `NodeView`: on sol face, 536 of 800 parts drew
 * again for words typed into one. The board keeps each part's stack object
 * while it stands the same (`board/DesktopCanvas.tsx`).
 *
 *   1. typing into a part and keeping the words (Enter) redraws fewer than
 *      40 parts' views (counted in React's commits: the part components that
 *      did work; base 540);
 *   2. the board is the same after: every part's box and every part's stack
 *      style (its z-index and translate) as on a fresh load of the edited
 *      board;
 *   3. no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-few-redraw.mjs http://127.0.0.1:3013 [board]   # default solface
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx
 */
import { chromium } from "playwright-core";
import { readBoard, seedBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const board = readBoard(process.argv[3] ?? "solface");
const MOST = 40;

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
/*
 * React's commits, read the way its devtools read them: a part's view is the
 * nearest component above the element that carries `data-node-id`, and it
 * drew in a commit when it did work there (the PerformedWork flag). Names
 * are minified in a production build; the shape is not.
 */
await page.addInitScript(() => {
  window.__drew = new Set();
  window.__count = false;
  const isComponent = (f) => typeof f.type === "function" || (f.type && typeof f.type === "object");
  const visit = (f) => {
    for (let x = f; x; x = x.sibling) {
      const id = typeof x.type === "string" ? x.memoizedProps?.["data-node-id"] : undefined;
      if (id) { let p = x.return; while (p && !isComponent(p)) p = p.return; if (p && (p.flags & 1)) window.__drew.add(id); }
      if (x.child) visit(x.child);
    }
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject() { return 1; }, onCommitFiberRoot(_i, root) { if (window.__count) visit(root.current.child); }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {} };
});

const still = async () => {
  const geo = () => page.evaluate(() => (window.__studioNodes?.() ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).join("|"));
  let g = await geo(), same = 0;
  for (let i = 0; i < 480 && same < 24; i++) { await page.waitForTimeout(250); const now = await geo(); same = now === g ? same + 1 : 0; g = now; }
  await page.waitForTimeout(1000);
};
const looks = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-node-id]")].map((el) => {
  const b = document.querySelector("[data-board-zoom]")?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return [el.getAttribute("data-node-id"), [Math.round((r.left - (b?.left ?? 0)) * 100) / 100, Math.round((r.top - (b?.top ?? 0)) * 100) / 100, Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100, el.style.zIndex, el.style.translate].join(",")];
})));

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await still();
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
  const open = () => page.evaluate(() => document.activeElement?.getAttribute("contenteditable") != null);
  for (let i = 0; i < 3 && !(await open()); i++) {
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  await page.keyboard.press("End");
  await page.keyboard.type(" AND MORE");
  await page.evaluate(() => { window.__drew = new Set(); window.__count = true; });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const drew = await page.evaluate(() => { window.__count = false; return [...window.__drew]; });
  const all = await page.evaluate(() => document.querySelectorAll("[data-node-id]").length);
  check(`keeping the words redraws fewer than ${MOST} parts' views`, drew.length < MOST, `${drew.length} of ${all}`);
  await still();
  const after = await looks();
  await page.reload({ waitUntil: "networkidle" });
  await still();
  const fresh = await looks();
  const diff = Object.keys(fresh).filter((id) => after[id] !== fresh[id]);
  check("every part's box and stack is a fresh load's", diff.length === 0, diff.length ? `${diff.length} differ, e.g. ${diff[0]}: ${after[diff[0]]} vs ${fresh[diff[0]]}` : `${Object.keys(fresh).length} parts`);
}
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
