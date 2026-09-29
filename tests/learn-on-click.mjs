#!/usr/bin/env node
/**
 * LEARN ON CLICK, BUILDER SIDE.
 *
 * A capture holds back presses that would call a server, prompt a wallet or
 * leave the site, and records each (sink's `doc.held`, read through the
 * adapter in `learn.ts`). Held here, with a document carrying all three:
 *   1. the orange ! says why on hover; a part with nothing held says what it said;
 *   2. its green menu offers Learn for a server call (with a form for a form's
 *      values), never for a wallet; the menu's own options are all still there;
 *   3. Learn all on this page queues every held server call on the page;
 *   4. Learn (n) sends one request for the queue, one press a control, within
 *      the day's cap, stopping on a wallet; until the capturer says it can
 *      press, it sends nothing and says it is waiting;
 *   5. learned controls lose their !, and are not queued again unless asked;
 *   6. nothing of it is published.
 *
 *   node tests/learn-on-click.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* The pure half: the adapter and the one request. */
const { createJiti } = await import("jiti");
const L = await createJiti(import.meta.url).import(join(here, "..", "src", "features", "studio", "learn.ts"));
const RAW = [
  { page: "page_home", part: "n1", character: ["A"], held: "server-call", control: "send", selector: "#n1 form button", hook: "not pressed: it sends a form" },
  { page: "page_home", part: "n2", character: ["A"], held: "wallet", control: "buy-with-sol", selector: "#n2 button", hook: "not pressed" },
  { page: "page_home", part: "n3", character: ["D"], held: "off-site", selector: "#n3 a", offsite: "https://standin.example/coin" },
  /* Renamed fields, as a later capture might write them. */
  { page: "page_home", node: "n4", why: "held: server-call", id: "quote", selector: "#n4 button", hook: "POST standin.example/api/quote" },
];
const held = L.heldOf(RAW);
check("the adapter reads sink's shape and the renamed one", held.length === 4 && held[3].part === "n4" && held[3].why === "server-call" && held[3].control === "quote" && held[0].form && !held[3].form, J(held.map((h) => [h.part, h.why, h.control, h.form])));
let s = L.learnFromDoc({ held: RAW }, undefined);
check("…and nothing says the capturer can press yet", s.supported === false);
s = L.queued(s, held);
check("only server calls are queued: never the wallet, never off the site", J(s.queue) === J(["n1|send", "n4|quote"]), J(s.queue));
s = L.queued(s, held);
check("queued twice is still once", s.queue.length === 2);
s = { ...s, values: { "n1|send": "email=a@standin.example\nname=Standin" } };
const req = L.learnRequest({ ...s, cap: 1 }, Date.UTC(2026, 9, 1));
check("one request for the queue, within the cap, one press a control, stopping on a wallet", req.learn.targets.length === 1 && req.learn.pressesPerControl === 1 && req.learn.stopOnWallet === true && req.learn.cap === 1 && req.learn.targets[0].values.email === "a@standin.example", J(req));
const after = L.afterSend({ ...s, cap: 1 }, req, Date.UTC(2026, 9, 1));
check("…what went is out of the queue, and the day's cap is spent", J(after.queue) === J(["n4|quote"]) && L.learnRequest(after, Date.UTC(2026, 9, 1)) === null && L.learnRequest(after, Date.UTC(2026, 9, 2)) !== null);
const learned = L.learnFromDoc({ held: RAW, learned: [RAW[0], RAW[3]] }, s);
check("a capture that learned them: learned, out of the queue, the part's ! goes", learned.queue.length === 0 && L.partLearned(learned, "n1") && !L.partLearned(learned, "n2"));
check("…and not queued again unless Learn again", L.queued(learned, held).queue.length === 0 && L.queued(learned, [held[0]], true).queue.length === 1);

/* The board. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const dispatches = [];
page.on("request", (r) => { if (/dispatches|\/api\/studio\/capture/.test(r.url())) dispatches.push(r.url()); });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const part = (id, x, y, label) => ({ id, pageId: "page_home", featureId: "cta-primary", label, prompt: "", content: label, data: "", x, y, w: 200, h: 48, groupId: null, options: {}, priority: "must", custom: false, link: null });
const nodes = [part("n1", 100, 100, "Send"), part("n2", 400, 100, "Buy with SOL"), part("n3", 700, 100, "Dex"), part("n4", 100, 300, "Quote"), part("n5", 400, 300, "Plain")];
const doc = { pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], nodes, brief: { name: "Learn", gimmick: "", master: "" } };
const exportNow = () => page.evaluate(async () => (await window.__studioExport()).filter((f) => f.encoding !== "base64").map((f) => [f.path, f.content]));
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1200);
const plainFiles = await exportNow();
await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, held: RAW });
await page.waitForTimeout(1200);
const title = (id) => page.locator(`[data-decide-for="${id}"]`).getAttribute("title").catch(() => null);
check("the ! on a form's button says it was held as a server call", /^Goes nowhere yet: say what it does\. Held: server-call/.test(await title("n1") ?? ""), await title("n1"));
check("…on a wallet control, held for a wallet", /held: wallet|Held: wallet/.test(await title("n2") ?? ""), await title("n2"));
check("…and a part with nothing held says what it always said", (await title("n5")) === "Goes nowhere yet: say what it does", await title("n5"));
const menu = async (id) => { await page.locator(`[data-decide-for="${id}"]`).click({ force: true }); await page.waitForTimeout(700); };
await menu("n2");
check("a wallet control's green menu offers no Learn, and keeps its own options", (await page.locator("[data-learn-row]").count()) === 0 && (await page.locator("[data-say-input]").count()) === 1);
await page.keyboard.press("Escape"); await page.waitForTimeout(300); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await menu("n1");
check("a server call's green menu offers Learn, beside its own options", (await page.locator('[data-learn="n1|send"]').count()) === 1 && (await page.locator("[data-say-input]").count()) === 1);
await page.locator('[data-learn="n1|send"]').click();
await page.waitForTimeout(300);
check("…a form's button asks the values to send", (await page.locator('[data-learn-values="n1|send"]').count()) === 1);
await page.locator("[data-learn-values-input]").fill("email=a@standin.example");
await page.locator('[data-learn-values-go="n1|send"]').click();
await page.waitForTimeout(300);
await page.locator("[data-learn-page]").click();
await page.waitForTimeout(300);
const badge = page.locator("[data-learn-badge]");
check("Learn all on this page queues every held server call on it, and the badge counts them", (await badge.getAttribute("data-learn-badge")) === "2" && /Learn \(2\)/.test(await badge.innerText()), await badge.innerText().catch(() => "none"));
await page.keyboard.press("Escape"); await page.waitForTimeout(300); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.locator("[data-learn-send]").click();
await page.waitForTimeout(800);
check("until the capturer can press, Learn sends nothing and says it is waiting", dispatches.length === 0 && /waiting for the capturer to support Learn/.test(await badge.innerText()), `${dispatches.length} sent; ${await badge.innerText()}`);
const pub = await page.evaluate(() => JSON.stringify(window.__studioPublishDoc()));
check("nothing of it is in the published document", !/"learn"|"held"|server-call/.test(pub));
check("…or the exported site", J(await exportNow()) === J(plainFiles));
await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, held: RAW, learned: [RAW[0], RAW[3]] });
await page.waitForTimeout(1000);
check("learned controls lose their !; the others keep theirs", (await page.locator('[data-decide-for="n1"]').count()) === 0 && (await page.locator('[data-decide-for="n4"]').count()) === 0 && (await page.locator('[data-decide-for="n2"]').count()) === 1 && (await page.locator('[data-decide-for="n5"]').count()) === 1);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
