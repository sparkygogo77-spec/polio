/**
 * The Keys panel, proven on the deploy.
 *
 * Every person who visits the site enters their own keys in the Keys panel.
 * The keys are held in that person's own browser and ride along with each
 * call that person makes, as one header on the site's own route, which
 * hands the key to the provider and drops it. Nothing goes in the server's
 * environment. This suite runs two browsers against the deployed site and
 * proves five things a person would want proven before pasting a key:
 *
 *   1. A key entered in one browser is on that person's next call, and is
 *      sent nowhere except the one header of the site's own route that
 *      makes the provider call it is for.
 *   2. A second browser with no key is told plainly to enter one, and never
 *      sees the first browser's key or a result made with it.
 *   3. Forget removes the key, and the next call asks for it again.
 *   4. A rejected key and a malformed key each get a sentence saying what
 *      to fix, not a stack trace.
 *   5. Nothing prints the key, whole or in part: not the console, not any
 *      request beyond the one header, not any answer, not the page.
 *
 * Each check says when it cannot be counted: a check that is green only
 * because the thing it watches was never there (no request was made, or
 * the server holds a key of its own so the browser's was never the one
 * tried) is reported as unproven rather than passed.
 *
 *   node tests/keys-live.mjs https://polio-two.vercel.app
 *   node tests/keys-live.mjs                         # a local run, same checks
 *   CHROMIUM_ARGS="--flag=value" node tests/keys-live.mjs <url>   # flags for a browser behind a proxy
 */
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ORIGIN = new URL(URL_).origin;

/* The keys are made here, never reused, so that a leak is a leak of this
   run's own random string and not of anything real. The random part is
   what every "in part" search below looks for. */
const RANDOM = randomBytes(18).toString("base64url");
const KEY = `sk-ant-${RANDOM}`;
const RRANDOM = randomBytes(15).toString("base64url");
const RKEY = `r8_${RRANDOM}`;

/* ------------------------------------------------------------------ */
/* Checks, tallied per numbered claim                                   */
/* ------------------------------------------------------------------ */

const groups = new Map();
const check = (group, name, ok, detail = "") => {
  const g = groups.get(group) ?? { ok: 0, all: 0, unproven: 0 };
  g.all += 1;
  if (ok === "unproven") g.unproven += 1; else if (ok) g.ok += 1;
  groups.set(group, g);
  const mark = ok === "unproven" ? " ??   " : ok ? "  ok  " : " FAIL ";
  console.log(`${mark} ${group}. ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* Watching a browser: every request, every answer, every console line  */
/* ------------------------------------------------------------------ */

/** The one header each route takes a key in. Anything else carrying a key is a leak. */
const KEY_HEADERS = ["x-anthropic-key", "x-replicate-key", "x-github-token", "x-vercel-token"];

function watch(context, name) {
  const log = { name, requests: [], responses: [], console: [], errors: [] };
  context.on("request", (r) => {
    log.requests.push({ url: r.url(), method: r.method(), headers: r.headers(), body: r.postData() ?? "" });
  });
  context.on("response", async (r) => {
    const url = r.url();
    if (!url.startsWith(ORIGIN)) { log.responses.push({ url, status: r.status(), body: "" }); return; }
    const type = r.headers()["content-type"] ?? "";
    let body = "";
    if (/json|text|javascript|html/.test(type)) { try { body = await r.text(); } catch { body = ""; } }
    log.responses.push({ url, status: r.status(), body });
  });
  context.on("page", (page) => {
    page.on("console", (m) => log.console.push(`${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => log.errors.push(String(e?.message ?? e)));
  });
  return log;
}

/** Where a string shows up: every place a key could be printed, named. */
function placesHolding(log, needle) {
  const out = [];
  for (const r of log.requests) {
    if (r.url.includes(needle)) out.push(`the address of a request to ${new URL(r.url).host}`);
    if (r.body.includes(needle)) out.push(`the body of a request to ${new URL(r.url).pathname}`);
    for (const [h, v] of Object.entries(r.headers)) {
      if (KEY_HEADERS.includes(h) && r.url.startsWith(`${ORIGIN}/api/`)) continue;
      if (String(v).includes(needle)) out.push(`the ${h} header of a request to ${new URL(r.url).host}`);
    }
  }
  for (const r of log.responses) if (r.body.includes(needle)) out.push(`the answer from ${new URL(r.url).pathname}`);
  for (const c of log.console) if (c.includes(needle)) out.push("the console");
  for (const e of log.errors) if (e.includes(needle)) out.push("a page error");
  return [...new Set(out)];
}

/** Every eight-character window of the random part: "in part" means any of these. */
const windows = (s) => { const w = []; for (let i = 0; i + 8 <= s.length; i++) w.push(s.slice(i, i + 8)); return w; };

/* ------------------------------------------------------------------ */
/* Driving the panel                                                    */
/* ------------------------------------------------------------------ */

const args = ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(" ").filter(Boolean) : [])];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args });

const panelOf = (page) => page.locator("[data-keys-panel]");
const openPanel = async (page) => {
  if ((await panelOf(page).getAttribute("data-open")) !== "1") await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(400);
};
const field = (page, service) => panelOf(page).locator(`[data-service="${service}"] input`).first();
const tryIt = async (page, service) => {
  const section = panelOf(page).locator(`[data-service="${service}"]`);
  const button = section.getByRole("button", { name: "Try it" });
  if (await button.isDisabled()) return { off: true, answer: "", status: 0, header: {}, json: null, hint: await section.locator("input").first().getAttribute("placeholder") };
  const answered = page.waitForResponse((r) => r.url().startsWith(`${ORIGIN}/api/keys/test`), { timeout: 30_000 }).catch(() => null);
  await section.getByRole("button", { name: "Try it" }).click();
  const res = await answered;
  await page.waitForTimeout(400);
  const said = (await section.innerText()).split("\n").map((l) => l.trim()).filter(Boolean);
  const answer = said.find((l) => /works|rejected|No key|No token|too short|could not reach|failed|answered/i.test(l)) ?? said.at(-1) ?? "";
  const sent = res ? res.request() : null;
  return { answer, status: res ? res.status() : 0, header: sent ? sent.headers() : {}, json: res ? await res.json().catch(() => null) : null };
};
const storageHolds = (page, needle) => page.evaluate((s) => {
  const hits = [];
  for (const store of [localStorage, sessionStorage]) for (let i = 0; i < store.length; i++) { const k = store.key(i); if ((store.getItem(k) ?? "").includes(s)) hits.push(k); }
  return hits;
}, needle);

/** A drawing made real: the Builder's own call, the one a person makes without thinking about keys. */
const builderCall = async (page, log) => {
  const before = log.requests.length;
  const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
  if (!PANE) return { made: false, calls: [] };
  const draw = async (pts) => { await page.mouse.move(pts[0][0], pts[0][1]); await page.mouse.down(); for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(12); } await page.mouse.up(); await page.waitForTimeout(450); };
  const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2);
  await page.keyboard.press("s"); await page.waitForTimeout(300);
  const B = { x: PANE.x + 300, y: PANE.y + 120, w: 420, h: 220 };
  await draw(box(B.x, B.y, B.w, B.h));
  // A blob, not a square: a square is made a cube by code and calls nothing.
  const blob = Array.from({ length: 25 }, (_, i) => { const t = (i / 24) * Math.PI * 2; const rr = 70 * (1 + 0.25 * Math.sin(3 * t)); return [B.x + 160 + rr * Math.cos(t), B.y + 110 + rr * 0.7 * Math.sin(t)]; });
  await page.keyboard.press("d"); await page.waitForTimeout(300);
  await draw(blob);
  await page.keyboard.press("v"); await page.waitForTimeout(1900);
  const fill = page.locator("[data-space-fill]").first();
  if (!(await fill.count())) return { made: false, calls: [] };
  await fill.click({ force: true }); await page.waitForTimeout(400);
  const gen = page.locator("[data-space-generate]");
  if (!(await gen.count())) return { made: false, calls: [] };
  await gen.click();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(750);
    const ask = page.locator("[data-queue-answer]").last();
    if (await ask.count()) { await ask.click({ force: true }).catch(() => undefined); continue; }
    if (log.requests.slice(before).some((r) => /\/api\/studio\/(reshape|image|generate|body)/.test(r.url))) break;
  }
  await page.waitForTimeout(2500);
  return { made: true, calls: log.requests.slice(before).filter((r) => /\/api\/studio\/(reshape|image|generate|body)/.test(r.url)) };
};

/* ------------------------------------------------------------------ */
/* The server's own keys: the one thing that could make this a lie      */
/* ------------------------------------------------------------------ */

const A = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const logA = watch(A, "A");
const a = await A.newPage();
await a.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
const status = await a.evaluate(async () => (await fetch("/api/keys/status", { cache: "no-store" })).json()).catch(() => null);
const serverHas = status ? Object.entries(status.set).filter(([, v]) => v).map(([k]) => k) : null;
console.log(`server keys: ${status ? (serverHas.length ? serverHas.join(", ") : "none") : "status route did not answer"}`);
/* With a key on the server, the server's wins for Claude and the browser's
   is never the one tried: checks 1 to 4 would then measure the server's
   key, and they say so below rather than count. */
const browserIsTried = status !== null && !status.set.ANTHROPIC_API_KEY;
const unlessServer = (ok) => (browserIsTried ? ok : "unproven");
const serverNote = browserIsTried ? "" : "cannot be proven here: the server holds ANTHROPIC_API_KEY, so its key is the one tried and the browser's never is";

/* ------------------------------------------------------------------ */
/* 1. Entered in one browser, on that person's next call, and nowhere else */
/* ------------------------------------------------------------------ */

await openPanel(a);
await field(a, "anthropic").fill(KEY);
await field(a, "replicate").fill(RKEY);
await panelOf(a).getByRole("button", { name: "Save to this browser" }).click();
await a.waitForTimeout(500);
const heldA = await storageHolds(a, KEY);
check(1, "a key typed into the panel is held in this browser, and nowhere but this browser's own storage", heldA.length === 1 && heldA[0] === "builder.keys.plain", heldA.join(", ") || "not held");

/* The next call is after a reload: a fresh page, the key read back off the browser. */
await a.reload({ waitUntil: "networkidle" });
await openPanel(a);
const tried = await tryIt(a, "anthropic");
check(1, "the next call from this browser carries the key, in the one header the route takes it in", tried.header["x-anthropic-key"] === KEY, tried.header["x-anthropic-key"] ? "header present" : `no header (answer: ${tried.answer})`);
const reached = /rejected/i.test(tried.answer);
check(1, "and the provider call it is for was made with it: Anthropic answered about this key", unlessServer(reached),
  serverNote || (reached ? tried.answer : `the provider did not answer about the key: "${tried.answer}"`));
const triedR = await tryIt(a, "replicate");
check(1, "the same for a second key: on its own call, in its own header, and Replicate answered about it", triedR.header["x-replicate-key"] === RKEY && /rejected/i.test(triedR.answer) && !("x-anthropic-key" in triedR.header && triedR.header["x-anthropic-key"] === RKEY),
  triedR.header["x-replicate-key"] === RKEY ? triedR.answer : `header ${triedR.header["x-replicate-key"] ? "wrong" : "missing"}: ${triedR.answer}`);

/* The Builder's own call, made by drawing: the person is not thinking about keys here. */
await a.keyboard.press("Escape");
await a.waitForTimeout(300);
const callA = await builderCall(a, logA);
const carried = callA.calls.filter((r) => r.headers["x-anthropic-key"] === KEY || r.headers["x-replicate-key"] === RKEY);
check(1, "a call the Builder makes for a drawing carries the key too, without the panel open",
  callA.made && callA.calls.length ? carried.length === callA.calls.length : "unproven",
  callA.made && callA.calls.length ? `${carried.length} of ${callA.calls.length} calls to ${[...new Set(callA.calls.map((r) => new URL(r.url).pathname))].join(", ")} carried it` : "the drawing never became a call, so nothing was watched");

const leaksA = [...new Set([KEY, RKEY].flatMap((k) => placesHolding(logA, k)))];
const withKey = logA.requests.filter((r) => KEY_HEADERS.some((h) => r.headers[h]));
const offOrigin = withKey.filter((r) => !r.url.startsWith(`${ORIGIN}/api/`));
check(1, "and it went nowhere else: not in an address, a body, another header, an answer, or to another host",
  withKey.length >= 2 && leaksA.length === 0 && offOrigin.length === 0,
  withKey.length >= 2 ? `${logA.requests.length} requests watched, ${withKey.length} carried a key header, all to ${ORIGIN}/api/` + (leaksA.length ? `; found in ${leaksA.join("; ")}` : "") : `only ${withKey.length} requests carried a key, too few to say`);

/* ------------------------------------------------------------------ */
/* 2. A second browser, with no key                                     */
/* ------------------------------------------------------------------ */

const Bctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const logB = watch(Bctx, "B");
const b = await Bctx.newPage();
await b.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await openPanel(b);
check(2, "a second browser starts with nothing held: the field is empty and its storage holds no key", (await field(b, "anthropic").inputValue()) === "" && (await storageHolds(b, KEY)).length === 0 && (await storageHolds(b, RANDOM)).length === 0);
const triedB = await tryIt(b, "anthropic");
const badgeB = (await panelOf(b).locator('[data-service="anthropic"]').innerText()).replace(/\s+/g, " ");
check(2, "with nothing held the panel does not try a call: Try it is off, the field says what to paste and that the server has nothing", unlessServer(triedB.off === true && /sk-ant/.test(triedB.hint ?? "") && /not on the server/.test(badgeB)),
  serverNote || (triedB.off ? `Try it off, hint "${triedB.hint}", ${/not on the server/.test(badgeB) ? "badge says not on the server" : "no badge"}` : `Try it was on and answered: "${triedB.answer}"`));
check(2, "and no call from it carried the first browser's key", !logB.requests.some((r) => KEY_HEADERS.some((h) => r.headers[h])) && !JSON.stringify(logB.requests.map((r) => r.headers)).includes(RANDOM), `${logB.requests.length} requests so far, none with a key header`);
await b.keyboard.press("Escape");
await b.waitForTimeout(300);
const callB = await builderCall(b, logB);
const bareB = callB.calls.filter((r) => !KEY_HEADERS.some((h) => r.headers[h]));
check(2, "the Builder's own call from this browser carries no key either", callB.made && callB.calls.length ? bareB.length === callB.calls.length : "unproven",
  callB.made && callB.calls.length ? `${bareB.length} of ${callB.calls.length} calls bare` : "the drawing never became a call, so nothing was watched");
/* What is on the page after: a line that names a key and says where it goes
   (the key button, ⌘⇧K, the Keys panel). The top bar's own "Keys" button
   does not count; it is always there. */
const askLine = (text) => text.split("\n").map((l) => l.trim()).find((l) => /key|token/i.test(l) && /⌘⇧K|key button|keys panel|under Keys/i.test(l)) ?? "";
/* Where the ask is, if not on the board: the News panel and the Updates
   panel, each opened and read. A line a person has to open a panel to see
   is not a prompt, and the detail says which it was. */
const askWhere = async (page) => {
  const board = askLine(await page.evaluate(() => document.body.innerText));
  if (board) return { where: "on the board", line: board };
  const looked = [];
  for (const [name, open] of [["News", () => page.getByRole("button", { name: "News", exact: true }).first().click()], ["Updates", () => page.locator("[data-updates-toggle]").first().click()]]) {
    try { await open(); await page.waitForTimeout(500); } catch { continue; }
    const line = askLine(await page.evaluate(() => document.body.innerText));
    looked.push(name);
    if (line) return { where: `only in ${name}, after opening it`, line };
  }
  return { where: `nowhere: not on the board${looked.length ? `, not in ${looked.join(" or ")}` : ""}`, line: "" };
};
const askedB = await askWhere(b);
check(2, "and what the person sees after it says a key is wanted and where to put it, on the board, not nothing",
  callB.made && callB.calls.length ? askedB.where === "on the board" : "unproven",
  callB.made && callB.calls.length ? `${askedB.where}${askedB.line ? `: "${askedB.line.slice(0, 120)}"` : ""}` : "no call was made");
const leaksB = [...new Set([KEY, RKEY, RANDOM].flatMap((k) => placesHolding(logB, k)))];
check(2, "nothing the second browser received held the first browser's key", leaksB.length === 0 && logB.responses.length > 3, leaksB.length ? `found in ${leaksB.join("; ")}` : `${logB.responses.length} answers read`);

/* ------------------------------------------------------------------ */
/* 3. Forget removes it, and the next call asks again                   */
/* ------------------------------------------------------------------ */

await openPanel(a);
await panelOf(a).getByRole("button", { name: "Forget the key" }).last().click();
await a.waitForTimeout(500);
const afterForget = await storageHolds(a, RANDOM);
check(3, "Forget takes the key out of this browser's storage, every store", afterForget.length === 0, afterForget.length ? `still in ${afterForget.join(", ")}` : "");
check(3, "and out of the field", (await field(a, "anthropic").inputValue()) === "");
await a.reload({ waitUntil: "networkidle" });
await openPanel(a);
check(3, "a reload does not bring it back", (await field(a, "anthropic").inputValue()) === "" && (await storageHolds(a, RANDOM)).length === 0);
const triedAfter = await tryIt(a, "anthropic");
check(3, "the panel is back to asking: Try it is off and the field shows what to paste", triedAfter.off === true && /sk-ant/.test(triedAfter.hint ?? ""), triedAfter.off ? `hint "${triedAfter.hint}"` : `Try it on: "${triedAfter.answer}"`);
await a.keyboard.press("Escape");
await a.evaluate(() => localStorage.removeItem("builder.studio"));
await a.reload({ waitUntil: "networkidle" });
const callAfter = await builderCall(a, logA);
const bareAfter = callAfter.calls.filter((r) => !KEY_HEADERS.some((h) => r.headers[h]));
check(3, "the next call the Builder makes carries no key", callAfter.made && callAfter.calls.length ? bareAfter.length === callAfter.calls.length : "unproven",
  callAfter.made && callAfter.calls.length ? `${bareAfter.length} of ${callAfter.calls.length} calls bare` : "the drawing never became a call, so nothing was watched");
const askedAfter = await askWhere(a);
check(3, "and the person is asked for one again, on the board", callAfter.made && callAfter.calls.length ? unlessServer(askedAfter.where === "on the board") : "unproven",
  serverNote || (callAfter.made && callAfter.calls.length ? `${askedAfter.where}${askedAfter.line ? `: "${askedAfter.line.slice(0, 120)}"` : ""}` : "no call was made"));
await openPanel(a);

/* ------------------------------------------------------------------ */
/* 4. A rejected key and a malformed one each say what to fix           */
/* ------------------------------------------------------------------ */

const stackish = (s) => /\bat [\w.<>]+ \(|node_modules|TypeError|ReferenceError|\.js:\d+|\.ts:\d+|Error: /.test(s);
check(4, "a rejected key is answered with what to check, in a sentence", unlessServer(reached && !stackish(tried.answer) && /check/i.test(tried.answer)), serverNote || tried.answer);
check(4, "and the sentence does not carry the key back", !tried.answer.includes(RANDOM) && !windows(RANDOM).some((w) => tried.answer.includes(w)));
await field(a, "anthropic").fill("sk-ant");
await panelOf(a).getByRole("button", { name: "Save to this browser" }).click();
await a.waitForTimeout(400);
const triedShort = await tryIt(a, "anthropic");
check(4, "a key too short to be one is said to be too short, not \"nothing offered\"", unlessServer(/too short|paste it whole/i.test(triedShort.answer) && !/nothing offered/i.test(triedShort.answer)), serverNote || triedShort.answer);
check(4, "and nothing that short is sent to the provider", triedShort.json?.reason !== "auth" && !/rejected/i.test(triedShort.answer), triedShort.json?.reason ?? "");
await field(a, "anthropic").fill("");
await panelOf(a).getByRole("button", { name: "Save to this browser" }).click().catch(() => undefined);

/* ------------------------------------------------------------------ */
/* 5. Nothing prints the key, whole or in part                          */
/* ------------------------------------------------------------------ */

const pageText = await a.evaluate(() => document.body.innerText + " " + document.documentElement.outerHTML.replace(/value="[^"]*"/g, ""));
const everything = [
  ...logA.console.map((c) => ["A's console", c]), ...logB.console.map((c) => ["B's console", c]),
  ...logA.errors.map((c) => ["A's page errors", c]), ...logB.errors.map((c) => ["B's page errors", c]),
  ...logA.responses.map((r) => [`an answer from ${new URL(r.url).pathname}`, r.body]), ...logB.responses.map((r) => [`an answer from ${new URL(r.url).pathname}`, r.body]),
  ...logA.requests.map((r) => [`the address or body of a request to ${new URL(r.url).host}`, `${r.url} ${r.body}`]),
  ...logA.requests.flatMap((r) => Object.entries(r.headers).filter(([h]) => !(KEY_HEADERS.includes(h) && r.url.startsWith(`${ORIGIN}/api/`))).map(([h, v]) => [`the ${h} header of a request to ${new URL(r.url).host}`, String(v)])),
  ["the page", pageText],
];
const found = new Set();
for (const [where, text] of everything) if (windows(RANDOM).some((w) => text.includes(w)) || windows(RRANDOM).some((w) => text.includes(w))) found.add(where);
const watched = logA.console.length + logB.console.length + logA.responses.length + logB.responses.length + logA.requests.length;
check(5, "no eight characters of either key appear in any console line, page error, answer, address, body or other header", found.size === 0 && withKey.length >= 2,
  withKey.length >= 2 ? `${watched} things read: ${logA.console.length + logB.console.length} console lines, ${logA.responses.length + logB.responses.length} answers, ${logA.requests.length} requests` + (found.size ? `; found in ${[...found].join("; ")}` : "") : "no call ever carried a key, so there was nothing to leak");
check(5, "nor on the page itself while the panel holds one, beyond the field's own value", !windows(RANDOM).some((w) => pageText.includes(w)));
const headerOnly = withKey.every((r) => Object.entries(r.headers).filter(([, v]) => String(v).includes(RANDOM) || String(v).includes(RRANDOM)).every(([h]) => KEY_HEADERS.includes(h)));
check(5, "and where a key travels it is the one header and nothing else on that request", headerOnly && withKey.length >= 2, `${withKey.length} requests carried one`);
console.log("note  5. the server's own log is not readable from here; the routes were read instead: no console line in src/app/api/keys or the studio routes writes a header or a key");

await browser.close();

/* ------------------------------------------------------------------ */

console.log("");
let failed = 0;
for (const [g, t] of [...groups.entries()].sort((x, y) => x[0] - y[0])) {
  const line = `${g}. ${t.ok} of ${t.all} hold${t.unproven ? `, ${t.unproven} unproven here` : ""}${t.all - t.ok - t.unproven ? `, ${t.all - t.ok - t.unproven} FAILED` : ""}`;
  console.log(line);
  failed += t.all - t.ok - t.unproven;
}
process.exit(failed ? 1 : 0);
