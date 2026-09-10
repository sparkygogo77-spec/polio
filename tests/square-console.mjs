/**
 * A square menu is square all the way in.
 *
 * The console's controls used to be drawn as arcs whatever shape the wheel
 * was, so a square menu was a round one in a square frame: bent sliders with
 * the corners of every box left empty, and two colour spectrums sharing half
 * a quadrant each when the box had room for both at full width. These check
 * the parts of that which can be checked without eyes.
 *
 *   node tests/square-console.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });

/** Open a part's wheel in the given shape and walk into the colour editor. */
async function openSpectrum(shape) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const toggle = page.locator("[data-menu-shape]").first();
  if ((await toggle.getAttribute("data-menu-shape")) !== shape) {
    await toggle.click();
    await page.waitForTimeout(350);
  }
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(350);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(650);
  const nb = await page.locator("[data-node-id]").first().boundingBox();
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
  await page.waitForTimeout(600);
  for (const word of [/^Looks$/, /^Hue$/]) {
    const el = page.locator("[data-radial]").getByText(word).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(700); }
  }
  return page;
}

/** The outline drawn round a slider's run: the one path on it that is not filled. */
const outlineOf = (page, label) => page.locator(`[data-arc-slider="${label}"] path[fill="none"]`).first();

/** Drag a slider from wherever it is to a point along its own bounding box. */
async function dragTo(page, label, fx, fy) {
  const b = await page.locator(`[data-arc-slider="${label}"]`).first().boundingBox();
  return press(page, label, b.x + b.width * fx, b.y + b.height * fy);
}

/**
 * Drag to the middle of one of the slider's own steps.
 *
 * An arc's bounding box is mostly the empty corner it does not pass through,
 * so a fraction of it lands off the control and the press does nothing at
 * all — which reads as a pass if you only check that the value stayed put.
 * A step is a piece of the run, so its middle is on the run.
 */
async function dragToStep(page, label, i) {
  const step = page.locator(`[data-arc-slider="${label}"] path:not([fill="none"])`).nth(i);
  const b = await step.boundingBox();
  return press(page, label, b.x + b.width / 2, b.y + b.height / 2);
}

async function press(page, label, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  return Number(await page.locator(`[data-arc-slider="${label}"]`).first().getAttribute("aria-valuenow"));
}

/* ------------------------------------------------------------------ */
/* Square mode: what a panel looks like                                */
/* ------------------------------------------------------------------ */
{
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const toggle = page.locator("[data-menu-shape]").first();
  if ((await toggle.getAttribute("data-menu-shape")) !== "square") { await toggle.click(); await page.waitForTimeout(350); }
  /*
   * A part's wheel, not the page's: the page has no six roles to show, no
   * texture tile and nothing of its own to wear on the Looks button. Square
   * mode, because that is the layout these were laid out for — the panels are
   * boxes and the questions are about where things sit in a box.
   */
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(250);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(350);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(650);
  const nb = await page.locator("[data-node-id]").first().boundingBox();
  await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
  await page.waitForTimeout(650);

  // Looks wears the part's own look, which is the point of it.
  const worn = page.locator("[data-worn='look']").first();
  check("the Looks piece is wearing something", (await worn.count()) === 1);
  if (await worn.count()) {
    const paint = await worn.evaluate((el) => {
      const st = getComputedStyle(el);
      return { bg: st.backgroundColor, img: st.backgroundImage };
    });
    check("and what it wears is the part's own surface or texture",
      (paint.bg !== "rgba(0, 0, 0, 0)" && paint.bg !== "transparent") || paint.img !== "none",
      `${paint.bg} / ${paint.img.slice(0, 40)}`);
  }
  const looks = page.locator("[data-radial]").getByText(/^Looks$/).first();
  if (await looks.count()) { await looks.click({ force: true }); await page.waitForTimeout(700); }

  // A tile with no texture set says "texture, none" rather than showing a
  // swatch of the surface colour, which is a swatch of nothing.
  const tex = page.locator("[data-worn='texture']").first();
  if (await tex.count()) {
    const img = await tex.evaluate((el) => getComputedStyle(el).backgroundImage);
    check("a tile with no texture wears a pattern, not a blank", img !== "none", img.slice(0, 60));
  } else check("a tile with no texture wears a pattern, not a blank", false, "no texture tile on the wheel");
  const aura = page.locator("[data-aura-swatch]").first();
  check("the aura tile shows the aura the part is wearing", (await aura.count()) === 1);
  const colour = page.locator("[data-radial]").getByText(/^Hue$/).first();
  if (await colour.count()) { await colour.click({ force: true }); await page.waitForTimeout(700); }

  /*
   * Every panel wears its label in the same corner of itself.
   *
   * Which is not one place in the wheel's coordinates — the boxes mirror — so
   * it is measured against each panel's own box: above its middle and left of
   * it. They used to sit in three different corners, one per panel, with no
   * rule you could name.
   */
  /*
   * Each caption and each chip belongs to whichever panel's box contains it —
   * they are all siblings in one group, so asking a slab for "its" caption
   * hands you the first caption on the wheel three times over. Ask the
   * geometry instead.
   */
  const panels = await page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const boxes = [...document.querySelectorAll("[data-console-slab]")].map(rect);
    const home = (el) => {
      const r = rect(el);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return boxes.findIndex((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
    };
    const out = boxes.map((b) => ({ b, caption: null, chips: [] }));
    for (const cap of document.querySelectorAll("[data-arc-caption] text")) {
      const i = home(cap);
      if (i >= 0) out[i].caption = rect(cap);
    }
    for (const chip of document.querySelectorAll("[data-arc-chip]")) {
      const i = home(chip);
      if (i >= 0) out[i].chips.push(rect(chip));
    }
    return out;
  });

  // Where a label *starts*, not where its middle lands: it is set from its left
  // end, so a long word in a narrow panel has its middle past the halfway mark
  // while still plainly being the top-left label.
  const corners = panels.filter((p) => p.caption).map((p) => ({
    up: p.caption.y + p.caption.h / 2 < p.b.y + p.b.h / 2,
    left: p.caption.x < p.b.x + p.b.w / 2,
  }));
  check("square: every panel's label is in the same corner of it",
    corners.length >= 2 && corners.every((c) => c.up && c.left), JSON.stringify(corners));

  // And the chips sit in the middle of the panel rather than down one end.
  const centred = panels.filter((p) => p.chips.length >= 3).map((p) => {
    const mid = p.chips.reduce((a, c) => a + c.y + c.h / 2, 0) / p.chips.length;
    return Math.round(mid - (p.b.y + p.b.h / 2));
  });
  check("square: the chips sit in the middle of their panel", centred.length > 0 && centred.every((d) => Math.abs(d) < 26),
    `${centred.join(", ")}px off centre`);

  // The mark on a picked chip is a mark, not a halo.
  const picked = page.locator("[data-arc-chip][aria-pressed='true']").first();
  if (await picked.count()) {
    const grown = await picked.evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return Math.max(m.a, m.d);
    });
    check("square: a picked chip is marked, not haloed", grown <= 1.12, `${grown.toFixed(2)}× its size`);
  }

  /*
   * The six roles are six colours.
   *
   * They were one hue at six lightnesses with almost no colour in five of
   * them — a row of chips you pick between, in which two of the six were four
   * hundredths of a lightness apart. Measured as the closest pair in the row.
   */
  const spread = await page.evaluate(() => {
    // Only the row that *is* the six roles. The row beside it says what to set
    // one to, and two chips there being the same colour is the two of them
    // meaning the same colour, which is not the thing being measured.
    const rect = (el) => el.getBoundingClientRect();
    let box = null;
    for (const cap of document.querySelectorAll("[data-arc-caption] text")) {
      if (!/painting/i.test(cap.textContent ?? "")) continue;
      // By its middle: a line of text has ascender space above it, so its top
      // edge can sit a pixel outside the panel it plainly belongs to.
      const c = rect(cap);
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      for (const slab of document.querySelectorAll("[data-console-slab]")) {
        const b = rect(slab);
        if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) box = b;
      }
    }
    if (!box) return { n: 0, closest: 0 };
    /*
     * The browser hands these back as `oklch(...)`, not as rgb — it is what
     * they were written in and there is nothing to convert them to on the way
     * out. Distance measured in oklch's own units is meaningless (a hue is
     * degrees, a chroma is hundredths), so they are taken the rest of the way
     * to sRGB here and compared where a difference means what it looks like.
     */
    const toRgb = (str) => {
      const n = (str.match(/[-\d.]+/g) ?? []).map(Number);
      if (/oklch/i.test(str) && n.length >= 3) {
        const [L, C, h] = n;
        const a = C * Math.cos((h * Math.PI) / 180);
        const b2 = C * Math.sin((h * Math.PI) / 180);
        const l = (L + 0.3963377774 * a + 0.2158037573 * b2) ** 3;
        const m = (L - 0.1055613458 * a - 0.0638541728 * b2) ** 3;
        const s2 = (L - 0.0894841775 * a - 1.291485548 * b2) ** 3;
        const lin = [
          4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2,
        ];
        return lin.map((v) => {
          const c = Math.max(0, Math.min(1, v));
          return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
        });
      }
      return n.slice(0, 3);
    };
    const rgb = [...document.querySelectorAll("[data-arc-chip]")]
      .filter((el) => {
        const r = rect(el);
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
      })
      .map((el) => toRgb(getComputedStyle(el).backgroundColor))
      .filter((v) => v.length === 3);
    let closest = Infinity;
    for (let i = 0; i < rgb.length; i++) {
      for (let j = i + 1; j < rgb.length; j++) {
        const d = Math.hypot(rgb[i][0] - rgb[j][0], rgb[i][1] - rgb[j][1], rgb[i][2] - rgb[j][2]);
        if (d < closest) closest = d;
      }
    }
    return { n: rgb.length, closest: Math.round(closest) };
  });
  // Thirty-two, because the palette this replaced measured twenty: a threshold
  // under that would have passed on the thing being fixed. It measures 47 now.
  check("the six roles are six colours you can tell apart", spread.n >= 6 && spread.closest >= 32,
    `${spread.n} chips, closest pair ${spread.closest} apart`);

  await page.close();
}

/* ------------------------------------------------------------------ */
/* Square                                                              */
/* ------------------------------------------------------------------ */
const sq = await openSpectrum("square");
const sqLabels = ["Hue", "Lightness", "Strength"];
check("square: the whole colour is on one slab", (await sq.locator("[data-arc-slider]").count()) >= 3);

// 1. Nothing on a square slab is bent. An SVG arc command is an arc.
const bent = [];
for (const l of sqLabels) {
  const d = (await outlineOf(sq, l).getAttribute("d")) ?? "";
  if (/[Aa]\s/.test(d)) bent.push(l);
}
check("square: no slider is drawn as an arc", bent.length === 0, bent.join(", "));

// 2. The three bands are stacked and each one runs the full width of the box.
const boxes = [];
for (const l of sqLabels) boxes.push(await sq.locator(`[data-arc-slider="${l}"]`).first().boundingBox());
const widths = boxes.map((b) => b.width);
const lefts = boxes.map((b) => b.x);
const sameWidth = Math.max(...widths) - Math.min(...widths) < 3;
const sameLeft = Math.max(...lefts) - Math.min(...lefts) < 3;
check("square: the three bands are the same width", sameWidth, widths.map((w) => Math.round(w)).join(" / "));
check("square: the three bands share a left edge", sameLeft, lefts.map((x) => Math.round(x)).join(" / "));
const tops = boxes.map((b) => b.y).sort((a, b) => a - b);
check("square: the three bands are stacked, not side by side", tops[2] - tops[0] > 30, tops.map(Math.round).join(" / "));

// 3. A band is wider than it is tall — it is a bar, not a block.
check("square: a band is a bar", boxes.every((b) => b.width > b.height * 2), boxes.map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`).join(" "));

// 4. The hand sets the value from where it is along the bar.
const low = await dragTo(sq, "Hue", 0.2, 0.5);
const high = await dragTo(sq, "Hue", 0.8, 0.5);
check("square: dragging along the bar follows the hand", low < high - 25, `${low} then ${high}`);
check("square: the hand lands where it is pointing", Math.abs(low - 20) < 14 && Math.abs(high - 80) < 14, `${low} / ${high}`);

// 5. Chips sit in straight rows: at least one row holds several of them at one height.
const chips = await sq.locator("[data-arc-chip]").all();
const ys = [];
for (const c of chips) { const b = await c.boundingBox(); if (b) ys.push(Math.round(b.y + b.height / 2)); }
const rows = new Map();
for (const y of ys) {
  const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
  rows.set(key, (rows.get(key) ?? 0) + 1);
}
const widestRow = Math.max(0, ...rows.values());
check("square: chips line up in rows", widestRow >= 3, `${chips.length} chips, widest row ${widestRow}`);

// 6. And in columns: a row that ran out of chips sits under the one above it.
const cells = [];
for (const c of chips) { const b = await c.boundingBox(); if (b) cells.push({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }); }
const byRow = new Map();
for (const cell of cells) {
  const key = [...byRow.keys()].find((k) => Math.abs(k - cell.y) <= 2) ?? cell.y;
  byRow.set(key, [...(byRow.get(key) ?? []), cell.x]);
}
const pair = [...byRow.values()].sort((a, b) => b.length - a.length).slice(0, 2);
const shared = pair.length < 2 ? 0 : pair[1].filter((x) => pair[0].some((o) => Math.abs(o - x) <= 2)).length;
check("square: a short row sits under the one above it", pair.length < 2 || shared === Math.min(pair[0].length, pair[1].length),
  `${shared} of ${pair.length < 2 ? 0 : Math.min(pair[0].length, pair[1].length)} columns shared`);

// 7. A square wheel's chips have square corners.
const sqRound = await chips[0].evaluate((el) => {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return { r, w: el.getBoundingClientRect().width };
});
check("square: chips are boxes, not circles", sqRound.r < sqRound.w / 3, `${sqRound.r}px on ${sqRound.w}px`);
await sq.close();

/* ------------------------------------------------------------------ */
/* Round                                                               */
/* ------------------------------------------------------------------ */
const rd = await openSpectrum("round");
const arced = [];
for (const l of sqLabels) {
  const d = (await outlineOf(rd, l).getAttribute("d")) ?? "";
  if (/[Aa]\s/.test(d)) arced.push(l);
}
check("round: the sliders are still arcs", arced.length === 3, arced.join(", "));
const rLow = await dragToStep(rd, "Hue", 3);
const rHigh = await dragToStep(rd, "Hue", 18);
check("round: dragging round the arc still follows the hand", rLow < rHigh - 25, `${rLow} then ${rHigh}`);
check("round: the hand lands on the step it pressed", Math.abs(rLow - 16) < 12 && Math.abs(rHigh - 84) < 12, `${rLow} / ${rHigh}`);

// A round wheel's chips are circles.
const rChip = rd.locator("[data-arc-chip]").first();
const shapeOf = await rChip.evaluate((el) => {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return { r, w: el.getBoundingClientRect().width };
});
check("round: chips are circles", shapeOf.r >= shapeOf.w / 2 - 0.5, `${shapeOf.r}px on ${shapeOf.w}px`);

/*
 * The ends of a run are parallel to the slab's own seam, not cut along a
 * radius.
 *
 * A radial cut is a line through the middle of the wheel, so the distance from
 * the middle to it is zero; a cut that keeps the same number of pixels of
 * clearance all the way along is a line beside that one, and the distance from
 * the middle to it is exactly that clearance. The path is drawn in the wheel's
 * own coordinates with the middle at the origin, so the two ends of the first
 * command are all it takes to tell which of the two it is.
 */
/** Every point a path command lands on, in order: its last two numbers. */
const pointsOf = (d) => d.split(/(?=[MLA])/).map((cmd) => {
  const n = cmd.match(/-?[\d.]+/g)?.map(Number) ?? [];
  return n.length >= 2 ? [n[n.length - 2], n[n.length - 1]] : null;
}).filter(Boolean);

/** How far the middle of the wheel is from the line through two points. */
const offOf = ([x0, y0], [x1, y1]) => Math.abs(x0 * y1 - x1 * y0) / Math.hypot(x1 - x0, y1 - y0);

// The run's two ends against the slab's edge: 11.5px of clearance where the run
// ends on the slab, 5px where two runs meet halfway along a band.
const want = { Hue: [11.5, 11.5], Lightness: [11.5, 5], Strength: [5, 11.5] };
for (const label of sqLabels) {
  const d = (await outlineOf(rd, label).getAttribute("d")) ?? "";
  const p = pointsOf(d);
  if (p.length < 5) { check(`round: ${label}'s ends are readable`, false, `${p.length} points`); continue; }
  const got = [offOf(p[0], p[1]), offOf(p[3], p[4])];
  const [a, b] = want[label];
  check(`round: ${label} ends beside the slab's seam, not along a radius`,
    Math.abs(got[0] - a) < 2 && Math.abs(got[1] - b) < 2,
    `${got[0].toFixed(1)} / ${got[1].toFixed(1)}px from the middle, wanted ${a} / ${b}`);
}
await rd.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
