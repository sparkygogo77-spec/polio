/**
 * THE CONSTRUCT AT THE SIZE OF A KEY.
 *
 * One definition, two settings. A card is 620 by 208 and a key is nearer 96
 * by 28, and three things that are right at the first size are wrong at the
 * second — the dark core that is depth on a card is a hole on a key, the
 * vignette that thins a card's middle thins nearly all of a key, and a
 * 180-pixel period over 28 pixels of height shows two fat filaments rather
 * than cloud. So `.molten-key` re-points four values and nothing else: no
 * second texture, no third layer, no keyframe of its own.
 *
 * This measures the thing J actually asked for — brighter, more even, and no
 * middle void — by putting one of each on a real page with the app's own
 * markup and reading the pixels:
 *
 *   · how light the face is, mean oklab L;
 *   · how even it is, the spread of L across the face, because "fewer dark
 *     spots" is a claim about variance rather than about the mean;
 *   · and the void, the middle third against the outer thirds — under 1 is a
 *     face with a hole in the middle of it, which is what a card is on
 *     purpose and what a key must not be.
 *
 *   node tests/key-construct.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const css = readFileSync("src/core/ui/molten.css", "utf8");
const ts = readFileSync("src/core/ui/molten.ts", "utf8");
const tile = readFileSync("src/features/studio/nebulaTile.ts", "utf8");

/* ------------------------------------------------------------------ */
/* 1. One definition, two settings                                     */
/* ------------------------------------------------------------------ */

const key = /\.molten\.molten-key \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
/* The declarations without the prose: this file explains itself at length and
   a check that reads the comments is checking the wrong thing. */
const keyRules = key.replace(/\/\*[\s\S]*?\*\//g, "");
check("there is a key setting, and it beats the temperatures on specificity rather than on order",
  key.length > 0 && /\.molten\.molten-key \{/.test(css));
check("a component asks for it by name, the way it asks for a bar", /export function moltenKeyClass\(/.test(ts));
/*
 * The four things it re-points, and they are the four the size actually
 * changes. Anything else moving here would be a second design wearing the
 * same name.
 */
check("…it wears the bright cut of the same render", /--mo-nebula: var\(--mo-nebula-lit\);/.test(keyRules));
check("…over a shorter period, so a filament is a filament at 28 pixels", (() => {
  const m = /--nebula-period: (\d+)px;/.exec(key);
  return !!m && Number(m[1]) < 100;
})(), /--nebula-period: (\d+)px;/.exec(key)?.[1] + "px against 180 on a card");
check("…with a vignette that keeps the cloud off the bezel rather than hollowing the middle", (() => {
  const m = /--molten-vignette: linear-gradient\(([\s\S]*?)\);/.exec(key)?.[1] ?? "";
  const stops = [...m.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)/g)].map((x) => Number(x[1]));
  return stops.length > 0 && Math.min(...stops) >= 0.8;
})(), `thinnest ${Math.min(...[...(/--molten-vignette: linear-gradient\(([\s\S]*?)\);/.exec(key)?.[1] ?? "").matchAll(/rgb\(0 0 0 \/ ([\d.]+)\)/g)].map((x) => Number(x[1])))} against 0.3 on a card`);
check("…and an even face with no core in the middle of it",
  /linear-gradient\(to bottom, var\(--mo-hot\) 0%, var\(--mo-body\) \d+%, var\(--mo-deep\) 100%\)/.test(keyRules)
  && !/--mo-core/.test(keyRules));
/*
 * And it is the same construct. A second texture, a third layer or a
 * keyframe of its own would each be a different thing wearing the name.
 */
check("it is the same construct: no layer, no keyframe and no picture of its own",
  !/@keyframes/.test(keyRules) && !/content: ""/.test(keyRules) && !/url\(/.test(keyRules)
  && !/\.molten-key::(before|after)/.test(css));
check("both cuts of J's render are on the page, so cards and keys need not agree",
  /--nebula-verdant-lit/.test(tile) && /--nebula-ember-lit/.test(tile)
  && /--mo-nebula-lit: var\(--nebula-verdant-lit/.test(css)
  && /--mo-nebula-lit: var\(--nebula-ember-lit/.test(css));

/* ------------------------------------------------------------------ */
/* 2. Brighter, more even, and no hole — measured                      */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1200, height: 600 } });
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  /* One of each, the app's own markup, side by side on a real page. */
  await p.evaluate(() => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:30px;top:30px;z-index:99999;display:flex;align-items:flex-start;gap:24px";
    const put = (cls, w, h, name) => {
      const d = document.createElement("div");
      d.className = `molten molten-verdant${cls}`;
      d.setAttribute("data-face", name);
      d.style.cssText = `position:relative;width:${w}px;height:${h}px;border-radius:${cls ? 6 : 14}px;overflow:hidden;--molten-seed:0`;
      const s = document.createElement("span");
      s.setAttribute("data-molten", "");
      d.appendChild(s);
      host.appendChild(d);
    };
    put("", 620, 208, "card");
    put(" molten-key", 96, 28, "key");
    document.body.appendChild(host);
  });
  await p.waitForTimeout(1200);

  const READ = async (b64) => {
    const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
    const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
    c.getContext("2d").drawImage(i, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, i.width, i.height).data;
    const srgb = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = (r, g, bl) => {
      const [R, G, B] = [srgb(r / 255), srgb(g / 255), srgb(bl / 255)];
      const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
      const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
      const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
      return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    };
    /* The rim is a bright line all the way round and would swamp both the
       mean and the spread, so the reading is the face inside it. */
    const pad = Math.max(3, Math.round(Math.min(i.width, i.height) * 0.14));
    const all = [], mid = [], out = [];
    /* The void is a round thing, so it is read as one: a disc in the middle
       against the ring around it. A band across the middle would only be
       measuring the top-to-bottom run of the face, which is not a hole. */
    const cx = i.width / 2, cy = i.height / 2, rx = i.width / 3.2, ry = i.height / 3.2;
    for (let y = pad; y < i.height - pad; y++) for (let x = pad; x < i.width - pad; x++) {
      const v = L(d[(i.width * y + x) << 2], d[((i.width * y + x) << 2) + 1], d[((i.width * y + x) << 2) + 2]);
      all.push(v);
      (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? mid : out).push(v);
    }
    const mean = (xs) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    const m = mean(all);
    const sd = Math.sqrt(mean(all.map((v) => (v - m) ** 2)));
    const dark = all.filter((v) => v < m * 0.6).length / all.length;
    return { L: +m.toFixed(4), spread: +(sd / m).toFixed(3), void: +(mean(mid) / mean(out)).toFixed(3), dark: +(dark * 100).toFixed(1) };
  };
  const face = async (name) => p.evaluate(READ, (await p.locator(`[data-face="${name}"]`).screenshot()).toString("base64"));
  const card = await face("card");
  const k = await face("key");
  await b.close();

  console.log(`\n  ${"".padEnd(6)}${"mean L".padStart(8)}${"spread".padStart(9)}${"middle / round it".padStart(18)}${"dark spots".padStart(12)}`);
  console.log(`  ${"card".padEnd(6)}${String(card.L).padStart(8)}${String(card.spread).padStart(9)}${String(card.void).padStart(18)}${String(card.dark + "%").padStart(12)}`);
  console.log(`  ${"key".padEnd(6)}${String(k.L).padStart(8)}${String(k.spread).padStart(9)}${String(k.void).padStart(18)}${String(k.dark + "%").padStart(12)}\n`);

  check("a key is brighter than a card", k.L > card.L * 1.15, `${k.L} against ${card.L}`);
  check("…and more even, which is what fewer dark spots means", k.spread < card.spread,
    `spread ${k.spread} against ${card.spread}`);
  check("…with far fewer of them", k.dark < card.dark, `${k.dark}% of the face against ${card.dark}%`);
  /*
   * The void. A card's middle is darker than the ring around it on purpose —
   * that is the core, and it is what a line of text sits on. A key has no
   * room for the light to sit around anything, so the same face reads as a
   * gap in the button rather than as depth.
   *
   * The bar is 0.97 rather than 1: asking the middle to be *brighter* than
   * the ring would be a different design, and a face that is flat within
   * half a per cent is a flat face. It sits well clear of what a real core
   * measures — a card's is 0.84 — so a core coming back here would be seen.
   */
  check("and there is no hole in the middle of a key", k.void >= 0.97,
    `the middle is ${k.void}× the ring round it, where a card's is ${card.void}×`);
  check("…while a card keeps its core, because that is where the words sit", card.void < 1, `${card.void}×`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
