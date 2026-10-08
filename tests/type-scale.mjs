/**
 * The Builder's four font sizes have names, and the names still paint.
 *
 * 578 arbitrary values across 66 files — `text-[10px]` and its three
 * neighbours — were the same decision taken 578 times, and the highest
 * leverage thing in the tree that a rename could fix: four tokens, and every
 * panel, label and caption follows them.
 *
 * A rename of a Tailwind class has one failure mode and it is silent.
 * `tailwind-merge` knows Tailwind's own scale and nothing else, so it read a
 * custom `text-*` name as a text COLOUR and dropped the size as a duplicate
 * wherever a component set both in one `cn` call. The words then inherited
 * 13px and nothing said a word. That is what the sweep did on its first run:
 * a census of every rendered font size in the Builder showed 9, 10 and 11px
 * counts falling and 13px rising by exactly the same number, in all eight
 * views. So `cn` declares the four (`src/core/lib/cn.ts`), and this holds it.
 *
 *   node tests/type-scale.mjs [url]
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { cn } from "../src/core/lib/cn.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The name, the px it was swept from, and the rem that is exactly that px
   at the default scale: 9, 10, 11 and 12 over 16, each exact in binary. */
const SIZES = [["fine", 9, "0.5625rem"], ["small", 10, "0.625rem"], ["plain", 11, "0.6875rem"], ["large", 12, "0.75rem"]];

/** The ends of the Font scale slider, from `defs.ts`. */
const SCALE = { min: 0.85, max: 1.25 };

/* ------------------------------------------------------------------ */
/* 1. The four are declared, once, with the sizes they replaced        */
/* ------------------------------------------------------------------ */

const css = readFileSync("src/app/globals.css", "utf8");
for (const [name, px, rem] of SIZES) {
  check(
    `--text-${name} is ${rem}, which is the ${px}px it was swept from`,
    new RegExp(`--text-${name}:\\s*${rem};`).test(css) && Math.abs(parseFloat(rem) * 16 - px) < 1e-9,
  );
}
/*
 * In rem rather than px, and that is the point of them. `html` carries
 * `font-size: calc(100% * var(--font-scale))`, so a px size is a size the
 * Font scale setting cannot reach — which is what the Builder's own chrome
 * was, all 578 of them.
 */
check(
  "the four are in rem, so Font scale reaches the Builder's own chrome",
  !/--text-(fine|small|plain|large):\s*\d+px;/.test(css),
);
check(
  "no line height rides along with them",
  !/--text-(fine|small|plain|large)--line-height/.test(css),
  "a line height added here would move text in hundreds of places under cover of a rename",
);

/* ------------------------------------------------------------------ */
/* 2. `cn` keeps a named size beside a colour                          */
/* ------------------------------------------------------------------ */

/*
 * The regression that nearly shipped, in both orders, because it depends on
 * which class `tailwind-merge` sees last.
 */
for (const [name] of SIZES) {
  const a = cn(`text-${name}`, "text-fg-muted");
  const b = cn("text-fg-muted", `text-${name}`);
  check(
    `text-${name} survives being merged with a colour, either way round`,
    a.includes(`text-${name}`) && a.includes("text-fg-muted") && b.includes(`text-${name}`) && b.includes("text-fg-muted"),
    `"${a}" / "${b}"`,
  );
}
check("and two sizes still collapse to the last one, as a size must", cn("text-small", "text-large") === "text-large", cn("text-small", "text-large"));

/* ------------------------------------------------------------------ */
/* 3. The sweep is complete, and says where it stopped                 */
/* ------------------------------------------------------------------ */

/* Components only. The token block and `cn` both NAME the old classes in
   their comments, and a check that cannot tell a class from a sentence
   about a class is a check that fails on its own documentation. */
/* `git grep` answers "nothing found" with exit 1: that is an empty list, not a failure. */
const grepFiles = (args) => { try { return execFileSync("git", ["grep", "-l", ...args], { encoding: "utf8" }).split("\n").filter(Boolean); } catch (e) { if (e.status === 1) return []; throw e; } };
const left = grepFiles(["-E", "text-\\[(9|10|11|12)px\\]", "--", "src/**/*.tsx"]);
check(
  "nothing in the Builder's own chrome still hardcodes one of the four",
  left.every((f) => f.startsWith("src/features/studio/shelf/parts/")),
  left.length ? left.join(", ") : "none left anywhere",
);
/*
 * `parts/` never takes the four NAMES. A part is what the exported site is
 * made of, and the export writes its own stylesheet from the document's
 * tokens rather than shipping this one: a name the export's CSS has never
 * heard of is a size that silently goes missing in somebody's built site.
 * A part's sizes come from the site's own scale instead (`t.fontPx`, the
 * site's base size, which the export carries), and a fixed pixel size in a
 * part is the same decision taken outside that scale. This used to hold the
 * opposite, that parts must still carry a pixel size, which read a sweep
 * of the last two (Mesh's fallback line and its badge) as a mistake.
 */
const named = grepFiles(["-E", "\\btext-(fine|small|plain|large)\\b", "--", "src/features/studio/shelf/parts/**/*.tsx", "src/features/studio/shelf/parts/*.tsx"]);
check(
  "and no part a site is built from uses the Builder's own size names, which the exported site does not have",
  named.length === 0,
  named.join(", ") || "none",
);

/* ------------------------------------------------------------------ */
/* 4. On screen, at the size the name promises                         */
/* ------------------------------------------------------------------ */

const url = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }

if (!live) {
  console.log(`  ..   the live half is skipped, ${url} did not answer`);
} else {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const { chromium } = (() => {
    for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
      try { return req(c); } catch { /* next */ }
    }
    return {};
  })();
  if (!chromium) {
    console.log("  ..   the live half is skipped, no Playwright");
  } else {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto(`${url}/builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    /* Every element wearing each name, measured. One that resolves to the
       inherited size is a utility that does not exist. */
    const worn = await page.evaluate((sizes) => {
      const out = {};
      for (const [name] of sizes) {
        const els = [...document.querySelectorAll(`.text-${name}`)];
        out[name] = { count: els.length, sizes: [...new Set(els.map((e) => getComputedStyle(e).fontSize))] };
      }
      return out;
    }, SIZES);

    for (const [name, px] of SIZES) {
      const w = worn[name];
      check(
        `the Builder wears text-${name} and it renders at exactly ${px}px`,
        w.count > 0 && w.sizes.length === 1 && w.sizes[0] === `${px}px`,
        `${w.count} element(s), ${w.sizes.join("/") || "none"}`,
      );
    }

    /*
     * And the thing the rem was for: the dial moves them. Read at both ends
     * of the slider, because a size that only grows is half a setting.
     */
    for (const end of [SCALE.max, SCALE.min]) {
      const at = await page.evaluate((scale) => {
        document.documentElement.style.setProperty("--font-scale", String(scale));
        const out = {};
        for (const name of ["fine", "small", "plain", "large"]) {
          const el = document.querySelector(`.text-${name}`);
          out[name] = el ? getComputedStyle(el).fontSize : null;
        }
        return out;
      }, end);
      for (const [name, px] of SIZES) {
        const want = px * end;
        check(
          `at ${Math.round(end * 100)}% Font scale, text-${name} is ${want.toFixed(2)}px`,
          at[name] !== null && Math.abs(parseFloat(at[name]) - want) < 0.05,
          `${at[name] ?? "not on screen"}`,
        );
      }
    }
    await page.evaluate(() => document.documentElement.style.removeProperty("--font-scale"));
    await browser.close();
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
