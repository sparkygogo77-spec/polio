/**
 * The parts shelf, as J asked for it.
 *
 * The shelf used to be a drill-down that took the whole band: pressing a
 * planet removed all fourteen of them and put that category's parts in their
 * place, so holding a hero next to a text block meant going back and starting
 * again. The ask was to merge them — the categories open in one stacked flow,
 * at most two at a time.
 *
 * Everything here is checked the way it is looked at: are the planets still
 * there, is the second one *under* the first, did the third push the oldest
 * out, and can you see what you just opened.
 *
 *   node tests/shelf-pass.mjs [url]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
/** Copied, not imported: a test that reads the code's own number cannot catch it changing. */
const OPEN_AT_MOST = 2;

mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

async function look(w, h, tag) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-category]", { timeout: 20000 });
  await page.waitForTimeout(1500);

  const state = () => page.evaluate(() => {
    const ways = [...document.querySelectorAll("[data-category]")].map((e) => e.getAttribute("data-category"));
    const open = [...document.querySelectorAll("[data-category-open]")].map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute("data-category-open"), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    });
    const shelf = document.querySelector("[data-shelf]")?.getBoundingClientRect();
    return { ways, open, shelf: shelf ? { top: Math.round(shelf.top), bottom: Math.round(shelf.bottom) } : null };
  });

  const press = async (id) => {
    await page.evaluate((c) => document.querySelector(`[data-category="${c}"]`)?.click(), id);
    await page.waitForTimeout(700);
  };

  const shut = await state();
  const ways = shut.ways.length;

  await press("hero");
  const one = await state();
  check(
    `${tag}: the way in does not vanish when a category opens`,
    one.ways.length === ways && one.ways.length > 5,
    `${ways} planets before, ${one.ways.length} after`,
  );
  check(`${tag}: pressing a planet opens that category`, one.open.length === 1 && one.open[0].id === "hero", JSON.stringify(one.open.map((o) => o.id)));
  /* You have to be able to see what you just opened. The planets fill the
     band on their own, so a section that opens under them opens off the
     bottom of it unless something brings it up. */
  if (one.open[0] && one.shelf) {
    const head = one.open[0].top;
    check(
      `${tag}: what you opened is on screen`,
      head >= one.shelf.top - 4 && head < one.shelf.bottom - 20,
      `its top is ${head}, and the shelf runs ${one.shelf.top}–${one.shelf.bottom}`,
    );
  }

  await press("content");
  const two = await state();
  check(`${tag}: a second category opens beside the first`, two.open.length === 2, JSON.stringify(two.open.map((o) => o.id)));
  if (two.open.length === 2) {
    const [a, b] = two.open;
    check(
      `${tag}: and it stacks under it rather than replacing it`,
      b.top >= a.bottom - 4,
      `${a.id} ends at ${a.bottom}, ${b.id} starts at ${b.top}`,
    );
  }

  await press("media");
  const three = await state();
  check(
    `${tag}: a third never makes three`,
    three.open.length === OPEN_AT_MOST,
    `${three.open.length} open: ${JSON.stringify(three.open.map((o) => o.id))}`,
  );
  check(
    `${tag}: the one that goes is the one opened longest ago`,
    !three.open.some((o) => o.id === "hero") && three.open.some((o) => o.id === "media"),
    JSON.stringify(three.open.map((o) => o.id)),
  );

  // Pressing an open one shuts it again.
  await press("media");
  const back = await state();
  check(`${tag}: pressing an open category shuts it`, back.open.length === 1 && !back.open.some((o) => o.id === "media"), JSON.stringify(back.open.map((o) => o.id)));

  /* One wheel, and it moves everything.
     With two categories open the shelf holds several thousand pixels of
     cards. The complaint was that the elements scrolled inside their own box
     — a fixed header with a small scrolling area under it — so what is
     checked is the thing that made it feel that way: there is exactly one
     place in the shelf a wheel does anything, and turning it moves the
     planets too rather than only the cards.

     Previews are excluded by *why* they cannot be scrolled rather than by
     what they are: a part rendered inside a card can overflow its own clip
     box, but the whole preview is `pointer-events: none`, so no wheel ever
     reaches it. */
  await press("hero");
  const wheels = await page.evaluate(() => {
    const drawer = document.querySelector("[data-drawer]");
    return [drawer, ...drawer.querySelectorAll("*")]
      .filter((e) => {
        const st = getComputedStyle(e);
        if (st.pointerEvents === "none") return false;
        return e.scrollHeight > e.clientHeight + 4 && ["auto", "scroll"].includes(st.overflowY);
      })
      .map((e) => `${e.tagName.toLowerCase()}${e.dataset.shelf !== undefined ? "[shelf]" : ""} ${e.clientHeight}/${e.scrollHeight}`);
  });
  /* Note what this one is and is not. The old shelf had exactly one scroller
     too, so this does not prove the fix — it is the guard that stops a second
     one appearing later. The check below is the one that tells the two
     apart. */
  check(
    `${tag}: one place in the shelf the wheel does anything`,
    wheels.length === 1,
    wheels.length ? wheels.join("  |  ") : "nothing scrolls at all",
  );

  const moved = await page.evaluate(async () => {
    const shelf = document.querySelector("[data-shelf]") ?? document.querySelector("[data-drawer] .overflow-y-auto");
    const planet = document.querySelector('[data-category="hero"]');
    if (!shelf) return { why: "no scroller in the shelf at all" };
    if (!planet) return { why: "the planets are not on the shelf once a category is open" };
    shelf.scrollTop = 0;
    await new Promise((r) => requestAnimationFrame(r));
    const top = planet.getBoundingClientRect().top;
    shelf.scrollTop = 120;
    await new Promise((r) => requestAnimationFrame(r));
    return { top: Math.round(top), after: Math.round(planet.getBoundingClientRect().top) };
  });
  check(
    `${tag}: scrolling it moves the planets too, not only the cards`,
    !moved.why && Math.abs(moved.after - moved.top) > 60,
    moved.why ?? `a planet sat at ${moved.top} and moved to ${moved.after}`,
  );

  const box = await page.evaluate(() => {
    const d = document.querySelector("[data-drawer]").getBoundingClientRect();
    return { x: d.x, y: d.y, width: d.width, height: d.height };
  });
  await page.screenshot({ path: `.screenshots/shelf-${tag}.png`, clip: box });
  console.log(`       .screenshots/shelf-${tag}.png`);
  await page.close();
}

await look(2560, 1440, "1440p");
await look(1282, 917, "pane");

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
