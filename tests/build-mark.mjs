/**
 * The app can say which build it is (inventory B14).
 *
 * `/api/version` answers the commit, the branch and when the build was
 * made, and nothing in the app read it; `version` in site.config had no
 * reader either; and the only visible "v0.N" was the ordinal of a pass on
 * the Updates panel, not a version. This holds the mark to where a person
 * looks:
 *
 *   · the route answers when it was built and either the commit or a plain
 *     sentence saying none was given;
 *   · the Builds page wears the mark: the site's version, the commit when
 *     there is one, and how old the build is;
 *   · so does the Updates panel, which is where "what changed" is asked.
 *
 *   node tests/build-mark.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const res = await fetch(`${URL_BASE}/api/version`);
const v = await res.json();
check("the version route answers", res.ok && typeof v === "object");
check("with when the build was made", typeof v.builtAt === "string" && !Number.isNaN(Date.parse(v.builtAt)), String(v.builtAt));
check("and the commit, or a plain sentence saying none was given", (typeof v.commit === "string" && v.short === v.commit.slice(0, 7)) || (v.commit === null && /not given a commit/.test(v.note ?? "")), v.short ?? v.note);
const expectCommit = typeof v.short === "string" ? v.short : null;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

await page.goto(`${URL_BASE}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const onBuilds = page.locator("[data-build-mark]").first();
check("the Builds page wears the build mark", (await onBuilds.count()) === 1);
const said = (await onBuilds.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
check("naming the site's version", /\bv\d+\.\d+/.test(said), said || "-");
check("and the commit, or that none was named", expectCommit ? said.includes(expectCommit) : /no commit/i.test(said), said || "-");
check("and how old the build is", /\b(just now|\d+\s?(s|m|h|d|min|hour|day)|ago|built)\b/i.test(said), said || "-");

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const updates = page.getByRole("button", { name: "Updates" }).first();
check("the Updates key is in the bar at this width", await updates.isVisible());
await updates.click();
await page.waitForTimeout(700);
const inPanel = page.locator("[data-updates-panel] [data-build-mark]").first();
check("the Updates panel wears the same mark", (await inPanel.count()) === 1 && (await inPanel.innerText()).replace(/\s+/g, " ").trim() === said, (await inPanel.innerText().catch(() => "")).replace(/\s+/g, " ").trim() || "-");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
