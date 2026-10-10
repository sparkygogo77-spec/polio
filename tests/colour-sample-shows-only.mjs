#!/usr/bin/env node
/**
 * PRESSING A PIECE OF THE COLOURS PREVIEW ONLY POINTS AT ITS PARTS.
 *
 * J (2026-10-10): pressing the "Menu" sample in Look > Colours drew
 * PonsStars' Menu button (in the hidden nav-menu group; its sample is "Buttons 2") over the Play tab, it
 * stayed after the editor closed, and Undo could not take it off. A press now
 * makes the kind's drawn parts glow and changes nothing: not the parts, not
 * the states the board shows, not the undo list, and no part the board was
 * not drawing appears.
 *
 * PST is opened from its saved board (tests/fixtures/boards/pst.json.gz).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/colour-sample-shows-only.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));

const st = await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
check("PST came in", st.nodes.length > 20, `${st.nodes.length} parts`);

await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);

const read = () => ui.evaluate(() => {
  const d = window.__studioHistory.doc();
  const drawn = [...document.querySelectorAll("[data-studio-pane] [data-node-id]")]
    .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "none")
    .map((el) => el.getAttribute("data-node-id"));
  return { states: JSON.stringify(d.statesOn ?? []), page: d.activePageId, nodes: JSON.stringify(d.nodes), undo: window.__studioUndoDepth(), drawn };
});

const pieces = await ui.evaluate(() => [...document.querySelectorAll("[data-theme-preview] [data-preview-kind]")].map((e) => ({ kind: e.dataset.previewKind, name: e.getAttribute("title") ?? "" })));
check("the Colours preview has pieces to press", pieces.length > 3, pieces.map((p) => p.name.split(":")[0]).join(", "));

const start = await read();
const bad = [];
for (const p of pieces) {
  const at = await read();
  await ui.locator(`[data-theme-preview] [data-preview-kind="${p.kind}"]`).first().evaluate((e) => e.click());
  await ui.waitForTimeout(400);
  const now = await read();
  const was = new Set(at.drawn);
  const appeared = now.page === at.page ? now.drawn.filter((id) => !was.has(id)) : [];
  const why = [
    now.states !== at.states && `states ${at.states} -> ${now.states}`,
    now.nodes !== at.nodes && "parts changed",
    now.undo !== at.undo && `undo ${at.undo} -> ${now.undo}`,
    appeared.length && `${appeared.length} part(s) appeared`,
  ].filter(Boolean);
  if (why.length) bad.push(`${p.name.split(":")[0]}: ${why.join(", ")}`);
}
check("pressing each piece changes no part, no state shown, no undo step, and draws nothing new", bad.length === 0, bad.join("; "));

/* Closing the editor leaves the board as it was before the first press. */
await ui.locator("[data-kind-editor] button", { hasText: "Close" }).first().click().catch(() => {});
await ui.waitForTimeout(300);
const end = await read();
check("after the editor closes, the board shows the same states it did", end.states === start.states, `${start.states} -> ${end.states}`);
check("no errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
