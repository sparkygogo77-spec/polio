/**
 * A LINE OF WORDS THE DOCUMENT HOLDS AS ONE LINE IS DRAWN ON ONE LINE.
 *
 * MEASURED on 9bc39df with sink's home page: the header price "$ 116.59"
 * (`n_prose_92`, 59×20) and its change "-1.94 %" (`n_prose_95`, 43×16) are
 * each one line tall, at their own size and leading. Drawn in this machine's
 * monospace they need 67.8 and 50.6px (the capture's `own()` put a space in
 * each that the page never drew; see the handover, 6.11), so each broke onto
 * a second line, and the board's healing then grew them 20 → 40 and 16 → 32,
 * and their group 24 → 44, in the stored document, within seconds of opening.
 *
 * The fix is drawing only: a text part whose box holds one line of its own
 * type draws its words on that line, as wide as they need. No stored width
 * changes (the healing never writes one), nothing moves, and the words are
 * the document's, space and all.
 *
 * Read after the healing has had its chance, so a wrap that grows the box is
 * caught as the stored height it leaves behind. No expected number is written
 * here: every one is the fixture's.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/one-line-words.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url), "utf8"));
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const PRICE = ["n_prose_92", "n_prose_95"];
const GROUP = ["n_box_89", "n_box_91", "n_box_93"];
check("the fixture holds his header price as captured: one line each",
  PRICE.every((id) => byId.get(id)?.featureId === "prose" && typeof byId.get(id)?.content === "string"),
  PRICE.map((id) => `${id} ${JSON.stringify(byId.get(id)?.content)} ${byId.get(id)?.w}×${byId.get(id)?.h}`).join(", "));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, activePageId: "page_home" }, version: 0 })), doc);
await page.reload({ waitUntil: "networkidle" });
/* Past the healing's debounce and a font load: long enough that a wrap would have been stored. */
await page.waitForTimeout(4000);

const read = await page.evaluate((ids) => {
  const s = JSON.parse(localStorage.getItem("builder.studio")).state;
  const frame = document.querySelector("[data-frame]").getBoundingClientRect();
  const z = frame.width / s.frameWidth;
  const out = {};
  for (const id of ids) {
    const n = s.nodes.find((x) => x.id === id);
    const el = document.querySelector(`[data-node-id="${id}"]`);
    const surface = el?.querySelector("[data-part]");
    let lines = null;
    if (surface) {
      const tops = new Set();
      const w = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!t.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        for (const q of rg.getClientRects()) if (q.width) tops.add(Math.round(q.top / 2));
      }
      lines = tops.size;
    }
    out[id] = { stored: n ? [n.x, n.y, n.w, n.h] : null, drawnH: el ? Math.round(el.getBoundingClientRect().height / z) : null, lines };
  }
  return out;
}, [...PRICE, ...GROUP]);

for (const id of PRICE) {
  const c = byId.get(id), r = read[id];
  check(`${id} ${JSON.stringify(c.content)} draws on one line`, r.lines === 1, `${r.lines} lines`);
  check(`…and is drawn at its captured height, not grown`, r.drawnH === c.h && r.stored?.[3] === c.h, `drawn ${r.drawnH}, stored ${r.stored?.[3]}, captured ${c.h}`);
  check(`…with its stored width and place untouched`, r.stored?.[0] === c.x && r.stored?.[1] === c.y && r.stored?.[2] === c.w, `${r.stored?.slice(0, 3)} against ${[c.x, c.y, c.w]}`);
}
check("the group round them keeps its captured heights",
  GROUP.every((id) => read[id].stored?.[3] === byId.get(id).h),
  GROUP.map((id) => `${id} ${read[id].stored?.[3]} (captured ${byId.get(id).h})`).join(", "));
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
