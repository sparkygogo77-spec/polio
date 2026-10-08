/**
 * THE RED LIVE DOT SITS BEFORE THE WORDS, NOT ON THE "L".
 *
 * On trumpmorty.fun the badge "LIVE FROM THE YELLOW DIMENSION" is a flex row
 * (gap 10, padding 14) whose first child is a 12px red dot: dot at x 114–126,
 * words from x 136. The capture keeps the dot as a part of its own and the
 * words as the badge's, so the board and the export drew the words from the
 * padding, x 115, under the dot. `parts/leadIn.ts` insets the words past what
 * stands before them in the row, wherever they are drawn.
 *
 *   node tests/lead-in.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { trumpmorty } from "./fixtures/trumpmorty.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const L = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "leadIn.ts"));

/* The rule, on a made row */
const row = { id: "row", x: 100, y: 100, w: 300, h: 50, content: "Words", from: { selector: "main > div" }, layout: { display: "flex", direction: "row", gap: 10 }, pad: { left: 14 } };
const dot = { id: "dot", x: 114, y: 120, w: 12, h: 12, content: "", from: { selector: "main > div > i" } };
check("a dot at the start of a row pushes its words past it and the gap", L.leadInsets([row, dot]).get("row") === 36);
check("…not when it is placed out of the flow", !L.leadInsets([row, { ...dot, from: { selector: "main > div > i", position: "absolute" } }]).has("row"));
check("…not when it stands after the words", !L.leadInsets([row, { ...dot, x: 300 }]).has("row"));
check("…not in a column", !L.leadInsets([{ ...row, layout: { display: "flex", direction: "column", gap: 10 } }, dot]).has("row"));
check("…and a row with nothing before its words is the same object", L.withLead(row, L.leadInsets([row])) === row);

const doc = await trumpmorty();
if (!doc) { console.log("the trumpmorty capture was not found; the page half did not run"); process.exit(results.every(Boolean) ? 0 : 1); }
const leads = L.leadInsets(doc.nodes);
/* Found by its words and its dot, not by id: a newer capture numbers parts afresh, and writes the badge's inset itself (then no inset is added). */
const badge = doc.nodes.find((n) => n.content === "LIVE FROM THE YELLOW DIMENSION");
const lead = badge && doc.nodes.find((n) => n.from?.selector === `${badge.from?.selector} > i`);
check("on trumpmorty.fun the badge's words stand past its dot and the gap", !!badge && !!lead && L.withLead(badge, leads).pad?.left === lead.x + lead.w - badge.x + 10 && [...leads.keys()].every((id) => id === badge.id), JSON.stringify({ badge: badge?.id, dot: lead?.id, pad: badge?.pad, leads: [...leads] }));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(2500);

/* Where the badge's words start and where the dot ends, in the page's own pixels. */
const MEASURE = ({ root, badge, dot, scaleBy }) => {
  const f = document.querySelector(root).getBoundingClientRect();
  const z = scaleBy ? f.width / scaleBy : 1;
  const b = document.querySelector(badge), d = document.querySelector(dot);
  if (!b || !d) return null;
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  let t; while ((t = w.nextNode()) && !t.textContent.trim());
  const r = document.createRange(); r.selectNodeContents(t);
  const x = (v) => Math.round((v - f.left) / z);
  return { words: x(r.getBoundingClientRect().left), dotRight: x(d.getBoundingClientRect().right) };
};
const board = await page.evaluate(MEASURE, { root: "[data-frame]", badge: `[data-node-id="${badge?.id}"]`, dot: `[data-node-id="${lead?.id}"]`, scaleBy: 1440 });
check("on the board the words start after the dot and the gap (live: 136)", !!board && Math.abs(board.words - 136) <= 2 && board.words > board.dotRight, JSON.stringify(board));

const files = await page.evaluate(async () => await window.__studioExport());
/* Less motion asked: the site's loader and the badge's reveal (it comes in scaled) skip themselves, so the page is read at rest. */
const out = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await out.route("http://export.local/**", (r) => {
  const p = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, "") || "index.html";
  const f = files.find((x) => x.path === p);
  if (!f) return r.fulfill({ status: 404, body: "" });
  const type = p.endsWith(".html") ? "text/html" : p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : "application/octet-stream";
  return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.route(/^(?!http:\/\/export\.local\/).*/, (r) => r.fulfill({ status: 404, body: "" }));
await out.goto("http://export.local/index.html", { waitUntil: "networkidle" }).catch(() => {});
await out.waitForTimeout(1500);
const exp = await out.evaluate(MEASURE, { root: "body", badge: `#${badge?.id}`, dot: `#${lead?.id}`, scaleBy: 0 });
check("in the export too", !!exp && Math.abs(exp.words - 136) <= 2 && exp.words > exp.dotRight, JSON.stringify(exp));
await out.screenshot({ path: join(here, "..", ".scratch", "lead-export.png"), clip: { x: 80, y: 130, width: 420, height: 100 } }).catch(() => {});

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
