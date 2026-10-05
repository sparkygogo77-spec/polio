#!/usr/bin/env node
/**
 * PHASE 2 IN THE REAL BUILDER: WHAT A PUBLISH LEAVES FOR THE CODE CHAT, AND
 * WHAT COMES BACK FROM IT.
 *
 * THE OWNER'S GOAL: the builder handles what it can, a repo-connected code
 * chat builds the rest, and every feature made once is reused on later sites.
 *
 * Held, on sink's own document, in a real browser, with nothing leaving the
 * machine (GitHub is a stand-in in the page, the push is caught, no token):
 *   D) the push carries TASKS.md, the wallet chip's task under its stable id;
 *   E) …and AGENTS.md, CLAUDE.md and features/sol-price/ (manifest.json,
 *      script.js with siteFeatures.define, README.md), and nothing leaks;
 *   F) checking the site's repository (the owner's own) offers the folder a code chat
 *      added, on a review card with its manifest, its script and a diff; the
 *      script is never run in the builder; accepted, it joins the shelf with
 *      the wallet chip as its picture, goes onto that chip (its ! goes), and
 *      ships in the export, where the published page does run it; it is
 *      still on the shelf on another site; a repository that is not theirs is
 *      refused and offers nothing.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/round-trip.mjs http://127.0.0.1:3013 <the capture folder> [screenshot dir]
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { gunzipSync } from "node:zlib";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const SINK = process.argv[3] ?? "capture/versions/sink-0ee06fa";
const SHOTS = process.argv[4] ?? null;
if (!existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/round-trip.mjs <builder url> <the capture folder> [screenshot dir]");
  process.exit(2);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
const words = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));
const home = doc.nodes.filter((n) => n.pageId === "page_home");
/* The price, found by its shape in the header, not its value: it moves between captures ($116.59 on 2026-09-22, $118.00 on 2026-09-30). */
const PRICE = home.find((n) => /^body > div > header\b/.test(n.from?.selector ?? "") && /^\$[\d,]+\.\d+$/.test(words(n)));
const WALLET = home.find((n) => words(n) === "kgER...9oP7");
const TASK = "show the latest transaction hashes from the connected wallet";
for (const n of doc.nodes) {
  if (n.id === PRICE.id) n.work = { id: "sol-price", inputs: {} };
  if (n.id === WALLET.id) n.task = TASK;
}
const OWNER = "sparkygogo77-spec";
const SITE_REPO = `${OWNER}/solcinerator`;

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
/* Every part's ! on the board, as the top bar's count shows them (`decideShown.ts`): by default only the picked part wears one. */
await page.addInitScript(() => localStorage.setItem("builder.decideBadges.v1", "all"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

/* ------------------------------------------------------ the stand-ins */
let pushed = null;
await page.route("**/api/studio/**", async (r) => {
  const url = r.request().url();
  if (url.includes("/api/studio/publish") && r.request().method() === "POST") {
    pushed = JSON.parse(r.request().postData() ?? "{}");
    /* Text goes packed (`publish()` in agent.ts): read what the route will commit. */
    pushed.files = (pushed.files ?? []).map((f) => (f.encoding === "gzip" ? { path: f.path, content: gunzipSync(Buffer.from(f.content, "base64")).toString("utf8") } : f));
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sha: "0", commitUrl: "https://example.invalid/c", branch: "main", repo: SITE_REPO, files: pushed.files?.length ?? 0, deployed: false, hook: false }) });
  }
  if (url.includes("/api/studio/publish")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: true, token: "browser", repo: SITE_REPO, branch: "main", missing: [], allow: null }, vercel: { hook: false } }) });
  return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
/** The repository as GitHub will answer for it: set once the push is caught, then a code chat's folder is added. */
const repoFiles = new Map();
const ghCalls = [];
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  ghCalls.push(`${r.request().method()} ${u.pathname}`);
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(b) });
  if (r.request().method() !== "GET") return j({ message: "the stand-in only reads" }, 405);
  if (u.pathname === "/user") return j({ login: OWNER });
  const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!m) return j({ message: "Not Found" }, 404);
  const [, owner, name, rest = ""] = m;
  if (!rest) return j({ default_branch: "main", owner: { login: owner }, full_name: `${owner}/${name}` });
  if (rest.startsWith("/git/trees/")) return j({ tree: [...repoFiles.keys()].map((p, i) => ({ path: p, type: "blob", sha: `s${i}`, size: repoFiles.get(p).length })) });
  const blob = rest.match(/^\/git\/blobs\/s(\d+)$/);
  if (blob) {
    const p = [...repoFiles.keys()][Number(blob[1])];
    return p ? j({ encoding: "base64", content: Buffer.from(repoFiles.get(p), "utf8").toString("base64") }) : j({ message: "Not Found" }, 404);
  }
  return j({ message: "Not Found" }, 404);
});
await page.route(/^https:\/\/(?!fonts\.)(?!api\.github\.com)/, (r) => r.fulfill({ status: 404, body: "" }));

const project = (repo) => ({ projects: [{ id: "s3", name: "Solcinerator", updatedAt: Date.now(), ...(repo ? { repo: { owner: repo.split("/")[0], name: repo.split("/")[1], branch: "main" }, bound: "connected" } : {}) }], activeId: "s3" });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(({ state, builds }) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.removeItem("builder.library");
  localStorage.setItem("builder.builds", env(builds));
  localStorage.setItem("builder.studio", env({ ...state, activePageId: "page_home" }));
}, { state: doc, builds: project(SITE_REPO) });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
/* A placeholder in the Keys panel, as tests/fixtures/bring-sink.mjs does: the stand-in GitHub takes it, nothing real is sent. */
{
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
}
const node = (id) => page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id) ?? null, id);

/* ------------------------------------------------ D and E: the push */
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Push to GitHub/ }).first().click({ timeout: 15000 }).catch(() => {});
for (let i = 0; i < 120 && !pushed; i++) await page.waitForTimeout(500);
const files = new Map((pushed?.files ?? []).map((f) => [f.path, f.content]));
check("Push to GitHub sent the site", files.has("index.html"), `${files.size} files`);
const tasks = files.get("TASKS.md") ?? "";
check("D) the push carries TASKS.md", !!tasks);
check("…with the wallet chip's task under its stable id", tasks.includes(`\`${WALLET.id}\``) && tasks.includes(TASK));
check("…the page it is on, and how to find it there", tasks.includes("Creator Hub") && tasks.includes(`document.getElementById("${WALLET.id}")`));
for (const p of ["AGENTS.md", "CLAUDE.md", "features/sol-price/manifest.json", "features/sol-price/script.js", "features/sol-price/README.md"]) {
  check(`E) the push carries ${p}`, files.has(p));
}
let manifest = null;
try { manifest = JSON.parse(files.get("features/sol-price/manifest.json") ?? ""); } catch { /* checked below */ }
check("…its manifest names the part it is on", JSON.stringify(manifest?.parts) === JSON.stringify([PRICE.id]), JSON.stringify(manifest?.parts));
check("…its script is written to the contract", (files.get("features/sol-price/script.js") ?? "").includes('siteFeatures.define("sol-price"'));
check("…and AGENTS.md says how a feature is shaped", /features\/<name>\//.test(files.get("AGENTS.md") ?? "") && /siteFeatures\.define/.test(files.get("AGENTS.md") ?? ""));
const leaks = [...files.entries()].filter(([p, c]) => /\.(md|json|js)$/.test(p) && p !== "site/document.json" && typeof c === "string" && (/Captured from/.test(c) || c.includes(PRICE.from?.selector ?? "@@") || c.includes("ccc-woad")));
check("…and none of them carries the capture or a prompt", leaks.length === 0, leaks.map(([p]) => p).join(", "));

/* ------------------------------------------------ F: the round trip */
for (const [p, c] of files) if (typeof c === "string" && !p.startsWith("assets/")) repoFiles.set(p, c);
const NEW_SCRIPT = `siteFeatures.define("wallet-activity", function (el, inputs, api) {
  window.__walletActivityRan = (window.__walletActivityRan || 0) + 1;
  api.set(el, "3G8S...EGjn");
});
`;
repoFiles.set("features/wallet-activity/manifest.json", JSON.stringify({
  id: "wallet-activity", name: "Wallet activity", category: "data", blurb: "The latest transaction hashes of the connected wallet.",
  inputs: [{ id: "count", label: "How many", kind: "number", default: "3" }], needs: "wallet",
  says: ["latest transactions", "transaction hashes"], look: { sample: "3G8S...EGjn" }, version: 1, parts: [WALLET.id],
}, null, 2));
repoFiles.set("features/wallet-activity/script.js", NEW_SCRIPT);
repoFiles.set("features/wallet-activity/README.md", "# Wallet activity\n\nShows the latest transaction hashes.\n");

await page.keyboard.press("Escape");
await page.waitForTimeout(500);
/* The shelf's Data category, where the working features are. */
async function openData() {
  if (await page.locator('[data-category-open="data"]').count()) return;
  await page.getByRole("button", { name: /^Data$/ }).first().click().catch(() => {});
  await page.waitForTimeout(700);
}
await openData();
const checkBtn = page.locator("[data-check-repo-features]");
check("the shelf offers to check the site's repository for features", await checkBtn.count() === 1, await checkBtn.first().textContent().catch(() => "none"));
await checkBtn.first().click().catch(() => {});
await page.waitForTimeout(2000);
check("it read the repository through GitHub, by reading only", ghCalls.some((c) => c.includes(`/repos/${SITE_REPO}/git/trees/`)) && ghCalls.every((c) => c.startsWith("GET")));
const card = page.locator('[data-offer="wallet-activity"]');
check("the folder the code chat added is offered on a review card", await card.count() === 1);
check("…as new", (await card.getAttribute("data-offer-status").catch(() => null)) === "new");
check("…with its manifest", /"needs": "wallet"/.test(await card.locator("[data-offer-manifest]").textContent().catch(() => "") ?? ""));
check("…its script", (await card.locator("[data-offer-script]").textContent().catch(() => "") ?? "").includes('siteFeatures.define("wallet-activity"'));
check("…and a diff", await card.locator("[data-offer-diff] [data-diff-op='+']").count() > 3);
check("…saying what it needs", /wallet/i.test(await card.locator("[data-offer-needs]").textContent().catch(() => "") ?? ""));
check("the feature the builder published and nobody changed is not offered", await page.locator('[data-offer="sol-price"]').count() === 0);
check("the script was never run in the builder", await page.evaluate(() => window.__walletActivityRan === undefined));
if (SHOTS) await page.screenshot({ path: join(SHOTS, "6-review-card.png") });

await card.locator("[data-offer-accept]").click().catch(() => {});
await page.waitForTimeout(1200);
check("accepted, the card is gone", await page.locator('[data-offer="wallet-activity"]').count() === 0);
check("…the script still never ran here", await page.evaluate(() => window.__walletActivityRan === undefined));
const lib = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.library") || "{}").state?.accepted ?? []);
check("…it is in the library, held as text", lib.some((w) => w.manifest?.id === "wallet-activity" && w.script === `siteFeatures.define("wallet-activity", function (el, inputs, api) {\n  window.__walletActivityRan = (window.__walletActivityRan || 0) + 1;\n  api.set(el, "3G8S...EGjn");\n});\n`));
check("…with where it came from", lib.find((w) => w.manifest?.id === "wallet-activity")?.from === SITE_REPO);
let w = await node(WALLET.id);
check("…and it went onto the part it was built for", w?.work?.id === "wallet-activity", JSON.stringify(w?.work));
check("…whose ! is gone", await page.locator(`[data-decide-for="${WALLET.id}"]`).count() === 0);
await openData();
const shelf = page.locator('[data-work-card="wallet-activity"]');
check("it is on the shelf", await shelf.count() === 1);
check("…with the wallet chip as its picture", (await shelf.locator("[data-work-picture]").count()) === 1 && /kgER\.\.\.9oP7/.test(await shelf.textContent().catch(() => "") ?? ""), await shelf.textContent().catch(() => ""));
if (SHOTS && await shelf.count()) { await shelf.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(SHOTS, "7-accepted-on-shelf.png") }); }

/* The export ships it, and the published page runs it. */
const out = await page.evaluate(async () => (await window.__studioExport()).filter((f) => typeof f.content === "string").map((f) => ({ path: f.path, content: f.content })));
const byPath = new Map(out.map((f) => [f.path, f.content]));
check("the export ships its script", (byPath.get("assets/features/wallet-activity.js") ?? "").includes("__walletActivityRan"));
const site = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
await site.route("http://site.test/**", (r) => {
  const p = new URL(r.request().url()).pathname.replace(/^\//, "") || "index.html";
  const body = byPath.get(p);
  if (body == null) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "text/html", body });
});
await site.route(/^https:\/\//, (r) => r.fulfill({ status: 404, body: "" }));
await site.goto("http://site.test/index.html", { waitUntil: "load" });
await site.waitForTimeout(1000);
const ran = await site.evaluate((id) => ({ ran: window.__walletActivityRan ?? 0, text: document.getElementById(id)?.textContent?.trim() }), WALLET.id);
check("the published page runs it, in the chip's own element", ran.ran === 1 && ran.text === "3G8S...EGjn", JSON.stringify(ran));
await site.close();

/* Reusable on any site. */
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s4", name: "Another site", updatedAt: Date.now() }], activeId: "s4" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await openData();
check("on another site it is still on the shelf", await page.locator('[data-work-card="wallet-activity"]').count() === 1);
check("…and no offers are left over from the last site", await page.locator("[data-offer]").count() === 0);

/* Only the owner's own repositories. */
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s5", name: "Theirs", updatedAt: Date.now(), repo: { owner: "someone-else", name: "their-site", branch: "main" }, bound: "connected" }], activeId: "s5" }));
});
repoFiles.set("features/sneaky/manifest.json", JSON.stringify({ id: "sneaky", name: "Sneaky", category: "data", inputs: [], needs: "none", says: [], look: { sample: "x" }, version: 1 }));
repoFiles.set("features/sneaky/script.js", 'siteFeatures.define("sneaky", function(){});');
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);
await openData();
const before = ghCalls.length;
await page.locator("[data-check-repo-features]").first().click().catch(() => {});
await page.waitForTimeout(1500);
check("a repository that is not the owner's offers nothing", await page.locator("[data-offer]").count() === 0);
check("…and says why", /your own repositories/i.test(await page.locator("[data-repo-features-says]").first().textContent().catch(() => "") ?? ""), await page.locator("[data-repo-features-says]").first().textContent().catch(() => "none"));
check("…without reading its files", !ghCalls.slice(before).some((c) => c.includes("/git/")), ghCalls.slice(before).join(", "));

check("the Builder raised no error", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
