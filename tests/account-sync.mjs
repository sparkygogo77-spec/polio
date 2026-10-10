#!/usr/bin/env node
/**
 * ACCOUNT KEYS, END TO END: SIGN IN, MAKE A KEY, OPEN THE WORK IN ANOTHER BROWSER.
 *
 * J (2026-10-10): his owner key (a Vercel setting) makes keys from the
 * Account page; boards are saved to the account and readable from any
 * browser; the first sign-in copies this browser's work in; nothing is
 * erased; published sites are never locked. Walked here with a real build,
 * the account kept in a folder instead of Vercel Blob:
 *
 *   1. with no key the Builder and Builds open as before, and the account's
 *      routes say no without a key or with a wrong one;
 *   2. browser A signs in with the owner key: its site is copied into the
 *      account, and the owner makes a key, shown once;
 *   3. the made key reads saved work but cannot list or make keys, and
 *      cannot write outside data/;
 *   4. browser B (empty) signs in with the made key and the site arrives in
 *      its Builds list, beside B's own;
 *   5. the owner cancels the key and it stops working at once; B keeps its
 *      copy of the site (nothing erased).
 *
 *   POLIO_OWNER_KEY=STANDIN_owner_key_for_tests_only_0123456789 POLIO_ACCOUNT_DIR=/tmp/polio-account-test npx next start -p 3021
 *   node tests/account-sync.mjs http://127.0.0.1:3021 /tmp/polio-account-test
 */
import { existsSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3021";
const DIR = process.argv[3] ?? "/tmp/polio-account-test";
const OWNER = "STANDIN_owner_key_for_tests_only_0123456789";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const call = (path, key, init = {}) => fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(key ? { authorization: `Bearer ${key}` } : {}) } });
const done = async (browser) => {
  await browser?.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};

rmSync(DIR, { recursive: true, force: true });
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

// 1. nothing locked, routes say no
const st = await call("/api/account/status").then((r) => r.json()).catch(() => null);
if (!st) { check(`the server answers at ${BASE}`, false, "start it as the header says"); await done(browser); }
check("the server reports a store and an owner key, and nobody signed in", st.store === true && st.owner === true && st.who === null, JSON.stringify(st));
check("saved work needs a key", (await call("/api/account/data")).status === 401);
check("a wrong key is refused", (await call("/api/account/data", "polio_" + "x".repeat(43))).status === 401);
check("the keys list needs a key", (await call("/api/account/keys")).status === 401);
for (const path of ["/", "/builder"]) check(`${path} opens with no key`, (await fetch(`${BASE}${path}`)).status === 200);

// 2. browser A: a site, then the owner signs in
const a = await browser.newContext();
const pa = await a.newPage();
await pa.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await pa.waitForTimeout(2500);
const aSites = await pa.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.projects ?? []);
check("browser A has a site of its own before signing in", aSites.length >= 1, aSites.map((p) => p.name).join(", "));
await pa.goto(`${BASE}/account`, { waitUntil: "networkidle" });
await pa.fill('[data-account="key-input"]', OWNER);
await pa.click('[data-account="sign-in-button"]');
await pa.waitForSelector('[data-account="signed-in"]', { timeout: 15000 });
await pa.waitForFunction(() => /saved to the account|already in the account/.test(document.querySelector('[data-account="says"]')?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
const says = await pa.textContent('[data-account="says"]').catch(() => "");
check("signing in copies this browser's site into the account", /saved to the account/.test(says ?? ""), says ?? "");
const saved = existsSync(join(DIR, "data/sites")) ? readdirSync(join(DIR, "data/sites")).filter((f) => f.endsWith(".json")) : [];
check("the account now holds the site", saved.length === aSites.length, saved.join(", "));
const held = await pa.evaluate(() => localStorage.getItem("builder.account") ?? "");
const everything = await pa.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
check("the key is held sealed, never in the clear", held.length > 0 && !held.includes(OWNER) && !everything.includes(OWNER));

await pa.fill('[data-account="name-input"]', "Laptop");
await pa.click('[data-account="make-button"]');
await pa.waitForSelector('[data-account="made-key"]', { timeout: 10000 });
const made = (await pa.textContent('[data-account="made-key"]'))?.trim() ?? "";
check("the owner makes a key and sees it once", /^polio_[A-Za-z0-9_-]{43}$/.test(made));
check("the key list names it", (await pa.locator('[data-account="key-row"]').count()) === 1);
const onDisk = readdirSync(join(DIR, "keys")).filter((f) => f.endsWith(".json"));
check("the store keeps the key only as a fingerprint", onDisk.length === 1 && !onDisk[0].includes(made) && /^[0-9a-f]{64}\.json$/.test(onDisk[0]));
await pa.click('[data-account="made-done"]');
check("Done hides the key for good", (await pa.locator('[data-account="made-key"]').count()) === 0);

// 3. what a made key may not do
check("a made key reads saved work", (await call("/api/account/data", made)).status === 200);
check("a made key cannot list keys", (await call("/api/account/keys", made)).status === 403);
check("a made key cannot make keys", (await call("/api/account/keys", made, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "sneaky" }) })).status === 403);
check("a made key cannot write a key record", (await call(`/api/account/data?path=${encodeURIComponent(`keys/${"a".repeat(64)}.json`)}`, made, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" })).status === 400);
check("nor climb out of data/", (await call(`/api/account/data?path=${encodeURIComponent("data/../keys/x.json")}`, made, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" })).status === 400);
check("nor save a page as a picture", (await call(`/api/account/data?path=data/pictures/evil`, made, { method: "PUT", headers: { "content-type": "text/html" }, body: "<script>1</script>" })).status === 415);

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const putPic = () => call("/api/account/data?path=data/pictures/test_pic_1", made, { method: "PUT", headers: { "content-type": "image/png" }, body: png });
check("a picture is saved once", (await putPic()).status === 200);
check("and cannot be written over", (await putPic()).status === 409);
const sitePut = (n) => call("/api/account/data?path=data/sites/test_site_1.json", made, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ n }) });
await sitePut(1); await sitePut(2);
const kept = existsSync(join(DIR, "history/sites/test_site_1")) ? readdirSync(join(DIR, "history/sites/test_site_1")).filter((f) => f.endsWith(".json")) : [];
check("a site saved over keeps the copy it replaced", kept.length === 1, kept.join(", "));

// 4. browser B
const b = await browser.newContext();
const pb = await b.newPage();
await pb.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await pb.waitForTimeout(1500);
const bBefore = await pb.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.projects ?? []);
await pb.goto(`${BASE}/account`, { waitUntil: "networkidle" });
await pb.fill('[data-account="key-input"]', made);
await pb.click('[data-account="sign-in-button"]');
await pb.waitForSelector('[data-account="signed-in"]', { timeout: 15000 });
await pb.waitForFunction(() => /brought here/.test(document.querySelector('[data-account="says"]')?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
check("browser B is told the site came in", /brought here/.test((await pb.textContent('[data-account="says"]').catch(() => "")) ?? ""), (await pb.textContent('[data-account="says"]').catch(() => "")) ?? "");
const bAfter = await pb.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.projects ?? []);
check("browser B now has A's site beside its own", bAfter.length === bBefore.length + aSites.length && aSites.every((s) => bAfter.some((x) => x.name === s.name)), `${bBefore.length} → ${bAfter.length}`);
check("browser B's own sites are all still there", bBefore.every((s) => bAfter.some((x) => x.id === s.id)));

// 5. cancel
await pa.click('[data-account="cancel-button"]');
await pa.waitForFunction(() => document.querySelectorAll('[data-account="key-row"]').length === 0, null, { timeout: 10000 }).catch(() => {});
check("cancelling removes the key from the list", (await pa.locator('[data-account="key-row"]').count()) === 0);
check("a cancelled key stops working at once", (await call("/api/account/data", made)).status === 401);
const bKept = await pb.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}")?.state?.projects ?? []);
check("browser B keeps its copy after the key is cancelled", bKept.length === bAfter.length);
const after = readdirSync(join(DIR, "data/sites")).filter((f) => f.endsWith(".json"));
check("the account still holds A's site", saved.every((f) => after.includes(f)), after.join(", "));

await done(browser);
