/**
 * The backend as a place you work, with the three things that were missing.
 *
 * MEASURED BEFORE, against J's five: a prompt box and an output existed, in
 * a dialog. A system box did not — `SYSTEM` was a constant in the route, so
 * the instructions the model works under were the one part of the call
 * nobody using the Builder could see. An effort setting did not — the route
 * decided it (`ideas ? medium : high`) and never asked. And there was no
 * conversation at all: every ask was one-shot, which is why "no, the other
 * one" had nowhere to go.
 *
 * The route half is checked directly rather than through the screen,
 * because what matters about it cannot be seen: that a system prompt from a
 * browser is ADDED to the house one and cannot replace it, and that an
 * effort nobody recognises falls back rather than being passed on.
 *
 *   node tests/backend-surface.mjs [url]
 */
import { readFileSync } from "node:fs";
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

/* ------------------------------------------------------------------ */
/* 1. The route: what a browser may and may not do to the call         */
/* ------------------------------------------------------------------ */

/* Comments stripped: the prose here explains what it replaced, and a raw
   scan would read its own explanation as the thing it is looking for. */
const route = readFileSync("src/app/api/studio/generate/route.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

check("the house system prompt is still sent on every call", /system: extra \? `\$\{SYSTEM\}/.test(route),
  "the browser's text is appended to it");
check("and a browser cannot send one INSTEAD of it",
  !/system: *\(?body\.system/.test(route) && !/system: *extra *,/.test(route));
check("the effort is whatever was asked for", /output_config: \{ effort \}/.test(route));
check("but only from a list the route owns",
  /EFFORTS\.includes\(/.test(route) && /"low", "medium", "high"/.test(route));
check("prior turns go with the ask", /\.\.\.turns\.map\(/.test(route));
check("and they are capped, because a browser can send anything",
  /slice\(-16\)/.test(route) && /60_000/.test(route));

/* ------------------------------------------------------------------ */
/* 2. The surface: the five, on screen                                 */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1700);

/* It lives in the Updates band, so Finish opens the mode that has it. */
await page.locator('[aria-label^="Finish"]').first().click({ force: true });
await page.waitForTimeout(1400);
const tabs = await page.locator("[data-timeline-detail] button").evaluateAll((els) =>
  els.map((e) => e.textContent?.trim()).filter(Boolean));
check("the Updates band has a backend tab", tabs.some((t) => /backend/i.test(t)), tabs.join(" · "));
check("and the two that were there are still there",
  tabs.some((t) => /update/i.test(t)) && tabs.some((t) => /iteration book/i.test(t)), tabs.join(" · "));

/*
 * If the tab is not there, say what is missing and stop — the run used to
 * throw on the first locator and take the rest of the list with it, which
 * is the least useful way for a suite to be right.
 */
const hasTab = tabs.some((t) => /backend/i.test(t));
if (!hasTab) {
  for (const n of ["a prompt box", "a place the answers land", "an effort setting",
    "a system box", "the system prompt is kept", "it is a conversation"])
    check(n, false, "this build has no backend tab");
  await browser.close();
  console.log("");
  const f = results.filter((r) => !r).length;
  console.log(`${results.length - f} of ${results.length} hold${f ? `, ${f} FAILED` : ""}`);
  process.exit(1);
}

await page.locator("[data-timeline-detail] button").filter({ hasText: /backend/i }).first().click({ force: true });
await page.waitForTimeout(700);

check("a prompt box", await page.locator("[data-backend-prompt]").count() === 1);
/*
 * And the whole of it is usable once you are at it.
 *
 * Not "on screen without scrolling" — the band sits under the timeline in
 * the same scroller on purpose, so you scroll down into it, which is the
 * arrangement that was asked for. What has to hold is that when you are
 * there, the surface is not still running off the bottom: at the strip's
 * height the transcript was 80px and the prompt box and Send key were below
 * the fold with nothing to scroll them into view, because the band had
 * already ended. It grows for this tab instead.
 */
await page.locator("[data-studio-pane]").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(500);
const fits = await page.evaluate(() => {
  const g = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
  const thread = g("[data-backend-thread]"), prompt = g("[data-backend-prompt]");
  return {
    promptOn: !!prompt && prompt.bottom <= window.innerHeight,
    thread: thread ? Math.round(thread.height) : 0,
    promptBottom: prompt ? Math.round(prompt.bottom) : 0,
    window: window.innerHeight,
  };
});
check("and scrolling down to the band shows the whole of it", fits.promptOn,
  `the prompt box ends at ${fits.promptBottom} in a ${fits.window}px window`);
check("and the transcript has room to be read", fits.thread > 160, `${fits.thread}px of it`);
check("a place the answers land", await page.locator("[data-backend-thread]").count() === 1);
check("an effort setting, with three settings on it",
  await page.locator("[data-backend-effort]").count() === 3,
  (await page.locator("[data-backend-effort]").evaluateAll((e) => e.map((x) => x.textContent?.trim()))).join(", "));
check("and one of them is chosen, so it is never ambiguous",
  await page.locator('[data-backend-effort][aria-pressed="true"]').count() === 1);

/* The system box is folded away, because it is the thing you set once. */
check("a system box, behind its own toggle", await page.locator("[data-backend-system-toggle]").count() === 1);
check("and folded away until asked for", await page.locator("[data-backend-system]").count() === 0);
await page.locator("[data-backend-system-toggle]").click({ force: true });
await page.waitForTimeout(400);
check("which opens it", await page.locator("[data-backend-system]").count() === 1);
const says = await page.locator("[data-backend]").innerText();
check("and it says the house instructions stay",
  /added to/i.test(says) && /so they stay/i.test(says),
  says.split("\n").find((l) => /added to/i.test(l)) ?? "-");

/* The system and the effort are settings: they survive the panel closing. */
await page.locator("[data-backend-system]").fill("Answer in one sentence.");
await page.locator('[data-backend-effort="low"]').click({ force: true });
await page.waitForTimeout(400);
await page.locator("[data-timeline-detail] button").filter({ hasText: /iteration book/i }).first().click({ force: true });
await page.waitForTimeout(500);
await page.locator("[data-timeline-detail] button").filter({ hasText: /backend/i }).first().click({ force: true });
await page.waitForTimeout(600);
const kept = await page.evaluate(() => ({
  system: localStorage.getItem("builder.backend.system"),
  effort: localStorage.getItem("builder.backend.effort"),
}));
check("the system prompt is kept, being a setting rather than a state",
  kept.system === "Answer in one sentence.", kept.system ?? "gone");
check("and so is the effort", kept.effort === "low", kept.effort ?? "gone");

/* ------------------------------------------------------------------ */
/* 3. It is a conversation, which is the half that did not exist       */
/* ------------------------------------------------------------------ */

/*
 * What is asserted is that what was said before goes WITH the next ask —
 * the whole difference between a conversation and seven one-shot modes.
 * The call is intercepted rather than made: a real one spends someone's
 * money, and what this needs to know is the shape of the request.
 */
await page.route("**/api/studio/generate", async (r) => {
  const body = JSON.parse(r.request().postData() ?? "{}");
  await r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, text: `saw ${(body.turns ?? []).length} turn(s), effort ${body.effort}, system ${JSON.stringify(body.system ?? null)}` }),
  });
});
/*
 * No `force` on this one, deliberately. Forcing a click skips the scroll
 * that brings a control into view, and that is exactly what went wrong the
 * first time: the band was 248px, the prompt box sat at y 1087 in a 1000px
 * window and the Send key at 1106, both below the fold, and a forced click
 * on an off-screen button quietly did nothing. An unforced click fails
 * loudly instead, which is what a check should do.
 */
const sendIt = async (what) => {
  await page.locator("[data-backend-prompt]").fill(what);
  await page.locator("[data-backend-send]").click();
  await page.waitForTimeout(900);
};
await sendIt("first thing");
const one = await page.locator("[data-backend-thread]").innerText();
check("the first ask carries no prior turns", /saw 0 turn/.test(one), one.split("\n").filter(Boolean).pop() ?? "-");
check("and carries the effort that is chosen", /effort low/.test(one));
check("and the system prompt that was typed", /Answer in one sentence/.test(one));
await sendIt("second thing");
const two = await page.locator("[data-backend-thread]").innerText();
check("the second ask carries the first, which is what makes it a conversation",
  /saw 2 turn\(s\)/.test(two), two.split("\n").filter(Boolean).pop() ?? "-");
check("and both sides of it are on screen",
  (await page.locator('[data-turn="user"]').count()) === 2 && (await page.locator('[data-turn="assistant"]').count()) === 2,
  `${await page.locator('[data-turn="user"]').count()} asked, ${await page.locator('[data-turn="assistant"]').count()} answered`);

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
