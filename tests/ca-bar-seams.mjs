/**
 * A ROUNDED BOX AND THE PAINTED PARTS IN IT MEET WITHOUT A SEAM.
 *
 * THE OWNER, on his published trumpmorty.fun beside the live one: the CA bar
 * (a rounded box, 4px ink edge, a dark CA end and a yellow COPY end) showed a
 * thin white fringe round the ends, and a white flash round its sides when
 * the pointer left it. Live shows neither. And the footer's CA bar sat about
 * 34px lower than it should.
 *
 * MEASURED on trunk cb38449 (sink trumpmorty-fun, exported and read pixel by
 * pixel inside the bar's outline, along the ends' outer edges; a pixel is
 * off when it is not a mix of the ink and the end's own fill):
 *
 *   · at rest, 1763 wide, twice dense: COPY 136 off, the worst 190 from the
 *     line (white); live 38, worst 52. The bar stood at x 748.5. Its fill and
 *     edge snap to the pixel grid, the ends' `clip-path` does not, and half a
 *     pixel of the box's white showed between them. Every part now stands on
 *     a whole pixel (`fluidSite.ts#snapPlace`): 38, worst 54;
 *   · leaving the hover: the ends snapped home while the bar eased back for
 *     .2s (747 off, worst 344, at the first frame). The reveal wrote its own
 *     inline `transition` over the one the stylesheet gave the ends to move
 *     with the bar (`library/behaviours.ts#SHEET_TRANSITION`): 43, worst 88;
 *   · the footer CA bar at 1440 x 900, the size the page was captured at:
 *     5949 against the capture's 5915. The remote's keys drew 105 tall, not
 *     96, and the step icons 74 not 68: a captured box that centres its words
 *     had where they sat recorded as padding, and a line box taller than the
 *     glyphs inside that padding outgrew the box (`theme.ts#boxStyle`): 5916.
 *
 * This check builds each case from the code that writes it and reads the
 * browser's own pixels and boxes. No server:
 *
 *   node tests/ca-bar-seams.mjs
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const fluid = await jiti.import(join(src, "fluidSite.ts"));
const theme = await jiti.import(join(src, "parts", "theme.ts"));
const lib = await jiti.import(join(src, "library", "behaviours.ts"));
const motion = await jiti.import(join(src, "parts", "capturedMotion.ts"));
const carry = await jiti.import(join(src, "carry.ts"));

/* ---------- the writers, on their own ---------- */

/* A stand-in element: fluidStyle and snapPlace only touch `style`. */
const fake = (left, top) => {
  const props = {};
  return { style: { position: "absolute", left, top, setProperty: (k, v) => { props[k] = v; }, get props() { return props; } } };
};
const a = fake("calc(748px + 0.5px)", "calc(2400px + 1vw)");
check("a part placed in calc() keeps its exact place as --at-x / --at-y", fluid.snapPlace(a, false) === true && a.style.props["--at-x"] === "calc(748px + 0.5px)" && a.style.left === "var(--at-x)" && a.style.top === "var(--at-y)", JSON.stringify(a.style.props));
const whole = fake("12px", "40px");
check("a part already on whole px is left as it is", fluid.snapPlace(whole, false) === false && whole.style.left === "12px");
const fixed = { style: { position: "fixed", left: "calc(1px + 0.5px)", top: "0px", setProperty() {} } };
check("a fixed band is not moved", fluid.snapPlace(fixed, false) === false);
check("the published page rounds only where round() is understood, over the inline place", /@supports \(left: round\(1px, 1px\)\)/.test(fluid.SNAP_CSS) && /!important/.test(fluid.SNAP_CSS));

const KEY = { from: { selector: "main > section > div > a" }, layout: { display: "flex", direction: "column", align: "center", justify: "center", gap: 2 }, pad: { top: 53, right: 58, bottom: 21, left: 57 } };
const T = { line: "#000" };
check("a captured box centring its words down keeps only the padding's difference", theme.boxStyle(KEY, T).padding === "32px 58px 0px 57px", theme.boxStyle(KEY, T).padding);
check("the same box placed by hand keeps its padding", theme.boxStyle({ ...KEY, from: null }, T).padding === "53px 58px 21px 57px");
check("a captured box that does not centre down keeps its padding", theme.boxStyle({ ...KEY, layout: { display: "flex", direction: "column", justify: "flex-start" } }, T).padding === "53px 58px 21px 57px");
const ICON = { from: { selector: "div > div" }, layout: { display: "grid", align: "center", items: "center", columns: 1 }, pad: { top: 7, right: 0, bottom: 7, left: 0 } };
check("a grid that centres its one child, padded evenly, is padded not at all down", theme.boxStyle(ICON, T).padding === "0px 0px 0px 0px");

const scriptOf = (id) => {
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== "object" || seen.has(v)) return null;
    seen.add(v);
    if (v.manifest?.id === id && typeof v.script === "string") return v.script;
    for (const x of Object.values(v)) { const got = walk(x); if (got) return got; }
    return null;
  };
  return walk(lib);
};
const REVEAL = scriptOf("reveal");
check("the reveal's script is found", !!REVEAL);

/* ---------- in the browser ---------- */

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/*
 * The CA bar as the export writes it: the box, then its two ends as parts of
 * their own over it, each cut to the box's rounded inside. The bar's place
 * has a half pixel in it, as it had at 1763.
 */
function barPage(snap) {
  const place = (left, top) => {
    const el = fake(`calc(${left}px + 0.5px)`, `calc(${top}px + 0.5px)`);
    if (snap) fluid.snapPlace(el, false);
    const vars = Object.entries(el.style.props).map(([k, v]) => `${k}: ${v}; `).join("");
    return `position: absolute; ${vars}left: ${el.style.left}; top: ${el.style.top};`;
  };
  const cut = (side) => `clip-path: inset(0px ${side === "l" ? "-400px" : "0px"} 0px ${side === "l" ? "0px" : "-400px"} round 12px);`;
  return `<!doctype html><html><head><style>html,body{margin:0;background:#f3d440}${snap ? fluid.SNAP_CSS : ""}</style></head><body>
<div id="box" style="${place(100, 40)} width: 560px; height: 57px; box-sizing: border-box; background: rgb(250,250,250); border: 4px solid rgb(26,15,11); border-radius: 16px; overflow: hidden;"></div>
<div id="ca" style="${place(104, 44)} width: 50px; height: 49px; background: rgb(41,47,68); ${cut("l")}"></div>
<div id="copy" style="${place(578, 44)} width: 78px; height: 49px; background: rgb(243,212,64); box-shadow: rgb(26,15,11) 4px 0 0 0 inset; ${cut("r")}"></div>
</body></html>`;
}

/* Pixels inside the bar's outline, along an end's outer edges, that are not a mix of ink and the end's fill. */
async function offPixels(page) {
  const png = await page.screenshot({ clip: { x: 90, y: 30, width: 590, height: 80 } });
  return page.evaluate(async (data) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const dpr = img.width / 590;
    const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; };
    const [bx, by, bw, bh] = r("#box");
    const INK = [26, 15, 11];
    const off = (p, q) => { const d = q.map((v, i) => v - INK[i]); const L = d.reduce((s, v) => s + v * v, 0); const t = Math.max(0, Math.min(1, d.reduce((s, v, i) => s + v * (p[i] - INK[i]), 0) / L)); return Math.hypot(...p.map((v, i) => v - (INK[i] + t * d[i]))); };
    const inside = (x, y) => { const l = bx + 1.5, t = by + 1.5, rr = bx + bw - 1.5, b = by + bh - 1.5, rad = 14.5; if (x < l || x > rr || y < t || y > b) return false; const cx = Math.min(Math.max(x, l + rad), rr - rad), cy = Math.min(Math.max(y, t + rad), b - rad); return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad; };
    let bad = 0, worst = 0;
    for (const [sel, fill, left] of [["#ca", [41, 47, 68], true], ["#copy", [243, 212, 64], false]]) {
      const [x0, y0, w, h] = r(sel);
      for (let Y = 0; Y < c.height; Y++) for (let X = 0; X < c.width; X++) {
        const x = 90 + (X + 0.5) / dpr, y = 30 + (Y + 0.5) / dpr;
        if (!inside(x, y) || (left ? x > x0 + w - 4 : x < x0 + 4)) continue;
        if (x > x0 + 3 && x < x0 + w - 3 && y > y0 + 3 && y < y0 + h - 3) continue;
        const i = (Y * c.width + X) * 4, d = off([px[i], px[i + 1], px[i + 2]], fill);
        if (d > 30) bad++; worst = Math.max(worst, d);
      }
    }
    return { bad, worst: Math.round(worst) };
  }, png.toString("base64"));
}

for (const dpr of [1, 2]) {
  const page = await (await browser.newContext({ viewport: { width: 760, height: 160 }, deviceScaleFactor: dpr })).newPage();
  await page.setContent(barPage(false));
  const before = await offPixels(page);
  await page.setContent(barPage(true));
  const after = await offPixels(page);
  const placed = await page.evaluate(() => getComputedStyle(document.getElementById("box")).left);
  check(`×${dpr}: the bar and its ends stand on whole pixels`, placed === "101px", placed);
  check(`×${dpr}: no white between the bar's edge and its ends`, after.worst < 120 && after.bad <= Math.max(4, before.bad / 3), `off ${after.bad}, worst ${after.worst} (on half a pixel: off ${before.bad}, worst ${before.worst})`);
  check(`×${dpr}: control — on half a pixel the fringe is there to be seen`, before.worst >= 150, `worst ${before.worst}`);
  await page.close();
}

/* The remote's key: 96 tall as captured, and its word's middle where it was measured (53 + 14 / 2 inside the edge). */
{
  const page = await browser.newPage();
  const st = theme.boxStyle(KEY, T);
  await page.setContent(`<!doctype html><body style="margin:0"><div id="k" style="position:absolute;left:0;top:0;width:173px;min-height:96px;display:flex;flex-direction:column">
<div style="flex:1 0 auto;box-sizing:border-box;border:4px solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:${st.padding}">
<span id="w" style="font:22px/1.05 sans-serif">HOME</span></div></div></body>`);
  const got = await page.evaluate(() => { const k = document.getElementById("k").getBoundingClientRect(), w = document.getElementById("w").getBoundingClientRect(); return { h: k.height, mid: w.y + w.height / 2 - k.y }; });
  check("a captured key stays as tall as it was captured", Math.abs(got.h - 96) < 0.5, `${got.h}`);
  check("its word's middle is where the capture read it", Math.abs(got.mid - (4 + 53 + 7)) < 0.6, `${got.mid.toFixed(2)} (captured 64)`);
  await page.close();
}

/*
 * Leaving the hover: the bar and an end, as `motionCss` writes them, the end
 * revealed on scroll by the library's own script. Paused a quarter of the
 * way back, the end is where the bar is.
 */
{
  const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
  const nodes = [
    { id: "bar", pageId: "p", x: 100, y: 100, w: 560, h: 57, from: { selector: "main > button" }, colour: { bg: "#fff" },
      motion: { transition: [{ property: "transform", duration: "0.2s", timing: "ease", delay: "0s" }], hover: [{ selector: ".ca:hover", self: true, style: { transform: "translate(-2px, -2px)" } }] } },
    { id: "end", pageId: "p", x: 104, y: 104, w: 50, h: 49, from: { selector: "main > button > span" } },
  ];
  const css = motion.motionCss(nodes, [], (id) => `#${id}`);
  await page.setContent(`<!doctype html><html><head><style>body{margin:0}${css}</style></head><body>
<div id="bar" style="position:absolute;left:100px;top:100px;width:560px;height:57px"><div class="mo mo-bar" style="width:100%;height:100%;background:#fff;border:4px solid #000;box-sizing:border-box"></div></div>
<div id="end" style="position:absolute;left:104px;top:104px;width:50px;height:49px;background:#223"></div>
<script>window.siteFeatures = { define: function (n, f) { window.__reveal = f; } };</script></body></html>`);
  await page.addScriptTag({ content: REVEAL });
  await page.evaluate(() => window.__reveal(document.getElementById("end"), { distance: "46", scale: "0.96", duration: "300" }));
  await page.waitForTimeout(700);
  const during = await page.evaluate(() => document.getElementById("end").style.transition);
  await page.mouse.move(300, 128); await page.waitForTimeout(400);
  await page.mouse.move(300, 380);
  const at = await page.evaluate(() => {
    for (const x of document.getAnimations()) { x.pause(); x.currentTime = 50; }
    const t = (s) => new DOMMatrix(getComputedStyle(document.querySelector(s)).transform).m41;
    return { bar: t(".mo-bar"), end: t("#end"), kept: getComputedStyle(document.getElementById("end")).transitionProperty };
  });
  check("after the reveal the end's own transitions are the stylesheet's again", !/opacity/.test(during) && /transform/.test(at.kept), `inline "${during}", computed ${at.kept}`);
  check("leaving the hover, the end eases back with the bar", at.bar < -0.2 && Math.abs(at.end - at.bar) < 0.05, `bar ${at.bar.toFixed(2)}px, end ${at.end.toFixed(2)}px`);
  await page.close();
}

/*
 * THE REMOTE'S KEYS, INSIDE THE TURNED REMOTE. The export moves a key into
 * its holder (`art.turnsWith`) and keeps its width, written in `100%` of the
 * page (trumpmorty.fun's CHART: 173px at a 1440 page, a third of what the
 * remote grows by). Inside the remote `100%` is the remote's 620: the key
 * came out 0 wide, and its words, number and gloss strip (149 wide, 12 in)
 * stood off it. Found on trunk 2d20571 and on the publish before it
 * (b9720d0) alike; `pageUnits` says the page's width where it is meant.
 */
{
  const KEY_W = "calc(173px + (0.333333 * (-620px + min(620px, -560px + min(1180px, 100% + 0px)))))";
  const COPY_W = "calc(-70px + min(620px, -560px + min(1180px, 100% + 0px)))";
  check("a width moved inside another part says the page's width, not 100%", !/100%/.test(fluid.pageUnits(KEY_W, 1440)) && fluid.pageUnits(KEY_W, 1440).includes("max(100vw, 1280px)"));
  const remote = (fix) => {
    const w = (v) => (fix ? fluid.pageUnits(v, 1440) : v);
    return `<!doctype html><html><head><style>body{margin:0}.site-root{width:100%;min-width:1280px}</style></head><body><div class="site-root"><div style="position:relative;width:100%;height:900px">
<div id="remote" style="position:absolute;left:calc(50% - 310px);top:40px;width:620px;height:700px"><div id="turned" style="position:relative;width:100%;height:100%;box-sizing:border-box;border:5px solid #000;padding:30px;transform:rotate(-1.5deg);background:#223">
<div id="key" style="position:absolute;left:35px;top:97px;width:${w(KEY_W)};min-height:96px;display:flex;flex-direction:column"><div style="flex:1 0 auto;background:#ef9043;border:4px solid #000;border-radius:22px"></div></div>
<div id="gloss" style="position:absolute;left:47px;top:107px;width:149px;height:25px;background:rgba(255,255,255,.35)"></div>
<div id="copy" style="position:absolute;left:35px;top:466px;width:${w(COPY_W)};min-height:72px;display:flex"><div style="flex:1 0 auto;background:#f2e281;border:4px solid #000;border-radius:999px"></div></div>
</div></div></div></div></body></html>`;
  };
  for (const W of [1440, 1992]) {
    const page = await browser.newPage({ viewport: { width: W, height: 900 } });
    const size = async () => page.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const k = document.getElementById("key"), g = document.getElementById("gloss"), c = document.getElementById("copy");
      return { key: k.offsetWidth, copy: c.offsetWidth, glossIn: g.offsetLeft >= k.offsetLeft && g.offsetLeft + g.offsetWidth <= k.offsetLeft + k.offsetWidth, r: r("key").width };
    });
    await page.setContent(remote(false));
    const was = await size();
    await page.setContent(remote(true));
    const got = await size();
    check(`${W} wide: a remote key inside the turned remote is as wide as its cell`, Math.abs(got.key - 173) < 0.5, `${got.key}px (written in the remote's 100%: ${was.key}px)`);
    check(`${W} wide: the key's gloss strip sits on the key`, got.glossIn === true && was.glossIn === false);
    check(`${W} wide: COPY CA spans the remote's inside`, Math.abs(got.copy - 550) < 0.5, `${got.copy}px (was ${was.copy}px)`);
    await page.close();
  }
}

/*
 * WHAT MOVES UNDER THE POINTER CARRIES WHAT IS ON IT, AND WHAT CAN BE
 * PRESSED POINTS OVER ITS WHOLE BOX. The owner, on the published remote and
 * the how-to-buy cards: a key's gloss strip, number and icon broke away from
 * the key when it rose or sank; a card's coloured box tilted while its icon,
 * words and red badge stayed behind; and the hand showed over the words of
 * the keys, the COPY CA bar and the nav, not over the rest of them.
 * MEASURED on the 1c44f17 export at 1992: under hover and press the CHART
 * key's gloss stayed at dy 10.3 while the key rose 3 and sank 6; the card's
 * parts eased over 800ms after a card that jumped; and 14 pressable parts
 * showed the hand over fewer than 36 of 36 points of their box (the footer
 * CA bar 0, DEX 3). Now: the gloss 7.3 / 16.3, the card's parts inside the
 * card, every pressable part 36 of 36, and none of the 245 parts moved at
 * rest (1440 and 1992).
 */
{
  const KEY = "main > div > a:nth-of-type(4)", CARD = "main > section > article";
  const nodes = [
    { id: "key", pageId: "p", x: 0, y: 0, w: 173, h: 96, from: { selector: KEY }, data: "link, named “03 CHART”", featureId: "cta-primary",
      motion: { transition: [{ property: "transform", duration: "0.12s", timing: "ease", delay: "0s" }], hover: [{ self: true, style: { transform: "translateY(-3px)" } }], active: [{ self: true, style: { transform: "translateY(6px)" } }] } },
    { id: "gloss", pageId: "p", x: 12, y: 10, w: 149, h: 25, from: { selector: `${KEY}::before` } },
    { id: "num", pageId: "p", x: 75, y: 27, w: 22, h: 26, from: { selector: `${KEY} > small` } },
    { id: "card", pageId: "p", x: 0, y: 200, w: 262, h: 239, from: { selector: CARD }, work: { id: "tilt", inputs: { mode: "mouse", parts: "icon,badge" } } },
    { id: "icon", pageId: "p", x: 26, y: 234, w: 68, h: 68, from: { selector: `${CARD} > div` } },
    { id: "badge", pageId: "p", x: 183, y: 182, w: 60, h: 50, from: { selector: `${CARD} > span` } },
    { id: "nav", pageId: "p", x: 0, y: 0, w: 60, h: 20, from: { selector: "header > nav > a:nth-of-type(1)" }, data: "link, named “Lore”" },
    { id: "bar", pageId: "p", x: 0, y: 500, w: 550, h: 72, from: { selector: "main > button" }, data: "button, named “COPY CA”" },
    { id: "barWords", pageId: "p", x: 227, y: 516, w: 96, h: 40, from: { selector: "main > button > span" } },
    { id: "plain", pageId: "p", x: 0, y: 700, w: 100, h: 100, from: { selector: "main > div:nth-of-type(9)" } },
  ];
  const owned = carry.carryOwned(nodes);
  check("a key a hover moves carries its gloss (::before) and its number", JSON.stringify(owned.get("key")) === JSON.stringify(["gloss", "num"]), JSON.stringify(owned.get("key")));
  check("a card that tilts under the pointer carries its icon and badge", JSON.stringify(owned.get("card")) === JSON.stringify(["icon", "badge"]), JSON.stringify(owned.get("card")));
  check("a box nothing moves carries nothing", !owned.has("plain") && !owned.has("bar"));
  const points = carry.pointing(nodes);
  check("keys, the nav's links, the COPY CA bar and the words on it point", ["key", "gloss", "num", "nav", "bar", "barWords"].every((id) => points.has(id)), [...points].join(","));
  check("a box that cannot be pressed does not", !points.has("plain") && !points.has("card"));

  /* The key as the export writes it, its gloss inside its box, with the motion stylesheet told so. */
  const nested = new Set([...owned.values()].flat());
  const css = motion.motionCss(nodes, [], (id) => `#${id}`, nested);
  check("a part inside its box gets no rule of its own to follow the box", !/#gloss\s*\{/.test(css) && !/#num\s*\{/.test(css), css.split("\n").filter((l) => /#gloss|#num/.test(l)).join(" / "));
  const TILT = scriptOf("tilt");
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`<!doctype html><html><head><style>body{margin:0}${css}</style></head><body>
<div id="key" style="position:absolute;left:100px;top:100px;width:173px;min-height:96px;display:flex;flex-direction:column;cursor:pointer">
 <div class="mo mo-key" style="flex:1 0 auto;position:relative;border:4px solid #000;background:#ef9043;border-radius:22px">
  <div id="gloss" style="position:absolute;left:8px;top:6px;width:149px;height:25px;background:rgba(255,255,255,.35);pointer-events:none"></div>
  <div id="num" style="position:absolute;left:71px;top:23px;width:22px;height:26px">03</div>
 </div></div>
<div id="card" style="position:absolute;left:400px;top:200px;width:262px;min-height:239px;display:flex;flex-direction:column">
 <div style="flex:1 0 auto;position:relative;border:4px solid #000;background:#f7e0a8;overflow:visible">
  <div id="icon" style="position:absolute;left:22px;top:30px;width:68px;height:68px;background:#fff"></div>
  <div id="badge" style="position:absolute;left:179px;top:-22px;width:60px;height:50px;background:#e33"></div>
 </div></div>
<script>window.siteFeatures = { define: function (n, f) { window.__tilt = f; } };</script></body></html>`);
  await page.addScriptTag({ content: TILT });
  await page.evaluate(() => window.__tilt(document.getElementById("card"), { mode: "mouse", strength: "10", across: "13.4", down: "11.8", lift: "6", perspective: "900", pace: "200", parts: "icon,badge" }));
  const rel = () => page.evaluate(() => { const k = document.querySelector(".mo-key").getBoundingClientRect(), g = document.getElementById("gloss").getBoundingClientRect(), n = document.getElementById("num").getBoundingClientRect(); return { g: g.y - k.y, n: n.y - k.y, k: k.y }; });
  const rest = await rel();
  await page.mouse.move(260, 190); await page.waitForTimeout(400);
  const up = await rel();
  await page.mouse.down(); await page.waitForTimeout(400);
  const down = await rel();
  await page.mouse.up();
  check("under hover the key rises and its gloss and number rise with it", up.k < rest.k - 2 && Math.abs(up.g - rest.g) < 0.1 && Math.abs(up.n - rest.n) < 0.1, `key ${rest.k}→${up.k}, gloss ${rest.g}→${up.g}`);
  check("pressed, the key sinks and its gloss and number sink with it", down.k > rest.k + 4 && Math.abs(down.g - rest.g) < 0.1 && Math.abs(down.n - rest.n) < 0.1, `key ${rest.k}→${down.k}, gloss ${rest.g}→${down.g}`);
  const cur = await page.evaluate(() => [[102, 102], [270, 190], [180, 110]].map(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor));
  check("the hand shows over the key's whole box, its gloss and its number too", cur.every((c) => c === "pointer"), cur.join(","));
  const card0 = await page.evaluate(() => ["card", "icon", "badge"].map((i) => document.getElementById(i).getBoundingClientRect().toJSON()));
  await page.mouse.move(640, 420, { steps: 4 }); await page.waitForTimeout(60);
  const early = await page.evaluate(() => { const c = document.getElementById("card"); return { tr: c.style.transition, t: getComputedStyle(c).transform }; });
  await page.waitForTimeout(500);
  const card1 = await page.evaluate(() => ["card", "icon", "badge"].map((i) => document.getElementById(i).getBoundingClientRect().toJSON()));
  const shift = (i) => [card1[i].x - card0[i].x, card1[i].y - card0[i].y];
  check("the tilting card eases, as its parts do", /transform/.test(early.tr), early.tr);
  check("the card's icon and badge move with the card", card1[0].y < card0[0].y - 2 && Math.abs(shift(1)[1] - shift(0)[1]) < 3 && Math.abs(shift(2)[1] - shift(0)[1]) < 3, `card ${shift(0).map((v) => v.toFixed(1))}, icon ${shift(1).map((v) => v.toFixed(1))}, badge ${shift(2).map((v) => v.toFixed(1))}`);
  const inlineOnKids = await page.evaluate(() => ["icon", "badge"].map((i) => document.getElementById(i).style.transform));
  check("parts inside the card are not turned a second time", inlineOnKids.every((t) => !t), inlineOnKids.join(","));
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
