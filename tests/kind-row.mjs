/**
 * HE SAYS WHAT HE IS DRAWING BEFORE HE DRAWS IT.
 *
 * HIS WORDS: "in the places of the colors when i pick to draw freehand just
 * make the color stay there but only one button instead of multiple, and when
 * i click the color i can adjust it and beside it the buttons become preselect
 * options for 'button' 'surface' 'icon' or whatever options i can draw".
 *
 * Eight swatches became one button that wears the colour and opens the eight
 * when pressed; the room they took is the kinds. The constraint order on it
 * was: never remove the ability to say what a part is; subject to that, move
 * the saying to BEFORE the draw. So `part` is still there and still works it
 * out — it moved, it did not go.
 *
 * The load-bearing check is the third section. A preselect that the reader
 * can talk you out of is a hint, not a choice, and a chip that quietly falls
 * through to the model is the same disease as a dead control. So the test is
 * not "is there a chip", it is "does choosing it beat an answer that says
 * otherwise".
 *
 *   node --experimental-strip-types tests/kind-row.mjs [url]
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { DRAW_KINDS } from "../src/features/studio/drawKinds.ts";
import { IDEA_ID, checkAnswer } from "../src/features/studio/reshape.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The kinds themselves                                             */
/* ------------------------------------------------------------------ */

check("there are kinds to choose from", DRAW_KINDS.length >= 4, DRAW_KINDS.map((k) => k.label).join(", "));
check("every one has a name and says what it does",
  DRAW_KINDS.every((k) => k.label.length > 1 && k.means.length > 20),
  `shortest meaning is ${Math.min(...DRAW_KINDS.map((k) => k.means.length))} characters`);
check("the one that works it out is still among them, so nothing was taken away",
  DRAW_KINDS.some((k) => k.id === "part"), "part");
/* Button is coming and is deliberately not here yet: a preset kind means
   coded and pressable the moment it lands, and a chip that is not that is a
   control that lies. */
check("and nothing is offered that is not built yet", !DRAW_KINDS.some((k) => k.id === "button"));

/* ------------------------------------------------------------------ */
/* 2. Each one is a path that exists                                   */
/* ------------------------------------------------------------------ */

const canvas = readFileSync("src/features/studio/Canvas.tsx", "utf8");
const parts = readFileSync("src/features/studio/parts/index.ts", "utf8");
const cat = readFileSync("src/features/studio/catalog.ts", "utf8");
const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");

check("surface draws a space, by the same door the space tool uses",
  /drawKind === "surface"/.test(canvas) && /store\.addSpace\(\{ pageId/.test(canvas));
check("…and refuses a line that does not close, as that door does",
  /A surface is a closed line/.test(canvas));
check("icon is a part that takes the drawn outline itself",
  /ids: \["drawn-icon"\]/.test(parts) && /f\("drawn-icon"/.test(cat));
check("cube is a part that is registered too", /ids: \["cube-3d"\]/.test(parts));
check("and the reader is told which one was asked for",
  /WANTED: Record<string, string> = \{ icon: "drawn-icon", cube: "cube-3d" \}/.test(run)
  && /want: job\.want/.test(run));

/* ------------------------------------------------------------------ */
/* 3. Choosing beats answering                                         */
/* ------------------------------------------------------------------ */

const drawn = { strokes: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], words: "" };
const kindOf = (id) => (id === "drawn-icon" || id === "cube-3d" || id === "charts" ? { id, label: id, options: [] } : null);
const ask = (want, answered) => checkAnswer({
  patch: { featureId: answered, label: "x" }, node: null, drawn, aspect: 1, outline: undefined,
  frameWidth: 1440, kind: kindOf, drawnSize: null, want,
}).featureId;

check("a chosen kind lands, even when the reader answered something else",
  ask("drawn-icon", "charts") === "drawn-icon", `asked icon, reader said charts, got ${ask("drawn-icon", "charts")}`);
check("…and the other way round too, so it is the choice and not the order",
  ask("cube-3d", "charts") === "cube-3d", `got ${ask("cube-3d", "charts")}`);
check("choosing nothing leaves the reader to work it out, which is what `part` is",
  ask(null, "charts") === "charts", `got ${ask(null, "charts")}`);
check("…and with no answer either, it is an idea rather than a wrong part",
  ask(null, undefined) === IDEA_ID, `got ${ask(null, undefined)}`);
/* Held to the library: a preselect can pin a part, never invent one. */
check("a kind nothing in the library answers to cannot be pinned",
  ask("not-a-part", "charts") === "charts", `got ${ask("not-a-part", "charts")}`);

/* ------------------------------------------------------------------ */
/* 4. On the bar                                                       */
/* ------------------------------------------------------------------ */

const URL_ = process.argv[2];
if (!URL_) {
  console.log("\n  --  the bar leg needs a url; skipped");
} else {
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    throw new Error("No Playwright found.");
  })();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 950 } })).newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator("body").click({ position: { x: 800, y: 500 } });
  await page.keyboard.press("d");
  await page.waitForTimeout(800);

  const seen = await page.evaluate(() => ({
    tool: document.querySelector("[data-tool-picker]")?.getAttribute("aria-label") ?? "",
    rows: document.querySelectorAll("[data-draw-row]").length,
    colour: document.querySelectorAll("[data-ink-colour]").length,
    kinds: [...document.querySelectorAll("[data-draw-kind]")].map((e) => `${e.dataset.drawKind}:${e.getAttribute("aria-pressed")}`),
    loose: document.querySelectorAll("[data-draw-row] [data-ink-hues]").length,
  }));
  check("the draw tool is the one that shows it", /Draw freehand/.test(seen.tool), seen.tool);
  check("there is one colour button, not eight swatches", seen.colour === 1 && seen.loose === 0,
    `${seen.colour} colour button, ${seen.loose} swatch rows on the bar`);
  check("and the kinds stand beside it", seen.kinds.length === DRAW_KINDS.length, seen.kinds.join(" "));
  check("one of them is chosen to begin with, and it is the one that works it out",
    seen.kinds.includes("part:true"), seen.kinds.join(" "));

  await page.locator('[data-draw-kind="surface"]').first().click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => [...document.querySelectorAll("[data-draw-kind]")].map((e) => `${e.dataset.drawKind}:${e.getAttribute("aria-pressed")}`));
  check("pressing one chooses it, and only it", after.includes("surface:true") && after.filter((s) => s.endsWith(":true")).length === 1, after.join(" "));

  await page.locator("[data-ink-colour]").first().click();
  await page.waitForTimeout(300);
  const hues = await page.evaluate(() => document.querySelectorAll("[data-ink-hues] button").length);
  check("and the colour button opens the colours it replaced", hues === 8, `${hues} hues`);

  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
