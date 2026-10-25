#!/usr/bin/env node
/**
 * CLEAN PAGES: THE BOARD AS NEXT.JS + TAILWIND A PERSON CAN EDIT (create-system
 * "(d) Export", pages-out; J 2026-10-24: "clean code ... he or a code chat
 * will keep working on").
 *
 * A captured site brought into the Builder is written as clean pages
 * (`send-out/pagesOut.ts`): layout from the layout tree as flex and grid,
 * each section a component, every style a Tailwind class, tokens by name.
 * The ruling:
 *
 *   1. the files: a page per page and a component per section, carrying
 *      Polio's header; no inline style anywhere; no absolute position except
 *      on the parts the reader could not group; token classes in use;
 *   2. `next build` passes;
 *   3. served and drawn at 1440, the share of parts within 2px of their board
 *      box (printed, and held to a floor), and the count still placed by
 *      hand, each listed in the POLIO.md section with its reason. Boxes are
 *      layout boxes, as the board's are: a part's own translate, turn or
 *      animation is set aside while measuring (the exact-look test measures
 *      pixels with them).
 *
 *   npx next start -p 3091
 *   node tests/pages-out.mjs http://127.0.0.1:3091 <capture folder> [...]
 *   PAGES_DUMP=<folder with board.json and site/> node tests/pages-out.mjs
 *
 * Run on sol face, mochi and sunkcoin (capture/sites/thesolface3, mochi3, sunk2).
 *
 * Covers: src/features/studio/send-out/pagesOut.ts, src/features/studio/send-out/tailwindOf.ts
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { JSDOM } from "jsdom";
import { pagesOut, stillPlacedMd, tokensOut } from "../src/features/studio/send-out/index.ts";
import { homeFor } from "../src/features/studio/homePage.ts";
import { buildApp, serveApp } from "./lib/export-app.mjs";
import { dumpedSite, importedSite, systemOf } from "./lib/export-input.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const r1 = (v) => Math.round(v * 10) / 10;
const FLOOR = Number(process.env.PAGES_FLOOR ?? 0.95);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const [BASE, ...captures] = process.argv.slice(2);
const sources = process.env.PAGES_DUMP ? process.env.PAGES_DUMP.split(",").map((d) => () => dumpedSite(d)) : captures.map((c) => () => importedSite(browser, BASE, c));
let port = Number(process.env.PAGES_PORT ?? 3092);

/** The clean export of a site brought in: its files, its report, and the board it came from. */
export function cleanExport(site) {
  const { board } = site;
  const { system, palette } = systemOf(board, site.name);
  const pages = board.pages?.length ? board.pages : [{ id: board.nodes[0].pageId, name: "Home", path: "/" }];
  const home = homeFor(pages);
  const byPath = new Map(site.files.map((f) => [f.path, f]));
  const published = new Map();
  for (const p of pages) {
    const f = byPath.get(home.file(p));
    if (f) published.set(p.id, new JSDOM(f.bytes.toString("utf8")).window.document);
  }
  const out = pagesOut({
    name: site.name, pages, nodes: board.nodes, frameWidth: board.frameWidth ?? 1440, system, palette, published,
    siteCss: byPath.get("assets/site.css")?.bytes.toString("utf8") ?? "",
  });
  const assets = site.files.filter((f) => f.path.startsWith("assets/") && !/\.(css|js)$/.test(f.path)).map((f) => ({ path: `public/${f.path}`, content: f.bytes }));
  return { system, out, files: [...tokensOut(system), ...out.files, ...assets], board };
}

for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);
  const { out, files, board } = cleanExport(site);
  const { report } = out;
  const code = out.files.filter((f) => f.path.endsWith(".tsx"));

  /* 1. The files. */
  check("a page per page and a component per section", code.some((f) => f.path === "app/page.tsx") && report.sections > 0 && code.filter((f) => f.path.startsWith("components/sections/")).length === report.sections, `${report.pages} pages, ${report.sections} sections`);
  check("every page and section says it is Polio's", code.every((f) => f.content.startsWith("/* Made by Polio.")));
  const inline = code.filter((f) => /\sstyle=\{/.test(f.content)).map((f) => f.path);
  check("no inline style anywhere", !inline.length, inline.slice(0, 3).join(", "));
  const placedIds = new Set(report.placed.map((p) => p.id));
  const all = code.map((f) => f.content).join("\n");
  const absolute = [...all.matchAll(/<div id="([^"]+)" className="([^"]*)"/g)].filter(([, id, c]) => /(^|\s)(absolute|fixed)(\s|$)/.test(c) && !placedIds.has(id)).map(([, id]) => id);
  check("nothing in the flow is absolutely placed", !absolute.length, absolute.slice(0, 5).join(", "));
  const tokenClasses = [...all.matchAll(/\b(?:bg|text|font|rounded|shadow|p[trblxy]?|gap(?:-[xy])?)-(?:space-)?[a-z][\w-]*/g)].length;
  check("the System's tokens are used by name", tokenClasses > 20, `${tokenClasses} token classes`);
  const flex = (all.match(/\bflex\b/g) ?? []).length, grid = (all.match(/\bgrid\b/g) ?? []).length;
  console.log(`       ${report.parts} parts, ${report.grouped} in flow, ${report.placed.length} still placed by hand, ${report.states.length} shown only on a press, ${report.missing.length} the published page did not draw; ${flex} flex and ${grid} grid holders; ${(all.match(/\n/g) ?? []).length} lines of TSX`);

  /* 2. next build. */
  const app = await buildApp(`pages-${site.name}`, files);
  check("next build passes", app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 8).join(" / "));
  if (!app.ok) continue;

  /* 3. Drawn at 1440, against the board. */
  const srv = await serveApp(app.dir, port++);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(srv.url, { waitUntil: "load" });
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 800) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(40); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const tree = out.trees[0];
  const states = new Set(tree.states);
  const parts = board.nodes.filter((n) => n.pageId === tree.pageId && !states.has(n.id) && !report.missing.includes(n.id));
  /* The board's boxes are layout boxes: a part's own translate, turn or animation is drawn over them (boxes-hug), so it is set aside while measuring. */
  const got = await page.evaluate((ids) => { for (const e of document.querySelectorAll("*")) for (const p of ["transform", "translate", "rotate", "scale", "animation"]) e.style.setProperty(p, "none", "important"); return Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); if (!e) return [id, null]; const r = e.getBoundingClientRect(); return [id, [r.x + scrollX, r.y + scrollY, r.width, r.height]]; })); }, parts.map((n) => n.id));
  const errs = parts.map((n) => { const g = got[n.id]; return { id: n.id, placed: placedIds.has(n.id), e: g ? Math.max(Math.abs(g[0] - n.x), Math.abs(g[1] - n.y), Math.abs(g[2] - Math.max(0, n.w)), Math.abs(g[3] - Math.max(0, n.h))) : Infinity }; });
  const within = errs.filter((e) => e.e <= 2).length / Math.max(1, errs.length);
  const bad = errs.filter((e) => e.e > 2).sort((a, b) => b.e - a.e);
  console.log(`       within 2px: ${r1(within * 100)}% of ${errs.length} parts drawn; worst ${bad.slice(0, 8).map((b) => `${b.id}${b.placed ? " (placed)" : ""} ${Number.isFinite(b.e) ? r1(b.e) : "absent"}`).join(", ")}`);
  check(`at 1440, at least ${FLOOR * 100}% of parts land within 2px of the board`, within >= FLOOR, `${r1(within * 100)}%`);
  const md = stillPlacedMd(report);
  check("POLIO.md lists every part still placed by hand, with its reason", report.placed.every((p) => md.includes(`\`${p.id}\``)) && md.includes(`${report.placed.length} are still placed by hand`), `${report.placed.length} placed`);
  await page.close();
  srv.stop();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
