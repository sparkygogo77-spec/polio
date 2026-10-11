#!/usr/bin/env node
/**
 * Saved boards: bring a site in once, and let every test and thread open it
 * already brought in (tests/lib/board.mjs).
 *
 *   npm run board -- refresh pst              # bring PST's default branch in, save tests/fixtures/boards/pst.json.gz
 *   npm run board -- refresh pst --from ../PST   # from a checkout on disk instead of a fresh clone
 *   npm run board -- shot pst out.png         # the Builder with the saved board on it, as a picture
 *   npm run board -- show pst                 # which commit the saved board is, and its size
 *
 *   --url http://127.0.0.1:3013   a Builder already running (otherwise `next start` on the
 *                                  last build is started on --port, default 3019, and stopped after)
 *   --repo owner/name --ref branch --take web/,builder.json   a site not in SITES below
 *
 * Refresh only when the site itself changed, or when the importer changed
 * in a way the test you are writing must see. The import is driven exactly
 * as tests/tv-import.mjs drives it: the GitHub control, a stand-in GitHub
 * serving the site's files, a placeholder key.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";
import { BOARDS, dumpBoard, openBoard, readBoard } from "../tests/lib/board.mjs";

/** The sites boards are kept for: where each comes from, and which of its files the import is given. */
const SITES = {
  pst: { repo: "sparkygogo77-spec/PST", ref: "claude/wizardly-davinci-92ah39", take: ["web/", "builder.json"] },
};

const argv = process.argv.slice(2);
const opt = (name, fallback = null) => { const i = argv.indexOf(`--${name}`); if (i < 0) return fallback; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const URL_GIVEN = opt("url");
const PORT = Number(opt("port", "3019"));
const FROM = opt("from");
const REPO = opt("repo"), REF = opt("ref"), TAKE = opt("take");
/* --width/--height: the window the Builder is opened in (what a refresh reads the site at). */
const WINDOW = { width: Number(opt("width", 1440)), height: Number(opt("height", 900)) };
const [cmd, name = "pst", out] = argv;
const site = { ...(SITES[name] ?? {}), ...(REPO ? { repo: REPO } : {}), ...(REF ? { ref: REF } : {}), ...(TAKE ? { take: TAKE.split(",") } : {}) };

if (!["refresh", "shot", "show"].includes(cmd)) { console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]); process.exit(cmd ? 1 : 0); }

if (cmd === "show") {
  const b = readBoard(name);
  const parts = b.from.parts;
  console.log(JSON.stringify({ ...b.from, parts, pictures: b.idb["builder.pictures"]?.stores?.files?.length ?? 0 }, null, 2));
  process.exit(0);
}

/* A Builder to drive: the one given, or the last build started here. */
let server = null;
const base = URL_GIVEN ?? `http://127.0.0.1:${PORT}`;
if (!URL_GIVEN) {
  if (!existsSync(".next/BUILD_ID")) { console.error("No build: run `npm run build` first, or pass --url to a running Builder."); process.exit(1); }
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore", env: { ...process.env, GITHUB_TOKEN: "", VERCEL_TOKEN: "" } });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(`${base}/api/version`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: WINDOW });
const done = async (code = 0) => { await browser.close(); server?.kill(); process.exit(code); };

if (cmd === "shot") {
  if (!out) { console.error("Say where the picture goes: npm run board -- shot pst out.png"); await done(1); }
  const st = await openBoard(page, base, name);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out });
  console.log(`${out}: ${st.nodes?.length ?? 0} parts`);
  await done();
}

/* ---------------------------------------------------------- refresh */
if (!site.repo) { console.error(`No site called ${name}: add it to SITES in scripts/board.mjs, or pass --repo and --ref.`); await done(1); }
let root = FROM ? resolve(FROM) : null, scratch = null;
if (!root) {
  scratch = mkdtempSync(join(tmpdir(), "board-"));
  execFileSync("git", ["clone", "-q", "--depth", "1", "--branch", site.ref, `https://github.com/${site.repo}`, scratch], { stdio: "inherit" });
  root = scratch;
}
let commit = null;
try { commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a checkout */ }

const FILES = {};
const walk = (d, rel) => { for (const n of readdirSync(d)) { const p = join(d, n), r = `${rel}/${n}`; if (statSync(p).isDirectory()) walk(p, r); else FILES[r] = readFileSync(p); } };
for (const t of site.take) { const p = join(root, t); if (!existsSync(p)) continue; if (statSync(p).isDirectory()) walk(p, t.replace(/\/$/, "")); else FILES[t] = readFileSync(p); }
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));
const [owner, repoName] = site.repo.split("/");

await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!mm || mm[1].toLowerCase() !== owner.toLowerCase() || mm[2].toLowerCase() !== repoName.toLowerCase()) return j({ message: "no" }, 404);
  const rest = mm[3] ?? "";
  if (!rest) return j({ default_branch: site.ref ?? "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: FILES[names[Number(b[1])]].toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10).split("?")[0]); return FILES[f] !== undefined ? j({ content: FILES[f].toString("base64"), encoding: "base64" }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: commit ?? "c0" } });
  if (rest.startsWith("/commits/")) return j({ sha: commit ?? "c0" });
  return j({ message: "no" }, 404);
});

await page.goto(`${base}/builder`, { waitUntil: "networkidle" });
await page.evaluate((title) => {
  for (const k of Object.keys(localStorage)) if (k.startsWith("builder.")) localStorage.removeItem(k);
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: title, updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
}, repoName);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
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
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill(site.repo);
await page.locator("[data-repo-pull]").click();

/* Landed: parts on the board, and nothing saved for three seconds running (the stills come after the parts). */
const look = () => page.evaluate(() => ({ n: window.__studioNodes?.()?.length ?? 0, len: (localStorage.getItem("builder.studio") ?? "").length }));
let last = await look(), still = 0;
for (let i = 0; i < 300 && (last.n === 0 || still < 6); i++) {
  await page.waitForTimeout(500);
  const now = await look();
  still = now.n > 0 && now.len === last.len ? still + 1 : 0;
  last = now;
}
if (!last.n) { console.error("The site never landed on the board.", await page.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "(no strip)")); await page.screenshot({ path: join(tmpdir(), "board-failed.png") }); await done(1); }
await page.waitForTimeout(1500);

const board = await dumpBoard(page);
board.from = { site: name, repo: site.repo, ref: site.ref, commit, files: names.length, parts: last.n, saved: new Date().toISOString() };
try { board.from.builder = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a checkout */ }
mkdirSync(BOARDS, { recursive: true });
const file = join(BOARDS, `${name}.json.gz`);
writeFileSync(file, gzipSync(JSON.stringify(board), { level: 9 }));
console.log(`${file}: ${last.n} parts from ${site.repo}@${(commit ?? "?").slice(0, 7)}, ${(statSync(file).size / 1024).toFixed(0)} KB`);
if (scratch) rmSync(scratch, { recursive: true, force: true });
await done();
