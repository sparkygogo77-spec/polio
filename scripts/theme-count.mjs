/**
 * HOW MUCH OF A SITE'S THEME THE BOARD DRAWS, counted against the live page
 * (J, 2026-10-11: "the 702 imported hook parts show 0 of every one of
 * these"). The same counts, read by the browser on both sides:
 *
 *   animated elements and their keyframes, individual transforms (rotate,
 *   translate, scale), inline svgs and their shapes, multi-layer
 *   backgrounds, ::before/::after with content, drop-shadow filters,
 *   mix-blend-mode, clip-path, masks, fixed and sticky, canvases.
 *
 * On the live page each element counts once. On the board each part counts
 * once (a ::before the import made a part of its own counts as a
 * ::before), so the two columns read as "kept of live".
 *
 *   npm run build && npx next start -p 3013 &
 *   node scripts/theme-count.mjs --url http://127.0.0.1:3013 --board redesign --live https://…vercel.app/
 *
 * The board is counted on the page it opens on (the saved board's own).
 * --live may be left out to count the board alone; --width (1440) and
 * --height (900) set the window.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "../tests/lib/board.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg("url", "http://127.0.0.1:3013");
const BOARD = arg("board", "redesign");
const LIVE = arg("live", "");
const W = Number(arg("width", "1440")), H = Number(arg("height", "900"));
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

/** Runs in the page: the counts over `root`'s elements; `partsOnly` counts only board parts (their drawn boxes and what is inside them). */
function count(rootSel, partsOnly) {
  const root = document.querySelector(rootSel) ?? document.documentElement;
  const out = { animated: 0, keyframes: 0, individualTransforms: 0, inlineSvg: 0, svgChildren: 0, multiLayerBg: 0, pseudoWithContent: 0, dropShadow: 0, blend: 0, clipPath: 0, mask: 0, fixed: 0, sticky: 0, canvas: 0 };
  const names = new Set();
  const layers = (v) => { let d = 0, n = 1; for (const c of v) { if (c === "(") d++; else if (c === ")") d--; else if (c === "," && d === 0) n++; } return n; };
  const els = [...root.querySelectorAll("*")];
  /* On the board only a part's own drawing counts, not the builder's icons on its chips. */
  const svgs = els.filter((e) => e.localName === "svg" && !e.parentElement?.closest("svg") && (!partsOnly || !!e.closest("[data-svg-art]")));
  for (const e of els) {
    if (e.closest("svg") && e.localName !== "svg") continue;
    /* The builder's own chips and marks round a part are not the site. */
    if (partsOnly && !e.closest("[data-part-box], [data-part], [data-ground-layer]")) continue;
    const s = getComputedStyle(e);
    const anim = s.animationName && s.animationName !== "none" ? s.animationName.split(",").map((x) => x.trim()).filter((x) => x !== "none") : [];
    if (anim.length) { out.animated++; anim.forEach((a) => names.add(a.replace(/^cap-/, "").replace(/--.*$/, ""))); }
    if ((s.rotate && s.rotate !== "none") || (s.translate && s.translate !== "none") || (s.scale && s.scale !== "none")) out.individualTransforms++;
    if (s.backgroundImage && s.backgroundImage !== "none" && layers(s.backgroundImage) > 1) out.multiLayerBg++;
    if (/drop-shadow/.test(s.filter)) out.dropShadow++;
    if (s.mixBlendMode && s.mixBlendMode !== "normal") out.blend++;
    if (s.clipPath && s.clipPath !== "none") out.clipPath++;
    if ((s.maskImage && s.maskImage !== "none") || (s.webkitMaskImage && s.webkitMaskImage !== "none")) out.mask++;
    if (!partsOnly) { if (s.position === "fixed") out.fixed++; if (s.position === "sticky") out.sticky++; }
    if (e.localName === "canvas") out.canvas++;
    for (const p of ["::before", "::after"]) { const c = getComputedStyle(e, p).content; if (!partsOnly && c && c !== "none" && c !== "normal") out.pseudoWithContent++; }
  }
  out.inlineSvg = svgs.length;
  out.svgChildren = svgs.reduce((n, s) => n + s.querySelectorAll("circle,line,path,polyline,polygon,rect,ellipse,text,tspan,textPath").length, 0);
  if (partsOnly) {
    /* A board part: a ::before the import made a part of its own, a part the page pinned. */
    const nodes = (window.__studioNodes?.() ?? []);
    const shown = new Set([...root.querySelectorAll("[data-node-id]")].map((e) => e.getAttribute("data-node-id")));
    for (const n of nodes) {
      if (!shown.has(n.id)) continue;
      if (n.source?.pseudo) out.pseudoWithContent++;
      if (n.from?.position === "fixed") out.fixed++;
      if (n.from?.position === "sticky") out.sticky++;
    }
  }
  out.keyframes = names.size;
  return out;
}

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const cols = {};
if (LIVE) {
  await page.goto(LIVE, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);
  cols.live = await page.evaluate(`(${count})("html", false)`);
}
await openBoard(page, URL_BASE, BOARD);
cols.board = await page.evaluate(`(${count})("[data-page-scroll]", true)`);
await browser.close();

const keys = Object.keys(cols.board);
console.log(["what", ...Object.keys(cols)].join("\t"));
for (const k of keys) console.log([k, ...Object.values(cols).map((c) => c[k])].join("\t"));
