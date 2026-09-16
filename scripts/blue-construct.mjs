/**
 * A blue set of J's construct assets, cut from the green ones by turning the
 * hue to the menu's blue: the same render, the same mask, a different hue.
 *
 *   node scripts/blue-construct.mjs
 *
 * Writes rim-blue.png, face-blue-dark.png and face-blue.png beside the green
 * ones. When J renders a blue box himself, cut it with cut-rims.mjs instead
 * and this script is retired.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");
const ROOT = new URL("../public/construct", import.meta.url).pathname;
const b = await chromium.launch({ headless: true, executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await b.newPage();
await page.setContent("<canvas id=c></canvas>");
const turn = (file, deg) => page.evaluate(async ([dataUrl, deg]) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const c = document.getElementById("c"); c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d"); ctx.filter = `hue-rotate(${deg}deg)`; ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  // Mean oklch hue of the opaque, coloured pixels.
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  let sa = 0, sb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 7) {
    if (d[i + 3] < 200) continue;
    const r = lin(d[i]), g = lin(d[i + 1]), bl = lin(d[i + 2]);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    if (Math.hypot(A, B) < 0.03) continue;
    sa += A; sb += B; n++;
  }
  const hue = ((Math.atan2(sb, sa) * 180) / Math.PI + 360) % 360;
  return { hue: Math.round(hue), n, png: c.toDataURL("image/png") };
}, [`data:image/png;base64,${readFileSync(`${ROOT}/${file}`).toString("base64")}`, deg]);
const probe = await turn("face-green-dark.png", 0);
console.log("green face hue", probe.hue, "over", probe.n, "pixels");
let best = null;
for (let deg = 30; deg <= 110; deg += 5) { const r = await turn("face-green-dark.png", deg); if (!best || Math.abs(r.hue - 205) < Math.abs(best.hue - 205)) best = { deg, hue: r.hue }; }
console.log("best turn", best);
for (const [from, to] of [["face-green-dark.png", "face-blue-dark.png"], ["face-green.png", "face-blue.png"], ["rim-green.png", "rim-blue.png"]]) {
  const r = await turn(from, best.deg);
  writeFileSync(`${ROOT}/${to}`, Buffer.from(r.png.split(",")[1], "base64"));
  console.log(to, "hue", r.hue);
}
await b.close();
