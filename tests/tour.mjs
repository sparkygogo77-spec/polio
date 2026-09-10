/**
 * The tour: what it promises on every step.
 *
 * A tour is the one part of an app nobody uses twice, which is exactly why it
 * rots without something holding it to its shape. Four rules are worth
 * keeping, and all four are things a later session could break without
 * noticing:
 *
 *  - it opens from Builds and from the command palette;
 *  - a step lights at most four things, and each carries a name, a line and
 *    where it lives — the three facts that make it useful afterwards;
 *  - the way through is on screen the whole time: which step of how many,
 *    back, next and out;
 *  - the things it stages stay staged. The wheel closes on a press anywhere
 *    else, and the dialog closes on a press outside it, so a tour standing
 *    over either would take away the thing it is pointing at if it did not
 *    say it was running.
 *
 *   node tests/tour.mjs [url]           # default http://localhost:3000
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
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Two sites, so Builds and the swap have something to be about.
await context.addInitScript(() => {
  const doc = JSON.stringify({
    state: {
      pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
      nodes: [],
      activePageId: "p0",
    },
    version: 0,
  });
  localStorage.setItem("builder.studio", doc);
  localStorage.setItem("builder.doc:a", doc);
  localStorage.setItem("builder.doc:b", doc);
  localStorage.setItem("builder.builds", JSON.stringify({
    state: { activeId: "a", projects: [{ id: "a", name: "One", updatedAt: Date.now() }, { id: "b", name: "Two", updatedAt: Date.now() }] },
    version: 0,
  }));
});

const page = await context.newPage();
const tour = page.locator("[data-tour]");

/* 1. The two ways in. */
await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Take the tour" }).click();
await page.waitForTimeout(1500);
check("Builds offers the tour, and it opens", (await tour.count()) === 1);

await page.getByRole("button", { name: /Skip/ }).click();
await page.waitForTimeout(400);
check("Skip closes it", (await tour.count()) === 0);

await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
// "tour" alone also matches the tweet console's tour recording and a Builder
// setting, so the command is picked by name rather than by being first.
await page.keyboard.type("take the tour");
await page.waitForTimeout(600);
await page.locator("[cmdk-item]", { hasText: "Take the tour" }).first().click();
await page.waitForTimeout(1800);
check("the command palette opens it too", (await tour.count()) === 1);

/* 2. Every step, all the way through. */
const seen = [];
for (let i = 1; i <= 8; i++) {
  await page.waitForTimeout(1800);
  if (!(await tour.count())) break;
  const id = await tour.getAttribute("data-tour-step");
  if (!id) break;
  seen.push(id);

  const cards = page.locator("[data-tour-card]");
  const n = await cards.count();
  check(`${id}: lights at most four things`, n > 0 && n <= 4, `${n}`);

  const facts = await cards.evaluateAll((els) =>
    els.map((e) => {
      const lines = e.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
      // The number badge is its own line; a card needs a name, a line and a place after it.
      return lines.filter((l) => !/^\d$/.test(l)).length;
    }),
  );
  check(`${id}: every card says what, why and where`, facts.every((f) => f >= 3), facts.join(","));

  const lit = await page.locator("[data-tour] svg rect[stroke]").count();
  check(`${id}: something on the real screen is lit`, lit > 0, `${lit} holes`);

  const nav = await page.locator("[data-tour]").innerText();
  const hasCount = /Step \d+ of \d+/.test(nav);
  const hasBack = await page.locator("[data-tour]").getByRole("button", { name: /Back/ }).count();
  const hasOn = await page.locator("[data-tour]").getByRole("button", { name: /Next|Done/ }).count();
  const hasOut = await page.locator("[data-tour]").getByRole("button", { name: /Skip/ }).count();
  check(`${id}: the way through is on screen`, hasCount && !!hasBack && !!hasOn && !!hasOut,
    `${(nav.match(/Step \d+ of \d+/) ?? [""])[0]}`);

  const on = page.locator("[data-tour]").getByRole("button", { name: /^Next/ });
  if (!(await on.count())) break;
  await on.click();
}

check("it covers the wheel, Looks, the board, the Blueprint and Builds",
  ["wheel", "looks", "board", "blueprint", "builds"].every((s) => seen.includes(s)), seen.join(" › "));

/* 3. Back goes back. */
await page.locator("[data-tour]").getByRole("button", { name: /Back/ }).click();
await page.waitForTimeout(1800);
check("Back returns to the step before", (await tour.getAttribute("data-tour-step")) === seen[seen.length - 2], await tour.getAttribute("data-tour-step"));

/* 4. What it stages stays staged. */
await page.locator("[data-tour]").getByRole("button", { name: /Back/ }).click();
await page.waitForTimeout(1800);
await page.locator("[data-tour]").getByRole("button", { name: /Back/ }).click();
await page.waitForTimeout(1800);
await page.locator("[data-tour]").getByRole("button", { name: /Back/ }).click();
await page.waitForTimeout(2000);
check("Back all the way lands on the wheel again", (await tour.getAttribute("data-tour-step")) === "wheel");
check("the wheel it opened is up", (await page.locator("[data-radial]").count()) > 0);

// A press on the tour is a press outside the wheel, which is normally the
// end of the wheel. It must not be while the tour is pointing at it.
await page.mouse.click(1200, 700);
await page.waitForTimeout(600);
check("a press on the tour does not take the wheel away", (await page.locator("[data-radial]").count()) > 0);

/* 5. And out, leaving nothing behind. */
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
check("Escape ends the tour", (await tour.count()) === 0);
check("and puts the wheel away with it", (await page.locator("[data-radial]").count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
