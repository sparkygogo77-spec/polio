#!/usr/bin/env node
/**
 * WHAT THE HEALING DOES TO SINK'S DOCUMENT, BROUGHT IN THROUGH THE REAL DOOR.
 *
 * The numbers behind docs/HANDOVER-HEALING.md, reproducible by anyone:
 * sink's own site/document.json (and its pictures) is served to the browser
 * as GitHub would serve it, a placeholder token goes in through the Keys
 * panel, and the repository is brought in with the GitHub control into an
 * empty site that has been opened first — the state Site 3 is in on his
 * Builder. Nothing leaves the machine. Then each measured page is opened and
 * left to heal, and the saved document is read.
 *
 * It prints, for the tokens page (the solid one — on home the healing already
 * ran once while the import landed, so home is indicative):
 *   · the landmarks: rail, nav, main, banner, footer, captured vs healed
 *   · how far the healing moved every part (a histogram)
 *   · the footer's own parts, each relative to the footer after healing
 *
 *   npm run build && npx next start -p 3013
 *   node scripts/bring-measure.mjs http://127.0.0.1:3013 <path to sink> [out.json]
 *
 * <path to sink> is a checkout of sparkygogo77-spec/sink. The ids below are
 * that document's; if sink's document is regenerated they may change, and
 * the script says which it could not find rather than guessing.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node scripts/bring-measure.mjs <builder url> <path to a sink checkout> [out.json]");
  process.exit(2);
}
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
const byId = new Map(doc.nodes.map((n) => [n.id, n]));
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];
/* Sink's own ids for the landmarks, by the role the capture recorded. */
const LAND = {
  page_home: { main: "n_box_1", rail: "n_box_57", nav: "n_box_58", banner: "n_box_75", footer: "n_box_109" },
  page_tokens: { main: "n_box_198", rail: "n_box_207", nav: "n_box_208", banner: "n_box_225", footer: "n_box_259" },
};

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
/** Every part's [page, y, h] as saved. */
const positions = async () => Object.fromEntries(((await state()).nodes ?? []).map((n) => [n.id, [n.pageId, n.y, n.h]]));

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
const landed = await positions();
const swept = (await state()).swept ?? null;

/* Each measured page opened and left to heal. */
const healed = {};
for (const p of Object.keys(LAND)) {
  await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, p);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  healed[p] = await positions();
}
await browser.close();

/* ------------------------------------------------------------------ */
/* What it says                                                         */
/* ------------------------------------------------------------------ */

const P = "page_tokens";
const L = LAND[P];
const after = healed[P];
const onPage = Object.keys(after).filter((id) => after[id][0] === P);
const missing = Object.values(L).filter((id) => !(id in after));
console.log(`sink: ${doc.nodes.length} parts in the document; ${Object.keys(landed).length} after the import (swept ${swept}); page errors ${errors.length}`);
if (missing.length) console.log(`NOT FOUND on ${P}: ${missing.join(", ")} — sink's ids have changed; update LAND`);

const bottom = (pos, ids) => Math.max(...ids.map((id) => pos[id][1] + pos[id][2]));
console.log(`\n${P}: ${onPage.length} parts; captured bottom ${Math.max(...doc.nodes.filter((n) => n.pageId === P).map((n) => n.y + n.h))}, healed bottom ${bottom(after, onPage)}`);
for (const [name, id] of Object.entries(L)) {
  if (!(id in after)) continue;
  const c = byId.get(id);
  console.log(`  ${name.padEnd(6)} ${id.padEnd(11)} captured y${c.y} h${c.h} | after import y${landed[id][1]} h${landed[id][2]} | healed y${after[id][1]} h${after[id][2]} | moved by healing ${after[id][1] - landed[id][1]}`);
}
if (L.rail in after && L.footer in after) {
  const railEnd = after[L.rail][1] + after[L.rail][2];
  console.log(`  rail ends ${railEnd}, footer starts ${after[L.footer][1]}: ${after[L.footer][1] - railEnd}px short (captured: ${byId.get(L.footer).y - (byId.get(L.rail).y + byId.get(L.rail).h)})`);
}

const shifts = {};
for (const id of onPage) if (id in landed) { const m = after[id][1] - landed[id][1]; shifts[m] = (shifts[m] ?? 0) + 1; }
console.log(`\n  healing moved ${onPage.filter((id) => id in landed && after[id][1] !== landed[id][1]).length} of ${onPage.length}; by how much: ${JSON.stringify(Object.fromEntries(Object.entries(shifts).sort((a, b) => a[0] - b[0])))}`);

/* The footer's own parts: those whose captured path continues the footer's, ON THIS PAGE. */
if (L.footer in after) {
  const fSel = byId.get(L.footer).from.selector;
  const fTop = after[L.footer][1];
  const fBot = fTop + after[L.footer][2];
  const capTop = byId.get(L.footer).y;
  console.log(`\n  the footer ${L.footer}: captured ${capTop}–${capTop + byId.get(L.footer).h}, healed ${fTop}–${fBot} (moved ${after[L.footer][1] - landed[L.footer][1]})`);
  for (const id of onPage.filter((i) => i !== L.footer && byId.get(i)?.from?.selector?.startsWith(`${fSel} > `))) {
    const [, y, h] = after[id];
    const where = y >= fTop && y + h <= fBot ? "inside" : y + h <= fTop ? `out the top, ${fTop - (y + h)}px clear` : y >= fBot ? `out the bottom, ${y - fBot}px clear` : "straddling its edge";
    console.log(`    ${id.padEnd(17)} ${String(byId.get(id).label).slice(0, 28).padEnd(30)} captured footer+${byId.get(id).y - capTop}, moved ${y - landed[id][1]}, now footer${y - fTop >= 0 ? "+" : ""}${y - fTop}: ${where}`);
  }
}
if (OUT) writeFileSync(OUT, JSON.stringify({ swept, errors, landed, healed }, null, 1));
