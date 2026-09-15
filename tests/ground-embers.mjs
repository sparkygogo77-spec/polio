/**
 * THE GROUND'S SPARKS RUB OUT WHERE THEY WERE, NOT THE WHOLE SHEET.
 *
 * A paint used to start with one `clearRect` over everything. On the pane as
 * it now stands that is 811 by 1191 — 966,000 pixels wiped and handed back
 * thirty times a second — to move a cast of at most ninety-six sparks which,
 * measured on a live page, cover 349 of those pixels. Four hundredths of one
 * per cent of the sheet has anything on it.
 *
 * Each spark is cleared where it was drawn last time and drawn where it is
 * now, and the box it leaves is remembered for the next frame. The whole
 * sheet is wiped only when it is new or has just been resized.
 *
 * WHAT IT BOUGHT, main-thread task time over five idle seconds with the
 * ground the only thing running, four samples a cell:
 *
 *                              pane 943    pane 1191    growth
 *   clearing the whole sheet     815ms       942ms       +16%
 *   clearing per spark           857ms       798ms        −7%
 *
 * So at the pane the shelf left behind it is 942ms down to 798ms, and more
 * to the point **it stopped growing with the pane**: the work is now the
 * cast, which grows with the square root of the area and stops at ninety-six,
 * rather than the sheet, which grows with the area. The next pane size costs
 * nothing new.
 *
 * It does not move the dropped-frame count, and that is expected rather than
 * a disappointment: frames here are lost to compositing full-pane layers, and
 * this is main-thread paint. It is CPU back, not frames.
 *
 * THE FAILURE IT HAS TO NOT HAVE is trails: clear too small a box and every
 * spark leaves a smear that never goes away, which shows up as ink on the
 * sheet growing without bound. The live half watches for exactly that.
 *
 *   node tests/ground-embers.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const src = readFileSync("src/features/studio/darkMatter.ts", "utf8");
const embers = src.slice(src.indexOf("export function paintEmbers("), src.indexOf("export function nebulaField(") >= 0 ? src.indexOf("export function nebulaField(") : src.length);

/* ------------------------------------------------------------------ */
/* 1. It clears what it drew, and only that                            */
/* ------------------------------------------------------------------ */

check("a field remembers where each spark was drawn", /marks: \(Box \| null\)\[\];/.test(src));
check("…one box a spark, in the order the sparks are in",
  /marks: sparks\.map\(\(\) => null\)/.test(src));
check("a paint rubs out those boxes rather than the sheet",
  /for \(const m of f\.marks\) if \(m\) c\.clearRect\(m\.x, m\.y, m\.w, m\.h\);/.test(embers));
check("…and records where each one has just gone, for the next frame",
  /f\.marks\[i\] = \{/.test(embers) && /const reach = Math\.max\(s\.size, \(s\.size \* 1\.3\) \/ 2\) \+ 2;/.test(embers));
/*
 * The box has to cover the widest thing drawn — the tail, at `size * 1.3` —
 * and the antialiasing that smears a stroke past its own width. Two pixels
 * of margin is what stops a rim of the last frame surviving.
 */
check("…a box wide enough for the tail and the antialiasing round it",
  /Math\.ceil\(Math\.abs\(s\.x - ax\) \+ reach \* 2\) \+ 1/.test(embers));
check("nothing clears the whole sheet on an ordinary frame",
  !/c\.clearRect\(0, 0, w, h\)/.test(src));
/*
 * Except when it must: a new field, or one whose sheet has just been resized
 * under it, has marks that are lies about a bitmap that no longer exists.
 */
check("a new or resized sheet is wiped once, because every old mark is a lie about it",
  /if \(f\.fresh \|\| f\.marks\.length !== f\.sparks\.length\) \{\n    c\.clearRect\(0, 0, f\.w, f\.h\);/.test(embers)
  && /next\.fresh = true;/.test(src));
check("…and why it is worth doing is written where the code is, not only here",
  /966,000 pixels wiped/.test(src) && /cover 349 of those pixels/.test(src));

/* ------------------------------------------------------------------ */
/* 2. No trails                                                        */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

if (live) {
  const { chromium } = await import("playwright-core");
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
  const p = await b.newPage({ viewport: { width: 1039, height: 1278 } });
  await p.goto(`${url}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);

  const read = () => p.evaluate(() => {
    const c = document.querySelector("[data-ground-sparks]");
    if (!c) return null;
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] >= 6) n++;
    return { ink: n, of: c.width * c.height };
  });

  const first = await read();
  check("there is a spark sheet with sparks on it", !!first && first.ink > 20,
    first ? `${first.ink} inked pixels of ${(first.of / 1e6).toFixed(2)}M` : "no sheet");

  const seen = [first.ink];
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(6000); seen.push((await read()).ink); }
  await b.close();

  const most = Math.max(...seen), least = Math.min(...seen);
  /*
   * Trails would show as ink climbing and never coming down. A cast that is
   * lit and dies and is lit again wanders within a band; four hundredths of a
   * per cent of the sheet is the band it wanders in, and three times the
   * smallest reading is far outside anything the cast does and far inside
   * what a smear would reach in half a minute.
   */
  check("the ink on the sheet stays where a live cast keeps it, over half a minute",
    most < Math.max(60, least * 3), `${seen.join(" → ")} inked pixels`);
  check("…and it is a rounding error of the sheet, which is the whole point",
    most / first.of < 0.002, `${(most / first.of * 100).toFixed(3)}% at its fullest`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
