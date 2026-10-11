#!/usr/bin/env node
/**
 * THE BOOK'S DOWNLOAD ALL: ONE ZIP, EVERY FILE AT ITS OWN PATH.
 *
 * With no GitHub key the book says "download instead", and All saved each
 * file by its bare name, one download per file: every page is an
 * index.html, so they landed as index (1).html, index (2).html with no
 * folders, and every picture came out as a .png holding its base64 text.
 * Now All saves one zip (`siteZip`, the same the export for code saves):
 *
 *   · every file is in it under its full path, no two with one name;
 *   · each index.html keeps its own page;
 *   · a picture sent as base64 is its bytes in the zip, a real PNG;
 *   · the book's All goes through it, not one download per bare name.
 *
 * Pure: no browser, no server.
 *
 *   node tests/brief-download-zip.mjs
 *
 * Covers: src/features/studio/send-out/zipWrite.ts, src/features/studio/BriefDialog.tsx, src/features/studio/exportForCode.ts
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { siteZip } = await import("../src/features/studio/send-out/index.ts");
const { readZip } = await import("../src/features/studio/zipFile.ts");

/* The first bytes of a PNG, as collectFiles hands a picture over. */
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const files = [
  { path: "index.html", content: "<h1>home</h1>" },
  { path: "about/index.html", content: "<h1>about</h1>" },
  { path: "features/x/README.md", content: "# x" },
  { path: "assets/p.png", content: png.toString("base64"), encoding: "base64" },
];
const back = readZip(siteZip(files)) ?? [];
const names = back.map((z) => z.name);
const text = (name) => new TextDecoder().decode(back.find((z) => z.name === name)?.bytes() ?? new Uint8Array());

check("every file is in the zip under its full path", names.length === 4 && files.every((f) => names.includes(f.path)), names.join(", "));
check("no two entries share a name", new Set(names).size === names.length);
check("each index.html keeps its own page", text("index.html") === "<h1>home</h1>" && text("about/index.html") === "<h1>about</h1>");
const pic = back.find((z) => z.name === "assets/p.png")?.bytes();
check("the picture is its bytes, not its base64 text", !!pic && pic[0] === 0x89 && pic[1] === 0x50 && pic[2] === 0x4e && pic[3] === 0x47 && pic.length === png.length, pic ? Array.from(pic.slice(0, 4)).join(",") : "missing");

/* The book's All goes through the zip. */
const book = readFileSync(new URL("../src/features/studio/BriefDialog.tsx", import.meta.url), "utf8");
const all = book.slice(book.indexOf("const downloadAll"), book.indexOf("};", book.indexOf("const downloadAll")));
check("the book's All saves one zip, not a download per bare name", /siteZip\(/.test(all) && /saveZip\(/.test(all) && !/split\("\/"\)\.pop\(\)/.test(all));

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
