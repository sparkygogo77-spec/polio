#!/usr/bin/env node
/**
 * Pictures of models out of the model viewer (/models), with no one at the
 * screen: for each model, the nine views of a concept sheet as one PNG, and
 * a picture of the whole page for the first.
 *
 * Made so a Blender hand-off can be checked the moment it lands, by a session
 * with no GPU and no one to open a browser for it. It drives a headless
 * Chromium (software WebGL) against a running Builder:
 *
 *   node scripts/model-shots.mjs --url http://localhost:3000 \
 *        --repo-dir ../site-10 --ref origin/claude/lantern-redesign-pass2 \
 *        --out shots/ docs/blender/models/blue_lantern.glb red_lantern
 *
 * Models are paths in the repository, or a bare name matched against every
 * model the viewer lists. `--all` takes every one; `--dir a,b` narrows the list.
 *
 * Where the bytes come from:
 * - `--repo-dir <checkout>`: from a local clone, read with `git show <ref>:<path>`
 *   (so no branch is checked out). The viewer's /api/models answers are
 *   stood in for, so no GitHub token is needed. This is the one a cloud
 *   session uses.
 * - otherwise: through the viewer's own route, with `--token` or GITHUB_TOKEN
 *   as the Keys panel would send it, from GitHub.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
};

const URL_BASE = (opt("url", "http://localhost:3000")).replace(/\/+$/, "");
const REPO_DIR = opt("repo-dir", null);
const REF = opt("ref", null);
const OUT = opt("out", "model-shots");
const DIR = opt("dir", null);
const CELL = Number(opt("cell", "360"));
const BG = opt("bg", "dark");
const TOKEN = opt("token", process.env.GITHUB_TOKEN ?? "");
const ALL = flag("all");
const wanted = argv;
if (!ALL && wanted.length === 0) {
  console.error("Name some models (paths or names), or pass --all.");
  process.exit(2);
}

const MODEL = /\.(glb|gltf|bbmodel)$/i;
const git = (...a) => execFileSync("git", ["-C", REPO_DIR, ...a], { maxBuffer: 1 << 28 });
const LOCAL = "http://local.models/";

mkdirSync(OUT, { recursive: true });
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ...(existsSync(AT) ? { executablePath: AT } : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: TOKEN ? { "x-github-token": TOKEN } : {} });
page.on("pageerror", (e) => console.error("page error:", e.message));

if (REPO_DIR) {
  const ref = REF ?? "HEAD";
  // The viewer asks /api/models; answer it from the clone.
  await page.route("**/api/models?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    const path = q.get("path");
    if (path) return route.fulfill({ json: { ok: true, url: LOCAL + path } });
    const dirs = (q.get("dir") ?? "").split(",").map((d) => d.trim()).filter(Boolean);
    const lines = git("ls-tree", "-r", "-l", ref).toString().trim().split("\n");
    const files = lines.map((l) => {
      const [meta, p] = l.split("\t");
      return { path: p, size: Number(meta.trim().split(/\s+/)[3]) || 0 };
    }).filter((f) => MODEL.test(f.path) && (dirs.length === 0 || dirs.some((d) => f.path.startsWith(d + "/"))));
    return route.fulfill({ json: { ok: true, files } });
  });
  await page.route(LOCAL + "**", (route) => {
    const path = decodeURIComponent(route.request().url().slice(LOCAL.length));
    try {
      route.fulfill({ body: git("show", `${ref}:${path}`), headers: { "access-control-allow-origin": "*" } });
    } catch {
      route.fulfill({ status: 404, body: `${path} is not in ${ref}` });
    }
  });
}

const query = new URLSearchParams({ bg: BG, ...(DIR ? { dir: DIR } : {}), ...(REF && !REPO_DIR ? { ref: REF } : {}) });
await page.goto(`${URL_BASE}/models?${query}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__modelViewer, null, { timeout: 120_000 });

// Every model the viewer lists, to match bare names against.
const listed = await page.evaluate(async (q) => {
  const r = await fetch(`/api/models?${q}`, { cache: "no-store" });
  return (await r.json()).files ?? [];
}, query.toString());
const pick = ALL ? listed.map((f) => f.path) : wanted.flatMap((w) => {
  if (MODEL.test(w) && w.includes("/")) return [w];
  const hits = listed.map((f) => f.path).filter((p) => p.split("/").pop().replace(MODEL, "") === w.replace(MODEL, ""));
  if (hits.length === 0) console.error(`No model called ${w}.`);
  return hits;
});

const results = [];
let first = true;
for (const path of pick) {
  const name = path.replace(/[\\/]/g, "__").replace(MODEL, "");
  const t0 = Date.now();
  await page.evaluate((p) => { void window.__modelViewer.open(p); }, path);
  await page.waitForFunction(() => window.__modelViewer.ready || window.__modelViewer.error, null, { timeout: 120_000 });
  const state = await page.evaluate(() => ({ error: window.__modelViewer.error, info: window.__modelViewer.info }));
  if (state.error) {
    console.log(`✗ ${path}: ${state.error}`);
    results.push({ path, error: state.error });
    continue;
  }
  const sheet = await page.evaluate((c) => window.__modelViewer.sheet(c), CELL);
  writeFileSync(join(OUT, `${name}-sheet.png`), Buffer.from(sheet.split(",")[1], "base64"));
  if (first) {
    await page.screenshot({ path: join(OUT, `${name}-page.png`) });
    first = false;
  }
  const i = state.info;
  console.log(`✓ ${path}: ${i.size.map((n) => n.toFixed(2)).join("×")} blocks, ${Math.round(i.triangles)} tris${i.cubes !== undefined ? `, ${i.cubes} cubes` : ""} (${Date.now() - t0} ms)`);
  results.push({ path, ...i });
}
writeFileSync(join(OUT, "index.json"), JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.some((r) => r.error) ? 1 : 0);
