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
  check("and it is the site you started from, not an invented ask", first?.mode === "start" && first?.changes?.[0] === "the site before the first change", `${first?.mode}: ${first?.changes?.[0]}`);
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
/* 1. What state it is in, and no dot to say it                        */
/* ------------------------------------------------------------------ */

/*
 * There was a small green or red circle on every card saying whether the
 * process behind it had finished. It is gone: a card still working is
 * visibly forming, one that was given up on hangs off a grey vine, and
 * "finished" was a mark on nearly every card nearly all of the time — two
 * green marks on a red card, neither of them about the element the card is
 * for. The state is still said, on the card itself, because the board and
 * this suite both ask it; there is just nothing drawn for it.
 */
const stateOf = (id) => page.locator(`[data-box="${id}"]`).first().getAttribute("data-state");

check("a finished iteration is marked done", (await stateOf("t1")) === "done" && (await stateOf("t2")) === "done");
check("one that was left running is marked abandoned when the store comes back", (await stateOf("t3")) === "cut", await stateOf("t3"));
check("one that gave up stays that way", (await stateOf("t4")) === "cut", await stateOf("t4"));
check("and there is no dot drawn for any of it", (await page.locator("[data-box] [data-state]").count()) === 0,
  String(await page.locator("[data-box] [data-state]").count()));

/* ------------------------------------------------------------------ */
/* 2. The flag                                                         */
/* ------------------------------------------------------------------ */

/*
 * It is in the box's own menu now, not on the box.
 *
 * It was a green square on every card — a second green mark on a red one,
 * about neither the element the card is for nor the update's own state. What
 * it does has not changed: it says which update the section below, the
 * prompt area in it and the next ask all follow, and it survives a reload,
 * because "where was I" is the question a timeline exists to answer. It is
 * where the rest of what can be done to an update lives.
 */
const flag = async (id) => {
  await page.locator(`[data-box="${id}"]`).first().click({ button: "right", force: true });
  await page.waitForTimeout(400);
  return page.locator(`[data-thread-menu] [data-current-for="${id}"]`).first();
};

check("no card carries the flag any more", (await page.locator("[data-box] [data-current-for]").count()) === 0);
{
  const it = await flag("t2");
  check("the box's own menu carries it instead", (await it.count()) === 1);
  check("and it is not on to begin with", (await it.getAttribute("data-current")) === "0");
  check("it says what it is", /work in this one/i.test(await it.innerText()), (await it.innerText()).trim());
  await it.click({ force: true });
}
await page.waitForTimeout(700);
check("pressing it marks that one", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.currentThreadId) === "t2");
check("the section below follows it", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("What contradicts"),
  (await page.locator("[data-pinned-prompt]").first().innerText()).slice(0, 60).replace(/\n/g, " "));
check("and the prompt area says the work is here", (await page.locator("[data-working-here]").count()) === 1);

(await flag("t1")).click({ force: true });
await page.waitForTimeout(700);
check("moving it moves it, rather than adding a second", await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("builder.studio")).state;
  return st.currentThreadId === "t1";
}));
check("the section follows it there too", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("build plan"));

/* It survives a reload, and so does what follows it. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);
// The Builder comes back on the board; the flag is about the timeline, so
// the timeline is opened again to look at it.
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);
check("the flag is still on it after a reload", (await (await flag("t1")).getAttribute("data-current")) === "1",
  await (await flag("t1")).getAttribute("data-current"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("and the section is still reading it", (await page.locator("[data-pinned-prompt]").first().innerText()).includes("build plan"));
check("it is written in the document, not in the page", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.currentThreadId) === "t1");

/* The next ask hangs off it rather than off whatever landed last. */
check("a new iteration hangs off the one being worked in", await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  return raw.state.currentThreadId === "t1" && raw.state.liveThreadId === "t4";
}), "current t1, live t4");

/* Choosing it again lets go. */
(await flag("t1")).click({ force: true });
await page.waitForTimeout(600);
check("choosing it again puts the flag down", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.currentThreadId) === null);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
