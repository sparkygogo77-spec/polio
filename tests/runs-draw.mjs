/**
 * A sentence with a coloured word in it is one part, on one line.
 *
 * HIS TWO CASES, as he described them. The price line on his site reads a
 * Solana mark, "$118.35", a down arrow, "-0.46%" — one sentence, several
 * colours, inline. The board showed "$" and "116.59" stacked on one side,
 * "-1.94" and "%" on the other, the arrow adrift between them. And his
 * header reads "A Sol Works project" on one line where "Works" is a
 * different face; the board made three parts of it, and "A Sol" then wrapped
 * inside a box too short to hold it — his own diagnosis, and the right one:
 * "Works" being a different font made it a different box and shortened the
 * one before.
 *
 * So the test is not "do the colours appear". It is: is it ONE box, do the
 * words sit on ONE line, and did the browser choose the breaks rather than
 * the capture. A part that draws each run in its own block would pass a
 * colour check and fail every one of these.
 *
 *   npx next start -p 3013
 *   node tests/runs-draw.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const RED = "rgb(239, 68, 68)";
const GREEN = "rgb(34, 197, 94)";

const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "Docs", path: "/docs", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    /* His price line: one part, three runs, one of them red. */
    node("price", "box", [
      { text: "$118.35", weight: 600 },
      { text: "  " },
      { text: "-0.46%", colour: RED },
    ], 40, 60, 420, 40),
    /* His header: "Works" in another face and colour, mid-sentence. */
    node("header", "box", [
      { text: "A Sol " },
      { text: "Works", face: "Georgia", colour: GREEN },
      { text: " project" },
    ], 40, 140, 420, 40),
    /* A run naming a palette ROLE follows the part it is in. */
    node("roled", "box", [{ text: "plain " }, { text: "accented", colour: "accent" }], 40, 220, 420, 40),
    /* A run that points somewhere is pressable live, words on the board. */
    node("linked", "box", [{ text: "go " }, { text: "there", link: { kind: "page", target: "p1" } }], 40, 300, 420, 40),
    /* And a plain string, which must draw exactly as it always has. */
    node("flat", "box", "A Sol Works project", 40, 380, 420, 40),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SOLCINERATOR", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const read = await page.evaluate(() => {
  const out = {};
  for (const id of ["price", "header", "roled", "linked", "flat"]) {
    const el = document.querySelector(`[data-node-id="${id}"] [data-part]`);
    if (!el) { out[id] = null; continue; }
    /* How many line boxes the words actually occupy, asked of the browser
       rather than counted from the markup: this is the whole question. */
    const r = document.createRange();
    r.selectNodeContents(el);
    const rects = [...r.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    /* Lines, not distinct tops: runs in different faces on one line (Georgia beside a sans) sit at different tops on some machines. A rect belongs to the line whose vertical span holds its middle. */
    const linesOf = (rects) => { const ls = []; for (const b of [...rects].sort((x, y) => x.top - y.top)) { const mid = (b.top + b.bottom) / 2; const l = ls.find((q) => mid >= q.top && mid <= q.bottom); if (l) { l.top = Math.min(l.top, b.top); l.bottom = Math.max(l.bottom, b.bottom); } else ls.push({ top: b.top, bottom: b.bottom }); } return ls.length; };
    const tops = { length: linesOf(rects) };
    out[id] = {
      text: (el.innerText || "").replace(/\s+/g, " ").trim(),
      lines: tops.length,
      inks: [...new Set([...el.querySelectorAll("span")].map((s) => getComputedStyle(s).color))],
      weights: [...new Set([...el.querySelectorAll("span")].map((s) => getComputedStyle(s).fontWeight))],
      faces: [...new Set([...el.querySelectorAll("span")].map((s) => getComputedStyle(s).fontFamily.split(",")[0].replace(/['"]/g, "")))],
      spans: el.querySelectorAll("span").length,
      blocks: [...el.querySelectorAll("*")].filter((c) => getComputedStyle(c).display === "block").length,
      links: el.querySelectorAll("[data-run-link]").length,
    };
  }
  return out;
});

check("all five parts drew", Object.values(read).every(Boolean), Object.entries(read).filter(([, v]) => !v).map(([k]) => k).join(", ") || "all there");

/* ------------------------------------------------------------------ */
/* 1. His price line: one part, one line, the colour inside it         */
/* ------------------------------------------------------------------ */

const price = read.price ?? {};
check("the price line is one part holding the whole sentence", price.text === "$118.35 -0.46%", price.text);
check("…on ONE line, which is the fault it exists to fix", price.lines === 1, `${price.lines} line boxes`);
check("…with the fall in its own colour", (price.inks ?? []).includes(RED), (price.inks ?? []).join(" | "));
check("…and the figure at its own weight", (price.weights ?? []).includes("600"), (price.weights ?? []).join(" | "));
check("…and nothing inside it is a block, so the browser chooses the breaks",
  price.blocks === 0, `${price.blocks} block children`);

/* ------------------------------------------------------------------ */
/* 2. His header: a different face mid-sentence                        */
/* ------------------------------------------------------------------ */

const header = read.header ?? {};
check("the header is one part, not three", header.text === "A Sol Works project", header.text);
check("…on one line, so 'A Sol' has no reason to wrap", header.lines === 1, `${header.lines} line boxes`);
check("…with Works in its own face", (header.faces ?? []).includes("Georgia"), (header.faces ?? []).join(" | "));
check("…and its own colour", (header.inks ?? []).includes(GREEN), (header.inks ?? []).join(" | "));

/* ------------------------------------------------------------------ */
/* 3. A role follows the part; a link is pressable                     */
/* ------------------------------------------------------------------ */

const roled = read.roled ?? {};
check("a run naming a palette role is painted, and not with the literal word",
  (roled.inks ?? []).length > 0 && !(roled.inks ?? []).some((c) => /accent/i.test(c)), (roled.inks ?? []).join(" | "));
check("a run that points somewhere is marked as a link", (read.linked ?? {}).links === 1, `${(read.linked ?? {}).links} links`);

/* ------------------------------------------------------------------ */
/* 4. A plain string is untouched                                      */
/* ------------------------------------------------------------------ */

const flat = read.flat ?? {};
check("a plain string draws the same words", flat.text === "A Sol Works project", flat.text);
check("…with no spans at all, so nothing about it changed", flat.spans === 0, `${flat.spans} spans`);
check("…and on one line, as it always was", flat.lines === 1, `${flat.lines} line boxes`);

/* ------------------------------------------------------------------ */
/* 5. Live, the same, and the link goes                                */
/* ------------------------------------------------------------------ */

await page.goto(`${URL_}/builder/preview/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const live = await page.evaluate(() => {
  const el = document.querySelector('[data-live-node="price"] [data-part]');
  return el ? { text: (el.innerText || "").replace(/\s+/g, " ").trim(), inks: [...new Set([...el.querySelectorAll("span")].map((s) => getComputedStyle(s).color))] } : null;
});
check("the live page draws the sentence the same way", !!live && live.text === "$118.35 -0.46%" && live.inks.includes(RED), JSON.stringify(live));
const at = async () => page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
const was = await at();
const box = await page.locator('[data-live-node="linked"] [data-run-link]').first().boundingBox().catch(() => null);
if (box) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(1100); }
check("and pressing a linked word goes where it points", (await at()) === "p1", `${was} → ${await at()}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
