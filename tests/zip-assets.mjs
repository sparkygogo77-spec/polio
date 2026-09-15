/**
 * A zip's page gets its assets under their own names, and a data script is not "scripts" (inventory C19).
 *
 * Every request the page in a zip makes is answered out of the zip or
 * refused. Three quiet refusals:
 *
 *   · `.bmp .tif .tiff .heic .heif .mp3 .ogg .oga .ogv .eot .xml .wasm`
 *     and a file with no extension were not in the list of types, so the
 *     page got a broken picture or a missing font and nothing said why;
 *   · a `%` in a name that was not an escape threw inside the answer, so
 *     one odd address failed the whole read;
 *   · a `<script type="application/ld+json">`, which runs nothing, made
 *     the panel say the page brought scripts that were not run.
 *
 * Now the common types are known, a file with no extension is served as
 * what its bytes say (a picture by its first bytes, otherwise plain
 * bytes), a bad escape is a miss rather than a throw, and only a script
 * that would run counts as one.
 *
 *   node tests/zip-assets.mjs
 */
import { contentType, fileFor, hadScripts, sansScripts } from "../src/features/studio/zipImport.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 1. Types. */
const wanted = { "a.bmp": "image/bmp", "a.tif": "image/tiff", "a.tiff": "image/tiff", "a.heic": "image/heic", "a.heif": "image/heif", "a.mp3": "audio/mpeg", "a.ogg": "audio/ogg", "a.oga": "audio/ogg", "a.ogv": "video/ogg", "a.eot": "application/vnd.ms-fontobject", "a.xml": "application/xml", "a.wasm": "application/wasm", "a.mjs": "text/javascript", "a.js": "text/javascript", "a.map": "application/json" };
const missing = Object.entries(wanted).filter(([n, t]) => (contentType(n) ?? "").split(";")[0] !== t);
check(`the common types are known: ${Object.keys(wanted).length - missing.length} of ${Object.keys(wanted).length}`, missing.length === 0, missing.map(([n]) => `${n} → ${contentType(n)}`).join(", ") || "all");
check("the old ones still are", contentType("a.css")?.startsWith("text/css") && contentType("a.woff2") === "font/woff2" && contentType("a.png") === "image/png");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
check("a file with no extension is served as what its bytes say", contentType("logo", PNG) === "image/png", String(contentType("logo", PNG)));
check("and as plain bytes when they say nothing", contentType("LICENSE", new TextEncoder().encode("hello")) === "application/octet-stream", String(contentType("LICENSE", new TextEncoder().encode("hello"))));
check("a name with no extension and no bytes to read is still refused", contentType("logo") === null, String(contentType("logo")));

/* 2. A bad escape. */
const names = new Set(["index.html", "img/a.png"]);
let threw = null; let hit = "unset";
try { hit = fileFor("/img/100%.png", names, ""); } catch (e) { threw = e; }
check("a % that is not an escape is a miss, not a throw", threw === null && hit === null, threw ? String(threw) : `→ ${hit}`);
check("a real escape still finds its file", fileFor("/img/a%2Epng", names, "") === "img/a.png", String(fileFor("/img/a%2Epng", names, "")));

/* 3. Scripts that run, and data that does not. */
check("a JSON-LD script alone is not scripts", hadScripts('<html><head><script type="application/ld+json">{"@type":"Thing"}</script></head></html>') === false);
check("nor a JSON or a template block", hadScripts('<script type="application/json" id="d">{}</script><script type="text/template"><b>x</b></script>') === false);
check("a script that would run is", hadScripts("<script>alert(1)</script>") && hadScripts('<script type="module" src="a.js"></script>') && hadScripts('<script type="text/javascript">x()</script>'));
check("an inline handler is too", hadScripts('<button onclick="go()">x</button>'));
const kept = sansScripts('<script type="application/ld+json">{"a":1}</script><script>run()</script>');
check("the page's data stays when its scripts are taken out", /ld\+json/.test(kept) && !/run\(\)/.test(kept), kept);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
