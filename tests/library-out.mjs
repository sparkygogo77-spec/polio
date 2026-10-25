#!/usr/bin/env node
/**
 * THE COMPONENT LIBRARY (create-system "(d) Export", library-out).
 *
 * Each System component is written as one React file in components/ui
 * (`send-out/libraryOut.ts`), and the clean pages draw the parts linked to a
 * component as it (`<Button variant="main">`). The ruling:
 *
 *   1. the files: one per component, an index exporting them all; a
 *      `variant` prop with one value per variant; each variant's look made
 *      from its tokens by name; hover and pressed as real CSS states where
 *      the page did something under the hand; focus and disabled on every
 *      pressable one;
 *   2. `next build` passes, with the gallery page and the clean pages;
 *   3. served: the gallery draws every variant of every component; hovering
 *      a variant that lifts moves it; pressing Tab reaches a pressable one
 *      and draws its focus ring; a disabled one is dimmed;
 *   4. the clean pages draw the linked parts as library components, and
 *      still land within 2px of the board at 1440.
 *
 *   npx next start -p 3091
 *   node tests/library-out.mjs http://127.0.0.1:3091 <capture folder> [...]
 *   PAGES_DUMP=<folder with board.json and site/> node tests/library-out.mjs
 *
 * Covers: src/features/studio/send-out/libraryOut.ts, src/features/studio/send-out/pagesOut.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { buildApp, serveApp } from "./lib/export-app.mjs";
import { cleanExport, dumpedSite, importedSite } from "./lib/export-input.mjs";
import { tokenNames } from "../src/features/studio/send-out/index.ts";

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
let port = Number(process.env.PAGES_PORT ?? 3093);

for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);
  const { system, lib, out, files, board } = cleanExport(site, { library: true, gallery: true });
  const names = tokenNames(system);
  const file = (p) => files.find((f) => f.path === p)?.content ?? "";

  /* 1. The files. */
  const comps = system.components;
  check("one file per System component, and an index exporting each", comps.length > 0 && comps.every((c) => file(lib.names.get(c.id).file).includes(`export function ${lib.names.get(c.id).name}(`)) && comps.every((c) => file("components/ui/index.ts").includes(`export { ${lib.names.get(c.id).name},`)), `${comps.length} components: ${comps.map((c) => lib.names.get(c.id).name).join(", ")}`);
  check("each file says it is Polio's", lib.files.every((f) => f.content.includes("Made by Polio.")));
  const missingVariant = comps.flatMap((c) => c.variants.filter((v) => !file(lib.names.get(c.id).file).includes(`${JSON.stringify(lib.names.get(c.id).variants.get(v.id))}:`)).map((v) => `${c.name}/${v.name}`));
  check("a variant prop value for every variant", !missingVariant.length, missingVariant.slice(0, 4).join(", "));
  const tokenRefs = comps.flatMap((c) => c.variants.flatMap((v) => Object.entries(v.look).filter(([, r]) => "token" in r).map(([slot, r]) => ({ c, slot, tw: names.get(r.token)?.tw }))));
  const unnamed = tokenRefs.filter(({ c, tw }) => tw && !file(lib.names.get(c.id).file).includes(`-${tw}`));
  check("each variant's look is its tokens by name", tokenRefs.length > 0 && !unnamed.length, `${tokenRefs.length} token refs; not named: ${unnamed.slice(0, 3).map((u) => `${u.c.name}.${u.slot}`).join(", ")}`);
  const moving = comps.flatMap((c) => c.variants.filter((v) => v.states.hover || v.states.pressed).map((v) => ({ c, v })));
  const noState = moving.filter(({ c, v }) => { const line = file(lib.names.get(c.id).file).split("\n").find((l) => l.includes(`${JSON.stringify(lib.names.get(c.id).variants.get(v.id))}:`)) ?? ""; return (v.states.hover && !line.includes("hover:")) || (v.states.pressed && !line.includes("active:")); });
  check("hover and pressed are real CSS states where the page moved under the hand", !noState.length, `${moving.length} variants move; without a state: ${noState.slice(0, 3).map(({ c, v }) => `${c.name}/${v.name}`).join(", ")}`);
  const pressables = comps.filter((c) => ["button", "tab", "copy-bar"].includes(c.kind));
  check("every pressable component has focus and disabled states", pressables.every((c) => /focus-visible:outline/.test(file(lib.names.get(c.id).file)) && /disabled:opacity/.test(file(lib.names.get(c.id).file))), pressables.map((c) => c.name).join(", ") || "none");
  console.log(`       ${out.report.instances} parts on the pages drawn as library components`);
  check("the clean pages draw linked parts as library components", out.report.instances > 0 && out.files.some((f) => f.content.includes('from "@/components/ui"')), `${out.report.instances}`);

  /* 2. next build. */
  const app = await buildApp(`library-${site.name}`, files);
  check("next build passes", app.ok, app.ok ? "" : app.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 8).join(" / "));
  if (!app.ok) continue;
  const srv = await serveApp(app.dir, port++);

  /* 3. The gallery, and the states. */
  const g = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await g.goto(`${srv.url}/gallery`, { waitUntil: "load" });
  const sections = await g.locator("main > section").count();
  const variants = comps.reduce((n, c) => n + c.variants.length, 0) + pressables.length;
  const drawn = await g.locator("main > section > div > *").count();
  check("the gallery draws every variant of every component (and a disabled one of each pressable)", sections === comps.length && drawn === variants, `${sections} sections, ${drawn} of ${variants}`);
  const lifter = moving.find(({ v }) => v.states.hover && (v.states.hover.dy || v.states.hover.dx || (v.states.hover.scale && v.states.hover.scale !== 1)));
  if (lifter) {
    const label = `${lifter.c.name} · ${lib.names.get(lifter.c.id).variants.get(lifter.v.id)}`;
    const target = g.getByText(label, { exact: true }).first();
    const before = await target.boundingBox();
    await target.hover();
    await g.waitForTimeout(900);
    const after = await target.boundingBox();
    const moved = before && after && (Math.abs(after.y - before.y) > 0.4 || Math.abs(after.x - before.x) > 0.4 || Math.abs(after.width - before.width) > 0.4);
    check("hovering a variant that lifts moves it, as the page did", !!moved, `${label}: ${JSON.stringify(lifter.v.states.hover)} → moved ${before && after ? `${r1(after.x - before.x)},${r1(after.y - before.y)}` : "?"}`);
  } else console.log("       (no variant moves under the hand on this site)");
  if (pressables.length) {
    await g.mouse.move(0, 0);
    await g.keyboard.press("Tab");
    const ring = await g.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle, width: s.outlineWidth }; });
    check("Tab reaches a pressable component and draws its focus ring", !!ring && ring.outline !== "none" && parseFloat(ring.width) >= 2, JSON.stringify(ring));
    const dim = await g.evaluate(() => { const e = document.querySelector("main button:disabled"); return e ? Number(getComputedStyle(e).opacity) : null; });
    check("a disabled one is dimmed", dim !== null && dim < 0.75, `opacity ${dim}`);
  }
  await g.close();

  /* 4. The pages still stand where the board does. */
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(srv.url, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const tree = out.trees[0];
  const states = new Set(tree.states);
  const parts = board.nodes.filter((n) => n.pageId === tree.pageId && !states.has(n.id) && !out.report.missing.includes(n.id));
  const got = await page.evaluate((ids) => { for (const e of document.querySelectorAll("*")) for (const p of ["transform", "translate", "rotate", "scale", "animation", "transition"]) e.style.setProperty(p, "none", "important"); return Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); if (!e) return [id, null]; const r = e.getBoundingClientRect(); return [id, [r.x + scrollX, r.y + scrollY, r.width, r.height]]; })); }, parts.map((n) => n.id));
  const errs = parts.map((n) => { const v = got[n.id]; return { id: n.id, e: v ? Math.max(Math.abs(v[0] - n.x), Math.abs(v[1] - n.y), Math.abs(v[2] - Math.max(0, n.w)), Math.abs(v[3] - Math.max(0, n.h))) : Infinity }; });
  const within = errs.filter((e) => e.e <= 2).length / Math.max(1, errs.length);
  const bad = errs.filter((e) => e.e > 2).sort((a, b) => b.e - a.e);
  console.log(`       within 2px with the library: ${r1(within * 100)}%; worst ${bad.slice(0, 6).map((b) => `${b.id} ${Number.isFinite(b.e) ? r1(b.e) : "absent"}`).join(", ")}`);
  check(`with library components, at least ${FLOOR * 100}% of parts still land within 2px of the board`, within >= FLOOR, `${r1(within * 100)}%`);
  await page.close();
  srv.stop();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
