/**
 * WHAT IS OFF THE PAGE IS NOT THE PAGE: A PART IS DRAWN CUT AT ITS EDGE.
 *
 * THE OWNER'S REPORT, trumpmorty.fun imported: the planet (n_picture_10,
 * 1109×1109 at -355,-441) hangs far out of the frame's top-left over the
 * board, and the hero's layers (x -72, 1584 wide) and the ticker ribbons
 * spill past both sides. The site clips at its edge (body overflow-x hidden,
 * nothing above 0), and so does the export (`overflow: clip` on the frame).
 *
 * So on the board each part's drawing is cut to the page: above 0, left of 0
 * and right of the frame's width (`pageClip`). The page grows downward to
 * hold what is below, so the foot is never cut. Only the drawing: the part's
 * box, its selection and its handles, and the ink drawn round the page
 * (`tests/board-edges.mjs`), are not cut.
 *
 *   node tests/board-clips.mjs [builder url]    (the board half needs the url)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const mod = await jiti.import(join(here, "..", "src", "features", "studio", "pageClip.ts")).catch(() => ({}));
const pageClip = mod.pageClip ?? (() => "missing");

check("the planet at -355,-441 is cut 441 from its top and 355 from its left",
  pageClip({ x: -355, y: -441, w: 1109 }, 1440) === "inset(441px 0px 0px 355px)", pageClip({ x: -355, y: -441, w: 1109 }, 1440));
check("a ribbon 1584 wide at -72 is cut 72 each side",
  pageClip({ x: -72, y: 459, w: 1584 }, 1440) === "inset(0px 72px 0px 72px)", pageClip({ x: -72, y: 459, w: 1584 }, 1440));
check("control: a part inside the page is not cut at all", pageClip({ x: 100, y: 100, w: 300 }, 1440) === undefined);
check("control: a part below the page's first screen is not cut at its foot", pageClip({ x: 0, y: 5400, w: 1440 }, 1440) === undefined);

const URL_ = process.argv[2];
if (URL_) {
  const { createRequire } = await import("node:module");
  const { chromium } = createRequire(import.meta.url)("playwright-core");
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const node = (id, x, y, w, h, extra = {}) => ({
    id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
    priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: "rgb(210, 60, 52)" }, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
  });
  const doc = JSON.stringify({ state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [node("planet", -355, -441, 1109, 1109), node("inside", 600, 300, 200, 100)],
    groups: [], shapes: [], format: {}, brief: { name: "CLIP", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
  }, version: 0 });
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await ctx.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const got = await page.evaluate(() => {
    const frame = document.querySelector("[data-frame]")?.getBoundingClientRect();
    const drawn = (id) => {
      const el = document.querySelector(`[data-node-id="${id}"]`);
      const inner = el?.querySelector("[data-part-drawn]") ?? el?.firstElementChild;
      /* The painted rectangle: the element's box less its clip. */
      const r = inner?.getBoundingClientRect();
      const m = /inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px\)/.exec(inner ? getComputedStyle(inner).clipPath : "");
      const k = el ? el.getBoundingClientRect().width / Number(el.style.width.replace("px", "")) : 1;
      const [t, rt, b, l] = m ? m.slice(1).map(Number) : [0, 0, 0, 0];
      return r ? { top: r.top + t * k, left: r.left + l * k, right: r.right - rt * k, bottom: r.bottom - b * k } : null;
    };
    return { frame: frame && { top: frame.top, left: frame.left, right: frame.right }, planet: drawn("planet"), inside: drawn("inside"), el: !!document.querySelector('[data-node-id="planet"]') };
  });
  await browser.close();
  const f = got.frame, p = got.planet;
  check("board: the planet's drawing starts at the page's top-left, not above it or left of it",
    !!f && !!p && p.top >= f.top - 0.5 && p.left >= f.left - 0.5, JSON.stringify(got));
  check("board: control, the part inside is drawn whole", !!got.inside && got.inside.right > got.inside.left, JSON.stringify(got.inside));
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
