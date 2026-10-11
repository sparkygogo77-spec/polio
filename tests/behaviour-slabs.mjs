#!/usr/bin/env node
/**
 * ANIMATION > BEHAVIOUR LIGHTS ONE SCREEN PER CONTROL, NOT THREE.
 *
 * Dissect #51: the Behaviour editor drew the three screens every animation
 * editor gets, and filled one of them — no part in the catalog has more than
 * one motion option (a ticker's speed, a slideshow's autoplay, a top bar's
 * on-scroll) — so two lit screens sat empty beside the one control and the
 * editor looked broken (docs/DESIGN.md, "Never an empty slab"). The console
 * now has as many slabs as the part has motion options.
 *
 *   1. A Scrolling ticker's wheel, Animation > Behaviour: one slab, one
 *      screen, one stepper (Speed), and its Next key moves it on.
 *   2. Animation > Entrance on the same part still has its three slabs.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/behaviour-slabs.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/radial/RadialMenu.tsx, src/features/studio/RingEditors.tsx, src/features/studio/radial/choices.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const board = boardWith([
  part("n_ticker", 200, 240, 700, 80, { featureId: "marquee", label: "Scrolling ticker", content: "$PONS · $PONS · $PONS" }),
  part("n_box", 200, 520, 400, 240),
]);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);

  const nb = await ui.locator('[data-node-id="n_ticker"]').first().boundingBox();
  await ui.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2, { button: "right" });
  await ui.waitForTimeout(600);
  await ui.locator('[data-radial] [data-shard="anim"]').first().click({ force: true });
  await ui.waitForTimeout(500);
  const behaviour = ui.locator('[data-radial] [data-shard="behaviour"]').first();
  check("the ticker's Animation offers Behaviour", (await behaviour.count()) === 1);
  await behaviour.click({ force: true });
  await ui.waitForTimeout(600);

  /* 1. */
  const ed = ui.locator('[data-radial-editor="behaviour"]');
  const slabs = await ed.locator("[data-console-slab]").count();
  const faces = await ed.locator("[data-screen-face]").count();
  const steppers = await ed.locator("[data-arc-stepper]").count();
  check("1. Behaviour draws one slab for the ticker's one motion option", slabs === 1, `${slabs} slabs`);
  check("…one lit screen, and it holds the control", faces === 1 && steppers === 1, `${faces} screens, ${steppers} steppers`);
  const stepper = ed.locator('[data-arc-stepper="Speed"]').first();
  check("…the control is the ticker's Speed", (await stepper.count()) === 1);
  const valueOf = async () => stepper.locator("[data-stepper-value]").first().getAttribute("data-stepper-value");
  const before = await valueOf();
  await stepper.locator('[data-step="next"]').first().click({ force: true });
  await ui.waitForTimeout(300);
  const after = await valueOf();
  check("…and its Next key moves Speed on", before !== null && after !== null && before !== after, `${before} → ${after}`);

  /* 2. */
  await ui.locator('[data-radial] [data-shard="entrance"]').first().click({ force: true });
  await ui.waitForTimeout(600);
  const entrance = await ui.locator('[data-radial-editor="entrance"] [data-console-slab]').count();
  check("2. Entrance on the same part still has its three slabs", entrance === 3, `${entrance} slabs`);

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
