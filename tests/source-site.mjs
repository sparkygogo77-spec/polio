/*
 * HIS OWN REPOSITORIES ARE READ FROM THEIR SOURCE.
 *
 * Solcano is a v0 Next app: no page in it, only `app/page.tsx`, the
 * components it imports, `globals.css` and pictures under `public/`. His
 * ruling: read the source, the page components, their text, their
 * classes, their images, and build the document from that, banded as the
 * source is structured. The render path is the fallback for a site whose
 * sources cannot be seen, not the first answer for his own repositories.
 *
 * Two halves. The first reads his real Solcano files with the reader
 * alone, in this process, and holds what a first view of that site shows:
 * the disclaimer up, the FAQ popup closed, the wallet not connected, the
 * header visible, the links as links, the icons drawn, the gradient title
 * painted. The second serves those same files through a stubbed GitHub
 * into the built Builder and holds that the repository lands on the board
 * from its source, with the panel saying so.
 *
 *   node --experimental-strip-types tests/source-site.mjs [http://localhost:3000]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* His real source, checked out beside this repository. */
const SOLCANO = process.env.SOLCANO ?? "/home/user/solcano";
const walk = (d, out = []) => { for (const n of readdirSync(d)) { if (n === "node_modules" || n.startsWith(".") || n.startsWith("sol-incinerator")) continue; const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : out.push(relative(SOLCANO, p)); } return out; };
const paths = existsSync(SOLCANO) ? walk(SOLCANO) : [];
check("his Solcano source is here to read", paths.includes("app/page.tsx"), `${paths.length} files at ${SOLCANO}`);

/* ------------------------------------------------------------------ */
/* 1. The reader alone, on the real files                              */
/* ------------------------------------------------------------------ */

let reader = null;
try { reader = await import("../src/features/studio/bring-in/sourceSite.ts"); } catch (e) { check("the source reader exists", false, String(e.message).slice(0, 100)); }
if (reader) {
  const { findPage, readSource, neededBy, SOURCE_WANTED, twToStyle } = reader;
  check("the page a Next app opens at its root is found", findPage(paths) === "app/page.tsx", String(findPage(paths)));
  const have = new Set(paths);
  const texts = new Map([["app/page.tsx", readFileSync(join(SOLCANO, "app/page.tsx"), "utf8")], ["app/globals.css", readFileSync(join(SOLCANO, "app/globals.css"), "utf8")]]);
  for (let round = 0; round < 4; round++) {
    const want = neededBy(texts, have);
    if (!want.length) break;
    for (const p of want) texts.set(p, readFileSync(join(SOLCANO, p), "utf8"));
  }
  const closure = [...texts.keys()];
  check("what the page reaches through its imports is fetched, and only that: markup files, not helpers, not every file under components/", closure.includes("components/faq-popup.tsx") && closure.includes("components/footer.tsx") && closure.includes("components/wallet-button.tsx") && closure.includes("components/ui/button.tsx") && !closure.includes("components/theme-provider.tsx") && !closure.includes("components/ui/dialog.tsx") && !closure.some((p) => /\.ts$/.test(p)), `${closure.length}: ${closure.join(", ")}`);
  check("and it is bounded: under the cap of sixty", closure.length <= 60, String(closure.length));
  const publicNames = paths.filter((p) => /^public\//.test(p));
  const t0 = performance.now();
  const read = readSource([...texts].map(([path, text]) => ({ path, text })), publicNames);
  const ms = Math.round(performance.now() - t0);
  check("the source reads to a page", !!read && read.entry === "app/page.tsx" && read.html.length > 5000, read ? `${read.html.length} bytes in ${ms}ms` : "null");
  check("in well under a second", ms < 500, `${ms}ms`);
  const html = read?.html ?? "";
  const n = read?.notes ?? { bands: [], opened: [], closed: [], icons: [], unknown: [], pictures: [] };
  /* Banded as the source is banded: the root's children. */
  check("banded as the source is structured: the disclaimer, the header, the main, the footer", n.bands.length === 4 && n.bands[1] === "header" && n.bands[2] === "main" && n.bands[3] === "Footer", n.bands.join(", "));
  check("with a band mark on each, for the landing", (html.match(/data-band="\d+"/g) ?? []).length === 4);
  /* A first view. */
  check("a first view: the disclaimer is up, because nobody has agreed yet", /DISCLAIMER/.test(html) && /AGREE AND CLOSE/.test(html));
  check("the FAQ popup opens closed, so it is not on the page", n.closed.includes("FaqPopup") && !/Where is the reclaimed SOL coming from\?[\s\S]*Where is the reclaimed SOL coming from\?/.test(html), n.closed.join(", "));
  check("no wallet is connected, so the main shows the questions and the connect button, not the burn tools", /Frequently Asked Questions/.test(html) && !/Processing items/.test(html) && !/data-band="3"[^>]*margin-left:16rem/.test(html));
  check("the header starts visible: its state starts true, and the scroll handler that hides it has not run", /class="[^"]*translate-y-0[^"]*"/.test(html) && !/-translate-y-full/.test(html));
  check("the questions come from the const array in the page, unrolled", (html.match(/data-band="3"[\s\S]*<footer/)?.[0].match(/<button/g) ?? []).length >= 8, `${(html.match(/<button/g) ?? []).length} buttons`);
  /* Words, classes, colours, pictures. */
  check("the words are his: the name, the strapline, the footer line", /SOLCINERATOR/.test(html) && /A Sol\s*(?:<[^>]*>\s*)*Works(?:\s*<[^>]*>)*\s*project/.test(html) && /Burn Solana tokens and keep 100% of returned/.test(html));
  check("Link is a component and a link, not a void tag: Terms of Service sits inside its anchor", /<a href="\/terms"[^>]*>\s*Terms of Service\s*<\/a>/.test(html));
  check("the classes are carried as written, and turned into the styles they mean", /class="border-2 border-\[#00ff00\]/.test(html) && /border-color:#00ff00/.test(html));
  check("the theme's tokens come from globals.css: the background, the font", /background:oklch|background:#0a0e1a|background-color:#0a0e1a/.test(html) && /JetBrains Mono/.test(html));
  check("a gradient title is painted, not left transparent", /background-image:linear-gradient\(to right, #f97316, #ef4444\)[^"]*"[^>]*class="[^"]*bg-clip-text/.test(html) || /linear-gradient\(to right, #f97316, #ef4444\)/.test(html));
  check("wide-screen variants apply on the board: the footer is three columns", /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/.test(html));
  check("a box that scrolls on the site shows whole on the board: no max-height on it", !/max-height:calc\(100vh - 200px\)[^"]*"[^>]*class="[^"]*overflow-y-auto/.test(html));
  check("calc gets the spaces CSS needs", /min-height:calc\(100vh - 146px\)/.test(html) && !/min-height:calc\(100vh-146px\)/.test(html));
  check("the icons are drawn as strokes, not boxes", n.icons.includes("Flame") && n.icons.includes("Twitter") && /data-icon="Twitter"[^>]*>(?!<rect)/.test(html), n.icons.join(", "));
  check("the pictures it names are the ones under public/", n.pictures.includes("public/solworks-logo.png") && n.pictures.includes("public/solana-logo.png"), n.pictures.join(", "));
  check("nothing is left as an unknown component", n.unknown.length === 0, n.unknown.join(", ") || "none");
  check("the reader wants sources and pictures, not lockfiles or docs", SOURCE_WANTED.test("app/page.tsx") && SOURCE_WANTED.test("public/logo.png") && !SOURCE_WANTED.test("pnpm-lock.yaml") && !SOURCE_WANTED.test("README.md"));
  check("a Tailwind arbitrary value reads as Tailwind reads it", /box-shadow:0 0 20px rgba\(0,255,0,0.15\)/.test(twToStyle("shadow-[0_0_20px_rgba(0,255,0,0.15)]")));
}

/* Source pins: the order of reading, and the line the panel says. */
const run = readFileSync("src/features/studio/repoRun.ts", "utf8");
const from = ["FromASite.tsx", ...["bring.tsx", "FromASite.tsx", "bits.tsx"].map((f) => `fromasite/${f}`)].map((f) => `src/features/studio/bring-in/${f}`).map((f) => readFileSync(f, "utf8")).join("\n");
check("the source is read after a document made here and before a page in the files or an address", run.indexOf("copyOf(repo, token, ref, blobs, say)") < run.indexOf("sourceOf(repo, token, ref, blobs, say)") && run.indexOf("sourceOf(repo, token, ref, blobs, say)") < run.indexOf("const page = pageIn(paths)"));
check("a source that cannot be fetched falls through, saying why, rather than refusing", /Its source could not be read: \$\{no\.says\} Its page is looked for instead/.test(run));
check("and the panel says a page came from source, which file, and what opened and what stayed closed", /From its source, \$\{got\.source\.page\}/.test(from) && /closed on a first view/.test(from));

/* ------------------------------------------------------------------ */
/* 2. The whole path, in the built Builder, GitHub stubbed with his files */
/* ------------------------------------------------------------------ */

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shaOf = new Map(paths.map((p, i) => [`f${i}`, p]));
const tree = paths.map((p, i) => ({ path: p, type: "blob", sha: `f${i}`, size: statSync(join(SOLCANO, p)).size }));
const fetched = [];
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const m = u.pathname.match(/^\/repos\/him\/solcano(\/.*)?$/);
  if (!m) return j({ message: "no" }, 404);
  const rest = m[1] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = rest.match(/^\/git\/blobs\/(f\d+)$/);
  if (b && shaOf.has(b[1])) { fetched.push(shaOf.get(b[1])); return j({ encoding: "base64", content: readFileSync(join(SOLCANO, shaOf.get(b[1]))).toString("base64") }); }
  return j({ message: "no" }, 404);
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Scratch", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);

const doc = () => page.evaluate(() => { const raw = localStorage.getItem("builder.studio"); if (!raw) return { nodes: 0, spaces: 0, brought: [], text: "" }; const st = JSON.parse(raw).state; return { nodes: st.nodes.length, spaces: (st.spaces ?? []).length, brought: (st.brought ?? []).map((b) => b.label), text: JSON.stringify(st.nodes) }; });
const strip = () => page.evaluate(() => { const e = document.querySelector("[data-import-strip]"); return e ? { kind: e.getAttribute("data-import-strip"), text: e.textContent } : null; });

await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("him/solcano");
const t1 = Date.now();
await page.locator("[data-repo-pull]").click();
let landed = await doc();
let sawSource = false;
for (let i = 0; i < 120 && (landed.nodes === 0 || landed.spaces === 0); i++) {
  await page.waitForTimeout(1000);
  const s = await strip();
  if (s && /From its source, app\/page\.tsx/.test(s.text ?? "")) sawSource = true;
  landed = await doc();
  if (s && s.kind === "refused") break;
}
const took = Date.now() - t1;
await page.waitForTimeout(1500);
landed = await doc();
const line = await strip();
check("his repository of sources lands on the board, with nothing more pressed", landed.nodes >= 3 && landed.spaces === 1, `${landed.nodes} parts, ${landed.spaces} space in ${Math.round(took / 1000)}s; strip: ${(line?.text ?? "").slice(0, 160)}`);
check("from its source, and the panel said so on the way, naming the page file", sawSource || /From its source, app\/page\.tsx/.test(line?.text ?? ""), (line?.text ?? "").slice(0, 200));
check("what landed is the site as he wrote it: its name and its questions are on the board", /SOLCINERATOR/.test(landed.text) && /Frequently Asked Questions/.test(landed.text), `${landed.nodes} parts`);
check("the popup that opens closed did not land", !/Where is the reclaimed SOL coming from\?[\s\S]*Where is the reclaimed SOL coming from\?/.test(landed.text));
check("its elements go to the shelf under the repository's name", landed.brought.includes("solcano"), landed.brought.join(", ") || "none");
check("only the page, what it imports, the theme and the pictures it names were fetched: not the whole tree", fetched.length > 3 && fetched.length < paths.length / 2 && fetched.includes("app/page.tsx") && fetched.includes("app/globals.css") && fetched.includes("public/solworks-logo.png") && !fetched.some((p) => /\.ts$/.test(p)) && !fetched.some((p) => /\.md$|lock/.test(p)), `${fetched.length} of ${paths.length}: ${fetched.join(", ")}`);
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log(failed ? `\n${failed} FAILED — ${passed}/${results.length}` : `\nall good — ${passed}/${results.length}`);
process.exit(failed ? 1 : 0);
