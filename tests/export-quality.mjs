#!/usr/bin/env node
/**
 * CLEAN CODE A REVIEWER WOULD PASS (create-system "(d) Export", export-quality;
 * J 2026-10-24: "clean code ... he or a code chat will keep working on").
 *
 * The clean export read as a senior frontend reviewer reads a pull request.
 * The ruling, on every page and section it writes:
 *
 *   1. headings: each page has exactly one <h1>, the first heading on it;
 *      every heading the board knows (a part labelled "heading") is an
 *      <h1>…<h6>, not a <p>; no level is skipped on the way down;
 *   2. landmarks: a section component's root is a <header>, <footer>, <nav>
 *      or <section>, never a <div>;
 *   3. no class that Tailwind would not write: no `rounded-0`, no
 *      `bg-[transparent]`, no `[place-items:center]`, no `inherit` on a
 *      property the words inherit anyway, no system font stack spelled out
 *      where `font-sans` says it, no machinery class of the published page
 *      (`link-fills-part`);
 *   4. a row centred by equal padding either side says `justify-center`,
 *      not hundreds of pixels of padding (so it still centres when narrow);
 *   5. names a reader hears: no icon labelled "icon · 2 strokes"; a link
 *      laid over a part is named by the part's words where the board has them;
 *   6. the library: a variant key that is a plain word is not quoted, and a
 *      component with nothing shared between variants has no empty `base`;
 *   7. POLIO.md tells the next person where things are: the sections, the
 *      ids, the headings, and that there are no breakpoints yet.
 *
 * Pure: no server, no browser. The 2px ruling at the board's width is
 * tests/pages-out.mjs, run on the same dumps.
 *
 *   PAGES_DUMP=<folder with board.json and site/>[,<folder>] node tests/export-quality.mjs
 *
 * Run on sol face, mochi and two repo fixtures (export-scratch dumps of
 * thesolface3, mochi3, share-xyz, gotchi-gg).
 *
 * Covers: src/features/studio/send-out/pagesOut.ts, src/features/studio/send-out/tailwindOf.ts, src/features/studio/send-out/libraryOut.ts, src/features/studio/send-out/exportSync.ts
 */
import { cleanExport, dumpedSite } from "./lib/export-input.mjs";
import { systemMd, TOKEN_FILES } from "../src/features/studio/send-out/index.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const dumps = (process.env.PAGES_DUMP ?? "").split(",").filter(Boolean);
if (!dumps.length) { console.error("PAGES_DUMP=<folder>[,<folder>] names the dumped sites (board.json + site/)."); process.exit(2); }

for (const d of dumps) {
  const site = dumpedSite(d);
  console.log(`\n${site.name}`);
  const { system, out, files, lib, board } = cleanExport(site, { library: true, gallery: true });
  const code = out.files.filter((f) => f.path.endsWith(".tsx"));
  const file = (p) => files.find((f) => f.path === p)?.content ?? "";
  const sectionOf = (name) => file(`components/sections/${name}.tsx`);

  /* 1. Headings, page by page: the page file with the sections it draws, in order. */
  const pages = code.filter((f) => /^app\/(.*\/)?page\.tsx$/.test(f.path) && !f.path.startsWith("app/gallery/"));
  const bad = [];
  let headings = 0;
  for (const p of pages) {
    const seq = [];
    const walk = (src) => {
      for (const m of src.matchAll(/<(h([1-6])|[A-Z]\w*)(?=[\s/>])/g)) {
        if (m[2]) seq.push(Number(m[2]));
        else if (p.content.includes(`import ${m[1]} from "@/components/sections/${m[1]}"`)) walk(sectionOf(m[1]));
      }
    };
    walk(p.content);
    headings += seq.length;
    if (seq.filter((l) => l === 1).length !== 1) bad.push(`${p.path}: ${seq.filter((l) => l === 1).length} h1`);
    if (seq.length && seq[0] !== 1) bad.push(`${p.path}: first heading is h${seq[0]}`);
    for (let i = 1; i < seq.length; i++) if (seq[i] > seq[i - 1] + 1) { bad.push(`${p.path}: h${seq[i - 1]} then h${seq[i]}`); break; }
  }
  /* A heading that is a holder of word parts ("heading “THE SOL FACE” · 2 inside") has no words of its own: its parts are the words, so it stays a box. */
  const known = board.nodes.filter((n) => /^heading\b/i.test(n.label ?? "") && !/·\s*\d+ inside/.test(n.label) && typeof n.content === "string" && n.content.trim() &&!out.trees.some((t) => t.states.includes(n.id)) && !out.report.missing.includes(n.id) && out.trees.some((t) => t.pageId === n.pageId)).length;
  check("one <h1> per page, the first heading, and no level skipped", !bad.length, bad.slice(0, 3).join("; ") || `${headings} headings on ${pages.length} pages`);
  check("every heading with words of its own is a heading element", headings >= known && headings > 0, `${headings} written, ${known} on the board`);

  /* 2. Landmarks. */
  const roots = code.filter((f) => f.path.startsWith("components/sections/")).map((f) => ({ path: f.path, tag: /return \(\n\s*<([a-zA-Z0-9]+)/.exec(f.content)?.[1] ?? "?" }));
  const divs = roots.filter((r) => !["header", "footer", "nav", "section"].includes(r.tag));
  check("a section's root is a header, footer, nav or section", !divs.length, divs.slice(0, 3).map((r) => `${r.path} <${r.tag}>`).join(", ") || `${roots.filter((r) => r.tag === "header").length} header, ${roots.filter((r) => r.tag === "footer").length} footer, ${roots.filter((r) => r.tag === "section").length} section`);

  /* 3. Classes. */
  const all = code.map((f) => f.content).join("\n");
  const classes = [...all.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  const noise = [
    ["rounded-0", (c) => c === "rounded-0"],
    ["bg-[transparent]", (c) => /^(bg|text)-\[(transparent|rgba\(0,_0,_0,_0\))\]$/.test(c)],
    ["[place-items:…]", (c) => c.startsWith("[place-items:")],
    ["…inherit", (c) => /(:|-\[)inherit\]$/.test(c)],
    ["font-[ui-sans-serif…]", (c) => /^font-\[ui-(sans-serif|monospace)/.test(c)],
    ["link-fills-part / site-root", (c) => /^(link-fills-part|site-root)/.test(c)],
  ].map(([what, is]) => [what, classes.filter(is).length]).filter(([, n]) => n);
  check("no class Tailwind would not write, no machinery class of the published page", !noise.length, noise.map(([w, n]) => `${n} ${w}`).join(", ") || `${new Set(classes).size} distinct classes`);
  check("the System's fonts, colours and spaces are said by name", classes.some((c) => /^font-[a-z]/.test(c) && !c.startsWith("font-[")) && classes.filter((c) => /^(p[xytrbl]?|gap(-[xy])?)-space-/.test(c)).length > 20, `${classes.filter((c) => /-space-/.test(c)).length} space classes`);

  /* 4. Centred rows. */
  const wide = classes.filter((c) => /^px-\[\d{3,}(\.\d+)?px\]$/.test(c));
  check("a centred row says justify-center, not hundreds of pixels of padding", !wide.length, wide.slice(0, 3).join(", ") || `${(all.match(/\bjustify-center\b/g) ?? []).length} justify-center`);

  /* 5. Names. */
  const iconLabels = (all.match(/aria-label="icon[^"]*"/g) ?? []).length;
  check("no icon is labelled by its stroke count; icons are decorative", !iconLabels, `${iconLabels} stroke labels, ${(all.match(/aria-hidden="true"/g) ?? []).length} decorative`);
  const overlays = [...all.matchAll(/<a href="[^"]*"(?: target="_blank" rel="noopener")? aria-label="([^"]*)" className="absolute inset-0/g)].map((m) => m[1]);
  check("a link laid over a part is named by the part's words where it has them", overlays.every((n) => n.length > 0), `${overlays.length} overlays, ${overlays.filter((n) => n !== "Open").length} named by the board`);

  /* 6. The library. */
  const ui = lib.files.filter((f) => f.path.endsWith(".tsx"));
  const quoted = ui.flatMap((f) => [...f.content.matchAll(/^  "([a-z][a-z0-9]*)":/gm)].map((m) => `${f.path} ${m[1]}`));
  const emptyBase = ui.filter((f) => /const base = "";/.test(f.content)).map((f) => f.path);
  check("a plain variant key is not quoted, and no component carries an empty base", !quoted.length && !emptyBase.length, [...quoted, ...emptyBase].slice(0, 3).join(", ") || `${ui.length} components`);

  /* 7. POLIO.md. */
  const md = systemMd({ mode: "clean", tokens: 0, components: system.components.map((c) => ({ name: lib.names.get(c.id).name, variants: c.variants.length })), tokenFiles: Object.values(TOKEN_FILES) });
  const says = ["components/sections/", "app/layout.tsx", "board id", "<h1>", "no breakpoints yet", "components/ui/"];
  const silent = says.filter((s) => !md.includes(s));
  check("POLIO.md tells the next person where things are and how to read a page", !silent.length, silent.join(", ") || `${md.split("\n").length} lines`);
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
