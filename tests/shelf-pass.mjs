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
/** Copied, not imported: a test that reads the code's own number cannot catch it changing.
    One, not two, at the owner's word: "shouldnt be able to open two categories at once". */
const OPEN_AT_MOST = 1;

mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

async function look(w, h, tag) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  /* The shelf opens folded to its "+ Add" strip (J, 2026-10-05); this is about the open shelf. */
  await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* private window */ } });
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

  await press("structure");
  const one = await state();
  check(
    `${tag}: the way in does not vanish when a category opens`,
    one.ways.length === ways && one.ways.length > 5,
    `${ways} planets before, ${one.ways.length} after`,
  );
  check(`${tag}: pressing a planet opens that category`, one.open.length === 1 && one.open[0].id === "structure", JSON.stringify(one.open.map((o) => o.id)));
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
  check(`${tag}: a second category replaces the first rather than opening beside it`,
    two.open.length === OPEN_AT_MOST && two.open.some((o) => o.id === "content") && !two.open.some((o) => o.id === "structure"),
    JSON.stringify(two.open.map((o) => o.id)));

  await press("motion");
  const three = await state();
  check(
    `${tag}: a third never makes three`,
    three.open.length === OPEN_AT_MOST,
    `${three.open.length} open: ${JSON.stringify(three.open.map((o) => o.id))}`,
  );
  check(
    `${tag}: and the one standing open is the one just pressed`,
    three.open.length === OPEN_AT_MOST && three.open.every((o) => o.id === "motion"),
    JSON.stringify(three.open.map((o) => o.id)),
  );

  // Pressing an open one shuts it again.
  await press("motion");
  const back = await state();
  check(`${tag}: pressing an open category shuts it`, back.open.length === 0, JSON.stringify(back.open.map((o) => o.id)));

  /* One wheel, and it moves everything.
     With a category open the shelf holds several thousand pixels of
     cards. The complaint was that the elements scrolled inside their own box
     — a fixed header with a small scrolling area under it — so what is
     checked is the thing that made it feel that way: there is exactly one
     place in the shelf a wheel does anything, and turning it moves the
     planets too rather than only the cards.

     Previews are excluded by *why* they cannot be scrolled rather than by
     what they are: a part rendered inside a card can overflow its own clip
     box, but the whole preview is `pointer-events: none`, so no wheel ever
     reaches it. */
  await press("structure");
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
    const planet = document.querySelector('[data-category="structure"]');
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

/* ------------------------------------------------------------------ */
/* CARRYING A PART OUT OF THE SHELF                                    */
/* ------------------------------------------------------------------ */

/*
 * A tile is carried onto the board and let go where it is wanted. That had
 * worked for a long while and nothing asked for it, so it could have gone
 * at any time without a word — which is the whole reason this is here.
 *
 * AND THE ONE THING THAT COULD NOT BE CARRIED: the New idea disc. Every
 * tile could be dragged; this one could only be pressed, and a press puts a
 * part at the foot of whatever is already on the page. So the one part
 * whose point is that you are describing something new was the one part you
 * could not put anywhere in particular. MEASURED before the change, the
 * same drag moved nothing at all: 0 carried.
 *
 * WHERE IT LANDS is the half worth asking about. Carrying and pressing both
 * add a part, so a check that only counted parts would pass on a shelf
 * whose drag did nothing but fire the click. The drop is aimed low on the
 * page and what is asked is that the part is near it.
 *
 * On the instrument: this drives Chromium's own drag and drop through
 * Playwright's `dragTo`, which does carry the dataTransfer. A run where the
 * drag silently did nothing would read as 0 carried, not as a pass.
 */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  /* The shelf opens folded to its "+ Add" strip (J, 2026-10-05); this is about the open shelf. */
  await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* private window */ } });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-category]", { timeout: 20000 });
  await page.waitForTimeout(2000);
  const nodes = () => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []));
  const frame = page.locator("[data-frame]").first();
  const fb = await frame.boundingBox();

  /* The New idea disc first, while the shelf is at rest: opening a category
     puts the tiles where the discs were, and it is no longer on screen. */
  const idea = page.locator('[data-category="custom-idea"]').first();
  const was = (await nodes()).length;
  await idea.dragTo(frame, { targetPosition: { x: Math.round(fb.width * 0.3), y: Math.round(fb.height * 0.65) } });
  await page.waitForTimeout(1300);
  const afterIdea = await nodes();
  check("the New idea disc is carried onto the board like any other part",
    afterIdea.length === was + 1 && afterIdea[afterIdea.length - 1]?.featureId === "custom-idea",
    `${was} before, ${afterIdea.length} after, last is ${afterIdea[afterIdea.length - 1]?.featureId ?? "none"}`);

  /* Then a tile, which needs a category open. */
  await page.locator(`[data-category="structure"]`).first().click({ force: true });
  await page.waitForTimeout(1000);
  const tile = page.locator("[data-tile]").first();
  const id = await tile.getAttribute("data-tile");
  const was2 = (await nodes()).length;
  await tile.dragTo(frame, { targetPosition: { x: Math.round(fb.width * 0.5), y: Math.round(fb.height * 0.45) } });
  await page.waitForTimeout(1300);
  const afterTile = await nodes();
  check("and so is a tile, out of an opened category",
    afterTile.length === was2 + 1 && afterTile[afterTile.length - 1]?.featureId === id,
    `${id}: ${was2} before, ${afterTile.length} after, last is ${afterTile[afterTile.length - 1]?.featureId ?? "none"}`);

  /*
   * AND IT IS A CARRY, NOT A PRESS.
   *
   * Both add a part, so counting parts cannot tell them apart. The first
   * draft of this asked that the part land near where it was dropped, with
   * a third of the page's height as the tolerance — and a deliberate break
   * that turned the drop into a press SAILED THROUGH IT, because the foot
   * of a page holding one part is also near the middle. It measured
   * nothing and it is written out here so it is not written again.
   *
   * What separates the two is direction, not distance. The New idea was
   * dropped low, at 0.65 of the page; this tile is dropped ABOVE it, at
   * 0.45. A press stacks under whatever is already there, so a press can
   * only ever put this one BELOW the first. Above is something only a carry
   * can do.
   */
  const last = afterTile[afterTile.length - 1];
  const first = afterIdea[afterIdea.length - 1];
  check("and it is a carry rather than a press: it lands above the part dropped below it",
    !!last && !!first && last.y < first.y,
    last && first ? `dropped at 0.45 of the page against 0.65, landed at y ${last.y} against y ${first.y}` : "nothing landed");
  await page.evaluate(() => localStorage.removeItem("builder.studio"));
  await page.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
