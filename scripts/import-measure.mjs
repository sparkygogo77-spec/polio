#!/usr/bin/env node
/**
 * WHAT A FRESH IMPORT OF SINK LOOKS LIKE ON THE BOARD, IN THE NUMBERS WE VERIFY BY.
 *
 * Sink's site/document.json (and its pictures) is served as GitHub would
 * serve it, a placeholder token goes in through the Keys panel, and the
 * repository is brought in with the GitHub control into an empty site, as
 * scripts/bring-measure.mjs does. Every page is then opened and left to heal,
 * and the saved board is read. Nothing leaves the machine.
 *
 * It prints, per page and in total:
 *   · PARTS BY KIND, never only a total. A total was proposed and rejected
 *     because it would have missed the case that made us write this: with
 *     the capture's button half in and the old twin rule, eight wallet
 *     buttons were deleted and their eight bare wrappers kept. Parts read
 *     652 before and after; only buttons 109 → 101 and boxes up by 8 showed
 *     it. A total hides a substitution; a breakdown cannot.
 *   · duplicate-word buttons: a button whose words contain the words of a
 *     part it owns.
 *   · escapes: owned pairs where the part sticks out of its owner vertically,
 *     above + below > 0; the count and the worst.
 *   · gap: footer top minus the foot of the rail (the part whose path ends
 *     "> aside"); none on a page without a footer.
 * Ownership is the recorded path, never geometry: P owns C when C's
 * from.selector starts with P's, is longer, and the next character is a space
 * or ">" — the guard that stops div:nth-of-type(1) swallowing …(11).
 *
 * WHICH PAGES HAVE BEEN DRAWN IS AN INPUT, and it is printed with every run.
 * The healing runs when a page is opened, and it moves things: opening a
 * section page lets its header's inner box take in the price line, and the
 * logo's worst escape on that page drops from 63 to 43. A figure read off a
 * board without saying which pages had been rendered is not reproducible.
 * By default every page is opened, in order, before anything is read;
 * OPEN=none reads the board exactly as the import left it, which is what a
 * fresh import in a person's browser is until they visit each page.
 *
 *   npm run build && npx next start -p 3013
 *   node scripts/import-measure.mjs http://127.0.0.1:3013 <the capture folder>
 *   OPEN=none node scripts/import-measure.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
const OUT = process.argv[4] ?? null;
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node scripts/import-measure.mjs <builder url> <the capture folder>");
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
/* ------------------------------------------------------------------ */
/* Every page opened and left to heal                                   */
/* ------------------------------------------------------------------ */

const OPEN = (process.env.OPEN ?? "all").toLowerCase();
if (OPEN !== "all" && OPEN !== "none") { console.error("OPEN is all or none"); process.exit(2); }
/* The page the import itself left on screen has been rendered either way. */
const landedOn = (await state()).activePageId ?? null;
for (const p of OPEN === "all" ? doc.pages.map((p) => p.id) : []) {
  await page.evaluate((id) => { const raw = JSON.parse(localStorage.getItem("builder.studio")); raw.state.activePageId = id; localStorage.setItem("builder.studio", JSON.stringify(raw)); }, p);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
}
const all = (await state()).nodes ?? [];
await browser.close();

/* ------------------------------------------------------------------ */
/* The numbers                                                          */
/* ------------------------------------------------------------------ */

const sel = (n) => (n.from?.selector ?? "").trim();
const owns = (p, c) => { const a = sel(p), b = sel(c); return !!a && b.length > a.length && b.startsWith(a) && (b[a.length] === " " || b[a.length] === ">"); };
const words = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text ?? "").join("")).replace(/\s+/g, " ").trim();
const kinds = (list) => list.reduce((m, n) => ((m[n.featureId] = (m[n.featureId] ?? 0) + 1), m), {});
const KINDS = [...new Set([...doc.nodes, ...all].map((n) => n.featureId))].sort();
const kindLine = (k) => KINDS.map((f) => `${f} ${k[f] ?? 0}`).join(", ");

console.log(`sink ${SINK}`);
console.log(`pages rendered before reading: ${OPEN === "all" ? `all ${doc.pages.length}, each opened in turn` : `only ${landedOn ?? "?"}, where the import landed (OPEN=none)`}`);
console.log(`document ${doc.nodes.length} parts; board ${all.length} parts; page errors ${errors.length}${errors.length ? ` (${errors[0]})` : ""}\n`);
let tDup = 0, tEsc = 0, worstAll = 0;
for (const pg of doc.pages) {
  const on = all.filter((n) => n.pageId === pg.id);
  const dup = on.filter((b) => b.featureId === "cta-primary" && words(b.content)
    && on.some((k) => owns(b, k) && words(k.content) && words(b.content).includes(words(k.content))));
  let esc = 0, worst = 0;
  for (const P of on) for (const C of on) {
    if (!owns(P, C)) continue;
    const v = Math.max(0, P.y - C.y) + Math.max(0, (C.y + C.h) - (P.y + P.h));
    if (v > 0) { esc++; worst = Math.max(worst, v); }
  }
  const rail = on.find((n) => sel(n).endsWith("> aside"));
  const foot = on.find((n) => sel(n).endsWith("> footer"));
  const gap = rail && foot ? foot.y - (rail.y + rail.h) : "none (no footer)";
  console.log(`${pg.id}: parts ${on.length}; duplicate-word buttons ${dup.length}${dup.length ? ` (${dup.map((b) => b.id).join(" ")})` : ""}; escapes ${esc} (worst ${worst}); gap ${gap}`);
  console.log(`  by kind: ${kindLine(kinds(on))}`);
  tDup += dup.length; tEsc += esc; worstAll = Math.max(worstAll, worst);
}
const kd = kinds(doc.nodes), kb = kinds(all);
console.log(`\nTOTAL: parts ${all.length}; duplicate-word buttons ${tDup}; escapes ${tEsc} (worst ${worstAll})`);
console.log(`  by kind on the board:    ${kindLine(kb)}`);
console.log(`  by kind in the document: ${kindLine(kd)}`);
console.log(`  lost on import, by kind: ${KINDS.map((f) => `${f} ${(kd[f] ?? 0) - (kb[f] ?? 0)}`).join(", ")}`);
console.log(`  parts whose content is a list of runs, not a string: ${all.filter((n) => typeof n.content !== "string").length}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ errors, nodes: all }, null, 1));
