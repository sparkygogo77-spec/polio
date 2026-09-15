/**
 * The image route reads a picture off its bytes, and does not wait forever for them (inventory C10).
 *
 * What a model hands back is labelled by its transport when the transport
 * says, and by its first bytes when it does not. The byte reader knew four
 * shapes (PNG, JPEG, WebP, GIF) and called everything else a PNG, so an
 * AVIF, an SVG or a BMP with no content type went to the page under the
 * wrong name. A drawing sent up in URL-safe base64 (`-` and `_` for `+`
 * and `/`, which is what some encoders write) was refused as no picture at
 * all. And the fetch that pulls the bytes from the model's URL had no
 * timeout, so a stalled vendor held the route until the platform killed it.
 *
 *   · `mimeOf` knows AVIF, SVG and BMP by their bytes, and says when it is
 *     only guessing;
 *   · `base64Picture` takes URL-safe base64 and hands back the standard
 *     kind, and still refuses a data URL, a URL, and junk;
 *   · `bytesOf` fetches under a timeout (a source read, named as one: the
 *     stall itself needs a vendor to stage it).
 *
 *   node tests/picture-bytes.mjs
 */
import { readFileSync } from "node:fs";
import { answerFrom, mimeOf } from "../src/features/studio/renderAnswer.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bytes = (...b) => Uint8Array.from(b.flatMap((x) => (typeof x === "string" ? [...Buffer.from(x)] : [x])));

/* 1. What the bytes say. */
const PNG = bytes(0x89, "PNG\r\n\x1a\n");
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 ");
const GIF = bytes("GIF89a");
const AVIF = bytes(0, 0, 0, 0x1c, "ftypavif", 0, 0, 0, 0, "avifmif1");
const SVG = bytes('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>');
const SVG_BARE = bytes("\n  <svg viewBox=\"0 0 1 1\"/>");
const BMP = bytes("BM", 0x36, 0, 0, 0, 0, 0, 0, 0);
const JUNK = bytes("hello there, not a picture");
check("a PNG, a JPEG, a WebP and a GIF are still known by their bytes", mimeOf(PNG, "") === "image/png" && mimeOf(JPEG, "") === "image/jpeg" && mimeOf(WEBP, "") === "image/webp" && mimeOf(GIF, "") === "image/gif");
check("an AVIF is known by its ftyp box", mimeOf(AVIF, "") === "image/avif", mimeOf(AVIF, ""));
check("an SVG is known by its markup, with or without an XML head", mimeOf(SVG, "") === "image/svg+xml" && mimeOf(SVG_BARE, "") === "image/svg+xml", `${mimeOf(SVG, "")}, ${mimeOf(SVG_BARE, "")}`);
check("a BMP is known by its two letters", mimeOf(BMP, "") === "image/bmp", mimeOf(BMP, ""));
check("what the transport names wins over the bytes", mimeOf(PNG, "image/webp; charset=binary") === "image/webp");
check("bytes nothing recognises are not called a PNG", mimeOf(JUNK, "") !== "image/png", mimeOf(JUNK, ""));
const junkAnswer = answerFrom("raster", JUNK, "");
check("and a first pass that answers with them is refused with a sentence, not a broken picture", junkAnswer.ok === false && /not a picture/.test(junkAnswer.message ?? ""), junkAnswer.ok ? "ok" : junkAnswer.message);
check("the second pass refuses them the same way (source read)", /UNKNOWN_PICTURE\)/.test(readFileSync("src/app/api/studio/image/route.ts", "utf8")));

/* 2. The drawing's base64. */
let base64Picture = null;
try { ({ base64Picture } = await import("../src/features/studio/renderAnswer.ts")); } catch { /* not there yet */ }
check("the base64 reader is a pure function the route shares", typeof base64Picture === "function");
if (base64Picture) {
  const std = Buffer.from(PNG).toString("base64");
  const safe = std.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const odd = Buffer.from(bytes(0xfb, 0xff, 0xbf, 0xfe, 0xff)).toString("base64");
  const oddSafe = odd.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  check("standard base64 comes back as it was", base64Picture(std) === std);
  check("URL-safe base64 comes back standard, padded, the same bytes", base64Picture(oddSafe) === odd && Buffer.from(base64Picture(oddSafe), "base64").equals(Buffer.from(odd, "base64")), `${oddSafe} → ${base64Picture(oddSafe)}`);
  check("and unpadded standard base64 is padded", base64Picture(std.replace(/=+$/, "")) === std);
  check("a data URL is refused", base64Picture(`data:image/png;base64,${std}`) === null);
  check("a URL is refused", base64Picture("https://example.com/a.png") === null);
  check("junk is refused", base64Picture("not base64 at all!") === null && base64Picture("") === null && base64Picture(42) === null);
  check("and one past the limit is refused", base64Picture("A".repeat(64), 32) === null);
}

/* 3. The route uses both, and its fetch has a clock on it (source read). */
const route = readFileSync("src/app/api/studio/image/route.ts", "utf8");
const fetches = (route.match(/\bfetch\(/g) ?? []).length;
const timed = (route.match(/fetch\([^)]*signal:\s*AbortSignal\.timeout\(/g) ?? []).length;
check(`every fetch in the route runs under a timeout (source read): ${timed} of ${fetches}`, fetches > 0 && timed === fetches);
check("the route reads the drawing's base64 through the shared reader, not its own pattern (source read)", /base64Picture\(/.test(route) && !/\/\^\[A-Za-z0-9\+\/=\]\+\$\//.test(route));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
