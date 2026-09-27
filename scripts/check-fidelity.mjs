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

/* (b) The parts a band owns stick with it */
const band = { id: "hdr", x: 0, y: 0, w: 1440, h: 105, selector: "body > div > div", position: "sticky", inset: { top: 0 } };
const logo = { id: "logo", x: 76, y: 16, w: 41, h: 56, selector: "body > div > div > header > div > a" };
const nav = { id: "nav", x: 76, y: 85, w: 1200, h: 17, selector: "body > div > div > nav" };
const card = { id: "card", x: 76, y: 483, w: 350, h: 178, selector: "body > div > div:nth-of-type(2) > main > article" };
const inner = { id: "inner", x: 300, y: 20, w: 300, h: 40, selector: "body > div > div > header > div:nth-of-type(2)", position: "fixed" };
const deep = { id: "deep", x: 310, y: 30, w: 100, h: 20, selector: "body > div > div > header > div:nth-of-type(2) > span" };
const moves = fluid.bandMoves([band, logo, nav, card, inner, deep]);
check("(b) the parts whose path continues a sticky band's go into it, at their place within it", moves.get("logo")?.band === "hdr" && moves.get("logo")?.top === 16 && moves.get("nav")?.band === "hdr" && moves.get("nav")?.top === 85, JSON.stringify([...moves]));
check("(b) …a part beside the band (a sibling path, div:nth-of-type(2)) stays where it is", !moves.has("card"));
check("(b) …a band inside the band takes its own part first, then goes in with it", moves.get("deep")?.band === "inner" && moves.get("deep")?.top === 10 && moves.get("deep")?.dx === 300 && moves.get("inner")?.band === "hdr" && moves.get("inner")?.top === 20, JSON.stringify([...moves]));
check("(b) control: with no band nothing moves", fluid.bandMoves([logo, nav, card]).size === 0);

/* The picture budget */
const run = readFileSync(join(src, "repoRun.ts"), "utf8");
const most = Number(/const MOST_PICTURES = (\d+)/.exec(run)?.[1]);
check("the importer takes hundreds of pictures, not 40 (share.xyz's three pages name 218)", most >= 400, String(most));
check("…and a picture budget of its own, not the 8 MB the whole repository is read within", /MAX_PICTURE_BYTES/.test(run) && !/weight \+ \(entry\.size \?\? 0\) > MAX_REPO_BYTES/.test(run));

const store = readFileSync(join(src, "store.ts"), "utf8");

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

/* The Capture dialog's path, through the door and the importer */
const withPath = imp.withPath({ owner: "STANDIN-owner", name: "sink", ref: "captures/example" }, "sites/example");
check("a path beside the repository is the site's folder", withPath.dir === "sites/example" && withPath.ref === "captures/example" && imp.repoName(withPath) === "STANDIN-owner/sink/sites/example@captures/example", imp.repoName(withPath));
check("…and what the door places names it, so the Builder reads it back", imp.readRepo(imp.repoName(withPath))?.dir === "sites/example" && imp.readRepo(imp.repoName(withPath))?.ref === "captures/example");
check("…an empty path is the repository as it was", imp.withPath({ owner: "o", name: "n", ref: null }, "") .dir === undefined && imp.withPath({ owner: "o", name: "n", ref: null }, "/sites/x/").dir === "sites/x");
const runSrc = readFileSync(join(src, "repoRun.ts"), "utf8");
check("readRepoSite takes { path } beside the repository, as the Capture dialog expects", /readRepoSite\(repo: Repo, token: string, say: \(line: string\) => void, opts\?: \{ path\?: string \| null \}\)/.test(runSrc) && /if \(opts\?\.path\) repo = withPath\(repo, opts\.path\);/.test(runSrc));
const door = readFileSync(join(src, "bringRepo.ts"), "utf8");
check("the door carries Bringing.path into what it places for the board", /path\?: string \| null;/.test(door) && /const repo = withPath\(named, o\.path\);/.test(door) && /placeBring\(placed\)/.test(door) && /keepBringForBoard\(placed\)/.test(door));

/* The art a capture recorded (claude/trumpmorty-art) */
const art = theme.boxStyle({ opacity: 0.5, art: { blend: "multiply", filter: "blur(2px)", transform: "rotate(3deg)", background: "linear-gradient(red, blue)", backgroundOptions: ["cover", "center", "no-repeat"], textShadow: "0 1px 0 #000", textStroke: { w: 1, color: "#000" }, paintOrder: "stroke" } }, { line: "#000" });
check("(c) the art a capture recorded is drawn as written: opacity, blend, filter, transform, gradient, shadowed and outlined type", art.opacity === 0.5 && art.mixBlendMode === "multiply" && art.filter === "blur(2px)" && art.transform === "rotate(3deg)" && art.backgroundImage === "linear-gradient(red, blue)" && art.backgroundSize === "cover" && art.textShadow === "0 1px 0 #000" && art.WebkitTextStroke === "1px #000" && art.paintOrder === "stroke", JSON.stringify(art));
check("(c) a node with only art, or only an opacity, has a box to draw it on", theme.hasBox({ art: { filter: "blur(2px)" } }) === true && theme.hasBox({ opacity: 0.5 }) === true);
check("(c) control: an identity transform, a full opacity and an empty art draw nothing", (() => { const s = theme.boxStyle({ opacity: 1, art: { transform: "matrix(1, 0, 0, 1, 0, 0)" } }, { line: "#000" }); return s.opacity === undefined && s.transform === undefined; })() && theme.hasBox({ opacity: 1, art: {} }) === false);

/* (a) The document's home: IndexedDB, a mirror or a pointer beside it, packed paths */
const ds = await jiti.import(join(src, "docStore.ts"));
const sels = ["body > div > div:nth-of-type(2) > main > section:nth-of-type(1) > div:nth-of-type(2) > article:nth-of-type(1) > div:nth-of-type(2) > span > span", "body > div > header > h1", "body > custom-tag > div:nth-of-type(11)", "body > div > svg > g > path:nth-of-type(3)"];
check("(a) a recorded path packs to a fraction and unpacks to itself, exactly", sels.every((x) => ds.unpackSelector(ds.packSelector(x)) === x) && ds.packSelector(sels[0]).length * 3 < sels[0].length, `${sels[0].length} → ${ds.packSelector(sels[0]).length}: ${ds.packSelector(sels[0])}`);
check("(a) …div:nth-of-type(1) and (11) stay apart, and a tag it has no letter for travels in braces", ds.packSelector("body > div:nth-of-type(1)") !== ds.packSelector("body > div:nth-of-type(11)") && ds.packSelector("body > custom-tag") === "B/{custom-tag}");
check("(a) …a path of another shape is left as it was", ds.packSelector("#root .card") === null && ds.packFrom({ selector: "#root .card", url: "u" }).selector === "#root .card");
const envelope = JSON.stringify({ state: { pages: [{ id: "p" }], nodes: [{ id: "n1", from: { url: "u", selector: sels[0], at: 1 } }, { id: "n2", from: null }, { id: "n3" }], siteRepo: "STANDIN-owner/sink" }, version: 0 });
const packedText = ds.packDocText(envelope);
check("(a) a document's text packs its paths and unpacks to the same text", packedText.length < envelope.length && /"sel":/.test(packedText) && !/"selector":/.test(packedText) && ds.unpackDocText(packedText) === envelope, `${envelope.length} → ${packedText.length}`);
check("(a) a document that fits localStorage is mirrored whole; one that does not is mirrored packed; one past that leaves a pointer with the site's shape", ds.mirrorText(envelope, 10000).kind === "full" && ds.mirrorText(envelope, envelope.length - 1).kind === "packed" && ds.mirrorText(envelope, 10).kind === "pointer" && JSON.stringify(ds.shapeOfRaw(ds.mirrorText(envelope, 10).text)) === JSON.stringify({ pages: 1, parts: 3, siteRepo: "STANDIN-owner/sink" }), ds.mirrorText(envelope, 10).text);
check("(a) a pointer is known for one, a document is not", ds.isPointer(ds.mirrorText(envelope, 10).text) === true && ds.isPointer(envelope) === false && ds.isPointer(null) === false);
check("(a) the studio store reads and writes through it, and unpacks a path on the way in", /getItem: \(k\) => readDoc\(k\)/.test(store) && /writeDoc\(k, v\)/.test(store) && /unpackFrom\(n\.from/.test(store) && !/\.unsaved/.test(store));
const builds = readFileSync(join(here, "..", "src", "features", "builds", "store.ts"), "utf8");
check("(a) the builds store moves documents between the live key and the slots through it, waiting for IndexedDB", /const read = \(key: string\): Promise<string \| null> => readDoc\(key\);/.test(builds) && /writeDocNow\(key, value\)/.test(builds) && /open: async \(id\)/.test(builds) && /await get\(\)\.save\(\)/.test(builds));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
