/**
 * A FACE SPLIT BY UNICODE-RANGE KEEPS THE FILE THAT DRAWS ITS LETTERS.
 *
 * gotchi.gg declares "Pixelify Sans" twice: its own digits.woff2 for
 * U+30-39 first, then Google's Latin file (U+0000-00FF…). A document
 * holds one file per family, weight and style, and the converter kept the
 * first whose range starts in Latin: the digits. Every letter on the page
 * then fell back to monospace. Google's "M PLUS Rounded 1c" is ~500 such
 * subsets, and the one kept was not the one with a–z either.
 *
 * A stand-in page declares one family the same way (Latin, then the digits
 * file after it, as gotchi.gg's capture holds them; the browser draws a
 * character with the last rule that holds it, so declared first the digits
 * file would draw nothing): the document must carry the Latin one, and the
 * digits file for the digits.
 * And one split as Google splits M PLUS Rounded 1c (slices, a letters-only
 * slice, Latin last) at three weights, set in two: the document carries the
 * rule each character is drawn with, at the weights set.
 * Control: the committed SOLCINERATOR captures convert byte for byte.
 *
 *   node capture/site/capture/check-font-ranges.mjs
 */
import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};
const DIGITS = readFileSync(join(root, "assets/source/886030b0b59bc5a7-s.woff2"));
const LATIN = readFileSync(join(root, "assets/source/c9e224327ce7933e-s.woff2"));
/*
 * GOOGLE'S SPLIT FACE (M PLUS Rounded 1c, 126 rules a weight): per weight,
 * Japanese slices, one of them holding "$", then a slice with the ASCII
 * letters but no space, then Latin (the space, "$", the letters) last. The
 * browser draws each character with the last rule that holds it: Latin. The
 * page sets it at 500 and 800.
 */
const SPLIT = [500, 700, 800].map((w) => [
  ...["U+24, U+4ECF-4F00", "U+3D, U+5E, U+5009-5100", "U+25, U+5341-5400", "U+23, U+3C, U+5500-5600", "U+40, U+5700-5800"].map((r) => `@font-face{font-family:"Split";font-weight:${w};src:url(/digits.woff2) format("woff2");unicode-range:${r}}`),
  `@font-face{font-family:"Split";font-weight:${w};src:url(/digits.woff2) format("woff2");unicode-range:U+21-22, U+27-2A, U+2C-3B, U+3F, U+41-4D, U+4F-5D, U+61-7B, U+7D}`,
  `@font-face{font-family:"Split";font-weight:${w};src:url(/latin.woff2) format("woff2");unicode-range:U+0000-00FF, U+0131, U+2000-206F}`,
].join("\n")).join("\n");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Stand In";src:url(/latin.woff2) format("woff2");unicode-range:U+0000-00FF,U+0131,U+2000-206F}
@font-face{font-family:"Stand In";src:url(/digits.woff2) format("woff2");unicode-range:U+30-39}
@font-face{font-family:"Stand In";src:url(/latin.woff2) format("woff2");font-weight:700;unicode-range:U+0100-024F}
${SPLIT}
body{margin:0;font:20px "Stand In",monospace}
p{font:500 17px "Split",sans-serif} h2{font:800 28px "Split",sans-serif}</style></head><body><h1>your bag keeps it alive 0123</h1>
<p>hold $gotchi, hatch a pixel pet</p><h2>pick your starter</h2></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); return; }
  if (req.url === "/digits.woff2" || req.url === "/latin.woff2") { res.writeHead(200, { "content-type": "font/woff2" }); res.end(req.url === "/digits.woff2" ? DIGITS : LATIN); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const work = mkdtempSync(join(tmpdir(), "capture-font-ranges-"));
mkdirSync(join(work, "routes"), { recursive: true });
const capFile = join(work, "routes", "page_home.json");
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const cap = await new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), `${origin}/`, capFile, "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
server.close();
check("the stand-in page was captured", cap.status === 0 && existsSync(capFile), cap.err.trim().split("\n").pop());
writeFileSync(join(work, "routes.json"), JSON.stringify({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the capture converts", conv.status === 0, conv.stderr.trim().split("\n").pop());
const docFile = join(work, "out", "site", "document.json");
const doc = existsSync(docFile) ? JSON.parse(readFileSync(docFile, "utf8")) : { look: { fonts: [] } };
const fonts = (doc.look?.fonts ?? []).filter((f) => f.family === "Stand In");
const bytesOf = (f) => (f?.source?.src ? Buffer.from(f.source.src.split(",")[1], "base64") : null);
/* The face's letters: the entry with no range in its id (a rule for some characters only carries its range in its id, check-late-art.mjs). */
const regular = fonts.find((f) => (!f.weight || f.weight === "400") && !/:u[0-9a-f]/.test(f.id));
check("the face is carried", !!regular && regular.carried === true, JSON.stringify(fonts.map((f) => [f.id, f.bytes])));
check("the file carried is the one that draws a–z, not the digits-only one", !!bytesOf(regular) && bytesOf(regular).equals(LATIN), JSON.stringify(fonts.map((f) => [f.id, f.bytes])));
const digits = fonts.find((f) => /:u30-39$/.test(f.id));
check("…and the digits-only rule is kept beside it, for its digits alone", !!digits && digits.carried === true && /U\+30-39/i.test(digits.unicodeRange ?? "") && !bytesOf(digits)?.equals(LATIN), JSON.stringify(fonts.map((f) => [f.id, f.unicodeRange])));

/* The split face: the rules the page's words are drawn with, at each weight it sets. */
const split = (doc.look?.fonts ?? []).filter((f) => f.family === "Split");
const weights = new Set(split.filter((f) => f.carried).flatMap((f) => String(f.weight ?? "400").split(/\s+/).map(Number)));
check("a split face carries the rule that draws the page's letters, spaces and $ (Latin, declared last), not a slice without the space", split.length > 0 && split.every((f) => f.carried && bytesOf(f)?.equals(LATIN)), JSON.stringify(split.map((f) => [f.id, f.weight, (f.unicodeRange ?? "").slice(0, 30), f.bytes])));
check("…at every weight the page sets it in (500 and 800), and not at one it never uses (700)", weights.has(500) && weights.has(800) && !weights.has(700), JSON.stringify([...weights]));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
