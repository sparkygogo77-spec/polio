/**
 * The orb in 3D: it turns in the hand, it wears his colour, and the rings
 * pass in front of it.
 *
 * Three complaints, and underneath they are one. A perfect black mirror is
 * the same sphere from every angle — turning it changes nothing a camera can
 * see, which is exactly why the first orb turned the *room* and not the ball.
 * So "it does not turn" and "my colour never reaches the body" are the same
 * missing thing: a body with markings on it, in his colour, that can be
 * watched going round. And a ring drawn wholly behind the sphere reads as a
 * halo stuck on a flat disc rather than an orbit, which is the third.
 *
 * Every check here is a pixel check taken while the orb is being *used*, not
 * a reading of what it looks like sitting still:
 *
 *   · dragging three times as far turns it three times as far;
 *   · a pointer that is not pressed does not turn it at all;
 *   · the body carries the hue he picked, on its dark side as well as its
 *     lit side, and two different hues give two visibly different spheres;
 *   · part of a ring is drawn over the sphere, and the rest of it behind.
 *
 *   node tests/orb-turns.mjs [url]      # default http://localhost:3000
 */
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

/* Without WebGL the part falls back to the drawn orb, and every check below
   would be measuring a different sphere. Say so rather than judging it. */
if (!(await page.evaluate(() => { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }))) {
  console.log("\nno WebGL in this browser — the orb in 3D cannot be measured here");
  await browser.close();
  process.exit(2);
}

/* ------------------------------------------------------------------ */
/* One orb, alone on the board, big, in a named hue, live              */
/* ------------------------------------------------------------------ */

/**
 * One orb from the shelf, then the same node written back with different
 * options and reloaded: every check wants the same sphere at a known size in
 * a known colour, and a node hand-written from nothing is missing fields the
 * Builder reads on load.
 */
await page.locator('input[placeholder*="Search parts"]').first().fill("orb");
await page.waitForTimeout(900);
const tile = page.getByText("Orb, turnable", { exact: true }).first();
check("the orb in 3D is in the shelf", (await tile.count()) === 1);
await tile.click({ force: true });
await page.waitForTimeout(600);
/* A card opens its detail card; Add to page there is what puts it on the board. */
await page.locator('[data-add-to-page="orb-webgl"]').click({ force: true });
await page.waitForTimeout(1400);
const seed = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.featureId === "orb-webgl") ?? null);
check("dropping it puts an orb on the board", !!seed, seed ? `${seed.w}\u00d7${seed.h}` : "nothing");
if (!seed) { console.log("\nnothing to measure"); await browser.close(); process.exit(1); }

const put = async (options) => {
  await page.evaluate(({ node, options }) => {
    const d = JSON.parse(localStorage.getItem("builder.studio") ?? '{"state":{}}');
    d.state.nodes = [{ ...node, x: 340, y: 60, w: 640, h: 640, content: "The signal is live", options }];
    d.state.selected = [];
    localStorage.setItem("builder.studio", JSON.stringify(d));
  }, { node: seed, options });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  /* Live mode: a part is only in anyone's hands on a live page, and board
     mode is one still frame by the rule every part keeps. */
  await page.locator("[data-preview-toggle]").first().click({ force: true });
  await page.waitForTimeout(1800);
};

const BASE = { size: "94", tilt: "0", hue: "96", glow: "0", rings: "none", spin: "no", surface: "glass" };

await put(BASE);
/* The shelf keeps its own little orb, so the one on the board is the big one. */
const orbCanvas = async () => {
  const all = page.locator('[data-part="orb-webgl"] canvas');
  let best = null, area = 0;
  for (let i = 0; i < (await all.count()); i++) {
    const r = await all.nth(i).boundingBox();
    if (r && r.width * r.height > area) { area = r.width * r.height; best = all.nth(i); }
  }
  return { at: best, area };
};
let found = await orbCanvas();
check("the orb in 3D draws a real WebGL sphere, not the drawn stand-in", !!found.at && found.area > 100000,
  found.at ? `a ${Math.round(Math.sqrt(found.area))}px canvas on the board` : "no canvas \u2014 it fell back to the drawn orb");
if (!found.at) {
  console.log("\nnothing to measure");
  await browser.close();
  process.exit(1);
}
const canvas = found.at;

/* ------------------------------------------------------------------ */
/* Reading the sphere                                                  */
/* ------------------------------------------------------------------ */

/** The sphere's box on the page, and the disc inscribed in it. */
const discBox = async () => {
  const r = await canvas.boundingBox();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
};

/**
 * A picture of the sphere, read back as numbers.
 *
 * The screenshot goes back into the page to be decoded, because a WebGL
 * canvas drawn without `preserveDrawingBuffer` reads back blank from
 * `toDataURL` once its frame is over — the pixels have to come from the
 * compositor, which is what a screenshot is.
 */
/*
 * How much of the square canvas the sphere actually fills.
 *
 * The first run of this file sampled the whole canvas and reported 1125
 * pixels of the sphere covered by a ring on an orb whose rings are all
 * behind it \u2014 because a fifth of what it called "the sphere" was the
 * transparent corner of the canvas, with the ring showing straight through.
 *
 * A sphere of radius 1 at distance 4.4 has a silhouette of radius
 * sqrt(d\u00b2-r\u00b2)/d = 0.974 sitting at depth d - r\u00b2/d = 4.173, and the frame at
 * that depth is 4.173\u00b7tan(17.5\u00b0) = 1.316 half-tall, so the sphere is 0.740 of
 * the half-height. Sampled at 0.70 and nothing but sphere is in the reading.
 */
const FACE = 0.70;

const readDisc = async (clip, fill = FACE) => {
  const shot = await page.screenshot({ clip });
  return page.evaluate(async ({ b64, fill }) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const cx = c.width / 2, cy = c.height / 2, rad = Math.min(cx, cy) * fill;
    const px = [];
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > rad * rad) continue;
        const i = (y * c.width + x) * 4;
        px.push([data[i], data[i + 1], data[i + 2], x, y]);
      }
    }
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const sat = (p) => { const hi = Math.max(p[0], p[1], p[2]); return hi ? (hi - Math.min(p[0], p[1], p[2])) / hi : 0; };
    const hue = (p) => {
      const [r, g2, b] = p, hi = Math.max(r, g2, b), lo = Math.min(r, g2, b), d = hi - lo;
      if (!d) return -1;
      const h = hi === r ? ((g2 - b) / d) % 6 : hi === g2 ? (b - r) / d + 2 : (r - g2) / d + 4;
      return ((h * 60) % 360 + 360) % 360;
    };
    const sorted = [...px].sort((a, b) => lum(a) - lum(b));
    const dark = sorted.slice(0, Math.floor(sorted.length / 2));
    const mean = (list, f) => list.reduce((a, p) => a + f(p), 0) / Math.max(1, list.length);
    /* A circular mean, so a hue near the top of the wheel is not averaged
       with one near the bottom into something halfway round it. */
    const hued = px.filter((p) => sat(p) > 0.12 && lum(p) > 10);
    const ang = hued.map((p) => (hue(p) * Math.PI) / 180);
    const meanHue = hued.length
      ? ((Math.atan2(ang.reduce((a, t) => a + Math.sin(t), 0) / ang.length, ang.reduce((a, t) => a + Math.cos(t), 0) / ang.length) * 180) / Math.PI + 360) % 360
      : -1;
    return {
      n: px.length,
      /* Every pixel, as bytes, so two pictures can be compared exactly. */
      bytes: px.map((p) => `${p[0]},${p[1]},${p[2]}`).join(";"),
      meanLum: mean(px, lum),
      darkSat: mean(dark, sat),
      darkLum: mean(dark, lum),
      meanSat: mean(px, sat),
      meanHue,
      /* Where in the disc each pixel is, kept so a difference can be placed
         above or below the middle. */
      at: px.map((p) => `${p[3]},${p[4]}`).join(";"),
      h: c.height,
    };
  }, { b64: shot.toString("base64"), fill });
};

/** How many pixels two readings of the same disc differ on, and where. */
const differs = (a, b, tol = 8) => {
  const A = a.bytes.split(";"), B = b.bytes.split(";"), P = a.at.split(";");
  let n = 0, top = 0, bottom = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const x = A[i].split(","), y = B[i].split(",");
    const d = Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
    if (d <= tol) continue;
    n++;
    if (Number(P[i].split(",")[1]) < a.h / 2) top++; else bottom++;
  }
  return { n, top, bottom, share: n / Math.max(1, A.length) };
};

const box = await discBox();
const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

/* ------------------------------------------------------------------ */
/* 1. It turns in the hand, and only in the hand                       */
/* ------------------------------------------------------------------ */

/**
 * One drag, of a given length, in one direction.
 *
 * The first draft of this went there and back again between passes, so three
 * passes ended on the same net turn as one and reported 0.0% \u2014 a fault of
 * the instrument, not of the orb. A turn that accumulates has to be measured
 * by a drag that accumulates, and the long one deliberately runs past the
 * edge of the sphere, which is the other half of "free".
 */
const dragBy = async (dx) => {
  await page.mouse.move(centre.x - 110, centre.y);
  await page.mouse.down();
  for (let s = 1; s <= 24; s++) await page.mouse.move(centre.x - 110 + (dx * s) / 24, centre.y);
  await page.mouse.up();
  await settled();
};

/**
 * Wait until the sphere has stopped moving.
 *
 * It is thrown, not snapped: letting go leaves it carrying, and how many
 * frames that takes depends on how fast this machine can draw a sphere. A
 * fixed wait read the throw still running and called it the orb moving under
 * an unpressed pointer. So the picture is read until two of them match.
 */
const settled = async (tries = 14) => {
  let last = null;
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(320);
    const now = await readDisc(box);
    if (last && differs(last, now).n === 0) return now;
    last = now;
  }
  return last;
};

await put(BASE);
const rest = await settled();
await dragBy(220);
const once = await readDisc(box);
check("dragging across it turns it", differs(rest, once).share > 0.02, `${(differs(rest, once).share * 100).toFixed(1)}% of the sphere changed`);

await put(BASE);
await settled();
await dragBy(660);
const thrice = await readDisc(box);
const far = differs(once, thrice);
check(
  "and a drag three times as long turns it three times as far, past the edge of the sphere and on",
  far.share > 0.02,
  `a 220px drag and a 660px drag leave it ${(far.share * 100).toFixed(1)}% apart`,
);

/* Let it come to rest, then sweep the pointer right across it with nothing
   pressed. The orb used to turn under a mouse merely passing over it. */
const still = await settled();
for (let s = 0; s <= 12; s++) await page.mouse.move(box.x + (box.width * s) / 12, centre.y);
await page.waitForTimeout(900);
const after = await readDisc(box);
const drift = differs(still, after);
check(
  "a pointer nobody is pressing does not turn it",
  drift.share < 0.01,
  `${(drift.share * 100).toFixed(1)}% of the sphere moved under an unpressed pointer, against ${(far.share * 100).toFixed(1)}% under a drag`,
);

/* ------------------------------------------------------------------ */
/* 2. His colour reaches the body                                      */
/* ------------------------------------------------------------------ */

await put({ ...BASE, hue: "12" });
const red = await readDisc(box);
await put({ ...BASE, hue: "200" });
const blue = await readDisc(box);

check(
  "the body carries his colour on its dark side, not only where the light hits",
  red.darkSat > 0.25 && blue.darkSat > 0.25,
  `dark half is ${(red.darkSat * 100).toFixed(0)}% saturated at hue 12, ${(blue.darkSat * 100).toFixed(0)}% at hue 200`,
);
const apart = Math.min(Math.abs(red.meanHue - blue.meanHue), 360 - Math.abs(red.meanHue - blue.meanHue));
check(
  "and the sphere he asked for red is a different colour from the one he asked for blue",
  red.meanHue >= 0 && blue.meanHue >= 0 && apart > 60,
  `the sphere reads ${red.meanHue.toFixed(0)}° against ${blue.meanHue.toFixed(0)}° — ${apart.toFixed(0)}° apart`,
);
check(
  "the sphere he asked for red reads red",
  red.meanHue >= 0 && Math.min(Math.abs(red.meanHue - 12), 360 - Math.abs(red.meanHue - 12)) < 55,
  `asked 12°, reads ${red.meanHue.toFixed(0)}°`,
);
check(
  "and it is still a dark object, not a bright ball",
  red.meanLum < 140 && red.meanLum > 8,
  `mean brightness ${red.meanLum.toFixed(0)} of 255`,
);

/* ------------------------------------------------------------------ */
/* 3. The near half of a ring is in front of the sphere                */
/* ------------------------------------------------------------------ */

await put({ ...BASE, rings: "none" });
const bare = await readDisc(box);
await put({ ...BASE, rings: "two" });
const ringed = await readDisc(box);
const crossing = differs(bare, ringed);
check(
  "a ring is drawn over the sphere, so it reads as an orbit and not a halo behind a disc",
  crossing.n > 200,
  `${crossing.n} pixels of the sphere are covered by a ring`,
);
check(
  "and it is the near half that crosses in front, not the far half",
  crossing.bottom > crossing.n * 0.7,
  `${crossing.bottom} of ${crossing.n} crossing pixels are on the near side`,
);

/* The far half must still exist, behind: the whole ellipse, not half a ring. */
const wide = { x: box.x - 60, y: box.y - 60, width: box.width + 120, height: box.height + 120 };
await put({ ...BASE, rings: "none" });
const bareWide = await readDisc(wide, 0.98);
await put({ ...BASE, rings: "two" });
const ringedWide = await readDisc(wide, 0.98);
const whole = differs(bareWide, ringedWide);
check(
  "and the far half is still there behind it, so a ring is a whole ellipse",
  whole.top > 200,
  `${whole.top} pixels of ring above the middle, ${whole.bottom} below`,
);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
