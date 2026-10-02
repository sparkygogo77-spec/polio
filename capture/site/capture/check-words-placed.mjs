/**
 * WORDS SET WHERE THE PAGE SET THEM: A HEADING'S OWN AMONG ITS CHILDREN, A ROW
 * BUTTON'S, A BUTTON'S BESIDE A PART, AN OLD CAPTURE'S EMPTY FIELD.
 *
 * share.xyz converted again and compared with the page itself at 1440 and
 * 2000 wide (docs/fidelity/share-xyz.md). Four general causes, each held here
 * on a stand-in page built the way share.xyz builds it:
 *
 *   · the banner heading's own "and", between the names that became parts of
 *     their own, was centred in the heading's whole box (19px above its row),
 *     on the theme's leading, not the face's `normal` line: its words are set
 *     in the box the page drew them in (`tb`), on a line as tall as drawn;
 *   · "View Resolved" and "Market", flex-row buttons, have their words at the
 *     start (`justify-content: normal`) whatever `text-align` says, and were
 *     centred: a row button's words take their side from the row; the
 *     outcome rows ("June 30, 2027"), block buttons set `text-align: start`,
 *     were centred too, `start` taken for the default it is not on a button;
 *   · the YES key's words sit beside a price bar that is a part of its own,
 *     and were centred over both: they are set in their own box;
 *   · stonkfun.xyz's sort pills, 36px buttons with no padding above or
 *     below their 20px line, had their words at the top: a button sets its
 *     contents in the middle of its height, so that room is its padding;
 *   · gotchi.gg's "adopt a gotchi", an egg and its words centred in a row,
 *     had its words centred in what the egg left, 10px right: words after
 *     an icon are set in the box they were drawn in, both sides;
 *   · a capture taken before the dump read what an empty field shows had the
 *     search box blank: converted again, it shows its placeholder.
 *
 *   node capture/site/capture/check-words-placed.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 300000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-words-placed-"));
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:40px;background:#fff;font:15px/20px sans-serif;color:#000}
  section{width:900px;background:#063;color:#fff;padding:24px;text-align:center}
  h1{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 16px;margin:0;font:600 44px/normal sans-serif;color:rgba(255,255,255,.9)}
  h1 .kick{flex-basis:100%;font:600 24px/29px sans-serif}
  h1 .name{display:flex;align-items:center;font:600 56px/normal sans-serif}
  .rows{width:900px;margin-top:30px}
  .row{display:flex;align-items:center;width:900px;min-height:56px;border:0;background:none;font:500 16px/20px sans-serif;text-align:start;padding:0}
  .date{display:block;width:400px;border:0;background:none;font:600 16px/20px sans-serif;text-align:start;padding:0}
  .menu{display:flex;align-items:center;gap:6px;border:0;background:none;font:500 14px/20px sans-serif;text-align:center;padding:4px 0}
  .menu i{display:block;width:14px;height:14px;background:#000}
  .key{display:grid;grid-template-columns:auto auto;justify-content:center;align-items:baseline;column-gap:6px;width:136px;height:40px;padding:1px 8px;border:0;border-radius:9px;background:rgb(4,210,79);color:#fff}
  .key span:first-child{font:600 12px/16px sans-serif;letter-spacing:.15px;text-transform:uppercase}
  .key .bar{display:block;width:34px;height:8px;border-radius:4px;background:rgba(255,255,255,.5)}
  .sort{display:flex;align-items:center;gap:4px;margin-top:20px}
  .pill{display:block;height:36px;padding:0 12px;border:0;border-radius:8px;background:none;color:rgb(164,197,207);font:500 14px/20px sans-serif}
  .pill.on{background:rgb(47,79,88)}
  .cta{display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;width:270px;min-height:56px;padding:12px 28px;border:3px solid #2b1d2e;border-radius:999px;background:rgb(255,92,168);color:#2b1d2e;font:600 20px/20px sans-serif;text-decoration:none}
  input{box-sizing:border-box;width:508px;height:22px;margin-top:30px;padding:1px 2px;border:0;font:14px/20px sans-serif}
  input::placeholder{color:rgba(58,61,65,.6)}
</style></head><body>
<section><h1><span class="kick">Make Predictions Across</span><span class="name">Polymarket</span>and<span class="name">Hyperliquid</span></h1></section>
<div class="rows"><button class="date">June 30, 2027</button><button class="row">View Resolved</button><button class="menu">Market<i></i></button><button class="key"><span>Yes</span><span class="bar"></span></button></div>
<nav class="sort"><button class="pill on">Market cap</button><button class="pill">Newest</button></nav>
<p><a class="cta" href="#"><svg viewBox="0 0 10 10" width="20" height="20"><circle cx="5" cy="5" r="4" fill="#fff"/></svg>adopt a gotchi</a></p>
<input type="search" placeholder="Search Markets">
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1100, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1100", "--height", "700", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
server.close();
const convert = () => run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
await convert();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
const load = () => { try { return JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { return { nodes: [] }; } };
let doc = load();
const cap = (() => { try { return JSON.parse(readFileSync(capture, "utf8")); } catch { return { tree: { kids: [] } }; } })();
const els = []; (function walk(e) { if (!e) return; els.push(e); for (const k of e.kids ?? []) walk(k); })(cap.tree);
const bySel = (re) => doc.nodes.find((n) => re.test(n.from?.selector ?? ""));

/* The heading's own "and": set in the box the page drew it in. */
const h1 = els.find((e) => e.t === "h1");
const and = bySel(/h1$/);
const box = and && { x: and.x + (and.pad?.left ?? 0), y: and.y + (and.pad?.top ?? 0), r: and.x + and.w - (and.pad?.right ?? 0), b: and.y + and.h - (and.pad?.bottom ?? 0) };
const tb = h1?.tb;
check("the heading's own words are set in the box the page drew them in, not centred in the whole heading", tb && box && Math.abs(box.x - tb[0]) <= 1 && Math.abs(box.y - tb[1]) <= 1 && Math.abs(box.r - tb[0] - tb[2]) <= 1 && Math.abs(box.b - tb[1] - tb[3]) <= 1, J({ tb, box, pad: and?.pad }));
check("…on a line as tall as the page drew it (line-height: normal)", tb && and?.font?.leading && Math.abs(and.font.leading * 44 - tb[3]) <= 1, J({ leading: and?.font?.leading, drawn: tb?.[3] }));

/* Row buttons: words at the start of their row. */
const date = bySel(/button:nth-of-type\(1\)$/), row = bySel(/button:nth-of-type\(2\)$/), menu = bySel(/button:nth-of-type\(3\)$/);
check("a block button with text-align start has its words at the start (a button's own default is the middle)", date?.content === "June 30, 2027" && date?.text?.align === "left", J({ content: date?.content, text: date?.text }));
check("a flex-row button with text-align start has its words at the start", row?.text?.align === "left", J({ content: row?.content, text: row?.text }));
check("…and one with text-align centre too: a row places its words by justify-content", menu?.text?.align === "left", J({ content: menu?.content, text: menu?.text }));

/* The YES key: its words in their own box, beside the bar. */
const key = bySel(/button:nth-of-type\(4\)$/);
const yesEl = els.find((e) => e.t === "span" && e.text === "Yes");
const keyEl = els.find((e) => e.t === "button" && e.kids?.includes(yesEl));
check("a button's words folded from a child, beside a part of its own, are set in the child's box", key && yesEl && keyEl && key.pad?.left === yesEl.x - keyEl.x && key.pad?.right === keyEl.x + keyEl.w - yesEl.x - yesEl.w, J({ pad: key?.pad, words: yesEl && [yesEl.x, yesEl.w], key: keyEl && [keyEl.x, keyEl.w] }));
check("…in capitals, as the page set them", key?.text?.transform === "uppercase", J(key?.text));

/* stonkfun.xyz's sort pills: 36px buttons, no padding above or below a 20px line, the words in the middle. */
for (const [re, what] of [[/nav > button:nth-of-type\(1\)$/, "a filled button"], [/nav > button:nth-of-type\(2\)$/, "a button with no fill (a part of words)"]]) {
  const b = bySel(re);
  check(`${what} sets its line in the middle of its height, as the browser does a button's`, b && b.pad?.top === 8 && b.pad?.bottom === 8, J({ content: b?.content, featureId: b?.featureId, h: b?.h, pad: b?.pad }));
}

/* gotchi.gg's "adopt a gotchi": an icon and its words in a row centred in the button; the words set in the box they were drawn in, both sides. */
const ctaEl = els.find((e) => e.t === "a" && (e.text ?? "").trim() === "adopt a gotchi");
const cta = bySel(/p > a$/);
check("words after an icon in a centred row are set in the box they were drawn in, right edge too", ctaEl?.tb && cta && cta.pad?.left === ctaEl.tb[0] - ctaEl.x && cta.pad?.right === ctaEl.x + ctaEl.w - ctaEl.tb[0] - ctaEl.tb[2], J({ tb: ctaEl?.tb, box: ctaEl && [ctaEl.x, ctaEl.w], pad: cta?.pad }));

/* A capture from before the dump read an empty field: converted again, it shows its placeholder. */
const fresh = bySel(/input$/);
check("today's capture: the empty field shows its placeholder in the page's colour", fresh?.content === "Search Markets" && /58, 61, 65/.test(fresh?.colour?.text ?? ""), J({ content: fresh?.content, colour: fresh?.colour }));
const input = els.find((e) => e.t === "input");
if (input) { delete input.text; delete input.phShown; input.color = "rgb(0, 0, 0)"; input.pad = [1, 2, 1, 2]; }
writeFileSync(capture, JSON.stringify(cap));
await convert();
doc = load();
const old = bySel(/input$/);
check("an older capture of it: the field shows its placeholder, in the browser's own placeholder colour", old?.content === "Search Markets" && old?.colour?.text === "rgb(169, 169, 169)", J({ content: old?.content, colour: old?.colour }));
check("…in the middle of its height", old && Math.abs((old.pad?.top ?? 0) - (old.pad?.bottom ?? 0)) <= 1, J(old?.pad));
const ledger = (() => { try { return readFileSync(join(dir, "ledger.json"), "utf8"); } catch { return ""; } })();
check("…and the ledger says the colour is the browser's, not the page's", /browser's own placeholder colour/.test(ledger), ledger.length ? "not in the ledger" : "no ledger");

for (const r of results) console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name}${r.ok ? "" : ` — ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
