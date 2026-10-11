#!/usr/bin/env node
/**
 * BUILD TELLS CLAUDE ABOUT THE CODEBASE IT ACTUALLY WROTE.
 *
 * Build writes the site from the document (app/, components/parts/, one
 * Frame) and then asks Claude for what a document cannot hold. The ask
 * described another codebase: the Builder's own, with feature modules under
 * src/features/ registered by defineFeature, primitives from "@/core/ui"
 * and Tailwind classes, and its example file was src/features/site/Home.tsx.
 * None of that is in what Build writes, so J got Claude's files back as a
 * second app beside the scaffold that no page imported, while the run line
 * counted them as written. Now the ask names the scaffold's own layout, and
 * this holds the words to the files: every file scaffold() can write is
 * named in the contract and nothing is named that it never writes, every
 * "@/" import resolves the way the contract says "@/" does, every package
 * the files import is one it allows, no build setup is written or asked
 * for, and the route sends this contract with an example file inside the
 * layout and nothing about the Builder's own repository.
 *
 *   node tests/build-contract.mjs
 *
 * Covers: src/features/studio/scaffolding/contract.ts, src/app/api/studio/generate/route.ts, src/features/studio/scaffolding/scaffold.ts, src/features/studio/scaffolding/pages.ts, src/features/studio/scaffolding/frameMesh.ts, src/features/studio/scaffolding/shell.ts, src/features/studio/standIn.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "scaffolding", "contract.ts"));
const S = await jiti.import(join(here, "..", "src", "features", "studio", "scaffold.ts"));
/* Comments stripped: the route explains what it used to say, and a raw scan would read that as saying it. */
const bare = (f) => readFileSync(join(here, "..", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* What the Builder's own repository is made of, and Build's never is. */
const TEMPLATE = ["defineFeature", "@/core", "src/features", "lucide-react", "bg-panel", "Tailwind 4", "site/document.json"];

/* The layout as patterns: `<Name>` is a component's name, `<route>` a page's folder. */
const entries = C.SCAFFOLD_LAYOUT.map((e) => ({
  ...e,
  re: new RegExp(`^${e.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("<Name>", "[A-Za-z][A-Za-z0-9]*").replace("<route>", ".+")}$`),
}));
const namedBy = (path) => entries.filter((e) => e.re.test(path));

/* A document with every kind of file in it: three pages (one nested), a page behaviour, the stand-in, and a plain part, a written body, an empty Idea, a cube and a solid. */
const behaviours = { progress: true, backToTop: false, reveal: false, parallax: 0, smooth: false, snap: null, intro: false, cursor: null, tilt: false, confetti: false, described: [], any: true };
const part = (id, pageId, extra = {}) => ({ id, pageId, featureId: "big-headline", label: `Part ${id}`, prompt: "", x: 0, y: 0, w: 400, h: 120, html: `<h2 style="color:#f5f7f2">${id}</h2>`, ...extra });
const doc = {
  name: "Contract", gimmick: "", master: "", frameWidth: 1440,
  pages: [{ id: "h", name: "Home", path: "/", behaviours }, { id: "l", name: "Lab", path: "/lab" }, { id: "b", name: "Post", path: "/blog/post" }],
  parts: [
    part("n_plain", "h"),
    part("n_body", "h", { featureId: "custom-idea", html: "", code: { html: '<svg viewBox="0 0 10 10"><text x="1" y="5">a body</text></svg>' }, outline: { cut: "M 0 0 L 1 0 L 1 1 Z", closed: true } }),
    part("n_idea", "l", { featureId: "custom-idea", html: "", empty: true, data: "the presets" }),
    part("n_cube", "l", { featureId: "cube-3d", html: "", cube: { faces: [{ heading: "One", body: "", colour: "accent" }] } }),
    part("n_mesh", "b", { featureId: "mesh", html: "", mesh: { glb: "data:model/gltf-binary;base64,AA==" } }),
  ],
  palette: { bg: "#050505", surface: "#0c0e0d", text: "#f5f7f2", muted: "#8c9690", accent: "#b8ff24", highlight: "#075dff" },
  tokens: { radius: 8, fontPx: 16, bodyFamily: "ui-monospace, monospace", headingFamily: "ui-monospace, monospace", line: "#1b1f1d", surface: "#0c0e0d", muted: "#8c9690" },
  standIn: { site: null, reads: [{ method: "GET", host: "api.example.test", path: "/prices", sample: { price: 1 } }] },
};
const files = S.scaffold(doc);
const paths = files.map((f) => f.path);

/* 1. The layout and the files agree, both ways. */
const unnamed = paths.filter((p) => namedBy(p).length !== 1);
check("every file the scaffold writes is named by exactly one line of the contract", unnamed.length === 0, unnamed.length ? `not named once: ${unnamed.join(", ")}` : `${paths.length} files`);
const never = entries.filter((e) => !paths.some((p) => e.re.test(p))).map((e) => e.path);
check("and every file the contract names is one the scaffold writes", never.length === 0, never.length ? `never written: ${never.join(", ")}` : `${entries.length} lines`);
{
  /* A plain two-page site: what it leaves out is exactly what the contract says is written only sometimes. */
  const plain = S.scaffold({ ...doc, pages: [{ id: "h", name: "Home", path: "/" }, { id: "a", name: "About", path: "/about" }], parts: [part("n_one", "h"), part("n_two", "a")], standIn: null }).map((f) => f.path);
  check("a plain site's files are all named too", plain.every((p) => namedBy(p).length === 1), plain.join(" "));
  const left = entries.filter((e) => !plain.some((p) => e.re.test(p)));
  check("and the ones it leaves out are the ones the contract says come only when asked for", left.length > 0 && left.every((e) => /only when/.test(e.holds)) && entries.filter((e) => /only when/.test(e.holds)).every((e) => left.includes(e)), left.map((e) => e.path).join(", "));
}

/* 2. The words, both ways the ask can go. */
const withScaffold = C.buildContract(true);
const without = C.buildContract(false);
for (const [label, text] of [["with a scaffold", withScaffold], ["without one", without]]) {
  check(`${label}, the contract names every file in the layout`, entries.every((e) => text.includes(`- ${e.path}: `)));
  const template = TEMPLATE.filter((w) => text.includes(w));
  check(`${label}, it names nothing of the Builder's own repository`, template.length === 0, template.join(", "));
}
check("with a scaffold, the codebase is the one Build wrote", /the one Build wrote/.test(withScaffold) && !/COULD NOT/.test(withScaffold));
check("without one, the whole site is Claude's to write, in the same layout", /COULD NOT BE WRITTEN/.test(without) && /write every file of the site/.test(without) && /in the layout Build uses/.test(without));

/* 3. "@/" is what the contract says it is: every alias import in the files names a file the scaffold wrote, read from the root. */
check('the contract says what "@/" means', /"@\/" means the repository root/.test(withScaffold));
{
  const have = new Set(paths);
  let n = 0;
  const missing = [];
  for (const f of files) {
    for (const m of f.content.matchAll(/\bfrom\s+"@\/([^"]+)"/g)) {
      n++;
      if (![m[1], `${m[1]}.ts`, `${m[1]}.tsx`, `${m[1]}/index.ts`, `${m[1]}/index.tsx`].some((t) => have.has(t))) missing.push(`${f.path} → @/${m[1]}`);
    }
  }
  check('every "@/" import in the scaffold is a file it wrote, from the repository root', n > 0 && missing.length === 0, `${n} imports${missing.length ? `, unresolved: ${missing.join(", ")}` : ""}`);
}

/* 4. Every package the files import is one the contract allows by name. */
{
  const pkgs = new Set();
  for (const f of files) {
    if (!/\.(tsx?|css)$/.test(f.path)) continue;
    for (const m of f.content.matchAll(/(?:\bfrom\s+|^\s*import\s+|\bimport\(\s*)"([^"]+)"/gm)) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("@/")) continue;
      pkgs.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
    }
  }
  const unnamedPkgs = [...pkgs].filter((p) => !withScaffold.includes(`"${p}"`));
  check("every package the scaffold imports is one the contract names", pkgs.size > 0 && unnamedPkgs.length === 0, `${[...pkgs].join(", ")}${unnamedPkgs.length ? `; not named: ${unnamedPkgs.join(", ")}` : ""}`);
}

/* 5. No build setup is written, and none is asked for: the files go up beside the published pages. Writing one is a deploy decision, so this and the contract change together. */
const setup = paths.filter((p) => /^(package\.json|tsconfig\.json|next\.config\.\w+|next-env\.d\.ts)$/.test(p));
check("the scaffold writes no package.json, tsconfig.json or next.config", setup.length === 0, setup.join(", "));
check("and the contract tells Claude to add none, and why", /no build setup \(package\.json, tsconfig\.json, next\.config\)/.test(withScaffold) && /published HTML pages/.test(withScaffold));

/* 6. The route sends this contract, and its example file is inside the layout. */
const route = bare("src/app/api/studio/generate/route.ts");
check("the route takes the contract from the scaffold's own module", /import \{ buildContract \} from "@\/features\/studio\/scaffolding\/contract"/.test(route));
check("a build ask carries it, told whether a scaffold came with it", /mode === "build" \? `\\n\\n\$\{buildContract\(scaffoldFiles\.length > 0\)\}\$\{scaffolded\}`/.test(route));
const left = TEMPLATE.filter((w) => route.includes(w));
check("nothing in the route describes the Builder's own repository any more", !/REPO_CONTRACT/.test(route) && left.length === 0, left.join(", "));
const example = /the path, like "\s*\+\s*"```(\w+) (\S+)/.exec(route);
check("the build ask's example file is a place in the layout", !!example && namedBy(example[2]).length === 1, example ? example[2] : "no example found");

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
