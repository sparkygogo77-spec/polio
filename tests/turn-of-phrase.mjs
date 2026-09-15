/**
 * The hero's turn, and the header's links, on more than short English (inventory C12).
 *
 * `splitTurn` found the last word at the last space and the last sentence at
 * the last full stop: a line in Chinese, Japanese or Thai has no spaces, so
 * the whole line was the accent, and a sentence ending in "!", "?" or "。"
 * had no end. A hero read two lines of its content and dropped a third.
 * Nothing carried a `dir`, so a Hebrew or Arabic line sat left-aligned. The
 * header's links were a row that could not wrap, so in a 900-wide header a
 * ninth link slid under the button.
 *
 *   · the turn is found with the language's own word and sentence breaks
 *     (`Intl.Segmenter` where the runtime has it, the old rule where not);
 *   · "!", "?", "。", "！" and "？" end a sentence;
 *   · a hero's subline is every line after the first, not the second alone;
 *   · the hero's lines and the value line carry `dir="auto"`, and the
 *     header's links wrap.
 *
 *   node tests/turn-of-phrase.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. The turn, as a pure function. */
let splitTurn = null;
try { ({ splitTurn } = await import("../src/features/studio/parts/turn.ts")); } catch { /* not there yet */ }
check("the turn is a pure module the hero and the call to action share", typeof splitTurn === "function");
if (splitTurn) {
  const show = (r) => `"${r.head}" + "${r.tail}"`;
  const en = splitTurn("Power in the dark.", "last word");
  check("English: the last word", en.head === "Power in the " && en.tail === "dark.", show(en));
  const zh = splitTurn("我们在黑暗中前行", "last word");
  check("Chinese, no spaces: the last word, not the whole line", zh.tail && zh.tail.length < 6 && zh.head.length > 0 && zh.head + zh.tail === "我们在黑暗中前行", show(zh));
  const th = splitTurn("พลังในความมืด", "last word");
  check("Thai, no spaces: the last word, not the whole line", th.tail && th.head.length > 0 && th.head + th.tail === "พลังในความมืด", show(th));
  const ex = splitTurn("Not a trend! A transmission.", "second sentence");
  check("a sentence can end in an exclamation mark", ex.head === "Not a trend! " && ex.tail === "A transmission.", show(ex));
  const q = splitTurn("Ready? Then go.", "second sentence");
  check("or a question mark", q.head === "Ready? " && q.tail === "Then go.", show(q));
  const jp = splitTurn("流行ではない。伝送だ。", "second sentence");
  check("or an ideographic full stop", jp.head === "流行ではない。" && jp.tail === "伝送だ。", show(jp));
  const one = splitTurn("One sentence only.", "second sentence");
  check("one sentence alone turns whole", one.head === "" && one.tail === "One sentence only.", show(one));
  const none = splitTurn("Left alone.", "none");
  check("and no turn leaves the line alone", none.head === "Left alone." && none.tail === null, show(none));
}

/* 2. The hero and the header, on the live page. */
const HEADER = (readFileSync("src/features/studio/parts/index.ts", "utf8").match(/component: Header, ids: \["([\w-]+)"/) ?? [])[1] ?? "header";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.clear());
await page.evaluate(({ header }) => {
  const base = (id, featureId, x, y, w, h, content) => ({ id, pageId: "page_home", featureId, label: featureId, prompt: "", content, x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null });
  const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
  const st = doc.state ?? {};
  const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
  st.nodes = [
    { ...base("n_head", header, 0, 0, 900, 76, "Home, Work, About, Contact, Pricing, Docs, Blog, Careers, Press, Partners, Status, Legal"), pageId },
    { ...base("n_hero", "hero-gradient", 0, 100, 1440, 420, "שלום עולם\nThe second line.\nAnd a third line that used to be dropped."), pageId },
  ];
  st.selection = [];
  doc.state = st;
  localStorage.setItem("builder.studio", JSON.stringify(doc));
}, { header: HEADER });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.keyboard.press("p");
await page.waitForTimeout(900);
check("p flips the board to Preview", (await page.locator("[data-live-scroller]").count()) === 1);

const h1 = page.locator('[data-live-node="n_hero"] h1').first();
const dir = await h1.evaluate((el) => ({ attr: el.getAttribute("dir"), computed: getComputedStyle(el).direction }));
check("a Hebrew headline runs right to left", dir.attr === "auto" && dir.computed === "rtl", JSON.stringify(dir));
const sub = await page.locator('[data-live-node="n_hero"] p').first().innerText().catch(() => "");
check("the subline carries the second and the third line", /second line/.test(sub) && /third line/.test(sub), sub.slice(0, 80) || "no subline");

const tops = await page.locator('[data-live-node="n_head"] nav[aria-label="Main"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
const navWrap = await page.locator('[data-live-node="n_head"] nav[aria-label="Main"]').first().evaluate((el) => getComputedStyle(el).flexWrap);
check("twelve links in a 900-wide header wrap to a second row rather than sliding under the button", navWrap === "wrap" && new Set(tops).size >= 2, `flex-wrap ${navWrap}, ${new Set(tops).size} rows for ${tops.length} links`);
const edges = await page.locator('[data-live-node="n_head"] [data-part]').first().evaluate((el) => {
  const nav = el.querySelector('nav[aria-label="Main"]');
  const buttons = [...el.querySelectorAll(":scope > button")];
  const cta = buttons[buttons.length - 1];
  return { navRight: Math.round(nav.getBoundingClientRect().right), ctaLeft: Math.round(cta.getBoundingClientRect().left) };
});
check("and no link sits under the header's button", edges.navRight <= edges.ctaLeft, `links end at ${edges.navRight}, the button starts at ${edges.ctaLeft}`);

await page.evaluate(() => localStorage.clear());
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
