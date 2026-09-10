/**
 * The key, held for the tab with no PIN.
 *
 * The PIN pad needs Web Crypto, which browsers only give to https and
 * localhost, and it was refusing everyone on an embedded browser at a plain
 * http address. The other way in must therefore work with no pad at all:
 * skip the PIN, hold the key for this tab, save it, reload, find it again;
 * the key lives in sessionStorage and never in localStorage; Forget drops
 * it; and the test route says honestly that a key was offered. Then the same
 * again with Web Crypto taken away, which is the case that started this.
 *
 *   node tests/keys-hold.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const SECRET = "sk-ant-test-do-not-use-9876543210";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true });

async function run(label, { noCrypto }) {
  console.log(`\n${label}`);
  const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  if (noCrypto) await context.addInitScript(() => { Object.defineProperty(globalThis.crypto, "subtle", { value: undefined, configurable: true }); });
  const page = await context.newPage();
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  const panel = page.locator("[data-keys-panel]");
  const openPanel = async () => {
    if ((await panel.getAttribute("data-open")) !== "1") await page.getByRole("button", { name: "Keys", exact: true }).click();
    await page.waitForTimeout(400);
  };

  await openPanel();
  if (noCrypto) {
    check("without Web Crypto the pad is not offered", (await panel.getByText("Choose a four-digit PIN").count()) === 0);
    check("it says why, and what to do instead", await panel.getByText("will not do cryptography").isVisible());
  } else {
    check("the pad is offered", await panel.getByText("Choose a four-digit PIN").isVisible());
  }
  const holdName = noCrypto ? "Hold the key for this tab" : /Skip the PIN/;
  await panel.getByRole("button", { name: holdName }).click();
  await page.waitForTimeout(300);
  check("holding opens the panel with no PIN", await panel.getByText("Hold in this tab").isVisible());
  // Two secrets can be held here — Claude's key and Vercel's token — because
  // those are the two the routes take as a header. GitHub's cannot be used
  // from a browser at all, so it is a note and never a field.
  check("the two headers a browser can carry are fields, and GitHub is a note",
    (await panel.locator('input[type="password"]').count()) === 2
    && (await panel.getByText("Only on the server").isVisible())
    && (await panel.locator("section").filter({ hasText: "Only on the server" }).getByText("GitHub").count()) > 0);

  await panel.locator('input[type="password"]').first().fill(SECRET);
  await panel.getByRole("button", { name: "Hold in this tab" }).click();
  await page.waitForTimeout(500);
  check("the key is held", await panel.getByText("saved").isVisible().catch(() => false));
  check("it is in sessionStorage, for this tab", (await page.evaluate(() => sessionStorage.getItem("builder.keys.session") ?? "")).includes(SECRET));
  check("and never in localStorage", await page.evaluate((s) => {
    for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) ?? "").includes(s)) return false;
    return true;
  }, SECRET));

  // The test route sees the held key. There is no real key in a test, so the
  // honest answer is that Anthropic rejected it — which proves it was sent.
  const claude = panel.locator("section").first();
  await claude.getByRole("button", { name: "Try it" }).click();
  await page.waitForTimeout(6000);
  const verdict = await claude.locator("span.text-down, span.text-up").last().textContent().catch(() => "");
  check("Try it sends the held key and reports what came back", /rejected|works|could not reach|failed/i.test(verdict ?? ""), (verdict ?? "").trim());

  // Each service is asked its own question, and one answer never stands in
  // for another: trying Vercel with no token must not colour Claude's line.
  const vercel = panel.locator("section").nth(1);
  check("Vercel has nothing to try until there is a token", !(await vercel.getByRole("button", { name: "Try it" }).isEnabled()));
  await vercel.locator('input[type="password"]').fill("vercel_test_do_not_use_9876543210");
  await vercel.getByRole("button", { name: "Try it" }).click();
  await page.waitForTimeout(6000);
  const vercelSaid = await vercel.locator("span.text-down, span.text-up").last().textContent().catch(() => "");
  check("Vercel is tried on its own and answers for itself",
    /vercel|token|reject|works|reach/i.test(vercelSaid ?? "") && !/anthropic|claude/i.test(vercelSaid ?? ""),
    (vercelSaid ?? "").trim());
  check("Claude's answer is still Claude's", /rejected|works|could not reach|failed/i.test((await claude.locator("span.text-down, span.text-up").last().textContent().catch(() => "")) ?? ""));

  await page.reload({ waitUntil: "networkidle" });
  await openPanel();
  check("a reload keeps it", (await panel.locator('input[type="password"]').first().inputValue().catch(() => "")) === SECRET);

  await panel.getByRole("button", { name: "Forget", exact: true }).click();
  await page.waitForTimeout(300);
  check("Forget drops it", (await page.evaluate(() => sessionStorage.getItem("builder.keys.session"))) === null);
  check("and the way in is offered again", await panel.getByRole("button", { name: holdName }).isVisible());
  await context.close();
}

await run("With Web Crypto", { noCrypto: false });
await run("Without Web Crypto (a plain http address)", { noCrypto: true });

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
