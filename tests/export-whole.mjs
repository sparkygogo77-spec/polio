/**
 * Build exports the site as Preview shows it (inventory B22, first piece).
 *
 * The export wrote each part's markup and the page's tokens, and dropped
 * what the live page adds round them: a part's entrance was copied as an
 * `animation:` name with no `@keyframes` behind it (and the page's drift the
 * same), the aura round a part was not written at all, the wash and the veil
 * over the page were absent, a link was markup with its click lost, and a
 * gradient or grid backdrop chosen with no texture was not painted. This
 * holds the first piece of it, on the pure scaffold with parts written by
 * hand, and reads the run that feeds it for the fields it has to pass:
 *
 *   · every animation name used anywhere in the export has its keyframes
 *     in globals.css: entrances, the page's drift, the aura's pulse;
 *   · a part's aura is on its wrapper;
 *   · the page carries the wash and the veil;
 *   · a link is an anchor: to a page's path, to a part on the page by id,
 *     to a URL in a new tab;
 *   · the backdrop is the body's background;
 *   · and the site it writes typechecks, run through tsc in a scratch
 *     folder, shell and cube included.
 *
 *   node tests/export-whole.mjs
 */
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { scaffold } from "../src/features/studio/scaffold.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const part = (id, extra = {}) => ({ id, pageId: "p", featureId: "cta", label: id, x: 0, y: 0, w: 300, h: 100, html: `<div><button>${id}</button></div>`, ...extra });
const files = scaffold({
  name: "Whole", frameWidth: 1440,
  pages: [{ id: "p", name: "Home", path: "/" }, { id: "p2", name: "About", path: "/about" }],
  palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" },
  tokens: {},
  pageCss: { background: "url(x) 50% 50% / 60px 60px repeat, #000", animation: "tex-drift-abc 30s linear infinite" },
  keyframes: ["@keyframes tex-drift-abc{to{background-position:calc(50% + 60px) calc(50% + 0px)}}"],
  overlayCss: { backgroundImage: "radial-gradient(#fff, transparent)", mixBlendMode: "overlay" },
  veil: "oklch(0 0 0 / 0.30)",
  backdrop: "radial-gradient(120% 80% at 20% 0%, oklch(0.7 0.14 200 / 0.2), transparent 70%), #000",
  parts: [
    part("n_rise", { anim: "el-rise", animSpeed: 1, animDelay: 0, animEase: "smooth" }),
    part("n_aura", { aura: "accent", auraSize: 1, auraStyle: "pulse" }),
    part("n_page", { link: { kind: "page", target: "/about" } }),
    part("n_node", { link: { kind: "node", target: "n_aura" } }),
    part("n_url", { link: { kind: "url", target: "https://example.com/" } }),
  ],
});
const at = (path) => files.find((f) => f.path === path)?.content ?? "";
const css = at("app/globals.css");
const page = at("app/page.tsx");
const all = files.map((f) => f.content).join("\n");

/* 1. Every animation name has its keyframes. */
const names = new Set([...all.matchAll(/animation"?:\s*"?([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((n) => !["none", "inherit"].includes(n)));
const defined = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
const missing = [...names].filter((n) => !defined.has(n));
check(`every animation the export names has keyframes in globals.css: ${names.size} named, ${defined.size} defined`, names.size >= 3 && missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : [...names].join(", "));
const riseWrap = page.split('data-part="n_rise"')[1]?.split("</Place>")[0] ?? "";
check("the entrance is on the part's wrapper and its keyframes are there", /\banimation: "el-rise \d+ms [^"]*both"/.test(riseWrap) && defined.has("el-rise"), riseWrap.match(/\banimation: "[^"]*"/)?.[0] ?? "no animation on the wrapper");
check("the page's drift keyframes are written, and the body drifts", defined.has("tex-drift-abc") && /animation: tex-drift-abc/.test(css));

/* 2. The aura. */
const auraWrap = page.split('data-part="n_aura"')[1]?.split("</Place>")[0] ?? "";
check("a part's aura is on its wrapper, with its colour", /boxShadow|box-shadow/.test(auraWrap) && /--aura/.test(auraWrap), auraWrap.slice(0, 160).replace(/\s+/g, " ") || "no wrapper");
check("and a pulsing one pulses, with its keyframes there", /aura-pulse/.test(auraWrap) && defined.has("aura-pulse"));

/* 3. The wash and the veil. */
check("the page carries the wash", /data-wash/.test(page) && /radial-gradient\(#fff, transparent\)/.test(page) && /overlay/.test(page));
check("and the veil", /data-veil/.test(page) && /oklch\(0 0 0 \/ 0\.30\)/.test(page));

/* 4. Links. */
const pageWrap = page.split('data-part="n_page"')[1]?.split("</Place>")[0] ?? "";
check("a link to a page is an anchor to its path, round the part", /<a href="\/about"[^>]*>/.test(pageWrap) && /<\/a>/.test(pageWrap), pageWrap.match(/<a href="[^"]*"[^>]*>/)?.[0] ?? "no anchor round n_page");
check("a link to a part is an anchor to its id, and the part carries that id", /<a href="#n_aura"/.test(page) && /id="n_aura"/.test(page) && /<div id=\{id\}/.test(at("components/Frame.tsx")));
check("a link to a URL opens a new tab, with no opener", /<a href="https:\/\/example\.com\/" target="_blank" rel="noopener noreferrer"/.test(page));

/* 5. The backdrop: painted when there is no texture on the page, and only then, as the live page does. */
check("under a texture the backdrop is not painted, the texture is", !/radial-gradient\(120% 80% at 20% 0%/.test(css) && /url\(x\)/.test(css));
const bare = scaffold({ name: "Bare", frameWidth: 1440, pages: [{ id: "p", name: "Home", path: "/" }], palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" }, tokens: {}, parts: [part("n1")], backdrop: "radial-gradient(120% 80% at 20% 0%, oklch(0.7 0.14 200 / 0.2), transparent 70%), #000" });
const bareCss = bare.find((f) => f.path === "app/globals.css")?.content ?? "";
check("a gradient backdrop chosen with no texture is the body's background", /body \{[^}]*radial-gradient\(120% 80% at 20% 0%/.test(bareCss));

/* 6. The site it wrote typechecks, shell and cube included: a link, an aura, an entrance are code someone will build. */
const site = join(tmpdir(), `export-whole-${process.pid}`);
rmSync(site, { recursive: true, force: true });
const withShell = scaffold({
  name: "Whole", frameWidth: 1440,
  pages: [{ id: "p", name: "Home", path: "/", behaviours: { progress: true, backToTop: true, reveal: true, parallax: 0.18, smooth: true, snap: "vertical", intro: true, cursor: "spotlight", tilt: true, confetti: true, described: [{ id: "sticky-story", label: "Sticky story" }], any: true } }, { id: "p2", name: "About", path: "/about" }],
  palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" }, tokens: {},
  keyframes: ["@keyframes tex-drift-abc{to{background-position:0 0}}"], overlayCss: { backgroundImage: "radial-gradient(#fff, transparent)" }, veil: "oklch(0 0 0 / 0.3)", backdrop: "#000",
  parts: [part("n_rise", { anim: "el-rise" }), part("n_aura", { aura: "accent", auraStyle: "pulse" }), part("n_page", { link: { kind: "page", target: "/about" } }), part("n_url", { link: { kind: "url", target: "https://example.com/" } }), { ...part("n_cube"), featureId: "cube-3d", cube: { faces: Array.from({ length: 6 }, () => ({ heading: "", body: "", colour: "" })) } }],
});
for (const f of withShell) { mkdirSync(join(site, dirname(f.path)), { recursive: true }); writeFileSync(join(site, f.path), f.content); }
writeFileSync(join(site, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["dom", "dom.iterable", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, baseUrl: ".", paths: { "@/*": ["./*"] }, types: ["react", "react-dom"], typeRoots: [resolve("node_modules/@types")] }, include: ["**/*.ts", "**/*.tsx"] }));
mkdirSync(join(site, "node_modules"), { recursive: true });
for (const m of ["react", "next", "@types"]) symlinkSync(resolve("node_modules", m), join(site, "node_modules", m), "dir");
const tsc = spawnSync(resolve("node_modules/.bin/tsc"), ["-p", "tsconfig.json"], { cwd: site, encoding: "utf8" });
check(`the exported site typechecks, ${withShell.length} files, shell and cube included`, tsc.status === 0, tsc.status === 0 ? "tsc clean" : (tsc.stdout + tsc.stderr).trim().split("\n").slice(0, 3).join(" | "));
rmSync(site, { recursive: true, force: true });

/* 7. The run feeds all of it. */
const run = readFileSync("src/features/studio/scaffoldRun.ts", "utf8");
const passed = ["anim", "aura", "link", "veil", "overlayCss", "keyframes", "backdrop"].filter((k) => new RegExp(`\\b${k}\\b`).test(run));
check(`the build passes the fields (source read): ${passed.length} of 7`, passed.length === 7, passed.join(", "));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
