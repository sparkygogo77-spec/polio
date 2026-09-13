/**
 * A part lands at the size and place it was drawn.
 *
 * A stroke drawn eighty pixels wide came back as a bright band across the
 * whole page. The strokes are fractions of their own box by the time they
 * reach the reader, so nothing downstream knew how big the drawing had been,
 * and a guess about a part nobody had seen on a page filled the frame.
 *
 *   · the size the board measured is the size the part gets;
 *   · a reader's own numbers do not overrule it;
 *   · a drawing actually made across the page still lands across the page;
 *   · a kind that is full bleed by nature still is;
 *   · and the ink door tells the job how big the drawing was.
 *
 *   node tests/drawn-size.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { FULL_BLEED, checkAnswer } from "../src/features/studio/reshape.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const FRAME = 1440;

/** The library, as the checker reads it: two kinds, one of them full bleed. */
const KINDS = {
  "custom-idea": { id: "custom-idea", name: "New idea", w: 480, h: 200, options: [] },
  "eyebrow-rule": { id: "eyebrow-rule", name: "Eyebrow label", w: 420, h: 24, options: [] },
  "corner-glow": { id: "corner-glow", name: "Corner glow", w: 1440, h: 900, options: [] },
};
const kind = (id) => KINDS[id] ?? null;

/*
 * `aspect` is what the strokes measure. It is deliberately 1 here, because
 * that is what the board actually hands over: strokes normalised to their own
 * box are always about as wide as they are tall, which is why every ink part
 * came out square. A measured size has to beat it.
 */
const ask = (patch, drawnSize, extra = {}) =>
  checkAnswer({
    patch,
    node: null,
    drawn: { strokes: [[[0, 0], [1, 1]]], words: "" },
    aspect: 1,
    frameWidth: FRAME,
    kind,
    drawnSize,
    ...extra,
  });

/* ------------------------------------------------------------------ */
/* 1. The size drawn is the size made                                  */
/* ------------------------------------------------------------------ */

const band = ask({ featureId: "custom-idea", w: 1440, h: 80 }, { w: 240, h: 90 });
check("a small drawing does not become a band across the page", band.w === 240 && band.h === 90, `${band.w}×${band.h}`);
check("and it says it was put back", band.keptSize === true);

const agreed = ask({ featureId: "custom-idea", w: 240, h: 90 }, { w: 240, h: 90 });
check("a reader that already agreed is not corrected", agreed.w === 240 && agreed.h === 90 && agreed.keptSize === false);

const noSize = ask({ featureId: "custom-idea", w: 600, h: 200 }, null, { aspect: 3 });
check("with no size measured the reader still decides", noSize.w === 600 && noSize.h === 200 && noSize.keptSize === false,
  `${noSize.w}×${noSize.h}`);

/*
 * The one that made a diagonal 760 by 760: the strokes said square because
 * they always say square, and the reader's answer was corrected to it.
 */
const squared = ask({ featureId: "custom-idea", w: 300, h: 100 }, { w: 300, h: 100 });
check("a wide drawing is not squared off by a proportion read off the strokes",
  squared.w === 300 && squared.h === 100, `${squared.w}×${squared.h}`);
check("and a reader that answers square for a wide drawing is corrected to the drawing", (() => {
  const r = ask({ featureId: "custom-idea", w: 760, h: 760 }, { w: 300, h: 100 });
  return r.w === 300 && r.h === 100;
})());

/* ------------------------------------------------------------------ */
/* 2. …unless it is genuinely a full width thing                       */
/* ------------------------------------------------------------------ */

const wide = ask({ featureId: "custom-idea", w: 1440, h: 300 }, { w: Math.round(FRAME * FULL_BLEED) + 20, h: 300 });
check("a drawing actually made across the page lands across the page", wide.w >= FRAME * FULL_BLEED, `${wide.w}`);
check("and that is not called a correction", wide.keptSize === false);

const glow = ask({ featureId: "corner-glow", w: 1440, h: 900 }, { w: 200, h: 160 });
check("a kind that is full bleed by nature stays full bleed", glow.w === 1440 && glow.h === 900, `${glow.w}×${glow.h}`);

const narrowKind = ask({ featureId: "eyebrow-rule", w: 420, h: 24 }, { w: 180, h: 40 });
check("a kind that is not full bleed takes the drawn size", narrowKind.w === 180 && narrowKind.h === 40, `${narrowKind.w}×${narrowKind.h}`);

/* ------------------------------------------------------------------ */
/* 3. It still obeys the rules it already had                          */
/* ------------------------------------------------------------------ */

const circle = ask({ featureId: "custom-idea", w: 300, h: 300, shape: "circle" }, { w: 200, h: 120 });
check("a circle is still as tall as it is wide", circle.w === circle.h, `${circle.w}×${circle.h}`);
check("and it is the drawn width", circle.w === 200, `${circle.w}`);

const tiny = ask({ featureId: "custom-idea", w: 300, h: 200 }, { w: 3, h: 2 });
check("nothing lands smaller than the floor", tiny.w >= 40 && tiny.h >= 24, `${tiny.w}×${tiny.h}`);

const huge = ask({ featureId: "custom-idea", w: 300, h: 200 }, { w: 800, h: 9000 });
check("nothing lands taller than the ceiling", huge.h <= 1600, `${huge.h}`);

check("a size of nothing is ignored rather than obeyed", (() => {
  const z = ask({ featureId: "custom-idea", w: 300, h: 200 }, { w: 0, h: 0 }, { aspect: 1.5 });
  return z.w === 300 && z.h === 200;
})(), "");

/* ------------------------------------------------------------------ */
/* 4. The board says how big the drawing was                           */
/* ------------------------------------------------------------------ */

const canvas = readFileSync("src/features/studio/Canvas.tsx", "utf8");
check("the ink door sends the size it measured", /drawn: \{ w: b\.w, h: b\.h \}/.test(canvas));

const queue = readFileSync("src/features/studio/queue.ts", "utf8");
check("the job has somewhere to carry it", /drawn\?: \{ w: number; h: number \} \| null;/.test(queue));

const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
check("the reader path passes it to the checker", /drawnSize: job\.drawn \?\? null/.test(run));
check("the no-reader path holds it too", /job\.drawn && !drewWide/.test(run));
check("and the toast says when a size was put back", /at the size it was drawn/.test(run));
check("the part is placed where the drawing was", /where\.x - w \/ 2/.test(run));

/* ------------------------------------------------------------------ */
/* 5. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
