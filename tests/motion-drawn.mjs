#!/usr/bin/env node
/**
 * A CAPTURED PAGE'S OWN MOTION AND EMBEDS ARE REPLAYED (sink docs/motion.md).
 *
 * A stand-in document, shaped as sink's converter writes one, holds one of
 * each: `keyframes` at the top; a part with an animation; a button with a
 * transition and a `:hover` of its own (a transform and a fill); a knob
 * whose `:hover` belongs to the card round it (`.card:hover .knob`); a
 * folded title whose letters each carry their own transform, animation
 * delay and, for one, colour and size; and an iframe as `node.embed`. It is
 * put on the board the way an import puts one (`__studioLoadDoc`), then:
 *
 *   · the import keeps the keyframes (in the look, beside the fonts);
 *   · the board draws the title as one part, each letter its own span at
 *     its captured transform, and the embed as a still with its host;
 *   · the preview runs the animation under a prefixed name, the hover moves
 *     the button, the card's hover turns the knob, the letters wobble on
 *     their own delays, and the embed is a sandboxed iframe filling its box;
 *   · the export carries the same in its one stylesheet, and served on its
 *     own (no app) does the same; with reduced motion asked for, nothing
 *     animates.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/motion-drawn.mjs http://127.0.0.1:3013 [screenshot dir]
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SHOTS = process.argv[3] ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The frame's own page, and later the export, from one local server. */
let files = new Map();
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/embed") { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><body style='margin:0;background:#123;color:#fff'>a stand-in chart</body>"); return; }
  const f = files.get(path.replace(/^\//, "") || "index.html") ?? files.get(`${path.replace(/^\//, "")}/index.html`);
  if (f === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(f);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const EMBED = `http://127.0.0.1:${PORT}/embed`;

const at = Date.parse("2026-09-27T00:00:00Z");
const base = (id, over) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x: 0, y: 0, w: 100, h: 100,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null,
  mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  from: { url: "http://stand.in/", host: "stand.in", selector: `body > ${id}`, at }, ...over,
});
const wob = (delay) => ({ animation: [{ name: "wob", duration: "2.6s", timing: "ease-in-out", delay, iterations: "infinite", direction: "normal", fill: "none" }] });
const TF = (y) => `matrix(1, 0, 0, 1, 0, ${y})`;
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    base("n_box_1", { x: 40, y: 40, w: 120, h: 120, colour: { bg: "rgb(0, 170, 0)", surface: "rgb(0, 170, 0)" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > div:nth-of-type(1)", at },
      motion: { animation: [{ name: "spin", duration: "2s", timing: "linear", delay: "0s", iterations: "infinite", direction: "normal", fill: "none" }] } }),
    base("n_ctaprimary_2", { featureId: "cta-primary", content: "Press", label: "Press", x: 220, y: 60, w: 160, h: 60, colour: { bg: "rgb(255, 51, 0)", accent: "rgb(255, 51, 0)", text: "rgb(255, 255, 255)" },
      options: { shape: "square", variant: "solid", size: "medium" }, edge: { width: 0, style: "none" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > a", at },
      motion: { transition: [{ property: "transform", duration: "0.3s", timing: "ease-out", delay: "0s" }], hover: [{ selector: ".btn:hover", self: true, style: { transform: "translateY(-3px)", background: "rgb(0, 204, 255)" } }] } }),
    base("n_box_3", { x: 440, y: 40, w: 300, h: 160, colour: { bg: "rgb(238, 238, 238)", surface: "rgb(238, 238, 238)" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > div:nth-of-type(2)", at } }),
    base("n_box_4", { x: 460, y: 60, w: 40, h: 40, colour: { bg: "rgb(51, 51, 51)", surface: "rgb(51, 51, 51)" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > div:nth-of-type(2) > div > i", at },
      motion: { transition: [{ property: "transform", duration: "0.01s", timing: "linear", delay: "0s" }], hover: [{ selector: ".card:hover .knob", self: false, style: { transform: "rotate(90deg)" } }] } }),
    base("n_valueprop_5", { featureId: "value-prop", label: "STAND IN", x: 40, y: 260, w: 700, h: 120, font: { size: 3, weight: 400 }, colour: { text: "rgb(255, 255, 255)" },
      options: { turn: "none" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > h1", at },
      art: { textShadow: "rgb(0, 0, 0) 6px 6px 0px", textStroke: { w: 4, color: "rgb(0, 0, 0)" }, paintOrder: "stroke" },
      content: [
        { text: "S", transform: TF(-2), motion: wob("0s") }, { text: "T", transform: TF(-3), motion: wob("-0.2s") },
        { text: "A", colour: "rgb(255, 255, 0)", size: 40, transform: TF(-1), motion: wob("-0.4s") }, { text: "N", transform: TF(-2), motion: wob("-0.6s") },
        { text: "D", transform: TF(-1), motion: wob("-0.8s") }, { text: " " }, { text: "I", transform: TF(-2), motion: wob("-0.5s") }, { text: "N", transform: TF(-2), motion: wob("-0.7s") },
      ] }),
    /* A link whose words are a part of their own, drawn over its box: pointing at the words is pointing at the link, and they move with it. */
    base("n_box_7", { x: 800, y: 60, w: 200, h: 60, colour: { bg: "rgb(255, 204, 0)", surface: "rgb(255, 204, 0)" }, from: { url: "http://stand.in/", host: "stand.in", selector: "body > p > a", at },
      motion: { transition: [{ property: "transform", duration: "0.01s", timing: "linear", delay: "0s" }], hover: [{ selector: ".btn:hover", self: true, style: { transform: "translate(-3px, -3px)" } }] } }),
    base("n_prose_8", { featureId: "prose", content: "Go", label: "Go", x: 820, y: 70, w: 120, h: 40, from: { url: "http://stand.in/", host: "stand.in", selector: "body > p > a > span", at } }),
    base("n_box_6", { x: 40, y: 420, w: 400, h: 300, label: "Iframe “Stand-in chart” · 127.0.0.1", from: { url: "http://stand.in/", host: "stand.in", selector: "body > iframe", at },
      embed: { src: EMBED, title: "Stand-in chart", allow: "fullscreen", loading: "lazy", size: { w: 400, h: 300 } } }),
  ],
  groups: [], shapes: [],
  format: { "palette.mode": "light", "layout.radius": 0, "type.baseSize": 16 },
  brief: { name: "Stand in", gimmick: "", master: "" },
  look: { palette: { bg: "rgb(255, 255, 255)", text: "rgb(0, 0, 0)" }, texture: [], target: "page" },
  motion: [], activePageId: "page_home", hiddenFeatures: [], frameWidth: 1200, companion: null,
  keyframes: [
    { name: "spin", frames: [{ key: "0%", style: { transform: "rotate(0deg)" } }, { key: "100%", style: { transform: "rotate(360deg)" } }] },
    { name: "wob", frames: [{ key: "0%, 100%", style: { transform: "translateY(0px)" } }, { key: "50%", style: { transform: "translateY(-6px)" } }] },
    { name: "evil", frames: [{ key: "0%", style: { color: "red} body{display:none" } }] },
  ],
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Stand in", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(2000);

/* ------------------------------------------------------------ the import */
const s = await page.evaluate(() => window.__studioPublishDoc?.() ?? JSON.parse(localStorage.getItem("builder.studio") || "{}").state);
check("the import keeps the page's keyframes, in the look", (s?.look?.keyframes ?? []).map((k) => k.name).join(",") === "spin,wob,evil", JSON.stringify(s?.look?.keyframes?.map((k) => k.name)));
check("…and every part's motion and embed", s?.nodes?.find((n) => n.id === "n_box_1")?.motion?.animation?.[0]?.name === "spin" && s?.nodes?.find((n) => n.id === "n_box_6")?.embed?.src === EMBED);

/* ------------------------------------------------------------ the board */
const board = await page.evaluate(() => {
  const title = document.querySelector('[data-node-id="n_valueprop_5"] [data-part]');
  const spans = title ? [...title.querySelectorAll("span")].filter((x) => x.textContent.length === 1 && x.textContent.trim()) : [];
  const embed = document.querySelector('[data-node-id="n_box_6"]');
  return {
    words: title?.textContent ?? null,
    letters: spans.map((x) => ({ t: x.textContent, d: getComputedStyle(x).display, tf: getComputedStyle(x).transform, c: getComputedStyle(x).color, fs: getComputedStyle(x).fontSize })),
    iframe: !!embed?.querySelector("iframe"),
    embedSays: embed?.querySelector("[data-embed-still]")?.textContent ?? "",
  };
});
check("the board draws the title as one part reading STAND IN", board.words === "STAND IN", JSON.stringify(board.words));
check("…each letter its own inline-block span at its captured transform", board.letters.length === 7 && board.letters.every((l) => l.d === "inline-block" && /matrix\(1, 0, 0, 1, 0, -\d/.test(l.tf)), JSON.stringify(board.letters));
check("…the letter coloured apart in its colour and size", board.letters.some((l) => l.t === "A" && l.c === "rgb(255, 255, 0)" && l.fs === "40px"), JSON.stringify(board.letters.find((l) => l.t === "A")));
check("the board draws the embed as a still naming its host, not a live frame", !board.iframe && /127\.0\.0\.1/.test(board.embedSays), JSON.stringify(board));
if (SHOTS) await page.screenshot({ path: join(SHOTS, "board.png") });

/* ------------------------------------------------------------ the preview */
async function motionChecks(p, where, tpl) {
  const at = (id) => tpl.replace("ID", id);
  const got = await p.evaluate((tpl) => {
    const at = (id) => tpl.replace("ID", id);
    const q = (id) => document.querySelector(at(id));
    const box = (id) => q(id)?.querySelector(".mo-" + id) ?? null;
    const spin = box("n_box_1");
    const title = q("n_valueprop_5");
    const letters = title ? [...title.querySelectorAll("span")].filter((x) => x.textContent.trim().length === 1) : [];
    const frame = q("n_box_6")?.querySelector("iframe");
    const fr = frame?.getBoundingClientRect(), hr = q("n_box_6")?.getBoundingClientRect();
    const sheets = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules].map((r) => r.cssText); } catch { return []; } }).join("\n");
    return {
      spin: spin ? getComputedStyle(spin).animationName : null,
      keyframes: /@keyframes cap-spin/.test(sheets) && /@keyframes cap-wob/.test(sheets),
      evil: /cap-evil[^]*?display/.test(sheets.split("\n").filter((l) => /cap-evil/.test(l)).join("\n")),
      letters: letters.map((x) => ({ name: getComputedStyle(x).animationName, delay: getComputedStyle(x).animationDelay })),
      frame: frame ? { src: frame.getAttribute("src"), sandbox: frame.getAttribute("sandbox"), allow: frame.getAttribute("allow"), w: Math.round(fr.width), h: Math.round(fr.height), hw: Math.round(hr.width) } : null,
    };
  }, tpl);
  check(`${where}: the part runs its animation under the prefixed name`, got.spin === "cap-spin", String(got.spin));
  check(`${where}: the keyframes are there, prefixed`, got.keyframes);
  check(`${where}: a keyframe value that would leave its declaration is not written`, !got.evil);
  check(`${where}: every letter wobbles on its own delay`, got.letters.length === 7 && got.letters.every((l) => l.name === "cap-wob") && new Set(got.letters.map((l) => l.delay)).size === 7, JSON.stringify(got.letters));
  check(`${where}: the embed is a sandboxed iframe of its address filling its box`, got.frame?.src === EMBED && !!got.frame.sandbox && got.frame.allow === "fullscreen" && got.frame.w >= 398 && got.frame.h >= 298, JSON.stringify(got.frame));
  const tf = (id) => p.evaluate((sel) => { const b = document.querySelector(sel.part)?.querySelector(sel.box); return b ? { tf: getComputedStyle(b).transform, bg: getComputedStyle(b).backgroundColor } : null; }, { part: at(id), box: `.mo-${id}` });
  const btn = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, at("n_ctaprimary_2"));
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  const before = await tf("n_ctaprimary_2");
  await p.mouse.move(btn.x, btn.y); await p.waitForTimeout(600);
  const hovered = await tf("n_ctaprimary_2");
  check(`${where}: hovering the button lifts it and fills it as the page did`, before?.tf === "none" && hovered?.tf === "matrix(1, 0, 0, 1, 0, -3)" && hovered?.bg === "rgb(0, 204, 255)", JSON.stringify({ before, hovered }));
  if (SHOTS) await p.screenshot({ path: join(SHOTS, `${where}-hover.png`) });
  const words = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, at("n_prose_8"));
  await p.mouse.move(5, 5); await p.waitForTimeout(300);
  await p.mouse.move(words.x, words.y); await p.waitForTimeout(400);
  const link = await tf("n_box_7");
  const inner = await p.evaluate((sel) => getComputedStyle(document.querySelector(sel)).transform, at("n_prose_8"));
  check(`${where}: pointing at a link's words, a part of their own over its box, hovers the link, and the words move with it`, link?.tf === "matrix(1, 0, 0, 1, -3, -3)" && inner === "matrix(1, 0, 0, 1, -3, -3)", JSON.stringify({ link, inner }));
  const card = await p.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width - 20, y: r.y + r.height - 20 }; }, at("n_box_3"));
  await p.mouse.move(5, 5); await p.waitForTimeout(300);
  const knob0 = await tf("n_box_4");
  await p.mouse.move(card.x, card.y); await p.waitForTimeout(400);
  const knob1 = await tf("n_box_4");
  check(`${where}: hovering the card turns the knob inside it (a hover keyed on its ancestor)`, knob0?.tf === "none" && /^matrix\(0(\.0+\d*)?, 1, -1, 0/.test(knob1?.tf ?? "") , JSON.stringify({ knob0, knob1 }));
}

await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await motionChecks(page, "preview", '[data-live-node="ID"]');

/* ------------------------------------------------------------ the export */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const out = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: typeof f.content === "string" ? f.content : null })));
files = new Map(out.filter((f) => f.content !== null).map((f) => [f.path, f.content]));
const css = files.get("assets/site.css") ?? "";
check("the export's stylesheet holds the prefixed keyframes, the animation and the hover", /@keyframes cap-spin/.test(css) && /\.mo-n_box_1 \{ animation: 2s linear 0s infinite normal none cap-spin/.test(css) && /\.mo-n_ctaprimary_2:hover/.test(css), css.slice(css.indexOf("@keyframes"), css.indexOf("@keyframes") + 300));
check("…and asks for nothing to move under reduced motion", /prefers-reduced-motion: reduce/.test(css));
check("…and writes no keyframes rule whose frames held nothing it could write safely", !/cap-evil/.test(css) && !/display:\s*none/.test(css.slice(css.indexOf("@keyframes"))));
check("…the page carries no motion stylesheet of its own", !/@keyframes/.test(files.get("index.html") ?? ""));
const site = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
await site.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await site.waitForTimeout(1500);
await motionChecks(site, "export", "#ID");
if (SHOTS) await site.screenshot({ path: join(SHOTS, "export.png") });
const calm = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce" });
await calm.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await calm.waitForTimeout(800);
const still = await calm.evaluate(() => ({ spin: (() => { const b = document.querySelector("#n_box_1 .mo-n_box_1"); return b ? getComputedStyle(b).animationName : null; })(), letter: [...document.querySelectorAll("#n_valueprop_5 span")].map((x) => getComputedStyle(x).animationName).filter((n) => n !== "none").length }));
check("with reduced motion asked for, nothing animates", still.spin === "none" && still.letter === 0, JSON.stringify(still));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
