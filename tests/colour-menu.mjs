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
 *   node tests/colour-menu.mjs [url]   # default http://localhost:3000
 */
import { readFileSync, readdirSync } from "node:fs";

/* The URL comes in as an argument, the way every other suite here takes it.
   It was pinned to :3000, so against a build on any other port the live half
   printed "no Builder" and the suite still said 18 of 18 — green, with the
   menus never opened. */
const URL_ = process.argv[2] ?? "http://localhost:3000";
import { BAND, CHIP, EMPTY, NEAR_OF_HOLE, chipSize, emptyChip, emptyFill, swatchChip } from "../src/features/studio/colourMenu.ts";

const results = [];
/** Halves that could not run here, said in the total rather than counted as green. */
const notRun = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. How much is left to move                                         */
/* ------------------------------------------------------------------ */

/*
 * These were reporting lines while the surfaces were still to move, because
 * asserting work that has not been done teaches everybody to ignore a red
 * suite. All six are on it now, so they are checks.
 *
 * Two things the scanner has to get right, and earlier versions got each of
 * them wrong. `[^>]` will not do for the window between a tag and its prop —
 * the props carry arrow functions and the first `=>` ends the match, which
 * reported five of the nine sizes and looked right doing it. And a bare
 * `\d+` will not do for the value: two rows chose between two sizes with a
 * ternary, `size={sharing ? 22 : 26}`, which is how 22 and 26 came to be
 * called a misreading when they were on the screen the whole time.
 */
const dir = "src/features/studio";
/** The six places in the Builder that offer a colour. */
const MENUS = ["BackgroundEditors.tsx", "RingEditors.tsx", "ColourOverride.tsx", "LookPanel.tsx", "MenuConsole.tsx", "RadialMenu.tsx"];
const source = Object.fromEntries(MENUS.map((f) => [f, readFileSync(`${dir}/${f}`, "utf8")]));

const off = MENUS.filter((f) => !/from "\.\/colourMenu"/.test(source[f]));
check("every colour menu takes its answers from the one file", off.length === 0,
  off.length ? `${off.join(", ")} still on their own` : `all ${MENUS.length}`);

const numeric = Object.entries(source).flatMap(([f, s]) =>
  [...s.matchAll(/<(?:Arc|Grid)Chips\b(?:[^>]|=>)*?\bsize=\{([^}]*)\}/gs)]
    .flatMap((m) => [...m[1].matchAll(/\b(\d+)\b/g)].map((n) => `${f} ${n[1]}`)));
check("none of them writes a chip size of its own", numeric.length === 0,
  numeric.length ? numeric.join(", ") : "nine of them did, in six sizes");

/* A hand-made "nothing" chip: an empty id, its own fill, a glyph over it.
   The pattern crosses one level of braces because the fill is usually
   `style: { background: … }`, which an earlier version could not get past —
   it found one of the five and looked thorough. */
const homemade = Object.entries(source).flatMap(([f, s]) =>
  [...s.matchAll(/\{\s*id:\s*"(?:|none)"\s*,\s*label:(?:[^{}]|\{[^{}]*\})*?glyph:\s*<(\w+)/gs)].map((m) => `${f} ${m[1]}`));
/* One is left on purpose. "No entrance" sits in a row of motion icons — fade,
   slide, grow — and means this element does not animate in, which is not
   emptiness: the element is not transparent, it simply does not move. A
   chequer there would say something untrue, so it keeps its Ban. */
check("the only hand-made one left is the motion row's off switch",
  homemade.length === 1 && homemade[0] === "RingEditors.tsx Ban",
  homemade.length ? homemade.join(", ") : "none at all — the Ban was expected");

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
const up = await fetch(`${URL_}/builder`).then((r) => r.ok).catch(() => false);
if (!up) {
  notRun.push("the live half"); console.log(`  --   no Builder at ${URL_} — the menus themselves were not opened`);
} else {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let chromium = null;
  /* `playwright-core` is what is installed here, and it was not on this list,
     so even with a Builder up this half took the "no Playwright" door. Two
     silent skips in a row is how a suite reports green while looking at
     nothing. */
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright-core", "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { ({ chromium } = req(c)); break; } catch { /* next */ }
  }
  if (!chromium) { notRun.push("the live half"); console.log("  --   no Playwright — the menus themselves were not opened"); }
  else {
    /* playwright-core ships no browser of its own; this container's is here,
       and every other suite launches it the same way. */
    const browser = await chromium.launch({ headless: true, executablePath: "/opt/pw-browsers/chromium" });
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(250);
    await page.keyboard.type("drop a new idea");
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const nb = await page.locator("[data-node-id]").first().boundingBox();

    const open = async (words) => {
      /* Closed first. A menu left standing at level three does not re-root on
         the next right-click, so every open after the first one found no
         Looks wedge and reported the wedge missing — which is the suite
         leaving its own door open, not the Builder losing a wedge. */
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
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
    /* The wheel's three preview badges. Not chips — you read them, you do not
       pick them — and every one had been its own size: the page's colour
       18x18 at 4px, a part's aura 15x15 at 4px, a part's hue 34x14 at 3px.
       Three heights and two corners, side by side on one wheel.

       READ OFF THE BADGES THEMSELVES, not off anything span-shaped.

       This used to sweep every span on the wheel between 10 and 40px that
       had a background or a child, and call whatever came back a badge. It
       went red, and the thing it had caught was not a badge: a 32x20 square
       with a `title="More"` and an icon inside it, which is the tray's own
       control. The three real badges measured 34x18, 18x18 and 18x18, every
       one at a 6px corner — already one height and one corner, already
       obeying the rule this is about, and failed anyway by a control that
       wandered into the net.

       So the badges carry `data-preview-badge` and this reads that. It is
       the stricter question, not the looser one: the old net could only ever
       catch more things than it should, and a badge that stopped being a
       badge-sized span would have slipped out of it entirely and passed. */
    const badges = async () => page.evaluate(() => {
      const r = document.querySelector("[data-radial]");
      if (!r) return [];
      return [...r.querySelectorAll("[data-preview-badge]")].map((e) => {
        const cs = getComputedStyle(e);
        return { w: Math.round(parseFloat(cs.width)), h: Math.round(parseFloat(cs.height)), r: cs.borderRadius };
      });
    });
    const seen = [];
    for (const [who, words] of [["a part", [/^Looks$/]], ["the page", null]]) {
      if (words) { if (!(await open(words))) continue; }
      else {
        const fr = await page.locator("[data-frame]").first().boundingBox();
        await page.mouse.click(fr.x + fr.width * 0.3, fr.y + fr.height * 0.7, { button: "right" });
        await page.waitForTimeout(600);
        const look = page.locator('[data-radial] [data-shard="look"]').first();
        if (!(await look.count())) continue;
        await look.click({ force: true });
        await page.waitForTimeout(700);
      }
      const got = await badges();
      seen.push(...got);
      check(`${who}'s Looks badges are on screen`, got.length > 0, got.map((g) => `${g.w}x${g.h}`).join(" ") || "none");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
    if (seen.length) {
      const heights = [...new Set(seen.map((b) => b.h))];
      const corners = [...new Set(seen.map((b) => b.r))];
      /* The count first: one badge is trivially one height, so a wheel that
         had lost two of its three would sail past both checks below. */
      check("the wheel carries its preview badges", seen.length >= 3, `${seen.length} of them: ${seen.map((b) => `${b.w}x${b.h}`).join(" ")}`);
      check("every preview badge stands the same height", heights.length === 1, `${heights.join(" and ")}px, from ${seen.length}`);
      check("and takes the same corner", corners.length === 1, `${corners.join(" and ")}, from ${seen.length}`);
      check("a badge carrying several colours is still allowed to be wide",
        seen.some((b) => b.w > b.h), seen.map((b) => `${b.w}x${b.h}`).join(" "));
    }

    await browser.close();
  }
}

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}${notRun.length ? `, ${notRun.length} half not run here` : ""}`);
process.exit(failed ? 1 : 0);
