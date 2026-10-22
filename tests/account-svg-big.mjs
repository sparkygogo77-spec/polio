/**
 * AN ANIMATED SVG OF RASTER FRAMES IS KEPT, AND STILL RUNS NOTHING.
 *
 * thesolface.site, synced to the Account: two pictures were refused 413.
 * Both are SVG animations of 16 JPEG frames, each frame an `<image>` with a
 * `data:image/jpeg` address (pic_6de1aeda.svg 1.47 MB, pic_ff8178bc.svg
 * 1.13 MB). The SVG cleaner (`src/app/api/account/svg.ts`) refused anything
 * over 1 MB, and stripped every address that was not `#id`, so raising the
 * limit alone would have kept a blank picture.
 *
 * Now an SVG is kept up to the plain save's 4 MB, still cleaned; an
 * `<image>` keeps its own raster pixels (`data:image/png|jpeg|gif|webp|avif`);
 * an SVG in a data address, anywhere else's address, and raster data on any
 * other element are stripped as before.
 *
 *   node tests/account-svg-big.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { cleanSvg } = await jiti.import(join(here, "..", "src", "app", "api", "account", "svg.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const enc = (s) => new TextEncoder().encode(s);

/* thesolface's shape: frames shown in turn by CSS keyframes, ~1.5 MB of JPEG in data addresses. */
const frame = "/9j/" + "A".repeat(92 * 1024);
const frames = Array.from({ length: 16 }, (_, i) => `<image class="f${i}" width="512" height="511" href="data:image/jpeg;base64,${frame}"/>`).join("");
const ANIMATED = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="511" viewBox="0 0 512 511"><style>@keyframes s0{0%{opacity:1}6%{opacity:0}}.f0{animation:s0 1s infinite}</style>${frames}</svg>`;
const big = cleanSvg(enc(ANIMATED));
check("an animated SVG of 1.5 MB is kept", big.ok === true, big.ok ? `${(ANIMATED.length / 1048576).toFixed(2)} MB` : big.says);
check("…with all 16 of its JPEG frames", big.ok && (big.text.match(/<image[^>]*href="data:image\/jpeg;base64,/g) ?? []).length === 16);
check("…and its keyframes", big.ok && /@keyframes s0/.test(big.text));

/* Controls: what runs or fetches is still stripped. */
const inner = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`).toString("base64");
const HOSTILE = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><image id="svgdata" href="data:image/svg+xml;base64,${inner}"/><image id="svgplain" xlink:href="data:image/svg+xml,&lt;svg onload='alert(1)'/&gt;"/><image id="far" href="https://evil.test/x.png"/><use id="usedata" href="data:image/png;base64,AAAA"/><a id="link" href="data:image/png;base64,AAAA"><circle r="1"/></a><circle id="ok" r="2"/></svg>`;
const h = cleanSvg(enc(HOSTILE));
const t = h.ok ? h.text : "";
check("control: a script hidden in an SVG in a data address is stripped", h.ok && !/image\/svg\+xml/i.test(t) && !new RegExp(inner.slice(0, 20)).test(t), t);
check("control: an image from anywhere else is stripped", h.ok && !/evil\.test/.test(t), t);
check("control: raster data on anything but an <image> is stripped", h.ok && !/data:image\/png/.test(t), t);
check("control: the drawing is intact", h.ok && /<circle[^>]*id="ok"/.test(t), t);
const tooBig = cleanSvg(enc(`<svg xmlns="http://www.w3.org/2000/svg"><desc>${"x".repeat(4200 * 1024)}</desc></svg>`));
check("control: an SVG over 4 MB is refused in words", tooBig.ok === false && /4 MB/.test(tooBig.says), tooBig.ok ? "kept" : tooBig.says);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
