/**
 * A CAPTURED SITE BROUGHT IN IS PUT RIGHT THE WAY AN OPENED BOARD IS.
 *
 * MEASURED, through the real door, with sink's own document.json: the sweep
 * never ran on an import. Opening an empty board marks it swept (nothing
 * captured on it), `loadDoc` kept that mark, and the imported document
 * arrived already "swept at 4". What ran instead were the two passes the
 * import called itself — the sentence joins and `fitWrappers` — so the grow
 * step, the duplicate pass and the repaint never reached a fresh import, and
 * the fit ran on geometry nothing had grown first. His tokens banner came out
 * at y 147 exactly as on his board.
 *
 * And the two orders are not interchangeable. With the mark cleared by hand
 * the sweep did run, over a document the import had ALREADY fitted: the rail
 * shrunk to the nav's own box, the duplicate pass read that as a twin and
 * deleted the nav — a deletion justified by a height this code chose, which
 * the sweep's own rule forbids. The sweep reads twins from the document as
 * saved; the import's early fit made "as saved" a lie.
 *
 * So the import hands the document to the sweep, whole, in the sweep's order,
 * and runs no pass of its own. This file holds that with a fixture at his
 * shape (not his document): a banner owning a logo that overhangs 11px above
 * it, a full-height rail holding a 440px nav whose entries fill it to its foot (as his eight do), the page's main and its footer.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/bring-sweeps.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, sel, extra = {}) => ({
  id, pageId: "page_home", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null,
  sketch: null, from: { url: "https://example.test/", host: "example.test", selector: sel, at: 1 }, byHand: false, ...extra,
});
const DOC = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("banner", "box", "", 0, 0, 1763, 82, "body > div > header"),
    node("logo", "prose", "LOGO", 826, -11, 112, 112, "body > div > header > div > span"),
    node("rail", "box", "", 0, 73, 256, 1281, "body > div > aside"),
    node("nav", "box", "", 0, 73, 255, 440, "body > div > aside > nav"),
    node("entry1", "prose", "Tokens", 16, 89, 223, 40, "body > div > aside > nav > span:nth-of-type(1)"),
    node("entry2", "prose", "Unknown", 16, 473, 223, 40, "body > div > aside > nav > span:nth-of-type(2)"),
    node("main", "box", "", 256, 73, 1507, 1281, "body > div > main"),
    node("words", "prose", "The page's own words, under the header.", 300, 120, 800, 40, "body > div > main > p"),
    node("footer", "box", "", 0, 1354, 1763, 73, "body > div > footer"),
    node("small", "prose", "Footer words", 40, 1374, 300, 30, "body > div > footer > p"),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Fixture", gimmick: "", master: "" },
  look: { palette: { bg: "rgb(16,21,26)" }, texture: [], target: "page" }, motion: [], frameWidth: 1763,
};
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: 4000 },
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const rest = u.pathname.startsWith("/repos/him/captured") ? u.pathname.slice("/repos/him/captured".length) : null;
  if (rest === null) return j({ message: "no" }, 404);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: Buffer.from(JSON.stringify(DOC)).toString("base64") });
  return j({ message: "no" }, 404);
});

/* An empty site, OPENED FIRST — that is what marks it swept, and it is the
   state Site 3 is in on his Builder. */
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const empty = await state();
check("the empty site, once opened, is marked swept — the state an import lands on", (empty.swept ?? 0) >= SWEEP, `swept ${empty.swept}`);

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
await page.locator("[data-repo-bring]").fill("him/captured");
await page.locator("[data-repo-pull]").click();
let s = empty;
for (let i = 0; i < 60 && !(s.nodes ?? []).length; i++) { await page.waitForTimeout(1000); s = await state(); }
await page.waitForTimeout(2500);
s = await state();
const byId = (st, id) => (st.nodes ?? []).find((n) => n.id === id);

check("the document landed", (s.nodes ?? []).length >= 9, `${(s.nodes ?? []).length} parts`);
const banner = byId(s, "banner");
check("the sweep ran on it: the banner is put back round the logo it owns (lifted to -11, grown to 112)", !!banner && banner.y === -11 && banner.h === 112, banner ? `y ${banner.y} h ${banner.h}` : "gone");
check("the nav is still on the board: no twin was made by a height this code chose", !!byId(s, "nav"), byId(s, "nav") ? `h ${byId(s, "nav").h}` : "deleted");
check("both entries are still on the board", !!byId(s, "entry1") && !!byId(s, "entry2"));
check("and the imported document is marked at these rules, so it is swept once and not again", (s.swept ?? 0) >= SWEEP, `swept ${s.swept}`);
const TOLD = /box(?:es)? put back round the parts (?:they own|it owns)/g;
let said = "";
for (let i = 0; i < 20 && !TOLD.test(said); i++) {
  TOLD.lastIndex = 0;
  if (i) await page.waitForTimeout(500);
  said = await page.evaluate(() => `${document.body.innerText} ${document.querySelector("[data-import-strip]")?.textContent ?? ""}`);
}
TOLD.lastIndex = 0;
const told = said.match(TOLD) ?? [];
check("and what the sweep did is said out loud, in the import's own line", told.length >= 1 && /copied whole/.test(said), told.length ? told[0] : `strip: ${await page.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "none")}`);
check("once: not a second time under \"put right when it opened\"", !/This board was put right when it opened/.test(said));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const again = await state();
check("a reload does not sweep it a second time: the same parts, the banner where it was", (again.nodes ?? []).length === (s.nodes ?? []).length && byId(again, "banner")?.y === banner?.y, `${(s.nodes ?? []).length} → ${(again.nodes ?? []).length} parts`);
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
