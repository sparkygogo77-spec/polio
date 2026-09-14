/**
 * The Updates board holds where you left it, and fills the floor.
 *
 * Two things J found on screen, both measured before they were touched.
 *
 *   · The zoom reset every time Finish was pressed. Finish is the only door
 *     into this view and it is a toggle, so every trip to the board and back
 *     mounted the timeline again and refitted it. Measured: 1.85 back to 1
 *     with three updates, 0.77 back to 0.41 with eight.
 *   · The fit read far too small. Three updates covered 26% of a 1272x615
 *     board and eight covered 15% — because the ceiling was a flat 1, and
 *     because the chain ran straight down, so eight updates stood 1214 tall
 *     in a board 615 tall and the width went unused.
 *
 * Driven, not seeded: the view is what a person does with a wheel and a
 * button, so the checks press the button.
 *
 *   node tests/updates-view.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A document with this many finished updates on it. */
const doc = (n) => ({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", nodes: [], shapes: [], groups: [], spaces: [], selection: [],
    threads: Array.from({ length: n }, (_, i) => ({
      id: `t${i}`, at: 1700000000000 + i * 1000, mode: "make", ask: `update ${i + 1}`,
      answer: `did the thing ${i + 1}`, changes: [], state: "done", model: "gpt-image-2", revisions: [],
    })),
  },
  version: 0,
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });

/** Zoom, and how much of the board the chain covers. */
const state = () => page.evaluate(() => {
  const plot = document.querySelector("[data-timeline-plot]");
  const m = plot ? /scale\(([\d.]+)\)/.exec(plot.style.transform) : null;
  const cards = [...document.querySelectorAll("[data-box]")];
  const host = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  if (!cards.length || !host) return { zoom: m ? Number(m[1]) : null, cards: cards.length, fill: 0 };
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const c of cards) { const q = c.getBoundingClientRect(); l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
  return {
    zoom: m ? Number(m[1]) : null, cards: cards.length,
    fill: Math.round(((r - l) * (b - t)) / (host.width * host.height) * 100),
    across: Math.round(r - l), down: Math.round(b - t),
    host: `${Math.round(host.width)}x${Math.round(host.height)}`,
  };
});

for (const n of [3, 8]) {
  await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc(n));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const finish = page.locator('[aria-label^="Finish"]').first();
  await finish.click({ force: true });
  await page.waitForTimeout(1400);

  const open = await state();
  check(`${n} updates are all on the board`, open.cards === n, `${open.cards} of ${n}`);
  /* Half the floor is the bar: below it the chain reads as adrift, which is
     what 26% and 15% looked like. */
  check(`and they fill the board rather than sitting in the middle of it`, open.fill >= 45,
    `${open.fill}% of ${open.host}, ${open.across}x${open.down}`);
  /* A board is landscape; a chain that runs off the bottom cannot fill one. */
  check(`and the chain runs across rather than down`, open.across > open.down,
    `${open.across} across, ${open.down} down`);

  /* Now the person takes hold of it. A plain wheel pans; ctrl+wheel zooms. */
  await page.mouse.move(750, 500);
  await page.keyboard.down("Control");
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(70); }
  await page.keyboard.up("Control");
  await page.waitForTimeout(700);
  const mine = await state();
  check(`${n}: zooming in moves it`, mine.zoom > open.zoom + 0.05, `${open.zoom?.toFixed(2)} → ${mine.zoom?.toFixed(2)}`);

  await finish.click({ force: true });            // out to the board
  await page.waitForTimeout(700);
  await finish.click({ force: true });            // and back in
  await page.waitForTimeout(1400);
  const back = await state();
  check(`${n}: and Finish leaves it where it was`, Math.abs(back.zoom - mine.zoom) < 0.01,
    `${mine.zoom?.toFixed(3)} → ${back.zoom?.toFixed(3)}`);

  /* Centre is how a person asks for the fit back. */
  await page.locator("[data-timeline-centre]").click({ force: true });
  await page.waitForTimeout(900);
  const fitted = await state();
  check(`${n}: centre hands it back to the fit`, Math.abs(fitted.zoom - open.zoom) < 0.02,
    `${back.zoom?.toFixed(3)} → ${fitted.zoom?.toFixed(3)}, fit was ${open.zoom?.toFixed(3)}`);
}

/* A card opens beside its box, so a box near an edge puts its card over the
   edge — and the further in the board is zoomed, the further out it lands.
   Raising the ceiling is what made this visible, so it is checked here. */
{
  const boxes = page.locator("[data-box]");
  const n = await boxes.count();
  let worst = null;
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).click({ force: true });
    await page.waitForTimeout(600);
    const out = await page.evaluate(() => {
      const card = document.querySelector("[data-card][data-card-of]");
      const host = document.querySelector("[data-timeline]");
      if (!card || !host) return null;
      const c = card.getBoundingClientRect(), v = host.getBoundingClientRect();
      return Math.round(Math.max(0, v.left - c.left, c.right - v.right, v.top - c.top, c.bottom - v.bottom));
    });
    if (out !== null && (worst === null || out > worst)) worst = out;
  }
  check("a card opened on any box comes fully into view", worst === 0,
    worst === null ? "no card opened" : `worst was ${worst}px outside the board`);
}

/* J's word. "Iterations" is not what he calls them. */
const words = await page.locator("[data-timeline]").innerText().catch(() => "");
check("the board calls them updates", /update/i.test(words) && !/iteration/i.test(words),
  /iteration/i.test(words) ? "it still says iterations" : "updates");

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
