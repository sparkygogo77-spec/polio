#!/usr/bin/env node
/**
 * A LINK TO A PART SCROLLS THE PAGE IT WAS PRESSED ON, NOT THE OTHER ONE.
 *
 * The audit (2026-10-11): with the Preview on and the phone companion open,
 * both draw the same page with the same part ids, and a link to a part
 * searched the whole document for it. The companion comes first, so a
 * "jump to section" pressed on the big Preview scrolled the companion and
 * left the Preview where it was. An id with a `"` in it broke the search.
 * On the saved PST board, a part at the top given a link to the part at
 * the foot of the same page, and one given a link to an id with a quote:
 *
 *   · pressed on the Preview, the Preview scrolls and the companion does not;
 *   · the quoted id throws nothing.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-node-link.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/LiveSite.tsx, src/features/studio/Preview.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The board, with two links put on it: the top box to the foot of the page, the next to an id with a quote. */
const saved = readBoard("pst");
const doc = boardDoc(saved);
const here = doc.nodes.filter((n) => n.pageId === doc.activePageId);
const boxes = here.filter((n) => n.featureId === "box").sort((a, b) => a.y - b.y);
const [from, quoted] = boxes;
const foot = here.slice().sort((a, b) => b.y - a.y)[0];
const QUOTE = 'no"such\\part';
const put = (state) => {
  for (const n of state.nodes ?? []) {
    /* A box given Push on press and a place to go is a link, whole (`blocks.tsx`). */
    if (n.id === from.id) Object.assign(n, { link: { kind: "node", target: foot.id }, work: { id: "press-push" } });
    if (n.id === quoted.id) Object.assign(n, { link: { kind: "node", target: QUOTE }, work: { id: "press-push" } });
  }
  state.companion = { ...(state.companion ?? {}), open: true };
};
const edit = (raw) => { const o = JSON.parse(raw); if (o?.state) put(o.state); return JSON.stringify(o); };
if (saved.local["builder.studio"]) saved.local["builder.studio"] = edit(saved.local["builder.studio"]);
for (const r of saved.idb["builder.docs"]?.stores?.docs ?? []) if (r.key === "builder.studio" && typeof r.value === "string") r.value = edit(r.value);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());

await openBoard(ui, URL_BASE, saved);
await ui.locator('[aria-label="Preview"]').first().click();
await ui.waitForTimeout(2500);
const toggle = ui.getByRole("button", { name: "Toggle companion" });
if (!(await ui.locator("[data-companion-page]").count()) && (await toggle.count())) await toggle.first().click();
await ui.waitForTimeout(1500);

/* The scroll of the big Preview (the nearest scroller above its copy of the part) and of the companion. */
const scrolls = () => ui.evaluate((id) => {
  const sel = `[data-live-node="${id}"]`;
  const stage = [...document.querySelectorAll(sel)].find((e) => !e.closest("[data-companion-page]"));
  let s = stage?.parentElement;
  while (s && !(s.scrollHeight > s.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  return { stage: s ? s.scrollTop : null, companion: document.querySelector("[data-live-scroller]")?.scrollTop ?? null };
}, from.id);
const press = (id) => ui.evaluate((id) => {
  const part = [...document.querySelectorAll(`[data-live-node="${id}"]`)].find((e) => !e.closest("[data-companion-page]"));
  const link = part?.querySelector("[data-link-whole]");
  link?.click();
  return !!link;
}, id);

const companion = await ui.locator("[data-companion-page]").count();
check("the Preview is on and the companion draws the page", companion > 0, `${companion} companion`);
const before = await scrolls();
const pressed = await press(from.id);
await ui.waitForTimeout(1500);
const after = await scrolls();
check("a link to the foot, pressed on the Preview, scrolls the Preview", pressed && after.stage > (before.stage ?? 0) + 100, `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
check("…and the companion stays where it was", after.companion === before.companion, `${before.companion} → ${after.companion}`);

const was = errors.length;
const pressedQuote = await press(quoted.id);
await ui.waitForTimeout(500);
check("a link to an id with a quote throws nothing", pressedQuote && errors.length === was, errors.slice(was).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
