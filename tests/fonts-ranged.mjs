/**
 * A face declared twice under one name, one rule for a few characters only.
 *
 * gotchi.gg loads Google's Pixelify Sans (all of Latin) and then a file of
 * its own under the same family for its digits (`unicode-range: U+30-39`).
 * Both are Latin by `isLatin`, both had one id, and the first read was the
 * one carried: in the Builder the digits file stood for the whole face and
 * every letter fell to a monospace, wide enough to cut "adopt" to "adop" and
 * wrap "my pets". Each rule is its own entry, in the page's order, and each
 * `@font-face` written keeps its `unicode-range`, so the browser picks per
 * character as the page's did (the last rule declared wins a character two
 * ranges both hold).
 *
 * Pure: no server, no browser.
 *
 *   node --experimental-strip-types tests/fonts-ranged.mjs
 */
import { carryFaces, fontFaceCss } from "../src/features/studio/look/fonts.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const bytes = { "https://fonts.gstatic.com/pixelify-latin.woff2": new Uint8Array(4000).fill(7), "https://site.test/fonts/digits.woff2": new Uint8Array(900).fill(3) };
const read = {
  faces: [
    { family: "Pixelify Sans", weight: "400 700", style: "normal", sources: [{ url: "https://fonts.gstatic.com/pixelify-cyrillic.woff2", format: "woff2" }], sheet: "https://fonts.googleapis.com/css2", unicodeRange: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
    { family: "Pixelify Sans", weight: "400 700", style: "normal", sources: [{ url: "https://fonts.gstatic.com/pixelify-latin.woff2", format: "woff2" }], sheet: "https://fonts.googleapis.com/css2", unicodeRange: LATIN },
    { family: "Pixelify Sans", weight: "400 700", style: "normal", sources: [{ url: "https://site.test/fonts/digits.woff2", format: "woff2" }], sheet: "https://site.test/css/base.css", unicodeRange: "U+30-39" },
  ],
  links: [],
};
const got = await carryFaces(read, ["Pixelify Sans"], "https://site.test/", async (u) => (bytes[u] ? { bytes: bytes[u] } : { error: "not served" }));
const fonts = got.fonts.filter((f) => f.family === "Pixelify Sans");

check("both the Latin file and the digits file are carried", fonts.length === 2 && fonts.every((f) => f.carried), JSON.stringify(fonts.map((f) => [f.id, f.carried, f.bytes])));
check("…the Latin file, not the ten digits, is the face's letters (4000 bytes, its own id)", fonts.some((f) => f.bytes === 4000 && f.id === "font:pixelify-sans:400-700:normal"), JSON.stringify(fonts.map((f) => [f.id, f.bytes])));
check("…the digits file has an id of its own, its range in it", fonts.some((f) => f.bytes === 900 && f.id !== "font:pixelify-sans:400-700:normal" && /u30-39/.test(f.id)), JSON.stringify(fonts.map((f) => f.id)));
check("…in the page's order: Latin first, the digits after it", fonts[0]?.bytes === 4000 && fonts[1]?.bytes === 900, JSON.stringify(fonts.map((f) => f.bytes)));
check("…the Cyrillic subset is still left out", !got.fonts.some((f) => /cyrillic/.test(JSON.stringify(f.from)) || f.unicodeRange?.includes("0400")), JSON.stringify(got.fonts.map((f) => f.unicodeRange)));

const css = fontFaceCss(got.fonts);
const rules = css.split("\n");
check("each @font-face keeps its unicode-range", rules.length === 2 && /unicode-range:U\+30-39/.test(rules[1] ?? "") && /unicode-range:U\+0000-00FF/.test(rules[0] ?? ""), css.replace(/base64,[^)]+/g, "base64,…"));
check("…written in the page's order, so the digits rule, declared last, draws the digits", rules.findIndex((r) => /U\+30-39/.test(r)) > rules.findIndex((r) => /U\+0000-00FF/.test(r)), css.replace(/base64,[^)]+/g, "base64,…"));

const plain = await carryFaces({ faces: [{ family: "Blob", weight: "400", sources: [{ url: "https://site.test/blob.woff2", format: "woff2" }], sheet: null }], links: [] }, ["Blob"], "https://site.test/", async () => ({ bytes: new Uint8Array(10) }));
check("control: a face with no range keeps its old id and writes no unicode-range", plain.fonts[0]?.id === "font:blob:400:normal" && !/unicode-range/.test(fontFaceCss(plain.fonts)), JSON.stringify(plain.fonts.map((f) => f.id)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
