/**
 * Two things he asked for the removal of, checked where he sees them.
 *
 *   "remove notifications tab and panel its buggy and useless as well as
 *    compact feature it does 0"
 *
 * THE NOTIFICATIONS. A bell in the top right with an unread count, opening a
 * slide-over of everything ever published, with read, pinned and dismissed
 * state behind it. Gone: the bell, the panel, the shortcut that opened it and
 * the feed the panel was drawing. What is kept is the toast — the line that
 * says what just happened and then stops existing — because that is a
 * different surface and every confirmation in the app goes through it.
 *
 * THE DENSITY. Compact against comfortable. Its whole effect was the body's
 * font size, 13px against 14px, and the `compact:` variant it declared was
 * used by no class in the app. Gone: the setting, the command, the shortcut,
 * the menu row, and the `data-density` attribute on the document.
 *
 * Absence checks, so they are written to be run against an old build too:
 * every one of them is red on a deploy from before this pass.
 *
 *   node tests/gone.mjs [url]
 */
const req = (await import("node:module")).createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
await page.goto(URL_, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

/* ------------------------------------------------------------------ */
/* The notifications                                                    */
/* ------------------------------------------------------------------ */

const labelled = (name) => page.locator(`[aria-label="${name}"]`).count();
check("no bell in the top bar", (await labelled("News")) === 0, `${await labelled("News")} controls labelled News`);
check("and nothing else offers a news feed", (await page.getByRole("button", { name: /news|notification/i }).count()) === 0);

/* The unread badge was the bell's own child and nothing else wore that
   animation; a stray one means the bell is still being drawn somewhere. */
check("no unread count", (await page.locator(".animate-ping-dot").count()) === 0);

/* The shortcut, pressed on the page rather than read off a list: a panel
   that opens to nothing is still a panel. */
const panels = () => page.locator('[role="dialog"]').count();
const beforeKey = await panels();
await page.keyboard.press("Control+i");
await page.waitForTimeout(500);
check("its shortcut opens nothing", (await panels()) === beforeKey, `${beforeKey} → ${await panels()} dialogs`);
await page.keyboard.press("Escape");

/* ------------------------------------------------------------------ */
/* The density                                                          */
/* ------------------------------------------------------------------ */

check("the document carries no density", await page.evaluate(() => !document.documentElement.hasAttribute("data-density")),
  await page.evaluate(() => document.documentElement.getAttribute("data-density") ?? "none"));

await page.keyboard.press("Control+,");
await page.waitForTimeout(1200);
const settings = page.locator('[role="dialog"]').filter({ hasText: /Appearance/ }).first();
const openedSettings = (await settings.count()) > 0;
check("settings open", openedSettings);
if (openedSettings) {
  const text = await settings.innerText();
  check("and hold no Density row", !/\bDensity\b/.test(text), (text.match(/.*Density.*/) ?? ["none"])[0].slice(0, 80));
  check("and no Compact / Comfortable choice", !/Compact/.test(text) && !/Comfortable/.test(text));
}
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* The command palette is the other door to both of them. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(600);
const palette = page.locator('[role="dialog"]').last();
const paletteText = (await palette.count()) ? await palette.innerText() : "";
check("the command palette opens", paletteText.length > 0);
check("and offers neither the feed nor the density", !/news feed/i.test(paletteText) && !/toggle density/i.test(paletteText),
  (paletteText.match(/.*(news feed|toggle density).*/i) ?? ["neither"])[0].slice(0, 80));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* ------------------------------------------------------------------ */
/* What must NOT have gone with them                                    */
/* ------------------------------------------------------------------ */

/* The toast is the surviving half: publishing still says something. A
   setting change is the publish every build makes, so it is the one to
   exercise rather than a demo key that only the showcase has. On a clear
   page: a dialog over the bar would swallow the press and the finding
   would be about the dialog. */
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
/* The mute it used to press is gone too (TopBar: "There was a mute here"), so
   the press is Go live with no key held, which always says why in a toast.
   Go live is the open site's, so it is in the Builder's bar only. */
await page.goto(new URL("/builder", URL_).href, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const golive = page.locator("header [data-go-live]").first();
if (await golive.count()) {
  for (let i = 0; i < 40 && (await golive.getAttribute("data-go-live-state")) === "checking"; i++) await page.waitForTimeout(250);
  await golive.click({ force: true });
  await page.waitForTimeout(800);
  const toasts = await page.locator('[data-toaster] [role="status"]').count();
  check("a toast still says what happened", toasts > 0, `${toasts} on screen`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
} else {
  check("a toast still says what happened", false, "no Go live to press");
}

/* ------------------------------------------------------------------ */
/* And their storage                                                    */
/* ------------------------------------------------------------------ */

/* A removal that leaves its state in the person's browser is half a removal.
   Plant the two dead ids beside a live one and reload: the dead go, the live
   stays — which is also the guard on the migration, because a merge that
   drops the wrong thing wipes every setting somebody has chosen. */
const planted = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.settings") ?? '{"state":{"values":{}},"version":0}');
  raw.state = raw.state ?? { values: {} };
  raw.state.values = { ...(raw.state.values ?? {}), "appearance.density": "comfortable", "feed.maxItems": 500, "appearance.accentHue": 291 };
  localStorage.setItem("builder.settings", JSON.stringify(raw));
  return Object.keys(raw.state.values).length;
});
check("two dead settings planted in storage", planted >= 3, `${planted} values written`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
const left = await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.settings") ?? "{}");
  const v = raw?.state?.values ?? {};
  return { dead: ["appearance.density", "feed.maxItems", "feed.bumpOnUpdate"].filter((k) => k in v), hue: v["appearance.accentHue"], count: Object.keys(v).length };
});
check("a load clears them out of the browser", left.dead.length === 0, left.dead.length ? `still held: ${left.dead.join(", ")}` : `${left.count} values left`);
check("and keeps the settings that are still real", left.hue === 291, `accent hue ${left.hue}`);
check("and the document still carries no density after a reload", await page.evaluate(() => !document.documentElement.hasAttribute("data-density")),
  await page.evaluate(() => document.documentElement.getAttribute("data-density") ?? "none"));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
