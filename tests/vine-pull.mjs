/**
 * A hand on a vine pulls it; a press takes it apart from the middle.
 *
 * HIS WORDS: "the line in the middle of the vines is hoverable ... i would
 * rather no line, the vine maybe pulls a little when you hover ... when
 * click vanishes and fades away and disintegrates from the middle."
 *
 * Three things, and none of them can be read off a resting frame, so this
 * exercises all three: the pointer goes onto a vine's seam and the vine is
 * photographed before and during; the press happens and the canvas is
 * sampled through the cut.
 *
 * What is measured is the canvas itself — how much of it the vine is
 * painting on, and where — because that is the thing he is looking at. A
 * pull is the painted run getting straighter; a cut is the middle of that
 * run emptying while the ends are still there, and then all of it going.
 *
 *     npx next start -p 3013
 *     node tests/vine-pull.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
import { strandMiddle, strandPath } from "../src/features/studio/strand.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The shape, with no browser in it: a pull is a vine going straighter  */
/* ------------------------------------------------------------------ */

const A = { x: 0, y: 0 };
const B = { x: 400, y: 120 };
const bowOf = (tug) => {
  const [p0, , , p3] = strandPath(A, B, tug);
  const mid = tug ? (() => {
    /* The curve's own middle at this tug, against the straight line. */
    const p = strandPath(A, B, tug);
    const at = (t) => {
      const u = 1 - t;
      return {
        x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
        y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
      };
    };
    return at(0.5);
  })() : strandMiddle(A, B);
  const cx = (p0.x + p3.x) / 2, cy = (p0.y + p3.y) / 2;
  return Math.hypot(mid.x - cx, mid.y - cy);
};
const slack = bowOf(0);
const taut = bowOf(1);
check("a vine at rest bows", slack > 8, `${slack.toFixed(1)}px off the straight line`);
check("and pulled, it comes straighter", taut < slack, `${slack.toFixed(1)}px → ${taut.toFixed(1)}px`);
check("a little, not to a wire", taut > slack * 0.55, `${Math.round((1 - taut / slack) * 100)}% of the bow taken out`);

/* ------------------------------------------------------------------ */
/* And in the browser, with a hand on it                                */
/* ------------------------------------------------------------------ */

const thread = (i) => ({
  id: `t${i}`, parentId: i ? `t${i - 1}` : null, at: 1_700_000_000_000 + i * 1000,
  mode: i ? "critique" : "start", ask: `ask ${i}`, answer: `answer ${i}`, changes: [`changed ${i}`],
  state: "done", form: { p: 1, gen: 1 },
});
const THREADS = [thread(0), thread(1)];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [], groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
  threads: THREADS, threadSpots: { "box:t0": { x: 200, y: 200 }, "box:t1": { x: 700, y: 380 } },
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
await page.locator("[data-finish]").first().click();
/* Past the arrival, so what is photographed is a vine at rest. */
await page.waitForTimeout(4200);

const seam = page.locator("[data-vine-cut]").first();
check("the vine has a seam to take a press, and it is the only thing on it", (await page.locator("[data-vine-cut]").count()) === 1);

/** What the vine canvas is painting, and where: pixels, and the box round them. */
const painted = () => page.evaluate(() => {
  const el = document.querySelector("[data-timeline-vines]");
  const c = el.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = c.getImageData(0, 0, el.width, el.height);
  let on = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  const cols = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        on++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        cols.push(x);
      }
    }
  }
  /* How much of the painted run is empty across its middle third: a vine
     parting at the middle empties there while both ends are still on. */
  const mid = cols.length ? (x0 + x1) / 2 : 0;
  const span = Math.max(1, x1 - x0);
  const middle = cols.filter((x) => Math.abs(x - mid) < span * 0.16).length;
  return { on, box: { x0, y0, x1, y1 }, middle, w: width, h: height };
});

const rest = await painted();
check("the vine is painted on the canvas", rest.on > 400, `${rest.on} sampled pixels`);
check("and its middle is painted at rest", rest.middle > 20, `${rest.middle} in the middle third`);

/*
 * A hand on it, at a point that is really on it.
 *
 * The seam element is clipped to the vine's own shape, so the middle of
 * its bounding box is very often off the curve and nothing but board is
 * under the pointer there. The hit point is found the way the browser
 * finds it — `elementFromPoint` over the box until it answers the seam —
 * which is also the honest check that the seam is pressable at all.
 */
const spot = await page.evaluate(() => {
  const el = document.querySelector("[data-vine-cut]");
  const r = el.getBoundingClientRect();
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 40; j++) {
      const x = r.left + (r.width * i) / 40;
      const y = r.top + (r.height * j) / 40;
      if (document.elementFromPoint(x, y) === el) return { x, y };
    }
  }
  return null;
});
check("the seam can be reached by a pointer", !!spot, spot ? `${Math.round(spot.x)},${Math.round(spot.y)}` : "nowhere on it answers");
await page.mouse.move(spot.x, spot.y);
await page.waitForTimeout(400);
const held = await painted();
check("a hand on the seam changes the vine itself", held.on !== rest.on || held.box.y0 !== rest.box.y0,
  `${rest.on} px in ${rest.box.y1 - rest.box.y0} tall → ${held.on} px in ${held.box.y1 - held.box.y0} tall`);
check("and nothing is laid over it: no white bar where the pointer is",
  await page.evaluate(() => {
    const el = document.querySelector("[data-vine-cut]:hover") ?? document.querySelector("[data-vine-cut]");
    const bg = getComputedStyle(el).backgroundColor;
    return bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
  }),
  await page.evaluate(() => getComputedStyle(document.querySelector("[data-vine-cut]")).backgroundColor));

/* ------------------------------------------------------------------ */
/* Cut it, and watch it come apart                                      */
/* ------------------------------------------------------------------ */

const frames = [];
await page.mouse.down();
await page.mouse.up();
for (let i = 0; i < 24; i++) {
  frames.push(await painted());
  await page.waitForTimeout(35);
}
await page.waitForTimeout(1200);

const opened = frames.filter((f) => f.on > 60 && f.middle < rest.middle * 0.4);
check("it parts at the middle before it is gone", opened.length > 0,
  `${opened.length} frames with the middle empty and the ends still painted`);
const shrank = frames.map((f) => f.on);
check("and it goes rather than blinking out", shrank.filter((n) => n > 60).length >= 3,
  `pixels through the cut: ${shrank.filter((_, i) => i % 3 === 0).join(", ")}`);

const after = await painted();
check("nothing of it is left", after.on < rest.on * 0.35, `${after.on} of ${rest.on}`);
const left = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.threads?.length ?? 0);
check("and the iteration went with it, once it had", left === 1, `${left} of 2 left`);

await page.screenshot({ path: ".screenshots/vine-pull.png" });
await browser.close();
const bad = results.filter((r2) => !r2).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/vine-pull.png");
process.exit(bad ? 1 : 0);
