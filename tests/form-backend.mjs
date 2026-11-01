#!/usr/bin/env node
/**
 * FORMS THAT REALLY SEND ON AN EXPORTED SITE (J 2026-11-01), both ways of
 * exporting (`send-out/formsOut.ts`). The ruling:
 *
 *   1. a small captured page (a form of drawn fields, a search form beside it),
 *      exported each way, `next build`, served, driven in a browser:
 *      - with no destination, pressing Send says on the page that it was not
 *        sent, and what was typed stays;
 *      - with the `test` destination, what was typed reaches it, and the page
 *        says it was a test;
 *      - Exact look: the markup is the markup with no form wiring, byte for
 *        byte, and the page as it opens is the same picture with the script
 *        running and without it;
 *      - Clean code: real inputs and a real submit button, each part still on
 *        its board box;
 *      - hostile posts are refused: another site, an unknown form or field, a
 *        missing or malformed field, too long, too big, too many, the trap;
 *      - nothing typed reaches the server's log, and no destination setting or
 *        secret is in what the browser loads, or in the export;
 *   2. on each site given: its forms are listed, a site with none gets no form
 *      file at all, and a site with one has it sent, each way;
 *   3. with a Builder url: the Export dialog's zip of a contact form from the
 *      shelf reads the site's setting (`format["forms.destination"]`) and sends.
 *
 *   node tests/form-backend.mjs                                         part 1
 *   PAGES_DUMP=<folder with board.json and site/>,... node tests/form-backend.mjs   parts 1, 2
 *   npx next start -p 3091
 *   node tests/form-backend.mjs http://127.0.0.1:3091 [<capture folder> ...]        parts 1, 2, 3
 *
 * Covers: src/features/studio/send-out/formsOut.ts, src/features/studio/send-out/exactOut.ts, src/features/studio/send-out/pagesOut.ts, src/features/studio/send-out/exportRun.ts
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { chromium } from "playwright-core";
import { JSDOM } from "jsdom";
import { cleanFormFiles, destinationSetting, exactOut, formFiles, formsMd, formsOf, pagesOut, tokensOut } from "../src/features/studio/send-out/index.ts";
import { homeFor, routeOf } from "../src/features/studio/homePage.ts";
import { buildApp, serveApp } from "./lib/export-app.mjs";
import { dumpedSite, importedSite, systemOf } from "./lib/export-input.mjs";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, part, PAGE } from "./lib/seeded.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const [BASE, ...captures] = process.argv.slice(2);
const outboxDir = mkdtempSync(join(tmpdir(), "polio-form-"));

/* ------------------------------------------------------------------ */
/* A small captured page: drawn fields, as a capture publishes them    */
/* ------------------------------------------------------------------ */

const drawn = (id, x, y, w, h, words, grey = true) => `<div class="sm-p" style="position: absolute; left: ${x}px; top: ${y}px; width: ${w}px; min-height: ${h}px; display: flex; flex-direction: column;" id="${id}"><div class="mo mo-${id}" style="width: 100%; height: auto; flex: 1 0 auto; box-sizing: border-box; overflow: visible; background: ${grey ? "rgb(255, 255, 255)" : "rgb(255, 79, 154)"}; padding: 0px 14px;"><div style="width: 100%; height: 100%; flex: 1 0 auto; overflow: hidden clip; box-sizing: border-box; position: relative; color: ${grey ? "rgb(117, 117, 117)" : "rgb(0, 0, 0)"}; font-family: system-ui, sans-serif; font-size: 17px; line-height: 1.4;"><div style="text-align: left; display: flex; flex-direction: column;"><p style="margin: 0px;">${words}</p></div></div></div></div>`;
const SMALL_HTML = `<!doctype html><html><head><title>Small</title><link rel="stylesheet" href="assets/site.css"></head><body><div class="sm-page site-root" data-page="" style="position: relative; width: 100%; height: 900px; background: rgb(240, 240, 240); color: rgb(20, 20, 20);">
${drawn("n_form", 100, 100, 600, 420, "")}
${drawn("n_name", 120, 120, 560, 44, "Your name")}
${drawn("n_mail", 120, 180, 560, 44, "you@example.com")}
${drawn("n_message", 120, 240, 560, 120, "What should we add?")}
${drawn("n_note", 120, 372, 200, 44, "Idea", false)}
${drawn("n_send", 600, 440, 80, 44, "Send", false)}
${drawn("n_search", 800, 100, 300, 120, "")}
${drawn("n_find", 820, 120, 260, 44, "Find something")}
${drawn("n_go", 820, 170, 80, 40, "Check", false)}
</div></body></html>`;
const field = (id, x, y, w, h, selector, name, more, words) => part(id, x, y, w, h, { featureId: "prose", label: `textbox “${name}”: ${words}`, content: words, data: `textbox, named “${name}”, ${more}, placeholder “${words}”`, ...captured(selector) });
const button = (id, x, y, w, h, selector, words) => part(id, x, y, w, h, { featureId: "cta-primary", label: `button “${words}”`, content: words, data: `button, named “${words}”`, ...captured(selector) });
const smallSite = () => ({
  name: "small",
  board: {
    frameWidth: 1440, look: { palette: {} }, format: {},
    pages: [{ id: PAGE, name: "Home", path: "/" }],
    nodes: [
      part("n_form", 100, 100, 600, 420, { label: "form · 5 inside", ...captured("body > main > form") }),
      field("n_name", 120, 120, 560, 44, "body > main > form > label:nth-of-type(1) > input", "Your name", "required, type text", "Your name"),
      field("n_mail", 120, 180, 560, 44, "body > main > form > label:nth-of-type(2) > input", "Email", "required, type email", "you@example.com"),
      field("n_message", 120, 240, 560, 120, "body > main > form > textarea", "Message", "type textarea", "What should we add?"),
      button("n_note", 120, 372, 200, 44, "body > main > form > div > button:nth-of-type(1)", "Idea"),
      button("n_send", 600, 440, 80, 44, "body > main > form > button", "Send"),
      part("n_search", 800, 100, 300, 120, { label: "search · 2 inside", ...captured("body > aside > form") }),
      field("n_find", 820, 120, 260, 44, "body > aside > form > input", "Find", "type text", "Find something"),
      button("n_go", 820, 170, 80, 40, "body > aside > form > button", "Check"),
    ],
  },
  files: [
    { path: "index.html", bytes: Buffer.from(SMALL_HTML) },
    { path: "assets/site.css", bytes: Buffer.from("html,body{margin:0}\n") },
  ],
});

/* ------------------------------------------------------------------ */
/* Export each way                                                     */
/* ------------------------------------------------------------------ */

const pagesOf = (board) => (board.pages?.length ? board.pages : [{ id: board.nodes[0].pageId, name: "Home", path: "/" }]);
const docs = (site, pages) => {
  const home = homeFor(pagesOf(site.board));
  const by = new Map(site.files.map((f) => [f.path, f]));
  return new Map(pages.flatMap((p) => { const f = by.get(home.file(p)); return f ? [[p.id, new JSDOM(f.bytes.toString("utf8")).window.document]] : []; }));
};

function exactFiles(site, pages, found, destination) {
  const { system } = systemOf(site.board, site.name);
  const out = exactOut({ name: site.name, pages, published: docs(site, pages), assets: site.files.map((f) => ({ path: f.path, content: f.bytes })), system, forms: found?.forms });
  return [...tokensOut(system), ...(found ? formFiles(found, destination) : []), ...out.files];
}
function cleanFiles(site, pages, found, destination) {
  const { system, palette, nodes } = systemOf(site.board, site.name);
  const by = new Map(site.files.map((f) => [f.path, f]));
  const out = pagesOut({ name: site.name, pages, nodes, frameWidth: site.board.frameWidth ?? 1440, system, palette, published: docs(site, pages), siteCss: by.get("assets/site.css")?.bytes.toString("utf8") ?? "", forms: found?.forms });
  const assets = site.files.filter((f) => f.path.startsWith("assets/") && !/\.(css|js)$/.test(f.path)).map((f) => ({ path: `public/${f.path}`, content: f.bytes }));
  return [...tokensOut(system), ...out.files, ...assets, ...(found ? [...formFiles(found, destination), ...cleanFormFiles(found)] : [])];
}

const SECRET = "not-a-real-key-placeholder-9731";
const walkFiles = (d) => readdirSync(d).flatMap((e) => { const p = join(d, e); return statSync(p).isDirectory() ? walkFiles(p) : [p]; });
const inStatic = (dir, words) => {
  const at = join(dir, ".next", "static");
  if (!existsSync(at)) return [];
  return walkFiles(at).filter((p) => /\.(js|css|html)$/.test(p)).filter((p) => { const t = readFileSync(p, "utf8"); return words.some((w) => t.includes(w)); });
};

/** Serves a built app with this environment, and hands back the server. */
async function serve(dir, env) {
  const saved = { FORM_DESTINATION: process.env.FORM_DESTINATION, FORM_TEST_OUTBOX: process.env.FORM_TEST_OUTBOX, FORM_SECRET_KEY: process.env.FORM_SECRET_KEY };
  for (const k of Object.keys(saved)) delete process.env[k];
  Object.assign(process.env, env);
  const srv = await serveApp(dir);
  for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  return srv;
}

const outboxOf = (file) => (existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

/** Types into a field as a person does. */
async function typeInto(p, form, f, words, mode) {
  if (mode === "exact" && f.drawn) {
    await p.locator(`#${f.part}`).click();
    await p.keyboard.press("Control+a").catch(() => {});
    await p.keyboard.type(words);
  } else {
    await p.locator(`[form="polio-form-${form.id}"][name="${f.name}"], #${f.part} [data-form-field="${f.name}"]`).first().fill(words);
  }
}
const readField = async (p, form, f, mode) => (mode === "exact" && f.drawn ? p.locator(`#${f.part} [data-form-field="${f.name}"], [data-form-field="${f.name}"]`).first().innerText() : p.locator(`[form="polio-form-${form.id}"][name="${f.name}"]`).first().inputValue());
const wordsFor = (f, tag) => (f.kind === "email" ? `sender${tag}@example.test` : f.kind === "url" ? "https://example.test/" : f.kind === "number" ? "7" : f.kind === "tel" ? "+1 555 0100" : `words ${f.name} ${tag}`);
const answerOf = async (p) => { const a = p.locator("[data-form-answer]").first(); await a.waitFor({ timeout: 15000 }); await p.waitForTimeout(200); return { words: (await a.innerText()).trim(), good: await a.getAttribute("data-good") }; };

/** One form, on one built app: no destination, then the test destination, in a real browser. */
async function drive(app, form, route, mode, tag, secret) {
  const url = (srv) => `${srv.url}${route ? `/${route}` : ""}`;
  const sendPart = (p) => (form.submit === form.part ? p.locator(`#${form.part} button`).last() : p.locator(`#${form.submit}`));
  const fillAll = async (p) => { for (const f of form.fields) await typeInto(p, form, f, wordsFor(f, tag), mode); };

  /* No destination. */
  let srv = await serve(app.dir, {});
  check(`${mode}: the built app is served`, srv.ok, srv.ok ? "" : srv.log().split("\n").slice(-6).join(" / "));
  if (!srv.ok) { srv.stop(); return null; }
  let p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url(srv), { waitUntil: "load" });
  await p.waitForTimeout(800);
  await fillAll(p);
  await sendPart(p).click();
  let said = await answerOf(p);
  check(`${mode}: with no destination the page says it was not sent`, /not sent/i.test(said.words) && said.good === "no", said.words);
  const first = form.fields[0];
  const kept = await readField(p, form, first, mode);
  check(`${mode}: what was typed stays after a failure`, kept.includes(wordsFor(first, tag)), kept);
  check(`${mode}: no script error on the page`, errs.length === 0, errs.slice(0, 2).join(" / "));
  await p.close();
  srv.stop();

  /* The test destination, with a key in the environment that must stay on the server. */
  const outbox = join(outboxDir, `${tag}-${mode}.jsonl`);
  srv = await serve(app.dir, { FORM_DESTINATION: "test", FORM_TEST_OUTBOX: outbox, FORM_SECRET_KEY: secret });
  check(`${mode}: served with the test destination`, srv.ok);
  if (!srv.ok) { srv.stop(); return null; }
  p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(url(srv), { waitUntil: "load" });
  await p.waitForTimeout(800);
  await fillAll(p);
  await sendPart(p).click();
  said = await answerOf(p);
  check(`${mode}: with the test destination the page says it was a test, and nobody told`, /test only/i.test(said.words) && said.good === "yes", said.words);
  const box = outboxOf(outbox);
  const went = box[0]?.fields ?? [];
  check(`${mode}: every field reached the destination`, box.length === 1 && form.fields.every((f) => went.find((x) => x.name === f.name)?.value === wordsFor(f, tag)), JSON.stringify(went.map((x) => x.name)));
  await p.close();
  return { srv, outbox };
}

/* ------------------------------------------------------------------ */
/* Hostile posts                                                       */
/* ------------------------------------------------------------------ */

async function hostile(srv, form, outbox, mode) {
  const host = new URL(srv.url).host;
  let ip = 1;
  const post = (body, { origin = srv.url, type = "application/json", address } = {}) => fetch(`${srv.url}/api/form`, {
    method: "POST",
    headers: { "content-type": type, "x-forwarded-for": address ?? `10.0.0.${ip++}`, ...(origin ? { origin } : {}), host },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const good = Object.fromEntries(form.fields.map((f) => [f.name, wordsFor(f, "h")]));
  const before = outboxOf(outbox).length;
  const status = async (r) => { const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* words */ } return { code: r.status, ok: j.ok, says: j.says ?? t }; };
  const refused = async (name, res, want) => { const r = await status(await res); check(`${mode}: ${name} is refused`, r.code === want && r.ok !== true && /not sent/i.test(r.says), `${r.code} ${r.says}`); };

  await refused("a post with no origin", post({ form: form.id, fields: good }, { origin: null }), 403);
  await refused("a post from another site", post({ form: form.id, fields: good }, { origin: "https://evil.example" }), 403);
  await refused("an unknown form", post({ form: "__proto__", fields: good }), 400);
  await refused("an unknown field", post({ form: form.id, fields: { ...good, extra: "x" } }), 400);
  await refused("a __proto__ field", post(`{"form":${JSON.stringify(form.id)},"fields":{"__proto__":{"a":1}}}`), 400);
  await refused("a value that is not words", post({ form: form.id, fields: { ...good, [form.fields[0].name]: { $ne: 1 } } }), 400);
  await refused("broken JSON", post("{not json"), 400);
  await refused("a type it does not read", post("<a/>", { type: "text/xml" }), 400);
  const required = form.fields.find((f) => f.required);
  if (required) await refused("a missing required field", post({ form: form.id, fields: { ...good, [required.name]: "   " } }), 400);
  const email = form.fields.find((f) => f.kind === "email");
  if (email) await refused("a malformed email", post({ form: form.id, fields: { ...good, [email.name]: "not an address\r\nBcc: x@y" } }), 400);
  await refused("one field over its limit", post({ form: form.id, fields: { ...good, [form.fields[0].name]: "x".repeat(20000) } }), 413);
  await refused("a body over the size limit", post({ form: form.id, fields: { ...good, pad: "x".repeat(200_000) } }), 413);
  await refused("the trap filled in", post({ form: form.id, fields: { ...good, website: "http://spam.example" } }), 403);
  check(`${mode}: nothing refused reached the destination`, outboxOf(outbox).length === before);

  /* Control characters do not survive; the rate limit holds for one address. */
  const line = form.fields.find((f) => f.kind === "text");
  if (line) {
    const r = await status(await post({ form: form.id, fields: { ...good, [line.name]: "plain\u0007\r\nwords" } }));
    const got = outboxOf(outbox).at(-1)?.fields.find((x) => x.name === line.name)?.value;
    check(`${mode}: control characters are taken out of a line`, r.code === 200 && got === "plainwords", JSON.stringify(got));
  }
  /* A page with scripts off posts its fields plainly, and the answer it lands on is words. */
  const plainPost = await post(new URLSearchParams({ form: form.id, website: "", ...good }).toString(), { type: "application/x-www-form-urlencoded" });
  const plainWords = await plainPost.text();
  check(`${mode}: a plain post with scripts off is sent, and answered in words`, plainPost.status === 200 && /test only/i.test(plainWords) && !plainWords.startsWith("{"), plainWords);
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await post({ form: form.id, fields: good }, { address: "10.9.9.9" })).status);
  check(`${mode}: an address posting too often is stopped`, codes.slice(0, 5).every((c) => c === 200) && codes.slice(5).every((c) => c === 429), codes.join(" "));
}

/* ------------------------------------------------------------------ */
/* 1. The small page                                                    */
/* ------------------------------------------------------------------ */

const BUILD_NOTE = (b) => b.log.split("\n").filter((l) => /rror|failed|Type /.test(l)).slice(0, 8).join(" / ");

{
  console.log("\na small captured page");
  const site = smallSite();
  const pages = pagesOf(site.board);
  const found = formsOf(site.board.nodes, pages, docs(site, pages));
  check("the form is found, its search form said and not wired", found.forms.length === 1 && found.forms[0].fields.length === 3 && found.forms[0].submit === "n_send" && found.skipped.some((s) => s.part === "n_search"), JSON.stringify(found.skipped));
  check("a choice drawn as a button is said to be left out", found.forms[0].notSent.some((s) => /Idea/.test(s)), found.forms[0].notSent.join("; "));
  const md = formsMd(found, "");
  check("POLIO.md lists what it sends, what it leaves out and that nothing is connected", /Your name, Email, Message/.test(md) && /Idea/.test(md) && /n_search/.test(md) && /not sent/.test(md));
  check("the setting is a name only: a pasted key or address is not written", destinationSetting({ "forms.destination": "test" }) === "test" && destinationSetting({ "forms.destination": `re_${SECRET}:x` }) === "" && destinationSetting({ "forms.destination": "me@example.com" }) === "" && destinationSetting({}) === "");

  /* Exact look. */
  const plain = exactFiles(site, pages, null, "");
  const wired = exactFiles(site, pages, found, "");
  const text = (files, path) => { const f = files.find((x) => x.path === path)?.content; return typeof f === "string" ? f : f ? Buffer.from(f).toString("utf8") : ""; };
  check("Exact look: the markup is byte for byte the markup without forms", text(plain, "app/markup.ts").length > 500 && text(plain, "app/markup.ts") === text(wired, "app/markup.ts"));
  check("Exact look: the site's route, list and script are written", ["app/api/form/route.ts", "forms/check.ts", "forms/destinations.ts", "forms/forms.ts", "public/assets/polio-forms.js"].every((p) => wired.some((f) => f.path === p)));
  const exactApp = await buildApp("form-small-exact", wired);
  check("Exact look: next build passes", exactApp.ok, exactApp.ok ? "" : BUILD_NOTE(exactApp));
  if (exactApp.ok) {
    const live = await drive(exactApp, found.forms[0], "", "exact", "small", SECRET);
    if (live) {
      /* The page as it opens: the same picture with the script and without. */
      const shot = async (block) => {
        const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        if (block) await p.route("**/polio-forms.js", (r) => r.abort());
        await p.goto(live.srv.url, { waitUntil: "load" });
        await p.waitForTimeout(800);
        const png = await p.screenshot({ fullPage: true, animations: "disabled" });
        const ran = await p.evaluate(() => document.querySelectorAll("[data-form-field]").length);
        await p.close();
        return { png, ran };
      };
      const [off, on] = [await shot(true), await shot(false)];
      check("Exact look: the page as it opens is the same picture, with the script and without", off.ran === 0 && on.ran === 3 && off.png.equals(on.png), `${on.ran} fields wired; ${off.png.length} vs ${on.png.length} bytes`);
      await hostile(live.srv, found.forms[0], live.outbox, "exact");
      const log = live.srv.log();
      check("Exact look: nothing typed is in the server's log", !/words your-name|senderh@|sendersmall@|plainwords/.test(log), `${log.length} characters of log`);
      live.srv.stop();
      check("Exact look: no secret or destination setting in what the browser loads", inStatic(exactApp.dir, [SECRET, "FORM_DESTINATION", "FORM_TEST_OUTBOX", "polio-form-outbox"]).length === 0);
      const script = text(wired, "public/assets/polio-forms.js");
      check("Exact look: the script holds no environment name or destination", !/process\.env|FORM_DESTINATION|DESTINATION/.test(script));
    }
  }

  /* Clean code. */
  const cleanSite = smallSite();
  const clean = cleanFiles(cleanSite, pages, found, "");
  const page = text(clean, "app/page.tsx");
  const all = clean.filter((f) => /\.tsx$/.test(f.path)).map((f) => text(clean, f.path)).join("\n");
  check("Clean code: real inputs, a textarea and a submit button, joined to the form by name", /<input[^>]*name="your-name"[^>]*form="polio-form-home"|<input[^>]*form="polio-form-home"[^>]*name="your-name"/.test(all.replace(/\n\s*/g, " ")) && /<textarea/.test(all) && /type="submit"\s+form="polio-form-home"/.test(all) && /<FormSender id="polio-form-home" name="home"/.test(page), page.slice(0, 300));
  check("Clean code: the route is readable: it says each step in order", ["sameSite", "rateLimited", "readLimited", "checkMessage", "chooseDestination"].every((w) => text(clean, "app/api/form/route.ts").includes(w)));
  const cleanApp = await buildApp("form-small-clean", clean);
  check("Clean code: next build passes", cleanApp.ok, cleanApp.ok ? "" : BUILD_NOTE(cleanApp));
  if (cleanApp.ok) {
    const live = await drive(cleanApp, found.forms[0], "", "clean", "small", SECRET);
    if (live) {
      const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await p.goto(live.srv.url, { waitUntil: "load" });
      await p.waitForTimeout(500);
      const boxes = await p.evaluate((ids) => Object.fromEntries(ids.map((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return [id, r ? [r.x, r.y + scrollY, r.width, r.height] : null]; })), site.board.nodes.map((n) => n.id));
      const off = site.board.nodes.filter((n) => { const b = boxes[n.id]; return !b || Math.abs(b[0] - n.x) > 2 || Math.abs(b[1] - n.y) > 2 || Math.abs(b[2] - n.w) > 2 || Math.abs(b[3] - n.h) > 2; });
      check("Clean code: each part still stands on its board box, within 2px", off.length === 0, off.map((n) => `${n.id} ${JSON.stringify(boxes[n.id])}`).join("; "));
      const fit = await p.evaluate(() => { const c = document.querySelector('textarea[name="message"]'); const box = document.getElementById("n_message"); const a = c.getBoundingClientRect(), b = box.getBoundingClientRect(); return [a.height, b.height, a.width, b.width]; });
      check("Clean code: the textarea fills its drawn box", Math.abs(fit[0] - fit[1]) <= 2 && fit[2] > fit[3] - 40, fit.join(" "));
      await p.close();
      await hostile(live.srv, found.forms[0], live.outbox, "clean");
      check("Clean code: nothing typed is in the server's log", !/words your-name|senderh@|sendersmall@|plainwords/.test(live.srv.log()));
      live.srv.stop();
      check("Clean code: no secret or destination setting in what the browser loads", inStatic(cleanApp.dir, [SECRET, "FORM_DESTINATION", "FORM_TEST_OUTBOX", "polio-form-outbox"]).length === 0);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. Each site given                                                   */
/* ------------------------------------------------------------------ */

const sources = process.env.PAGES_DUMP ? process.env.PAGES_DUMP.split(",").map((d) => () => dumpedSite(d)) : captures.map((c) => () => importedSite(browser, BASE, c));
const census = [];
for (const load of sources) {
  const site = await load();
  console.log(`\n${site.name}`);
  const pages = pagesOf(site.board);
  const found = formsOf(site.board.nodes, pages, docs(site, pages));
  census.push(`${site.name}: ${found.forms.length} wired (${found.forms.map((f) => `${f.id}: ${f.fields.map((x) => x.label).join(", ")}`).join("; ") || "none"}), ${found.skipped.length} said and left`);
  console.log(`       ${census.at(-1)}`);
  for (const s of found.skipped.slice(0, 6)) console.log(`       left: ${s.part} on ${s.page}: ${s.why}`);
  if (!found.forms.length) {
    check("a site with no form gets no form file, either way", formFiles(found, "test").length === 0 && cleanFormFiles(found).length === 0);
    const one = [pages.find((p) => homeFor(pages).file(p) === "index.html") ?? pages[0]];
    const plain = exactFiles(site, one, null, ""), with0 = exactFiles(site, one, found, "");
    const same = plain.length === with0.length && plain.every((f, i) => f.path === with0[i].path && Buffer.compare(Buffer.from(f.content), Buffer.from(with0[i].content)) === 0);
    check("its exact-look files are the same with the forms step as without", same, `${plain.length} files`);
    continue;
  }
  /* Each page holding a form that sends: the page with the most-typed form is built and driven each way. */
  const form = [...found.forms].sort((a, b) => b.fields.length - a.fields.length || Number(b.fields.some((f) => f.kind === "textarea")) - Number(a.fields.some((f) => f.kind === "textarea")))[0];
  const pageOf = pages.find((p) => p.id === form.pageId);
  const onlyHere = { ...site, board: { ...site.board, nodes: site.board.nodes.filter((n) => n.pageId === form.pageId) }, files: site.files.filter((f) => /\.(css|js|html)$/.test(f.path)) };
  /* That page alone is what is built (a home page beside it, so the server has a front door), under its own route. */
  const single = [pageOf, ...(homeFor(pages).file(pageOf) === "index.html" ? [] : [])];
  const foundHere = { forms: found.forms.filter((f) => f.pageId === form.pageId), skipped: [] };
  const route = routeOf(homeFor(pages), pageOf);
  const stub = { path: "app/page.tsx", content: `export default function Home() { return <main>Home</main>; }\n` };
  for (const mode of ["exact", "clean"]) {
    const files = mode === "exact" ? exactFiles(onlyHere, single, foundHere, "") : cleanFiles(onlyHere, single, foundHere, "");
    if (route && !files.some((f) => f.path === "app/page.tsx")) files.push(stub);
    const built = await buildApp(`form-${site.name}-${mode}`, files);
    check(`${mode}: next build passes`, built.ok, built.ok ? "" : BUILD_NOTE(built));
    if (!built.ok) continue;
    const live = await drive(built, form, route, mode, site.name.replace(/\W/g, ""), SECRET);
    if (live) {
      await hostile(live.srv, form, live.outbox, mode);
      live.srv.stop();
    }
  }
}
if (census.length) console.log(`\nForms found:\n  ${census.join("\n  ")}`);

/* ------------------------------------------------------------------ */
/* 3. Through the real Export dialog                                    */
/* ------------------------------------------------------------------ */

if (BASE) {
  console.log("\nthe Export dialog: a contact form from the shelf");
  const board = boardWith([part("n_contact", 100, 100, 520, 420, { featureId: "contact-form" }), part("n_news", 100, 600, 520, 64, { featureId: "newsletter" })]);
  const setFormat = (raw) => { const v = JSON.parse(raw); v.state.format = { ...(v.state.format ?? {}), "forms.destination": "test" }; return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = setFormat(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = setFormat(row.value);
  const b = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await openBoard(b, BASE, board);
  await b.waitForTimeout(1500);
  const openDialog = async () => {
    for (let i = 0; i < 6; i++) {
      await b.keyboard.press("Escape");
      await b.keyboard.press("Control+k");
      await b.waitForTimeout(500);
      await b.keyboard.type("Export…: exact look");
      await b.waitForTimeout(600);
      await b.keyboard.press("Enter");
      if (await b.locator("[data-export-dialog]").waitFor({ timeout: 8000 }).then(() => true, () => false)) return;
    }
  };
  for (const mode of ["exact", "clean"]) {
    await openDialog();
    await b.locator(`[data-export-mode="${mode}"]`).check();
    await b.locator('[data-export-to="zip"]').check();
    const [dl] = await Promise.all([b.waitForEvent("download", { timeout: 300000 }), b.locator("[data-export-go]").click()]);
    const path = await dl.path();
    const files = zipEntries(readFileSync(path));
    const name = (p) => files.find((f) => f.path === p)?.content;
    const forms = name("forms/forms.ts")?.toString("utf8") ?? "";
    check(`${mode}: the zip reads the site's setting`, /DESTINATION: string = "test"/.test(forms), forms.slice(0, 120));
    check(`${mode}: the zip holds the route, and POLIO.md lists both forms`, !!name("app/api/form/route.ts") && /## Forms/.test(name("POLIO.md")?.toString("utf8") ?? "") && !/n_contact[^\n]*contact-form/.test((name("POLIO.md")?.toString("utf8") ?? "").split("### Forms with no action")[1] ?? ""));
    const built = await buildApp(`form-zip-${mode}`, files);
    check(`${mode}: the zip passes next build`, built.ok, built.ok ? "" : BUILD_NOTE(built));
    if (!built.ok) continue;
    const outbox = join(outboxDir, `zip-${mode}.jsonl`);
    const srv = await serve(built.dir, { FORM_TEST_OUTBOX: outbox });
    check(`${mode}: served`, srv.ok);
    if (!srv.ok) { srv.stop(); continue; }
    const p = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await p.goto(srv.url, { waitUntil: "load" });
    await p.waitForTimeout(800);
    const c = p.locator("#n_contact");
    await c.locator('input[aria-label="Name"]').fill("Sam");
    await c.locator('input[aria-label="Email"]').fill("sam@example.test");
    await c.locator('textarea[aria-label="Message"]').fill("Hello there");
    await c.locator("button").last().click();
    const said = await answerOf(p);
    const box = outboxOf(outbox);
    check(`${mode}: the shelf's contact form sends to the site's destination, and says so`, /test only/i.test(said.words) && box.at(-1)?.fields.some((f) => f.value === "Hello there"), `${said.words}; ${box.length} in the outbox`);
    await p.close();
    srv.stop();
  }
  await b.close();
}

/* A stored or deflated zip, read with what node has. */
function zipEntries(buf) {
  const out = [];
  let i = 0;
  const inflate = (data, how) => (how === 0 ? data : inflateRawSync(data));
  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const how = buf.readUInt16LE(i + 8), size = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26), m = buf.readUInt16LE(i + 28);
    const path = buf.subarray(i + 30, i + 30 + n).toString("utf8");
    const at = i + 30 + n + m;
    out.push({ path, content: inflate(buf.subarray(at, at + size), how) });
    i = at + size;
  }
  return out;
}

await browser.close();
rmSync(outboxDir, { recursive: true, force: true });
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
