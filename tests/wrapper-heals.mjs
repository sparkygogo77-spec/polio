/**
 * WHAT THE HEALING DOES TO A WRAPPER THAT IS ADRIFT, AND TO ONE PUT RIGHT.
 *
 * A MEASUREMENT for a decision, not a change. Nothing here repositions
 * anything: both boards are seeded, one with the fault and one with the
 * correction already applied, and the question is only what the healing then
 * does to each.
 *
 * I ALSO TOLD THE COORDINATOR THE OPPOSITE OF WHAT THIS MEASURES, and it is
 * worth having in the file. I said shrinking wrappers would never close gaps
 * because the healing is monotone — it pushes down and never pulls back. That
 * is true of the healing, and the conclusion drawn from it was wrong, because
 * repositioning does not need the healing to pull anything back. It removes
 * the REASON the healing pushed.
 *
 * The fault, at his shape: the banner's own rect is 1763x82 at y 0 and the
 * logo it owns overflows to y -11. The healing saw a box overlapping a part,
 * and its only direction was down. Since the healing places a captured page
 * by what holds what (`textFit.ts#fitTree`), the logo is the banner's content
 * and nothing is pushed: section 1 now asserts that, where it used to assert
 * the fault.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/wrapper-heals.mjs http://127.0.0.1:3013
 */
import { SWEEP } from "../src/features/studio/reassemble.ts";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, sel, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: { url: "https://solworks.dev/", host: "solworks.dev", selector: sel, at: 1 }, byHand: false, ...extra,
});

const faulty = [
  node("banner", "box", "", 0, 0, 1763, 82, "body > div > header"),
  node("logo", "picture", "", 826, -11, 112, 112, "body > div > header > div > img", { picture: { id: "p" } }),
  node("mark", "prose", "SOLCINERATOR", 40, 19, 300, 30, "body > div > header > div > span"),
  node("below1", "prose", "The first section under the header, with a sentence in it.", 40, 150, 800, 40, "body > div > main > p"),
  node("below2", "prose", "And a second one after that.", 40, 220, 800, 40, "body > div > main > p:nth-of-type(2)"),
  node("below3", "prose", "And a third.", 40, 290, 800, 40, "body > div > main > p:nth-of-type(3)"),
];
/* The same board with the GROW-ONLY correction already applied: the banner
   lifted to -11 and grown to 112, so it holds what it owns. */
const put_right = faulty.map((n) => (n.id === "banner" ? { ...n, y: -11, h: 112 } : n));

const mk = (nodes) => JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SOLWORKS", gimmick: "", master: "" },
  look: { palette: { bg: "rgb(16,21,26)" }, texture: [], target: "page" },
  /* Marked swept: this is about the healing, not about the sweep — and the
     mark is read from `SWEEP` so it keeps standing aside as that is bumped. */
  frameWidth: 1763, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const open = async (d) => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript((x) => localStorage.setItem("builder.studio", x), d);
  const p = await ctx.newPage();
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3200);
  const out = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {};
    return Object.fromEntries((s.nodes ?? []).map((n) => [n.id, { y: n.y, h: n.h }]));
  });
  await ctx.close();
  return out;
};

const A = await open(mk(faulty)), B = await open(mk(put_right));
const seeded = (set, id) => set.find((n) => n.id === id);
const bottom = (o) => Math.max(...Object.values(o).map((v) => v.y + v.h));

/* ------------------------------------------------------------------ */
/* 1. The fault, left alone: the healing no longer amplifies it        */
/* ------------------------------------------------------------------ */

/*
 * THIS HALF USED TO ASSERT THE FAULT. It checked that the healing pushed the
 * adrift banner DOWN past the logo it owns — y 0 to 101 — and dragged every
 * part below by the same amount: an 11px overhang turned into a hundred
 * pixels of dead space. That was measured, and it was the healing placing
 * every part on its own against whatever it overlapped, with no notion of
 * what holds what. A suite defending it would be defending the bug.
 *
 * The healing now places a captured page as the tree its recorded paths
 * describe: the logo's path continues the banner's, so the logo is the
 * banner's content, not something above it to be cleared. Left alone, the
 * banner is not pushed, nothing below it moves, and the page is exactly as
 * tall as the one put right.
 */
check("left alone, the banner owns the logo by its recorded path, so the healing does not push it down",
  A.banner.y === seeded(faulty, "banner").y, `y ${seeded(faulty, "banner").y} → ${A.banner.y}`);
check("…and drags nothing below it: every part below keeps its distance from the banner",
  ["below1", "below2", "below3"].every((id) => A[id].y - A.banner.y === seeded(faulty, id).y - seeded(faulty, "banner").y),
  ["below1", "below2", "below3"].map((id) => `${id} ${seeded(faulty, id).y} → ${A[id].y}`).join(", "));
check("…so the 11px overhang no longer becomes dead space: left alone, the page is as tall as put right",
  bottom(A) === bottom(B), `${bottom(A)} against ${bottom(B)}`);

/* ------------------------------------------------------------------ */
/* 2. Put right, the healing has nothing to do                         */
/* ------------------------------------------------------------------ */

check("with the banner grown to hold what it owns, the healing moves NOTHING",
  ["banner", "logo", "mark", "below1", "below2", "below3"].every((id) => B[id].y === seeded(put_right, id).y),
  Object.entries(B).map(([k, v]) => `${k} ${v.y}`).join(", "));

/*
 * AND THE DIRECTION MATTERS. The correction only ever lifts a box or makes it
 * taller. The healing only ever pushes down. They cannot fight: there is no
 * arrangement in which the correction moves a box up and the healing puts it
 * back, because the healing moves a box only to clear something it overlaps,
 * and the correction's whole purpose is to stop it overlapping.
 */
check("the correction moved the banner UP and made it TALLER, never the other way",
  seeded(put_right, "banner").y < seeded(faulty, "banner").y && seeded(put_right, "banner").h > seeded(faulty, "banner").h);
check("…and nothing the correction touched was pushed back down afterwards",
  B.banner.y === seeded(put_right, "banner").y, `${B.banner.y}`);

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
