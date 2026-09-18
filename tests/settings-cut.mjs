/**
 * The settings panel holds what dresses the Builder, and nothing else.
 *
 * His test, in his words: does a setting change the site he is building, or
 * only the Builder around it? The site's own dress belongs on the site side;
 * a module's own controls belong with that module; and a tab that leads
 * nowhere should not be a tab.
 *
 * Two of them read EMPTY on his live board, and the reason is worth keeping:
 * every option in those groups was marked advanced, and the tab strip listed
 * every group whether or not it had anything to show at the level being
 * looked at. So the tab existed, he pressed it, and it said "No options
 * match". That is the general fault, and the general fix is here: a group
 * with nothing to show is not offered.
 *
 *   node tests/settings-cut.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.keyboard.press("Control+Comma");
await page.waitForTimeout(900);
const drawer = page.locator('[data-panel="settings"], [role="dialog"]').filter({ has: page.locator('input[placeholder*="Search options"]') }).first();
check("the settings panel opens", (await drawer.count()) === 1);

/**
 * The sweep below runs with Advanced OFF, which is the panel as he finds it.
 *
 * The first draft turned Advanced on before looking and reported all thirteen
 * tabs healthy \u2014 because a group whose every option is advanced does have
 * something in it once you ask for the advanced ones. He was not asking for
 * them. The tab was there, he pressed it, and it said "No options match".
 */
const advSwitch = drawer.locator('label:has-text("Advanced") button[role="switch"]').first();
const setAdvanced = async (on) => {
  if (!(await advSwitch.count())) return;
  if (((await advSwitch.getAttribute("data-state")) === "checked") !== on) {
    await advSwitch.click({ force: true });
    await page.waitForTimeout(450);
  }
};
await setAdvanced(false);

const tabs = async () => drawer.locator(".hide-scrollbar button").allTextContents();
const named = await tabs();
console.log(`       tabs: ${named.join(" / ")}`);

/* ------------------------------------------------------------------ */
/* 1. No tab leads nowhere                                             */
/* ------------------------------------------------------------------ */

const dead = [];
for (const label of named) {
  if (label === "All") continue;
  await drawer.locator(".hide-scrollbar button", { hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).first().click({ force: true });
  await page.waitForTimeout(350);
  const empty = await drawer.getByText("No options match.").count();
  const rows = await drawer.locator("section").count();
  if (empty || rows === 0) dead.push(label);
}
check(
  "every tab in the settings panel leads somewhere",
  dead.length === 0,
  dead.length ? `${dead.length} lead nowhere: ${dead.join(", ")}` : `${named.length - 1} tabs, all with something in them`,
);

/* Back to All, advanced on, for the inventory: nothing is judged missing
   merely for being tucked away. */
await drawer.locator(".hide-scrollbar button", { hasText: /^All$/ }).first().click({ force: true });
await setAdvanced(true);
await page.waitForTimeout(400);
const labels = await drawer.locator("section [data-setting-label], section label, section .text-\\[11px\\]").allTextContents();
const all = (await drawer.innerText()).replace(/\s+/g, " ");

/* ------------------------------------------------------------------ */
/* 2. What he ruled out is out                                         */
/* ------------------------------------------------------------------ */

const CUT = [
  ["Sound", /\bSound\b/],
  ["Volume", /\bVolume\b/],
  ["Haptics", /\bHaptics\b/],
  ["Animate live numbers", /Animate live numbers/],
  ["the Developer tab", /\bDeveloper\b/],
  ["the Keys tab", /\bKeys\b/],
  ["the Showcase tab", /\bShowcase\b/],
];
const stillThere = CUT.filter(([, re]) => re.test(all)).map(([n]) => n);
check(
  "what he ruled out of the settings panel is out of it",
  stillThere.length === 0,
  stillThere.length ? `still there: ${stillThere.join(", ")}` : `all ${CUT.length} gone`,
);

/* ------------------------------------------------------------------ */
/* 3. The console's twelve are not in settings                         */
/* ------------------------------------------------------------------ */

const CONSOLE = ["Handle", "Display name", "Send does", "Confirm before sending now", "Retries", "Offer to split long drafts", "Number thread posts", "who can reply", "Alt text before sending", "Tour device", "Tour speed", "Tour works the parts"];
const leaked = CONSOLE.filter((c) => all.includes(c));
check(
  "the console's own twelve controls are not in the settings panel",
  leaked.length === 0,
  leaked.length ? `${leaked.length} still there: ${leaked.join(", ")}` : "none of the twelve",
);

/* ------------------------------------------------------------------ */
/* 4. What he ruled to keep is kept                                    */
/* ------------------------------------------------------------------ */

const KEEP = ["Theme", "Accent hue", "Motion", "Accent glow", "Flash on change", "Toasts", "Toast position", "Pause feeds on hover", "Optimistic actions", "Confirm destructive actions", "Drawing board keeps strokes", "Send screenshots to Claude"];
const missing = KEEP.filter((k) => !all.includes(k));
check(
  "and everything he ruled to keep is still there",
  missing.length === 0,
  missing.length ? `${missing.length} gone: ${missing.join(", ")}` : `all ${KEEP.length} present`,
);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
