/**
 * The flag on a box, and the one thing a box says from across the room.
 *
 * Two small pieces of the timeline, and they answer the two questions a
 * person actually has when they come back to it: where was I, and did that
 * finish.
 *
 *   · **this iteration** is on the box itself, one per timeline, and
 *     pressing it moves it. The section below follows it, the prompt in
 *     that section says it is where the work is, the next ask hangs off it,
 *     and it is still there after a reload.
 *   · **red or green**, and nothing else. Red while the work behind an
 *     iteration is still going, and red if it was abandoned — which is the
 *     same thing once the tab has closed, so a thread left running is
 *     turned to abandoned when the store comes back. Green the moment it
 *     finished.
 *
 *   node tests/current.mjs [url]      # default http://localhost:3000
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

/* ------------------------------------------------------------------ */
/* 0. A fresh build, and the first thing anyone does                   */
/* ------------------------------------------------------------------ */

/*
 * Nothing used to seed the timeline. Threads were landed by an ask coming
 * back and by a drawing being made real, and by nothing else, so someone
 * who had laid out a whole board opened the timeline and found it empty,
 * which reads as broken rather than as "nothing has happened yet".
 */
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
const threadCount = () => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.threads ?? []).length);
check("a fresh build has no history, and inventing one would be a lie", (await threadCount()) === 0, String(await threadCount()));
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1400);
check("and the empty timeline says so plainly rather than looking broken",
  /nothing has happened yet/i.test(await page.locator("[data-timeline]").first().innerText()),
  (await page.locator("[data-timeline]").first().innerText()).replace(/\s+/g, " ").slice(0, 80));
check("it also says what will make the first one", /makes iteration one/i.test(await page.locator("[data-timeline]").first().innerText()));
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1100);

/* The first real action: drop a part. */
await page.locator('input[placeholder*="Search parts"]').first().fill("cube");
await page.waitForTimeout(800);
await page.getByText("Cube", { exact: true }).first().click({ force: true });
await page.waitForTimeout(1400);
check("the first thing you do makes iteration one", (await threadCount()) === 1, String(await threadCount()));
{
  const first = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.threads ?? [])[0]);
  check("and it is the board you started from, not an invented ask", first?.mode === "start" && first?.changes?.[0] === "the board as you started it", `${first?.mode}: ${first?.changes?.[0]}`);
  check("it is finished, because starting is not a process", (first?.state ?? "done") === "done");
  check("and it holds the document, so there is somewhere to stand", !!first?.doc);
}
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);
check("there is a box on the timeline at last", (await page.locator("[data-box]").count()) === 1, String(await page.locator("[data-box]").count()));
check("it says where it began", /where it began/i.test(await page.locator("[data-box]").first().innerText()));
/* A second action does not make a second beginning. */
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1000);
await page.locator('input[placeholder*="Search parts"]').first().fill("cube");
await page.waitForTimeout(700);
await page.getByText("Cube", { exact: true }).first().click({ force: true });
await page.waitForTimeout(1200);
check("the second thing you do does not make a second beginning", (await threadCount()) === 1, String(await threadCount()));

await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });

/* Four iterations, put straight into the document: this is about the
   timeline, not about how a thread gets there. */
const seed = (threads) => page.evaluate((list) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio") || "{}");
  raw.state = { ...(raw.state ?? {}), threads: list, liveThreadId: list[list.length - 1].id, openThreadId: null, currentThreadId: null };
  raw.version = raw.version ?? 0;
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, threads);

const THREADS = [
  { id: "t1", parentId: null, at: Date.now() - 40000, mode: "plan", ask: "A section-by-section build plan.", answer: "three pages seen", changes: ["3 pages seen"], state: "done" },
  { id: "t2", parentId: "t1", at: Date.now() - 30000, mode: "critique", ask: "What contradicts, what is missing.", answer: "two findings", changes: ["2 findings"], state: "done" },
  { id: "t3", parentId: "t2", at: Date.now() - 20000, mode: "drawing", ask: "a helix of sentences", answer: "an idea, drawn", changes: ["drew The helix at 320 x 320"], state: "running", sketch: { strokes: [[[0.2, 0.2], [0.8, 0.8]]], words: "a helix of sentences" } },
  { id: "t4", parentId: "t2", at: Date.now() - 10000, mode: "finish", ask: "What is left.", answer: "three findings", changes: ["3 findings"], state: "cut" },
];
await seed(THREADS);
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);

const boxes = page.locator("[data-box]");
check("every iteration stands on the timeline", (await boxes.count()) === 4, String(await boxes.count()));

/* ------------------------------------------------------------------ */
/* 1. Red and green                                                    */
/* ------------------------------------------------------------------ */

const stateOf = (id) => page.locator(`[data-box="${id}"] [data-state]`).first().getAttribute("data-state");
const colourOf = (id) => page.locator(`[data-box="${id}"] [data-state]`).first().evaluate((el) => getComputedStyle(el).backgroundColor);

check("a finished iteration is marked done", (await stateOf("t1")) === "done" && (await stateOf("t2")) === "done");
check("one that was left running is marked abandoned when the store comes back", (await stateOf("t3")) === "cut", await stateOf("t3"));
check("one that gave up stays that way", (await stateOf("t4")) === "cut", await stateOf("t4"));
{
  const green = await colourOf("t1");
  const red = await colourOf("t4");
  // Both are oklch; the third number is the hue, and green and red sit on
  // opposite sides of it. Nothing here cares about the exact shade.
  const hue = (c) => Number((c.match(/oklch\(([^)]+)\)/)?.[1] ?? "").trim().split(/\s+/)[2] ?? NaN);
  check("finished reads green", hue(green) > 120 && hue(green) < 180, green);
  check("unfinished reads red", hue(red) < 40 || hue(red) > 340, red);
  check("and they are the only two", new Set(await Promise.all(["t1", "t2", "t3", "t4"].map(colourOf))).size === 2,
    [...new Set(await Promise.all(["t1", "t2", "t3", "t4"].map(colourOf)))].join(" · "));
}
check("the mark is on the right of the box", await page.locator('[data-box="t1"] [data-state]').first().evaluate((el) => {
  const own = el.getBoundingClientRect();
  const box = el.closest("[data-box]").getBoundingClientRect();
  return own.right > box.left + box.width * 0.7;
}));

/* ------------------------------------------------------------------ */
/* 2. The flag                                                         */
/* ------------------------------------------------------------------ */

check("there is a this-iteration button on every box", (await page.locator("[data-current-for]").count()) === 4, String(await page.locator("[data-current-for]").count()));
check("and none of them is on to begin with", (await page.locator('[data-current="1"]').count()) === 0);
/* Where it says it, which is no longer across the box. It was a chip
   reading "this iteration", and that was the widest thing on the box, so it
   read as the heading and pushed the name of a part off the end — the
   reason is written at CurrentButton. It is a mark now, and the words are
   the tooltip a hover or a reader gets, so that is what is asked for. */
const flagSays = await page.locator('[data-current-for="t2"]').first().getAttribute("title");
check("it says what it is", /work in this update/i.test(flagSays ?? ""), flagSays ?? "no title");

await page.locator('[data-current-for="t2"]').first().click({ force: true });
await page.waitForTimeout(700);
check("pressing it marks that one", (await page.locator('[data-current="1"]').count()) === 1 && (await page.locator('[data-current-for="t2"]').first().getAttribute("data-current")) === "1");
check("one per timeline, never two", (await page.locator('[data-current="1"]').count()) === 1);
check("the section below follows it", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("What contradicts"),
  (await page.locator("[data-pinned-prompt]").first().innerText()).slice(0, 60).replace(/\n/g, " "));
check("and the prompt area says the work is here", (await page.locator("[data-working-here]").count()) === 1);

await page.locator('[data-current-for="t1"]').first().click({ force: true });
await page.waitForTimeout(700);
check("moving it moves it, rather than adding a second", (await page.locator('[data-current="1"]').count()) === 1 && (await page.locator('[data-current-for="t1"]').first().getAttribute("data-current")) === "1");
check("the section follows it there too", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("build plan"));

/* It survives a reload, and so does what follows it. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);
// The Builder comes back on the board; the flag is about the timeline, so
// the timeline is opened again to look at it.
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);
check("the flag is still on it after a reload", (await page.locator('[data-current-for="t1"]').first().getAttribute("data-current")) === "1",
  await page.locator('[data-current-for="t1"]').first().getAttribute("data-current"));
check("and the section is still reading it", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("build plan"));
check("it is written in the document, not in the page", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.currentThreadId) === "t1");

/* The next ask hangs off it rather than off whatever landed last. */
check("a new iteration hangs off the one being worked in", await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  return raw.state.currentThreadId === "t1" && raw.state.liveThreadId === "t4";
}), "current t1, live t4");

/* Pressing it again lets go. */
await page.locator('[data-current-for="t1"]').first().click({ force: true });
await page.waitForTimeout(600);
check("pressing it again puts the flag down", (await page.locator('[data-current="1"]').count()) === 0);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
