/**
 * A LARGE SITE'S STYLESHEETS STAY WELL UNDER WHAT A PUBLISH CARRIES.
 *
 * MEASURED on trunk 9924e53 with sink d685096's parasiteonsol.fun: 18,851
 * parts on 12 pages, 12,342 of them in press-opened panels, and one
 * `assets/site.css` of 26.0 MB, which the publish refused (`too-big`, over
 * 25 MiB a file). 24.3 MB of it was 8,085 rules that each named every part
 * of their group (`:root:has(#a:hover, #b:hover, …)`, 3 KB a rule). Now a
 * group's rule names its host and the path its parts stand under (each part
 * wears its path as a short code, `data-at`), each page loads
 * only its own motion (`assets/motion/<page>.css`), and what many parts say
 * the same way is said once (`cssMerge.ts`): site.css 77 KB and the
 * largest page's sheet 400 KB; trumpmorty.fun 107 KB, now 91 KB and 20 KB.
 * Drawn the same: on both sites every part's computed motion and cursor at
 * rest, and every part under hover and press of the groups' hosts, were
 * compared old against new.
 *
 * Here: the merge on its own, a site of 20,000 parts built to be large, and
 * a page drawn both ways in the browser. No server:
 *
 *   node tests/css-scale.mjs
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { mergeRules, shareRules } = await jiti.import(join(src, "cssMerge.ts"));
const { motionCss, inside, insideIndex, pathCodes } = await jiti.import(join(src, "shelf", "parts", "capturedMotion.ts"));
const { carryOwned } = await jiti.import(join(src, "carry.ts"));

/* ---------- the merge ---------- */
{
  const got = mergeRules([
    ".mo-a { transition: transform 0.2s; }",
    ".mo-b { transition: transform 0.2s; }",
    ".mo-c { transition: opacity 1s; }",
    "#k { color: red; }",
    ".mo-d:hover { transform: none !important; }",
    ".mo-d:active { transform: translateY(2px) !important; }",
    ".mo-e:hover { transform: none !important; }",
    "#g:hover .mo-g, .mo-g:hover { color: blue !important; }",
    "#i:hover .mo-i, .mo-i:hover { color: blue !important; }",
    "#j .mo-j, .mo-k { color: blue !important; }",
    ":root:has(.mg-h:hover) .mo-f { transform: none !important; }",
    "@media (prefers-reduced-motion: no-preference) { #x { transition: transform 0.1s; } }",
    "@media (prefers-reduced-motion: no-preference) { #y { transition: transform 0.1s; } }",
    "#k { color: red; }",
    "@keyframes cap-spin {",
    "  to { transform: rotate(1turn) }",
    "}",
  ].join("\n")).split("\n");
  check("the same declarations are written once for every part alone in saying them", got.includes(".mo-a, .mo-b { transition: transform 0.2s; }"), got.join(" / "));
  check("a rule written again later, word for word, is written once, where it came last", got.filter((l) => l === "#k { color: red; }").length === 1 && got.indexOf("#k { color: red; }") > got.findIndex((l) => l.startsWith("@media")));
  check("an element two rules reach keeps both, in their order", got.indexOf(".mo-d:hover { transform: none !important; }") >= 0 && got.indexOf(".mo-d:hover { transform: none !important; }") < got.indexOf(".mo-d:active { transform: translateY(2px) !important; }"));
  check("a selector that leans on :has() is not listed with one that does not", got.includes(":root:has(.mg-h:hover) .mo-f { transform: none !important; }") && got.includes(".mo-e:hover { transform: none !important; }"));
  check("rules inside the same @media fold inside it", got.includes("@media (prefers-reduced-motion: no-preference) { #x, #y { transition: transform 0.1s; } }"));
  check("a list whose selectors all land on one box folds as one; a list over two boxes does not", got.includes("#g:hover .mo-g, .mo-g:hover, #i:hover .mo-i, .mo-i:hover { color: blue !important; }") && got.includes("#j .mo-j, .mo-k { color: blue !important; }"), got.filter((l) => l.includes("blue")).join(" / "));
  check("keyframes pass through as written", got.slice(-3).join("\n") === "@keyframes cap-spin {\n  to { transform: rotate(1turn) }\n}");
}

/* ---------- a site built to be large ---------- */
/*
 * 20,050 parts in 50 panels, each of 20 rows of 19 cells, as a panel a press
 * opens is on parasiteonsol.fun: the panel and its rows light up under the
 * pointer, pressed and focused (named part by part, a rule on a panel lists
 * its 400 parts); the panel lifts under the pointer; every cell eases one of
 * three ways and sinks when pressed.
 */
const MB = 1024 * 1024, CAP = 25 * MB;
const big = [];
const lit = (bg) => ({ hover: [{ self: true, style: { "background-color": bg } }], active: [{ self: true, style: { "background-color": "#222" } }], focus: [{ self: true, state: "focus-visible", style: { outline: "2px solid #fc0" } }] });
for (let g = 0; g < 50; g++) {
  const hs = `main > section:nth-of-type(${g + 1})`;
  big.push({ id: `n_box_h${g}`, pageId: "p", x: 0, y: g * 1000, w: 1200, h: 900, from: { selector: hs }, colour: { bg: "#fff" },
    motion: { transition: [{ property: "transform", duration: "0.2s", timing: "ease", delay: "0s" }], ...lit("#eef"), hover: [{ self: true, style: { transform: "translateY(-4px)", "background-color": "#eef" } }] } });
  for (let r = 0; r < 20; r++) {
    const rs = `${hs} > div:nth-of-type(${r + 1})`;
    big.push({ id: `n_row_${g}_${r}`, pageId: "p", x: 0, y: g * 1000 + r * 45, w: 1200, h: 40, from: { selector: rs }, motion: lit("#ffd") });
    for (let c = 0; c < 19; c++) {
      big.push({ id: `n_cell_${g}_${r}_${c}`, pageId: "p", x: c * 60, y: g * 1000 + r * 45, w: 50, h: 40, from: { selector: `${rs} > span:nth-of-type(${c + 1})` },
        motion: { transition: [{ property: ["transform", "opacity", "background-color"][c % 3], duration: "0.12s", timing: "ease", delay: "0s" }], active: [{ self: true, style: { transform: "translateY(2px)" } }] } });
    }
  }
}
const at = (id) => `#${id}`;
/* The parts a lifting panel owns go inside it on the published page (`carry.ts`), as the export does. */
const t0 = Date.now();
const nested = new Set([...carryOwned(big).values()].flat());
const code = pathCodes(big), used = new Set();
const sharedOut = shareRules(motionCss(big, [], at, nested, code, used), "ms0-");
const folded = sharedOut.css;
const ms = Date.now() - t0;
const named = motionCss(big, [], at, nested);
const size = (s) => Buffer.byteLength(s, "utf8");
check(`control: named part by part, the same 20,050 parts are ${(size(named) / MB).toFixed(1)} MB`, size(named) > 5 * size(folded));
check(`their groups by path and folded, they come to ${(size(folded) / 1024).toFixed(0)} KB, well under the 25 MB a publish carries`, size(folded) < CAP / 10, `${size(folded)} bytes`);
check("parts moving the same way share one class", sharedOut.classes.size > 19_000 * 2 && new Set([...sharedOut.classes.values()].flat()).size < 20, `${new Set([...sharedOut.classes.values()].flat()).size} classes on ${sharedOut.classes.size} boxes and elements`);
{
  const under = (h) => big.filter((x) => x.id !== h.id && code(x.id).startsWith(code(h.id)) && code(x.id) !== code(h.id)).map((x) => x.id);
  const hosts = [big[0], big[1], big.find((n) => n.id === "n_row_49_19")];
  check("a group's rule names its host and the path its parts stand under: the same parts, one selector long", used.size === 1050 && hosts.every((h) => JSON.stringify(under(h)) === JSON.stringify(inside(h, big).map((x) => x.id))) && !/#n_cell_/.test(folded.split("\n").find((l) => l.includes(":root:has(")) ?? ""), `${used.size} paths named`);
  const html = big.reduce((t, n) => t + ` data-at="${code(n.id)}"`.length, 0);
  check(`what the parts wear for it is ${(html / 1024).toFixed(0)} KB of attributes, for 20,050 parts`, html < 2 * MB);
}
check(`and it is written in good time (${ms} ms)`, ms < 10_000);
{
  const within = insideIndex(big);
  const sample = [big[0], big[1], big[2], big.at(-1)];
  check("the parts inside each part, read by path, are the ones asked of every part", sample.every((h) => JSON.stringify(within(h).map((x) => x.id)) === JSON.stringify(inside(h, big).map((x) => x.id))), sample.map((h) => within(h).length).join(","));
}

/* ---------- drawn the same ---------- */
{
  const few = big.filter((n) => /^n_(box_h0|row_0_[01]|cell_0_[01]_[0-3])$/.test(n.id));
  const fewCode = pathCodes(few);
  const oldCss = motionCss(few, [], at, new Set([...carryOwned(few).values()].flat()));
  const fewNested = new Set([...carryOwned(few).values()].flat());
  const sh = shareRules(motionCss(few, [], at, fewNested, fewCode, new Set()), "ms0-");
  const newCss = sh.css;

  const page = (css, withClass) => `<!doctype html><html><head><style>body{margin:0}${css}</style></head><body>${few.map((n) =>
    `<div id="${n.id}"${withClass ? ` data-at="${fewCode(n.id)}" class="${(sh.classes.get(`#${n.id}`) ?? []).join(" ")}"` : ""} style="position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px"><div class="mo mo-${n.id}${withClass ? (sh.classes.get(`mo-${n.id}`) ?? []).map((c) => " " + c).join("") : ""}" style="width:100%;height:100%;background:#8cf"></div></div>`).join("")}</body></html>`;
  const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const read = async (html) => {
    const p = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    await p.setContent(html);
    const state = () => p.evaluate(() => [...document.querySelectorAll("[id], .mo")].map((e) => { const c = getComputedStyle(e); return `${e.id || [...e.classList].find((x) => x.startsWith("mo-"))}:${c.transform}:${c.transitionProperty}:${c.transitionDuration}`; }).join("\n"));
    const out = [await state()];
    for (const [x, y] of [[20, 20], [70, 50], [1100, 10]]) {
      await p.mouse.move(x, y); await p.waitForTimeout(400); out.push(await state());
      await p.mouse.down(); await p.waitForTimeout(400); out.push(await state()); await p.mouse.up();
    }
    await p.close();
    return out;
  };
  const [was, now] = [await read(page(oldCss, false)), await read(page(newCss, true))];
  check("at rest, under hover and pressed, every part is drawn as before", was.every((v, i) => v === now[i]), was.findIndex((v, i) => v !== now[i]) >= 0 ? `state ${was.findIndex((v, i) => v !== now[i])} differs` : `${was.length} states`);
  check("…and the hover did move the group (the comparison saw something)", was[1] !== was[0]);
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
