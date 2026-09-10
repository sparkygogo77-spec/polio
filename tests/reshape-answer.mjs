/**
 * What the board does with Claude's answer from the drawing board.
 *
 * The route hands back one object and the board holds every field of it to
 * the catalog, the frame and the drawing (`src/features/studio/reshape.ts`).
 * These are the rules, each one a case: an id not in the library is dropped,
 * an option the part does not offer is dropped, a value it does not offer is
 * dropped, a size is clamped to the frame, a size that ignored the drawing's
 * proportion is brought back to it when no words could have asked for that,
 * and a new part keeps the author's words as its prompt.
 *
 *   node tests/reshape-answer.mjs
 *
 * Runs the TypeScript straight from source: Node strips the types (22.18+).
 */
import { checkAnswer, allowedOptions, PROPORTION_HOLD } from "../src/features/studio/reshape.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= Math.abs(b) * tol;

/* A small library, the way the catalog reads without its icons. */
const LIBRARY = {
  "custom-idea": { id: "custom-idea", name: "New idea", w: 480, h: 200 },
  "tabs-panel": { id: "tabs-panel", name: "Tabs", w: 132, h: 76, options: [{ id: "style", values: ["underline", "pill", "segmented"] }] },
  footer: {
    id: "footer", name: "Footer", w: 880, h: 160,
    options: [
      { id: "shape", values: ["Thin bar", "Two rows", "Columns"] },
      { id: "social", kind: "set", values: ["X", "GitHub", "Instagram", "RSS"] },
    ],
  },
  "search-bar": { id: "search-bar", name: "Search", w: 420, h: 48 },
};
const kind = (id) => LIBRARY[id] ?? null;
const FRAME = 1440;

/* A wide drawing: one box three times wider than tall. */
const wide = { strokes: [[[0.2, 0.4], [0.8, 0.4], [0.8, 0.6], [0.2, 0.6], [0.2, 0.4]]], words: "" };
const WIDE = 3;

const tabs = { featureId: "tabs-panel", label: "Product tabs", prompt: "Three tabs", w: 300, h: 100, options: { style: "pill" } };

/* 1. An id that is not in the library is dropped; the part keeps its kind and name. */
{
  const r = checkAnswer({ patch: { featureId: "made-up-thing", w: 300, h: 100, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("an invented id keeps the current kind", r.featureId === "tabs-panel" && !r.kindChanged, r.featureId);
  check("no label answered keeps the current name", r.label === "Product tabs", r.label);
  check("no content or prompt answered leaves them alone", r.content === null && r.prompt === null);
}

/* 2. Options: only ids the part has, only values it offers; a set keeps the offered members. */
{
  const footer = { featureId: "footer", label: "Footer", prompt: "", w: 880, h: 160, options: { shape: "Thin bar" } };
  const r = checkAnswer({
    patch: { w: 880, h: 293, note: "", options: { shape: "Columns", social: "X, Nope, RSS", bogus: "yes", legal: "Copyright" } },
    node: footer, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind,
  });
  check("an offered value is set", r.options.shape === "Columns", r.options.shape);
  check("a set keeps only the members offered", r.options.social === "X, RSS", r.options.social);
  check("an option the part does not offer is dropped", !("bogus" in r.options) && !("legal" in r.options), JSON.stringify(r.options));
  const list = allowedOptions([{ id: "shape", value: "two rows" }, { id: "shape", value: 3 }], LIBRARY.footer.options, {});
  check("the list-of-pairs shape is read too, and a value is matched without regard to case", list.shape === "Two rows", JSON.stringify(list));
  const kept = allowedOptions({ shape: "not offered" }, LIBRARY.footer.options, { shape: "Thin bar", stale: "x" });
  check("a value not offered leaves the one already set; an id no longer offered goes", kept.shape === "Thin bar" && !("stale" in kept), JSON.stringify(kept));
}

/* 3. A part that becomes another kind drops the old kind's options and follows addNode's custom flag. */
{
  const r = checkAnswer({ patch: { featureId: "footer", w: 900, h: 300, note: "", options: { style: "pill", shape: "Two rows" } }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("the kind changes to a library id", r.featureId === "footer" && r.kindChanged);
  check("the old kind's options do not come along", !("style" in r.options) && r.options.shape === "Two rows", JSON.stringify(r.options));
  check("a part that is not an idea is not custom", r.custom === false);
  const idea = checkAnswer({ patch: { featureId: "custom-idea", w: 300, h: 100, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("a part that became an idea is custom", idea.custom === true && idea.kindChanged);
}

/* 4. The size is held to the frame and to the smallest a part can be. */
{
  const r = checkAnswer({ patch: { w: 5000, h: 4, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("wider than the frame is the frame", r.w <= FRAME, `${r.w}`);
  check("nothing thinner than 24", r.h >= 24, `${r.h}`);
  const nan = checkAnswer({ patch: { w: Number.NaN, h: "tall", note: "" }, node: tabs, drawn: { ...wide, words: "keep it" }, aspect: WIDE, frameWidth: FRAME, kind });
  check("a size that is not a number falls back to the part's own", nan.w === 300 && nan.h === 100, `${nan.w}×${nan.h}`);
}

/* 5. The proportion: an answer that ignored the drawing is brought back to it — unless words could have asked for that. */
{
  const square = checkAnswer({ patch: { w: 100, h: 100, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("a square answer to a 3:1 drawing is made 3:1", square.reproportioned && near(square.w / square.h, WIDE, 0.06), `${square.w}×${square.h}`);
  check("at the area it answered with", near(square.w * square.h, 10000, 0.08), `${square.w * square.h}`);
  const close = checkAnswer({ patch: { w: 300, h: 110, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("an answer within the hold is left as answered", !close.reproportioned && close.w === 300 && close.h === 110, `hold ${PROPORTION_HOLD}`);
  const worded = checkAnswer({ patch: { w: 100, h: 100, note: "" }, node: tabs, drawn: { ...wide, words: "a square tile" }, aspect: WIDE, frameWidth: FRAME, kind });
  check("with words beside the drawing the answer stands", !worded.reproportioned && worded.w === 100 && worded.h === 100);
  const huge = checkAnswer({ patch: { w: 1200, h: 1200, note: "" }, node: tabs, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("brought back to proportion, it still fits the frame", huge.reproportioned && huge.w <= FRAME && near(huge.w / huge.h, WIDE, 0.06), `${huge.w}×${huge.h}`);
}

/* 6. A new part: the words are not lost, and the kind falls back to an idea. */
{
  const r = checkAnswer({ patch: { w: 480, h: 160, note: "" }, node: null, drawn: { ...wide, words: "a search bar with a button" }, aspect: WIDE, frameWidth: FRAME, kind });
  check("no id answered makes an idea", r.featureId === "custom-idea" && r.custom && !r.kindChanged, r.featureId);
  check("the words name it", r.label === "a search bar with a button", r.label);
  check("the words are its prompt", r.prompt === "a search bar with a button", r.prompt);
  const named = checkAnswer({ patch: { featureId: "search-bar", label: "Site search", prompt: "One field, one button.", content: "Search…, Go", w: 480, h: 160, note: "" }, node: null, drawn: { ...wide, words: "search" }, aspect: WIDE, frameWidth: FRAME, kind });
  check("an answered kind, name, prompt and contents all arrive", named.featureId === "search-bar" && named.label === "Site search" && named.prompt === "One field, one button." && named.content === "Search…, Go" && !named.custom);
  const bare = checkAnswer({ patch: { featureId: "search-bar", w: 480, h: 160, note: "" }, node: null, drawn: wide, aspect: WIDE, frameWidth: FRAME, kind });
  check("a library kind with no name or words is called what the library calls it", bare.label === "Search" && bare.prompt === null, bare.label);
}

const ok = results.every(Boolean);
console.log(ok ? "\nall good" : "\nsomething failed");
process.exit(ok ? 0 : 1);
