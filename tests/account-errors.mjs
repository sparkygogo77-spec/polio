#!/usr/bin/env node
/**
 * ACCOUNT FAILURES SAY WHY.
 *
 * J (2026-10-21): the Blob store was suspended and every save answered 500;
 * the Account page said only "The server answered 500." Now a failing store
 * is turned into a short reason and, where there is something to do, one
 * line on what (`src/app/api/account/explain.ts`), and the page shows both.
 *
 *   1. what stores throw (Blob suspended or full, a bad Blob token, the
 *      network, GitHub's rate limit, a key without permission) each get their
 *      own reason, a fitting status, and nothing of the error's own text;
 *   2. the page shows the reason and the line on what to do, never
 *      "The server answered …", for a reason the server sends and for a
 *      crash page that says nothing;
 *   3. against a real server whose store cannot be written (the account
 *      folder is a file), the page says the store did not answer.
 *
 * Part 3 needs the server started with the account "folder" being a file:
 *
 *   echo x > /tmp/polio-account-broken
 *   POLIO_OWNER_KEY=STANDIN_owner_key_for_tests_only_0123456789 POLIO_ACCOUNT_DIR=/tmp/polio-account-broken npx next start -p 3022
 *   node tests/account-errors.mjs http://127.0.0.1:3022
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { bodyOf, explain } from "../src/app/api/account/explain.ts";
import { githubBackend } from "../src/app/api/account/github.ts";
const { chromium } = createRequire(import.meta.url)("playwright-core");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const BASE = process.argv[2] ?? "http://127.0.0.1:3022";
const OWNER = "STANDIN_owner_key_for_tests_only_0123456789";
const TOKEN = "ghp_00000000000000000000000000000000TEST";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";

// 1. what stores throw
const said = (err) => explain(err);
const suspended = said(new Error("Vercel Blob: This store has been suspended."));
check("a suspended Blob store is said to be suspended, with what to do", suspended.status === 503 && /suspended/.test(suspended.says) && /GitHub key/.test(suspended.todo ?? ""), JSON.stringify(suspended));
const full = said(new Error("Vercel Blob: Storage limit exceeded."));
check("a full Blob store is said to be over its limit (507)", full.status === 507 && /limit/.test(full.says), JSON.stringify(full));
const token = said(new Error("Vercel Blob: No token found. Either configure the `BLOB_READ_WRITE_TOKEN` environment variable"));
check("a Blob token the store refuses is said so", token.code === "store-key", JSON.stringify(token));
check("a missing item is a 404", said(new Error("ENOENT: no such file or directory, open '/x/y'")).status === 404);
check("the network failing is a 502", said(new TypeError("fetch failed")).status === 502);
check("anything else is the store not answering (503)", said(new Error("kaboom")).status === 503 && said("not even an Error").status === 503);

const secret = said(new Error(`Vercel Blob: suspended ${TOKEN} at https://x.public.blob.vercel-storage.com/ secret`));
check("nothing of the error's own text is sent: no token, no URL, no stack", !JSON.stringify(bodyOf(secret)).match(/ghp_|https?:|blob\.vercel|\bat \b|secret/), JSON.stringify(bodyOf(secret)));

const limited = async (headers, status) => {
  const gh = githubBackend({ token: TOKEN, repo: "STANDIN-owner/polio-saves", fetch: async () => new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status, headers }) });
  try { await gh.write("data/prefs.json", new Uint8Array([123, 125]), "application/json"); } catch (e) { return explain(e); }
  return null;
};
const rate = await limited({ "x-ratelimit-remaining": "0" }, 403);
check("GitHub's rate limit is a 429 that says wait, not a permissions problem", rate?.status === 429 && /Wait/.test(rate.todo ?? "") && !/Contents/.test(rate.todo ?? ""), JSON.stringify(rate));
const noPerm = await limited({}, 403);
check("a key without permission is a 403 that names what to give it", noPerm?.status === 403 && /Contents/.test(noPerm.todo ?? "") && /polio-saves/.test(noPerm.says), JSON.stringify(noPerm));
const bad = await limited({}, 401);
check("an expired GitHub key is a 401 that says to put a fresh one in Keys", bad?.status === 401 && /Keys/.test(bad.todo ?? ""), JSON.stringify(bad));
const down = await limited({}, 500);
check("GitHub failing is a 502", down?.status === 502, JSON.stringify(down));

// 2 and 3. the page
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const done = async () => {
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

/** Sign in on a fresh page, with the data route answering as given (or as the server really does), and say what the page shows. */
async function pageSays(answer) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (answer) await page.route("**/api/account/data**", (route) => route.fulfill(answer));
  await page.goto(`${BASE}/account`, { waitUntil: "load" });
  await page.waitForFunction(() => !/Checking the server/.test(document.querySelector('[data-account="setup"]')?.textContent ?? "Checking"), null, { timeout: 60000 });
  await page.fill('[data-account="key-input"]', OWNER);
  await page.click('[data-account="sign-in-button"]');
  await page.waitForSelector('[data-account="signed-in"]', { timeout: 15000 });
  await page.waitForFunction(() => /\S/.test(document.querySelector('[data-account="says"]')?.textContent ?? "") && !/Copying this browser/.test(document.querySelector('[data-account="says"]')?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
  const text = (await page.textContent('[data-account="says"]').catch(() => "")) ?? "";
  await ctx.close();
  return text;
}
const sent = (r) => ({ status: r.status, contentType: "application/json", body: JSON.stringify(bodyOf(r)) });

const onPage = await pageSays(sent(suspended));
check("the page shows the reason and what to do when the store is suspended", onPage.includes(suspended.says) && onPage.includes(suspended.todo), onPage);
const onRate = await pageSays(sent(rate));
check("the page shows GitHub's rate limit and to wait", onRate.includes(rate.says) && onRate.includes(rate.todo), onRate);
const onCrash = await pageSays({ status: 500, contentType: "text/html", body: "<h1>Internal Server Error</h1>" });
check("a crash page that says nothing is still not reported as a bare status", !/answered 500/.test(onCrash) && /did not say why/.test(onCrash), onCrash);

const real = await pageSays(null);
check("against a store that cannot be written, the page says the store did not answer", /store did not answer/.test(real) && /Try again/.test(real) && !/answered/.test(real), real);

await done();
