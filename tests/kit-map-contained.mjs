#!/usr/bin/env node
/**
 * THE KIT'S CHECK ON OUR SERVER WRITES ONLY IN ITS OWN SCRATCH FOLDER.
 *
 * `/api/studio/kit-map` writes a site's files to a scratch folder and runs
 * the kit's check there with --write, which writes where builder.json
 * points (hooks.json, the tokens module, the pages' motion script). So a
 * path builder.json names that leads out of the folder ("../x.js", "/etc/x")
 * would write on J's machine, and any web page he has open while the
 * Builder runs could ask for it. Pure, no server:
 *
 *   1. each path builder.json names (tokensModule, hooks, a page, tokens,
 *      a helper file) that leads outside is refused, nothing is made, and
 *      nothing appears where it pointed;
 *   2. a file name with a newline or a `..` past the top is refused;
 *   3. a normal starter still passes and still gets hooks.json back;
 *   4. the route turns away a body that is not JSON (415, what a cross-site
 *      form or no-cors post sends) and a request from another site's page
 *      (403), and still answers the Builder's own.
 *
 *   node tests/kit-map-contained.mjs
 *
 * Covers: src/features/studio/kitMap.ts, src/app/api/studio/kit-map/route.ts
 */
import { createJiti } from "jiti";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { kitMap } = await jiti.import(join(here, "..", "src", "features", "studio", "kitMap.ts"));
const { POST } = await jiti.import(join(here, "..", "src", "app", "api", "studio", "kit-map", "route.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };

const manifest = (over = {}) => ({ kit: "1.0.0", pages: [{ file: "index.html" }], hooks: "hooks.json", tokens: "tokens.css", styleLayer: "s.css", preview: { page: "index.html", screens: [] }, gallery: "index.html", ...over });
const starter = (m) => ({
  "builder.json": JSON.stringify(m),
  "index.html": '<!doctype html><html><head><link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="s.css"></head><body data-hook="b"></body></html>',
  "tokens.css": ":root { --x: 1px; }",
  "s.css": "",
});

/* 1. every path builder.json names stays inside. Each escape aims at a fresh folder next to the scratch ones. */
const away = () => `kit-map-escape-${Math.random().toString(36).slice(2)}`;
const escapes = [
  ["tokensModule", (d) => ({ tokensModule: `../${d}/pwned.js` })],
  ["hooks", (d) => ({ hooks: `../${d}/h.json` })],
  ["a page", (d) => ({ pages: [{ file: "index.html" }, { file: `../${d}/i.html` }] })],
  ["tokens", (d) => ({ tokens: join(tmpdir(), d, "t.css") })],
  ["a helper file", (d) => ({ scripts: { helperFiles: [`sub/../../${d}/x.js`] } })],
];
for (const [what, over] of escapes) {
  const d = away();
  const r = kitMap(starter(manifest(over(d))));
  const landed = existsSync(join(tmpdir(), d));
  check(`builder.json ${what} outside the folder is refused, nothing made or written`, r.problems.length === 1 && r.problems[0].includes(d) && Object.keys(r.made).length === 0 && !landed, JSON.stringify(r).slice(0, 300));
  rmSync(join(tmpdir(), d), { recursive: true, force: true });
}

/* 2. the file names themselves. A newline in tokens.css's name used to end the comment line of the tokens module it writes. */
for (const name of ["t\nglobalThis.PWNED=1;//.css", "../x.css", "a/../../x.css", "/x.css"]) {
  const r = kitMap({ ...starter(manifest()), [name]: "" });
  check(`a file named ${JSON.stringify(name)} is refused`, r.problems.length === 1 && /not a file of the repository/.test(r.problems[0]) && Object.keys(r.made).length === 0, JSON.stringify(r).slice(0, 300));
}
const dotty = kitMap({ ...starter(manifest()), "..notes.txt": "" });
check("a file whose name only starts with two dots is still taken", !dotty.problems.some((p) => /not a file of the repository/.test(p)), dotty.problems.join("; "));

/* 3. a normal starter, here with its own tokens module and a manifest in a folder. */
const ok = kitMap(starter(manifest({ tokensModule: "tokens.js" })));
check("a normal starter passes and gets hooks.json and the tokens module back", ok.problems.length === 0 && typeof ok.made["hooks.json"] === "string" && /export const TOKENS/.test(ok.made["tokens.js"] ?? ""), JSON.stringify(ok).slice(0, 300));
const nested = Object.fromEntries(Object.entries(starter(manifest())).map(([p, t]) => [`site/${p}`, t]));
const okNested = kitMap(nested, "site/builder.json");
check("a manifest in a folder still passes", okNested.problems.length === 0 && typeof okNested.made["site/hooks.json"] === "string", JSON.stringify(okNested).slice(0, 300));

/* 4. the route. */
const body = JSON.stringify({ files: starter(manifest()) });
const ask = (headers) => POST(new Request("http://localhost:3000/api/studio/kit-map", { method: "POST", headers: { host: "localhost:3000", ...headers }, body }));
const plain = await ask({ "content-type": "text/plain", origin: "https://evil.example" });
check("the route turns away a body that is not JSON (415)", plain.status === 415, `${plain.status}`);
const plainSame = await ask({ "content-type": "text/plain" });
check("…even with no Origin", plainSame.status === 415, `${plainSame.status}`);
const foreign = await ask({ "content-type": "application/json", origin: "https://evil.example" });
check("the route turns away another site's page (403)", foreign.status === 403, `${foreign.status}`);
const own = await ask({ "content-type": "application/json", origin: "http://localhost:3000" });
const ownJson = await own.json();
check("the Builder's own page is answered", own.status === 200 && ownJson.ok === true && typeof ownJson.made["hooks.json"] === "string", `${own.status} ${JSON.stringify(ownJson).slice(0, 200)}`);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
