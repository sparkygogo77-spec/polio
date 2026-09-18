/**
 * The queue strip: what is running, as bars, ahead of the bar's controls.
 *
 * Toasts are off, so this and the timeline are how work is watched. It is a
 * glance and not a panel, and everything below is checked as a glance would
 * take it in: is there anything there, how many, which way round, and does a
 * bar say anything it should not.
 *
 * The work is seeded through the store's own persisted shape, the way the
 * other suites do it, because a real drawing job needs a Claude key and a
 * real iteration needs one too.
 *
 *   node tests/queue-strip.mjs [url]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (line) => console.log(`  --   ${line}`);

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

const look = () => page.evaluate(() => {
  const strip = document.querySelector("[data-queue-strip]");
  // The strip is in the top bar's status slot, which sits ahead of the
  // controls; the sound key is the first of them. (It used to be measured
  // against the news bell, which has gone.)
  const bell = document.querySelector("[aria-label='Toggle sound']")?.getBoundingClientRect() ?? null;
  if (!strip) return { there: false, bell: !!bell };
  const bars = [...strip.querySelectorAll("[data-queue-bar]")].map((e) => {
    const r = e.getBoundingClientRect();
    /* Progress is the fill's width inside the bar, not the bar's own — the
       bar is one size and the fill is clipped to how far the work has got. */
    const f = e.querySelector("[data-queue-fill]");
    return {
      id: e.getAttribute("data-queue-bar"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      x: Math.round(r.x),
      fill: f ? Math.round(f.getBoundingClientRect().width) : null,
      fillClasses: f ? f.className : "",
      text: (e.innerText || "").trim(),
      classes: e.className,
    };
  });
  return { there: true, bars, label: strip.getAttribute("aria-label"), right: Math.round(strip.getBoundingClientRect().right), bellX: bell ? Math.round(bell.x) : null };
});

/* ------------------------------------------------------ nothing running */
await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-studio-bar]", { timeout: 20000 });
await page.waitForTimeout(2000);
const quiet = await look();
check("with nothing running there is no strip at all", quiet.there === false, quiet.there ? `${quiet.bars.length} bars` : "the header is as it was");

/* --------------------------------------------------- three drawings, aged */
await page.evaluate(() => {
  const raw = localStorage.getItem("builder.studio");
  const doc = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  const now = Date.now();
  const job = (id, ageMs, status) => ({
    id, nodeId: null, at: null, frameWidth: 1440,
    sketch: { strokes: [], words: "" }, picture: null, label: id,
    status, queued: now - ageMs, ...(status === "running" ? { started: now - ageMs } : {}),
  });
  doc.state = doc.state || {};
  /* Oldest first; the strip sorts by when they started. The steps are the
     queue's own words, which `formation.ts` reads as milestones — so these
     three are at 0.82, 0.15 and nothing at all, and their bars should be
     long, short and shortest in that order. */
  doc.state.queue = [
    { ...job("old", 60000, "running"), step: "Refining the drawing" },
    { ...job("middle", 6000, "running"), step: "Reading the drawing…" },
    job("new", 700, "waiting"),
  ];
  localStorage.setItem("builder.studio", JSON.stringify(doc));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-queue-strip]", { timeout: 20000 });
await page.waitForTimeout(1800);
const busy = await look();

check("one bar for each task in flight", busy.bars.length === 3, `${busy.bars.length} bars`);
check("and not a word on any of them", busy.bars.every((b) => b.text === ""), JSON.stringify(busy.bars.map((b) => b.text)));
check("every bar is the same height", new Set(busy.bars.map((b) => b.h)).size === 1, `${[...new Set(busy.bars.map((b) => b.h))].join(", ")}px`);

/* Newest at the near end: the strip is packed from the left, so a new bar
   lands nearest and pushes the older ones away. This used to read "newest on
   the right" and test it as document order rising in x — which is true of any
   left-to-right row whichever way round it is filled, so it went on passing
   when the packing was reversed. Named bars, so it can only pass one way. */
const nearest = busy.bars.reduce((a, b) => (b.x < a.x ? b : a));
check("the newest sits at the near end", nearest.id === "job:new",
  busy.bars.map((b) => `${b.id}@${b.x}`).join(" "));

/*
 * Grown by the work, not by the clock.
 *
 * The three are at "Refining the drawing", "Reading the drawing…" and not
 * started, which the shared model reads as 0.82, 0.15 and nothing — so the
 * bars go long, short, shortest. An earlier version of this grew on a timer
 * and this same check passed on nothing but their ages, which is why the
 * steps are set here rather than left off.
 */
const widths = busy.bars.map((b) => b.w);
/* Keyed by the job's own id rather than by position: the strip is packed from
   the near end, so document order follows the packing and not the ages, and a
   check that reads the three off by index measures whichever way it happens to
   be packed today. `old` is the one at 0.82, `middle` at 0.15, `new` unstarted. */
const byId = Object.fromEntries(busy.bars.map((b) => [b.id, b]));
const fills = ["job:old", "job:middle", "job:new"].map((id) => byId[id]?.fill ?? null);
/* A bar is one bar that fills: the bar itself is one size for every task —
   it is the ground the work is written onto, so a task that has barely begun
   still has a whole bar — and it is the fill over it that says how far the
   work has got. This used to be measured as the bar's own width, growing
   from a stub; that is the shape the queue was deliberately moved off, and
   `queue-bar.mjs` holds the same rule from the other side ("every one the
   same width, none a stub"). The three steps above still read 0.82, 0.15 and
   nothing, so it is the fills that go long, short, shortest. */
check("every bar is the whole bar, whatever its task has got", new Set(widths).size === 1, `${[...new Set(widths)].join(", ")}px`);
check("the fill is as long as its task has got", fills[0] > fills[1] && fills[1] > fills[2], `${fills.join("px, ")}px for 0.82, 0.15 and not started`);
check("and the one that has not begun is not covered at all", fills[2] <= 8, `${fills[2]}px of ${widths[0]}px`);

/* The colour is the shared definition's, not a colour picked here: the bar is
   the construct at its drawing temperature and the fill is the same construct
   at its landed one, which is what makes a finished bar read as one green
   piece rather than a second bar laid beside the first. */
check(
  "a bar is the shared construct at its drawing temperature",
  busy.bars.every((b) => /\bmolten\b/.test(b.classes) && /\bmolten-ember\b/.test(b.classes)),
  busy.bars[0]?.classes ?? "none",
);
check(
  "and its fill is the same construct at the landed one",
  busy.bars.every((b) => /\bmolten\b/.test(b.fillClasses) && /\bmolten-verdant\b/.test(b.fillClasses)),
  busy.bars[0]?.fillClasses || "none",
);

check("the strip sits on the near side of the bar's controls", busy.bellX !== null && busy.right <= busy.bellX + 1, `strip ends at ${busy.right}, the controls start at ${busy.bellX}`);
/* There are no words on the bars, so a count is the whole of what a screen
   reader can be given — and it is what a person reads off the strip too. It
   used to have to name the kind ("3 drawings"); the strip now carries every
   kind of queued job, so it says how many are working and how many are done
   and leaves the kind to the timeline. What matters is that the number is
   said at all, and that it is the number of bars on show. */
check("and it says the count for anyone who cannot see it",
  new RegExp(`\\b${busy.bars.length}\\b`).test(busy.label ?? ""), busy.label);

/*
 * The green bar is not driven here, and that is worth saying rather than
 * leaving as a gap somebody assumes is covered.
 *
 * A green bar is a *thread* whose state is running, and the store cuts those
 * on rehydrate on purpose — "a thread left running is a thread whose process
 * is gone" — so seeding one through localStorage and reloading can never
 * produce one. Driving a real iteration needs a Claude key. What is covered
 * is that the strip asks the shared definition for its temperature, which is
 * the only difference between the two bars.
 */
note("the green bar is unproven here: a running thread cannot be seeded, because the store cuts running threads on rehydrate by design");

const clip = await page.evaluate(() => {
  const h = document.querySelector("header").getBoundingClientRect();
  return { x: Math.max(0, h.right - 420), y: h.y, width: 420, height: Math.ceil(h.height) };
});
await page.screenshot({ path: ".screenshots/queue-strip.png", clip });
console.log("       .screenshots/queue-strip.png");

/* ------------------------------------------------------- and then it goes */
/*
 * Written out in full again rather than edited in place.
 *
 * The store does not persist the queue — it is work in flight, not part of
 * the document — so it arrives only because a seeded key is merged over the
 * defaults on hydrate, and the app's next write drops it. Reading the doc
 * back and flipping a status therefore edits nothing, and the strip would
 * then be empty because the queue was never there, not because the work
 * finished: a check that passed for the wrong reason. It passed exactly that
 * way once. So the same three jobs are seeded again, done this time.
 */
await page.evaluate(() => {
  const raw = localStorage.getItem("builder.studio");
  const doc = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  const now = Date.now();
  const done = (id) => ({
    id, nodeId: null, at: null, frameWidth: 1440,
    sketch: { strokes: [], words: "" }, picture: null, label: id,
    status: "done", queued: now - 60000, started: now - 60000, ended: now - 100,
  });
  doc.state = doc.state || {};
  doc.state.queue = [done("old"), done("middle"), done("new")];
  localStorage.setItem("builder.studio", JSON.stringify(doc));
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-studio-bar]", { timeout: 20000 });
await page.waitForTimeout(1800);
const after = await look();
/*
 * And the three really did arrive — asked of the Finish key, which counts the
 * queue out loud: "Finish, 0 unfinished, 3 done". Reading localStorage back
 * cannot answer it, because the app has already rewritten the key without a
 * queue by the time the page has loaded. Without this the last check passes
 * on an empty queue, which is the strip being empty for the wrong reason.
 */
const counted = await page.evaluate(() => document.querySelector("[data-finish]")?.getAttribute("aria-label") ?? "");
check("the three finished jobs are there to have finished", /0 unfinished, 3 done/.test(counted), counted || "no Finish key");
check("when the work finishes the bars go with it", after.there === false, after.there ? `${after.bars.length} bars left over` : "the strip is gone");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
