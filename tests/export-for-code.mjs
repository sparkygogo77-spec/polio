#!/usr/bin/env node
/**
 * EXPORT FOR CODE: THE BOARD AS A BUILDER-READY REPOSITORY.
 *
 * kit/PIPELINE.md, route 1, step 2: J designs a site here and a code chat
 * builds on the export. So the export keeps the builder contract
 * (kit/BUILDER-CONTRACT.md) and the kit's own check passes on it, and it
 * still looks exactly as the regular export does. Held on a real site, the
 * sink's, brought in through the real door, exported through the real
 * button's code (`window.__studioKitExport`, the same `exportForCode` the
 * command runs, with `hooks.json` made on the server's /api/studio/kit-map):
 *
 *   · the kit's embedded files match kit/ (`npm run kit:files -- --check`);
 *   · `kit:check` passes on the export, run as a code chat runs it, from
 *     its own folder: every element hooked, no inline style or style block,
 *     no colour outside tokens.css, tokens first and the style layer last;
 *   · builder.json lists every page with a preview screen each, and the
 *     site's own link rules; the style layer ships empty;
 *   · every page looks as the regular export draws it (screenshots, within
 *     1% of pixels) and runs without a script error;
 *   · the zip it downloads holds every file.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/export-for-code.mjs http://127.0.0.1:3013 <the capture folder>
 *
 * Covers: src/features/studio/kitExport.ts, src/features/studio/exportForCode.ts, src/features/studio/send-out/zipWrite.ts, src/app/api/studio/kit-map/route.ts, src/features/studio/kitFiles.ts
 */
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "playwright-core";
import { offsiteToKitLinks, DEFAULT_OFFSITE } from "../src/features/studio/parts/offsite.ts";
import { zipFiles } from "../src/features/studio/send-out/zipWrite.ts";
import { readZip } from "../src/features/studio/zipFile.ts";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/export-for-code.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const synced = (() => { try { return { ok: true, out: execFileSync("node", ["scripts/kit-files.mjs", "--check"], { encoding: "utf8" }) }; } catch (e) { return { ok: false, out: String(e.stdout ?? e.message) }; } })();
check("the kit files the export writes match kit/", synced.ok, synced.out.trim());

const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/* An empty site, opened first. */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A placeholder token, through the Keys panel, the way his goes in. */
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);

/* The door. */
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);



const s = await state();
const regular = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
const kit = await page.evaluate(async () => (window.__studioKitExport ? await window.__studioKitExport() : null));
check("the site came in and exports", (s.nodes?.length ?? 0) > 100 && regular.length > 0 && !!kit, `${s.nodes?.length} parts`);
check("export for code passes the kit's check on the server, which made hooks.json", kit?.ok === true && kit.problems.length === 0 && kit.files.some((f) => f.path === "site/hooks.json"), (kit?.problems ?? []).slice(0, 5).join(" | "));

/* On disk, as a code chat gets it: the kit's check run from its own folder. */
const DIR = mkdtempSync(join(tmpdir(), "for-code-"));
for (const f of kit.files) { const at = join(DIR, f.path); mkdirSync(dirname(at), { recursive: true }); writeFileSync(at, f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const run = (...args) => { try { return { ok: true, out: execFileSync("node", args, { cwd: DIR, encoding: "utf8" }) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } };
const kc = run("tools/kit-check.mjs", "builder.json");
console.log(`       ${kc.out.trim().split("\n").at(-1)}`);
check("kit:check passes in the exported repo", kc.ok, kc.out.trim().split("\n").slice(-6).join(" | "));
const manifest = JSON.parse(readFileSync(join(DIR, "builder.json"), "utf8"));
check("builder.json lists every page, with a preview screen each", manifest.pages.length === s.pages.length && manifest.preview.screens.length === s.pages.length && manifest.pages.every((p) => existsSync(join(DIR, p.file))));
check("the builder rules go along: BUILDER-RULES.md, and the same list as builder.json \"rules\" (rule 1: states inside parts)", existsSync(join(DIR, "BUILDER-RULES.md")) && manifest.rules?.doc === "BUILDER-RULES.md" && manifest.rules.list?.some((r) => r.id === "states-inside-parts") && manifest.rules.list.length === [...readFileSync(join(DIR, "BUILDER-RULES.md"), "utf8").matchAll(/^## \d+\. /gm)].length && /Connecting to the game server/.test(readFileSync(join(DIR, "BUILDER-RULES.md"), "utf8")), JSON.stringify(manifest.rules?.list?.map((r) => r.id)));
check("builder.json carries the site's own link rules", JSON.stringify(manifest.links) === JSON.stringify(offsiteToKitLinks(String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE))), JSON.stringify(manifest.links));
check("the style layer ships empty, and the contract, tools, CLAUDE.md and CI go along", readFileSync(join(DIR, manifest.styleLayer), "utf8") === "" && ["BUILDER-CONTRACT.md", "PIPELINE.md", "CLAUDE.md", "AGENTS.md", "tools/kit-check.mjs", "tools/kit-diff.mjs", ".github/workflows/kit-check.yml", "package.json"].every((f) => existsSync(join(DIR, f))));
const kitHome = readFileSync(join(DIR, manifest.pages[0].file), "utf8");
check("no inline style and no style block are left on a page", manifest.pages.every((p) => { const t = readFileSync(join(DIR, p.file), "utf8"); return !/<[a-z][^>]*\sstyle\s*=/i.test(t) && !/<style[\s>]/i.test(t); }));
check("a page's hooks are named for people, from its words", /data-hook="total-pnl-[a-z]+(-\d+)?"/.test(kitHome) && /data-hook="page-home"/.test(kitHome));

/* Each page as the regular export draws it, and as the export for code does. */
const served = {};
for (const f of regular) served[`a/${f.path}`] = f;
for (const f of kit.files) served[`b/${f.path}`] = f;
const server = createServer((req, res) => {
  let path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "");
  if (path.endsWith("/") || path === "a" || path === "b/site") path = `${path.replace(/\/$/, "")}/index.html`;
  const f = served[path];
  if (!f) { res.writeHead(404); res.end(); return; }
  const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".json") ? "application/json" : path.endsWith(".html") ? "text/html" : path.endsWith(".png") ? "image/png" : path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  res.end(f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const shoot = async (url) => {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.evaluate(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0; } });
  const png = await p.screenshot({ fullPage: true });
  await p.close();
  return { png: png.toString("base64"), errs };
};
const cmp = await browser.newPage();
const offBy = [];
const pageErrors = [];
for (const pg of manifest.pages) {
  const file = pg.file.slice("site/".length);
  const a = await shoot(`http://127.0.0.1:${port}/a/${file}`);
  const b = await shoot(`http://127.0.0.1:${port}/b/site/${file}`);
  if (b.errs.length > a.errs.length) pageErrors.push(`${file}: ${b.errs.join(" | ")}`);
  const d = await cmp.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = `data:image/png;base64,${src}`; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { size: `${x.width}x${x.height} against ${y.width}x${y.height}`, share: 1 };
    const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const A = px(x), B = px(y);
    let n = 0;
    for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 48) n++;
    return { share: n / (A.length / 4) };
  }, [a.png, b.png]);
  offBy.push(`${file} ${(d.share * 100).toFixed(2)}%${d.size ? ` (${d.size})` : ""}`);
}
check("every page looks as the regular export draws it (under 1% of pixels apart)", offBy.every((x) => parseFloat(x.split(" ")[1]) < 1), offBy.join(", "));
check("and runs without a script error the regular export does not have", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

/* The zip it downloads. */
const enc = new TextEncoder();
const zip = zipFiles(kit.files.map((f) => ({ path: f.path, bytes: f.encoding === "base64" ? Buffer.from(f.content, "base64") : enc.encode(f.content) })));
const back = readZip(zip);
const one = back?.find((z) => z.name === "builder.json");
check("the zip holds every file, readable", back?.length === kit.files.length && !!one && new TextDecoder().decode(one.bytes()) === kit.files.find((f) => f.path === "builder.json").content);

server.close();
await browser.close();
rmSync(DIR, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
