/**
 * A bad answer from a status route must not take the Builder with it.
 *
 * `publishStatus()` casts whatever comes back to `PublishStatus`, and the
 * GitHub button then reads `status.github.repo`. The optional chain is on
 * `status`, not on `status.github` — so a reply that is valid JSON of the
 * wrong shape (`{}`, an error envelope, a proxy's own page) gets past the
 * cast, throws inside render, and React unmounts the whole tree. A missing
 * repository is a normal state; it should read as "no repository yet", not
 * as a blank Builder.
 *
 * Each case replaces the route's answer and then asks the only question that
 * matters: is the Builder still there.
 *
 *   node tests/bar-survives.mjs [url]
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

/** Every shape a route can answer with that is not what the caller expects. */
const JUNK = [
  ["an empty object", "{}"],
  ["an error envelope", '{"error":"upstream is down"}'],
  ["github present but empty", '{"github":{}}'],
  ["github as null", '{"github":null,"vercel":null}'],
  ["a bare string", '"nope"'],
  ["null", "null"],
  ["an array", "[1,2,3]"],
];

for (const [what, body] of JUNK) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const blew = [];
  page.on("pageerror", (e) => blew.push(String(e.message).slice(0, 90)));
  await page.route("**/api/studio/publish", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 200, contentType: "application/json", body })
      : route.continue());
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);

  const standing = await page.evaluate(() => {
    const bar = document.querySelector("[data-studio-bar]");
    const root = document.querySelector("[data-studio-root]");
    return {
      bar: !!bar && bar.getBoundingClientRect().width > 100,
      root: !!root,
      // A React tree that unmounted leaves the shell all but empty.
      buttons: document.querySelectorAll("button").length,
      button: !!document.querySelector("[data-github-button]"),
      repo: document.querySelector("[data-github-button]")?.getAttribute("data-repo") ?? null,
    };
  });
  check(
    `${what}: the Builder is still standing`,
    standing.bar && standing.root && standing.buttons > 10,
    `${standing.buttons} buttons, bar ${standing.bar ? "there" : "gone"}, board ${standing.root ? "there" : "gone"}`,
  );
  check(`${what}: and it threw nothing`, blew.length === 0, blew[0] ?? "no page error");
  /*
   * The button itself degraded, rather than the boundary having eaten it.
   *
   * Without this the suite passes either way, and "the Builder is standing"
   * would be true of a Builder with the GitHub button silently dropped —
   * which is the boundary doing its job to cover a fix that did not work.
   * A malformed reply is a Builder that cannot publish yet, and the control
   * has to still be there saying so.
   */
  check(
    `${what}: the GitHub button degraded rather than being dropped`,
    standing.button && standing.repo === "",
    standing.button ? `still there, attached to ${JSON.stringify(standing.repo)}` : "gone — the boundary caught it, so the guard clause did not hold",
  );
  await page.close();
}

await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
