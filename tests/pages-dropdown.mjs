/**
 * The pages take the same room on the bar at nine pages as at fourteen.
 *
 * HIS BAR, MEASURED. At a 1753px window the nine page tabs of sink ran from
 * x 206 to 962: 740px, 42% of the bar, with 34 tools squeezed into the rest,
 * and "Documentation 69" reading "Documentation 6". Every page added took
 * another 60 to 120px from the tools. So the pages fold into one control:
 * the page you are on, its part count, a way to the others, and Add page on
 * the same edge.
 *
 * What this holds, all of it read off the running Builder, none of it a
 * number the code wrote:
 *   · the room the pages take does not grow with the page count, at the
 *     owner's width and at narrower ones;
 *   · every page's name and part count can be read in full, the counts
 *     taken from the board itself, not from this file;
 *   · the page you are on is shown on the bar without opening anything;
 *   · choosing a page still opens it, and a page still has its right-click
 *     menu; Add page still adds one;
 *   · no control on the bar is cut off.
 *
 * A layout check can pass by construction; this one was run against the
 * strip it replaces first, and failed there on the width and the counts.
 *
 *   npx next start -p 3013
 *   node tests/pages-dropdown.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* Sink's nine pages, with as many parts on each as a fresh import leaves, and five more with long names. */
const SINK = [["Creator Hub", 109], ["Cleanup", 72], ["Tokens", 64], ["NFTs", 69], ["cNFTs", 69], ["Domains", 64], ["LP", 69], ["Unknown", 67], ["Documentation", 69]];
const MORE = [["Launch calendar", 12], ["Holder leaderboard", 30], ["Partnerships", 7], ["Press and brand kit", 18], ["Terms of service", 4]];

const node = (id, pageId, i) => ({
  id, pageId, featureId: "prose", label: id, prompt: "", content: `words ${i}`, data: "", x: 40, y: 40 + i * 30, w: 300, h: 24,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const docOf = (list) => {
  const pages = list.map(([name], i) => ({ id: `p${i}`, name, path: i ? `/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "/", prompt: "", scroll: "inherit" }));
  const nodes = list.flatMap(([, n], i) => Array.from({ length: n }, (_, k) => node(`n${i}_${k}`, `p${i}`, k)));
  return JSON.stringify({ state: {
    pages, nodes, groups: [], shapes: [], format: {}, brief: { name: "SINK", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "p0", trail: [],
  }, version: 0 });
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

/** Open the Builder on a document at a width, and read the bar. */
async function bar(list, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, docOf(list));
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const read = await page.evaluate(() => {
    const b = document.querySelector("[data-studio-bar]");
    const strip = document.querySelector("[data-page-strip]");
    const box = (e) => e.getBoundingClientRect();
    /*
     * Anything on the bar whose WORDS are cut: a run of text whose own box
     * reaches past the box that clips it, or past the bar's edge. Measured
     * on the text itself, so a control with decoration wider than it (the
     * Finish construct) is not mistaken for one with its label cut.
     */
    const cut = [];
    if (b) {
      const edge = box(b).right;
      const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const words = t.textContent.trim();
        if (!words) continue;
        const range = document.createRange();
        range.selectNodeContents(t);
        const r = range.getBoundingClientRect();
        if (!r.width) continue;
        let clip = null;
        for (let p = t.parentElement; p && p !== b.parentElement; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== "visible") { clip = p; break; }
        }
        const c = clip ? box(clip) : null;
        if (c && (r.right > c.right + 1 || r.left < c.left - 1)) cut.push(`${words.slice(0, 24)} (${Math.round(Math.min(c.right, edge) - r.left)} of ${Math.round(r.width)}px shown)`);
        else if (r.right > edge + 1) cut.push(`${words.slice(0, 24)} (past the bar's edge by ${Math.round(r.right - edge)})`);
      }
    }
    const current = document.querySelector("[data-page-current]");
    return {
      barW: b ? Math.round(box(b).width) : 0,
      barScrolls: b ? b.scrollWidth > b.clientWidth + 1 : null,
      stripW: strip ? Math.round(box(strip).width) : 0,
      stripScrolls: strip ? [...strip.querySelectorAll("*")].some((e) => e.scrollWidth > e.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(e).overflowX)) : null,
      cut: [...new Set(cut)],
      current: current ? (current.textContent || "").replace(/\s+/g, "") : null,
    };
  });
  return { context, page, read };
}

/** Every page entry the bar offers, opening the page control first when there is one. */
async function entries(page) {
  const trigger = page.locator("[data-page-current]");
  if (await trigger.count()) { await trigger.first().click(); await page.waitForTimeout(400); }
  return page.evaluate(() => [...document.querySelectorAll("[data-studio-bar] [data-ctx='studio-page'], [data-page-menu] [data-ctx='studio-page']")].map((e) => {
    /* Read in full only if nothing inside it is cut and it is not scrolled out of its own container. */
    const cut = [...e.querySelectorAll("*"), e].some((k) => k.scrollWidth > k.clientWidth + 1 && getComputedStyle(k).overflow === "hidden");
    const r = e.getBoundingClientRect();
    let hidden = false;
    for (let p = e.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/auto|scroll|hidden/.test(s.overflowX + s.overflowY)) {
        const q = p.getBoundingClientRect();
        if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) { hidden = true; break; }
      }
    }
    return { id: e.getAttribute("data-ctx-id"), text: (e.textContent || "").replace(/\s+/g, ""), cut, hidden };
  }));
}

const counts = async (page) => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  return Object.fromEntries((s.pages ?? []).map((p) => [p.id, { name: p.name, n: (s.nodes ?? []).filter((x) => x.pageId === p.id).length }]));
});

/* ------------------------------------------------------------------ */
/* 1. The room the pages take, at his width, nine pages against fourteen */
/* ------------------------------------------------------------------ */

const WIDE = 1753;
const nine = await bar(SINK, WIDE);
const fourteen = await bar([...SINK, ...MORE], WIDE);
console.log(`  at ${WIDE}: pages take ${nine.read.stripW}px with nine, ${fourteen.read.stripW}px with fourteen (bar ${nine.read.barW})`);
check("at his width the pages take no more room with fourteen than with nine",
  fourteen.read.stripW <= nine.read.stripW + 1, `${nine.read.stripW} → ${fourteen.read.stripW}`);
check("…and no more than a tenth of the bar", nine.read.stripW <= nine.read.barW / 10, `${nine.read.stripW} of ${nine.read.barW}`);
check("the page list never hides pages behind a scroll on the bar", nine.read.stripScrolls === false && fourteen.read.stripScrolls === false,
  `${nine.read.stripScrolls} / ${fourteen.read.stripScrolls}`);
check(`nothing on the bar is cut at ${WIDE}, nine pages`, nine.read.cut.length === 0, nine.read.cut.slice(0, 4).join("; "));
check(`nothing on the bar is cut at ${WIDE}, fourteen pages`, fourteen.read.cut.length === 0, fourteen.read.cut.slice(0, 4).join("; "));

/* ------------------------------------------------------------------ */
/* 2. What the control says without being opened                       */
/* ------------------------------------------------------------------ */

const have = await counts(nine.page);
check("the page you are on is on the bar without opening anything, with its part count",
  nine.read.current === `${have.p0.name}${have.p0.n}`.replace(/\s+/g, ""), JSON.stringify(nine.read.current));

/* ------------------------------------------------------------------ */
/* 3. Every page, in full, with its count read off the board            */
/* ------------------------------------------------------------------ */

for (const [label, run] of [["nine", nine], ["fourteen", fourteen]]) {
  const want = await counts(run.page);
  const got = await entries(run.page);
  const wrong = Object.entries(want).filter(([id, w]) => {
    /* One readable entry per page is enough: the control on the bar may name the current page a second time. */
    const all = got.filter((g) => g.id === id);
    return !all.some((e) => !e.cut && !e.hidden && e.text === `${w.name}${w.n}`.replace(/\s+/g, ""));
  });
  check(`${label} pages: every one listed, its name and count in full`, wrong.length === 0 && new Set(got.map((g) => g.id)).size === Object.keys(want).length,
    wrong.slice(0, 3).map(([id, w]) => { const e = got.find((g) => g.id === id); return `${w.name} ${w.n} → ${e ? `${JSON.stringify(e.text)}${e.cut ? " cut" : ""}${e.hidden ? " scrolled away" : ""}` : "missing"}`; }).join("; "));
}

/* ------------------------------------------------------------------ */
/* 4. What a page entry does is what a tab did                          */
/* ------------------------------------------------------------------ */

{
  const { page } = fourteen;
  const target = page.locator("[data-studio-bar] [data-ctx='studio-page'][data-ctx-id='p12'], [data-page-menu] [data-ctx='studio-page'][data-ctx-id='p12']").first();
  if (!(await target.isVisible().catch(() => false))) await entries(page);
  await target.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const active = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.activePageId);
  check("choosing a page opens it", active === "p12", String(active));
  const now = await page.evaluate(() => (document.querySelector("[data-page-current]")?.textContent || "").replace(/\s+/g, ""));
  const want = await counts(page);
  check("…and the bar then shows that page", now === `${want.p12.name}${want.p12.n}`.replace(/\s+/g, ""), JSON.stringify(now));

  await entries(page);
  const again = page.locator("[data-page-menu] [data-ctx='studio-page'][data-ctx-id='p3'], [data-studio-bar] [data-ctx='studio-page'][data-ctx-id='p3']").first();
  await again.click({ button: "right", timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const menu = await page.getByText(`${want.p3.name} · /nfts`, { exact: true }).count();
  check("a page still has its right-click menu", menu >= 1, `${menu}`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  const before = Object.keys(await counts(page)).length;
  await page.locator("[data-page-strip]").getByRole("button", { name: "Add page" }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const after = Object.keys(await counts(page)).length;
  check("Add page is on the same control and still adds a page", after === before + 1, `${before} → ${after}`);
}
await nine.context.close();
await fourteen.context.close();

/* ------------------------------------------------------------------ */
/* 5. Narrower windows: the pages cost the rest of the bar nothing     */
/* ------------------------------------------------------------------ */

/*
 * Below 1280 the bar is tight for reasons that have nothing to do with the
 * pages: with ONE page the site's name is already cut at 1024 and at 800
 * (measured when this was written: 28 and 21 of its 32px). That is the bar's
 * own crowding and is not this check's business. What this check holds is
 * that adding pages costs the rest of the bar nothing: at every width,
 * fourteen pages cut no word that one page does not already cut, and take
 * no more room than nine. On the strip this replaced, fourteen pages cut
 * page after page and the tools beside them.
 */
const words = (cut) => new Set(cut.map((c) => c.replace(/ \(.*$/, "")));
for (const w of [1440, 1280, 1024, 800]) {
  const one = await bar([["Home", 5]], w);
  const nineW = await bar(SINK, w);
  const many = await bar([...SINK, ...MORE], w);
  const extra = [...words(many.read.cut)].filter((t) => !words(one.read.cut).has(t));
  console.log(`  at ${w}: pages take ${nineW.read.stripW}px with nine, ${many.read.stripW}px with fourteen, of ${many.read.barW}; cut with one page: ${one.read.cut.join("; ") || "nothing"}`);
  check(`at ${w} fourteen pages cut nothing on the bar that one page does not`, extra.length === 0, extra.slice(0, 4).join("; "));
  check(`at ${w} the pages take no more room with fourteen than with nine`, many.read.stripW <= nineW.read.stripW + 1, `${nineW.read.stripW} → ${many.read.stripW}`);
  for (const r of [one, nineW, many]) await r.context.close();
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
