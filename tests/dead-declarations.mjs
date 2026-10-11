/**
 * Declarations left behind are gone, and none is left behind again.
 *
 * Rows E1–E5, E7 and E8 of the inventory named what nothing reads: two
 * keyframes and their tokens, five custom properties, three modules with no
 * importer, six store actions with no caller, seventeen exports mentioned
 * once in the whole tree (their own definition), a type package under
 * `dependencies`, and 36 screenshots nothing links to. Each is held gone by
 * name here, and the last check is the general one: no export in `src`
 * may have exactly one mention across src, tests and scripts.
 *
 *   node tests/dead-declarations.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

/* E7. A type package is a development dependency. */
const pkg = JSON.parse(read("package.json"));
const typesInDeps = Object.keys(pkg.dependencies ?? {}).filter((k) => k.startsWith("@types/"));
check("no @types/* package sits under dependencies", typesInDeps.length === 0, typesInDeps.join(", ") || `${Object.keys(pkg.dependencies).length} dependencies, 0 of them types`);

/* E3. Three modules nothing imported. */
for (const f of ["src/core/lib/storage.ts", "src/core/audio/index.ts", "src/core/context-menu/index.ts"]) {
  check(`${f} is gone`, !existsSync(f));
}

/* E5. Store actions with no caller, and the state only they wrote. */
const store = read("src/features/studio/board/store.ts");
for (const n of ["moveNodes", "setPageScroll", "resetView", "noteCost", "clearTrail", "pageScroll"]) {
  const hits = (store.match(new RegExp(`\\b${n}\\b`, "g")) ?? []).length;
  check(`the studio store no longer declares ${n}`, hits === 0, `${hits} mentions`);
}
const tour = read("src/features/tour/store.ts");
check("the tour store no longer counts a staging nobody reads", !/\bstaged\b|\bstaging\b/.test(tour));

/* E1, E2. Dead CSS: keyframes, animation tokens, custom properties. */
const css = read("src/app/globals.css");
for (const n of ["@keyframes row-in", "@keyframes slide-in-left", "--animate-row-in", "--animate-slide-in-left", "--animate-slide-up", "--flash-ms", "--row-h", "--cell-x", "--color-glass"]) {
  check(`globals.css no longer carries ${n}`, !css.includes(n));
}
check("the theme provider no longer writes a --flash-ms nothing reads", !read("src/core/theme/ThemeProvider.tsx").includes("--flash-ms"));
check("@keyframes slide-up stays, it is used by name", css.includes("@keyframes slide-up"));

/* E4. Seventeen exports with one mention in the tree: their own line. */
const GONE = [
  ["src/core/lib/format.ts", ["lerp", "fmtPct", "fmtNumber", "fmtTime", "fmtShortAddress"]],
  ["src/features/studio/RingConsole.tsx", ["phosphorAt"]],
  ["src/features/studio/bodyRun.ts", ["targetMask"]],
  ["src/features/studio/shelf/catalog.ts", ["CATEGORY_EMOJI"]],
  ["src/features/studio/format.ts", ["FORMAT_BY_ID", "changedFormat"]],
  ["src/features/studio/look/index.ts", ["affects"]],
  ["src/features/studio/nebulaTile.ts", ["RIMS"]],
  ["src/features/studio/refineRun.ts", ["houseExample", "forgetExample"]],
  ["src/features/studio/pictures/sketch.ts", ["emptySketch"]],
  ["src/features/studio/board/store.ts", ["FrameKind"]],
  ["src/features/tour/store.ts", ["tourRunning"]],
];
for (const [f, names] of GONE) {
  const src = read(f);
  const left = names.filter((n) => new RegExp(`export (?:async )?(?:function|const|type|interface|class) ${n}\\b`).test(src));
  check(`${f} no longer exports ${names.join(", ")}`, left.length === 0, left.length ? `still exports ${left.join(", ")}` : "");
}

/* E8. Every screenshot under docs/shots is linked from a doc — or is one of
   the thirteen another session made for its own report, named here with
   whose it is rather than deleted from under them. */
const THEIRS = {
  "recreate session (011dxs3jh1JLZT6UEd7hCDPr)": ["create-flow-forming.png", "create-flow-made.png", "create-flow-prompted.png", "create-flow-resized.png", "space-aura.png", "space-closed-says.png", "space-drawn-opens.png"],
  "site-live session (01L6DBVypJiUSy9zZupM6gyz)": ["site-live-bar.png", "site-live-landed.png", "site-live-offered.png", "site-live-page.png", "site-live-part.png", "site-live-resized.png"],
};
const flagged = new Set(Object.values(THEIRS).flat());
const docs = ["docs", "README.md", "AGENTS.md"].flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".md") && f !== "INVENTORY.md").map((f) => join(p, f)) : [p])).map(read).join("\n");
const shots = existsSync("docs/shots") ? readdirSync("docs/shots").filter((f) => f.endsWith(".png")) : [];
const orphans = shots.filter((f) => !docs.includes(f) && !flagged.has(f));
check("every screenshot under docs/shots is linked from a doc, or is another session's, named", orphans.length === 0,
  orphans.length ? `${orphans.length} orphaned: ${orphans.slice(0, 5).join(", ")}${orphans.length > 5 ? ", …" : ""}` : `${shots.length} shots, ${shots.filter((f) => docs.includes(f)).length} linked, ${shots.filter((f) => flagged.has(f)).length} another session's`);

/* E9. No suite writes into the committed shots by itself.

   Running the floor should leave the tree clean. Two suites defaulted their
   output at `docs/shots`, so every session that ran them rewrote tracked PNGs
   as a side effect — byte-level render noise, not visual change — and a merge
   session had to discard four of them to avoid pushing noise over a
   deliberate refresh. A shot is a deliberate act: the default goes to the
   ignored scratch path, and the baseline is rewritten only by naming it. */
{
  const suites = readdirSync("tests").filter((f) => f.endsWith(".mjs"));
  const writers = suites.filter((f) => {
    const src = read(join("tests", f));
    /* The fault itself, and only it: the line that decides where a suite's
       shots go, defaulting to the tracked directory. Written narrowly on
       purpose — a first pass looked for the path anywhere in the file and
       flagged this suite, which only READS `docs/shots` to check the shots
       are linked from a doc. */
    return /^\s*const\s+SHOTS\s*=.*docs\/shots/m.test(src);
  });
  check("no suite rewrites the committed shots unless it is asked to", writers.length === 0,
    writers.length ? `${writers.length} write there by default: ${writers.join(", ")}` : `${suites.length} suites, all of them opt-in`);
}

/* The general rule. An export mentioned once in src + tests + scripts is
   mentioned only where it is declared: nothing imports it, nothing calls it,
   and nothing in the same file uses it either. */
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(f) && !p.endsWith("passes.generated.ts")) out.push(p);
  }
  return out;
};
const files = [...walk("src"), ...walk("tests").filter((p) => !p.endsWith("dead-declarations.mjs")), ...(existsSync("scripts") ? walk("scripts") : []), ...readdirSync(".").filter((f) => /\.(ts|mjs|js)$/.test(f))];
const corpus = files.map((p) => [p, readFileSync(p, "utf8")]);
const declared = [];
for (const [p, text] of corpus) {
  if (!p.startsWith("src/")) continue;
  for (const m of text.matchAll(/^export (?:async )?(?:function|const|let|type|interface|class|enum) ([A-Za-z_$][\w$]*)/gm)) declared.push([p, m[1]]);
}
const once = [];
for (const [p, name] of declared) {
  const re = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`, "g");
  let n = 0;
  for (const [, text] of corpus) { n += (text.match(re) ?? []).length; if (n > 1) break; }
  if (n === 1) once.push(`${p}:${name}`);
}
check("no export in src is mentioned only where it is declared", once.length === 0, once.length ? `${once.length}: ${once.slice(0, 8).join(", ")}${once.length > 8 ? ", …" : ""}` : `${declared.length} exports checked`);

/* A second site writer. `staticSite()` wrote pages and a stylesheet of its
   own, nothing called it, and it had drifted from the writer Publish and Go
   live use (send-out/exportSite.ts): a fix made there reached no site. Its
   three private helpers went with it. Mentioned in comments, it got past the
   one-mention rule below, so it is held gone by name. */
{
  const f = "src/features/studio/staticSite.ts";
  const src = read(f);
  const left = [/export function staticSite\b/, /function styles\(/, /function rootAttrs\(/, /const esc\b/].filter((re) => re.test(src));
  check(`${f} no longer declares a site writer of its own`, left.length === 0, left.length ? `still: ${left.map(String).join(", ")}` : "");
  const importers = walk("src").filter((p) => /import\s*\{[^}]*\bstaticSite\b[^}]*\}/.test(read(p)));
  check("nothing in src imports staticSite by name", importers.length === 0, importers.join(", "));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
