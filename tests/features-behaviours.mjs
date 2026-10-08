#!/usr/bin/env node
/**
 * THE BEHAVIOUR FEATURES: WORKING PARTS THAT MOVE, COPY AND SHOW.
 *
 * THE OWNER'S GOAL: any part on the board can be given a behaviour, and it
 * works on the published site exactly as it will for a visitor. Six of them,
 * each a manifest plus a plain browser script, attachable to any part:
 *   · Reveal on scroll — fades / slides in as the part comes into view;
 *   · Copy with toast — a click copies the part's words (or given text) and
 *     says so in a small toast: a contract address people can take;
 *   · Tilt — the part leans toward the mouse, or drifts as the page scrolls;
 *   · Follow the pointer — an eye's pupil looks at the cursor, within its box;
 *   · Marquee loop — the part's contents run round and round;
 *   · Embed — another page inside the part, sandboxed, at the part's size.
 * And the owner's own two from trumpmorty.fun, carried over as features:
 *   · CRT loader — the tuning screen that switches off like an old set;
 *   · Dust — specks drifting up through the part.
 * Everything that moves holds still for a visitor who asked for less motion.
 *
 * Held here: the manifests, the one box's reading, what publishing ships, and
 * each script run as published — the exported runtime.js and <id>.js files,
 * on a stand-in static page, in a real browser.
 *
 *   node --experimental-strip-types tests/features-behaviours.mjs
 */
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { chromium } from "playwright-core";
import { LIBRARY, getWork, featureFiles, pageFeatureTags, pageFeatures, matchWorks, usesOf, withWork, withoutWork, withInput, withSwitch, describeWork } from "../src/features/studio/shelf/library/works.ts";
import { readWords } from "../src/features/studio/shelf/library/read.ts";
import { contractFiles } from "../src/features/studio/shelf/library/contract.ts";
import { foundIn, offersFrom } from "../src/features/studio/shelf/library/roundTrip.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const IDS = ["reveal", "copy-toast", "tilt", "follow-pointer", "marquee", "embed", "crt-loader", "dust-canvas", "scroll-header", "blink"];
const CATEGORIES = new Set(["structure", "nav", "hero", "content", "media", "motion", "interact", "forms", "data", "social", "ai", "platform"]);
const NEEDS = new Set(["none", "wallet", "backend", "key"]);

/* ------------------------------------------------------------ manifests */
for (const id of IDS) {
  const w = getWork(id);
  if (!w) { check(`${id}: in the library`, false, "missing"); continue; }
  const m = w.manifest;
  check(`${id}: a manifest with name, category, inputs, needs and a shelf look`,
    !!m.name && CATEGORIES.has(m.category) && Array.isArray(m.inputs) && NEEDS.has(m.needs) && !!m.look?.sample && m.says.length > 0,
    `${m.name} · ${m.category} · needs ${m.needs}`);
  check(`${id}: runs on a static page as published`, m.needs === "none");
  check(`${id}: plain data, as a repository would hold it`, JSON.stringify(JSON.parse(JSON.stringify(m))) === JSON.stringify(m));
  check(`${id}: a script that defines its own id`, w.script.includes(`define(${JSON.stringify(id)}`));
  if (id !== "copy-toast" && id !== "embed") check(`${id}: asks whether the visitor wants less motion`, /prefers-reduced-motion/.test(w.script));
}
const inputIds = (id) => (getWork(id)?.manifest.inputs ?? []).map((i) => i.id).join(",");
check("Reveal's options: direction, distance, delay, once", ["direction", "distance", "delay", "once"].every((k) => inputIds("reveal").split(",").includes(k)), inputIds("reveal"));
check("Copy's options: the text to copy, and what the toast says", ["text", "toast"].every((k) => inputIds("copy-toast").split(",").includes(k)), inputIds("copy-toast"));
check("Tilt's options: strength, axis, mode", ["strength", "axis", "mode"].every((k) => inputIds("tilt").split(",").includes(k)), inputIds("tilt"));
check("Tilt's mode is mouse or scroll", JSON.stringify(getWork("tilt")?.manifest.inputs.find((i) => i.id === "mode")?.values) === JSON.stringify(["mouse", "scroll"]));
check("Follow the pointer's option: max travel", inputIds("follow-pointer").split(",").includes("travel"), inputIds("follow-pointer"));
check("Marquee's options: speed, direction, pause on hover", ["speed", "direction", "pause"].every((k) => inputIds("marquee").split(",").includes(k)), inputIds("marquee"));
check("Reveal also: a starting scale, how long it takes, its curve, what it scales about, and whether it waits for the loader", ["scale", "duration", "ease", "origin", "after"].every((k) => inputIds("reveal").split(",").includes(k)), inputIds("reveal"));
check("Follow the pointer can be a layer: across, down, with the scroll", JSON.stringify(getWork("follow-pointer")?.manifest.inputs.find((i) => i.id === "how")?.values) === JSON.stringify(["move", "turn", "layer"]) && ["x", "y", "scroll"].every((k) => inputIds("follow-pointer").split(",").includes(k)), inputIds("follow-pointer"));
check("Header bar on scroll's options: after how far, the fill, the edge", ["at", "background", "edge"].every((k) => inputIds("scroll-header").split(",").includes(k)), inputIds("scroll-header"));
check("Blink's options: every, how", ["every", "how"].every((k) => inputIds("blink").split(",").includes(k)), inputIds("blink"));
check("the fine options wait under More", ["scale", "duration", "ease", "origin", "after"].every((k) => getWork("reveal").manifest.inputs.find((i) => i.id === k)?.advanced) && !getWork("reveal").manifest.inputs.find((i) => i.id === "distance")?.advanced);
check("Embed asks for the address", getWork("embed")?.manifest.inputs.some((i) => i.id === "url" && i.required));

/* ------------------------------------------------------- the one box */
{
  const works = LIBRARY.map((w) => w.manifest);
  const read = (text) => readWords(text, { pages: [{ id: "page_home", name: "Home", path: "/" }], works, drawsWords: true, words: "Hello" });
  const said = [
    ["reveal on scroll", "reveal"], ["fade in on scroll", "reveal"], ["copy with toast", "copy-toast"], ["click to copy", "copy-toast"],
    ["tilt toward the mouse", "tilt"], ["parallax", "tilt"], ["follow the pointer", "follow-pointer"], ["eye follows cursor", "follow-pointer"],
    ["marquee", "marquee"], ["scrolling ticker loop", "marquee"], ["crt loader", "crt-loader"], ["floating dust", "dust-canvas"],
    ["header bar on scroll", "scroll-header"], ["blinking light", "blink"], ["pointer parallax", "follow-pointer"],
  ];
  for (const [text, id] of said) {
    const r = read(text);
    check(`"${text}" attaches ${id}`, r.kind === "work" && r.work.id === id, r.kind === "work" ? r.work.id : r.kind);
  }
  const e = read("embed https://example.com/chart");
  check("\"embed <address>\" attaches Embed with that address", e.kind === "work" && e.work.id === "embed" && e.work.inputs.url === "https://example.com/chart", JSON.stringify(e.work ?? e.kind));
  check("a bare address is still a link, not an embed", read("https://example.com").kind === "link");
  check("\"price\" still asks between the two price features only", (() => { const r = read("price"); return r.kind === "ask" && r.options.every((o) => o.kind === "work" && /price/.test(o.work.id)); })());
  check("\"sol price\" is still Live SOL price", matchWorks("sol price", works)[0]?.manifest.id === "sol-price");
}

/* ------------------------------------------------------ what publishes */
{
  const nodes = IDS.map((id, i) => ({ id: `p${i}`, work: { id, inputs: {} } }));
  const files = featureFiles(nodes).map((f) => f.path).sort();
  check("publishing ships the runtime and each behaviour's script", IDS.every((id) => files.includes(`assets/features/${id}.js`)) && files.includes("assets/features/runtime.js"), files.join(", "));
}

/* -------------------------------------------- two on one part */
{
  const two = withWork({ id: "reveal", inputs: { distance: "48" } }, { id: "copy-toast", inputs: {} });
  check("a second feature joins the first on a part", usesOf(two).map((u) => u.id).join() === "reveal,copy-toast" && two.inputs.distance === "48", JSON.stringify(two));
  check("…the same one again replaces its old use", usesOf(withWork(two, { id: "reveal", inputs: { once: "no" } })).map((u) => `${u.id}:${JSON.stringify(u.inputs)}`).join() === 'copy-toast:{},reveal:{"once":"no"}');
  check("…live data over live data replaces, since both write the words", usesOf(withWork(withWork(null, { id: "sol-price", inputs: {} }), { id: "token-price", inputs: {} })).map((u) => u.id).join() === "token-price");
  check("…taken off, the other stays; the last taken off leaves none", usesOf(withoutWork(two, "reveal")).map((u) => u.id).join() === "copy-toast" && withoutWork(withoutWork(two, "reveal"), "copy-toast") === null);
  check("…an input set on one is set on that one only", withInput(two, "copy-toast", "toast", "Yes").also[0].inputs.toast === "Yes" && !("toast" in withInput(two, "copy-toast", "toast", "Yes").inputs));
  check("…said in a sentence as both", describeWork(two) === "Reveal on scroll + Copy with toast", describeWork(two));
  const pf = pageFeatures([{ id: "a", work: two }]);
  check("…and the page binds both to it, loading both", pf.bindings.map((b) => `${b.part}:${b.feature}`).join() === "a:reveal,a:copy-toast" && pf.scripts.join() === "runtime.js,reveal.js,copy-toast.js", pf.scripts.join());
}

/* ------------------------------------------------ a switch per feature */
{
  const two = withWork({ id: "reveal", inputs: { distance: "48" } }, { id: "blink", inputs: { every: "2" } });
  const off = withSwitch(two, "blink", false);
  check("a feature switched off keeps its settings", usesOf(off).find((u) => u.id === "blink")?.off === true && usesOf(off).find((u) => u.id === "blink")?.inputs.every === "2", JSON.stringify(off));
  check("…and the page neither binds nor loads it", pageFeatures([{ id: "a", work: off }]).bindings.map((b) => b.feature).join() === "reveal" && !featureFiles([{ id: "a", work: off }]).some((f) => f.path.endsWith("blink.js")));
  check("…switched on again, it is back as it was", JSON.stringify(withSwitch(off, "blink", true)) === JSON.stringify(two));
}

/* ---------------------------- the owner's two, as contract folders */
{
  const nodes = [{ id: "n_crt", pageId: "page_home", featureId: "hero", content: "", work: { id: "crt-loader", inputs: {} } }, { id: "n_dust", pageId: "page_home", featureId: "hero", content: "", work: { id: "dust-canvas", inputs: {} } }];
  const files = contractFiles(nodes, [{ id: "page_home", name: "Home", path: "/" }]);
  const paths = files.map((f) => f.path);
  const folders = ["crt-loader", "dust-canvas"].every((id) => ["manifest.json", "script.js", "README.md"].every((f) => paths.includes(`features/${id}/${f}`)));
  check("CRT loader and Dust publish as features/crt-loader/ and features/dust-canvas/, per the contract", folders, paths.filter((p) => p.startsWith("features/")).join(", "));
  const back = offersFrom(foundIn(files), LIBRARY);
  check("…and read back unchanged: nothing to offer, nothing wrong", back.length === 0, JSON.stringify(back.map((o) => [o.id, o.status, o.problems])));
  const fresh = offersFrom(foundIn(files), LIBRARY.filter((w) => !["crt-loader", "dust-canvas"].includes(w.manifest.id)));
  check("…and a library without them would take them back as they are", fresh.length === 2 && fresh.every((o) => o.acceptable), JSON.stringify(fresh.map((o) => [o.id, o.problems])));
}

/* ----------------------------------- the stand-in page, in a browser */
const dir = mkdtempSync(join(tmpdir(), "behaviours-"));
const PARTS = [
  ["n_reveal_top", "reveal", { direction: "up", distance: "40", delay: "0", once: "yes" }, "top:40px;left:40px;width:300px;height:60px", "Seen at once"],
  ["n_reveal_low", "reveal", { direction: "left", distance: "60", delay: "100", once: "no" }, "top:2400px;left:40px;width:300px;height:60px", "Further down"],
  ["n_copy", "copy-toast", {}, "top:140px;left:40px;width:420px;height:40px", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"],
  ["n_copy_given", "copy-toast", { text: "given words", toast: "Address copied" }, "top:200px;left:40px;width:200px;height:40px", "Copy CA"],
  ["n_tilt", "tilt", { mode: "mouse", strength: "12", axis: "both" }, "top:260px;left:40px;width:200px;height:200px", "Tilt me"],
  ["n_parallax", "tilt", { mode: "scroll", strength: "30", axis: "y" }, "top:1200px;left:600px;width:200px;height:100px", "Drift"],
  ["n_pupil", "follow-pointer", { travel: "14" }, "top:300px;left:700px;width:30px;height:30px", "●"],
  ["n_marquee", "marquee", { speed: "200", direction: "left", pause: "yes" }, "top:500px;left:40px;width:400px;height:40px", "$TRORTY · $TRORTY · $TRORTY"],
  ["n_embed", "embed", { url: "EMBED_URL", title: "A chart" }, "top:560px;left:40px;width:480px;height:270px", "chart goes here"],
  ["n_embed_self", "embed", { url: "SELF_URL" }, "top:560px;left:560px;width:200px;height:120px", "self"],
  ["n_embed_bad", "embed", { url: "javascript:alert(1)" }, "top:560px;left:800px;width:200px;height:120px", "bad"],
  ["n_crt", "crt-loader", { title: "TRUMP & MORTY", ticker: "$TRORTY", hold: "1.2" }, "top:3000px;left:0;width:10px;height:10px", ""],
  ["n_dust", "dust-canvas", {}, "top:900px;left:0;width:800px;height:300px", ""],
  ["n_header", "scroll-header", { at: "40", background: "rgb(243, 212, 64)", edge: "rgb(26, 15, 11) 0px 4px 0px 0px", duration: "0" }, "top:0;left:0;width:1200px;height:60px;position:fixed", "HEADER"],
  ["n_blink", "blink", { every: "0.4", how: "steps" }, "top:760px;left:900px;width:12px;height:12px;background:red", ""],
  ["n_layer", "follow-pointer", { how: "layer", x: "-90", y: "-50", scroll: "0.5", ease: "1" }, "top:300px;left:900px;width:100px;height:100px", "layer"],
  ["n_intro", "reveal", { direction: "up", distance: "40", scale: "0.9", duration: "300", after: "loader" }, "top:420px;left:900px;width:200px;height:40px", "Intro"],
];
const server = http.createServer((req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const PAGE = `http://localhost:${PORT}/`;
const EMBED = `http://127.0.0.1:${PORT}/frame.html`;
const SELF = `http://localhost:${PORT}/frame.html`;

function page(parts) {
  const nodes = parts.map(([id, feature, inputs]) => ({
    id, work: { id: feature, inputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v === "EMBED_URL" ? EMBED : v === "SELF_URL" ? SELF : v])) },
  }));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif;height:4000px;position:relative}.part{position:absolute}</style></head><body>
${parts.map(([id, , , style, words]) => `<div class="part" id="${id}" style="${style}"><span>${words}</span></div>`).join("\n")}
${pageFeatureTags(nodes, "")}
</body></html>`;
  for (const f of featureFiles(nodes)) { mkdirSync(dirname(join(dir, f.path)), { recursive: true }); writeFileSync(join(dir, f.path), f.content); }
  writeFileSync(join(dir, "index.html"), html);
}
page(PARTS);
writeFileSync(join(dir, "frame.html"), "<!doctype html><p>framed</p>");

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(reducedMotion) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.addInitScript(() => {
    window.__copied = [];
    const put = (t) => { window.__copied.push(String(t)); return Promise.resolve(); };
    try { Object.defineProperty(navigator, "clipboard", { value: { writeText: put }, configurable: true }); } catch { /* the fallback is tested then */ }
  });
  await p.goto(PAGE, { waitUntil: "load" });
  await wait(200);
  return { ctx, p, errors };
}
const click = (p, sel) => p.click(sel, { timeout: 3000 }).catch((e) => console.log(`       (could not click ${sel}: ${String(e).split("\n")[0]})`));
const style = (p, id, prop) => p.$eval(`#${id}`, (el, k) => getComputedStyle(el)[k], prop);

{
  const { ctx, p, errors } = await open("no-preference");
  check("the page runs every script without an error", errors.length === 0, errors.join(" | "));

  /* A reveal set to wait for the loader is still hidden while the loader stands. */
  check("Reveal after the loader: held while the tuning screen stands", Number(await style(p, "n_intro", "opacity")) === 0 && await p.evaluate(() => !!document.querySelector("[data-crt]")), await style(p, "n_intro", "opacity"));
  check("…at its starting scale", (await style(p, "n_intro", "scale")) === "0.9", await style(p, "n_intro", "scale"));

  /* CRT loader: covers the page, then switches off and is gone. */
  const crtUp = await p.$eval("#n_crt", (el) => { const o = document.querySelector("[data-crt]") ?? el; const r = o.getBoundingClientRect(); return { w: r.width, h: r.height, fixed: getComputedStyle(o).position, text: o.textContent }; });
  check("CRT loader: a full-screen tuning screen on arrival", crtUp.fixed === "fixed" && crtUp.w >= 1200 && crtUp.h >= 800 && /TRUMP & MORTY/.test(crtUp.text) && /\$TRORTY/.test(crtUp.text), JSON.stringify(crtUp));
  check("…with a moving static drawn on a canvas", await p.evaluate(() => !!document.querySelector("[data-crt] canvas")));
  await wait(3200);
  check("…that switches off like an old set and leaves the page", await p.evaluate(() => !document.querySelector("[data-crt]")));
  await wait(700);
  check("…and then the part set to wait for it comes in, to its full size", Number(await style(p, "n_intro", "opacity")) === 1 && ["none", "1"].includes(await style(p, "n_intro", "scale")), `${await style(p, "n_intro", "opacity")} ${await style(p, "n_intro", "scale")}`);

  /* Blink. */
  const seen = new Set();
  for (let i = 0; i < 12; i++) { seen.add(Number(await style(p, "n_blink", "opacity"))); await wait(70); }
  check("Blink: the light goes dark and comes back, in two steps", seen.has(0) && seen.has(1) && seen.size === 2, [...seen].join(","));

  /* Header bar on scroll. */
  check("Header bar: none at the top", (await style(p, "n_header", "backgroundColor")) === "rgba(0, 0, 0, 0)", await style(p, "n_header", "backgroundColor"));
  await p.evaluate(() => window.scrollTo(0, 60));
  await wait(200);
  check("…the fill and the edge once scrolled past its point", (await style(p, "n_header", "backgroundColor")) === "rgb(243, 212, 64)" && /4px 0px 0px/.test(await style(p, "n_header", "boxShadow")), `${await style(p, "n_header", "backgroundColor")} ${await style(p, "n_header", "boxShadow")}`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(200);
  check("…and gone again back at the top", (await style(p, "n_header", "backgroundColor")) === "rgba(0, 0, 0, 0)");

  /* Follow the pointer, as a layer. */
  const layerAt = async (x, y) => { await p.mouse.move(x, y); await wait(250); return p.$eval("#n_layer", (el) => getComputedStyle(el).translate); };
  const l1 = await layerAt(300, 200), l2 = await layerAt(900, 600);
  const xy = (t) => (t === "none" ? [0, 0] : t.split(" ").map(parseFloat).concat(0).slice(0, 2));
  check("Follow the pointer, as a layer: shifts by its factor over the window", Math.abs((xy(l2)[0] - xy(l1)[0]) - (-90 * 0.5)) < 2 && Math.abs((xy(l2)[1] - xy(l1)[1]) - (-50 * 0.5)) < 2, `${l1} → ${l2}`);
  await p.evaluate(() => window.scrollTo(0, 200));
  await wait(250);
  const l3 = await p.$eval("#n_layer", (el) => getComputedStyle(el).translate);
  check("…and with the scroll, by its factor", Math.abs((xy(l3)[1] - xy(l2)[1]) - 100) < 2, `${l2} → ${l3}`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(150);

  /* Dust: a canvas in the part, drawn into. */
  const dust = await p.$eval("#n_dust", (el) => { const c = el.querySelector("canvas"); if (!c) return null; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) lit++; return { lit, pe: getComputedStyle(c).pointerEvents, w: c.getBoundingClientRect().width }; });
  check("Dust: specks drawn on a canvas that fills the part and lets clicks through", !!dust && dust.lit > 0 && dust.pe === "none" && Math.round(dust.w) === 800, JSON.stringify(dust));

  /* Reveal. */
  check("Reveal: a part in view at load shows", Number(await style(p, "n_reveal_top", "opacity")) === 1);
  check("…a part further down waits, hidden", Number(await style(p, "n_reveal_low", "opacity")) === 0, await style(p, "n_reveal_low", "opacity"));
  check("…moved by its distance, from its direction", /-?60px/.test(await style(p, "n_reveal_low", "translate")), await style(p, "n_reveal_low", "translate"));
  await p.evaluate(() => window.scrollTo(0, 2000));
  await wait(1200);
  check("…and comes in when it is scrolled to", Number(await style(p, "n_reveal_low", "opacity")) === 1 && ["none", "0px"].includes(await style(p, "n_reveal_low", "translate")), `${await style(p, "n_reveal_low", "opacity")} ${await style(p, "n_reveal_low", "translate")}`);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(900);
  check("…and, set to more than once, goes again when it leaves", Number(await style(p, "n_reveal_low", "opacity")) === 0);
  check("…while one set to once stays", Number(await style(p, "n_reveal_top", "opacity")) === 1);

  /* Copy with toast. */
  await click(p, "#n_copy");
  await wait(100);
  let copied = await p.evaluate(() => window.__copied);
  check("Copy: a click copies the part's own words", copied.at(-1) === "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", copied.join(","));
  const toast = await p.evaluate(() => { const t = document.querySelector("[data-feature-toast]"); return t && { text: t.textContent, role: t.getAttribute("role") || t.getAttribute("aria-live") }; });
  check("…and says so in a small toast, read out to a screen reader", !!toast && /Copied/i.test(toast.text) && !!toast.role, JSON.stringify(toast));
  await click(p, "#n_copy_given");
  await wait(100);
  copied = await p.evaluate(() => window.__copied);
  check("…or copies the text it was given, with its own toast", copied.at(-1) === "given words" && await p.evaluate(() => [...document.querySelectorAll("[data-feature-toast]")].some((t) => t.textContent === "Address copied")), copied.join(","));
  check("…and only ever one toast at a time", await p.evaluate(() => document.querySelectorAll("[data-feature-toast]").length) === 1);
  await p.focus("#n_copy");
  await p.keyboard.press("Enter");
  await wait(50);
  check("…reachable from the keyboard", (await p.evaluate(() => window.__copied)).length === 3);
  await wait(2600);
  check("…and the toast goes by itself", await p.evaluate(() => document.querySelectorAll("[data-feature-toast]").length) === 0);

  /* Tilt, mouse. */
  await p.mouse.move(235, 280);
  await wait(250);
  const tilted = await style(p, "n_tilt", "transform");
  check("Tilt: leans toward the mouse over it", tilted !== "none", tilted);
  await p.mouse.move(1100, 700);
  await wait(500);
  const back = await p.$eval("#n_tilt", (el) => el.style.transform);
  check("…and settles when the mouse leaves", !/rotate[XY]\((?!0)/.test(back) || /rotateX\(0deg\) rotateY\(0deg\)/.test(back) || back === "", back);

  /* Tilt, scroll. */
  await p.evaluate(() => window.scrollTo(0, 600));
  await wait(150);
  const a = await style(p, "n_parallax", "translate");
  await p.evaluate(() => window.scrollTo(0, 1100));
  await wait(150);
  const b = await style(p, "n_parallax", "translate");
  check("Tilt, scroll mode: the part drifts as the page scrolls", a !== b, `${a} → ${b}`);
  check("…on its axis only", !/px\s+-?\d/.test(b) || /^0px/.test(b), b);
  await p.evaluate(() => window.scrollTo(0, 0));
  await wait(150);

  /* Follow the pointer. */
  const at = async (x, y) => { await p.mouse.move(x, y); await wait(200); return p.$eval("#n_pupil", (el) => { const t = getComputedStyle(el).translate; const [dx = "0", dy = "0"] = t === "none" ? [] : t.split(" "); return [parseFloat(dx), parseFloat(dy)]; }); };
  const right = await at(1150, 315);
  check("Follow the pointer: the pupil looks toward the cursor", right[0] > 5 && Math.abs(right[1]) < 3, JSON.stringify(right));
  check("…never further than its travel", Math.hypot(...right) <= 14.01, JSON.stringify(right));
  const up = await at(715, 5);
  check("…whichever way it is", up[1] < -5 && Math.hypot(...up) <= 14.01, JSON.stringify(up));

  /* Marquee. */
  const m1 = await p.$eval("#n_marquee", (el) => ({ copies: el.querySelectorAll("[aria-hidden=true]").length, x: el.firstElementChild ? new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41 : 0, loop: el.firstElementChild?.firstElementChild?.getBoundingClientRect().width ?? 0, overflow: getComputedStyle(el).overflow }));
  await wait(150);
  const m2 = await p.$eval("#n_marquee", (el) => new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41);
  const moved = m1.loop ? (((m1.x - m2) % m1.loop) + m1.loop) % m1.loop : 0;
  check("Marquee: the contents run on a loop, a hidden copy behind them", m1.copies >= 1 && m1.overflow === "hidden" && m1.loop > 0, JSON.stringify(m1));
  check("…moving the way it was set, at its speed", moved > 10 && moved < 60, `${moved.toFixed(1)} px in 150 ms at 200 px/s`);
  await p.hover("#n_marquee", { timeout: 3000 }).catch(() => {});
  await wait(100);
  const h1 = await p.$eval("#n_marquee", (el) => new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41);
  await wait(300);
  const h2 = await p.$eval("#n_marquee", (el) => new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41);
  check("…and holds still under the mouse", h1 === h2, `${h1} ${h2}`);

  /* Embed. */
  const emb = await p.$eval("#n_embed", (el) => { const f = el.querySelector("iframe"); if (!f) return null; const r = f.getBoundingClientRect(); return { src: f.src, sandbox: f.getAttribute("sandbox"), w: r.width, h: r.height, title: f.title, ref: f.referrerPolicy }; });
  check("Embed: the address shown in a frame at the part's size", !!emb && emb.src === EMBED && Math.round(emb.w) === 480 && Math.round(emb.h) === 270, JSON.stringify(emb));
  check("…in a sandbox", !!emb && typeof emb.sandbox === "string" && /allow-scripts/.test(emb.sandbox) && !/allow-top-navigation(?!-by-user)/.test(emb.sandbox), emb?.sandbox);
  check("…titled, and sending no referrer", emb?.title === "A chart" && emb?.ref === "no-referrer", JSON.stringify(emb));
  const self = await p.$eval("#n_embed_self", (el) => el.querySelector("iframe")?.getAttribute("sandbox"));
  check("…a page of the site's own is never let out of its sandbox", typeof self === "string" && !/allow-same-origin/.test(self), self);
  check("…and an address that is not a web page is refused, the designed words kept", await p.$eval("#n_embed_bad", (el) => !el.querySelector("iframe") && el.textContent === "bad"));
  await ctx.close();
}

/* ------------------------------------------------ asked for less motion */
{
  const { ctx, p, errors } = await open("reduce");
  check("with less motion asked for, still no error", errors.length === 0, errors.join(" | "));
  check("the CRT loader does not play", await p.evaluate(() => !document.querySelector("[data-crt]")));
  check("the dust does not drift", await p.$eval("#n_dust", (el) => { const c = el.querySelector("canvas"); return !c || !c.getContext("2d").getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v); }));
  check("a part set to reveal is simply there", Number(await style(p, "n_reveal_low", "opacity")) === 1 && ["none", "0px"].includes(await style(p, "n_reveal_low", "translate")));
  await p.mouse.move(235, 280);
  await wait(200);
  check("tilt does not lean", ["none", ""].includes(await p.$eval("#n_tilt", (el) => el.style.transform)));
  await p.mouse.move(1150, 315);
  await wait(200);
  check("the pupil does not move", ["none", "0px"].includes(await style(p, "n_pupil", "translate")));
  const x1 = await p.$eval("#n_marquee", (el) => el.firstElementChild && new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41);
  await wait(300);
  const x2 = await p.$eval("#n_marquee", (el) => el.firstElementChild && new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m41);
  check("the marquee holds still", x1 === x2, `${x1} ${x2}`);
  await click(p, "#n_copy");
  await wait(100);
  check("copying still copies, and the toast still says so", (await p.evaluate(() => window.__copied)).length === 1 && await p.evaluate(() => !!document.querySelector("[data-feature-toast]")));
  check("an embed still shows", await p.$eval("#n_embed", (el) => !!el.querySelector("iframe")));
  const lit = new Set();
  for (let i = 0; i < 8; i++) { lit.add(Number(await style(p, "n_blink", "opacity"))); await wait(70); }
  check("a light does not blink, it stays lit", lit.size === 1 && lit.has(1), [...lit].join(","));
  check("a part set to come in after the loader is simply there", Number(await style(p, "n_intro", "opacity")) === 1);
  await p.mouse.move(300, 200); await wait(150); await p.mouse.move(900, 600); await wait(200);
  check("a layer does not follow the pointer", ["none", "0px"].includes(await style(p, "n_layer", "translate")));
  await p.evaluate(() => window.scrollTo(0, 60));
  await wait(100);
  check("the header still takes its bar (a change of state, not a motion), at once", (await style(p, "n_header", "backgroundColor")) === "rgb(243, 212, 64)" && (await p.$eval("#n_header", (el) => el.style.transition)) === "none");
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
