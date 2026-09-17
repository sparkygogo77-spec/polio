/**
 * Two timeline behaviours J asked for.
 *
 * 1. Clicking off a card closes it. The ground already did; the rest of the
 *    window — the bar, the shelf, the page behind — now does too. Not the
 *    card, not a box, not the panel with the card's own prompts, not a menu
 *    open over it.
 * 2. An element can be edited directly from its card: what it is called and
 *    what it is meant to be are written on the part from the card, and the
 *    same drawing can be put back on the queue with the new words.
 *
 *   node tests/timeline-card.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const tl = readFileSync("src/features/studio/Timeline.tsx", "utf8");

/* ------------------------------------------------------------------ */
/* 1. Static                                                           */
/* ------------------------------------------------------------------ */

check("a press anywhere off the card puts it away", /document\.addEventListener\("pointerdown", down, true\);/.test(tl) && /useStudio\.getState\(\)\.openThread\(null\);/.test(tl));
check("…but not on the card, a box, the card's panel or a menu over it", /\[data-box\], \[data-card\], \[data-timeline-panel\], \[data-side-panel-timeline\], \[data-thread-menu\], \[role="dialog"\], \[role="menu"\], \[data-radial\]/.test(tl));
check("…and the ground keeps telling a press from a pan, six pixels wide", /> 6 \|\| Math\.abs\(ev\.clientY - e\.clientY\) > 6\)\) \{\n        moved = true;/.test(tl));
check("the menu over a box is marked so a press on it keeps the card", /data-thread-menu=""/.test(tl));
check("an element card carries its own editor", /\{element && thread\.madeId \? <EditHere id=\{thread\.madeId\} skin=\{skin\} \/> : null\}/.test(tl));
check("…for what it is called and what it is meant to be, written on the part", /data-edit-label=""/.test(tl) && /data-edit-prompt=""/.test(tl) && /useStudio\.getState\(\)\.updateNode\(node\.id, \{ label: name, prompt \}\);/.test(tl));
check("…and the same drawing back on the queue with the new words, on the same part", /data-edit-again=""/.test(tl) && /nodeId: node\.id,\s*at: null,/.test(tl) && /const sketch = \{ \.\.\.node\.sketch, words: prompt\.trim\(\) \};/.test(tl));
check("typing in it never reaches the board's shortcuts", /onKeyDown=\{\(e\) => e\.stopPropagation\(\)\}/.test(tl));

/* ------------------------------------------------------------------ */
/* 2. Live                                                             */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // A chain prompt and, hanging off it, a drawing made real on a part that is still on the board.
  await page.evaluate(() => {
    /* A fresh browser has written nothing yet: the store merges a partial document over its defaults. */
    const doc = JSON.parse(localStorage.getItem("builder.studio") ?? '{"state":{},"version":0}');
    const st = doc.state;
    const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
    const strokes = [[[0.05, 0.95], [0.5, 0.1], [0.95, 0.95]]];
    const node = { id: "d1", pageId, featureId: "custom-idea", label: "a peak", prompt: "a peak", content: "", x: 200, y: 200, w: 200, h: 120, groupId: null, options: {}, priority: "must", custom: true, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: { strokes, words: "a peak" }, plan: null };
    st.nodes = [node];
    st.threads = [
      { id: "g0", at: 0, mode: "plan", state: "done", ask: "Lay out the home page", answer: "Done.", changes: ["changed the hero"], parentId: null },
      { id: "e1", at: 1, mode: "drawing", state: "done", ask: "a peak", answer: "drew a peak", changes: ["drew a peak at 200 × 120"], parentId: "g0", madeId: "d1", sketch: { strokes, words: "a peak" } },
    ];
    st.threadSpots = { "box:g0": { x: 80, y: 120 }, "box:e1": { x: 460, y: 320 } };
    st.openThreadId = null;
    localStorage.setItem("builder.studio", JSON.stringify(doc));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(1200);
  const openId = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.openThreadId);
  const nodeOf = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes[0]);

  await page.locator('[data-box="e1"]').click({ force: true });
  await page.waitForTimeout(500);
  check("a box press opens its card", (await openId()) === "e1", String(await openId()));

  // Off the card: the bar.
  const bar = await page.locator("header").first().boundingBox();
  await page.mouse.click(bar.x + bar.width * 0.42, bar.y + bar.height / 2);
  await page.waitForTimeout(400);
  check("a press on the bar — off the card, off the timeline — closes it", (await openId()) === null, String(await openId()));

  await page.locator('[data-box="e1"]').click({ force: true });
  await page.waitForTimeout(500);
  const card = await page.locator('[data-card="in"][data-card-of="e1"]').boundingBox();
  check("the card is back", !!card && (await openId()) === "e1");
  await page.mouse.click(card.x + 12, card.y + 12);
  await page.waitForTimeout(300);
  check("a press on the card keeps it", (await openId()) === "e1");

  // Edit it here.
  const editor = page.locator("[data-edit-here]");
  check("the element's card carries its editor", (await editor.count()) === 1);
  await page.locator("[data-edit-label]").fill("the summit");
  await page.locator("[data-edit-prompt]").fill("a mountain peak, drawn as one line");
  await page.locator("[data-edit-prompt]").blur();
  await page.waitForTimeout(400);
  const n = await nodeOf();
  check("what it is called is written on the part", n.label === "the summit", n.label);
  check("and what it is meant to be", n.prompt === "a mountain peak, drawn as one line", n.prompt);
  check("typing in it did not close the card", (await openId()) === "e1");
  // The queue is not written to storage, so it is read off the key that
  // carries it and off what the job does to the part when it runs: with no
  // reader the drawing's own proportion is applied and the words are kept.
  const unfinished = async () => Number(/Finish, (\d+) unfinished/.exec(await page.locator("[data-finish]").first().getAttribute("aria-label"))?.[1] ?? -1);
  const before = await unfinished();
  const parts = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length);
  await page.locator("[data-edit-again]").click();
  await page.waitForTimeout(150);
  const during = await unfinished();
  await page.waitForTimeout(2500);
  const after = await nodeOf();
  check("draw it again puts one more drawing on the queue", during === before + 1, `${before} → ${during}`);
  check("…on the same part, which is reshaped with the new words rather than a second part made",
    (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length)) === parts && after.id === "d1" && after.sketch?.words === "a mountain peak, drawn as one line",
    JSON.stringify({ parts: await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.length), words: after.sketch?.words }));
  await b.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed of ${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
