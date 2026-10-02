/**
 * THE DESIGN GOES BACK AS A STYLE LAYER, AND THE PAGE'S CODE STILL WORKS.
 *
 * The owner's ruling: a site that came from a code repository (PonsStars,
 * sparkygogo77-spec/PST) is redesigned on the board and goes back as a layer
 * over its existing code, never a fresh page that drops its scripts. The
 * fixture (tests/fixtures/style-layer/web) is shaped like PST's play page:
 * plain HTML, every control and live value a data-hook, CSS variables its
 * script reads, a hidden panel, and app.js running a practice-style flow
 * (test wallet, deposit review and confirm, a checkbox that enables a
 * button) by hooks alone.
 *
 * Four halves:
 *   1. the page read part by part with its source (`PARTS`, `sourceHooks.ts`,
 *      `pageParts.ts`), the owner's edits made on its parts, and the layer
 *      built (`styleLayer.ts`): only what changed, keyed by hook; the hook
 *      check covered, untouched, missing (deleted, renamed) in words; plain
 *      words changed only where the HTML holds them;
 *   2. the original page plus the layer, served and opened WITH ITS SCRIPTS:
 *      the flow runs, every hook the source had is still there, and the look
 *      is the board's;
 *   3. the publish against a GitHub stand-in: a new style/ branch, never the
 *      default or the branch it was read from, and the compare link;
 *   4. through the Builder: the part panel's code link, and the repo menu's
 *      section putting the layer on a branch.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/style-layer.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/StyleLayerPanel.tsx, src/features/studio/Inspector.tsx, src/features/studio/RepoPicker.tsx, src/app/api/studio/zip/route.ts, src/features/studio/FromASite.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { PARTS } from "../src/features/studio/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/pageParts.ts";
import { sourceOfPage, withLines } from "../src/features/studio/sourceHooks.ts";
import { applyToPage, buildLayer, hookCounts, linkHref, lookOf } from "../src/features/studio/styleLayer.ts";
import { prepareLayer, publishLayer } from "../src/features/studio/styleLayerRun.ts";
import { sansScripts } from "../src/features/studio/zipImport.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DIR = "tests/fixtures/style-layer";
const FILES = Object.fromEntries(["web/index.html", "web/profile.html", "web/app.js", "web/site.css"].map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));
/* One server for every half, serving whatever `served` holds now. */
let served = {};
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "") || "web/index.html";
  const body = served[path];
  if (body === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const PAGES = ["web/index.html", "web/profile.html"];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/* ------------------------------------------------------------------ */
/* 1. Read, edit, build the layer                                       */
/* ------------------------------------------------------------------ */

/* Opened as the zip route opens it: its HTML without scripts, its stylesheet beside it. */
served = { ...FILES, ...Object.fromEntries(PAGES.map((f) => [f, sansScripts(FILES[f])])) };
const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reads = [];
const open = (p) => (FILES[p] !== undefined ? { file: p, text: FILES[p] } : null);
for (const file of PAGES) {
  await bare.goto(`http://127.0.0.1:${port}/${file}`, { waitUntil: "load" });
  const source = sourceOfPage(file, FILES[file], open);
  reads.push({ file, read: withLines(await bare.evaluate(PARTS, 1500), source, FILES[file], open), source });
}
await bare.close();
const { doc } = pagesToDoc(reads, { at: 1, code: [{ path: "web/app.js", text: FILES["web/app.js"] }] });
const source = { repo: "him/pontoon", ref: "work", dir: "web/", ...doc.styleSource };
const home = source.files[0];
check("the source's hooks are read with their lines", home.hooks.find((h) => h.value === "balance-note")?.line === FILES["web/index.html"].split("\n").findIndex((l) => l.includes('data-hook="balance-note"')) + 1);
check("and its CSS variables, with their values", ["--pons-gain", "--pons-loss", "--pons-ring-me"].every((n) => home.vars.some((v) => v.name === n)) && home.vars.find((v) => v.name === "--pons-gain")?.value === "#16a34a");
check("a hook named in a stylesheet or a script is not a hook of the page's", !home.hooks.some((h) => h.line > FILES["web/index.html"].split("\n").findIndex((l) => l.includes("<script")) + 1) && home.hooks.filter((h) => h.value === "score-you").length === 1);
const nodes = doc.nodes.map((n) => JSON.parse(JSON.stringify(n)));
/* A round picture with no file yet (its script sets one) is the size it was given, round: PST's 96x96 avatar came in as a 96x18 oval, the size of its alt text. */
const avatar = nodes.find((n) => n.hooks?.["data-hook"] === "profile-picture");
check("a round picture with no file yet is its given size and a circle, not its alt text's oval", avatar?.w === 96 && avatar?.h === 96 && avatar?.shape === "circle", JSON.stringify([avatar?.w, avatar?.h, avatar?.shape]));
const byHook = (h) => nodes.find((n) => n.hooks?.["data-hook"] === h);
check("each part keeps where it is in the code: file, line, hook", byHook("balance-note")?.source?.file === "web/index.html" && byHook("balance-note")?.source?.line > 1 && byHook("balance-note")?.source?.hook?.value === "balance-note");

/* The code view: markup, CSS rules and every script reference, tied to each part (`codeRefs.ts`). */
const lineOf = (file, needle) => FILES[file].split("\n").findIndex((l) => l.includes(needle)) + 1;
const codeOfHook = (h) => byHook(h)?.source?.code;
const review0 = codeOfHook("deposit-review");
check("code view: a part's markup is its file and line", review0?.markup?.file === "web/index.html" && review0.markup.line === lineOf("web/index.html", 'data-hook="deposit-review"'));
check("code view: the script that listens on a button, with its function and line", review0?.refs.some((r) => r.kind === "listens" && r.file === "web/app.js" && r.line === lineOf("web/app.js", "$('deposit-review').addEventListener") && r.fn === "the click handler on deposit-review"), JSON.stringify(review0?.refs));
const you0 = codeOfHook("score-you");
check("code view: the CSS rules that style it in every state, from the page's own style block, with their lines", ["gain", "loss"].every((st) => you0?.css.some((c) => c.file === "web/index.html" && c.selector.includes(`[data-sign="${st}"]`) && c.line === lineOf("web/index.html", `[data-hook="score-you"][data-sign="${st}"]`))), JSON.stringify(you0?.css));
check("code view: a variable a hook was put in is followed: its words written, its state styled", you0?.refs.some((r) => r.kind === "writes" && r.line === lineOf("web/app.js", "you.textContent")) && you0.refs.some((r) => r.kind === "styles" && r.line === lineOf("web/app.js", "you.dataset.sign")));
check("code view: words its code writes are marked filled by code, with the function that does it", you0?.built?.fn === "the click handler on deposit-confirm" && byHook("score-you").source.staticWords === false);
check("code view: an empty place the code fills points at what fills it", codeOfHook("balance-message")?.built?.kind === "writes");
check("code view: a hook handed to a helper (setText) is written by that call, and a handler set as onclick is named for its button", codeOfHook("balance-message")?.refs.some((r) => r.kind === "writes" && r.line === lineOf("web/app.js", "setText('balance-message'") && r.fn === "the click handler on withdraw-max") && codeOfHook("withdraw-max")?.refs.some((r) => r.kind === "listens"), JSON.stringify(codeOfHook("balance-message")?.refs));
check("code view: a one-line handler is read for what it does to each part", codeOfHook("newwallet-create")?.refs.some((r) => r.kind === "state") && codeOfHook("newwallet-ack")?.refs.some((r) => r.kind === "listens"));
const panel0 = codeOfHook("balance-panel");
check("code view: a linked stylesheet's rule, and a script finding it by class", panel0?.css.some((c) => c.file === "web/site.css" && c.selector === ".panel" && c.line === 2) && panel0.refs.some((r) => r.via === "class=panel" && r.kind === "styles"), JSON.stringify(panel0?.css));
check("code view: a value inside a line of words brings its own references", nodes.find((n) => n.pageId === "page_home" && /Escrow balance/.test(JSON.stringify(n.content)))?.source?.code?.refs.some((r) => r.via === "data-hook=balance-available" && r.kind === "writes"));
check("code view: a field's value read by its code", codeOfHook("deposit-amount")?.refs.some((r) => r.kind === "reads"));
const h10 = nodes.find((n) => n.pageId === "page_home" && n.featureId === "prose" && n.content === "Pontoon practice page");
check("code view: a part no script names says so, and is not filled by code", h10?.source?.code?.refs.length === 0 && h10.source.code.from === "scan" && !h10.source.code.built);
{
  const { codeIndex } = await import("../src/features/studio/codeRefs.ts");
  const json = JSON.stringify({ hooks: { "balance-note": [{ file: "web/app.js", line: 3, function: "renderBalance", does: "writes the note" }] } });
  const idx = codeIndex([{ path: "web/app.js", text: FILES["web/app.js"] }, { path: "web/hooks.json", text: json }], [{ attr: "data-hook", value: "balance-note" }, { attr: "data-hook", value: "deposit-review" }]);
  check("hooks.json is used where the repository keeps one, the scripts read for the rest", idx.hooksJson === "web/hooks.json" && idx.refs.get("data-hook=balance-note")?.[0]?.fn === "renderBalance" && idx.refs.get("data-hook=balance-note")[0].kind === "writes" && idx.listed.has("data-hook=balance-note") && (idx.refs.get("data-hook=deposit-review") ?? []).length > 0);
}

const nothing = buildLayer(nodes, null, source);
check("left alone, the board writes no rules: the page keeps its own look", nothing.rules.length === 0 && nothing.vars.length === 0 && nothing.text.length === 0, nothing.css.slice(-200));

/* The owner's design, made on the parts as the board would make it. */
const note = byHook("balance-note");
note.colour = { ...note.colour, text: "rgb(200, 0, 0)" };
note.font = { ...note.font, size: 1.25 };
const review = byHook("deposit-review");
review.colour = { ...review.colour, bg: "rgb(10, 120, 200)", text: "rgb(255, 255, 255)" };
review.radius = 8;
review.edge = { width: 1, style: "solid", colour: "rgb(10, 120, 200)" };
const withdraw = byHook("withdraw-panel");
const kids = nodes.filter((n) => n.from?.selector?.startsWith(`${withdraw.from.selector} `));
for (const n of [withdraw, ...kids]) { n.x += 40; n.y += 12; }
withdraw.byHand = true;
const tagline = nodes.find((n) => n.hooks?.id === "tagline");
tagline.colour = { ...tagline.colour, text: "rgb(120, 0, 160)" };
/* The board's own tidying grows a box without anybody's hand: never written. */
nodes.find((n) => n.pageId === "page_home" && /Address:/.test(JSON.stringify(n.content))).h += 6;
const h1 = nodes.find((n) => n.pageId === "page_home" && n.featureId === "prose" && n.content === "Pontoon practice page");
h1.content = "Pontoon, the practice table";
const forget = byHook("wallet-forget-test");
nodes.splice(nodes.indexOf(forget), 1);
byHook("wallet-new").hooks["data-hook"] = "wallet-create";
source.varsSet = { "--pons-gain": "#00aa88" };

const layer = buildLayer(nodes, null, source, { when: "2026-10-02" });
const ruleFor = (sel) => layer.rules.find((r) => r.selector === sel);
console.log(layer.css);
check("a changed part is restyled by its hook, with what changed and nothing else", !!ruleFor('[data-hook="balance-note"]') && ruleFor('[data-hook="balance-note"]').declarations.join(";") === "color: rgb(200, 0, 0);font-size: 20px", ruleFor('[data-hook="balance-note"]')?.declarations.join("; "));
check("a button's fill, ink, edge and rounding", ["background-color: rgb(10, 120, 200)", "color: rgb(255, 255, 255)", "border-radius: 8px"].every((d) => ruleFor('[data-hook="deposit-review"]')?.declarations.includes(d)) && ruleFor('[data-hook="deposit-review"]').declarations.some((d) => d.startsWith("border: 1px solid")));
check("an id is a hook too", ruleFor("#tagline")?.declarations.join() === "color: rgb(120, 0, 160)");
check("a section moved by hand is offset where the page put it, and its parts move with it, not twice", ruleFor('[data-hook="withdraw-panel"]')?.declarations.includes("left: 40px") && ruleFor('[data-hook="withdraw-panel"]')?.declarations.includes("top: 12px") && !layer.rules.some((r) => r.selector === '[data-hook="withdraw-max"]'));
check("a box the board grew by itself writes nothing", !layer.rules.some((r) => r.declarations.some((d) => d.startsWith("min-height"))));
check("a variable the code exposes is set where he set it", layer.vars.some((v) => v.name === "--pons-gain" && v.value === "#00aa88") && /:root \{\n {2}--pons-gain: #00aa88;/.test(layer.css));
check("the layer never hides, adds or removes anything", !/\b(display|visibility|content)\s*:/.test(layer.css.replace(/\/\*[\s\S]*?\*\//g, "")));
const fate = (v) => layer.check.find((c) => c.value === v);
check("hook check: a restyled hook is covered", fate("balance-note")?.fate === "covered" && fate("deposit-review")?.fate === "covered");
check("hook check: one left alone is untouched", fate("deposit-amount")?.fate === "untouched");
check("hook check: a deleted part's hook is missing, said in words", fate("wallet-forget-test")?.fate === "missing" && /deleted/.test(fate("wallet-forget-test").why), fate("wallet-forget-test")?.why);
check("hook check: a renamed hook is missing, the layer keeps the code's name", fate("wallet-new")?.fate === "missing" && /renamed on the board to “wallet-create”/.test(fate("wallet-new").why) && !layer.css.includes("wallet-create"));
check("hook check: a hidden panel's hooks came too", fate("newwallet-create")?.fate === "untouched" && fate("deposit-confirm")?.fate === "untouched");
check("the summary says it plainly, with a warning for each missing hook", /restyled by hook/.test(layer.says) && (layer.says.match(/^Warning:/gm) ?? []).length === 2, layer.says);
check("plain words are changed where the HTML holds them", layer.text.length === 1 && layer.text[0].to === "Pontoon, the practice table");

/* The page with its link and its words. */
const css = "web/style-layer.css";
const page = applyToPage(FILES["web/index.html"], { href: linkHref("web/index.html", css), edits: layer.text.filter((e) => e.file === "web/index.html") });
check("the heading's words are changed in the HTML, once", page.done.length === 1 && page.skipped.length === 0, JSON.stringify(page.skipped));
check("each page gains one <link>, in its head", page.linked && (page.html.match(/data-style-layer/g) ?? []).length === 1 && page.html.indexOf("style-layer.css") < page.html.indexOf("</head>"));
check("and only that and the words: the scripts and every hook are as they were", page.html.replace(/\n?\s*<link rel="stylesheet" href="style-layer.css" data-style-layer="">/, "").replace("Pontoon, the practice table", "Pontoon practice page") === FILES["web/index.html"] && JSON.stringify([...hookCounts(page.html)]) === JSON.stringify([...hookCounts(FILES["web/index.html"])]));
check("linked twice, it is still one link", (applyToPage(page.html, { href: "style-layer.css", edits: [] }).html.match(/data-style-layer/g) ?? []).length === 1);
check("words written more than once are left, and said", applyToPage("<body><p>Hi there</p><p>Hi there</p></body>", { href: "x.css", edits: [{ nodeId: "a", file: "f", from: "Hi there", to: "Hello" }] }).skipped[0]?.why.includes("2 times"));
check("words inside a script are never touched", !applyToPage('<body><script>var s = "Hi there";</script></body>', { href: "x.css", edits: [{ nodeId: "a", file: "f", from: "Hi there", to: "Hello" }] }).html.includes("Hello"));

/* ------------------------------------------------------------------ */
/* 2. The original page plus the layer, with its scripts running        */
/* ------------------------------------------------------------------ */

served = { ...FILES, "web/index.html": page.html, [css]: layer.css };
const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const liveErrors = [];
live.on("pageerror", (e) => liveErrors.push(e.message));
await live.goto(`http://127.0.0.1:${port}/web/index.html`, { waitUntil: "load" });
const hooksThere = await live.evaluate((list) => list.filter((h) => !document.querySelector(h.attr === "id" ? `#${h.value}` : `[data-hook="${h.value}"]`)).map((h) => h.value), home.hooks.map(({ attr, value }) => ({ attr, value })));
check("every hook the source had is still on the page", hooksThere.length === 0, hooksThere.join(", "));
await live.click('[data-hook="wallet-connect-test"]');
await live.click('[data-hook="wallet-new"]');
await live.check('[data-hook="newwallet-ack"]');
await live.fill('[data-hook="deposit-amount"]', "2");
await live.click('[data-hook="deposit-review"]');
const reviewed = await live.evaluate(() => ({ shown: !document.querySelector('[data-hook="deposit-confirm-panel"]').hidden, summary: document.querySelector('[data-hook="deposit-summary"]').textContent }));
await live.click('[data-hook="deposit-confirm"]');
await live.click("#max");
const flow = await live.evaluate(() => ({
  address: document.querySelector('[data-hook="wallet-address"]').textContent,
  state: document.body.dataset.state,
  panel: !document.querySelector('[data-hook="newwallet-panel"]').hidden,
  create: !document.querySelector('[data-hook="newwallet-create"]').disabled,
  balance: document.querySelector('[data-hook="balance-available"]').textContent,
  message: document.querySelector('[data-hook="balance-message"]').textContent,
  gain: window.gainColour,
  you: getComputedStyle(document.querySelector('[data-hook="score-you"]')).color,
}));
check("its scripts still run the practice flow by its hooks: the test wallet signs in", flow.address === "Test1111wallet" && flow.state === "signed-in", JSON.stringify(flow));
check("a hidden panel still opens, and its checkbox still enables its button", flow.panel && flow.create);
check("the deposit is reviewed, confirmed and lands in the balance", reviewed.shown && reviewed.summary === "Deposit 2 SOL" && flow.balance === "2" && flow.message === "All 2 SOL available.");
check("the code reads the variable the layer set", flow.gain === "#00aa88" && flow.you === "rgb(0, 170, 136)", `${flow.gain} ${flow.you}`);
check("no script error on the page", liveErrors.length === 0, liveErrors.join(" | "));
/* The look is the board's: each rule's properties, computed, against the part's look on the board. */
const want = layer.rules.map((r) => ({ sel: r.selector, look: lookOf(nodes.find((n) => n.id === r.nodeId), null) }));
const drawn = await live.evaluate((list) => list.map(({ sel }) => { const e = document.querySelector(sel); const s = getComputedStyle(e); return { sel, color: s.color, bg: s.backgroundColor, size: parseFloat(s.fontSize), radius: parseFloat(s.borderTopLeftRadius) }; }), want);
const off = drawn.filter((d, i) => { const w = want[i].look; return (w.color && d.color !== w.color) || (w.background && d.bg !== w.background) || (w.fontSize && Math.abs(d.size - w.fontSize) > 0.5) || (w.radius && Math.abs(d.radius - w.radius) > 0.5); });
check("the page wears the board's look for every part restyled", off.length === 0 && drawn.length === layer.rules.length, JSON.stringify(off));
const h1Now = await live.evaluate(() => document.querySelector("h1").textContent);
check("and its heading reads as written on the board", h1Now === "Pontoon, the practice table");
await live.close();
server.close();

/* ------------------------------------------------------------------ */
/* 3. Publishing, against a GitHub stand-in                             */
/* ------------------------------------------------------------------ */

const calls = [];
const refs = { "heads/work": "c0", "heads/main": "m0" };
const blobs = [];
const stand = async (url, init = {}) => {
  const u = new URL(url);
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push(`${method} ${u.pathname}${u.search}`);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const p = u.pathname.replace("/repos/him/pontoon", "");
  if (p === "") return j({ default_branch: "main" });
  if (p.startsWith("/contents/")) { const f = decodeURIComponent(p.slice(10)); return FILES[f] && u.searchParams.get("ref") === "work" ? j({ content: Buffer.from(FILES[f]).toString("base64") }) : j({}, 404); }
  if (p.startsWith("/git/ref/heads/")) { const r = refs[`heads/${decodeURIComponent(p.slice(15))}`]; return r ? j({ object: { sha: r } }) : j({}, 404); }
  if (p.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: "t0" } });
  if (p === "/git/blobs") { blobs.push(body.content); return j({ sha: `b${blobs.length}` }, 201); }
  if (p === "/git/trees") return j({ sha: "t1", tree: body.tree }, 201);
  if (p === "/git/commits") return j({ sha: "c1" }, 201);
  if (p === "/git/refs") { const name = body.ref.replace("refs/", ""); if (refs[name]) return j({ message: "Reference already exists" }, 422); refs[name] = body.sha; return j({ ref: body.ref }, 201); }
  return j({ message: "no" }, 404);
};
refs["heads/style/pontoon-2026-10-02"] = "older";
const prepared = await prepareLayer(nodes, null, source, "tok", { fetch: stand, when: "2026-10-02" });
check("prepared from the pages as they are on the branch it was read from", prepared.ok && calls.some((c) => c === "GET /repos/him/pontoon/contents/web/index.html?ref=work"), prepared.says ?? "");
check("the files are the stylesheet and the changed pages, nothing else", prepared.ok && prepared.files.map((f) => f.path).sort().join() === ["web/index.html", "web/profile.html", "web/style-layer.css"].join() && !prepared.files.some((f) => f.path.endsWith(".js")));
const sent = await publishLayer(prepared, source, "tok", { site: "Pontoon", date: new Date("2026-10-02T10:00:00Z"), fetch: stand });
check("it goes to a new style/ branch, the next free name, never over one there", sent.ok && sent.branch === "style/pontoon-2026-10-02-2" && refs["heads/style/pontoon-2026-10-02"] === "older", JSON.stringify(sent));
check("the default branch and the branch it was read from are untouched", refs["heads/main"] === "m0" && refs["heads/work"] === "c0" && !calls.some((c) => /PATCH|DELETE/.test(c)));
check("the compare link is handed back for him to merge", sent.ok && sent.compare === "https://github.com/him/pontoon/compare/work...style/pontoon-2026-10-02-2" && /merge it yourself/.test(sent.says));
const refused = await publishLayer(prepared, { ...source, ref: "" }, "tok", { site: "", date: new Date("2026-10-02T10:00:00Z"), fetch: async (u, i) => (new URL(u).pathname === "/repos/him/pontoon" ? new Response(JSON.stringify({ default_branch: "style/site-2026-10-02" }), { status: 200 }) : stand(u, i)) });
check("a branch name that is the default branch is refused before anything is written", !refused.ok && /never to/.test(refused.says));

/* ------------------------------------------------------------------ */
/* 4. Through the Builder                                               */
/* ------------------------------------------------------------------ */

const tree = [...Object.keys(FILES).map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length })), { path: "README.md", type: "blob", sha: "rd", size: 3 }];
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
const uiRefs = { "heads/work": "c0" };
await ui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.pathname.match(/^\/repos\/him\/pontoon(\/.*)?$/);
  if (!m) return j({ message: "no" }, 404);
  const rest = m[1] ?? "";
  const method = r.request().method();
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: Buffer.from(Object.values(FILES)[Number(b[1])]).toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10)); return FILES[f] ? j({ content: Buffer.from(FILES[f]).toString("base64") }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return uiRefs[`heads/${decodeURIComponent(rest.slice(15))}`] ? j({ object: { sha: "c0" } }) : j({}, 404);
  if (rest.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: "t0" } });
  if (rest === "/git/blobs" && method === "POST") return j({ sha: "b1" }, 201);
  if (rest === "/git/trees" && method === "POST") return j({ sha: "t1" }, 201);
  if (rest === "/git/commits" && method === "POST") return j({ sha: "c1" }, 201);
  if (rest === "/git/refs" && method === "POST") { const name = JSON.parse(r.request().postData()).ref.replace("refs/", ""); uiRefs[name] = "c1"; return j({ ref: name }, 201); }
  return j({ message: "no" }, 404);
});
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await ui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Pontoon", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await ui.reload({ waitUntil: "networkidle" });
await ui.waitForTimeout(900);
const keys = ui.locator("[data-keys-panel]");
await ui.getByRole("button", { name: "Keys", exact: true }).click();
await ui.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await ui.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await ui.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await ui.waitForTimeout(500);
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(700);
await ui.locator("[data-repo-bring]").fill("him/pontoon@work");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 90 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(1500);
st = await board();
check("brought in, the site knows what its code is written against", st.look?.styleSource?.repo === "him/pontoon" && st.look.styleSource.ref === "work" && st.look.styleSource.files.length === 2, JSON.stringify(st.look?.styleSource ?? null).slice(0, 160));
/* The part panel: its hook, file and line, linked. */
const noteId = st.nodes.find((n) => n.hooks?.["data-hook"] === "balance-note")?.id;
await ui.keyboard.press("Escape");
await ui.locator(`[data-node-id="${noteId}"]`).first().click({ force: true }).catch(() => {});
await ui.waitForTimeout(800);
let code = await ui.evaluate(() => { const e = document.querySelector("[data-part-code]"); return e ? { text: e.textContent, href: e.querySelector("a")?.getAttribute("href") } : null; });
check("the part panel says where the part is in the code: hook, file and line, linked", !!code && /data-hook="balance-note"/.test(code.text) && /web\/index\.html line \d+/.test(code.text) && /github\.com\/him\/pontoon\/blob\/work\/web\/index\.html#L\d+/.test(code.href ?? ""), JSON.stringify(code));
/* The code view: the Code section of a part its code fills. */
const youId = st.nodes.find((n) => n.hooks?.["data-hook"] === "score-you")?.id;
await ui.keyboard.press("Escape");
await ui.locator(`[data-node-id="${youId}"]`).first().click({ force: true }).catch(() => {});
await ui.waitForTimeout(800);
const view = await ui.evaluate(() => {
  const v = document.querySelector("[data-code-view]");
  if (!v) return null;
  return {
    built: v.querySelector("[data-code-built]")?.textContent ?? "",
    css: v.querySelector("[data-code-css]")?.textContent ?? "",
    refs: Array.from(v.querySelectorAll("[data-code-ref]")).map((e) => ({ kind: e.getAttribute("data-code-ref"), text: e.textContent, href: e.querySelector("a")?.getAttribute("href") })),
  };
});
check("the part panel's Code section: filled by code, and by which function", !!view && /Filled by code at run time: the click handler on deposit-confirm in web\/app\.js line \d+/.test(view.built), JSON.stringify(view));
check("…the CSS rules that style it, by selector and line", !!view && /\[data-hook="score-you"\]\[data-sign="gain"\] · web\/index\.html line \d+/.test(view.css));
check("…and each script reference in plain words, linked to its line on GitHub", !!view && view.refs.some((r) => r.kind === "writes" && /writes its words or value/.test(r.text) && /github\.com\/him\/pontoon\/blob\/work\/web\/app\.js#L\d+/.test(r.href ?? "")));
check("the code view is read only: nothing in it can be typed into", await ui.evaluate(() => !document.querySelector("[data-code-view] input, [data-code-view] textarea, [data-code-view] [contenteditable]")));

/* The repo menu: the section, and the layer on a branch. */
await ui.keyboard.press("Escape");
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(800);
const section = ui.locator("[data-style-layer-panel]");
check("the repo menu offers to send the design back, saying what it would do", (await section.count()) === 1 && /Hooks: \d+ restyled, \d+ untouched, \d+ missing/.test(await section.locator("[data-style-layer-says]").innerText()));
await section.locator("[data-style-layer-send]").click();
let said = "";
for (let i = 0; i < 30 && !/compare|Refused|would not/i.test(said); i++) { await ui.waitForTimeout(500); said = await section.locator("[data-style-layer-said]").innerText().catch(() => ""); }
const compare = await section.locator("[data-style-layer-compare]").getAttribute("href").catch(() => null);
check("one press puts it on a new style/ branch and hands back the compare link", /^https:\/\/github\.com\/him\/pontoon\/compare\/work\.\.\.style\/pontoon-\d{4}-\d\d-\d\d$/.test(compare ?? "") && Object.keys(uiRefs).some((k) => k.startsWith("heads/style/pontoon-")), `${compare} ${said.slice(0, 160)}`);
check("no errors in the Builder", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
