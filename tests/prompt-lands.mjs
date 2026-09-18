/**
 * What the prompt names reaches the page, or the Builder says which words did not.
 *
 * His oldest open complaint, and the first time it has been a number: on his
 * live board the audit badges named eighteen of his own strings across four
 * parts that his prompts ask for and the page does not carry. Some of those
 * eighteen are the same words counted twice.
 *
 * There are two separate faults under that, and this file holds both apart:
 *
 *   THE PART DROPS WHAT IT CANNOT FIT. A part with three slots given four
 *   lines draws three and says nothing about the fourth. `InvitePanel`
 *   reads loose[0], loose[1], loose[2]; `Cta` reads [0]. Everything after
 *   that is discarded in silence.
 *
 *   THE BADGE CANNOT SEE IT. The badge on the board compares the prompt
 *   against the *node* — its label, content, data and options — so a part
 *   holding four lines and drawing three is never accused of anything. The
 *   published page's audit reads the rendered text and would catch it; the
 *   board, where he is actually working, does not.
 *
 * And one instrument fault of the audit's own: a quoted run of capitals is
 * counted twice, once whole and once by the capital run inside it, so
 * "FOLLOW ON X ↗" becomes two missing strings rather than one.
 *
 *   node tests/prompt-lands.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { namedCopy, missingCopy } from "../src/features/studio/promised.ts";

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

/* ------------------------------------------------------------------ */
/* 1. The audit counts one string once                                 */
/* ------------------------------------------------------------------ */

const quoted = namedCopy('A pill reading "FOLLOW ON X ↗" at the foot.');
check(
  "a quoted run of capitals is one missing string, not two",
  quoted.length === 1,
  JSON.stringify(quoted),
);
const row = namedCopy('A meta row reading "● CHAIN 4663 · COMMUNITY OWNED · ZERO TAX".');
check(
  "and a quoted meta row is one string, not the row plus each of its parts",
  row.length === 1,
  JSON.stringify(row),
);
check(
  "capitals nobody quoted are still each their own string",
  namedCopy("The meta row reads CHAIN 4663 · COMMUNITY OWNED · ZERO TAX.").length === 3,
  JSON.stringify(namedCopy("The meta row reads CHAIN 4663 · COMMUNITY OWNED · ZERO TAX.")),
);

/* ------------------------------------------------------------------ */
/* 2. A part given more than it has room for                           */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/** One part of a named kind on the board, from a shelf drop so the node is whole. */
const drop = async (search, label) => {
  await page.locator('input[placeholder*="Search parts"]').first().fill(search);
  await page.waitForTimeout(800);
  const tile = page.getByText(label, { exact: true }).first();
  if (!(await tile.count())) return null;
  await tile.click({ force: true });
  await page.waitForTimeout(1100);
  return page.evaluate((l) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.label === l) ?? null, label);
};

const seed = await drop("invite", "Invitation panel");
check("there is an invite panel to put words into", !!seed, seed ? seed.featureId : "not in the shelf");

/* HIS WORDS, off his own board. Five lines into a panel with three slots. */
const HIS = ["community", "Stay in the", "loop.", "FOLLOW ON X ↗", "Not a trend."];
const PROMPT = 'An eyebrow reading "community", a heading reading "Stay in the" then "loop.", a button reading "FOLLOW ON X ↗", and a line reading "Not a trend."';

if (seed) {
  await page.evaluate(({ node, content, prompt }) => {
    const d = JSON.parse(localStorage.getItem("builder.studio"));
    d.state.nodes = [{ ...node, x: 200, y: 80, w: 900, h: 300, content, prompt }];
    d.state.selected = [];
    localStorage.setItem("builder.studio", JSON.stringify(d));
  }, { node: seed, content: HIS.join("\n"), prompt: PROMPT });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  const drawn = await page.evaluate(() => document.querySelector('[data-node-id] [data-part]')?.innerText ?? "");
  const lost = HIS.filter((w) => !drawn.replace(/\s+/g, " ").toLowerCase().includes(w.replace(/\s+/g, " ").toLowerCase()));
  check(
    "a part given more lines than it has room for still draws every one of them",
    lost.length === 0,
    lost.length ? `dropped: ${lost.join(" | ")}` : `all ${HIS.length} drawn`,
  );

  /* And whatever it does draw, the badge must be telling the truth about. */
  const badge = await page.evaluate(() => {
    const b = document.querySelector("[data-asked-for]");
    return b ? { n: Number(b.getAttribute("data-asked-for")), says: b.getAttribute("title") ?? "" } : null;
  });
  const reallyLost = missingCopy(PROMPT, drawn);
  check(
    "and the badge on the board counts what the page is missing, not what the node is missing",
    (badge?.n ?? 0) === reallyLost.length,
    `the badge says ${badge ? badge.n : 0}, the page is short ${reallyLost.length}${reallyLost.length ? `: ${reallyLost.join(" | ")}` : ""}`,
  );
  check(
    "a part that carries every word it was asked for wears no badge at all",
    reallyLost.length > 0 || badge === null,
    badge ? `a badge saying ${badge.n} on a part that is short nothing` : "no badge",
  );
}

/* ------------------------------------------------------------------ */
/* 3. A part that cannot grow says so, where he is working              */
/* ------------------------------------------------------------------ */

/*
 * The checks above are green because the panel now holds everything it is
 * given, which proves nothing about the badge: a badge that never fires
 * passes them all. So here is a part that genuinely cannot hold what it is
 * handed \u2014 a button has one label, and growing it into three would be a
 * worse answer than saying so. Two of the three words are not on the page,
 * and the Builder has to name them rather than let them go out quietly.
 */
const btn = await drop("button", "Main button");
check("there is a button to overfill", !!btn, btn ? btn.featureId : "not in the shelf");

if (btn) {
  const THREE = ["JOIN THE TRANSMISSION", "EXPLORE THE ORB \u2197", "CONNECT WALLET"];
  const ASK = `A button reading "${THREE[0]}", and beside it "${THREE[1]}" and "${THREE[2]}".`;
  await page.evaluate(({ node, content, prompt }) => {
    const d = JSON.parse(localStorage.getItem("builder.studio"));
    d.state.nodes = [{ ...node, x: 200, y: 80, w: 460, h: 120, content, prompt }];
    d.state.selected = [];
    localStorage.setItem("builder.studio", JSON.stringify(d));
  }, { node: btn, content: THREE.join("\n"), prompt: ASK });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const drawn = await page.evaluate(() => document.querySelector("[data-node-id] [data-part]")?.innerText ?? "");
  const short = missingCopy(ASK, drawn);
  const badge = await page.evaluate(() => {
    const b = document.querySelector("[data-asked-for]");
    return b ? { n: Number(b.getAttribute("data-asked-for")), says: b.getAttribute("title") ?? "" } : null;
  });
  check(
    "a button handed three labels draws one and keeps the other two off the page",
    short.length === 2,
    `the page shows ${JSON.stringify(drawn.trim())}, short ${short.length}: ${short.join(" | ")}`,
  );
  check(
    "and the Builder names both of them on the board, where he can still fix it",
    (badge?.n ?? 0) === short.length,
    badge ? `the badge says ${badge.n}: ${badge.says}` : "no badge at all \u2014 the words would have gone out in silence",
  );
  check(
    "the badge names the words themselves, not a count he has to go hunting for",
    !!badge && short.every((w) => badge.says.includes(w)),
    badge ? badge.says : "",
  );
}

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
