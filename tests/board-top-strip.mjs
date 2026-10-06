/**
 * A NEW SITE'S OFFER STRIP IS SEEN, SO THE BOARD'S TOP IS NOT CUT BY SKY.
 *
 * J (2026-10-06): on a brand new site, scrolling slid the top of the page
 * under a line across the nebula. The "not on GitHub yet" offer sat above
 * the pane as a plain block, and the ground, positioned after it, painted
 * over it: 34px of room nobody could see, so the pane's top edge was a
 * line in the sky. The strip is drawn over the ground now.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-top-strip.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/NewSiteOffer.tsx, src/features/studio/fromasite/bring.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const read = await page.evaluate(() => {
  const offer = document.querySelector("[data-new-site-offer]");
  const pane = document.querySelector("[data-studio-pane]");
  if (!offer || !pane) return null;
  const o = offer.getBoundingClientRect();
  return { x: o.left, y: o.top, w: o.width, h: o.height, offerB: o.bottom, paneT: pane.getBoundingClientRect().top };
});
check("a brand new site shows the offer strip", read !== null);
if (read) {
  /* The ground takes no pointer, so `elementFromPoint` cannot tell, and it
     drifts, so two pictures always differ. The strip's own colour can: a
     patch of its padding has to be the strip's background, not sky. */
  const png = await page.screenshot({ clip: { x: read.x + 2, y: read.y + 2, width: 4, height: 4 } });
  const seen = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 4; c.height = 4;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(1, 1, 1, 1).data;
    const want = document.createElement("canvas").getContext("2d");
    want.fillStyle = getComputedStyle(document.querySelector("[data-new-site-offer]")).backgroundColor;
    want.fillRect(0, 0, 1, 1);
    const w = want.getImageData(0, 0, 1, 1).data;
    return { d: [d[0], d[1], d[2]], w: [w[0], w[1], w[2]] };
  }, png.toString("base64"));
  const off = Math.max(...seen.d.map((v, i) => Math.abs(v - seen.w[i])));
  check("the offer is drawn over the ground, not under it", off <= 6, `seen rgb(${seen.d}), its own rgb(${seen.w})`);
  check("the pane starts at the offer's foot", Math.abs(read.offerB - read.paneT) < 1, `offer foot ${read.offerB.toFixed(1)}, pane ${read.paneT.toFixed(1)}`);
}
check("no page error", errors.length === 0, errors.join(" / "));

await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
