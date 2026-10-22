/**
 * Build exports a solid as a solid (inventory B22, third piece).
 *
 * A part that is a 3D mesh carries its GLB in the document and, on the
 * live page, mounts it with three.js and turns it with the pointer, falling
 * back to a still when the library or a 3D context is not there. The export
 * wrote the still alone, as an `<img>`, so a built site had a photograph of
 * one angle. Now the export writes the solid as a component: the GLB as
 * data at the top of the file, three.js loaded only in the browser and only
 * when it is there, the still as the fallback the live page uses, the same
 * turning, and BUILD.md naming the one dependency.
 *
 *   node tests/export-mesh.mjs
 */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { scaffold } from "../src/features/studio/scaffold.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const GLB = `data:model/gltf-binary;base64,${Buffer.from("glTF-written-by-the-suite").toString("base64")}`;
const STILL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const files = scaffold({
  name: "Solid", frameWidth: 1440,
  pages: [{ id: "p", name: "Home", path: "/" }],
  palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" },
  tokens: {},
  parts: [{
    id: "n_bird", pageId: "p", featureId: "mesh-3d", label: "Bird", x: 100, y: 100, w: 420, h: 420,
    html: `<div><img src="${STILL}" alt="a still nobody should ship as the solid"></div>`,
    mesh: { glb: GLB, bytes: GLB.length, from: "tencent/hunyuan3d-2mv", still: STILL, turn: { x: -12, y: -28 } },
  }],
});
const comp = files.find((f) => f.path.startsWith("components/parts/"));
const src = comp?.content ?? "";
check("Build writes a file for the solid", !!comp, comp?.path);
check("it is a component that mounts the solid, not the still alone", /useEffect/.test(src) && /import\("three"\)/.test(src) && /GLTFLoader/.test(src), src.match(/import\([^)]*\)/g)?.join(" ") ?? "no dynamic import");
check("the GLB rides in the file as data, fetched from nowhere", src.includes(GLB) && !/fetch\(/.test(src));
check("the still is the fallback, said as such", src.includes(STILL) && /shown as a still/.test(src));
check("it turns with the pointer and the keys, at the cube's rate", /onPointerMove|pointermove/.test(src) && /ArrowLeft/.test(src) && /0\.42/.test(src));
check("it starts at the angle it was left at", /-12/.test(src) && /-28/.test(src));
check("no library is imported statically: three comes only when the part is live in a browser", !/^import .*from "three/m.test(src), (src.match(/^import .*$/gm) ?? []).join(" | "));
check("the still markup is not what shipped", !src.includes("a still nobody should ship"));
const build = files.find((f) => f.path === "BUILD.md")?.content ?? "";
check("BUILD.md names three as the one dependency a solid needs", /three/.test(build) && /npm i(nstall)? three|three\.js/.test(build));

/* The site typechecks, three's types included. */
const site = join(tmpdir(), `export-mesh-${process.pid}`);
rmSync(site, { recursive: true, force: true });
for (const f of files) { mkdirSync(join(site, dirname(f.path)), { recursive: true }); writeFileSync(join(site, f.path), f.content); }
writeFileSync(join(site, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2020", lib: ["dom", "dom.iterable", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler", strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, baseUrl: ".", paths: { "@/*": ["./*"] }, types: ["react", "react-dom"], typeRoots: [resolve("node_modules/@types")] }, include: ["**/*.ts", "**/*.tsx"] }));
mkdirSync(join(site, "node_modules"), { recursive: true });
for (const m of ["react", "next", "three", "@types"]) symlinkSync(resolve("node_modules", m), join(site, "node_modules", m), "junction");
const tsc = spawnSync(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"], { cwd: site, encoding: "utf8" });
check("the exported site typechecks with the solid in it", tsc.status === 0, tsc.status === 0 ? "tsc clean" : (tsc.stdout + tsc.stderr).trim().split("\n").slice(0, 3).join(" | "));
rmSync(site, { recursive: true, force: true });

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
