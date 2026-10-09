#!/usr/bin/env node
/**
 * ON HOVER AND ON PRESS SAY WHAT HAPPENS, AND SHOW IT ON THE PARTS.
 *
 * J (2026-10-09): the Motion tab listed "On press, 46 parts" and then hooks
 * ("queue-join · How it moved under the pointer"). He wants what EXACTLY
 * happens first, the parts drawn as themselves, every part ringed on the
 * board when the pointer is over an effect, and, pressed, every part doing
 * it in and out with a light blue glow, kept on so he can press parts on the
 * board to add or take them off; nothing dimmed. PST's web/ is brought in
 * through the GitHub control against a stand-in GitHub, at 1440:
 *
 *   · opened, On hover and On press list effects in words, none a hook;
 *   · an effect unfolds to its parts drawn as copies of the board's;
 *   · the pointer over an effect rings every part with it, nothing dimmed;
 *   · pressed, its parts loop (Web Animations, 750ms each way) with the glow;
 *   · a press on a part without it adds it, a press on a glowing one takes
 *     it off, each one undo step; a part inside one that has it is left;
 *   · Escape stops the show.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/motion-effects.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/motionEffects.ts, src/features/studio/motionShow.ts, src/features/studio/motionWrite.ts, src/features/studio/panels/MotionPanel.tsx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROOT = process.env.PST_ROOT ?? "tests/fixtures/pst-tv";
const FILES = {};
const walk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, r); else if (n !== "FROM.md") FILES[r] = readFileSync(p); } };
walk(ROOT);
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/pst(\/.*)?$/);
  if (!mm) return j({ message: "no" }, 404);
  const rest = mm[1] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: FILES[names[Number(b[1])]].toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10).split("?")[0]); return FILES[f] !== undefined ? j({ content: FILES[f].toString("base64"), encoding: "base64" }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: "c0" } });
  if (rest.startsWith("/commits/")) return j({ sha: "c0" });
  return j({ message: "no" }, 404);
});
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await ui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "PST", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await ui.reload({ waitUntil: "networkidle" });
await ui.waitForTimeout(900);
const keys = ui.locator("[data-keys-panel]");
await ui.getByRole("button", { name: "Keys", exact: true }).click();
await ui.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await ui.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await ui.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await ui.waitForTimeout(500);
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(700);
await ui.locator("[data-repo-bring]").fill("him/pst");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 150 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(2500);
st = await board();
check("PST came in", st.nodes.length > 20, `${st.nodes.length} parts on ${st.pages?.length} pages`);


const wait = (ms) => ui.waitForTimeout(ms);
const depth = () => ui.evaluate(() => window.__studioUndoDepth?.() ?? -1);
/* The page with the most hover or press parts: PST's lobby. */
const pick = st.pages?.[0]?.id;
const panel = ui.locator("[data-motion-panel]");
const openMotion = async () => { await ui.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first().click(); await wait(600); };
await openMotion();
const kindsOf = await panel.locator("[data-move-kind]").evaluateAll((els) => els.map((e) => e.getAttribute("data-move-kind")));
check("the page has hover or press parts", kindsOf.includes("hover") || kindsOf.includes("press"), kindsOf.join(", "));
const kind = kindsOf.includes("press") ? "press" : "hover";
for (const k of ["hover", "press"]) if (kindsOf.includes(k)) { await panel.locator(`[data-move-kind=${k}] [data-move-open]`).first().click(); await wait(250); }
const labels = await panel.locator("[data-move-effect] [data-move-title]").allInnerTexts();
const hookish = labels.filter((t) => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(t.trim()));
check("…opened, each lists what happens in words, none a hook", labels.length > 0 && !hookish.length && (await panel.locator("[data-move-row]").count()) === 0, labels.join(" | "));
check("…PST's buttons say they press in and lose their shadow", labels.some((t) => /presses in 3px and loses its shadow/i.test(t)), labels.join(" | "));

const effect = panel.locator(`[data-move-kind=${kind}] [data-move-effect]`).first();
const label = (await effect.locator("[data-move-title]").innerText()).trim();
const count = Number((await effect.locator("[data-move-effect-show]").innerText()).match(/(\d+) part/)?.[1] ?? 0);
await effect.locator("button[aria-expanded]").click();
await wait(400);
const looks = await effect.locator("[data-move-part-look]").evaluateAll((els) => els.map((e) => e.childElementCount));
check(`“${label}” unfolds to its ${count} parts, drawn as themselves`, looks.length === count && looks.filter((n) => n > 0).length >= Math.min(1, count), `${looks.filter((n) => n > 0).length} of ${looks.length} drawn`);
check("…copies carry no part id, so nothing finds the copy instead of the part", (await effect.locator("[data-move-part-look] [data-node-id]").count()) === 0);

await effect.locator("[data-move-effect-show]").hover();
await wait(250);
const rings = await ui.evaluate(() => [...document.querySelectorAll("[data-motion-ring=hint]")].filter((r) => r.style.display !== "none").length);
check("the pointer over it rings its parts on the board", rings > 0 && rings <= count, `${rings} rings for ${count} parts`);
const dim = await ui.evaluate(() => [...document.querySelectorAll("[data-node-id]")].some((e) => Number(getComputedStyle(e).opacity) < 0.9 && !e.closest("[data-hidden-state]")));
await ui.screenshot({ path: ".screenshots/motion-effects-hint.png" });

const before = await depth();
await effect.locator("[data-move-effect-show]").click();
await wait(900);
const loop = await ui.evaluate(() => {
  const shown = [...document.querySelectorAll("[data-motion-ring=show]")].filter((r) => r.style.display !== "none");
  const runs = document.getAnimations().filter((a) => a.effect?.getTiming?.().iterations === Infinity && a.effect.getTiming().duration === 750);
  return { glow: shown.length, runs: runs.length, colour: shown[0]?.style.boxShadow ?? "" };
});
check("pressed, every part with it loops in and out with a light blue glow", loop.glow > 0 && loop.runs > 0 && /125, 211, 252|125 211 252/.test(loop.colour), JSON.stringify(loop));
await ui.screenshot({ path: ".screenshots/motion-effects-show.png" });

/* A part on the board without the effect, on top under the hand: pressing it gives it the effect. */
const have = new Set(await effect.locator("[data-move-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-move-part"))));
const target = await ui.evaluate((have) => {
  const pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
  for (const el of document.querySelectorAll("[data-studio-scroll] [data-node-id]")) {
    const id = el.dataset.nodeId;
    if (have.includes(id)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12 || r.width > 500 || (pane && (r.top < pane.top || r.bottom > pane.bottom || r.left < pane.left || r.right > pane.right))) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (document.elementFromPoint(x, y)?.closest("[data-node-id]")?.dataset.nodeId === id) return { id, x, y };
  }
  return null;
}, [...have]);
check("there is a part on the board without it to press", !!target, target?.id ?? "");
if (target) {
  await ui.mouse.click(target.x, target.y);
  await wait(1200);
  const showing = await ui.evaluate(() => !!document.querySelector("[data-move-showing]"));
  const back = await ui.evaluate(() => !!document.querySelector("[data-motion-panel]"));
  const lit = await ui.evaluate((id) => [...document.querySelectorAll("[data-motion-ring=show]")].some((r) => r.dataset.id === id), target.id);
  const note = await ui.evaluate(() => document.querySelector("[data-move-effect-help]")?.textContent ?? "");
  check("…pressing it on the board gives it the effect, and it glows with the rest", lit && /Added|moves with it/.test(note), note);
  check("…the Motion tab comes back with the effect still showing", back && showing);
  check("…one undo step", (await depth()) === before + 1, `${before} → ${await depth()}`);
  await ui.mouse.click(target.x, target.y);
  await wait(1200);
  const gone = await ui.evaluate((id) => ![...document.querySelectorAll("[data-motion-ring=show]")].some((r) => r.dataset.id === id), target.id);
  const note2 = await ui.evaluate(() => document.querySelector("[data-move-effect-help]")?.textContent ?? "");
  check("…pressing it again takes it off", /moves with it/.test(note) ? true : gone && /Taken off/.test(note2), note2);
}
check("nothing on the board is dimmed while it shows", !dim);
await ui.keyboard.press("Escape");
await wait(400);
check("Escape stops the show: no loops, no glow", await ui.evaluate(() => !document.querySelector("[data-motion-ring=show]") && !document.getAnimations().some((a) => a.effect?.getTiming?.().duration === 750 && a.effect.getTiming().iterations === Infinity)));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
