/**
 * SWITCHING SITES MUST NOT CARRY ONE SITE'S WORK ONTO ANOTHER.
 *
 * HIS WORDS: "swtiching between sites my stuff disappears and they start
 * becoming the same thing oddly, try making something and switching to a new
 * site and back and through others and see what happens".
 *
 * WHAT WAS HAPPENING, measured before anything was changed. Three sites, one
 * part made on each, and the third site's slot came back reading
 * `waypoint,split-screen` when `split-screen` was the only part ever made on
 * it. Nothing was destroyed in any run at any speed — every part ever made
 * was still in some slot — so the fault was work carried FORWARD onto a site
 * it did not belong to, not work deleted.
 *
 * WHY. Switching wrote the target's document into the live key and called
 * `persist.rehydrate()`. Zustand only runs `merge` when there IS persisted
 * state, so rehydrating a site that has nothing saved does nothing at all
 * and the store keeps the last site's document. An empty slot cannot
 * overwrite a full store. The board then showed the previous site's work,
 * and the first edit wrote it out under the new site's name.
 *
 * The order below is the order of the guarantee, and the second check is the
 * one that matters most: a site's slot is only ever written with its own
 * document, and a blank site stays blank on disk as well as on screen.
 *
 * ONE THING TO KNOW ABOUT WHERE IT CATCHES. The switcher only appears once
 * there are two sites, so the SECOND site has to be made from the Builds
 * page — a navigation, which hydrates from storage and so comes up clean
 * even on the old code. The THIRD is made from the in-page button with no
 * reload, which is the path that was broken and the one his hand takes. So
 * against the old behaviour the early checks pass and four fail from the
 * third site onward, the first of them reading "2 parts drawn" on a site
 * that had never been touched. Measured: 11/15 before, 15/15 after.
 *
 *   node tests/site-switch.mjs [url]
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The full browser, not the headless shell: this environment ships one and
   not the other, and the shell is what `headless: true` reaches for. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/** What is on the board, and what every site has on disk, by part name. */
const state = () => page.evaluate(() => {
  const at = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v?.state ?? v; } catch { return null; } };
  const builds = at("builder.builds");
  const slots = {};
  for (const pr of builds?.projects ?? []) {
    const doc = at(`builder.doc:${pr.id}`);
    slots[pr.name] = doc === null ? null : (doc?.nodes ?? []).map((n) => n.featureId);
  }
  const live = at("builder.studio");
  return {
    open: builds?.projects?.find((x) => x.id === builds.activeId)?.name ?? null,
    live: live === null ? null : (live?.nodes ?? []).map((n) => n.featureId),
    slots,
  };
});

/*
 * What is DRAWN, which is not the same question as what is stored.
 *
 * The fault left the document in memory and took the live key away, so a
 * check that reads local storage sees an empty site and calls it empty while
 * the last site's parts are still on screen. That is exactly the shape of
 * "a fix that merely hides it", so the board is read from the board.
 */
const onBoard = () => page.$$eval("[data-node-id]", (els) => els.map((e) => e.getAttribute("data-node-id")));

const addPart = async (nth) => {
  await page.click('[data-category="structure"]', { force: true });
  await page.waitForTimeout(600);
  await page.locator("[data-tile]").nth(nth).click({ force: true });
  await page.waitForTimeout(600);
  await page.click('[data-category="structure"]', { force: true });
  await page.waitForTimeout(300);
};
const switchTo = async (name) => {
  await page.click("[data-builds-switch]", { force: true });
  await page.waitForTimeout(350);
  await page.locator(`button:has(span.truncate:text-is("${name}"))`).last().click({ force: true });
  await page.waitForTimeout(1200);
};

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

/* ------------------------------------------------------------------ */
/* 1. A part on the first site                                         */
/* ------------------------------------------------------------------ */

await addPart(0);
const one = await state();
const made = one.live?.[0];
check("a part is made on the first site", one.live?.length === 1, made);

/* ------------------------------------------------------------------ */
/* 2. A new, empty site                                                */
/* ------------------------------------------------------------------ */

await page.click("[data-builds-switch]", { force: true }).catch(() => {});
await page.waitForTimeout(400);
if (await page.locator('button:has-text("New site")').count()) {
  await page.locator('button:has-text("New site")').first().click({ force: true });
} else {
  await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("New")').first().click({ force: true });
  await page.waitForTimeout(900);
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
}
await page.waitForTimeout(1200);
const two = await state();

/* THE ONE THAT FAILED BEFORE. The board carried `made` across. */
const drawnTwo = await onBoard();
check("the empty site is empty on the board", drawnTwo.length === 0, `${drawnTwo.length} parts drawn`);
check("…and nothing of the first site is in memory either", (two.live ?? []).length === 0 && !(two.live ?? []).includes(made));

/* THE ONE THAT MATTERS MOST: nothing was written into its slot either. A
   fix that only blanked the board would still be carrying the document. */
const slotTwo = two.slots[two.open];
check("nothing has been written into the empty site's slot",
  slotTwo === null || slotTwo.length === 0, `slot holds ${JSON.stringify(slotTwo)}`);
check("…and in particular not the first site's part",
  !(slotTwo ?? []).includes(made), `slot holds ${JSON.stringify(slotTwo)}`);

/* And the site being left kept its own, which is the other half of never
   writing one site's work into another's slot. */
check("the first site still has its part on disk", (two.slots["First site"] ?? []).join() === made, JSON.stringify(two.slots["First site"]));

/* ------------------------------------------------------------------ */
/* 3. Back again                                                       */
/* ------------------------------------------------------------------ */

await switchTo("First site");
const back = await state();
const drawnBack = await onBoard();
check("switching back opens the first site", back.open === "First site");
check("…and draws its part, without a reload", drawnBack.length === 1, `${drawnBack.length} parts drawn`);
check("…and its part is still there", (back.live ?? []).join() === made, JSON.stringify(back.live));
check("…and the empty site is still empty on disk",
  (back.slots[two.open] ?? []).length === 0, JSON.stringify(back.slots[two.open]));

/* ------------------------------------------------------------------ */
/* 4. Three sites, which is where he first saw it                      */
/* ------------------------------------------------------------------ */

await switchTo(two.open);
await addPart(3);
const second = (await state()).live?.[0];
await page.click("[data-builds-switch]", { force: true });
await page.waitForTimeout(400);
await page.locator('button:has-text("New site")').first().click({ force: true });
await page.waitForTimeout(1600);
const three = await state();
const drawnThree = await onBoard();
check("a third site is empty too, with two sites behind it", drawnThree.length === 0, `${drawnThree.length} parts drawn`);
check("…carrying neither of the parts already made",
  !(three.live ?? []).includes(made) && !(three.live ?? []).includes(second));

await addPart(6);
const third = await state();
check("a part made on the third site is the only part on it", (third.live ?? []).length === 1, JSON.stringify(third.live));

await switchTo("First site");
const end = await state();
check("every site ends holding exactly its own work",
  (end.slots["First site"] ?? []).join() === made
  && (end.slots[two.open] ?? []).join() === second
  && (end.slots[three.open] ?? []).length === 1,
  JSON.stringify(end.slots));

/* Nothing was lost anywhere along the way, which is the reassurance his
   first symptom asked for. */
const every = Object.values(end.slots).flatMap((v) => v ?? []);
check("and no part made in this run went missing", every.length === 3, JSON.stringify(every));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(bad ? `\n${bad} failed — ${results.length - bad}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(bad ? 1 : 0);
