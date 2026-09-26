/**
 * Sink brought into an empty site through the real door (GitHub control →
 * Bring), with GitHub served from a sink checkout in the browser and a
 * placeholder token, exactly as scripts/import-measure.mjs does. Nothing
 * leaves the machine. Returns with the import landed and no reload made.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

export async function bringSink(BASE, SINK, viewport = { width: 1763, height: 1000 }) {
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [
    { path: "package.json", type: "blob", sha: "pkg", size: 10 },
    { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
    ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
  ];
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const page = await browser.newPage({ viewport });
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
  for (let i = 0; i < 90 && ((await state()).nodes?.length ?? 0) < 100; i++) await page.waitForTimeout(1000);
  return { browser, page, state, errors };
}
