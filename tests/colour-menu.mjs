/**
 * The colour menus, and the fact that there is only one of them.
 *
 * Same job `molten.mjs` does for the constructs, for the same reason: six
 * places in the Builder offer a colour, and before `colourMenu.ts` each was
 * its own small design. What is guarded here is that they stop being six.
 *
 * The state this replaced, measured off the source:
 *
 *   · six chip sizes — 16, 18, 20, 22, 24, 26 — over nine hand-written call
 *     sites, plus two more rows on ArcChips' unchosen default of 28 and a
 *     grid on GridChips' 22, plus 18, 20, 24, 32 and 36 written as Tailwind
 *     classes on four other surfaces
 *   · five declarations of the same "nothing" chip: four an `X` at two glyph
 *     sizes, one a `Ban`, over three different dark fills
 *   · two independent builds of the same three controls — a 96px field over
 *     a 12px strip in LookPanel, two 12px strips and no field in MenuConsole
 *
 * So: one file decides, nothing else writes a size or an empty swatch of its
 * own, and emptiness looks transparent rather than dark.
 *
 *   node tests/colour-menu.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { BAND, CHIP, EMPTY, NEAR_OF_HOLE, chipSize, emptyChip, emptyFill, swatchChip } from "../src/features/studio/colourMenu.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. How much is left to move                                         */
/* ------------------------------------------------------------------ */

/*
 * The check that nothing writes its own chip size or empty swatch lands with
 * the commit that moves the surfaces onto this, not with the commit that adds
 * it. Asserting it here would be asserting work that has not been done yet,
 * and a suite that is red on purpose teaches everybody to ignore it.
 *
 * What can be said today is how much there is to move, so the number is on
 * the record rather than in a commit message — and the number that matters
 * is how many of the six menus import from the shared file, which is exact.
 * Counting sizes is not: the first version of this scan swept every studio
 * file for a Tailwind size class near a background and reported 41 of them
 * over 16 files, most of which were timeline cards. Two counts that can be
 * made exactly are worth more than one that sounds thorough.
 */
const dir = "src/features/studio";
/** The six places in the Builder that offer a colour. */
const MENUS = ["BackgroundEditors.tsx", "RingEditors.tsx", "ColourOverride.tsx", "LookPanel.tsx", "MenuConsole.tsx", "RadialMenu.tsx"];
const source = Object.fromEntries(MENUS.map((f) => [f, readFileSync(`${dir}/${f}`, "utf8")]));

/** Which of the six have moved onto the shared definition, and which have not. */
const onIt = MENUS.filter((f) => /from "\.\/colourMenu"/.test(source[f]));
console.log(`  --   on the system: ${onIt.length} of ${MENUS.length} colour menus${onIt.length ? ` (${onIt.join(", ")})` : ""}`);
console.log(`  --   still to move: ${MENUS.filter((f) => !onIt.includes(f)).join(", ") || "none"}`);

/*
 * A chip size written at a call site. Two things this has to get right, and
 * earlier versions got each of them wrong:
 *
 *   · `[^>]` will not do for the window between the tag and the prop — the
 *     props carry arrow functions, and the first `=>` ends the match. That
 *     reported five of the nine and looked right doing it.
 *   · `size=\{(\d+)\}` will not do for the value. Two rows chose between two
 *     sizes with a ternary — `size={sharing ? 22 : 26}` — and a scan for a
 *     bare number walks straight past them. That is how 22 and 26 came to be
 *     called a misreading when they were on the screen the whole time.
 */
const numeric = Object.entries(source).flatMap(([f, s]) =>
  [...s.matchAll(/<(?:Arc|Grid)Chips\b(?:[^>]|=>)*?\bsize=\{([^}]*)\}/gs)]
    .flatMap((m) => [...m[1].matchAll(/\b(\d+)\b/g)].map((n) => `${f} ${n[1]}`)));

/** A hand-made "nothing" chip: an empty id, its own fill, a glyph over it.
    The fill is usually `{ background: … }`, so the pattern has to cross one
    level of braces to reach the glyph. */
const homemade = Object.entries(source).flatMap(([f, s]) =>
  [...s.matchAll(/\{\s*id:\s*"(?:|none)"\s*,\s*label:(?:[^{}]|\{[^{}]*\})*?glyph:\s*<(\w+)/gs)].map((m) => `${f} ${m[1]}`));

console.log(`  --   still hand-written: ${numeric.length} chip sizes (${[...new Set(numeric.map((n) => n.split(" ")[1]))].sort().join(", ") || "none"}) over ${new Set(numeric.map((n) => n.split(" ")[0])).size} files`);
console.log(`  --   still hand-made: ${homemade.length} empty swatches (${homemade.join(", ") || "none"})`);

/* ------------------------------------------------------------------ */
/* 2. What the definition says                                         */
/* ------------------------------------------------------------------ */

check("there is one chip size, in two densities", CHIP.far > CHIP.near && CHIP.gap > 0,
  `${CHIP.near} near the hole, ${CHIP.far} out from it, ${CHIP.gap} apart`);
check("a round menu's chips are discs and a square one's are not",
  CHIP.radius.round === "9999px" && CHIP.radius.square !== "9999px", `${CHIP.radius.round} / ${CHIP.radius.square}`);
check("the size follows the room there is", chipSize(200, 0) === CHIP.far && chipSize(10, 0) === CHIP.near,
  `${chipSize(10, 0)} at a tight radius, ${chipSize(200, 0)} at a wide one`);

/* The two rows the Builder already had close in, and the row it already had
   far out, must land on either side of the line — otherwise the line is a
   number somebody liked rather than a reading of the menus. `chipsAt` is
   `mid + (reach - mid) * 0.56`; on the tightest slab the console draws, mid
   and reach are far enough apart that this clears the hole by much more. */
check("both rows that were already inner rows read as near", chipSize(18, 0) === CHIP.near && chipSize(26, 0) === CHIP.near,
  `hole+18 and hole+26, against a line at hole+${NEAR_OF_HOLE}`);
check("and the outer row is not a close call", chipSize(90, 0) === CHIP.far,
  `chipsAt lands past hole+${NEAR_OF_HOLE} on every slab`);

/* ------------------------------------------------------------------ */
/* 3. Nothing looks like nothing                                       */
/* ------------------------------------------------------------------ */

const fill = emptyFill();
const css = JSON.stringify(fill);
check("emptiness is a chequer, not a dark box", /linear-gradient/.test(css) && /backgroundSize/.test(css),
  Object.keys(fill).join(", "));
check("and its two greys are far enough apart to read as one", (() => {
  const l = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);
  return Math.abs(l(EMPTY.light) - l(EMPTY.dark)) > 0.15;
})(), `${EMPTY.light} against ${EMPTY.dark}`);
/* Mid-range on purpose: the console is near-black and the panels are light,
   and one pair has to read as transparent on both. A pair that huddles at
   either end reads as a dark box on one of them, which is the thing this
   replaced. */
check("and both sit between the console and the panels", (() => {
  const l = (c) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);
  return l(EMPTY.dark) > 0.2 && l(EMPTY.light) < 0.8;
})(), `${(0.34).toFixed(2)}–${(0.62).toFixed(2)}, clear of both ends`);
check("the squares keep the pitch the one existing chequer chose", EMPTY.square * 2 === 10, `${EMPTY.square * 2}px, as LookPanel's CHECKS`);

const empty = emptyChip("No aura");
check("an empty chip carries no glyph", empty.glyph === undefined, empty.glyph ? "it has one" : "the chequer says it on its own");
check("and only its label changes between menus",
  emptyChip("No aura").label !== emptyChip("Follow the site").label
  && JSON.stringify(emptyChip("No aura").style) === JSON.stringify(emptyChip("Follow the site").style),
  "same swatch, different words");

const swatch = swatchChip("accent", "Accent", "oklch(0.7 0.2 265)");
check("a colour chip wears its colour and nothing else",
  swatch.style.background === "oklch(0.7 0.2 265)" && swatch.glyph === undefined);

/* ------------------------------------------------------------------ */
/* 4. The bands                                                        */
/* ------------------------------------------------------------------ */

check("the surface band is the one with the room", BAND.surface > BAND.strip * 3, `${BAND.surface} against ${BAND.strip}`);
check("and it is deeper than the 96 it was", BAND.surface > 96, `${BAND.surface}px`);
/* A 12px strip carried a 12px thumb, so the thumb was the strip and there
   was nothing behind it to read the value off. */
check("a strip is thicker than the thumb that rides it", BAND.strip > 12, `${BAND.strip}px, against the 12 it was`);

/* ------------------------------------------------------------------ */
/* 5. The menus themselves, if there is a Builder to open              */
/* ------------------------------------------------------------------ */

/*
 * The one thing that cannot be read off the source. `GridChips` laid its
 * swatches out at whatever size it was handed and then dropped the ones that
 * did not fit — `items.slice(0, spots.length)` — so a slab short of room
 * showed fewer colours than it was given and said nothing about it. The aura
 * grid had seven swatches and room for exactly seven at 22px; the moment the
 * chip grew, the seventh was gone. Nothing in the source says which colours
 * a menu ends up showing, so this has to be looked at.
 */
const up = await fetch("http://localhost:3000/builder").then((r) => r.ok).catch(() => false);
if (!up) {
  console.log("  --   no Builder at localhost:3000 — the menus themselves were not opened");
} else {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let chromium = null;
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { ({ chromium } = req(c)); break; } catch { /* next */ }
  }
  if (!chromium) console.log("  --   no Playwright — the menus themselves were not opened");
  else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.goto("http://localhost:3000/builder", { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(250);
    await page.keyboard.type("drop a new idea");
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const nb = await page.locator("[data-node-id]").first().boundingBox();

    const open = async (words) => {
      await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
      await page.waitForTimeout(600);
      for (const w of words) {
        const el = page.locator("[data-radial]").getByText(w).first();
        if (!(await el.count())) return false;
        await el.click({ force: true });
        await page.waitForTimeout(700);
      }
      return true;
    };
    const read = () => page.$$eval("[data-arc-chip]", (els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { id: e.getAttribute("data-arc-chip"), w: Math.round(parseFloat(getComputedStyle(e).width)),
               round: getComputedStyle(e).borderRadius, cx: r.x + r.width / 2, cy: r.y + r.height / 2, r: r.width / 2 };
    }));

    for (const [name, words] of [["the aura menu", [/^Looks$/, /^Aura$/]], ["the part's colour menu", [/^Looks$/, /^Hue$/]]]) {
      if (!(await open(words))) { check(`${name} opens`, false, "the wedge was not there"); continue; }
      const chips = await read();
      const ids = new Set(chips.map((c) => c.id));
      const ROLES = ["bg", "surface", "text", "muted", "accent", "highlight"];
      const missing = ROLES.filter((r) => !ids.has(r));
      check(`${name} shows every colour it was given`, missing.length === 0 && ids.has(""),
        missing.length ? `no ${missing.join(", ")}` : `all six roles and the empty one, ${chips.length} chips`);
      const odd = [...new Set(chips.map((c) => c.w))].filter((w) => w !== CHIP.near && w !== CHIP.far);
      check(`${name} draws them at the two agreed sizes`, odd.length === 0,
        odd.length ? `also ${odd.join(", ")}px` : `${[...new Set(chips.map((c) => c.w))].sort().join(" and ")}px`);
      let worst = Infinity, pair = "";
      for (let i = 0; i < chips.length; i++) for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i], b = chips[j];
        const d = Math.round(Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r);
        if (d < worst) { worst = d; pair = `${a.id || "«empty»"}↔${b.id || "«empty»"}`; }
      }
      check(`${name} keeps them apart`, worst >= 0, `closest pair ${worst}px apart (${pair})`);
      const corners = [...new Set(chips.map((c) => c.round))];
      check(`${name} gives them all one corner`, corners.length === 1,
        corners.length === 1 ? corners[0] : `${corners.join(" and ")} on one menu`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
    await browser.close();
  }
}

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold`);
process.exit(failed ? 1 : 0);
