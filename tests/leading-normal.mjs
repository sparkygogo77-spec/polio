#!/usr/bin/env node
/**
 * A LINE THE PAGE SET AT `line-height: normal` IS DRAWN AT `normal`.
 *
 * thesolface.site captured on the CI's Linux (run 39707081826) landed on J's
 * Windows board 6px short a section. Its labels, its glyphs and its "100%"
 * are set at `line-height: normal`, whose height is the reader's own face's:
 * the same Archivo Black draws "100%" at 30px in a 40px line on Windows and
 * 32 on Linux. The capture wrote `normal` as the number it measured (32/30 =
 * 1.07), so every board drew the capture machine's line and never the
 * reader's. The capture now marks such a line (`font.leadingNormal`, the
 * number kept beside it), and the board and the published page draw it at
 * `normal` (`theme.ts#lineOf`, `send-out/styleLayer.ts#lookOf`); the box
 * grows to it as words do (`useSettleToWords`).
 *
 * The rule that took a line from the box (#279, tests/normal-leading.mjs) is
 * for a part the capture said nothing of: neither a number nor `normal`.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/leading-normal.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/parts/theme.ts, src/features/studio/shelf/parts/Text.tsx, src/features/studio/send-out/styleLayer.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const studio = join(here, "..", "src", "features", "studio");
const theme = await jiti.import(join(studio, "shelf", "parts", "theme.ts"));
const { themeFrom, applyFont, applyCaptured } = theme;
/* Before `lineOf`, a line was its number. */
const lineOf = theme.lineOf ?? ((th) => th.lineHeight);
const { lookOf } = await jiti.import(join(studio, "send-out", "styleLayer.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* "100%" as the Linux capture read it: 30px, a 32px line, said to be `normal`. A system face, so the line this machine draws is its own. */
const FACE = '"Segoe UI", Arial, sans-serif';
const part = { id: "n_hundred", pageId: "home", featureId: "prose", label: "100%", prompt: "", content: "100%", data: "", x: 100, y: 100, w: 200, h: 32, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: { text: "rgb(20, 20, 20)" }, font: { family: "grotesque sans", px: 30, size: 1.875, stack: FACE, weight: 400, leading: 1.07, leadingNormal: true }, from: { url: "https://thesolface.site/", host: "thesolface.site", selector: "body > main > section:nth-of-type(2) > div > div:nth-of-type(3)::text(1)", at: 1 } };

const t = themeFrom ? themeFrom({}) : null;
const th = t ? applyCaptured(applyFont(t, part.font, { captured: true }), part) : null;
check("a line captured at `normal` is drawn at `normal`", !!th && lineOf(th) === "normal", th ? String(lineOf(th)) : "no theme");
check("…its measured line kept for arithmetic", !!th && Math.abs(th.lineHeight - 1.07) < 0.01, th ? String(th.lineHeight) : "");
const numbered = t ? applyCaptured(applyFont(t, { ...part.font, leadingNormal: undefined }, { captured: true }), part) : null;
check("control: a number the page set is drawn as that number", !!numbered && lineOf(numbered) === 1.07, numbered ? String(lineOf(numbered)) : "");
const quiet = t ? applyCaptured(applyFont(t, { px: 30, size: 1.875, stack: FACE }, { captured: true }), { ...part, font: { px: 30, size: 1.875, stack: FACE } }) : null;
check("control: a part the capture said nothing of still takes its line from its box (#279)", !!quiet && lineOf(quiet) !== "normal" && Math.abs(quiet.lineHeight * 30 - 32) < 0.5, quiet ? String(quiet.lineHeight) : "");
check("the published page sets it at `normal` too", lookOf(part).lineHeight === "normal", String(lookOf(part).lineHeight));

/* On the board, in this machine's face. */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false } }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate((n) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "normal", name: "normal", updatedAt: Date.now() }], activeId: "normal" }));
  localStorage.setItem("builder.studio", env({ pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "home", nodes: [n], swept: 99 }));
}, part);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const got = await page.evaluate((FACE) => {
  const p = document.querySelector('[data-node-id="n_hundred"] [data-part] p');
  if (!p) return null;
  /* This machine's normal line for the face: a probe set the same way. */
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;left:-9999px;font:30px ${FACE};line-height:normal;white-space:pre`;
  probe.textContent = "100%";
  document.body.appendChild(probe);
  const normal = probe.offsetHeight; probe.remove();
  return { line: getComputedStyle(p).lineHeight, drew: p.offsetHeight, normal, node: (window.__studioNodes?.() ?? []).find((n) => n.id === "n_hundred")?.h ?? null };
}, FACE);
check("on the board its words are set at `normal`", got?.line === "normal" || Math.abs(parseFloat(got?.line ?? "0") - (got?.normal ?? -1)) < 1, JSON.stringify(got));
check("…drawn as tall as this machine's normal line, not the capture machine's 32", !!got && Math.abs(got.drew - got.normal) <= 1, JSON.stringify(got));
check("…and the part grows to it where it is taller", !!got && (got.normal <= 33 || (got.node ?? 0) >= got.normal - 1), JSON.stringify(got));
/*
 * And its lines are kept by count. Two lines at `normal`, the Linux line
 * 14px (28 for both), in a box a hair narrower than the second line: by
 * height, two lines of this machine's normal line were already "too tall"
 * for 28, every tightening failed and three lines stayed; counted, two rows
 * are two rows (`textFit.ts#useKeepLines` with `lines`).
 */
const TWO = "NO CRYSTAL BALL.\nJUST A BETTER PAIR OF GOGGLES.";
const pair = (w) => ({ ...part, id: "n_pair", label: TWO, content: TWO, w, h: 28, font: { family: "grotesque sans", px: 11, size: 0.6875, stack: FACE, weight: 400, leading: 1.27, leadingNormal: true } });
const seedOne = (n) => page.evaluate((n) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.studio", env({ pages: [{ id: "home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "home", nodes: [n], swept: 99 }));
}, n);
const readPair = () => page.evaluate(async () => {
  await document.fonts.ready;
  const ps = [...document.querySelectorAll('[data-node-id="n_pair"] [data-part] p')];
  const second = ps.find((p) => /GOGGLES/.test(p.textContent ?? ""));
  if (!second) return null;
  const block = second.parentElement;
  const zoom = block.getBoundingClientRect().width / (block.offsetWidth || 1);
  const tops = [], r = document.createRange();
  for (const p of ps) { r.selectNodeContents(p); for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((t) => Math.abs(t - q.top) < q.height / 2)) tops.push(q.top); }
  r.selectNodeContents(second);
  const line = Math.max(...[...r.getClientRects()].map((q) => q.width)) / zoom;
  return { rows: tops.length, line, spacing: getComputedStyle(second).letterSpacing };
});
await seedOne(pair(600));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const wide = await readPair();
await seedOne(pair(Math.floor((wide?.line ?? 200) - 3)));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const narrow = await readPair();
check("two lines at `normal`, a hair too narrow, keep two rows", narrow?.rows === 2, JSON.stringify({ wide, narrow }));
check("…by setting their letters tighter", !!narrow && parseFloat(narrow.spacing) < (parseFloat(wide?.spacing) || 0), JSON.stringify({ wide: wide?.spacing, narrow: narrow?.spacing }));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
