/**
 * The Grid fill paints a grid, and one definition says how big its tile is.
 *
 * `fillLayers` returned two `linear-gradient`s and nothing else, so the page
 * got `background-size: auto` — a gradient the size of the element, which is
 * ONE 1px line down the left and ONE across the top. A hairline, not a grid.
 *
 * Every place that wanted a grid had therefore patched a size in behind the
 * others' backs, and no two agreed: the swatch in the Look panel drew it at
 * 8px, the board's page frame at 24px, and the live page and the exported
 * site at neither. The doc comment on `fillLayers` says it exists so "a
 * swatch in the panel cannot drift from what the page actually does", and it
 * had drifted three ways.
 *
 * So the tile belongs to the fill. A layer carries its own size, every
 * consumer reads it, and a miniature asks for a smaller tile rather than
 * overruling one it was handed.
 *
 *   node tests/fill-tile.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";

/*
 * The source imports its neighbours the way the bundler lets it — `../look`,
 * with no extension — and node will not guess. One hook, so this suite can
 * read the real module rather than a copy of it.
 */
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith(".") && !/\.[a-z]+$/i.test(spec)) {
      try { return next(`${spec}.ts`, ctx); } catch { /* fall through */ }
      try { return next(`${spec}/index.ts`, ctx); } catch { /* a module folder: its door */ }
    }
    return next(spec, ctx);
  },
});

const { FILL_TILE, fillLayers, themeFrom } = await import("../src/features/studio/shelf/parts/theme.ts");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const format = (background) => ({ "palette.background": background, "palette.accentHue": 265, "palette.mode": "dark" });

/* ------------------------------------------------------------------ */
/* 1. A grid layer carries its own tile                                */
/* ------------------------------------------------------------------ */

const grid = fillLayers("grid", 265, false);
check("the grid fill is two crossed rules", grid.length === 2, `${grid.length} layer(s)`);
check(
  "every grid layer carries a tile size of its own",
  grid.length === 2 && grid.every((l) => typeof l.size === "string" && /\d+px \d+px/.test(l.size)),
  grid.map((l) => l?.size ?? "none").join(" / "),
);
check(
  "the tile is the one the fill declares",
  grid.every((l) => l.size === `${FILL_TILE}px ${FILL_TILE}px`),
  `FILL_TILE ${FILL_TILE}`,
);
check("the tile is big enough to read as a grid rather than a weave", FILL_TILE >= 12 && FILL_TILE <= 64, `${FILL_TILE}px`);
check(
  "a miniature may ask for a smaller tile instead of overruling one",
  fillLayers("grid", 265, false, 8).every((l) => l.size === "8px 8px"),
);

/* ------------------------------------------------------------------ */
/* 2. The page actually gets it                                        */
/* ------------------------------------------------------------------ */

const tile = `${FILL_TILE}px ${FILL_TILE}px`;
const backdrop = themeFrom(format("grid")).backdrop;
check("a grid page has a backdrop with both rules in it", (backdrop.match(/linear-gradient/g) ?? []).length === 2, backdrop.slice(0, 60));
check(
  "the backdrop sizes every rule it paints",
  (backdrop.match(new RegExp(`/ ${tile}`, "g")) ?? []).length === 2,
  backdrop,
);
check("the backdrop still ends in the page's own colour", /oklch\([^)]*\)\s*$/.test(backdrop.trim()), backdrop.slice(-40));

/* A fill with no tile is unharmed: a gradient covers, it does not repeat. */
const flat = themeFrom(format("flat")).backdrop;
check("flat is still just the colour", /^oklch\(/.test(flat.trim()) && !/gradient/.test(flat), flat);
for (const soft of ["subtle gradient", "mesh gradient"]) {
  const b = themeFrom(format(soft)).backdrop;
  check(`${soft} is one gradient over the colour, with no tile forced on it`, /radial-gradient/.test(b) && !/\d+px \d+px/.test(b), b.slice(0, 50));
}

/* ------------------------------------------------------------------ */
/* 3. Under a texture, the fill keeps its tile                         */
/* ------------------------------------------------------------------ */

const look = { palette: {}, texture: [{ id: "tx_t", kind: "grain", role: "accent", scale: 160, angle: 45, opacity: 0.05, contrast: 0.3, blend: "overlay", hue: 0, target: "page", on: true }] };
const under = themeFrom(format("grid"), look).surfaceStyle;
check("a texture over the grid does not drop it", !!under && (under.backgroundImage.match(/linear-gradient/g) ?? []).length >= 2, under ? under.backgroundImage.slice(0, 50) : "no surfaceStyle");
check(
  "and the grid under a texture is still a tile, not a hairline",
  !!under && (under.backgroundSize.match(new RegExp(tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length === 2,
  under ? under.backgroundSize : "no surfaceStyle",
);

/* ------------------------------------------------------------------ */
/* 4. Nobody patches a size in behind the fill's back                  */
/* ------------------------------------------------------------------ */

const panel = readFileSync("src/features/studio/look/LookPanel.tsx", "utf8");
check("the Look panel's swatch no longer hardcodes a grid tile", !/f\.id === "grid" \?/.test(panel));

const canvas = ["Canvas.tsx", ...readdirSync("src/features/studio/board").filter((f) => /\.tsx?$/.test(f)).map((f) => `board/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
check("the board's page frame no longer hardcodes a grid tile", !/backgroundSize: "24px 24px"/.test(canvas));

const theme = readFileSync("src/features/studio/shelf/parts/theme.ts", "utf8");
check("the tile has one home", (theme.match(/FILL_TILE/g) ?? []).length >= 2);

/* ------------------------------------------------------------------ */
/* 5. On the board, where the three sizes disagreed                    */
/* ------------------------------------------------------------------ */

/*
 * The half that would have caught this in the first place. Everything above
 * reads what the code means to draw; this reads what the page is given.
 */
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
    await page.waitForTimeout(1400);
    await page.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
    await page.waitForTimeout(700);

    /* The fill's own row left the Look panel (J, 2026-10-10): the page's Texture row carries it. The fill itself still paints, set as a control sets it. */
    check("the Look panel has no second fill row", (await page.locator("[data-look-fill]").count()) === 0);
    await page.evaluate(() => window.__studioSetFormat("palette.background", "grid"));
    await page.waitForTimeout(600);

    const frame = await page.evaluate(() => {
      const f = document.querySelector("[data-frame]");
      if (!f) return null;
      const c = getComputedStyle(f);
      return { size: c.backgroundSize, image: c.backgroundImage };
    });
    check(
      "choosing Grid gives the page a tiled grid, not one hairline",
      !!frame && frame.size.split(",").filter((p) => p.trim() === tile).length === 2,
      frame ? frame.size : "no frame",
    );
    check("and it is two crossed rules that are tiled", !!frame && (frame.image.match(/linear-gradient/g) ?? []).length === 2);


    await browser.close();
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
