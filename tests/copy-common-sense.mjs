#!/usr/bin/env node
/**
 * A COPY BUTTON COPIES, BY COMMON SENSE.
 *
 * J (2026-10-11), on sunkcoin.fun's holders table, every row's COPY marked
 * with the orange !: "copy button should also be common sense". Held here:
 *   · a COPY nothing was decided for is given the Copy feature, set to the
 *     whole address beside it (read off its link when the words are cut
 *     down for show), and so loses its !;
 *   · a button round "CA", the address and "COPY" is the copy button, the
 *     word inside defers to it, and it copies the address inside;
 *   · a COPY that already goes somewhere, or the repo's own code works,
 *     is left as it is; a second pass finds nothing to do;
 *   · on a published page, a Copy with nothing given copies its neighbour,
 *     the whole address behind a shortened one, never the word "COPY".
 *
 *   node --experimental-strip-types tests/copy-common-sense.mjs
 */
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { chromium } from "playwright-core";
import { giveCopies, saysCopy } from "../src/features/studio/shelf/library/copyButton.ts";
import { decisions } from "../src/features/studio/shelf/library/badge.ts";
import { usesOf, featureFiles, pageFeatureTags } from "../src/features/studio/shelf/library/works.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const A1 = "3wh3Jq7Yb5Nf2kLmPx9RtUvWzA8cDeFgHiJkweoq";
const A2 = "4u9WmT3r8Kp2Qx7YzBcDeFgHiJkLmNoPqRsJpyc";
const CA = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const row = (i, a, y) => [
  { id: `addr${i}`, pageId: "p", featureId: "box", x: 16, y, w: 92, h: 20, content: [{ text: `${a.slice(0, 4)}…${a.slice(-4)}`, link: { kind: "url", target: `https://solscan.io/account/${a}` } }], from: { selector: `body > table > tbody > tr:nth-of-type(${i}) > td > span > a` } },
  { id: `copy${i}`, pageId: "p", featureId: "box", x: 124, y, w: 34, h: 20, content: "COPY", from: { selector: `body > table > tbody > tr:nth-of-type(${i}) > td > span > button` } },
];
const nodes = [
  ...row(1, A1, 100), ...row(2, A2, 150),
  { id: "ca", pageId: "p", featureId: "box", x: 600, y: 10, w: 260, h: 30, content: "", from: { selector: "body > header > div > button" } },
  { id: "ca-k", pageId: "p", featureId: "box", x: 604, y: 14, w: 20, h: 20, content: "CA", from: { selector: "body > header > div > button > span:nth-of-type(1)" } },
  { id: "ca-v", pageId: "p", featureId: "box", x: 630, y: 14, w: 120, h: 20, content: `${CA.slice(0, 4)}…${CA.slice(-4)}`, from: { selector: "body > header > div > button > span:nth-of-type(2)" } },
  { id: "ca-c", pageId: "p", featureId: "box", x: 800, y: 14, w: 40, h: 20, content: "COPY", from: { selector: "body > header > div > button > span:nth-of-type(3)" } },
  { id: "buy", pageId: "p", featureId: "box", x: 900, y: 10, w: 60, h: 30, content: [{ text: "BUY", link: { kind: "url", target: `https://pump.fun/coin/${CA}` } }], from: { selector: "body > header > a" } },
  { id: "linked", pageId: "p", featureId: "box", x: 124, y: 200, w: 34, h: 20, content: "COPY", link: { kind: "page", target: "page_x" }, from: { selector: "body > div > a" } },
  { id: "coded", pageId: "p", featureId: "box", x: 124, y: 250, w: 34, h: 20, content: "Copy", source: { code: { refs: [{ kind: "listens" }] } }, from: { selector: "body > div > button" } },
  { id: "carried", pageId: "p", featureId: "box", x: 124, y: 300, w: 34, h: 20, content: "Copy", hooks: { "data-copy": A2 }, from: { selector: "body > section > button" } },
];

check("words that say Copy, and words that do not", ["COPY", "Copy", "copy CA", "Copy address", "⧉"].every(saysCopy) && !["Copied", "Copy that and more", "CA", A1].some(saysCopy));
check("before: each COPY carries the orange !", ["copy1", "copy2", "ca"].every((id) => decisions(nodes).some((d) => d.id === id && d.why === "nowhere")), JSON.stringify(decisions(nodes)));

const after = giveCopies(nodes);
const copyOf = (id) => usesOf(after.find((n) => n.id === id)?.work).find((u) => u.id === "copy-toast");
check("a row's COPY copies the whole address beside it, read off its link", copyOf("copy1")?.inputs.text === A1 && copyOf("copy2")?.inputs.text === A2, JSON.stringify([copyOf("copy1"), copyOf("copy2")]));
check("the CA button copies the whole CA (from the page's pump.fun link); the word inside defers to it", copyOf("ca")?.inputs.text === CA && !copyOf("ca-c"), JSON.stringify([copyOf("ca"), copyOf("ca-c")]));
check("a value the page kept on the button (data-copy) is what it copies", copyOf("carried")?.inputs.text === A2, JSON.stringify(copyOf("carried")));
check("a COPY that goes somewhere, or the repo's code works, is left as it is", !copyOf("linked") && !copyOf("coded") && after.find((n) => n.id === "linked") === nodes.find((n) => n.id === "linked"));
check("after: no copy button carries the orange !", !decisions(after).some((d) => ["copy1", "copy2", "ca", "ca-c", "carried"].includes(d.id)), JSON.stringify(decisions(after)));
check("a second pass finds nothing to do", giveCopies(after) === after);
{
  const alone = giveCopies(nodes.filter((n) => n.id !== "buy"));
  const u = usesOf(alone.find((n) => n.id === "ca")?.work).find((w) => w.id === "copy-toast");
  check("with no whole CA anywhere, the cut-down one is never set as what it copies", !!u && !u.inputs.text, JSON.stringify(u));
}

/* ----------------------------------- as published, in a browser */
const dir = mkdtempSync(join(tmpdir(), "copy-sense-"));
const bound = [{ id: "c_row", work: { id: "copy-toast", inputs: {} } }, { id: "c_plain", work: { id: "copy-toast", inputs: {} } }];
writeFileSync(join(dir, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif;position:relative}.part{position:absolute}</style></head><body>
<a class="part" style="top:100px;left:16px;width:92px;height:20px" href="https://solscan.io/account/${A1}">${A1.slice(0, 4)}…${A1.slice(-4)}</a>
<div class="part" id="c_row" style="top:100px;left:124px;width:44px;height:20px">COPY</div>
<div class="part" style="top:100px;left:400px;width:200px;height:20px">far away</div>
<div class="part" style="top:200px;left:16px;width:120px;height:20px">hello@site.fun</div>
<div class="part" id="c_plain" style="top:200px;left:150px;width:44px;height:20px">Copy</div>
${pageFeatureTags(bound, "")}
</body></html>`);
for (const f of featureFiles(bound)) { mkdirSync(dirname(join(dir, f.path)), { recursive: true }); writeFileSync(join(dir, f.path), f.content); }
const server = http.createServer((req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
  if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__copied.push(String(t)); return Promise.resolve(); } }, configurable: true });
  });
  await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await p.waitForTimeout(200);
  await p.click("#c_row");
  await p.click("#c_plain");
  await p.waitForTimeout(100);
  const copied = await p.evaluate(() => window.__copied);
  check("published: a row's COPY copies the whole address behind the shortened one", copied[0] === A1, JSON.stringify(copied));
  check("…and a Copy beside plain words copies those words, never \"Copy\"", copied[1] === "hello@site.fun", JSON.stringify(copied));
  check("…without an error", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
