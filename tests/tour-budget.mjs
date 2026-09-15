/**
 * The recorded tour fits the time the route has, and says what it did with the width (inventory C14).
 *
 * The preview-video route has 180 s (`maxDuration`) and spent them blind:
 * a slow tour (160 px/s) looped four times over a 6000 px page is about
 * 220 s of scrolling, then ffmpeg with its own 120 s timeout, and the
 * platform killed the function with no response at all. A width that was
 * not 640, 960 or 1280 was quietly made 960. Now:
 *
 *   · one pure plan (`tourPlan`) turns the request into a tour with a
 *     deadline and an ffmpeg allowance that together fit inside the route's
 *     time, and names the width it will use and whether it changed it;
 *   · the tour in the page stops at its deadline, and the response says
 *     when it was cut and at which width it was made.
 *
 * The plan is run here; that the route uses it is a source read, named as
 * one: staging the stall itself is minutes of recording.
 *
 *   node tests/tour-budget.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let tourPlan = null;
try { ({ tourPlan } = await import("../src/app/api/studio/preview-video/plan.ts")); } catch { /* not there yet */ }
check("the tour's plan is a pure function", typeof tourPlan === "function");
if (tourPlan) {
  const MAX = 180;
  const p = tourPlan({ speed: "slow", loops: 4, width: 960 }, MAX);
  check("a slow four-loop tour gets a deadline inside the route's time, with room left for ffmpeg and the launch", p.tourMs + p.ffmpegMs + p.launchMs <= MAX * 1000, `${p.tourMs / 1000} s tour + ${p.ffmpegMs / 1000} s ffmpeg + ${p.launchMs / 1000} s launch in ${MAX} s`);
  check("and at least a minute of tour to work with", p.tourMs >= 60_000, `${p.tourMs / 1000} s`);
  check("ffmpeg's allowance is no longer a flat two minutes past the deadline", p.ffmpegMs < 120_000, `${p.ffmpegMs / 1000} s`);
  check("the speeds are what they were", tourPlan({ speed: "slow" }, MAX).pxPerSec === 160 && tourPlan({ speed: "fast" }, MAX).pxPerSec === 540 && tourPlan({}, MAX).pxPerSec === 300);
  check("loops are held to one to four", tourPlan({ loops: 9 }, MAX).loops === 4 && tourPlan({ loops: 0 }, MAX).loops === 1 && tourPlan({}, MAX).loops === 1);
  const w = tourPlan({ width: 800 }, MAX);
  check("a width that is not 640, 960 or 1280 is made 960 and said so", w.width === 960 && w.coerced === true && /800/.test(w.note ?? "") && /960/.test(w.note ?? ""), w.note ?? "no note");
  const ok = tourPlan({ width: 1280 }, MAX);
  check("a width that is one of them is kept, with nothing to say", ok.width === 1280 && ok.coerced === false && !ok.note, ok.note ?? "");
}

/* The route reads the plan, the tour stops at its deadline, the response says so. */
const route = readFileSync("src/app/api/studio/preview-video/route.ts", "utf8");
check("the route builds its tour from the plan (source read)", /tourPlan\(/.test(route));
check("the tour in the page takes a deadline and stops at it (source read)", /stopAt/.test(route.split("async function tourInPage")[1]?.split("\n}\n")[0] ?? "") && /Date\.now\(\) >= arg\.stopAt|performance\.now\(\) >= arg\.stopAt|now\(\) >= arg\.stopAt/.test(route));
check("ffmpeg runs under the plan's allowance, not a flat timeout (source read)", !/timeout: 120_000/.test(route) && /timeout: [a-zA-Z.]+ffmpegMs/.test(route));
check("the response names the width used and any cut (source read)", /x-tour-width/.test(route) && /x-tour-note/.test(route) && /cut/.test(route));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
