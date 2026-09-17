/**
 * Connecting a repository: the parts of it that are pure.
 *
 * The address somebody types, which files of a repository are worth
 * pulling, which of them is the page, the category the elements land in —
 * and the zip written in the browser, read back by the very reader the
 * route uses. That last one is the piece worth holding hardest: a zip
 * writer that is nearly right produces a file that opens in one reader and
 * not another, and the failure arrives as "not a zip" a minute later with
 * nothing to look at.
 *
 *   node tests/repo-import.mjs
 */
import { categoryFor, crc32, pageIn, readRepo, repoName, wanted, zipOf } from "../src/features/studio/repoImport.ts";
import { readZipInfo } from "../src/features/studio/zipFile.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const said = (r) => (r ? repoName(r) : "nothing");

/* ------------------------------------------------------------------ */
/* The address                                                          */
/* ------------------------------------------------------------------ */

check("owner/name", said(readRepo("sparkygogo77-spec/polio")) === "sparkygogo77-spec/polio", said(readRepo("sparkygogo77-spec/polio")));
check("the address of one", said(readRepo("https://github.com/sparkygogo77-spec/polio")) === "sparkygogo77-spec/polio");
check("with no scheme", said(readRepo("github.com/sparkygogo77-spec/polio")) === "sparkygogo77-spec/polio");
check("the clone line, which is what gets pasted", said(readRepo("https://github.com/sparkygogo77-spec/polio.git")) === "sparkygogo77-spec/polio");
check("and the ssh one", said(readRepo("git@github.com:sparkygogo77-spec/polio.git")) === "sparkygogo77-spec/polio");
check("a branch, written after an at", said(readRepo("owner/site@main")) === "owner/site@main");
check("a branch, copied out of the dropdown", said(readRepo("https://github.com/owner/site/tree/release/v2")) === "owner/site@release/v2", said(readRepo("https://github.com/owner/site/tree/release/v2")));
check("anything that is not a repository is refused", readRepo("a sentence about a repository") === null);
check("and so is somebody else's host", readRepo("https://gitlab.com/owner/site") === null);
check("and half an address", readRepo("https://github.com/owner") === null);

/* ------------------------------------------------------------------ */
/* What is worth pulling, and which of it is the page                   */
/* ------------------------------------------------------------------ */

const TREE = [
  "index.html", "assets/site.css", "assets/pictures/a1.png", "about/index.html",
  "README.md", "package.json", "src/app/page.tsx", "node_modules/left-pad/index.html",
  "app.js", ".github/workflows/ci.yml", "fonts/dot.woff2",
];
const keep = wanted(TREE);
check("the page, the stylesheet, the pictures and the faces come", ["index.html", "assets/site.css", "assets/pictures/a1.png", "about/index.html", "fonts/dot.woff2"].every((p) => keep.includes(p)), keep.join(", "));
check("the readme, the manifest and the source do not", !keep.some((p) => /README|package\.json|page\.tsx/.test(p)));
check("nor does anything under node_modules", !keep.some((p) => p.includes("node_modules")), keep.filter((p) => p.includes("node_modules")).join(", ") || "none");
check("scripts are left behind, because the route drops them anyway", !keep.includes("app.js"));
check("the page to open is the one at the root", pageIn(TREE) === "index.html", String(pageIn(TREE)));
check("a site kept in a folder is still found", pageIn(["docs/index.html", "docs/style.css"]) === "docs/index.html", String(pageIn(["docs/index.html", "docs/style.css"])));
/* An index anywhere beats a page of any other name: "index.html" is what a
   web server opens and "page.html" is a file somebody left about. Among
   indexes the shallowest wins, which is the rule above. */
check("an index beats a page of another name, however deep it is", pageIn(["a/b/c/index.html", "x/page.html"]) === "a/b/c/index.html", String(pageIn(["a/b/c/index.html", "x/page.html"])));
check("and with no index at all, the shallowest page is the page", pageIn(["a/b/deep.html", "x/page.html"]) === "x/page.html", String(pageIn(["a/b/deep.html", "x/page.html"])));
check("a project with nothing to open says nothing, rather than guessing", pageIn(["src/app/page.tsx", "package.json"]) === null);

/* ------------------------------------------------------------------ */
/* A category of its own                                                */
/* ------------------------------------------------------------------ */

const cat = categoryFor(readRepo("sparkygogo77-spec/Polio"));
const again = categoryFor(readRepo("https://github.com/sparkygogo77-spec/polio/tree/main"));
check("the elements get a category named after the repository", cat.label === "Polio", cat.label);
check("its own, not one of the twelve", cat.id.startsWith("repo:"), cat.id);
check("the same repository is the same category however it was typed", cat.id === again.id && cat.hue === again.hue, `${cat.id} ${cat.hue}°`);
check("and two repositories are two colours", categoryFor(readRepo("a/one")).hue !== categoryFor(readRepo("a/two")).hue);

/* ------------------------------------------------------------------ */
/* The zip, written here and read by the reader the route uses          */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();
const page = "<!doctype html><html><head><link rel=stylesheet href=assets/site.css></head><body><h1>Café</h1></body></html>";
const css = "body{background:#0b0b10;color:#eee}";
const blob = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3, 4, 250, 0, 255]);
const zip = zipOf([
  { name: "index.html", bytes: enc.encode(page) },
  { name: "assets/site.css", bytes: enc.encode(css) },
  { name: "assets/café.png", bytes: blob },
]);
const { files, why } = readZipInfo(zip);
check("what the browser writes, the route's own reader reads", !!files, why ?? `${files?.length} files`);
check("with every file in it", files?.length === 3, String(files?.length));
const byName = new Map((files ?? []).map((f) => [f.name, f]));
check("a name with an accent survives the round trip", byName.has("assets/café.png"), [...byName.keys()].join(", "));
const back = byName.get("index.html")?.bytes();
check("the page comes back byte for byte", new TextDecoder().decode(back) === page, `${back?.length} of ${enc.encode(page).length} bytes`);
const bin = byName.get("assets/café.png")?.bytes();
check("and so do bytes that are not text", bin?.length === blob.length && bin.every((b, i) => b === blob[i]), `${bin?.length} bytes`);
/* A CRC that is wrong is the failure that shows up as "not a zip" somewhere
   else entirely, so it is checked against a value nothing here computed. */
check("the checksum is the real one", crc32(enc.encode("123456789")) === 0xcbf43926, `0x${crc32(enc.encode("123456789")).toString(16)}`);
check("an empty repository writes a zip that is still a zip", !!readZipInfo(zipOf([])).files);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
