#!/usr/bin/env node
/**
 * What share.xyz showed the Builder dropping (sink: docs/fidelity/share-xyz.md).
 *
 *   node scripts/check-fidelity.mjs
 *
 * - a node's `radius` is a box property: `hasBox` sees it and `boxStyle`
 *   draws it as border-radius;
 * - a part captured `position: sticky` is published sticky: `fluidStyle`
 *   writes position sticky, the inset it stuck at, and keeps its place in
 *   the frame through margins (the frame's parts are absolute);
 * - the importer's picture budget is not the old 40 pictures / 8 MB;
 * - a repository control of `owner/name/sites/<name>` reads that site's own
 *   `site/document.json` and pictures, so SOLCINERATOR at the root and a
 *   second site under `sites/` live in one sink.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "features", "studio");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* The sources are TypeScript with extensionless imports: jiti (already here, under Tailwind) reads them as they are. */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const theme = await jiti.import(join(src, "parts", "theme.ts"));
const fluid = await jiti.import(join(src, "fluidSite.ts"));

/* Radius */
const style = theme.boxStyle({ radius: 12 }, { line: "#000" });
check("a node radius of 12 draws as border-radius 12", style.borderRadius === 12, JSON.stringify(style));
check("a node with only a radius has a box", theme.hasBox({ radius: 12 }) === true);
check("control: a radius of none has no box and draws none", theme.hasBox({}) === false && theme.boxStyle({ radius: null }, { line: "#000" }).borderRadius === undefined);

/* Sticky */
const el = { style: {} };
fluid.fluidStyle(el, { id: "n1", x: 0, y: 0, w: 1440, h: 105, selector: "body > div > div", position: "sticky", inset: { top: 0 } }, { left: { c: 0, k: 0 }, width: { c: 1440, k: 1 } }, 1440, 900);
check("a sticky band is published position sticky at its inset", el.style.position === "sticky" && el.style.top === "0px", JSON.stringify(el.style));
check("…keeping its place in the frame of absolute parts: margins for its top and left, and none of its height added below", el.style.marginTop === "0px" && el.style.marginBottom === "-105px" && el.style.left === "auto" && el.style.marginLeft === "0px", JSON.stringify(el.style));
const el2 = { style: {} };
fluid.fluidStyle(el2, { id: "n2", x: 76, y: 400, w: 300, h: 40, selector: "body > aside", position: "sticky", inset: { top: 84 } }, { left: { c: 76, k: 0 }, width: { c: 300, k: 0 } }, 1440, 900);
check("…a sticky part lower down sticks at its own inset from where it stood", el2.style.position === "sticky" && el2.style.top === "84px" && el2.style.marginTop === "400px" && el2.style.marginLeft === "76px", JSON.stringify(el2.style));
const el3 = { style: {} };
fluid.fluidStyle(el3, { id: "n3", x: 0, y: 0, w: 1440, h: 60, selector: "body > header", position: "fixed" }, { left: { c: 0, k: 0 }, width: { c: 1440, k: 1 }, fixed: "top" }, 1440, 900);
check("control: a fixed band is still fixed", el3.style.position === "fixed" && el3.style.top === "0px");

/* The picture budget */
const run = readFileSync(join(src, "repoRun.ts"), "utf8");
const most = Number(/const MOST_PICTURES = (\d+)/.exec(run)?.[1]);
check("the importer takes hundreds of pictures, not 40 (share.xyz's three pages name 218)", most >= 400, String(most));
check("…and a picture budget of its own, not the 8 MB the whole repository is read within", /MAX_PICTURE_BYTES/.test(run) && !/weight \+ \(entry\.size \?\? 0\) > MAX_REPO_BYTES/.test(run));

/* The frame a sticky band scrolls in */
const exp = readFileSync(join(src, "exportSite.ts"), "utf8");
check("the published page frame clips without becoming the scroll container, so a sticky band sticks to the window", /isPage \? \(el\.getAttribute\("style"\) \?\? ""\)\.replace\(\/overflow:\\s\*hidden\/, "overflow: clip"\)/.test(exp));

/* A site in a folder of the repository */
const imp = await jiti.import(join(src, "repoImport.ts"));
const plain = imp.readRepo("STANDIN-owner/sink");
check("owner/name reads the root, as before", !!plain && plain.owner === "STANDIN-owner" && plain.name === "sink" && !plain.dir && plain.ref === null, JSON.stringify(plain));
const dir = imp.readRepo("STANDIN-owner/sink/sites/share-xyz");
check("owner/name/sites/<name> names the site's folder", !!dir && dir.name === "sink" && dir.dir === "sites/share-xyz" && dir.ref === null, JSON.stringify(dir));
const both = imp.readRepo("STANDIN-owner/sink/sites/share-xyz/@STANDIN-branch");
check("…with a ref after it", !!both && both.dir === "sites/share-xyz" && both.ref === "STANDIN-branch", JSON.stringify(both));
const url = imp.readRepo("https://github.com/STANDIN-owner/sink/tree/STANDIN-branch/sites/share-xyz");
check("…or as a GitHub address of the folder", !!url && url.dir === "sites/share-xyz" && url.ref === "STANDIN-branch", JSON.stringify(url));
check("…and it is written back with the folder", !!dir && imp.repoName(dir) === "STANDIN-owner/sink/sites/share-xyz", dir && imp.repoName(dir));
check("the document is looked for in that folder", imp.madeHere(["sites/share-xyz/site/document.json"], "sites/share-xyz") === true && imp.madeHere(["site/document.json"], "sites/share-xyz") === false && imp.madeHere(["site/document.json"], null) === true);
check("…and its pictures beside it", imp.docPathIn("sites/share-xyz") === "sites/share-xyz/site/document.json" && imp.pathIn("sites/share-xyz", "assets/pictures/pic_1.png") === "sites/share-xyz/assets/pictures/pic_1.png" && imp.pathIn(null, "assets/pictures/pic_1.png") === "assets/pictures/pic_1.png");

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
