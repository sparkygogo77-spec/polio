/**
 * A page's own motion and embeds come through the capture, so the Builder
 * can replay them (docs/motion.md).
 *
 * A stand-in page is served on two hostnames of one local server, so one of
 * its stylesheets is cross-origin the way Google Fonts is. It holds:
 *
 *   (1) `@keyframes` in its own stylesheet and in the cross-origin one;
 *       an element running an animation with every longhand set; a button
 *       with a transition; `:hover` rules on the button itself (its value
 *       through a custom property) and on a child of a hovered card (in
 *       the cross-origin sheet); a `:focus` rule on a field;
 *   (2) an iframe with `allow` and `sandbox`;
 *   (3) a title split into per-letter spans by its script, the way
 *       trumpmorty.fun splits "TRUMP & MORTY": two rows, one letter
 *       coloured apart, every letter its own animation delay, and an
 *       outline and shadow set on the row.
 *
 * It is captured the way every page is (`capture-route.mjs`) and
 * converted. Then the capture and the document must hold each, in the
 * additive fields (`keyframes`, `node.motion`, `node.embed`), and the
 * committed SOLCINERATOR captures must still convert to the committed
 * document byte for byte.
 *
 *   node capture/site/capture/check-motion.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile, spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args, stdio) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); if (stdio) c.stdout.pipe(process.stdout); });
const dir = mkdtempSync(join(tmpdir(), "check-motion-"));

const files = {
  "/": ["text/html", `<!doctype html><html><head><link rel="stylesheet" href="http://localhost:PORT/far.css"><style>
    :root{--lift:-3px;--hot:#0cf;--ease:cubic-bezier(.2, .9, .3, 1.4)}
    body{margin:0;font-family:sans-serif}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    @keyframes wob{0%,100%{transform:translateY(0)}50%{transform:translateY(var(--lift))}}
    .spinner{width:60px;height:60px;background:#0a0;animation:spin 2s linear .5s infinite alternate both}
    .btn{display:inline-block;padding:10px 20px;background:#f30;color:#fff;transition:transform .3s ease-out}
    .btn:hover{transform:translateY(var(--lift));background:var(--hot)}
    .card{width:200px;height:100px;background:#eee;position:relative}
    .knob{width:20px;height:20px;background:#333;transition:transform .2s var(--ease) .05s}
    .field:focus{outline:3px solid #f0f}
    .title{font-size:80px;display:flex;flex-direction:column;align-items:flex-start;margin:0}
    .row{display:flex;color:#fff;-webkit-text-stroke:4px #000;paint-order:stroke fill;text-shadow:6px 6px 0 #000}
    .row .l{display:inline-block;animation:wob 2.6s ease-in-out infinite}
    .row .l.odd{color:#ff0}
    iframe{width:400px;height:300px;border:0}
  </style></head><body>
    <div class="spinner"></div>
    <a class="btn" href="#">Press</a>
    <div class="card"><div class="knob"></div></div>
    <input class="field" placeholder="Type">
    <h1 class="title" aria-label="Stand in"><span class="row" data-split>STAND</span><span class="row" data-split>IN</span></h1>
    <iframe id="frame" src="http://localhost:PORT/embed" title="Stand-in chart" allow="fullscreen; clipboard-write" sandbox="allow-scripts allow-same-origin"></iframe>
    <script>
      document.querySelectorAll("[data-split]").forEach((row, r) => {
        const txt = row.textContent; row.textContent = "";
        txt.split("").forEach((ch, i) => { const s = document.createElement("span"); s.className = "l" + (r === 0 && i === 2 ? " odd" : ""); s.textContent = ch; s.style.animationDelay = (-(i * 0.2 + r * 0.5)) + "s"; row.appendChild(s); });
      });
    </script></body></html>`],
  "/far.css": ["text/css", `@keyframes bob{50%{translate:0 -18px}} .card:hover .knob{transform:rotate(90deg)} .card{animation:bob 3s ease-in-out infinite}`],
  "/embed": ["text/html", `<!doctype html><body style="margin:0;background:#123">a stand-in chart</body>`],
};
const server = createServer((req, res) => {
  const [type, body] = files[req.url] ?? ["text/plain", ""];
  res.writeHead(files[req.url] ? 200 : 404, { "content-type": type, "access-control-allow-origin": "*" });
  res.end(body.replaceAll("PORT", String(server.address().port)));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--assets", assets, "--settle", "2"], true);
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const cap = JSON.parse(readFileSync(capture, "utf8"));
const els = []; (function g(e) { els.push(e); (e.kids ?? []).forEach(g); })(cap.tree);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* the converter failed; every document check below is red */ }
const bySel = (re) => doc.nodes.find((n) => re.test(n.from?.selector ?? ""));

/* (1) Keyframes, from the page's own sheet and the cross-origin one. */
const kf = (list, name) => (list ?? []).find((k) => k.name === name);
check("the capture holds @keyframes spin from the page's own stylesheet, with its frames", kf(cap.keyframes, "spin")?.frames?.length === 2 && /rotate\(360deg\)/.test(JSON.stringify(kf(cap.keyframes, "spin"))), JSON.stringify(kf(cap.keyframes, "spin")));
check("a custom property in a frame is resolved (wob's 50% moves by -3px)", /translateY\(-3px\)/.test(JSON.stringify(kf(cap.keyframes, "wob")?.frames ?? [])), JSON.stringify(kf(cap.keyframes, "wob")));
check("the capture holds @keyframes bob from the cross-origin stylesheet", kf(cap.keyframes, "bob")?.frames?.[0]?.key === "50%", JSON.stringify(kf(cap.keyframes, "bob")));
check("the document holds every keyframes rule as doc.keyframes", ["spin", "wob", "bob"].every((n) => kf(doc.keyframes, n)?.frames?.length), JSON.stringify((doc.keyframes ?? []).map((k) => k.name)));
/* Found by its fill: it is measured mid-turn, so its box is the rotated square's. */
const spinner = els.find((e) => e.bg === "rgb(0, 170, 0)");
const spinAnim = { name: "spin", duration: "2s", timing: "linear", delay: "0.5s", iterations: "infinite", direction: "alternate", fill: "both" };
check("the spinner's animation is recorded with every longhand", JSON.stringify(spinner?.motion?.animation?.[0]) === JSON.stringify(spinAnim), JSON.stringify(spinner?.motion));
const spinNode = doc.nodes.find((n) => n.colour?.bg === "rgb(0, 170, 0)");
check("…and lands in node.motion.animation", JSON.stringify(spinNode?.motion?.animation?.[0]) === JSON.stringify(spinAnim), JSON.stringify(spinNode?.motion));
check("control: the old node.art.animation still says the name", spinNode?.art?.animation === "spin", JSON.stringify(spinNode?.art));
const btn = els.find((e) => e.t === "a" && e.text === "Press");
check("the button's transition is recorded", JSON.stringify(btn?.motion?.transition?.[0]) === JSON.stringify({ property: "transform", duration: "0.3s", timing: "ease-out", delay: "0s" }), JSON.stringify(btn?.motion?.transition));
check("the button's own :hover rule is recorded, its custom property resolved", btn?.motion?.hover?.some((h) => h.self && h.style?.transform === "translateY(-3px)"), JSON.stringify(btn?.motion?.hover));
check("a shorthand written through a custom property keeps its value (background: var(--hot))", btn?.motion?.hover?.some((h) => h.style?.background === "#0cf"), JSON.stringify(btn?.motion?.hover));
const btnNode = doc.nodes.find((n) => n.content === "Press" || n.label === "Press");
check("…and lands in node.motion.transition and node.motion.hover", btnNode?.motion?.transition?.[0]?.property === "transform" && btnNode?.motion?.hover?.[0]?.style?.transform === "translateY(-3px)", JSON.stringify(btnNode?.motion));
const knob = els.find((e) => e.w === 20 && e.h === 20);
check("a :hover on a card, from the cross-origin sheet, is recorded on the knob it moves, not as its own", knob?.motion?.hover?.some((h) => !h.self && h.selector === ".card:hover .knob" && h.style?.transform === "rotate(90deg)"), JSON.stringify(knob?.motion));
check("the knob's transition keeps its timing function with the custom property resolved, and its delay", knob?.motion?.transition?.[0]?.timing === "cubic-bezier(0.2, 0.9, 0.3, 1.4)" && knob?.motion?.transition?.[0]?.delay === "0.05s", JSON.stringify(knob?.motion?.transition));
const field = els.find((e) => e.t === "input");
check("a :focus rule is recorded on the field", field?.motion?.focus?.some((f) => f.self && /3px/.test(f.style?.outline ?? f.style?.["outline-width"] ?? "")), JSON.stringify(field?.motion));
check("control: an element with no motion carries none", els.filter((e) => e.t === "body").every((e) => !e.motion));

/* (2) The iframe is an embed, never a picture. */
const frame = els.find((e) => e.t === "iframe");
check("the iframe is in the capture with its src, allow and sandbox", frame?.embed?.src === `http://localhost:${port}/embed` && frame.embed.allow === "fullscreen; clipboard-write" && frame.embed.sandbox === "allow-scripts allow-same-origin", JSON.stringify(frame));
const embed = doc.nodes.find((n) => n.embed);
check("the iframe becomes a node with node.embed {src, allow, sandbox, size}", embed?.embed?.src === `http://localhost:${port}/embed` && embed.embed.allow && embed.embed.sandbox && embed.embed.size?.w === 400 && embed.embed.size?.h === 300, JSON.stringify(embed?.embed));
check("…and never a picture", embed && !embed.picture && embed.featureId !== "picture" && !doc.nodes.some((n) => n.featureId === "picture"), embed?.featureId);

/* (3) The per-letter title folds back into one part. */
const titleNodes = doc.nodes.filter((n) => /h1/.test(n.from?.selector ?? ""));
const title = bySel(/h1$/);
const reads = (c) => (typeof c === "string" ? c : (c ?? []).map((r) => r.text).join(""));
check("the title is one part, no part per letter", titleNodes.length === 1 && title, titleNodes.map((n) => `${n.from.selector} ${JSON.stringify(n.content)}`).join(" | "));
check("…reading STAND IN", reads(title?.content) === "STAND IN", JSON.stringify(reads(title?.content)));
check("…keeping the one letter coloured apart as a run of its own", Array.isArray(title?.content) && title.content.some((r) => r.text === "A" && r.colour === "rgb(255, 255, 0)") && title.content.filter((r) => r.colour).length === 1, JSON.stringify(title?.content));
check("…keeping each letter's own animation delay (they differ)", Array.isArray(title?.content) && title.content.filter((r) => r.motion?.animation?.[0]?.name === "wob").length === 7, JSON.stringify(Array.isArray(title?.content) ? title.content.map((r) => r.motion?.animation?.[0]?.delay) : title?.content));
check("…with the row's text effects on the part (outline, paint order, shadow)", title?.art?.textStroke?.w === 4 && /stroke/.test(title?.art?.paintOrder ?? "") && /6px 6px/.test(title?.art?.textShadow ?? ""), JSON.stringify(title?.art));
check("…in the letters' colour and size", title?.colour?.text === "rgb(255, 255, 255)" && title?.font?.size > 0, JSON.stringify({ colour: title?.colour, font: title?.font }));

/* Control: the committed SOLCINERATOR captures, untouched. */
const old = join(dir, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const git = spawnSync("git", ["status", "--porcelain", "--", "site/document.json", "assets"], { cwd: root, encoding: "utf8" });
check("control: the root site/document.json and assets/ are untouched", git.status === 0 && git.stdout.trim() === "", git.stdout.trim());

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
