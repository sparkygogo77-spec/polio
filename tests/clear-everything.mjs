#!/usr/bin/env node
/**
 * CLEAR EVERYTHING CLEARS EVERYTHING, AND ONE UNDO PUTS ALL OF IT BACK.
 *
 * The confirm says every page, element, drawing and prompt goes. It took the
 * parts but left the shelf PST brought (its 120 parts still offered) and the
 * record of the import behind; and Ctrl+Z after it brought the parts back but
 * not the timeline of updates, which the clear had wiped for good.
 *
 *   1. on the saved PST board, Clear everything (Ctrl+K, confirm) leaves no
 *      parts, no brought-in site or its parts, no import record, no timeline;
 *   2. Ctrl+Z brings back the parts, the brought-in site and its parts, the
 *      import record and the updates the board had before the clear.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/clear-everything.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/store/threads.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/history.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { boardDoc, dumpBoard, openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sum = (d) => ({ nodes: d.nodes?.length ?? 0, brought: d.brought?.length ?? 0, broughtParts: d.broughtParts?.length ?? 0, threads: d.threads?.length ?? 0, taken: !!d.taken, swept: d.swept ?? null, statesOn: d.statesOn?.length ?? 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());

const before = sum(await openBoard(ui, URL_BASE, "pst"));
console.log("before:", JSON.stringify(before));

/* 1. */
await ui.keyboard.press("Control+k");
await ui.waitForTimeout(400);
await ui.keyboard.type("clear everything");
await ui.waitForTimeout(400);
await ui.keyboard.press("Enter");
await ui.waitForTimeout(500);
await ui.getByRole("button", { name: /^Clear$/ }).first().click();
await ui.waitForTimeout(1500);
const cleared = sum(boardDoc(await dumpBoard(ui)));
check("1. Clear everything leaves no parts", cleared.nodes === 0 && before.nodes > 0, JSON.stringify(cleared));
check("…no brought-in site and none of its parts on the shelf", cleared.brought === 0 && cleared.broughtParts === 0 && before.brought > 0);
check("…no import record, no sweep, no states", !cleared.taken && cleared.swept === null && cleared.statesOn === 0);
check("…and no timeline", cleared.threads === 0);

/* 2. */
await ui.mouse.click(1300, 450);
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(1500);
const undone = sum(boardDoc(await dumpBoard(ui)));
check("2. Ctrl+Z brings every part back", undone.nodes === before.nodes, `${undone.nodes} of ${before.nodes}`);
check("…the brought-in site and its parts", undone.brought === before.brought && undone.broughtParts === before.broughtParts, JSON.stringify(undone));
check("…the import record", undone.taken === before.taken && undone.swept === before.swept && undone.statesOn === before.statesOn);
check("…and the timeline it had", undone.threads >= Math.max(1, before.threads), `${undone.threads} threads, ${before.threads} before`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
