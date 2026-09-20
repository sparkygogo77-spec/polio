/**
 * A button that points nowhere offers the two ways to make it do something.
 *
 * HIS WORDS: "a drawn button if not linked to something should offer options
 * of a web link, prompt for backend to fill in, like a button i draw, I can
 * title it 'buy' and then i say 'swap route aggregator through jupiter or
 * specific exchange or platform via trading wallet' and it builds the backend
 * required to make it work where this exact button is."
 *
 * So an unlinked button offers both, in one place, and neither is hidden
 * behind knowing the other exists: send people somewhere, or say what it
 * should DO and have the backend built for it, sited at that button. The
 * saying-what-it-does half lands on the part itself, which is where the
 * backend surface reads it from — his instruction is not a note, it is the
 * work.
 *
 *   node tests/button-unlinked.mjs [url]
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

/* A button he drew: the pen, with Button chosen before the line. */
await page.locator('input[placeholder*="Search parts"]').first().fill("main button");
await page.waitForTimeout(700);
await page.getByText("Main button", { exact: true }).first().click({ force: true });
await page.waitForTimeout(1300);

const node = () => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? [])[0] ?? null);
const n0 = await node();
check("there is a button on the board", !!n0, n0?.featureId ?? "none");
check("and it points nowhere yet", !n0?.link, JSON.stringify(n0?.link ?? null));

/* Its own panel, at the Link mark. */
await page.locator('[aria-label="Side panel"] button', { hasText: /Element/i }).first().click({ force: true });
await page.waitForTimeout(600);
await page.locator("#link, [data-mark='link'], [id='link']").first().click({ force: true }).catch(() => {});
await page.waitForTimeout(600);

const offers = await page.evaluate(() => ({
  link: document.querySelectorAll("[data-link-field]").length,
  work: document.querySelectorAll("[data-backend-ask]").length,
}));
check("a button that points nowhere offers a web link", offers.link === 1, `${offers.link}`);
check("…and, beside it, a way to say what it should do", offers.work === 1, `${offers.work}`);

/* His own example, typed in. */
const SAY = "swap route aggregator through jupiter or specific exchange or platform via trading wallet";
await page.locator("[data-backend-ask]").first().fill(SAY);
await page.waitForTimeout(700);
const n1 = await node();
check("what he says it should do is kept on that button", (n1?.data ?? "").includes("jupiter"),
  `${(n1?.data ?? "").slice(0, 52)}${(n1?.data ?? "").length > 52 ? "…" : ""}`);
check("…and it did not quietly become a link instead", !n1?.link, JSON.stringify(n1?.link ?? null));

/*
 * AND IT REACHES WHAT THE BACKEND WORKS FROM.
 *
 * The backend surface is a conversation with the model, not a list of parts,
 * so looking for his words in its own markup was looking in the wrong place —
 * my first attempt did, and failed for that reason rather than because the
 * wiring was missing. What the backend works from is the compiled brief, and
 * the brief lists every part that carries a `data` line as something it must
 * provide. That is where this has to show up, and the book is where the brief
 * is shown.
 */
await page.locator('[aria-label^="Finish"]').first().click({ force: true });
await page.waitForTimeout(1800);
const book = page.locator("[data-timeline-detail] button", { hasText: /book/i }).first();
if (await book.count()) { await book.click({ force: true }); await page.waitForTimeout(1200); }
const reaches = await page.evaluate(() => document.body.innerText.toLowerCase().includes("jupiter"));
check("and it reaches the brief the backend builds from", reaches, reaches ? "his words are in the compiled brief" : "not in it");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
