/**
 * A CANVAS WORLD'S CHARACTERS OPEN THEIR DIALOGS.
 *
 * sink reads a canvas the page walks characters on (parasiteonsol.fun's pets)
 * into `node.world`: per character, where it stands in each frame of the
 * flipbook and the dialog pressing it opened, dressed in the page's own look
 * (sink worlds.mjs, check-worlds.mjs). Live, the picture part draws an
 * invisible press area over each character that follows it frame by frame,
 * and the dialogs, closed; the `world-dialogs` feature opens one on a press
 * and closes it by its close button, Escape or a press outside. The dialog's
 * buttons and fields keep their words and the page's own attributes, and are
 * marked `data-world-control`; none of them does anything. All STANDIN data.
 *
 *   node tests/world-dialogs.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { chromium } = require("playwright-core");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const S = (...p) => join(here, "..", "src", "features", "studio", ...p);
const { Block } = await jiti.import(S("blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(S("shelf", "parts", "theme.ts"));
const { attachCaptured } = await jiti.import(S("shelf", "library", "captured.ts"));
const { BEHAVIOURS } = await jiti.import(S("shelf", "library", "behaviours.ts"));
const { RUNTIME_JS, usesOf } = await jiti.import(S("shelf", "library", "works.ts"));
const { polioMd } = await jiti.import(S("polioMd.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

/* ---------------------------------------------------------------- STANDIN world: a 400×200 canvas, three frames of 300ms */
const CW = 400, CH = 200, EVERY = 300, FRAMES = 3;
const A = [[0.1, 0.2, 0.1, 0.2], [0.3, 0.2, 0.1, 0.2], [0.5, 0.2, 0.1, 0.2]];
const B = [[0.7, 0.6, 0.1, 0.2], [0.7, 0.6, 0.1, 0.2], null];
const dialog = (mint, ticker) => `<dialog class="sw0" data-dlg="para" data-mint="${mint}" aria-labelledby="pd-h">`
  + `<button class="sw1" type="button" data-close="" aria-label="Close" data-world-control="close" data-world-close="">×</button>`
  + `<div class="sw2"><h2 id="pd-h" class="sw3">${ticker}</h2><p class="sw3">Parasite</p>`
  + `<label class="sw2"><input class="sw4 sw5-p" data-world-el="20" data-bsol-in="" type="text" value="0.5" aria-label="Amount in SOL" data-world-control="amount-in-sol" data-world-does="native"><span class="sw3">SOL</span></label>`
  + `<div class="sw2" role="radiogroup" aria-label="Preset">${["0.1", "0.5", "1"].map((v, i) => `<button class="${v === "0.5" ? "sw7" : "sw1"}" data-world-el="${21 + i}" type="button" role="radio" data-bsol="${v}" aria-checked="${v === "0.5"}" data-world-control="${v.replace(".", "-")}" data-world-does="ui" data-world-change="${attrJson(["0.1", "0.5", "1"].map((w, j) => ({ e: 21 + j, a: { "aria-checked": String(w === v) }, c: w === v ? "sw7" : "sw1" })).concat([{ e: 20, v, c: "sw4 sw5-p" }]))}">${v}</button>`).join("")}</div>`
  + `<button class="sw6" type="button" data-buysol="" data-world-control="buy-with-sol" data-world-does="hook" data-world-hook="asks to connect a wallet" onclick="window.__ran = 'onclick'">Buy with SOL</button>`
  + `<button class="sw1" type="button" data-cca="${mint}" data-world-control="copy-ca" data-world-does="copy" data-world-copy="${mint}">Copy CA</button>`
  + `<button class="sw1" type="button" data-open="${mint}" data-world-control="open-coin" data-world-does="link" data-world-href="/coin/${mint}">Open coin</button>`
  + `<button class="sw1" type="button" data-evil="" data-world-control="evil" data-world-does="link" data-world-href="https://evil.example/${mint}">Evil</button>`
  /* Off the site, as sink leaves every one (inert, its address kept); the site's allow-list decides which come back. */
  + `<a class="sw3" data-world-control="pump-fun" data-world-does="hook" data-world-hook="goes off the site" data-world-offsite="https://pump.fun/coin/${mint}" role="link">pump.fun</a>`
  + `<a class="sw3" data-world-control="charts" data-world-does="hook" data-world-hook="goes off the site" data-world-offsite="https://dexscreener.com/solana" role="link">charts</a>`
  + `<a class="sw3" data-world-control="dev-on-x" data-world-does="hook" data-world-hook="goes off the site" data-world-offsite="https://x.com/STANDIN_dev" role="link">@STANDIN_dev</a>`
  + `<a class="sw3" data-world-control="solscan-token" data-world-does="hook" data-world-hook="goes off the site" data-world-offsite="https://solscan.io/token/${mint}" role="link">solscan</a>`
  + `<button class="sw1" type="button" data-world-control="board" data-world-does="hook" data-world-hook="opens a window off the site" data-world-offsite="https://pump.fun/board">Board</button>`
  + `<button class="sw1" type="button" data-sheet="" data-world-control="share-sheet" data-world-does="hook" data-world-hook="asks the machine to share" data-world-share="${attrJson({ title: "STANDIN", text: "", url: `/h/${mint}` })}">Share sheet</button>`
  + `<button class="sw1" type="button" data-copylink="" data-world-control="copy-link" data-world-does="copy" data-world-copy="https://STANDIN.example/h/${mint}" data-world-copy-path="/h/${mint}">Copy link</button>`
  + `<details class="sw2"><summary class="sw3 sw8-m" data-world-control="sell">Sell</summary><button class="sw1" type="button" data-side="sell" data-world-control="sell-for-standin">Sell for ${ticker}</button></details>`
  + `<dl class="sw2"><dt class="sw3">Price</dt><dd class="sw3">STANDIN SOL</dd><dt class="sw3">CA</dt><dd class="sw3"><a class="sw3" href="https://dexscreener.com/solana/${mint}" target="_blank" rel="noopener" data-world-control="dexscreener">dexscreener</a> <a class="sw3" href="javascript:window.__ran='href'">solscan</a> <a class="sw3" href="/h/${mint}" data-world-control="host-page">Host page</a></dd></dl>`
  + `<form class="sw2" data-world-form=""><input class="sw4" name="q" data-world-control="q"></form>`
  + `<button class="sw1" type="button" data-share="${mint}" data-world-control="share" data-world-does="hook" data-world-hook="opens a window off the site" data-world-offsite="https://x.com/intent/post?text=${mint}">Share</button><script>window.__ran = 'script'</script></div></dialog>`;
function attrJson(v) { return JSON.stringify(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }
const world = {
  every: EVERY, frames: FRAMES,
  chars: [
    { key: "STANDIN_MINT_A|$STANDIN", name: "$STANDIN", boxes: A, dialog: 0 },
    { key: "STANDIN_MINT_B|$STANDOUT", name: "$STANDOUT", boxes: B, dialog: 1 },
    { key: "/coin/STANDIN_MINT_C", boxes: [[0.4, 0.7, 0.05, 0.1], [0.4, 0.7, 0.05, 0.1], [0.4, 0.7, 0.05, 0.1]], href: "/coin/STANDIN_MINT_C" },
    { key: "https://STANDIN.example/coin/D", boxes: [[0.9, 0.1, 0.05, 0.1], [0.9, 0.1, 0.05, 0.1], [0.9, 0.1, 0.05, 0.1]], offsite: "https://STANDIN.example/coin/D" },
  ],
  dialogs: [{ html: dialog("STANDIN_MINT_A", "$STANDIN"), backdrop: "background-color:rgba(20, 10, 30, 0.6)" }, { html: dialog("STANDIN_MINT_B", "$STANDOUT") }],
  css: {
    "sw0": "box-sizing:border-box;padding-top:20px;padding-right:20px;padding-bottom:20px;padding-left:20px;border-top-width:3px;border-right-width:3px;border-bottom-width:3px;border-left-width:3px;border-top-style:solid;border-right-style:solid;border-bottom-style:solid;border-left-style:solid;border-top-color:rgb(40, 20, 50);border-right-color:rgb(40, 20, 50);border-bottom-color:rgb(40, 20, 50);border-left-color:rgb(40, 20, 50);background-color:rgb(255, 250, 240);color:rgb(40, 20, 50);font-family:monospace;font-size:14px;width:420px",
    "sw1": "display:inline-block;margin-top:0px;margin-right:4px;background-color:rgb(255, 255, 255);color:rgb(40, 20, 50);border-top-width:2px;border-top-style:solid;border-top-color:rgb(40, 20, 50);font-size:13px;padding-top:4px;padding-bottom:4px",
    "sw2": "display:block;margin-top:8px;margin-bottom:8px",
    "sw3": "display:block;margin-top:0px;margin-bottom:0px;color:rgb(40, 20, 50);font-size:14px",
    "sw4": "display:inline-block;width:120px;height:30px;font-size:14px",
    "sw5": "color:rgb(150, 120, 160)",
    "sw6": "display:block;width:100%;height:44px;background-color:rgb(255, 80, 150);color:rgb(255, 255, 255);border-top-width:0px;font-size:16px",
    "sw7": "display:inline-block;background-color:rgb(40, 20, 50);color:rgb(255, 255, 255)",
    "sw8": "color:rgb(255, 80, 150)",
  },
};
/* The flipbook as sink writes it: each frame shown for its time, a square drawn where character A and B stand. */
const flipbook = (() => {
  const px = (b) => b ? `<rect x="${b[0] * CW}" y="${b[1] * CH}" width="${b[2] * CW}" height="${b[3] * CH}" fill="#e05"/>` : "";
  const keys = [], uses = [], total = EVERY * FRAMES;
  for (let i = 0; i < FRAMES; i++) {
    const a = (i / FRAMES) * 100, b = ((i + 1) / FRAMES) * 100;
    keys.push(`@keyframes s${i}{0%{opacity:0}${a > 0 ? `${a}%{opacity:0}` : ""}${a}%{opacity:1}${b}%{opacity:0}100%{opacity:0}}`);
    uses.push(`<use href="#f${i}" style="opacity:${i === 0 ? 1 : 0};animation:s${i} ${total}ms step-end infinite"/>`);
  }
  const frames = Array.from({ length: FRAMES }, (_, i) => `<g id="f${i}"><rect width="${CW}" height="${CH}" fill="#cfe8c0"/>${px(A[i])}${px(B[i])}</g>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}"><style>${keys.join("")}</style><defs>${frames}</defs>${uses.join("")}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
})();

const format = { "palette.mode": "light" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const pic = { id: "pic_world", path: "assets/pictures/pic_world.svg", type: "image/svg+xml", w: CW, h: CH, bytes: 1, alt: "", from: "upload", pixelated: true };
const node = (id, w, h, extra = {}) => ({ id, pageId: "page_home", featureId: "picture", label: "canvas-frames", prompt: "", content: "", data: "", x: 0, y: 0, w, h, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, picture: pic, world, from: { url: "https://STANDIN.example/", host: "STANDIN.example", selector: "body > main > canvas" }, ...extra });
const draw = (n, mode, w = n.w, h = n.h, more = null) => renderToStaticMarkup(React.createElement(Block, { node: n, t: more ? themeFrom({ ...format, ...more }) : t, palette, mode, size: { w, h }, pictureAt: () => flipbook }));

/* ---------------------------------------------------------------- attached, drawn */
{
  const out = attachCaptured([node("n_world", CW, CH), node("n_still", CW, CH, { world: undefined })], { version: 1, worlds: [{ part: "n_world" }, { part: "n_still" }] });
  const uses = (id) => usesOf(out.find((n) => n.id === id)?.work).map((u) => u.id);
  check("a part sink names a world carries the world-dialogs feature", uses("n_world").includes("world-dialogs"), JSON.stringify(uses("n_world")));
  check("control: a named part with no world carries nothing", !uses("n_still").length, JSON.stringify(uses("n_still")));
  check("the feature is in the library, with a script, and needs nothing to run", BEHAVIOURS.some((w) => w.manifest.id === "world-dialogs" && w.manifest.needs === "none" && /siteFeatures\.define\("world-dialogs"/.test(w.script)));
}
const live = draw(node("n_world", CW, CH), "live");
const board = draw(node("n_world", CW, CH), "board");
check("on the board it is the picture alone: no press areas, no dialogs", !/data-part-world|<dialog/.test(board) && /<img/.test(board), board.slice(0, 200));
check("live, one press area per character: two open dialogs, one goes to a page of the site", (live.match(/<button[^>]*data-world-open=/g) ?? []).length === 2 && /<a[^>]*href="\/coin\/STANDIN_MINT_C"[^>]*data-world-hit="2"/.test(live), (live.match(/<(a|button)[^>]*data-world-hit[^>]*>/g) ?? []).join("\n"));
check("…and one that went off the site is no link: a press that does nothing, the address kept as data", /<button[^>]*data-world-hit="3"[^>]*data-world-offsite="https:\/\/STANDIN.example\/coin\/D"/.test(live) && !/<a[^>]*data-world-hit="3"/.test(live), (live.match(/<[a-z]+[^>]*data-world-hit="3"[^>]*>/) ?? [""])[0]);
check("no address off the site is a link unless the site's list allows it: every link is the site's own, pump.fun, or dexscreener's charts", (live.match(/\shref="[^"]*"/g) ?? []).every((h) => /^ href="(\/(?!\/)|https:\/\/pump\.fun\/|https:\/\/dexscreener\.com\/solana")/.test(h)), (live.match(/\shref="[^"]*"/g) ?? []).join(" "));
check("…and both dialogs, closed", (live.match(/<dialog\b[^>]*data-world-dialog="\d"/g) ?? []).length === 2 && !/<dialog\b[^>]*\sopen\b/.test(live));
check("nothing of the page's runs: no script, no handler, no javascript: address", !/<script|onclick|javascript:/i.test(live), (live.match(/<script[^>]*>|onclick="[^"]*"|javascript:[^"]*/gi) ?? []).join(" "));
check("every control keeps its words and the page's own attributes, named for a backend", ["data-buysol", 'data-world-control="buy-with-sol"', 'data-bsol="0.1"', 'data-world-control="amount-in-sol"', 'data-side="sell"', 'data-share="STANDIN_MINT_A"', ">Buy with SOL<", ">Share<"].every((s) => live.includes(s)));
{
  const ids = [...live.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  check("each dialog's ids are its own, and still named by what named them", ids.length === 2 && new Set(ids).size === 2 && ids.every((id) => /-w[01]-pd-h$/.test(id)) && ids.every((id) => live.includes(`aria-labelledby="${id}"`)), JSON.stringify(ids));
}

/* ---------------------------------------------------------------- the owner's allow-list for links off the site */
{
  const { linkAllowed, offsiteRules, DEFAULT_OFFSITE } = await jiti.import(S("shelf", "parts", "offsite.ts"));
  const R = offsiteRules(DEFAULT_OFFSITE);
  const cases = [["https://pump.fun/coin/STANDIN_MINT_A", true], ["https://pump.fun/board", true], ["https://dexscreener.com/solana", true], ["https://dexscreener.com/", true],
    ["https://dexscreener.com/solana/STANDIN_MINT_A", false], ["https://x.com/STANDIN_dev", false], ["https://twitter.com/STANDIN_dev", false], ["https://x.com/intent/post?text=STANDIN", false],
    ["https://solscan.io/token/STANDIN_MINT_A", false], ["https://example.com/", false], ["/h/STANDIN_MINT_A", true], ["/coins", true], ["javascript:alert(1)", false], ["//evil.example/x", false]];
  const wrong = cases.filter(([u, want]) => linkAllowed(u, R) !== want);
  check("the default list: pump.fun kept, dexscreener kept but not a token's page, X and every other site kept out, the site's own pages always", !wrong.length, JSON.stringify(wrong));
  check("…and a Share of the site's own page runs by default (share:own)", R.shareOwn === true);
  const tagIn = (html, name) => (html.match(new RegExp(`<[a-z]+\\b[^>]*data-world-control="${name}"[^>]*>`)) ?? [""])[0];
  const pump = tagIn(live, "pump-fun"), charts = tagIn(live, "charts"), x = tagIn(live, "dev-on-x"), sol = tagIn(live, "solscan-token"), dex = tagIn(live, "dexscreener"), board = tagIn(live, "board"), sheet = tagIn(live, "share-sheet"), share = tagIn(live, "share");
  check("drawn with the defaults: the pump.fun link is a link again, in a new window", /href="https:\/\/pump.fun\/coin\/STANDIN_MINT_A"/.test(pump) && /target="_blank"/.test(pump) && !/data-world-offsite/.test(pump), pump);
  check("…dexscreener's charts a link, a token's page on dexscreener not", /href="https:\/\/dexscreener.com\/solana"/.test(charts) && !/\shref=/.test(dex) && /data-world-offsite="https:\/\/dexscreener.com\/solana\/STANDIN_MINT_A"/.test(dex), `${charts} ${dex}`);
  check("…an X profile and solscan stay inert, their addresses kept as data", !/\shref=/.test(x) && /data-world-offsite="https:\/\/x.com\/STANDIN_dev"/.test(x) && /data-world-does="hook"/.test(x) && !/\shref=/.test(sol) && /data-world-offsite="https:\/\/solscan.io/.test(sol), `${x} ${sol}`);
  check("…a button that opened pump.fun opens it again; Share to an X intent stays inert", /data-world-does="link"/.test(board) && /data-world-href="https:\/\/pump.fun\/board"/.test(board) && /data-world-allowed=""/.test(board) && /data-world-does="hook"/.test(share) && /data-world-offsite="https:\/\/x.com\/intent/.test(share), `${board} ${share}`);
  check("…a Share sheet for the site's own page runs", /data-world-does="share"/.test(sheet), sheet);
  const own = draw({ ...node("n_world", CW, CH) }, "live", CW, CH, { "links.offsite": "solscan.io" });
  check("the owner's own list decides instead: solscan allowed, pump.fun and the share sheet not", /href="https:\/\/solscan.io\/token\/STANDIN_MINT_A"/.test(tagIn(own, "solscan-token")) && !/\shref=/.test(tagIn(own, "pump-fun")) && /data-world-does="hook"/.test(tagIn(own, "share-sheet")), `${tagIn(own, "solscan-token")} ${tagIn(own, "pump-fun")}`);
}

/* ---------------------------------------------------------------- in a browser, as published: the runtime, the feature, the part */
const script = BEHAVIOURS.find((w) => w.manifest.id === "world-dialogs").script;
const page = (w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:serif} button{all:unset} *{box-sizing:content-box}</style></head><body>
<div id="n_world" style="position:absolute;left:30px;top:40px;width:${w}px;height:${h}px">${draw(node("n_world", w, h), "live", w, h)}</div>
<div style="height:2000px"></div>
<script id="site-features" type="application/json">${JSON.stringify([{ part: "n_world", feature: "world-dialogs", inputs: {} }])}</script>
<script>${RUNTIME_JS}</script><script>(function (siteFeatures) {\n${script}})(window.siteFeatures);</script></body></html>`;

const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: "/opt/pw-browsers/chromium" });
try {
  /* The page served from a stand-in address of its own; anything asked of any other address is written down and refused. */
  const ORIGIN = "https://standin.test";
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  let current = "";
  const visited = [], offsite = [];
  await context.route("**/*", (r) => {
    const u = new URL(r.request().url());
    if (u.protocol === "data:") return r.continue();
    if (u.origin !== ORIGIN) { offsite.push(u.href); return r.abort(); }
    if (u.pathname === "/") return r.fulfill({ contentType: "text/html", body: current });
    visited.push(u.pathname);
    return r.fulfill({ contentType: "text/html", body: "<p>STANDIN elsewhere on the site</p>" });
  });
  const popups = [];
  const tab = await context.newPage();
  tab.on("popup", (p) => popups.push(p.url()));
  const load = async (html) => { current = html; await tab.goto(`${ORIGIN}/`, { waitUntil: "load" }); };
  const errors = [];
  tab.on("pageerror", (e) => errors.push(e.message));
  /* Every press area's walk held at one moment: `f` frames in, and a little. */
  const at = (f) => tab.evaluate(({ f, every }) => { for (const el of document.querySelectorAll("[data-world-hit]")) for (const a of el.getAnimations()) { a.pause(); a.currentTime = f * every + 5; } }, { f, every: EVERY });
  const box = (k) => tab.evaluate((k) => { const el = document.querySelector(`[data-world-hit="${k}"]`); const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, shown: getComputedStyle(el).visibility === "visible" }; }, k);
  const near = (a, b) => Math.abs(a - b) <= 1;
  const want = (b, W, H, left, top) => {
    /* The picture covers the part: scaled to fill, the overflow split evenly. */
    const k = Math.max(W / CW, H / CH), ox = (W - CW * k) / 2, oy = (H - CH * k) / 2;
    return { x: left + ox + b[0] * CW * k, y: top + oy + b[1] * CH * k, w: b[2] * CW * k, h: b[3] * CH * k };
  };
  const same = (got, exp) => near(got.x, exp.x) && near(got.y, exp.y) && near(got.w, exp.w) && near(got.h, exp.h);

  for (const [W, H, what] of [[CW, CH, "at the size it was captured"], [800, 250, "on a wider window, where the picture covers its part"]]) {
    await load(page(W, H));
    await tab.waitForTimeout(150);
    const walked = [];
    for (let f = 0; f < FRAMES; f++) { await at(f); walked.push(await box(0)); }
    check(`character A's press area follows it frame by frame, ${what}`, walked.every((g, f) => g.shown && same(g, want(A[f], W, H, 30, 40))), JSON.stringify({ walked, want: A.map((b) => want(b, W, H, 30, 40)) }));
    await at(2);
    check(`…and B's is gone where B was not found, ${what}`, !(await box(1)).shown);
  }

  /* A press opens its dialog, dressed as live. */
  await load(page(CW, CH));
  await tab.waitForTimeout(150);
  const openBy = async (k, f = 0) => { await at(f); const b = await box(k); await tab.mouse.click(b.x + b.w / 2, b.y + b.h / 2); await tab.waitForTimeout(50); };
  const opened = () => tab.evaluate(() => Array.from(document.querySelectorAll("dialog[open]")).map((d) => d.getAttribute("data-world-key")));
  await openBy(0);
  check("pressing character A opens A's dialog, as a modal", JSON.stringify(await opened()) === JSON.stringify(["STANDIN_MINT_A|$STANDIN"]) && await tab.evaluate(() => document.querySelector("dialog[open]").matches(":modal")), JSON.stringify(await opened()));
  const look = await tab.evaluate(() => {
    const d = document.querySelector("dialog[open]"), buy = d.querySelector('[data-world-control="buy-with-sol"]');
    const cs = getComputedStyle(d), bs = getComputedStyle(buy), bd = getComputedStyle(d, "::backdrop");
    return { bg: cs.backgroundColor, w: d.getBoundingClientRect().width, border: cs.borderTopWidth, font: cs.fontFamily, buyBg: bs.backgroundColor, buyH: buy.getBoundingClientRect().height, backdrop: bd.backgroundColor, marker: getComputedStyle(d.querySelector("summary"), "::marker").color };
  });
  check("…in the page's own look, whatever the page it lands on resets (the dialog, its buy button, its backdrop, the sell toggle's marker)", look.bg === "rgb(255, 250, 240)" && near(look.w, 420) && look.border === "3px" && look.font === "monospace" && look.buyBg === "rgb(255, 80, 150)" && near(look.buyH, 44) && look.backdrop === "rgba(20, 10, 30, 0.6)" && look.marker === "rgb(255, 80, 150)", JSON.stringify(look));
  const url0 = tab.url();
  const state = () => tab.evaluate(() => ({ ran: window.__ran ?? null, open: !!document.querySelector("dialog[open]"), amount: document.querySelector('dialog[open] [data-world-control="amount-in-sol"]')?.value, checked: Array.from(document.querySelectorAll("dialog[open] [data-bsol]")).map((b) => b.getAttribute("aria-checked")).join(","), chosen: getComputedStyle(document.querySelector('dialog[open] [data-bsol="0.1"]')).backgroundColor }));
  await tab.click('dialog[open] [data-world-control="0-1"]');
  const preset = await state();
  check("a preset does what it did on live: fills the amount box and marks itself chosen, in its chosen look", preset.amount === "0.1" && preset.checked === "true,false,false" && preset.chosen === "rgb(40, 20, 50)", JSON.stringify(preset));
  await tab.fill('dialog[open] [data-world-control="amount-in-sol"]', "1.25");
  await tab.click('dialog[open] [data-world-control="copy-ca"]');
  await tab.waitForTimeout(80);
  check("Copy CA copies the address, as on live", (await tab.evaluate(() => navigator.clipboard.readText())) === "STANDIN_MINT_A");
  await tab.click('dialog[open] [data-world-control="buy-with-sol"]');
  await tab.click('dialog[open] [data-world-control="share"]');
  await tab.click('dialog[open] [data-world-control="evil"]');
  await tab.click('dialog[open] [data-world-control="dexscreener"]');
  await tab.focus('dialog[open] [data-world-control="q"]');
  await tab.keyboard.press("Enter");
  await tab.waitForTimeout(150);
  const after = await state();
  check("a hook does nothing: Buy (asks for a wallet), Share (went off the site), a link off the site, a sent form leave the dialog open, the page where it was, nothing run", after.open && after.ran === null && tab.url() === url0 && after.amount === "1.25" && !popups.length && !offsite.length && !visited.length, JSON.stringify({ ...after, url: tab.url(), popups, offsite, visited }));
  const hooks = await tab.evaluate(() => ({ buy: document.querySelector('dialog[open] [data-world-control="buy-with-sol"]').getAttribute("data-world-hook"), share: document.querySelector('dialog[open] [data-world-control="share"]').getAttribute("data-world-offsite"), dex: document.querySelector('dialog[open] [data-world-control="dexscreener"]').getAttribute("data-world-offsite"), dexHref: document.querySelector('dialog[open] [data-world-control="dexscreener"]').getAttribute("href") }));
  check("…each saying what live did, for a backend", hooks.buy === "asks to connect a wallet" && hooks.share === "https://x.com/intent/post?text=STANDIN_MINT_A" && hooks.dex === "https://dexscreener.com/solana/STANDIN_MINT_A" && hooks.dexHref === null, JSON.stringify(hooks));
  await tab.click("dialog[open] summary");
  check("the sell toggle opens as the page's did", await tab.evaluate(() => document.querySelector("dialog[open] details").open && getComputedStyle(document.querySelector('dialog[open] [data-world-control="sell-for-standin"]')).display !== "none"));
  check("a link within the site stays a link", await tab.evaluate((o) => document.querySelector('dialog[open] [data-world-control="host-page"]').href === `${o}/h/STANDIN_MINT_A`, ORIGIN));
  await tab.keyboard.press("Escape");
  await tab.waitForTimeout(50);
  check("Escape closes it", !(await opened()).length);
  await openBy(0, 1);
  await tab.click("dialog[open] [data-world-close]");
  await tab.waitForTimeout(50);
  check("…so does its close button", !(await opened()).length);
  await openBy(0, 2);
  const reopened = (await opened()).length === 1;
  await tab.mouse.click(8, 690);
  await tab.waitForTimeout(50);
  check("…and a press outside it", reopened && !(await opened()).length);
  await openBy(1, 1);
  check("pressing character B opens B's own dialog", JSON.stringify(await opened()) === JSON.stringify(["STANDIN_MINT_B|$STANDOUT"]), JSON.stringify(await opened()));
  await tab.keyboard.press("Escape");
  const link = await tab.evaluate(() => { const a = document.querySelector('[data-world-hit="2"]'); return { tag: a.tagName, href: a.getAttribute("href") }; });
  check("a character that led to another page of the site is a link to it", link.tag === "A" && link.href === "/coin/STANDIN_MINT_C", JSON.stringify(link));
  await openBy(3, 0);
  check("…one that led off the site does nothing when pressed", !(await opened()).length && tab.url() === url0 && !offsite.length && !popups.length, JSON.stringify({ url: tab.url(), offsite }));
  /* Allowed off the site, and the site's own address. */
  await openBy(0, 0);
  await tab.click('dialog[open] [data-world-control="copy-link"]');
  await tab.waitForTimeout(80);
  check("Copy link copies this site's own address for the page, not the one it was captured at", (await tab.evaluate(() => navigator.clipboard.readText())) === `${ORIGIN}/h/STANDIN_MINT_A`);
  await tab.evaluate(() => navigator.clipboard.writeText(""));
  await tab.click('dialog[open] [data-world-control="share-sheet"]');
  await tab.waitForTimeout(80);
  check("a Share sheet for the site's own page shares it (with no share sheet here, its link copied)", (await tab.evaluate(() => navigator.clipboard.readText())) === `${ORIGIN}/h/STANDIN_MINT_A`);
  const [pop] = await Promise.all([tab.waitForEvent("popup", { timeout: 3000 }).catch(() => null), tab.click('dialog[open] [data-world-control="pump-fun"]')]);
  check("an allowed link off the site (pump.fun) is followed, in a new window", !!pop && offsite.includes("https://pump.fun/coin/STANDIN_MINT_A"), `${pop?.url()} ${offsite.join(" ")}`);
  if (pop) await pop.close().catch(() => {});
  await tab.keyboard.press("Escape");
  /* Last, as it leaves the page: a button that went to a page of the site goes there. */
  await openBy(0, 0);
  await tab.click('dialog[open] [data-world-control="open-coin"]');
  await tab.waitForURL(`${ORIGIN}/coin/STANDIN_MINT_A`, { timeout: 3000 }).catch(() => {});
  check("a button that went to a page of the site goes there, as on live", tab.url() === `${ORIGIN}/coin/STANDIN_MINT_A`, tab.url());
  check("no error on the page", !errors.length, errors.join(" | "));
} finally {
  await browser.close();
}

/* ---------------------------------------------------------------- the hand-off */
{
  const md = polioMd({ pages: [{ id: "page_home", name: "Home", path: "/" }], nodes: [node("n_world", CW, CH)] });
  check("POLIO.md lists the world and the controls a backend wires, with the page's own attributes", /Characters in canvas worlds/.test(md) && /`buy-with-sol` \| button \| hook: asks to connect a wallet \| `data-buysol`/.test(md) && /`0-1` \| button \| ui \|/.test(md) && /`share` \| button \| hook: opens a window off the site \(x.com\)/.test(md) && /`amount-in-sol` \| input \| native \| `data-bsol-in`/.test(md), md.split("Characters in canvas worlds")[1]?.slice(0, 900) ?? md.slice(0, 300));
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
