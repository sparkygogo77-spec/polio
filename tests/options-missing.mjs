/**
 * A PART WITH NO OPTIONS NEVER TAKES THE BOARD DOWN.
 *
 * lighter-builder (2026-10-21): an imported thesolface board, reopened,
 * showed "This page couldn't load": `Cannot read properties of undefined
 * (reading 'variant')`, from `opt(options, "variant")` in a button. One part,
 * `n_ctaprimary_small_1` (the site's phone-width menu button, from the
 * widths import), had no `options`. Every part on the shelf reads its options
 * through `opt()`, and a part missing them killed the whole page.
 *
 * Three guards, each enough on its own:
 *   · `opt()` reads a missing options as none;
 *   · every document taken in (`takeDoc`, the import) and every board read
 *     back (`mergeDoc`, on load) gives each part `options`, `{}` where it had
 *     none: the repair for a board already saved without them;
 *   · and, in the browser, a saved board with such a part opens and draws it.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/options-missing.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const { opt } = await jiti.import(join(studio, "shelf", "parts", "types.ts"));
const { takeDoc, withOptions } = await jiti.import(join(studio, "docTake.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The phone-width menu button as the bad board held it: everything but its options. */
const button = { id: "n_ctaprimary_small_1", pageId: "home", featureId: "cta-primary", label: "button “Open navigation”", prompt: "", content: "Open navigation", data: "", x: 40, y: 40, w: 160, h: 48, groupId: null, priority: "must", custom: false, locked: false, link: null, colour: null };

let read;
try { read = opt(undefined, "variant", "solid"); } catch (e) { read = `threw: ${e.message}`; }
check("opt() reads a missing options as none, and gives the default", read === "solid", String(read));

const taken = takeDoc({ nodes: [], pages: [], format: {}, look: {}, frameWidth: 1440 }, { nodes: [button], pages: [{ id: "home", name: "Home", path: "/" }] }, { format: () => ({}), look: () => ({}) });
const got = (taken.nodes ?? []).find((n) => n.id === button.id);
check("a document taken in gives the part options", !!got && typeof got.options === "object" && got.options !== null, JSON.stringify(got?.options));
const kept = [{ ...button, options: { variant: "outline" } }];
check("control: a part's own options are kept as they are", withOptions(kept)[0].options.variant === "outline" && withOptions(kept) === kept);

/* In the browser: a board saved with the button and no options, opened. */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((b) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "nooptions", name: "nooptions", updatedAt: Date.now() }], activeId: "nooptions" }));
  localStorage.setItem("builder.studio", env({ pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "home", nodes: [b] }));
}, button);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({ broke: /couldn.t load/i.test(document.body.innerText), drawn: !!document.querySelector('[data-node-id="n_ctaprimary_small_1"]'), options: (window.__studioNodes?.() ?? []).find((n) => n.id === "n_ctaprimary_small_1")?.options ?? null }));
check("the board saved without the button's options opens", !state.broke, errors.slice(0, 1).join(""));
check("…draws the button", state.drawn);
check("…and has repaired it: the part has options now", !!state.options && typeof state.options === "object", JSON.stringify(state.options));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
