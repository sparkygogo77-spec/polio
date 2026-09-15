/**
 * Re-iterate, pressed from where a person is actually standing.
 *
 * Every finished card carries a Re-iterate key: turn the page, change the
 * words, press it, and the book runs the card's ask again with those words.
 * The book answers a `studio:ask` event, and only the book under the
 * timeline does; but the detail band opens on "This update", not on the
 * book, so from the default tab the first press fired the event before the
 * book was on screen to hear it. The tab switched, the ask and the edited
 * words were dropped, and nothing said so. It worked only if the book was
 * already open, which is the one time nobody needs the key.
 *
 * The model call is intercepted rather than made: a real one spends money,
 * and what matters here is that a request left at all, once, with the words.
 *
 *   node tests/reiterate.mjs [url]
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

/* The asks that leave, as the route would have seen them. */
const asks = [];
await page.route("**/api/studio/generate", async (r) => {
  asks.push(JSON.parse(r.request().postData() ?? "{}"));
  await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, text: "Ran again." }) });
});
// The server says it has a key, so the no-key path (which opens the vault
// over the board once a run is over) stays out of the way of the second press.
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, set: { ANTHROPIC_API_KEY: true } }) }));
// The camera is not the subject; answer it at once so the ask is not held up.
await page.route("**/api/studio/screenshot**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-browser" }) }));

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  const raw = { state: { threads: [
    { id: "t1", parentId: null, at: Date.now() - 40000, mode: "plan", ask: "A section-by-section build plan.", answer: "three pages seen", changes: ["3 pages seen"], state: "done" },
  ], liveThreadId: "t1", openThreadId: null, currentThreadId: null }, version: 0 };
  localStorage.setItem("builder.studio", JSON.stringify(raw));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1200);

check("the detail band opens on this update, not on the book", (await page.locator("[data-iteration-book]").count()) === 0);

await page.locator('[data-box="t1"]').click({ force: true });
await page.waitForTimeout(600);
check("the card opens with its Re-iterate key on it", (await page.locator('[data-reiterate="t1"]').count()) === 1);

/* Turn the page, say what to do differently. */
await page.locator("[data-asked-page]").click();
await page.waitForTimeout(200);
const WORDS = "A section-by-section build plan, and make the hero louder.";
await page.locator("[data-asked-edit]").fill(WORDS);
await page.waitForTimeout(150);

/* The first press, from the default tab: this is the one that was dropped. */
await page.locator('[data-reiterate="t1"]').click();
await page.waitForTimeout(2500);

check("the first press opens the book", (await page.locator("[data-iteration-book]").count()) === 1);
const held = await page.locator("[data-iteration-book] textarea").evaluateAll((els) => els.map((e) => e.value));
check("and the book holds the edited words", held.includes(WORDS), JSON.stringify(held));
check("and one ask left, from the first press", asks.length === 1, `${asks.length} asks`);
check("with the edited words in it", asks.length === 1 && JSON.stringify(asks[0]).includes(WORDS));
check("in the mode the card was made in", asks[0]?.mode === "plan", String(asks[0]?.mode));

/* The second press, now that the book is open: still exactly one more, not two. */
if ((await page.locator('[data-reiterate="t1"]').count()) === 0) {
  await page.locator('[data-box="t1"]').click({ force: true });
  await page.waitForTimeout(600);
  await page.locator("[data-asked-page]").click();
  await page.locator("[data-asked-edit]").fill(WORDS);
}
await page.locator('[data-reiterate="t1"]').click();
await page.waitForTimeout(2500);
check("a press with the book already open runs it once more, not twice", asks.length === 2, `${asks.length} asks`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
