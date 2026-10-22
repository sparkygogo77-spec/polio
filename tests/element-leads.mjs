/**
 * The Element tab leads with elements.
 *
 * Press the page and the tab named Element had one sentence in it, about the
 * page's fill, and a button offering to send you to a different panel. The
 * ruling that put the fill in Looks stands; what was wrong is that the
 * signpost was the whole panel, so a tab named for a thing said nothing
 * about that thing and read as empty.
 *
 * So it leads with the elements on this page, each row a press away from its
 * own editor, and the signpost is a line at the foot with its button still
 * on it.
 *
 *   node tests/element-leads.mjs [url]
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* none */ } }); /* the shelf starts folded since 2026-10-05; this test works in the open one */
await page.route("**/api/studio/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);

/* Pick the page itself, the way a person does: a right press on bare frame,
   then away with the wheel it opens.
   The spot is found rather than guessed, because a press that lands on a
   part picks the part and every check below would then be reading the wrong
   panel and passing for the wrong reason. */
const bareSpot = () => page.evaluate(() => {
  const f = document.querySelector("[data-frame]");
  if (!f) return null;
  const r = f.getBoundingClientRect();
  for (let fy = 0.94; fy > 0.2; fy -= 0.06) {
    for (const fx of [0.5, 0.06, 0.94, 0.25, 0.75]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (document.elementFromPoint(x, y) === f) return { x, y };
    }
  }
  return null;
});

/* Re-found every time, because placing a part covers wherever it lands and a
   press that hits a part picks the part: every check below would then be
   reading a different panel and passing for the wrong reason. */
const pickThePage = async () => {
  const spot = await bareSpot();
  if (!spot) return false;
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return true;
};
check("there is a bare patch of page to press on", await pickThePage());

/* The side panel's tabs are on screen with the body folded away until one is
   pressed, so the tab is opened rather than assumed. */
await page.locator('[aria-label="Side panel"] button', { hasText: /^Element$/ }).first().click({ force: true });
await page.waitForTimeout(600);

const panel = page.locator("[data-page-picked]");
check("picking the page fills the Element tab rather than emptying it", (await panel.count()) === 1);

/* ------------------------------------------------------------------ */
/* 1. An empty page says the true thing about elements                 */
/* ------------------------------------------------------------------ */

check(
  "with nothing placed, it says so in words about elements rather than about the page's look",
  /element|nothing on this page/i.test(await panel.innerText()),
  (await panel.innerText()).split("\n").filter(Boolean).slice(0, 3).join(" | "),
);
check("and it does not send you to Looks to find out what to do", !/open looks/i.test((await panel.innerText()).split("\n")[1] ?? ""));

/* ------------------------------------------------------------------ */
/* 2. With parts on it, the roll is what leads                         */
/* ------------------------------------------------------------------ */

/* Two parts, placed the way a person places them: category, sub-group, card. */
const place = async () => {
  /* Opened once: a second press on an open category closes it. */
  if (!(await page.locator('[data-category-open="structure"]').count())) {
    await page.locator("[data-drawer] button", { hasText: "Layout" }).first().click({ force: true });
    await page.waitForTimeout(400);
  }
  /* A sub-group whose parts leave page either side of them: Add to page
     scrolls the board to what it placed, and two full-width sections fill
     the whole view with no bare page left to press. Pressed once; a second
     press on a chip lets it go. */
  const chip = page.locator("[data-drawer] button", { hasText: "Grids of cards" }).first();
  if ((await chip.getAttribute("aria-pressed")) !== "true") {
    await chip.click({ force: true });
    await page.waitForTimeout(400);
  }
  await page.locator("[data-shelf] [data-ctx='studio-palette']").first().click({ force: true });
  await page.waitForTimeout(500);
  /* A press on a card opens its detail card; Add to page is what places it (ShelfCards.tsx). */
  await page.locator("[data-part-detail] [data-add-to-page]").first().click({ force: true });
  await page.waitForTimeout(700);
};
await place();
await place();
check("two parts are on the board", (await page.locator("[data-node-id]").count()) >= 2, `${await page.locator("[data-node-id]").count()} node(s)`);

/* Back to the page itself: placing a part picks it. */
check("there is still bare page to press on with parts down", await pickThePage());

const rows = page.locator("[data-page-picked] [data-element-row]");
const n = await rows.count();
check("it leads with the elements on this page", n >= 2, `${n} row(s)`);
check("the count is said in the heading", /\d+ elements? on this page/i.test(await page.locator("[data-page-picked]").innerText()));

/* ------------------------------------------------------------------ */
/* 3. The signpost survives, folded to a line at the foot              */
/* ------------------------------------------------------------------ */

check("the way to the fill and the textures is still here", (await page.locator("[data-page-picked] [data-to-looks]").count()) === 1);
const atFoot = await page.evaluate(() => {
  const p = document.querySelector("[data-page-picked]");
  const b = p?.querySelector("[data-to-looks]");
  if (!p || !b) return null;
  const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
  return br.top - pr.top > pr.height / 2;
});
check("and it is at the foot rather than being the panel", atFoot === true);

/* ------------------------------------------------------------------ */
/* 4. A row is a way in, not a second screen                           */
/* ------------------------------------------------------------------ */

/* Guarded: with no roll there is nothing to press, and a red run should say
   that rather than hang on a locator that will never arrive. */
if (n > 0) {
  await rows.first().click({ force: true });
  await page.waitForTimeout(600);
  check("pressing a row picks that part", (await page.locator("[data-page-picked]").count()) === 0);
  /* The prompt is folded by design in the part panel: open its section first. */
  { const more = page.locator('[data-part-section="more"]:not([data-open]) > [data-section-head]'); if (await more.count()) { await more.first().click(); await new Promise((r) => setTimeout(r, 300)); } } /* Name, prompt, saving and Make a picture sit under More. */
  const promptHead = page.locator('[data-part-section="prompt"]:not([data-open]) [data-section-head]');
  if (await promptHead.count()) { await promptHead.first().click(); await page.waitForTimeout(300); }
  check("and the tab is now that part's own editor", (await page.locator('[aria-label="Element prompt"]').count()) >= 1);
} else {
  check("pressing a row picks that part", false, "no rows to press");
  check("and the tab is now that part's own editor", false, "no rows to press");
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
