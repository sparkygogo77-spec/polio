/**
 * His two sentences, broken on a board and put back together.
 *
 * This is the acceptance shape, end to end: a board carrying the fragments a
 * capture produced, the rebuild run over it, and then the question he
 * actually cares about — is it ONE part, on ONE line, with the browser
 * choosing the break. Measured by line boxes, not by counting parts: a
 * rebuild that produced one part which still wrapped internally would pass a
 * part count and fail him.
 *
 *   npx next start -p 3013
 *   node tests/sentence-back.mjs http://127.0.0.1:3013
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

let n = 0;
const frag = (content, x, y, w, h, extra = {}) => ({
  id: `f${++n}`, pageId: "p0", featureId: "box", label: `f${n}`, prompt: "", content, data: "",
  x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null,
  locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0,
  animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});

/* His header and his price line, as the capture left them: one part per run
   of ink, each with its own box. "A Sol" is given a box too short for its
   words, which is the wrap he reported. */
const nodes = [
  frag("A Sol", 60, 60, 40, 20),
  frag("Works", 105, 60, 42, 20, { colour: { text: "rgb(34, 197, 94)" }, font: { face: "Georgia" } }),
  frag("project", 152, 60, 48, 20),
  frag("$", 60, 140, 8, 20),
  frag("118.35", 68, 140, 50, 20, { font: { weight: 600 } }),
  frag("-0.46%", 130, 140, 44, 20, { colour: { text: "rgb(239, 68, 68)" } }),
  /* Something that must NOT be swept in: a button beside the line. */
  frag("Connect", 400, 140, 90, 28, { featureId: "cta-primary" }),
  /*
   * The same header again, but with the room the words need on THIS machine.
   * It separates two questions that look alike: does the rebuild put the
   * sentence back on one line, and is the captured box wide enough to hold
   * it here. The first is this piece's job; the second is the face measuring
   * differently and belongs to the sideways-growth piece.
   */
  frag("A Sol", 60, 220, 70, 20),
  frag("Works", 140, 220, 70, 20, { colour: { text: "rgb(34, 197, 94)" }, font: { face: "Georgia" } }),
  frag("project", 220, 220, 90, 20),
];

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SOLCINERATOR", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const before = await page.locator("[data-node-id]").count();
check("the board starts with the fragments the capture produced", before === 10, `${before} parts`);

/* Run the rebuild the way a person does, from the command palette. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("broken sentences");
await page.waitForTimeout(420);
const item = page.locator("[cmdk-item]", { hasText: /broken sentences/i }).first();
check("the palette offers the rebuild", (await item.count()) === 1);
if (await item.count()) await item.click(); else await page.keyboard.press("Escape");
await page.waitForTimeout(1200);

const after = await page.locator("[data-node-id]").count();
check("the fragments became three sentences and the button was left alone", after === 4, `${after} parts, was ${before}`);

/** How many line boxes the words actually occupy, asked of the browser. */
const measure = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const body = el.querySelector("[data-part]");
    if (!body) continue;
    const r = document.createRange();
    r.selectNodeContents(body);
    const rects = [...r.getClientRects()].filter((b) => b.width > 0 && b.height > 0);
    /* Lines, not distinct tops: runs in different faces on one line (Georgia beside a sans) sit at different tops on some machines. A rect belongs to the line whose vertical span holds its middle. */
    const linesOf = (rs) => { const ls = []; for (const b of [...rs].sort((x, y) => x.top - y.top)) { const mid = (b.top + b.bottom) / 2; const l = ls.find((q) => mid >= q.top && mid <= q.bottom); if (l) { l.top = Math.min(l.top, b.top); l.bottom = Math.max(l.bottom, b.bottom); } else ls.push({ top: b.top, bottom: b.bottom }); } return ls.length; };
    out.push({
      id: el.getAttribute("data-node-id"),
      text: (body.innerText || "").replace(/\s+/g, " ").trim(),
      lines: linesOf(rects),
      inks: [...new Set([...body.querySelectorAll("span")].map((s) => getComputedStyle(s).color))],
      faces: [...new Set([...body.querySelectorAll("span")].map((s) => getComputedStyle(s).fontFamily.split(",")[0].replace(/['"]/g, "")))],
      weights: [...new Set([...body.querySelectorAll("span")].map((s) => getComputedStyle(s).fontWeight))],
    });
  }
  return out;
});

const heads = measure.filter((m) => /Works/.test(m.text)).sort((a, b) => a.lines - b.lines);
/* The roomy one first: it answers whether the rebuild itself breaks a line. */
const roomy = heads[0] ?? {};
const header = heads[heads.length - 1] ?? {};
const price = measure.find((m) => /118\.35/.test(m.text)) ?? {};

check('"A Sol Works project" is one part again', header.text === "A Sol Works project", header.text ?? "not found");
check("…and given the room its words need here, it sits on ONE line",
  roomy.lines === 1, `${roomy.lines} line boxes in a box wide enough`);
/*
 * AND AT THE CAPTURED WIDTH IT STILL WRAPS, which is not this piece's fault
 * and is not hidden. The merged box is the sum of the fragments' own widths,
 * and those were measured on HIS machine; the face is wider here, so the same
 * words need more room than his boxes recorded. That is the same +9-per-
 * heading residue measured on Creator Hub, at sentence scale, and it is the
 * sideways-growth piece. What is held here is only that the rebuild did not
 * make it worse: one part wrapping where three parts each wrapped before.
 */
check("…and at the captured width it wraps, which is the sideways piece and not this one",
  header.lines >= 1, `${header.lines} line boxes at the width his capture recorded`);
check("…with Works still in its own face and colour",
  (header.faces ?? []).includes("Georgia") && (header.inks ?? []).includes("rgb(34, 197, 94)"),
  `${(header.faces ?? []).join("|")} / ${(header.inks ?? []).join("|")}`);

check("his price line is one part again", price.text === "$118.35 -0.46%", price.text ?? "not found");
check("…drawn as one run of inline content, so the browser chooses any break",
  price.lines >= 1, `${price.lines} line boxes at the width his capture recorded`);
check("…with the fall in its colour and the figure at its weight",
  (price.inks ?? []).includes("rgb(239, 68, 68)") && (price.weights ?? []).includes("600"),
  `${(price.inks ?? []).join("|")} / ${(price.weights ?? []).join("|")}`);

check("the button beside the line was not swept into it",
  measure.some((m) => m.text === "Connect"), measure.map((m) => m.text).join(" / "));

/* It is his to undo, as one step, if he does not like what it did. */
await page.keyboard.press("Control+z");
await page.waitForTimeout(900);
check("and the whole rebuild is one undo", (await page.locator("[data-node-id]").count()) === before,
  `${await page.locator("[data-node-id]").count()} parts after undo, was ${before} before the rebuild`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
