/**
 * An odd or ambiguous drawing gets one question before anything is spent.
 *
 * The first paid call on a drawing is the read. A drawing that could be two
 * things used to be guessed at there; now the strokes are looked at for
 * free first (`oddness.ts`), and when they are plainly ambiguous the job
 * stops as `asking`, the question is put where the counter is, and the
 * answer goes back in as words beside the drawing. Nothing is spent until
 * the person has answered or waved it on.
 *
 *   node tests/oddness.mjs
 */
import { readFileSync } from "node:fs";
import { oddness, stillAsks, withAnswer, ANSWER_WORDS } from "../src/features/studio/oddness.ts";
import { pendingJobs, askingJob, nextJob, typedSince } from "../src/features/studio/queue.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const box = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]];
const ring = Array.from({ length: 48 }, (_, i) => [0.5 + Math.cos((i / 48) * Math.PI * 2) * 0.4, 0.5 + Math.sin((i / 48) * Math.PI * 2) * 0.4]).concat([[0.9, 0.5]]);
const scribble = [[0.1, 0.2], [0.3, 0.8], [0.5, 0.1], [0.7, 0.9], [0.9, 0.3]];
const diagonal = [[0.05, 0.95], [0.95, 0.05]];
const wiggle = [[0.1, 0.5], [0.3, 0.2], [0.5, 0.8], [0.7, 0.3], [0.9, 0.6]];

/* ------------------------------------------------------------------ */
/* 1. What is asked, and what is not                                   */
/* ------------------------------------------------------------------ */

/*
 * A box with nothing said beside it used to be asked whether it was a
 * cube. It is not asked any more: the catalogue claims a box on its own
 * off its four corners (`isBox`), so the question would be about a thing
 * already decided.
 */
check("a box with nothing said beside it is not asked: it is a box, and a box is a cube", oddness({ strokes: [box], words: "" }) === null);
check("a box already called a cube is not asked", oddness({ strokes: [box], words: "cube" }) === null);
check("a box drawn on a part whose prompt says cube is not asked", oddness({ strokes: [box], words: "" }, "a cube of photos") === null);
/*
 * …and neither is a box described as anything else. A drawing with words
 * beside it has been described, whatever the strokes look like, and asking
 * is asking a person to repeat themselves.
 */
check("a box captioned as something else is not asked either", oddness({ strokes: [box], words: "a chunk of rock, in 3d, turnable" }) === null);
check("…nor one captioned on the part it was drawn on", oddness({ strokes: [box], words: "" }, "the pricing table") === null);
check("a scribble with nothing typed is asked what it is meant to be", oddness({ strokes: [scribble, wiggle], words: "" })?.why === "kind");
check("…with the kinds the route draws differently as the answers", (() => {
  const q = oddness({ strokes: [scribble, wiggle], words: "" });
  return !!q && q.choices.join() === "An icon,A picture,A surface,Just a mark";
})());
check("one curved stroke alone is asked too", oddness({ strokes: [wiggle], words: "" })?.why === "kind");
check("a scribble with words beside it is not: it has been described", oddness({ strokes: [scribble, wiggle], words: "a bird" }) === null);
check("a single straight line is a line, not a question", oddness({ strokes: [diagonal], words: "" }) === null);
check("a ring is a surface the pen already named", oddness({ strokes: [ring], words: "" }) === null, JSON.stringify(oddness({ strokes: [ring], words: "" })));
check("nothing drawn is nothing asked", oddness({ strokes: [], words: "" }) === null);
check("a box with a scribble in it is asked one question, about the cube, with two answers", (() => {
  // The old form here accepted null or any string, which every path yields (inventory D16).
  const q = oddness({ strokes: [box, scribble], words: "" });
  return !!q && q.why === "cube" && q.ask === "Is this box a cube?" && q.choices.length === 2;
})(), JSON.stringify(oddness({ strokes: [box, scribble], words: "" })));

/* ------------------------------------------------------------------ */
/* 2. The answer goes in as words                                       */
/* ------------------------------------------------------------------ */

check("\"A cube\" becomes the word the catalogue claims a box by", withAnswer({ strokes: [box], words: "" }, "A cube").words === "cube");
check("\"An icon\" becomes the word a role is read from", withAnswer({ strokes: [scribble], words: "" }, "An icon").words === "icon");
check("…beside what was already said, not instead of it", withAnswer({ strokes: [scribble], words: "a bird" }, "A picture").words === "a bird picture");
check("\"Just a mark\" and \"A flat box\" say nothing new", withAnswer({ strokes: [box], words: "x" }, "A flat box").words === "x" && withAnswer({ strokes: [box], words: "x" }, "Just a mark").words === "x");
check("a blank answer is the person waving it on", withAnswer({ strokes: [box], words: "x" }, "").words === "x");
check("every choice offered has a meaning", (() => {
  const all = [...["A cube", "A flat box"], ...oddness({ strokes: [scribble, wiggle], words: "" }).choices];
  return all.every((c) => c in ANSWER_WORDS);
})());
check("once answered, the box is claimed by the catalogue and asked nothing more", oddness(withAnswer({ strokes: [box], words: "" }, "A cube")) === null);

/* ------------------------------------------------------------------ */
/* 2b. The words always win, whenever they arrive                       */
/* ------------------------------------------------------------------ */

/*
 * A question and its answer are about the drawing as it stood when it was
 * asked. A person can describe it afterwards — while the question is still
 * up, or after answering it — by typing on the part it was drawn on. Then
 * what is left is an answer attached to a drawing that no longer matches
 * it, so the question is asked again of what is true now.
 */
const bareBox = { strokes: [box], words: "" };
const bareMark = { strokes: [scribble, wiggle], words: "" };
const kindQ = oddness(bareMark);
check("a question stands while nothing has been said", stillAsks(kindQ, bareMark, ""));
check("…and is withdrawn the moment the part is described", !stillAsks(kindQ, bareMark, "the pricing table"));
check("…however it is described: a word on the drawing does it too", !stillAsks(kindQ, { ...bareMark, words: "a shelf" }, ""));
check("a cube question from before, on a bare box, no longer stands: the box is decided", !stillAsks({ why: "cube" }, bareBox, ""));
const markQ = oddness({ strokes: [scribble, wiggle], words: "" });
check("the same holds for the other question", stillAsks(markQ, { strokes: [scribble, wiggle], words: "" }, "")
  && !stillAsks(markQ, { strokes: [scribble, wiggle], words: "" }, "a gull, as an icon"));
check("a question of one kind does not stand for an answer to another",
  !stillAsks({ why: "cube" }, bareMark, "") && stillAsks({ why: "kind" }, bareMark, ""));
check("one carried from before the kind was written down is judged on the drawing alone",
  stillAsks({ ask: "What is this drawing meant to be?", choices: [] }, bareMark, "") && !stillAsks({ ask: "Is this box a cube?", choices: [] }, bareBox, ""));
check("nothing asked, nothing standing", !stillAsks(null, bareBox, "") && !stillAsks(undefined, bareBox, ""));
/*
 * And the answer goes with it. The run folds an answer in as words only
 * while its question stands; otherwise the drawing keeps the words the
 * person actually typed, whatever they answered earlier.
 */
check("an answer to a question that no longer stands is not folded in", (() => {
  const held = stillAsks(kindQ, bareMark, "the pricing table") ? "An icon" : undefined;
  return withAnswer(bareMark, held).words === "";
})());
check("…and one to a question that does stand is", (() => {
  const held = stillAsks(kindQ, bareMark, "") ? "An icon" : undefined;
  return withAnswer(bareMark, held).words === "icon";
})());

/* ------------------------------------------------------------------ */
/* 3. The queue holds the question                                      */
/* ------------------------------------------------------------------ */

const q = [
  { id: "a", status: "asking", question: { ask: "Is this box a cube?", choices: ["A cube", "A flat box"] }, queued: 1 },
  { id: "b", status: "waiting", queued: 2 },
];
check("a job that is asking is pending: red on the counter, not lost", pendingJobs(q).length === 2);
check("and is the one the question card shows", askingJob(q)?.id === "a");
check("other drawings go past it rather than waiting on the person", nextJob(q)?.id === "b");
check("answered, it is no longer asking", askingJob([{ ...q[0], question: { ...q[0].question, answer: "A cube" } }]) === null);

/* ------------------------------------------------------------------ */
/* 4. Wired in                                                          */
/* ------------------------------------------------------------------ */

const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
const dq = readFileSync("src/features/studio/DrawQueue.tsx", "utf8");
const store = readFileSync("src/features/studio/store.ts", "utf8");
check("the run asks after the catalogue, which is free, and before the read, which is not", (() => {
  const cat = run.indexOf(": pickCoded(ctx);");
  /* Asked of the drawing as the catalogue judged it: alone, or over a part (`tests/solid.mjs`). */
  const ask = run.indexOf("const q = oddness(drawn, \"\", lone);");
  const read = run.indexOf("deps.onStep?.(\"Claude is reading the drawing…\");");
  return cat > 0 && ask > cat && read > ask;
})());
/* Nor when he said what it is before he drew it: a job that wants a cube or
   an icon has nothing to ask. */
check("…once: a job that has its question is not asked again", /if \(!job\.question && job\.want !== "icon" && job\.want !== "cube"\) \{/.test(run));
/* The assignment, not the declaration. `drawn` is declared above the try
   and assigned inside it, so a throw anywhere in here is a failure the job
   can report rather than a rejection that leaves it running for ever
   (`tests/two-in-a-row.mjs`). Where the variable is declared is not what
   this check is about, so it does not ask. */
check("…and reads the answer back in as words", /\bdrawn = withAnswer\(job\.sketch, answered\)/.test(run));
check("the cube is no longer offered as a toast after the fact when it was asked before", /const nearly = picked \|\| job\.question \? "" : nearlyCoded\(ctx\);/.test(run));
check("the runner leaves an asking job alone", /if \(r\.asked\) return;/.test(dq));
check("the question is put where the counter is, with the drawing and the answers as keys", /data-queue-question=\{job\.id\}/.test(dq) && /data-queue-answer=\{c\}/.test(dq) && /make it anyway/.test(dq));
check("an answer puts the job back on the queue with it", /answerJob: \(id, answer\) =>/.test(store) && /status: "waiting" as const, question: \{ \.\.\.j\.question, answer \}/.test(store));
check("the job remembers which question it asked, so staleness can be judged",
  /question: \{ ask: q\.ask, choices: q\.choices, why: q\.why, prompt: hit\?\.prompt \?\? "", lone \}/.test(run) && /why\?: "cube" \| "kind"/.test(readFileSync("src/features/studio/queue.ts", "utf8")));
/* The part's words when the question was asked travel with it: only words
   typed after it can overrule the answer (`typedSince`). */
check("the run folds in an answer only while its question stands, judged by words typed since it was asked",
  /const answered = stillAsks\(job\.question, job\.sketch, typedSince\(job\.question, hit\?\.prompt\)\) \? job\.question\?\.answer : undefined;/.test(run)
  && typedSince({ ask: "", choices: [], prompt: "a box" }, "a box") === ""
  && typedSince({ ask: "", choices: [], prompt: "a box" }, "a flat box") === "a flat box"
  && typedSince(null, "a box") === "");
check("a question nobody needs any more is withdrawn while it waits, and the job goes on",
  /if \(stillAsks\(job\.question, job\.sketch, said\)\) return;/.test(dq)
  && /updateJob\(job\.id, \{ status: "waiting", question: null, sketch: withAnswer\(job\.sketch, said\) \}\);/.test(dq));
/* Withdrawn once, never asked again: the words that withdrew it go on with
   the drawing, and a drawing with words has nothing to ask. Without them the
   run asked again on its next turn and that question could not be withdrawn. */
check("…and is not asked again once the words that withdrew it go on with the drawing",
  oddness(withAnswer({ strokes: [scribble, wiggle], words: "" }, "the pricing table, flat"), "") === null && oddness({ strokes: [scribble, wiggle], words: "" }, "") !== null);

/* ------------------------------------------------------------------ */
/* 5. On the board: a question withdrawn by what a person typed         */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const page = await b.newPage({ viewport: { width: 1300, height: 950 } });
  /* The models, answered at the edge; nothing else is stubbed. */
  await page.route("**/api/studio/reshape", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, patch: { featureId: "custom-idea", label: "Drawn", w: 300, h: 200, note: "an idea" }, usage: { model: "stub" } }) }));
  await page.route("**/api/studio/image", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, kind: "vectorize", cost: 0, model: "stub", stripped: [], html: `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#333"/></svg>` }) }));
  await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 }));
    localStorage.setItem("builder.keys.plain", JSON.stringify({ ANTHROPIC_API_KEY: "sk-ant-stub", REPLICATE_API_TOKEN: "r8_stub" }));
  });
  await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // A part, and a bare scribble drawn on it: the one drawing that gets
  // asked about. A bare box is not asked about any more: it is a box, and a
  // box on its own is the cube, decided off its four corners.
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const pb = await page.locator("[data-node-id]").last().boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(700);
  await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
  await page.waitForTimeout(1300);
  const on = await page.locator("[data-draw-board]").boundingBox();
  const seg = (p0, p1, n = 10) => Array.from({ length: n }, (_, i) => [p0[0] + (p1[0] - p0[0]) * (i + 1) / n, p0[1] + (p1[1] - p0[1]) * (i + 1) / n]);
  const SCRIBBLES = [
    [[0.15, 0.3], ...seg([0.15, 0.3], [0.35, 0.75]), ...seg([0.35, 0.75], [0.5, 0.2]), ...seg([0.5, 0.2], [0.7, 0.8]), ...seg([0.7, 0.8], [0.85, 0.35])],
    [[0.15, 0.55], ...seg([0.15, 0.55], [0.35, 0.25]), ...seg([0.35, 0.25], [0.55, 0.7]), ...seg([0.55, 0.7], [0.8, 0.3]), ...seg([0.8, 0.3], [0.85, 0.6])],
  ];
  for (const stroke of SCRIBBLES) {
    await page.mouse.move(on.x + stroke[0][0] * on.width, on.y + stroke[0][1] * on.height);
    await page.mouse.down();
    for (const [x, y] of stroke) { await page.mouse.move(on.x + x * on.width, on.y + y * on.height); await page.waitForTimeout(4); }
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  // Nothing typed beside it — that is the whole point — but Make real is
  // the words field's own Enter, so the focus has to be there.
  await page.locator("[data-draw-words]").fill("");
  await page.keyboard.press("Enter");

  await page.locator("[data-queue-question]").first().waitFor({ timeout: 15000 }).catch(() => {});
  check("a bare scribble drawn on a part is asked about", (await page.locator("[data-queue-question]").count()) === 1);
  const asked = await page.evaluate(() => (window.__studioQueue?.() ?? []).map((j) => ({ status: j.status })));
  check("…and the job waits on the person rather than on the queue", asked.some((j) => j.status === "asking"), JSON.stringify(asked));
  /*
   * And it does not cover the one button you press to go and look at what
   * it is asking about. It did: the key at y 51–79, the card from 56.
   */
  const overlap = () => page.evaluate(() => {
    const f = document.querySelector("[data-finish]").getBoundingClientRect();
    const q = document.querySelector("[data-queue-question]").getBoundingClientRect();
    return { clear: q.top >= f.bottom || q.bottom <= f.top || q.left >= f.right || q.right <= f.left,
      said: `key ${Math.round(f.top)}–${Math.round(f.bottom)}, card ${Math.round(q.top)}–${Math.round(q.bottom)}` };
  });
  const over = await overlap();
  check("the question does not sit over the Finish key", over.clear, over.said);

  /*
   * And then the person says what it is, in their own words, on the card
   * the drawing made — which is a better answer than any of the choices.
   */
  await page.locator("[data-finish]").first().click();
  await page.waitForTimeout(1200);
  await page.locator("[data-box]").last().click({ force: true });
  await page.waitForTimeout(600);
  const editor = page.locator("[data-edit-prompt]");
  check("the iteration is already on the timeline to be typed on", (await editor.count()) === 1);
  await editor.fill("the pricing table, flat");
  await editor.blur();
  await page.waitForTimeout(1200);
  check("the question is withdrawn rather than left up", (await page.locator("[data-queue-question]").count()) === 0);
  const after = await page.evaluate(() => (window.__studioQueue?.() ?? []).map((j) => ({ status: j.status, q: !!j.question })));
  check("…and the job goes on without it", after.every((j) => j.status !== "asking" && !j.q), JSON.stringify(after));
  let ended = [];
  for (let i = 0; i < 30; i++) {
    ended = await page.evaluate(() => (window.__studioQueue?.() ?? []).map((j) => j.status));
    if (ended.every((st) => st === "done" || st === "failed")) break;
    await page.waitForTimeout(1000);
  }
  // A failure used to count as landing (inventory D24). With no key the reshape road cannot run, so a job may
  // fail for that one reason and no other; anything else is a failure this suite has to see.
  const jobs = await page.evaluate(() => (window.__studioQueue?.() ?? []).map((j) => ({ status: j.status, note: j.note ?? "" })));
  check("…and every job ends: done, or failed only for the lack of a key", jobs.length > 0 && jobs.every((j) => j.status === "done" || (j.status === "failed" && /key|unavailable|not run/i.test(j.note))), JSON.stringify(jobs));
  const made = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.map((n) => n.featureId).join(","));
  check("the part is what the words said, not what the question offered", !/cube-3d/.test(made), made);
  await b.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed of ${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
