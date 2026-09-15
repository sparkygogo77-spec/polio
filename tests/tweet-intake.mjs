/**
 * A video the browser cannot play still goes in, and a long recording keeps its length (inventory C15, C16).
 *
 * The tweet console takes a video X takes (MP4, MOV, WebM). A ProRes or
 * HEVC .mov, which X accepts and this browser cannot decode, threw "That
 * video could not be read" and the whole intake failed, when only the
 * thumbnail needed decoding. And the GIF recorder promised to keep a
 * recording's length while thinning frames, but held the rate to at least
 * 4 fps under a 360-frame cap, so a five-minute recording became a
 * ninety-second GIF. Now:
 *
 *   · a video the browser cannot draw a frame of goes in with no preview,
 *     and the console says so as a warning, not a failure;
 *   · the frame rate is one pure rule (`gifRate`): frames thin as far as
 *     the length needs, so the GIF is as long as the recording.
 *
 * The rate is run here. The intake is run in the browser, through the
 * console's own Add media, with a file that says it is a QuickTime video
 * and is not one. Encoding a real five-minute video is not staged; that
 * the recorder reads the rule is a source read, named as one.
 *
 *   node tests/tweet-intake.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. The rate. */
let gifRate = null;
try { ({ gifRate } = await import("../src/features/tweets/gifRate.ts")); } catch { /* not there yet */ }
check("the GIF's frame rate is a pure rule", typeof gifRate === "function");
if (gifRate) {
  const five = gifRate(300, 12, 360);
  check("a five-minute recording at 12 fps under 360 frames keeps its five minutes", Math.abs(five.frames / five.fps - 300) < 1, `${five.frames} frames at ${five.fps.toFixed(2)} fps is ${(five.frames / five.fps).toFixed(0)} s`);
  check("by thinning to about 1.2 fps", five.fps > 1 && five.fps < 1.3, five.fps.toFixed(2));
  const short = gifRate(10, 12, 360);
  check("a ten-second recording keeps its 12 fps", short.fps === 12 && short.frames === 120, `${short.frames} at ${short.fps}`);
  const unknown = gifRate(0, 12, 360);
  check("a recording of unknown length keeps the asked rate and the cap", unknown.fps === 12 && unknown.frames === 360);
}
const rec = readFileSync("src/features/tweets/gif-browser.ts", "utf8");
check("the recorder reads the rule and no longer holds the rate to 4 fps (source read)", /gifRate\(/.test(rec) && !/Math\.max\(4,/.test(rec));

/* 2. The intake, in the console. */
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${URL_BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.evaluate(() => localStorage.removeItem("builder.tweets"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.keyboard.press("t");
await page.waitForTimeout(700);
const console_ = page.locator("[data-tweet-console]");
check("T opens the tweet console", (await console_.getAttribute("data-open")) === "1", `data-open ${await console_.getAttribute("data-open")}`);
const newDraft = console_.getByRole("button", { name: /new draft/i }).first();
if (await newDraft.count()) await newDraft.click();
await page.waitForTimeout(600);
const input = console_.locator('input[type="file"]').first();
check("the draft has an Add media input", (await input.count()) === 1);
await input.setInputFiles({ name: "clip.mov", mimeType: "video/quicktime", buffer: Buffer.alloc(200 * 1024, 0x11) });
await page.waitForTimeout(3000);
const state = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.tweets") ?? "{\"state\":{}}").state);
const media = (state.drafts ?? []).flatMap((d) => (d.posts ?? []).flatMap((p) => p.media ?? []));
const log = (state.log ?? []).slice(-5);
check("a video the browser cannot decode still goes into the draft", media.length === 1 && media[0].kind === "video" && media[0].name === "clip.mov", `${media.length} media; last log: ${log.map((l) => `${l.level}: ${l.title}`).join(" | ") || "none"}`);
check("with no preview rather than a failure", media.length === 1 && media[0].thumb === "", media[0] ? `thumb ${media[0].thumb.length} chars` : "no media");
const warned = log.find((l) => l.level === "warn" && /clip\.mov/.test(l.title ?? ""));
check("and the console says so as a warning naming the preview", !!warned && /preview|frame|play/i.test(`${warned.title} ${warned.body}`), warned ? `${warned.title}: ${warned.body}` : log.map((l) => `${l.level}: ${l.title}`).join(" | ") || "no log");
check("and not as an error", !log.some((l) => l.level === "error" && /clip\.mov/.test(l.title ?? "")));

await page.evaluate(() => localStorage.removeItem("builder.tweets"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
