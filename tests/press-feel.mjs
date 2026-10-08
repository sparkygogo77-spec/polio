#!/usr/bin/env node
/**
 * WHAT TRUMPMORTY.FUN DOES THAT ITS COPY DID NOT (the owner's four, 2026-09-30).
 *
 * sink now records, and a captured document carries (sink check-press-feel.mjs):
 * how the page glides to its own places (`behaviours.glide`), what a press
 * flashes and for how long (`behaviours.states[].timing`), a hover that
 * paints the item's background or a pseudo-element it brings, and each
 * animation's own keyframes and longhands. Held here on a stand-in document
 * (all STANDIN data) shaped like trumpmorty.fun's, through the real code:
 * `attachCaptured` (library/captured.ts), `motionCss` (parts/capturedMotion.ts)
 * and the shipped feature scripts (library/works.ts), in a browser:
 *
 *   (1) a nav item that links to a section glides there over
 *       `min(1600, 500 + distance × 0.25)` ms on an ease-in-out cubic, a
 *       header's height short, not a jump;
 *   (2) pressing the CA bar copies, turns its label into "COPIED!" and
 *       slides the toast up from below; the label comes back after 1600 ms,
 *       the toast slides away after 1900 ms, and no toast of the library's
 *       is laid over the page's own;
 *   (3) pointing at a nav item, where the link stretched over it is what
 *       the pointer is on, paints its yellow pill; and a pill that is a
 *       `::before` only there under the hover is drawn;
 *   (4) the LIVE dot's `blink 1s steps(2)` over `50% { opacity: 0 }` runs
 *       its three stages, 1, .5, 0, .5, not two.
 *
 *   node tests/press-feel.mjs
 *
 * Runs alone: times a press's feel (its lift and release over frames); known to fail beside others (owner's note R15).
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { attachCaptured } from "../src/features/studio/shelf/library/captured.ts";
import { motionCss } from "../src/features/studio/shelf/parts/capturedMotion.ts";
import { featureFiles, pageFeatureTags, usesOf } from "../src/features/studio/shelf/library/works.ts";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const { carryOwned } = await jiti.import("../src/features/studio/carry.ts");
const { fluidParts, captureHeight } = await jiti.import("../src/features/studio/fluidSite.ts");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`); };
const J = (x) => JSON.stringify(x);

/* ------------------------------------------------------------ the stand-in document */
const P = "page_home";
const node = (id, sel, x, y, w, h, extra = {}) => ({ id, pageId: P, featureId: "box", x, y, w, h, from: { selector: sel }, ...extra });
const nodes = [
  node("n_header", "body > header", 0, 0, 1200, 64),
  node("n_lore", "body > header > nav > a:nth-of-type(1)", 300, 13, 80, 38, { link: { kind: "node", target: "n_sec_lore" }, motion: { transition: [{ property: "background", duration: "0.2s", timing: "ease", delay: "0s" }], hover: [{ selector: ".nav a:hover", self: true, style: { background: "#f3d440", transform: "rotate(-3deg)" } }] } }),
  node("n_buy", "body > header > nav > a:nth-of-type(2)", 400, 13, 110, 38, { link: { kind: "node", target: "n_sec_buy" }, motion: { hover: [{ selector: ".nav a.ghost:hover::before", self: true, pseudo: "::before", base: { content: '""', position: "absolute", top: "0px", right: "0px", bottom: "0px", left: "0px", "background-color": "rgb(137, 206, 188)", opacity: "0", "border-top-left-radius": "999px" }, style: { opacity: "1" } }] } }),
  node("n_dot", "body > section:nth-of-type(1) > p > i", 20, 100, 14, 14, { motion: { animation: [{ name: "blink", duration: "1s", timing: "steps(2)", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] } }),
  node("n_bar", "body > section:nth-of-type(1) > button", 20, 160, 500, 50),
  node("n_ca", "body > section:nth-of-type(1) > button > span:nth-of-type(1)", 20, 160, 60, 50, { content: "CA" }),
  node("n_copied", "body > section:nth-of-type(1) > button > span:nth-of-type(1)", 20, 160, 100, 50, { content: "COPIED!", state: { group: "g0", option: 0 } }),
  node("n_toast", "body > div", 480, 700, 240, 60, { content: "CA copied!", state: { group: "g0", option: 0 }, motion: { transition: [{ property: "transform", duration: "0.35s", timing: "cubic-bezier(0.2, 0.9, 0.25, 1.2)", delay: "0s" }] } }),
  node("n_sec_lore", "body > section:nth-of-type(2)", 0, 1400, 1200, 1400),
  node("n_sec_buy", "body > section:nth-of-type(3)", 0, 2800, 1200, 1400),
  node("n_sec_end", "body > section:nth-of-type(4)", 0, 4200, 1200, 3000),
];
const keyframes = [{ name: "blink", frames: [{ key: "50%", style: { opacity: "0" } }] }];
const behaviours = {
  version: 1,
  idle: [{ part: "n_dot", name: "blink", css: true, duration: 1000, easing: "linear", delay: 0, direction: "normal" }],
  presses: [{ page: P, part: "n_bar", does: "copy", copy: "STANDIN0MINT0ADDRESS0000000001" }],
  states: [{ page: P, group: "g0", option: 0, name: "Copy CA", part: "n_bar", shows: ["n_copied", "n_toast"], hides: ["n_ca"], timing: [{ part: "n_copied", lasts: 1600 }, { part: "n_toast", lasts: 1900, from: { y: 220 } }, { part: "n_ca", lasts: 1600 }] }],
  glide: { how: "script", ms: { base: 500, perPx: 0.25, max: 1600 }, ease: "ease-in-out-cubic", curve: [], offset: -62 },
};

const out = attachCaptured(nodes, behaviours, keyframes);
const byId = new Map(out.map((n) => [n.id, n]));
const use = (id, w) => usesOf(byId.get(id)?.work).find((u) => u.id === w);

/* ------------------------------------------------------------ attached */
check("(1) a link to a section glides, with the page's time, curve and stop", use("n_lore", "glide")?.inputs?.to === "n_sec_lore" && use("n_lore", "glide")?.inputs?.base === "500" && use("n_lore", "glide")?.inputs?.perPx === "0.25" && use("n_lore", "glide")?.inputs?.max === "1600" && use("n_lore", "glide")?.inputs?.ease === "ease-in-out-cubic" && use("n_lore", "glide")?.inputs?.offset === "-62", J(use("n_lore", "glide")));
check("(1) …and a part with no link to a place does not", !use("n_bar", "glide") && !use("n_dot", "glide"));
check("(2) the CA bar copies what the page copied, quietly: the page's own flash says it", use("n_bar", "copy-toast")?.inputs?.text === "STANDIN0MINT0ADDRESS0000000001" && use("n_bar", "copy-toast")?.inputs?.quiet === "yes", J(use("n_bar", "copy-toast")));
check("(2) …and its press shows what it flashed, each for its time", JSON.parse(use("n_bar", "press-shows")?.inputs?.timing ?? "[]").some((t) => t.part === "n_toast" && t.lasts === 1900 && t.from?.y === 220), J(use("n_bar", "press-shows")));
check("(4) the dot's blink is the page's own animation, every longhand", use("n_dot", "blink")?.inputs?.css === "1s steps(2) 0s infinite normal none cap-blink", J(use("n_dot", "blink")));

{
  /* The bar rises under the pointer, so it carries what is in it on the published page: never a press's parts, which stand where its own words stand. */
  const moving = out.map((n) => (n.id === "n_bar" ? { ...n, motion: { hover: [{ selector: ".ca:hover", self: true, style: { transform: "translate(-2px, -2px)" } }] } } : n));
  const carried = carryOwned(moving).get("n_bar") ?? [];
  check("(2) a bar that moves carries its own words, never the COPIED! its press shows in their place", carried.includes("n_ca") && !carried.includes("n_copied"), J(carried));
}

{
  /* The remote's LED, read while its blink held it dark: a loop whose rule has no 0% or 100% of its own starts from the element's own opacity, never the moment's. */
  const led = { id: "n_led", pageId: P, featureId: "box", x: 0, y: 0, w: 16, h: 16, opacity: 0, from: { selector: "body > div > span" }, motion: { animation: [{ name: "blink", duration: "1.4s", timing: "steps(2)", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] } };
  const kept = { ...led, id: "n_dim", opacity: 0.4, motion: { animation: [{ name: "spin", duration: "2s", timing: "linear", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] } };
  const got = attachCaptured([led, kept], { version: 1, idle: [{ part: "n_led", name: "blink", css: true, duration: 1400 }] }, [...keyframes, { name: "spin", frames: [{ key: "to", style: { transform: "rotate(360deg)" } }] }]);
  const g = (id) => got.find((n) => n.id === id);
  check("(4) a light caught dark keeps no captured opacity: its blink's stops are the rule's, 1, .5, 0", g("n_led").opacity === undefined && usesOf(g("n_led").work).some((u) => u.id === "blink"), J(g("n_led")));
  check("(4) …and a part whose loop does not touch its opacity keeps its own", g("n_dim").opacity === 0.4, J(g("n_dim").opacity));
}
{
  /* The toast: fixed, 28 px above the foot of a 900 px window, `left: 50%` taken back by half its width. */
  const parts = [
    { id: "n_layer", x: 0, y: 0, w: 1440, h: 900, selector: "body > div:nth-of-type(2)", position: "fixed" },
    { id: "n_toast", x: 720, y: 809, w: 221, h: 63, selector: "body > div:nth-of-type(1)", position: "fixed", shiftX: -110.5 },
    { id: "n_side", x: 0, y: 120, w: 200, h: 700, selector: "body > aside", position: "fixed" },
  ];
  const k = fluidParts(parts, 1440);
  const t = k.get("n_toast");
  check("(2) a fixed toast keeps one vertical anchor, the nearest edge (the foot), and is not stretched between both", captureHeight(parts) === 900 && t?.fixed === "bottom", J(t));
  check("(2) …and seen centred in the window, it stays centred in a wider one", t?.left?.c === 720 && Math.abs(t?.left?.k - 0.5) < 1e-9, J(t?.left));
  check("(2) a fixed band that runs most of the window's height still keeps both", k.get("n_side")?.fixed === "both", J(k.get("n_side")));
}

/* ------------------------------------------------------------ the page */
const css = motionCss(out, keyframes, (id) => `#${id}`);
check("(3) a part's own hover also fires from its frame (a link stretched over it)", css.includes("#n_lore:hover .mo-n_lore, .mo-n_lore:hover"), css.split("\n").filter((l) => /n_lore/.test(l)).join(" | "));
check("(3) a hover that brings a ::before draws it", /#n_buy:hover \.mo-n_buy::before, \.mo-n_buy:hover::before \{[^}]*opacity: 1 !important/.test(css), css.split("\n").filter((l) => /n_buy/.test(l)).join(" | "));
const frame = (n, inner = "") => {
  const words = typeof n.content === "string" ? n.content : "";
  const hidden = n.state ? "display:none;" : "";
  const fixed = n.id === "n_toast" || n.id === "n_header" || ["n_lore", "n_buy"].includes(n.id) ? "position:fixed;" : "position:absolute;";
  const link = n.link?.kind === "node" ? `<a class="link-fills-part" href="#${n.link.target}"></a>` : "";
  return `<div id="${n.id}" style="${fixed}${hidden}left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;${n.id === "n_header" ? "background:#fff;z-index:1;" : "z-index:2;"}">${link}<div class="mo mo-${n.id}" style="width:100%;height:100%;border-radius:999px;background:${n.id === "n_dot" ? "#ff4b3e" : n.id.startsWith("n_sec") ? "#eee" : "transparent"}">${words}${inner}</div></div>`;
};
const files = new Map(featureFiles(out).map((f) => [`/${f.path}`, f.content]));
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;height:7200px;position:relative}
a.link-fills-part::after{content:"";position:absolute;inset:0;z-index:1}
${css}</style></head><body>${out.map((n) => frame(n)).join("")}
${pageFeatureTags(out, "/")}</body></html>`;
files.set("/", html);
const server = http.createServer((req, res) => {
  const body = files.get(req.url.split("?")[0]);
  res.writeHead(body ? 200 : 404, { "content-type": req.url.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body ?? "");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://127.0.0.1:${server.address().port}` });
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
await page.waitForTimeout(400);

/* (3) Hover, with the pointer on the stretched link. */
await page.mouse.move(340, 32);
await page.waitForTimeout(350);
const lore = await page.evaluate(() => { const t = document.elementFromPoint(340, 32); return { on: t.className, bg: getComputedStyle(document.querySelector(".mo-n_lore")).backgroundColor }; });
check("(3) pointing at the nav item, on its stretched link, paints its yellow pill", /link-fills-part/.test(lore.on) && lore.bg === "rgb(243, 212, 64)", J(lore));
await page.mouse.move(455, 32);
await page.waitForTimeout(350);
const buy = await page.evaluate(() => getComputedStyle(document.querySelector(".mo-n_buy"), "::before").opacity);
check("(3) …and the one whose pill is a ::before draws it", buy === "1", buy);
await page.mouse.move(600, 500);

/* (4) The blink's stages. */
const stages = await page.evaluate(() => new Promise((done) => {
  const el = document.getElementById("n_dot"), seen = new Set(), t0 = performance.now();
  /* What shows: the dot's box times its drawing (the blink runs on the red layer the box holds, library/behaviours.ts BLINK). */
  const shows = () => [el, ...el.children].reduce((o, x) => o * Number(getComputedStyle(x).opacity), 1);
  (function go() { seen.add(shows().toFixed(2)); if (performance.now() - t0 < 1100) requestAnimationFrame(go); else done([...seen].sort()); })();
}));
check("(4) the LIVE dot runs three stages, 1, .5 and 0, not two", J(stages) === J(["0.00", "0.50", "1.00"]), J(stages));

/* (1) The glide. */
const glide = await page.evaluate(() => new Promise((done) => {
  const got = [], t0 = performance.now();
  document.querySelector("#n_buy a").click();
  (function go(now) { got.push([now - t0, scrollY]); if (now - t0 < 1600) requestAnimationFrame(go); else done(got); })(t0);
}));
const target = Math.min(2800 - 62, 7200 - 800), T = Math.min(1600, 500 + target * 0.25);
const cubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const worst = Math.max(...glide.filter(([t]) => t > 20).map(([t, y]) => Math.abs(y - target * cubic(Math.min(1, t / T)))));
check("(1) pressing How to buy glides to its section over the page's time and curve, a header's height short", Math.abs(glide.at(-1)[1] - target) < 1 && worst < 40 && glide.some(([t, y]) => t > 200 && y > 5 && y < target - 5), J({ end: glide.at(-1), worst: Math.round(worst), T }));
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(200);

/* (2) The flash. */
const shown = () => page.evaluate(() => Object.fromEntries(["n_ca", "n_copied", "n_toast"].map((id) => { const e = document.getElementById(id); return [id, getComputedStyle(e).display !== "none" ? Math.round(e.getBoundingClientRect().top) : null]; })));
await page.mouse.click(300, 185);
await page.waitForTimeout(60);
const early = await shown();
await page.waitForTimeout(500);
const at500 = await shown();
const toasts = await page.evaluate(() => document.querySelectorAll("[data-feature-toast]").length);
const copied = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
await page.waitForTimeout(1300);
const at1800 = await shown();
await page.waitForTimeout(700);
const at2500 = await shown();
check("(2) pressing the bar copies the address", copied === "STANDIN0MINT0ADDRESS0000000001", copied);
check("(2) …COPIED! stands in for CA, and the toast is sliding up from below", early.n_ca === null && early.n_copied !== null && early.n_toast !== null && early.n_toast > 700, J(early));
check("(2) …the toast is up in its place by half a second", at500.n_toast === 700, J(at500));
check("(2) …and no toast of the library's is laid over the page's own", toasts === 0, toasts);
check("(2) CA is back after 1600 ms, the toast still up", at1800.n_ca !== null && at1800.n_copied === null && at1800.n_toast !== null, J(at1800));
check("(2) the toast is gone after 1900 ms", at2500.n_toast === null, J(at2500));

await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
