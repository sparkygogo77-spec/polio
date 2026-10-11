/**
 * A KIT REPOSITORY COMES IN BY ITS builder.json, WITH ALL ITS CODE TIED TO ITS PARTS,
 * AND ITS TOKENS GO BACK AS PART OF THE STYLE LAYER.
 *
 * The fixture (tests/fixtures/kit-site) is shaped like PST with the
 * builder-ready starter kit: a builder.json at the root naming the pages (in
 * an order and with names of its own), web/hooks.json in PST's own format
 * (each hook's element, script-built flag, template, CSS variables and every
 * code reference as file + line + function + actions, and the variables' map),
 * web/tokens.css imported from web/base.css, a web/style-layer.css the pages
 * already link (empty, as PST's is), and app.js running a practice flow by
 * hooks alone: it reads a token, and builds ledger rows from a template.
 *
 *   1. the readers, pure: builder.json in its spellings, PST-format
 *      hooks.json, tokens found through an @import, the layer's tokens;
 *   2. through the Builder: brought in by the manifest (its pages, its names,
 *      parts named by hook), the part panel's code view from hooks.json with
 *      the scan for what it does not list, the tokens editable in the style
 *      layer, and the layer published to the file the manifest names;
 *   3. the original site plus that layer, with its scripts running: every
 *      hook kept, the flow works, and the tokens are what the owner set.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/code-view.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/panels/inspector/Panel.tsx, src/features/studio/panels/inspector/codeView.tsx, src/features/studio/repoRun.ts, src/app/api/studio/zip/route.ts, src/features/studio/bring-in/FromASite.tsx, src/features/studio/panels/Inspector.tsx, src/features/studio/StyleLayerPanel.tsx, src/features/studio/styleLayerRun.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { chromium } from "playwright-core";
import { readManifest } from "../src/features/studio/builderManifest.ts";
import { readHooksJson, codeIndex } from "../src/features/studio/codeRefs.ts";
import { sourceOfPage } from "../src/features/studio/sourceHooks.ts";
import { buildLayer, hookCounts } from "../src/features/studio/send-out/styleLayer.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROOT = "tests/fixtures/kit-site";
const FILES = {};
const walk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, r); else FILES[r] = readFileSync(p, "utf8"); } };
walk(ROOT);
const lineOf = (file, needle) => FILES[file].split("\n").findIndex((l) => l.includes(needle)) + 1;

/* ------------------------------------------------------------------ */
/* 1. The readers                                                       */
/* ------------------------------------------------------------------ */

const m = readManifest(FILES["builder.json"], "builder.json");
check("builder.json: its kit, its pages in its order with their titles", m?.kit === "1.0.0" && m.name === "Kit practice" && m.pages.map((p) => `${p.file}=${p.name}`).join() === "web/index.html=Play,web/ledger.html=Ledger", JSON.stringify(m?.pages));
check("builder.json: the paths to hooks.json, tokens, style layer and gallery, and its preview screens", m?.hooks === "web/hooks.json" && m.tokens === "web/tokens.css" && m.styleLayer === "web/style-layer.css" && m.gallery === "web/gallery.html" && m.screens.join() === "signed-out,deposit-review,result" && m.previewPage === "web/index.html" && m.previewQuery === "?still=1&screen=<name>");
/* The real manifests: the kit's own (kit/builder.json, every path from kit/) and PST's (its root). */
const KIT = "tests/fixtures/kit-starter";
const kitM = readManifest(readFileSync(`${KIT}/builder.json`, "utf8"), "kit/builder.json");
check("the kit's real builder.json: its pages and titles, every path from the folder it is in", kitM?.kit === "1.0.0" && kitM.name === "Starter" && kitM.pages.map((p) => `${p.file}=${p.name}`).join() === "kit/starter/index.html=Home,kit/starter/about.html=About,kit/starter/list.html=List,kit/starter/contact.html=Contact,kit/starter/game.html=Game parts" && kitM.hooks === "kit/starter/hooks.json" && kitM.tokens === "kit/starter/tokens.css" && kitM.styleLayer === "kit/starter/style-layer.css" && kitM.gallery === "kit/starter/gallery.html", JSON.stringify(kitM).slice(0, 300));
check("…its thirteen preview screens and their query, its hook helpers and link rules", kitM?.screens.length === 13 && kitM.screens[1] === "home-modal" && kitM.previewPage === "kit/starter/preview.html" && kitM.previewQuery === "?still=1&screen=<name>" && kitM.hookCalls.part === 1 && kitM.helperFiles.join() === "kit/starter/js/hooks.js" && kitM.links?.allowHosts.includes("pump.fun") && kitM.links.block.length === 2);
const pstM = readManifest(readFileSync("tests/fixtures/pst-builder.json", "utf8"), "builder.json");
check("PST's real root builder.json: five pages, its builder-hooks.json, tokens, style layer and tokens module", pstM?.name === "PonsStars" && pstM.pages.length === 5 && pstM.pages[0].name === "Play" && pstM.hooks === "web/builder-hooks.json" && pstM.tokens === "web/tokens.css" && pstM.styleLayer === "web/style-layer.css" && pstM.tokensModule === "web/tokens.js" && pstM.screens.length === 0 && pstM.hookCalls.setText === 0 && pstM.hookCalls.drop === 1, JSON.stringify(pstM).slice(0, 300));
/* The kit's hooks.json, read from the folder its builder.json is in. */
const kitHooks = readHooksJson(readFileSync(`${KIT}/starter/hooks.json`, "utf8"), "kit/starter/", { manifestDir: "kit/" });
const form = kitHooks?.refs.get("data-hook=contact-form") ?? [];
check("the kit's real hooks.json: each reference's file from builder.json's folder, what it does from `uses`, a nameless handler named by nothing", form.length >= 2 && form.every((r) => r.file === "kit/starter/js/contact.js") && form.some((r) => r.kind === "listens" && r.fn === null) && form.some((r) => r.kind === "reads" && r.fn === "send"), JSON.stringify(form).slice(0, 300));
check("…each hook's tokens, and the tokens' map with the hooks that use them", kitHooks?.meta.get("data-hook=contact-form")?.cssVariables?.includes("--space-3") && kitHooks.vars.get("--color-accent")?.default === "#2f6fde" && kitHooks.vars.get("--color-accent").usedBy.includes("send-button"));
const built = [...(kitHooks?.meta ?? [])].filter(([, v]) => v.scriptBuilt);
check("…the parts its scripts build from templates", built.length > 0 && built.every(([, v]) => typeof v.template === "string" && v.template.startsWith("template-")), built.slice(0, 3).map(([k, v]) => `${k} ${v.template}`).join(", "));
check("a name a script builds is found by the comment the contract asks for", (codeIndex([{ path: "a.js", text: "const page = 'x';\nhook(`nav-${page}`).setAttribute('aria-current', 'page'); // hooks: nav-{home,about,list}\n" }], [{ attr: "data-hook", value: "nav-about" }]).refs.get("data-hook=nav-about") ?? []).some((r) => r.line === 2 && r.kind === "styles"));
check("a json that is not a manifest is not taken for one", readManifest("{}") === null && readManifest("not json") === null);

const hj = readHooksJson(FILES["web/hooks.json"], "web/");
const you = (hj?.refs.get("data-hook=score-you") ?? []).filter((r) => r.file.endsWith(".js"));
check("hooks.json in PST's shape: each reference with its file from the json's folder, line, function and what it does", you.length === 2 && you[0].file === "web/app.js" && you[0].fn === "review" && you[0].kind === "reads" && you[1].kind === "writes", JSON.stringify(you));
check("hooks.json: \"(top level)\" is the top of the file, not a function", hj?.refs.get("data-hook=deposit-review")?.[0]?.fn === null);
check("hooks.json: one reference doing two things is two", (hj?.refs.get("data-hook=balance-note") ?? []).map((r) => r.kind).join() === "writes,styles");
check("hooks.json: a hook built by a script from a template, and the variables a hook uses", hj?.meta.get("data-hook=ledger-row")?.scriptBuilt === true && hj.meta.get("data-hook=ledger-row").template === "template-ledger-row" && hj.meta.get("data-hook=ledger-row").repeats === true && hj.meta.get("data-hook=score-you")?.cssVariables?.join() === "--pons-gain,--pons-loss");
check("hooks.json: the variables' map, with the code that reads each", hj?.vars.get("--pons-gain")?.default === "#16a34a" && hj.vars.get("--pons-gain").readBy[0]?.fn === "review" && hj.vars.get("--pons-gain").readBy[0].line === lineOf("web/app.js", "getPropertyValue('--pons-gain')"));
const idx = codeIndex([{ path: "web/app.js", text: FILES["web/app.js"] }, { path: "web/hooks.json", text: FILES["web/hooks.json"] }], [{ attr: "data-hook", value: "score-you" }, { attr: "data-hook", value: "balance-message" }]);
check("a line hooks.json calls a read is read off the line where it says more: setText writes", idx.refs.get("data-hook=score-you") && codeIndex([{ path: "web/app.js", text: FILES["web/app.js"] }, { path: "web/hooks.json", text: FILES["web/hooks.json"] }], [{ attr: "data-hook", value: "wallet-address" }]).refs.get("data-hook=wallet-address")?.[0]?.kind === "writes");
check("a hook hooks.json lists is taken from it; one it does not is found by reading the scripts", idx.listed.has("data-hook=score-you") && !idx.listed.has("data-hook=balance-message") && (idx.refs.get("data-hook=balance-message") ?? []).some((r) => r.kind === "writes" && r.fn === "review"));

const open = (p) => (FILES[p] !== undefined ? { file: p, text: FILES[p] } : null);
const src = sourceOfPage("web/index.html", FILES["web/index.html"], open);
const tok = src.vars.filter((v) => v.token).map((v) => v.name).sort().join();
check("tokens.css is found through base.css's @import, and its variables are tokens", tok === "--font-body,--pons-gain,--pons-loss,--space-2" && src.vars.find((v) => v.name === "--space-2")?.line === lineOf("web/tokens.css", "--space-2"), tok);
const unlinked = sourceOfPage("web/ledger.html", "<html><head></head><body></body></html>", open, { tokens: "web/tokens.css" });
check("a tokens file the manifest names is read even where no page links it", unlinked.vars.filter((v) => v.token).length === 4);
const tsource = { repo: "him/kit", ref: "main", dir: "web/", files: [{ file: "web/index.html", pageId: "page_home", hooks: [], vars: src.vars }], varsSet: { "--space-2": "12px", "--pons-gain": "#00aa88" } };
const tl = buildLayer([], null, tsource);
check("the layer lists every token and sets the ones set, a size as well as a colour", tl.tokens.length === 4 && tl.tokens.find((t) => t.name === "--space-2")?.now === "12px" && tl.vars.every((v) => v.token) && /:root:root \{[\s\S]*--space-2: 12px; \/\* token, was 8px \*\//.test(tl.css), tl.css);
check("and says so plainly", /Design tokens in web\/tokens\.css: 4, 2 set by the layer/.test(tl.says) && /tokens file itself is left as it is/.test(tl.says), tl.says);
const face = buildLayer([{ id: "a", pageId: "p", featureId: "prose", x: 0, y: 0, w: 10, h: 10, font: { stack: "Inter, sans-serif", px: 16, size: 1 }, source: { file: "f", hook: { attr: "data-hook", value: "a" }, was: { box: { x: 0, y: 0, w: 10, h: 10 }, words: "", fontFamily: "Georgia, serif", fontSize: 16 } } }], null, { ...tsource, varsSet: {} });
check("a face token follows the board when every part in that face now wears another", face.vars.some((v) => v.name === "--font-body" && v.value === "Inter, sans-serif" && v.why === "followed"), JSON.stringify(face.vars));

/* ------------------------------------------------------------------ */
/* 2. Through the Builder                                               */
/* ------------------------------------------------------------------ */

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));
const refs = { "heads/main": "c0" };
const wrote = [];
const pulls = [];
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/kit(\/.*)?$/);
  if (!mm) return j({ message: "no" }, 404);
  const rest = mm[1] ?? "";
  const method = r.request().method();
  const body = method === "POST" ? JSON.parse(r.request().postData() ?? "{}") : null;
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/") && method === "GET") return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: Buffer.from(FILES[names[Number(b[1])]]).toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10)); return FILES[f] !== undefined ? j({ content: Buffer.from(FILES[f]).toString("base64") }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return refs[`heads/${decodeURIComponent(rest.slice(15))}`] ? j({ object: { sha: "c0" } }) : j({}, 404);
  if (rest.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: "t0" } });
  if (rest === "/git/blobs" && method === "POST") { wrote.push({ content: body.content }); return j({ sha: `w${wrote.length}` }, 201); }
  if (rest === "/git/trees" && method === "POST") { body.tree.forEach((t, i) => { const w = wrote[Number(t.sha.slice(1)) - 1]; if (w) w.path = t.path; void i; }); return j({ sha: "t1" }, 201); }
  if (rest === "/git/commits" && method === "POST") return j({ sha: "c1" }, 201);
  if (rest === "/git/refs" && method === "POST") { refs[body.ref.replace("refs/", "")] = "c1"; return j({ ref: body.ref }, 201); }
  if (rest === "/pulls" && method === "POST") { pulls.push(body); return j({ html_url: `https://github.com/him/kit/pull/${pulls.length}`, draft: body.draft }, 201); }
  return j({ message: "no" }, 404);
});
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await ui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Kit", updatedAt: Date.now() }], activeId: "s1" }));
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
await ui.locator("[data-repo-bring]").fill("him/kit");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 90 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(1500);
st = await board();
const ss = st.look?.styleSource;
check("brought in by its manifest: its pages, in its order, by its names", st.pages.map((p) => p.name).join() === "Play,Ledger", st.pages.map((p) => p.name).join());
check("its parts are named by their hooks", st.nodes.find((n) => n.hooks?.["data-hook"] === "balance-note")?.label === "balance-note" && st.nodes.find((n) => n.hooks?.["data-hook"] === "deposit-review")?.label === "deposit-review");
check("the site knows its layer file, its tokens file and its manifest", ss?.layerFile === "web/style-layer.css" && ss.tokensFile === "web/tokens.css" && ss.manifest?.kit === "1.0.0" && ss.manifest.previews?.length === 3, JSON.stringify({ layer: ss?.layerFile, tokens: ss?.tokensFile, m: ss?.manifest }));
const strip = await ui.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "");
check("the line says it was read from the manifest, and lists the preview screens it did not bring", /Read from its builder\.json \(Kit practice, kit 1\.0\.0\)/.test(strip) && /3 preview screens \(signed-out, deposit-review, result\)/.test(strip), strip.slice(-400));
const code = (h) => st.nodes.find((n) => n.hooks?.["data-hook"] === h)?.source?.code;
check("code view: a hook hooks.json lists is tied by it, even where the scripts never name it", code("balance-note")?.from === "hooks.json" && code("balance-note").refs.some((r) => r.fn === "renderNote" && r.file === "web/app.js"), JSON.stringify(code("balance-note")));
check("code view: a stylesheet hooks.json lists among a hook's references is a CSS rule, not a script", code("score-you")?.css.some((c) => c.file === "web/base.css" && c.selector.includes('[data-sign="loss"]')) && !code("score-you").refs.some((r) => r.file.endsWith(".css")));
check("code view: one hooks.json does not list is found by reading the scripts", code("balance-message")?.from === "scan" && code("balance-message").refs.some((r) => r.kind === "writes"));
check("code view: the CSS variables a hook uses, and the rules in base.css that style it", code("score-you")?.vars?.join() === "--pons-gain,--pons-loss" && code("score-you").css.some((c) => c.file === "web/base.css" && c.line === lineOf("web/base.css", '[data-sign="gain"]')), JSON.stringify(code("score-you")?.css));
const row = st.nodes.find((n) => n.hooks?.["data-hook"] === "ledger-row");
check("code view: a part built by a script from a template says so, and which template", row?.source?.code?.scriptBuilt === true && row.source.code.template === "template-ledger-row" && row.source.code.repeats === true && !!row.state, JSON.stringify(row?.source?.code ?? null).slice(0, 200));
/* The panel itself, on a part its code writes. */
const youId = st.nodes.find((n) => n.hooks?.["data-hook"] === "score-you")?.id;
await ui.keyboard.press("Escape");
await ui.locator(`[data-node-id="${youId}"]`).first().click({ force: true }).catch(() => {});
await ui.waitForTimeout(800);
/* The panel, trimmed: four sections open, the rest under one More, the code one line until pressed, no Every CSS slot. */
const heads = await ui.evaluate(() => Array.from(document.querySelectorAll("[data-part-panel] [data-part-section]:not([data-inside])")).map((s) => `${s.getAttribute("data-part-section")}${s.hasAttribute("data-open") ? "+" : ""}`));
check("a picked part shows 5 section heads: Content, Position, Look, Motion open, More folded", heads.join() === "content+,place+,look+,motion+,more", heads.join());
check("…its code settings one line, closed, and no Every CSS slot", await ui.evaluate(() => !!document.querySelector("[data-part-panel] [data-code-line-row]:not([data-open])") && !document.querySelector("[data-part-panel] [data-code-view]") && !document.querySelector('[data-part-panel] [data-fold="look-css"]') && /Filled by code · \d+ scripts?/.test(document.querySelector("[data-code-line-head]")?.textContent ?? "")));
await ui.locator('[data-part-panel] [data-part-section="more"] > [data-section-head]').click();
await ui.waitForTimeout(300);
const inMore = await ui.evaluate(() => Array.from(document.querySelectorAll('[data-part-section="more"] [data-part-section][data-inside]')).map((s) => s.getAttribute("data-part-section")));
check("More holds Save as a component and the prompt (or name)", inMore.includes("save-component") && (inMore.includes("prompt") || inMore.includes("name")), inMore.join());
await ui.locator("[data-code-line-head]").first().click();
await ui.waitForTimeout(300);
const view = await ui.evaluate(() => { const v = document.querySelector("[data-code-view]"); return v ? { text: v.textContent, links: Array.from(v.querySelectorAll("a")).map((a) => a.getAttribute("href")) } : null; });
check("the part panel shows it: hooks.json as the source, the variables, each reference linked to its line", !!view && /from the repository's hooks\.json/.test(view.text) && /Uses the CSS variables --pons-gain, --pons-loss/.test(view.text) && view.links.some((h) => /github\.com\/him\/kit\/blob\/main\/web\/app\.js#L\d+/.test(h ?? "")), JSON.stringify(view).slice(0, 300));
check("and it is read only", await ui.evaluate(() => !document.querySelector("[data-code-view] input, [data-code-view] textarea, [data-code-view] [contenteditable]")));
/* Show the code: the script lines themselves, fetched from the repository, the reference's own line marked. */
await ui.locator("[data-code-lines-open]").first().click();
await ui.waitForSelector("[data-code-lines]", { timeout: 10000 }).catch(() => {});
const shown = await ui.evaluate(() => { const v = document.querySelector("[data-code-lines]"); return v ? { at: Array.from(v.querySelectorAll('[data-code-line="at"]')).map((l) => l.textContent), lines: v.querySelectorAll("[data-code-line]").length, refs: Array.from(v.querySelectorAll("[data-code-lines-ref]")).map((r) => r.getAttribute("data-code-lines-ref")) } : null; });
const appRef = code("score-you").refs.find((r) => r.file === "web/app.js");
check("script viewer: Show the code fetches the file and shows lines around each reference, its own line marked", !!shown && !!appRef && shown.refs.includes(`web/app.js:${appRef.line}`) && shown.lines > shown.at.length && shown.at.some((t) => t.includes(FILES["web/app.js"].split("\n")[appRef.line - 1].trim())), JSON.stringify(shown).slice(0, 300));
check("and the viewer is read only too", await ui.evaluate(() => !document.querySelector("[data-code-lines] input, [data-code-lines] textarea, [data-code-lines] [contenteditable]")));
/* Script settings: the tokens this part and its code use, editable here, kept as token changes. */
const settings = await ui.evaluate(() => Array.from(document.querySelectorAll("[data-part-settings] [data-style-layer-var]")).map((v) => v.getAttribute("data-style-layer-var")));
check("script settings: the part lists the tokens it uses, --pons-gain and --pons-loss", settings.includes("--pons-gain") && settings.includes("--pons-loss"), JSON.stringify(settings));
await ui.locator('[data-part-settings] [data-style-layer-var="--pons-loss"] input[type="color"]').fill("#cc2244");
await ui.waitForTimeout(300);
check("and a change there is a token change in the style layer", (await board()).look?.styleSource?.varsSet?.["--pons-loss"] === "#cc2244");
await ui.locator('[data-part-settings] [data-style-layer-var="--pons-loss"] button').first().click();
await ui.waitForTimeout(300);
check("…and Reset takes it back", (await board()).look?.styleSource?.varsSet?.["--pons-loss"] === undefined);
/* Ask the code chat: the request goes to a new request/ branch as a file with the hook and its code, and a draft pull request. */
const wroteBefore = wrote.length;
await ui.locator("[data-ask-code-text]").first().fill("Make the score flash when it changes.");
await ui.locator("[data-ask-code-send]").first().click();
await ui.waitForSelector("[data-ask-code-said]:not(:empty)", { timeout: 5000 }).catch(() => {});
for (let i = 0; i < 70 && !(await ui.evaluate(() => /pull request|could not|would not|Refused/.test(document.querySelector("[data-ask-code-said]")?.textContent ?? ""))); i++) await ui.waitForTimeout(1000);
const askFile = wrote.slice(wroteBefore).find((w) => /^requests\/score-you-\d+\.md$/.test(w.path ?? ""));
const askText = askFile ? (/^[A-Za-z0-9+/=\s]+$/.test(askFile.content) && !askFile.content.includes(" ") ? Buffer.from(askFile.content, "base64").toString() : askFile.content) : "";
const askPull = pulls.find((p) => /^request\/score-you-/.test(p.head));
check("ask the code chat: a request file on a new request/ branch, with the words, the hook and its code", !!askFile && askText.includes("Make the score flash when it changes.") && askText.includes('data-hook="score-you"') && /web\/app\.js` line \d+/.test(askText) && Object.keys(refs).some((r) => /^heads\/request\/score-you-/.test(r)), askText.slice(0, 300) || JSON.stringify(wrote.slice(wroteBefore).map((w) => w.path)));
check("…and a draft pull request into main, never a write to main", !!askPull && askPull.draft === true && askPull.base === "main" && refs["heads/main"] === "c0", JSON.stringify(askPull ?? pulls).slice(0, 200));
/* The request's writes are its own branch's; what follows counts the style layer's alone. */
wrote.length = 0;
for (const k of Object.keys(refs)) if (k.startsWith("heads/request/")) delete refs[k];

/* The tokens, editable in the style layer, and the layer published where the manifest says. */
await ui.keyboard.press("Escape");
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(800);
const section = ui.locator("[data-style-layer-panel]");
check("the style layer section lists the tokens and where the layer goes", /Design tokens: 4 in web\/tokens\.css, 0 set/.test(await section.locator("[data-style-layer-says]").innerText()) && /builder\.json, kit 1\.0\.0: the layer is written to web\/style-layer\.css/.test(await section.locator("[data-style-layer-manifest]").innerText()));
await section.locator("[data-style-layer-more]").click();
await ui.waitForTimeout(300);
await section.locator('[data-style-layer-var="--space-2"] input').fill("12px");
await section.locator('[data-style-layer-var="--space-2"] input').press("Enter");
await section.locator('[data-style-layer-var="--pons-gain"] input[type="color"]').fill("#00aa88");
await ui.waitForTimeout(500);
check("tokens of every kind are editable: a size typed, a colour picked", /2 set by the layer/.test(await section.locator("[data-style-layer-says]").innerText()));
await section.locator("[data-style-layer-send]").click();
let said = "";
for (let i = 0; i < 30 && !/compare|Refused|would not/i.test(said); i++) { await ui.waitForTimeout(500); said = await section.locator("[data-style-layer-said]").innerText().catch(() => ""); }
/* This fixture keeps PST's older shape (an old hooks map, tokens through an @import, unhooked headings), which the kit's contract does not allow: the kit's own check refuses the design in its own words and nothing is written. The starter below, built to the contract, goes all the way. */
check("a repository whose code breaks the kit's contract: the design is refused in the kit's own words, and nothing is written", /The kit's check finds \d+ problems? with the code/.test(said) && wrote.length === 0 && !Object.keys(refs).some((k) => k.startsWith("heads/style/")), said.slice(0, 200));
/* The layer the board makes, as the kit's contract writes it, for the live check below. */
const stNow = await board();
const layerFile = buildLayer(stNow.nodes, stNow.look.palette, stNow.look.styleSource, { kit: true }).css;
check("the board's layer sets the tokens the owner set, as the contract writes them", /--space-2: 12px/.test(layerFile) && /--pons-gain: #00aa88/.test(layerFile), layerFile.slice(-300));
check("no errors in the Builder", errors.length === 0, errors.slice(0, 3).join(" | "));
await ui.close();

/* ------------------------------------------------------------------ */
/* 3. The original site plus the layer, scripts running                  */
/* ------------------------------------------------------------------ */

const served = { ...FILES, "web/style-layer.css": layerFile };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "") || "web/index.html";
  const body = served[path];
  if (body === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const live = await browser.newPage();
const liveErrors = [];
live.on("pageerror", (e) => liveErrors.push(e.message));
await live.goto(`http://127.0.0.1:${server.address().port}/web/index.html`, { waitUntil: "load" });
const all = [...hookCounts(FILES["web/index.html"]).keys()].filter((k) => k.startsWith("data-hook="));
const missing = await live.evaluate((list) => list.filter((k) => { const v = k.slice(10); return !document.querySelector(`[data-hook="${v}"]`) && !Array.from(document.querySelectorAll("template")).some((t) => t.content.querySelector(`[data-hook="${v}"]`)); }), all);
check("every hook is still there, those in the template too", missing.length === 0, missing.join(", "));
await live.click('[data-hook="wallet-connect-test"]');
await live.fill('[data-hook="deposit-amount"]', "3");
await live.click('[data-hook="deposit-review"]');
const after = await live.evaluate(() => ({
  address: document.querySelector('[data-hook="wallet-address"]').textContent,
  message: document.querySelector('[data-hook="balance-message"]').textContent,
  rows: document.querySelectorAll('[data-hook="ledger-row"]').length,
  rowMargin: getComputedStyle(document.querySelector('[data-hook="ledger-row"]')).marginTop,
  gain: window.gainColour,
  you: getComputedStyle(document.querySelector('[data-hook="score-you"]')).color,
}));
check("the scripts still run the flow by hooks: signed in, deposited, a row built from the template", after.address === "Test1111wallet" && after.message === "Deposited 3 SOL." && after.rows === 1, JSON.stringify(after));
check("the tokens are what the owner set: the script reads the new colour, and the size reaches the built row", after.gain === "#00aa88" && after.you === "rgb(0, 170, 136)" && after.rowMargin === "12px");
check("no script error on the page", liveErrors.length === 0, liveErrors.join(" | "));
server.close();

/* ------------------------------------------------------------------ */
/* 4. The kit's own starter, as a repository of its own                 */
/* ------------------------------------------------------------------ */

const KF = {};
const kwalk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) kwalk(p, r); else KF[r] = readFileSync(p, "utf8"); } };
kwalk(KIT);
const knames = Object.keys(KF);
const ktree = knames.map((f, i) => ({ path: f, type: "blob", sha: `k${i}`, size: KF[f].length }));
const krefs = { "heads/main": "c0" };
const kwrote = [];
const kui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const kerr = [];
kui.on("pageerror", (e) => kerr.push(e.message));
await kui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/starter(\/.*)?$/);
  if (!mm) return j({ message: "no" }, 404);
  const rest = mm[1] ?? "";
  const method = r.request().method();
  const body = method === "POST" ? JSON.parse(r.request().postData() ?? "{}") : null;
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/") && method === "GET") return j({ tree: ktree });
  const b = /\/git\/blobs\/k(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: Buffer.from(KF[knames[Number(b[1])]]).toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10)); return KF[f] !== undefined ? j({ content: Buffer.from(KF[f]).toString("base64") }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return krefs[`heads/${decodeURIComponent(rest.slice(15))}`] ? j({ object: { sha: "c0" } }) : j({}, 404);
  if (rest.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: "t0" } });
  if (rest === "/git/blobs" && method === "POST") { kwrote.push({ content: body.content }); return j({ sha: `w${kwrote.length}` }, 201); }
  if (rest === "/git/trees" && method === "POST") { body.tree.forEach((t) => { const w = kwrote[Number(t.sha.slice(1)) - 1]; if (w) w.path = t.path; }); return j({ sha: "t1" }, 201); }
  if (rest === "/git/commits" && method === "POST") return j({ sha: "c1" }, 201);
  if (rest === "/git/refs" && method === "POST") { krefs[body.ref.replace("refs/", "")] = "c1"; return j({ ref: body.ref }, 201); }
  return j({ message: "no" }, 404);
});
await kui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await kui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Starter", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await kui.reload({ waitUntil: "networkidle" });
await kui.waitForTimeout(900);
const kkeys = kui.locator("[data-keys-panel]");
await kui.getByRole("button", { name: "Keys", exact: true }).click();
await kui.waitForTimeout(500);
const kskip = kkeys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await kskip.count()) { await kskip.first().click(); await kui.waitForTimeout(300); }
await kkeys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await kkeys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await kui.waitForTimeout(500);
await kkeys.getByRole("button", { name: "Close keys" }).click();
await kui.waitForTimeout(500);
await kui.locator("[data-github-button]").first().click();
await kui.waitForTimeout(700);
await kui.locator("[data-repo-bring]").fill("him/starter");
await kui.locator("[data-repo-pull]").click();
const kboard = () => kui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let kst = await kboard();
for (let i = 0; i < 90 && !kst.nodes.length; i++) { await kui.waitForTimeout(1000); kst = await kboard(); }
await kui.waitForTimeout(1500);
kst = await kboard();
check("the real starter comes in by its builder.json: Home, About, List, Contact, Game parts", kst.pages.map((p) => p.name).join() === "Home,About,List,Contact,Game parts", kst.pages.map((p) => p.name).join());
const kcode = (h) => kst.nodes.find((n) => n.hooks?.["data-hook"] === h)?.source?.code;
check("…every part named by its hook, its code view from its hooks.json, linked to files that exist", kst.nodes.filter((n) => n.hooks?.["data-hook"]).every((n) => n.label === n.hooks["data-hook"]) && kcode("send-button")?.from === "hooks.json" && kst.nodes.flatMap((n) => n.source?.code?.refs ?? []).every((r) => KF[r.file] !== undefined), [...new Set(kst.nodes.flatMap((n) => n.source?.code?.refs ?? []).map((r) => r.file).filter((f) => KF[f] === undefined))].join(", "));
check("…its tokens are tokens, read from starter/tokens.css", (kst.look?.styleSource?.files ?? []).flatMap((f) => f.vars).some((v) => v.token && v.name === "--color-accent" && v.file === "starter/tokens.css") && kst.look.styleSource.layerFile === "starter/style-layer.css");
await kui.keyboard.press("Escape");
await kui.locator("[data-github-button]").first().click();
await kui.waitForTimeout(800);
const ksec = kui.locator("[data-style-layer-panel]");
await ksec.locator("[data-style-layer-more]").click();
await kui.waitForTimeout(300);
await ksec.locator('[data-style-layer-var="--color-accent"] input[type="color"]').fill("#00aa88");
await kui.waitForTimeout(400);
await ksec.locator("[data-style-layer-send]").click();
let ksaid = "";
for (let i = 0; i < 30 && !/compare|Refused|would not/i.test(ksaid); i++) { await kui.waitForTimeout(500); ksaid = await ksec.locator("[data-style-layer-said]").innerText().catch(() => ""); }
const klayer = kwrote.find((w) => w.path === "starter/style-layer.css")?.content ?? "";
check("its accent token, set on the board, goes back in starter/style-layer.css and nowhere else (the design record beside it)", /--color-accent: #00aa88/.test(klayer) && kwrote.filter((w) => w.path !== "design/record.json").length === 1 && kwrote.some((w) => w.path === "design/record.json"), `${kwrote.map((w) => w.path).join()} ${ksaid.slice(0, 1200)}`);
check("no errors in the Builder with the starter", kerr.length === 0, kerr.slice(0, 3).join(" | "));
await kui.close();
const kserved = { ...KF, "starter/style-layer.css": klayer };
const kserver = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "");
  const body = kserved[path];
  if (body === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body);
});
await new Promise((r) => kserver.listen(0, "127.0.0.1", r));
const kp = await browser.newPage();
const klive = [];
kp.on("pageerror", (e) => klive.push(e.message));
await kp.goto(`http://127.0.0.1:${kserver.address().port}/starter/contact.html`, { waitUntil: "load" });
await kp.waitForTimeout(300);
const kmissing = await kp.evaluate((list) => list.filter((v) => !document.querySelector(`[data-hook="${v}"]`)), [...hookCounts(KF["starter/contact.html"]).keys()].filter((k) => k.startsWith("data-hook=")).map((k) => k.slice(10)));
await kp.click('[data-hook="send-button"]');
/* The starter switches parts by data-state (kit rule: set data-state on its panel), so what shows is read as drawn. */
const errorsShown = await kp.evaluate(() => document.querySelector('[data-hook="name-error"]').checkVisibility() && document.querySelector('[data-hook="email-error"]').checkVisibility());
await kp.fill('[data-hook="name-input"]', "Sample Person");
await kp.fill('[data-hook="email-input"]', "sample@example.com");
await kp.click('[data-hook="send-button"]');
const sent = await kp.evaluate(() => ({ sent: document.querySelector('[data-hook="form-sent"]').checkVisibility(), form: !document.querySelector('[data-hook="contact-form"]').checkVisibility(), accent: getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() }));
check("the starter with the layer: every hook on its contact page kept", kmissing.length === 0, kmissing.join(", "));
check("…its script still checks the form and sends it", errorsShown && sent.sent && sent.form, JSON.stringify(sent));
check("…and its accent token is the owner's", sent.accent === "#00aa88");
check("…with no script error", klive.length === 0, klive.join(" | "));
kserver.close();
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
