/**
 * The Updates fit fills the room it is given, and nothing hides under the band.
 *
 * HIS NUMBER: the zoom should sit around 0.915 rather than 70 percent. Placed:
 * at 1728x1080 with three updates the fit was 0.697, which is his 70 percent,
 * and it is bound by the SET — the column plus the fan — standing exactly the
 * room less two 56px margins. Reaching 0.915 would need about 86px of fan
 * under the band, and that is his own ruling, made after he reversed himself
 * on it:
 *
 *   "no. Bring it back out where it can be seen. Furniture may overhang, but
 *    it may not disappear. Something hidden under an opaque band reads as
 *    absent, and absent is a lie about the board."
 *
 * So the ruling is the floor and the number is what is reached under it. The
 * margin comes in from 56 to 28, the column is not touched, and the fit takes
 * whatever that gives — which is short of 0.915 and honest about why.
 *
 * Measured at HIS size, because that is where his number was read. Two things
 * are held here and the first outranks the second:
 *
 *   1. No part of any box or lane is below the top of the band.
 *   2. The set fills the room to the margin, top and bottom.
 *
 *   node tests/fit-margin.mjs [url]
 *
 * Runs alone: reads the board's fit after its settling animation; under load it measured mid-move, 134px under the band.
 */
import { createRequire } from "node:module";
import { SETTLE_MARGIN, zoomCeiling } from "../src/features/studio/timelineView.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A document with this many finished updates on it. */
const doc = (n) => ({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", nodes: [], shapes: [], groups: [], spaces: [], selection: [],
    threads: Array.from({ length: n }, (_, i) => ({
      id: `t${i}`, at: 1700000000000 + i * 1000, mode: "make", ask: `update ${i + 1}`,
      answer: `did the thing ${i + 1}`, changes: [], state: "done", model: "gpt-image-2", revisions: [],
    })),
  },
  version: 0,
});

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
/* His screen. The 70 percent was read here and nowhere else. */
const page = await browser.newPage({ viewport: { width: 1728, height: 1080 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });

/** Where everything on the board stands, against the room and the band. */
const board = () => page.evaluate(() => {
  const plot = document.querySelector("[data-timeline-plot]");
  const m = plot ? /scale\(([\d.]+)\)/.exec(plot.style.transform) : null;
  const host = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  if (!host) return null;
  const band = document.querySelector("[data-studio-band]")?.getBoundingClientRect();
  /* The room the fit works in: the pane less the band along its foot. */
  const bandTop = band && band.top > host.top ? band.top - host.top : host.height;
  const es = [...document.querySelectorAll("[data-box], [data-lane], [data-lane-box]")];
  if (!es.length) return { zoom: m ? Number(m[1]) : null, count: 0 };
  let top = 1e9, bottom = -1e9;
  for (const e of es) {
    const q = e.getBoundingClientRect();
    top = Math.min(top, q.top - host.top);
    bottom = Math.max(bottom, q.bottom - host.top);
  }
  /* A card's own width, in board pixels, so the ceiling can be worked out
     here rather than guessed from a constant that may move. */
  const card = document.querySelector("[data-box]")?.getBoundingClientRect();
  const zoom = m ? Number(m[1]) : null;
  /* Both axes, because either can be the one that runs out first. */
  let left = 1e9, right = -1e9;
  for (const e of es) {
    const q = e.getBoundingClientRect();
    left = Math.min(left, q.left - host.left);
    right = Math.max(right, q.right - host.left);
  }
  return {
    zoom, count: es.length, paneW: Math.round(host.width),
    cardW: card && zoom ? Math.round(card.width / zoom) : 0,
    room: Math.round(bandTop), top: Math.round(top), bottom: Math.round(bottom),
    left: Math.round(left), right: Math.round(right),
    under: Math.round(Math.max(0, bottom - bandTop)),
  };
});

for (const n of [1, 3, 8]) {
  await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc(n));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1300);
  await page.locator('[aria-label^="Finish"]').first().click({ force: true });
  /* The boxes arrive `STAGGER_MS` apart, so eight of them is 1.6s of arriving. */
  await page.waitForTimeout(1500 + n * 300);
  const b = await board();

  /* 1. THE RULING, and it is a floor rather than a preference. */
  check(`${n}: nothing is hidden under the band`, b.under === 0,
    `the lowest thing stands ${b.room - b.bottom}px above the band${b.under ? `, ${b.under}px under it` : ""}`);

  /*
   * 2. …and, under it, the room is filled to the margin rather than to twice it.
   *
   * The fit is allowed to stop short for exactly one other reason, and it is
   * not a fault: a single update in a wide pane hits the ceiling, which is
   * the rule that stops one card becoming a poster. So the question asked of
   * a ceiling-bound fit is whether it is AT the ceiling, not whether it fills
   * the floor — asking the second of a fit that cannot answer it is how a
   * check calls a working rule a fault.
   */
  /*
   * ON THE BINDING AXIS, which is not always the vertical one.
   *
   * This measured the gap above and below and nothing else. That was right
   * while the timeline's strip stood over the pane and took its height away:
   * the room was short, so the vertical ran out first. With the strip a block
   * below rather than a band over, the pane is whole and it is the WIDTH that
   * runs out first — so reading the vertical was reading the slack side and
   * calling a fit that fills the room a fit that does not. The fit's own
   * comment has said this the whole time: measured on the binding axis, not
   * as an area.
   */
  const ceiling = zoomCeiling(b.paneW, b.cardW);
  const slackAcross = Math.min(b.left, b.paneW - b.right);
  const slackDown = Math.min(b.top, b.room - b.bottom);
  const binding = slackAcross <= slackDown ? "across" : "down";
  const gap = Math.min(slackAcross, slackDown);
  if (b.zoom && Math.abs(b.zoom - ceiling) < 0.005) {
    check(`${n}: the fit stopped at the ceiling, as one card in a wide pane should`, true,
      `fit ${b.zoom.toFixed(3)} is the ceiling for a ${b.cardW}px card in a ${b.paneW}px pane`);
  } else {
    check(`${n}: the set fills the room to the margin on the axis that runs out first`, gap <= SETTLE_MARGIN + 4,
      `slack ${slackAcross}px across and ${slackDown}px down, so ${binding} binds — margin ${SETTLE_MARGIN}, fit ${b.zoom?.toFixed(3)}`);
  }
}

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
