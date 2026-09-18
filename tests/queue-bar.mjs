/**
 * The queue bar: one bar, full width, red filling to green, newest on the left.
 *
 * HIS WORDS: "the little loading bar in the top doesnt do a good job of
 * indicating when its done, i turns two bars into one green one when done, it
 * doesnt load properly, the bar should stay the full size and not two
 * distinct pieces, initially red until it fills up (it doesnt have a filling
 * up or loading bar animation at all) and turns in to a full green one, every
 * action queued should be added to the left until it turns green, green ones
 * stay until timeline is opened."
 *
 * What it did: each bar's own WIDTH was the progress, so a job half done was
 * a stub, two jobs were two stubs of different lengths, and a finished one
 * vanished. What it does: a bar is one constant-width piece per queued
 * action, red, with the fill running across it as the work goes, whole and
 * green when the work is done — and a green one stays until he opens the
 * timeline, which is where he would go to look at it.
 *
 * Driven by seeding the board's own threads, so nothing is asked of a model
 * and nothing is spent.
 *
 *   node tests/queue-bar.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/*
 * DRIVEN THROUGH THE REAL PATH, with the renderer answered here so nothing is
 * asked of a model and nothing is spent.
 *
 * Seeding a running thread cannot work and it is worth writing down why: the
 * store marks every thread left `running` as `cut` when it rehydrates, which
 * is right — a reload means that work is not running any more — so no seeded
 * page can ever show a live bar. His own words give the honest driver:
 * "they should be queued like any other generation being made in the
 * builder." So the check queues generations.
 */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
/** Held open until the check lets it answer, so a job can be watched running. */
let release = () => {};
const held = new Promise((r) => { release = r; });
let calls = 0;
await page.route("**/api/studio/**", async (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (what === "image") {
    calls += 1;
    await held;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, image: `data:image/png;base64,${PNG}`, cost: 0.04 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

const tab = page.locator('[aria-label="Side panel"] button', { hasText: /Generate/i }).first();
await tab.click({ force: true });
await page.waitForTimeout(600);
const panel = page.locator("[data-render-panel]").first();

/** Queue one, by typing it and pressing the button. */
const queue = async (words) => {
  await panel.locator("[data-render-tweak]").fill(words);
  await page.waitForTimeout(120);
  await panel.locator("[data-render-go]").click({ force: true });
  await page.waitForTimeout(700);
};

/** Every bar in the strip, left to right, with its own width and its fill. */
const strip = () => page.evaluate(() => {
  const bars = [...document.querySelectorAll("[data-queue-bar]")];
  return bars.map((b) => {
    const box = b.getBoundingClientRect();
    const fill = b.querySelector("[data-queue-fill]");
    const f = fill ? fill.getBoundingClientRect() : null;
    return {
      id: b.getAttribute("data-queue-bar"),
      done: b.hasAttribute("data-queue-done"),
      x: Math.round(box.x), w: Math.round(box.width),
      fill: f && box.width > 0 ? Math.round((f.width / box.width) * 100) : 0,
    };
  });
});

/* ------------------------------------------------------------------ */
/* 1. MORE THAN ONE AT A TIME                                          */
/* ------------------------------------------------------------------ */

await queue("a dog in a field");
let bars = await strip();
check("pressing it queues one", bars.length === 1, `${bars.length} bar, ${calls} call`);

await queue("a second one");
bars = await strip();
check("and a second can be queued while the first is still out", bars.length === 2, `${bars.length} bars, ${calls} calls`);
check("the button was never refused while one was running", calls === 2, `${calls} calls went`);

/* ------------------------------------------------------------------ */
/* 2. ONE PIECE, ONE WIDTH, AND IT FILLS                               */
/* ------------------------------------------------------------------ */

const widths = [...new Set(bars.map((b) => b.w))];
check("the bar stays the full size: every one the same width, none a stub",
  widths.length === 1 && widths[0] > 0, `widths ${bars.map((b) => `${b.w}px`).join(", ")}`);
check("and it is a loading bar: filled part of the way, not all of it",
  bars.every((b) => b.fill > 0 && b.fill < 100), `filled ${bars.map((b) => `${b.fill}%`).join(", ")}`);
check("none of them says it is done yet", !bars.some((b) => b.done), `${bars.filter((b) => b.done).length} done`);

/* ------------------------------------------------------------------ */
/* 3. NEWEST ON THE LEFT                                               */
/* ------------------------------------------------------------------ */

check("every action queued is added to the left", bars[0].x < bars[1].x,
  `the newer at ${bars[0].x}, the older at ${bars[1].x}`);

/* ------------------------------------------------------------------ */
/* 4. DONE IS WHOLE AND GREEN, AND IT STAYS                            */
/* ------------------------------------------------------------------ */

release();
await page.waitForTimeout(2000);
bars = await strip();
check("when the work lands the bars stay rather than vanishing", bars.length === 2, `${bars.length} still there`);
check("and they are filled the whole way", bars.every((b) => b.fill >= 99), `filled ${bars.map((b) => `${b.fill}%`).join(", ")}`);
check("and say they are done", bars.every((b) => b.done), `${bars.filter((b) => b.done).length} of ${bars.length}`);

/*
 * Read off the colour the construct actually PAINTS with.
 *
 * `backgroundColor` is transparent on both of them — a molten bar paints
 * with the `background` shorthand, gradients and all — so comparing that
 * compared two nothings and called them the same. `--mo-body` is the
 * temperature itself, which is the thing that differs between the red
 * underneath and the green over it.
 */
const colour = await page.evaluate(() => {
  const fill = document.querySelector("[data-queue-done] [data-queue-fill]");
  const bar = document.querySelector("[data-queue-done]");
  const body = (el) => (el ? getComputedStyle(el).getPropertyValue("--mo-body").trim() : "");
  return { fill: body(fill), bar: body(bar) };
});
check("the green that covers it is not the red underneath", !!colour.fill && !!colour.bar && colour.fill !== colour.bar,
  `fill ${colour.fill || "-"}, ground ${colour.bar || "-"}`);

/* ------------------------------------------------------------------ */
/* 5. THE PICTURES LANDED ON THE TIMELINE, IN ORANGE                   */
/* ------------------------------------------------------------------ */

const kept = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  return {
    draws: (st.draws ?? []).length,
    generations: (st.threads ?? []).filter((t) => t.mode === "generate").length,
    linked: (st.draws ?? []).filter((d) => d.threadId).length,
  };
});
check("both generations are iterations on the timeline", kept.generations === 2, `${kept.generations} of them`);
check("and both pictures are kept in their own right", kept.draws === 2, `${kept.draws} kept`);
check("each picture knows the iteration it landed as", kept.linked === 2, `${kept.linked} linked`);

await page.locator('[aria-label^="Finish"]').first().click({ force: true });
await page.waitForTimeout(2200);
const box = await page.evaluate(() => {
  const el = [...document.querySelectorAll("[data-box]")].find((b) => getComputedStyle(b.parentElement).getPropertyValue("--box-hue").trim() === "62");
  const any = document.querySelectorAll("[data-box]").length;
  return { orange: !!el, any, hues: [...document.querySelectorAll("[data-box]")].map((b) => getComputedStyle(b.parentElement).getPropertyValue("--box-hue").trim()).join(", ") };
});
check("a generation's box on the timeline is orange", box.orange, `${box.any} boxes, hues ${box.hues || "-"}`);

/* 6. …AND OPENING THE TIMELINE IS WHAT CLEARS THE GREEN ONES. */
bars = await strip();
check("opening the timeline takes the green ones away", bars.length === 0, `${bars.length} left`);

/* 7. THE PICTURE OUTLIVES ITS BOX. */
const after = await page.evaluate(() => {
  const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
  doc.state.threads = (doc.state.threads ?? []).filter((t) => t.mode !== "generate");
  localStorage.setItem("builder.studio", JSON.stringify(doc));
  return (doc.state.draws ?? []).length;
});
check("a picture deleted from the timeline is still kept", after === 2, `${after} still in the archive`);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
