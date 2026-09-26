/**
 * TEXT THE CAPTURE SAYS IS CENTRED IS CENTRED ON ITS PART.
 *
 * MEASURED on trunk f35ac75 with sink's home page: "No PnL data available",
 * "No tokens created yet" and "Launch your first token…" each carry
 * `text.align: "center"` and a 1457-wide box, and each drew its words 456px
 * left of the part's centre. The part was right. The words sit in a holder
 * capped at the site's line length (`t.measurePx`: "Line length", 66
 * characters, 541px), and that holder sat at the part's left edge, so the words
 * were centred inside 541px rather than inside 1457.
 *
 * The check reads the drawn words against the drawn part, on the board and
 * on the live page, for every captured paragraph that says centre. And the
 * guard: every paragraph that says left, or says nothing, still starts at its
 * part's left edge, no stored alignment changes and no centred part moves. No expected
 * number is written here; each one is the fixture's or the page's.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/centred-text.mjs http://127.0.0.1:3013
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
const home = doc.nodes.filter((n) => n.pageId === "page_home" && n.featureId === "prose");
/*
 * AND TEXT ITS OWN BOX CENTRES IS CENTRED. MEASURED on trunk 3e14749:
 * n_prose_40 "No PnL data available for the selected period" carries no
 * text.align but `layout {display: flex, direction: row, justify: center}` —
 * the page centred it with flexbox — and drew its words at the left while
 * n_prose_45 under it, saying centre, drew centred. Only horizontal centring
 * counts: justify centre on a row, align centre on a column. Across sink's
 * nine pages that is nine text parts: this one, and eight buttons that say
 * centre already.
 */
const boxCentres = (l) => !!l && l.display === "flex" && ((l.direction ?? "row") === "row" ? l.justify === "center" : l.align === "center");
const said = (n) => n.text?.align ?? (boxCentres(n.layout) ? "center" : "none");
const centred = home.filter((n) => said(n) === "center");
const flush = home.filter((n) => said(n) !== "center" && said(n) !== "right");
const byBox = centred.filter((n) => !n.text?.align);
/* Half a glyph is the most rounding and a 2px side bearing could explain. */
const NEAR = 3;

check("the fixture has a paragraph its own box centres, with no alignment of its own", byBox.length > 0, byBox.map((n) => n.id).join(" "));
check("the fixture has captured paragraphs that say centre, and ones that do not",
  centred.length > 0 && flush.length > 0, `${centred.length} centre, ${flush.length} left or unsaid`);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, activePageId: "page_home" }, version: 0 })), doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

/*
 * Where each paragraph's words sit in its part, in the part's own units: the
 * words' centre against the part's centre, and the words' left edge against
 * the part's inner left edge (inside its padding).
 */
const READ = ({ attr, ids }) => {
  const out = {};
  for (const id of ids) {
    const el = document.querySelector(`[${attr}="${id}"]`);
    if (!el) continue;
    const box = el.getBoundingClientRect();
    /* The part's drawing, not the board's chrome round it (its label, its size readout). */
    const surface = el.querySelector("[data-part]") ?? el;
    const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, { acceptNode: (t) => (t.textContent.trim() ? 1 : 2) });
    let l = Infinity, r = -Infinity;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) { if (q.width) { l = Math.min(l, q.left); r = Math.max(r, q.right); } }
    }
    if (l === Infinity) continue;
    /* The part's own drawing surface: the outermost element that fills it. */
    let fill = el; while (fill.firstElementChild && Math.abs(fill.firstElementChild.getBoundingClientRect().width - box.width) < 1) fill = fill.firstElementChild;
    const cs = getComputedStyle(fill);
    const inner = box.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    out[id] = { w: box.width, off: (l + r) / 2 - (box.left + box.right) / 2, fromLeft: l - inner };
  }
  return out;
};

for (const [where, path, attr] of [["the board", "/builder", "data-node-id"], ["the live page", "/builder/preview/", "data-live-node"]]) {
  if (path !== "/builder") { await page.goto(`${URL_BASE}${path}`, { waitUntil: "networkidle" }); await page.waitForTimeout(2000); }
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
  const stored = new Map(s.nodes.map((n) => [n.id, n]));
  const seen = await page.evaluate(READ, { attr, ids: home.map((n) => n.id) });
  /* Page units: the drawn width against the stored one. */
  const unit = (id, px) => px * (stored.get(id)?.w ?? 1) / seen[id].w;

  const c = centred.filter((n) => seen[n.id]);
  check(`${where}: every centred paragraph drew`, c.length === centred.length, `${c.length} of ${centred.length}`);
  const worst = c.map((n) => ({ id: n.id, off: Math.round(unit(n.id, seen[n.id].off)) })).sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  check(`${where}: centred words sit on their part's centre`, worst.length > 0 && Math.abs(worst[0].off) <= NEAR,
    worst.slice(0, 3).map((x) => `${x.id} ${x.off > 0 ? "+" : ""}${x.off}px`).join(", "));
  const f = flush.filter((n) => seen[n.id]);
  const drift = f.map((n) => ({ id: n.id, at: Math.round(unit(n.id, seen[n.id].fromLeft)) })).sort((a, b) => Math.abs(b.at) - Math.abs(a.at));
  check(`${where}: left and unsaid paragraphs still start at their part's left edge`, f.length > 0 && Math.abs(drift[0].at) <= NEAR,
    `${f.length} read; furthest ${drift[0]?.id} at ${drift[0]?.at}px`);
  /* The sweep's sentence rejoin widens the wordmark's pieces on open, on trunk
     too, so position is read only where this could move it: the centred ones. */
  check(`${where}: no stored alignment changed, and no centred paragraph moved`, home.every((n) => {
    const t = stored.get(n.id);
    return !t || ((t.text?.align ?? null) === (n.text?.align ?? null) && (said(n) !== "center" || (t.x === n.x && t.w === n.w)));
  }));
}
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
