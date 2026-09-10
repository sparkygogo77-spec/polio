/**
 * A Claude call that does not come back must still say something.
 *
 * Reported from the live site: Critique, key held in the browser, no
 * screenshots — the spinner ran for over two minutes with no result, no
 * error and no console output, and the request stayed open with no status.
 * Nothing on the page was broken; nothing on the page was ever told. The
 * route waited on the API with no deadline of its own, the browser waited on
 * the route with no deadline of its own, and Stop was wired to the
 * photographs but not to the call, so there was no way out of it but a
 * reload.
 *
 * These drive the real dialog with the route answering as the failures
 * actually look: never, as a gateway's own error page, and as the route's
 * own "it took too long". Each one has to end with a sentence on screen.
 *
 *   node tests/generate-timeout.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });

/** A builder with one part on the board and the Blueprint dialog open. */
async function openBlueprint() {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("[data-drawer]").getByRole("button", { name: /^Navigation/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-ctx="studio-palette"]').first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForTimeout(600);
  // Words only, as reported: the photographs are a separate call and not
  // what hung.
  const shots = page.getByRole("switch", { name: /photograph|picture|screenshot/i }).first();
  if ((await shots.count()) && (await shots.getAttribute("aria-checked")) === "true") {
    await shots.click();
    await page.waitForTimeout(200);
  }
  // Critique, which is what was being asked for when this was reported. The
  // ask names the button: each mode's own verb is on it.
  const critique = page.getByRole("radio", { name: /Critique/i }).first();
  if (await critique.count()) await critique.click();
  else await page.locator("[role=dialog]").getByText(/^Critique$/).first().click();
  await page.waitForTimeout(300);
  return page;
}

const spinning = (page) => page.locator("[role=dialog]").getByText(/Claude is (working through the blueprint|writing the files)/).count();
const noteOn = async (page) => (await page.locator("[data-brief-note]").allTextContents()).join(" ").trim();

/* 1. The route answers, the reason is shown, and it is the route's own words. */
{
  const page = await openBlueprint();
  await page.route("**/api/studio/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, reason: "timeout", message: "Claude did not answer within 295s, so the server stopped waiting.", seconds: 295 }),
    }));
  await page.getByRole("button", { name: "Critique it" }).click();
  await page.waitForTimeout(1500);
  check("a timeout from the server reaches the dialog as a reason", /did not answer within/.test(await noteOn(page)), await noteOn(page));
  check("and the spinner stops with it", (await spinning(page)) === 0);
  await page.close();
}

/* 2. A gateway's own error page is not JSON. It still has to read as English. */
{
  const page = await openBlueprint();
  await page.route("**/api/studio/generate", (route) =>
    route.fulfill({ status: 504, contentType: "text/html", body: "<html><body>An error occurred with your deployment: FUNCTION_INVOCATION_TIMEOUT</body></html>" }));
  await page.getByRole("button", { name: "Critique it" }).click();
  await page.waitForTimeout(1500);
  const note = await noteOn(page);
  check("a gateway timeout reads as a timeout, not as broken JSON", /gave up on this/.test(note) && !/JSON|Unexpected token/i.test(note), note);
  check("and the status it answered with is named", /504/.test(note), note);
  await page.close();
}

/* 3. A request that never comes back: Stop has to end it. */
{
  const page = await openBlueprint();
  // Held open and never fulfilled — the live failure exactly.
  await page.route("**/api/studio/generate", () => { /* never answers */ });
  await page.getByRole("button", { name: "Critique it" }).click();
  await page.waitForTimeout(2000);
  check("a call that never comes back leaves the spinner up", (await spinning(page)) === 1);
  const stop = page.getByRole("button", { name: /^Stop/ }).first();
  check("and there is a Stop to press", (await stop.count()) === 1);
  if (await stop.count()) {
    await stop.click();
    await page.waitForTimeout(1200);
    check("Stop actually stops it", (await spinning(page)) === 0);
    /*
     * Not "the banner is empty": a missing key is said before the call is
     * made, on purpose, and it is still true after Stop — that is the reason
     * nothing would have come back anyway. What must not appear is a
     * *failure*: letting go of a request is not one.
     */
    const after = await noteOn(page);
    check("and stopping is not reported as a failure", !/failed|error|went wrong/i.test(after), after || "nothing said");
  }
  await page.close();
}

/* 4. What the API said, when it said something, is passed on rather than swallowed. */
{
  const page = await openBlueprint();
  await page.route("**/api/studio/generate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, reason: "api", message: "Claude API error 529: overloaded_error (request req_011CAbc)", status: 529, requestId: "req_011CAbc" }),
    }));
  await page.getByRole("button", { name: "Critique it" }).click();
  await page.waitForTimeout(1500);
  const note = await noteOn(page);
  check("an API error arrives with its status and request id", /529/.test(note) && /req_011CAbc/.test(note), note);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
