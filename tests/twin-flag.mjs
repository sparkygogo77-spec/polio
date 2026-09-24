/**
 * THE PART THAT SURVIVES A TWIN KEEPS WHAT THE CAPTURE SAID ABOUT THEIR BOX.
 *
 * MEASURED: the grow step leaves a wrapper's out-of-flow contents out
 * (`owns.ts#inFlow`, keyed on `from.position`), and on sink's pages the flag
 * sits on the SOL WORKS badge's wrapper, not on the image inside it. The
 * duplicate pass removes that wrapper as the image's twin — same box. The
 * sweep only worked because the grow step reads the document as saved, before
 * the removal lands; run it over a document whose wrapper is already gone and
 * header > div grew 16/49 -> -11/112 and the header 0/82 -> -11/112 again.
 * That document is not hypothetical: it is any board after a sweep, and his
 * board published to sink and brought back in would be exactly it.
 *
 * So the survivor inherits the flag: two parts in one box share its
 * placement. This runs the grow step AFTER the twins are gone, through the
 * real door — bring the pages in (the sweep removes the wrapper), clear the
 * swept mark, reload, and let the sweep run a second time over the document
 * as it now stands. No expected number is written here: every one is the
 * fixture's own.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/twin-flag.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DOC = readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url));
const doc = JSON.parse(DOC.toString("utf8"));
const cap = (s) => doc.nodes.find((n) => n.pageId === "page_home" && n.from?.selector === s);
const header = cap("body > div > header"), hdiv = cap("body > div > header > div");
const wrapper = cap("body > div > header > div > div:nth-of-type(2)"), image = cap("body > div > header > div > div:nth-of-type(2) > img");
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
];

check("the fixture says what the capture said: the wrapper is out of the flow, the image inside it carries nothing of its own",
  wrapper?.from?.position === "absolute" && !image?.from?.position, `wrapper ${wrapper?.from?.position}, image ${image?.from?.position ?? "none"}`);

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const rest = u.pathname.startsWith("/repos/him/sink") ? u.pathname.slice("/repos/him/sink".length) : null;
  if (rest === null) return j({ message: "no" }, 404);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  return j({ message: "no" }, 404);
});
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const byId = (s, id) => (s.nodes ?? []).find((n) => n.id === id);

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
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
await page.locator("[data-repo-bring]").fill("him/sink");
await page.locator("[data-repo-pull]").click();
let s = {};
for (let i = 0; i < 60 && !(s.nodes ?? []).length; i++) { await page.waitForTimeout(1000); s = await state(); }
await page.waitForTimeout(2000);
s = await state();

/* The first sweep, as an import runs it. The fixture opens on a blank page, so home is never drawn or healed here. */
check("it lands on the blank page, so nothing below is the healing's", s.activePageId === "page_blank", s.activePageId);
check("the first sweep removes the wrapper as the image's twin", !byId(s, wrapper.id) && !!byId(s, image.id));
check("and the image that survives carries what the capture said about their box", byId(s, image.id)?.from?.position === wrapper.from.position,
  `image from.position ${byId(s, image.id)?.from?.position ?? "none"}`);
check("the first sweep leaves the header at its captured box", byId(s, header.id)?.y === header.y && byId(s, header.id)?.h === header.h,
  `${byId(s, header.id)?.y}/${byId(s, header.id)?.h}, captured ${header.y}/${header.h}`);

/* The second sweep, over the document as it now stands: no wrapper, only the image. */
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.studio")); delete raw.state.swept; localStorage.setItem("builder.studio", JSON.stringify(raw)); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const t = await state();
check("the sweep ran a second time, over a document with no wrapper in it", (t.swept ?? 0) > 0 && !byId(t, wrapper.id), `swept ${t.swept}`);
check("run after the twins are gone, the grow step still leaves header > div at its captured box",
  byId(t, hdiv.id)?.y === hdiv.y && byId(t, hdiv.id)?.h === hdiv.h, `${byId(t, hdiv.id)?.y}/${byId(t, hdiv.id)?.h}, captured ${hdiv.y}/${hdiv.h}`);
check("…and the header bar at its captured box",
  byId(t, header.id)?.y === header.y && byId(t, header.id)?.h === header.h, `${byId(t, header.id)?.y}/${byId(t, header.id)?.h}, captured ${header.y}/${header.h}`);
check("…and the badge still hangs outside its box, as captured", byId(t, image.id)?.y === image.y && byId(t, image.id)?.y < byId(t, hdiv.id)?.y,
  `image ${byId(t, image.id)?.y}, header > div ${byId(t, hdiv.id)?.y}`);
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
