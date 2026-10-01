/**
 * A person on a phone can get back to a usable size without knowing a trick.
 *
 * WHAT WAS THERE, measured at 375×812 and 400×800 on the deploy before any
 * of this. The Builder opens with a 1440 frame drawn 247 across — about a
 * sixth of its width — and the way out was not there:
 *
 *   · The bar wanted 542 in a 375 window and hung 167 off the right. What
 *     was past the edge was not the least important thing in it: the zoom
 *     cluster's PLUS key, More tools, Preview and Finish. The bar scrolls
 *     sideways, but nothing says so, and a control you have to discover by
 *     dragging a toolbar is not reachable on a phone.
 *   · So at 375 the minus was on screen and the plus was not — a zoom
 *     control that could only make things smaller.
 *   · And pressing it made the page BIGGER. The fit had been given its own
 *     floor (`FIT_MIN`, 0.05) so it could put a desktop frame inside a phone
 *     pane, but the keys still clamped to `ZOOM_MIN` at 0.25, so the first
 *     press of either key jumped from the fit's 0.142 up to 0.25 — the page
 *     247 → 436, off the right edge of a 375 pane, with no visible way back.
 *     That gap was mine, introduced with `FIT_MIN`.
 *
 * The three rules this holds, which are the ones J set:
 *   1. at 375 and 400 a person can reach a readable view and come back,
 *      using only what is on screen;
 *   2. nothing they can reach leaves them stuck with no way back;
 *   3. and none of it changes what desktop does.
 *
 * Rule 3 lives in `tests/scroll-contract.mjs`, which owns the fit and the
 * shelf at every width and is not duplicated here.
 *
 *   node tests/phone-way-out.mjs [url]
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

/* Wholly on screen, not merely in the document: a control hanging off the
   right of a bar that scrolls sideways is not reachable by anyone who does
   not already know it is there. */
const WHOLE = (sel) => {
  const e = document.querySelector(sel);
  if (!e) return { there: false, why: "absent" };
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  if (!r.width || !r.height || cs.visibility === "hidden") return { there: false, why: "not drawn" };
  if (r.left < -1 || r.right > innerWidth + 1) return { there: false, why: `${r.right > innerWidth ? Math.round(r.right - innerWidth) : Math.round(-r.left)}px off the side` };
  if (r.top < -1 || r.bottom > innerHeight + 1) return { there: false, why: "below the fold" };
  return { there: true, why: "" };
};

const browser = await chromium.launch({ headless: true });

for (const [w, h] of [[400, 800], [375, 812]]) {
  const tag = `${w}×${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const size = () => page.evaluate(() => {
    /* The desktop's page window, or the phone's own page (`SmallBoard.tsx`) when Phone is on. */
    const win = document.querySelector("[data-page-window]") ?? document.querySelector("[data-small-frame]");
    const pane = document.querySelector("[data-studio-pane]");
    const chip = [...document.querySelectorAll("button")].find((x) => /^\d+%$/.test((x.textContent ?? "").trim()));
    return { page: win ? Math.round(win.getBoundingClientRect().width) : 0, pane: Math.round(pane.clientWidth),
      pct: chip ? chip.textContent.trim() : "?", phone: !!document.querySelector('[data-small-frame="phone"]') };
  });

  /* 0. The bar is at most two rows, and gives the drawing the rest.
     It wrapped to THREE at 375 — 109px, with Finish alone on the last one —
     because a control set of about 583 was being wrapped badly, not because
     it was full. Counted by distinct top edges, not by y of every child:
     items on one line are centred and so have different tops. */
  const shape = await page.evaluate(() => {
    const bar = document.querySelector("[data-studio-bar]");
    const tops = [...bar.querySelectorAll("button, [role='button'], a[href]")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => Math.round(r.top));
    /* Tops within 12px of each other are the same line. */
    const lines = [];
    for (const t of tops.sort((a, b) => a - b)) if (!lines.some((l) => Math.abs(l - t) <= 12)) lines.push(t);
    const smallest = Math.min(...[...bar.querySelectorAll("button")].map((e) => {
      const r = e.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height));
    }).filter((n) => n > 0));
    return { lines: lines.length, h: Math.round(bar.getBoundingClientRect().height), smallest };
  });
  check(`${tag}: the bar is at most two rows`, shape.lines <= 2, `${shape.lines} rows, ${shape.h}px tall`);
  check(`${tag}: and every key in it is a real target`, shape.smallest >= 32,
    `the smallest is ${shape.smallest}px on its short side`);

  /* 1. The bar holds what it has. */
  const bar = await page.evaluate(() => {
    const el = document.querySelector("[data-studio-bar]");
    return el ? { over: el.scrollWidth - el.clientWidth, client: el.clientWidth, scroll: el.scrollWidth } : null;
  });
  check(`${tag}: nothing in the bar is off the edge`, bar !== null && bar.over <= 1,
    bar ? `it wants ${bar.scroll} in ${bar.client}${bar.over > 1 ? `, hanging ${bar.over} off the right` : ""}` : "no [data-studio-bar]");

  /* 2. Every control on the way out is wholly on screen. */
  const WAYS = {
    "zoom out": '[aria-label="Zoom out"]', "zoom in": '[aria-label="Zoom in"]',
    "the readout, which is fit": '[data-studio-bar] [data-fit-readout]',
    Desktop: '[aria-label*="Desktop" i]', Tablet: '[aria-label*="Tablet" i]', Phone: '[aria-label*="Phone" i]',
  };
  const missing = [];
  for (const [name, sel] of Object.entries(WAYS)) {
    const m = await page.evaluate(WHOLE, sel);
    if (!m.there) missing.push(`${name} ${m.why}`);
  }
  check(`${tag}: every way back is wholly on screen`, missing.length === 0, missing.join(", ") || Object.keys(WAYS).join(", "));

  /* 3. Asking for smaller never gives bigger, and never goes off the edge. */
  const fresh = await size();
  const noOut = await (async () => {
    const m = await page.evaluate(WHOLE, '[aria-label="Zoom out"]');
    if (!m.there) return m.why;
    for (let i = 0; i < 12; i++) { await page.locator('[aria-label="Zoom out"]').first().click(); await page.waitForTimeout(70); }
    return null;
  })();
  const small = await size();
  check(`${tag}: twelve presses of zoom out never make the page bigger`,
    !noOut && small.page <= fresh.page && small.page <= small.pane,
    noOut ? `the zoom-out key is ${noOut}` : `${fresh.page} → ${small.page} in a ${small.pane} pane (${fresh.pct} → ${small.pct})`);

  /* 4. The round trip: bigger to read, and back again, with one press.
     Every press is guarded: a control that is not on screen is the fault
     being measured, not a reason for the run to throw. */
  const press = async (sel, times = 1, wait = 100) => {
    const m = await page.evaluate(WHOLE, sel);
    if (!m.there) return m.why;
    for (let i = 0; i < times; i++) { await page.locator(sel).first().click(); await page.waitForTimeout(wait); }
    return null;
  };
  const noIn = await press('[aria-label="Zoom in"]', 8);
  const big = await size();
  check(`${tag}: zoom in reaches a bigger view than the one it opens at`,
    !noIn && big.page > fresh.page * 1.5,
    noIn ? `the zoom-in key is ${noIn}` : `${fresh.page} (${fresh.pct}) → ${big.page} (${big.pct})`);
  const noFit = await press('[data-studio-bar] [data-fit-readout]', 1, 800);
  const back = await size();
  check(`${tag}: and one press of the readout puts it back inside the pane`,
    !noFit && back.page <= back.pane && Math.abs(back.page - fresh.page) <= 2,
    noFit ? `the readout is ${noFit}` : `${big.page} → ${back.page} in a ${back.pane} pane (${back.pct})`);

  /* 5. The phone frame is the readable view, and Desktop returns from it. */
  const noPh = await press('[aria-label*="Phone" i]', 1, 900);
  const ph = await size();
  /* Phone shows the page as a phone is served it (docs/RESPONSIVE.md), readable, inside the pane. */
  check(`${tag}: pressing Phone shows the phone's own page, inside the pane`,
    !noPh && ph.phone && ph.page > 0 && ph.page <= ph.pane,
    noPh ? `the Phone key is ${noPh}` : `phone page ${ph.page} wide in a ${ph.pane} pane`);
  const noDe = await press('[aria-label*="Desktop" i]', 1, 900);
  const de = await size();
  check(`${tag}: and Desktop comes back, still inside the pane`,
    !noDe && de.page <= de.pane,
    noDe ? `the Desktop key is ${noDe}` : `${ph.page} → ${de.page} in a ${de.pane} pane (${de.pct})`);

  await page.close();
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
