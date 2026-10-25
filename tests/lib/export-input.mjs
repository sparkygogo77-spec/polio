/**
 * What an export starts from, for the export tests: a capture brought into
 * the Builder (the board document as the store holds it, and the published
 * files `__studioExport` writes), and the System taken from it.
 *
 *   const site = await importedSite(browser, BASE, captureFolder);
 *   const site = dumpedSite(folder);   // board.json + site/ written before
 *
 * The import goes through the GitHub door with GitHub stubbed and a
 * placeholder key, the way tests/system-take.mjs does: nothing leaves the
 * machine.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { JSDOM } from "jsdom";
import { takeSystem } from "../../src/features/studio/system/take.ts";
import { libraryOut, pagesOut, tokensOut } from "../../src/features/studio/send-out/index.ts";
import { homeFor } from "../../src/features/studio/homePage.ts";
import { landPalette } from "../../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../../src/features/studio/look/index.ts";

/** The System taken from a board, and the board's parts linked to it (as "Take from this site" leaves them). */
export function systemOf(board, name) {
  const landed = landPalette(board.nodes, board.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const t = takeSystem({ nodes: landed.nodes, palette, frameWidth: board.frameWidth ?? 1440, name, at: 0 });
  const nodes = board.nodes.map((n) => (t.links.has(n.id) ? { ...n, sys: t.links.get(n.id) } : n));
  return { system: t.system, palette, nodes };
}

/** The clean export of a site brought in: tokens, pages (and the library, when asked), the pictures in public/. */
export function cleanExport(site, { library = false, gallery = false } = {}) {
  const { board } = site;
  const { system, palette, nodes } = systemOf(board, site.name);
  const pages = board.pages?.length ? board.pages : [{ id: board.nodes[0].pageId, name: "Home", path: "/" }];
  const home = homeFor(pages);
  const byPath = new Map(site.files.map((f) => [f.path, f]));
  const published = new Map();
  for (const p of pages) {
    const f = byPath.get(home.file(p));
    if (f) published.set(p.id, new JSDOM(f.bytes.toString("utf8")).window.document);
  }
  const lib = library ? libraryOut(system, { gallery }) : null;
  const out = pagesOut({
    name: site.name, pages, nodes, frameWidth: board.frameWidth ?? 1440, system, palette, published,
    siteCss: byPath.get("assets/site.css")?.bytes.toString("utf8") ?? "", library: lib?.names,
  });
  const assets = site.files.filter((f) => f.path.startsWith("assets/") && !/\.(css|js)$/.test(f.path)).map((f) => ({ path: `public/${f.path}`, content: f.bytes }));
  return { system, out, lib, files: [...tokensOut(system), ...(lib?.files ?? []), ...out.files, ...assets], board: { ...board, nodes } };
}

/** A folder holding board.json and site/ (the published files). */
export function dumpedSite(folder) {
  const board = JSON.parse(readFileSync(join(folder, "board.json"), "utf8"));
  const root = join(folder, "site");
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else files.push({ path: relative(root, p).replace(/\\/g, "/"), bytes: readFileSync(p) }); } };
  walk(root);
  return { name: basename(folder), board, files };
}

async function stubGithub(page, SINK) {
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [
    { path: "package.json", type: "blob", sha: "pkg", size: 10 },
    { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
    ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
  ];
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
}

const boardState = (page) => page.evaluate(async () => {
  let j = {}; try { j = JSON.parse(localStorage.getItem("builder.studio") || "{}"); } catch { /* none */ }
  if (Array.isArray(j.state?.nodes) && j.state.nodes.length) return j.state;
  const v = await new Promise((res) => { const r = indexedDB.open("builder.docs", 1); r.onsuccess = () => { try { const g = r.result.transaction("docs", "readonly").objectStore("docs").get("builder.studio"); g.onsuccess = () => res(g.result); g.onerror = () => res(null); } catch { res(null); } }; r.onerror = () => res(null); });
  try { return typeof v === "string" ? JSON.parse(v).state ?? {} : j.state ?? {}; } catch { return j.state ?? {}; }
});

/** Brings a capture into the Builder at BASE and reads back the board and the published files. */
export async function importedSite(browser, BASE, SINK) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await stubGithub(page, SINK);
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
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
  await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await page.locator("[data-repo-pull]").click();
  await page.waitForTimeout(300);
  if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
  let n = 0;
  for (let i = 0; i < 1800; i++) {
    await page.waitForTimeout(i < 100 ? 100 : 1000);
    const k = (await boardState(page)).nodes?.length ?? 0;
    if (i >= 100 && k === n && k > 0) break;
    n = k;
  }
  const board = await boardState(page);
  const out = await page.evaluate(async () => await window.__studioExport());
  const files = out.map((f) => ({ path: f.path.replace(/^\/+/, ""), bytes: f.encoding === "base64" ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf8") }));
  return { name: basename(SINK), board, files, page };
}
