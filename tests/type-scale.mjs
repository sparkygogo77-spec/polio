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

const SIZES = [["fine", 9], ["small", 10], ["plain", 11], ["large", 12]];

/* ------------------------------------------------------------------ */
/* 1. The four are declared, once, with the sizes they replaced        */
/* ------------------------------------------------------------------ */

const css = readFileSync("src/app/globals.css", "utf8");
for (const [name, px] of SIZES) {
  check(`--text-${name} is ${px}px, the value it was swept from`, new RegExp(`--text-${name}:\\s*${px}px;`).test(css));
}
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
const left = execFileSync("git", ["grep", "-l", "-E", "text-\\[(9|10|11|12)px\\]", "--", "src/**/*.tsx"], { encoding: "utf8" })
  .split("\n").filter(Boolean);
check(
  "nothing in the Builder's own chrome still hardcodes one of the four",
  left.every((f) => f.startsWith("src/features/studio/parts/")),
  left.length ? left.join(", ") : "none left anywhere",
);
/*
 * `parts/` is left alone ON PURPOSE. A part is what the exported site is
 * made of, and the export writes its own stylesheet from the document's
 * tokens rather than shipping this one. A name the export's CSS has never
 * heard of is a size that silently goes missing in somebody's built site,
 * which is the same fault as above with nobody watching. An arbitrary value
 * needs no stylesheet to agree with it.
 */
check(
  "and the parts a site is built from still carry theirs, rather than having been swept and forgotten",
  left.length > 0 && left.every((f) => f.startsWith("src/features/studio/parts/")),
  left.join(", ") || "nothing left, which means the exemption was swept too",
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
        `the Builder wears text-${name} and it renders at ${px}px`,
        w.count > 0 && w.sizes.length === 1 && w.sizes[0] === `${px}px`,
        `${w.count} element(s), ${w.sizes.join("/") || "none"}`,
      );
    }
    await browser.close();
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
