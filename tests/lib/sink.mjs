/**
 * A captured site brought in through the GitHub door, with GitHub answered from the capture on disk.
 *
 * A folder with `site/document.json` (and `assets/pictures/`) stands in for the
 * `sparkygogo77-spec/sink` repository: the page's requests to api.github.com
 * are answered from it, the Keys panel is given a placeholder token, and the
 * door is pressed. Nothing is fetched. The same door as a person uses, so
 * what arrives is what the Builder takes in (`docTake.ts`).
 *
 *   import { importSink } from "./lib/sink.mjs";
 *   await importSink(page, BASE, "capture/sites/trendtrader-pro");
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export async function importSink(page, BASE, SINK, { atLeast = 50, settle = 8000 } = {}) {
  const DOC = readFileSync(join(SINK, "site/document.json"));
  const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
  const REPO = "/repos/sparkygogo77-spec/sink";
  const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }, ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 }))];
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
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
    localStorage.setItem("builder.studio", env({ nodes: [] }));
  });
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(500);
  await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
  await page.locator("[data-repo-pull]").click(); await page.waitForTimeout(300);
  if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
  const count = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
  for (let i = 0; i < 180 && (await count()) < atLeast; i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(settle);
  return count();
}

/** The parts of the capture on disk, by id. */
export function captureParts(SINK) {
  const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  return new Map(doc.nodes.map((n) => [n.id, n]));
}
