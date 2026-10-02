/**
 * EVERY COLOUR AND FACE A CAPTURED SITE USES, BY USE, AND SWAP-ALL.
 *
 * trumpmorty.fun, as sink captured it (sites/trumpmorty-fun), landed the way
 * Bring lands it (`landPalette`: parts whose colour is a role name the role).
 * The six roles showed 6 colours; the site wears dozens, on words, fills,
 * outlines, hard shadows and gradients. `siteColours.ts` lists every one by
 * what it is used for, says which parts wear it, and recolours exactly those
 * (docs/audit/palette-captured.md).
 *
 *   node tests/site-colours.mjs            # SINK=capture/versions/sink-0ee06fa/sites/trumpmorty-fun
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const S = join(here, "..", "src", "features", "studio");
const C = await jiti.import(join(S, "siteColours.ts"));
const { landPalette } = await jiti.import(join(S, "paletteFrom.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ---------------------------------------------------------------- the key */
check("one colour, however it is written", C.colourKey("#1a0f0b") === "rgb(26, 15, 11)" && C.colourKey("rgb(26,15,11)") === "rgb(26, 15, 11)" && C.colourKey("rgba(0, 0, 0, 0.25)") === "rgba(0, 0, 0, 0.25)",
  [C.colourKey("#1a0f0b"), C.colourKey("rgb(26,15,11)"), C.colourKey("rgba(0, 0, 0, 0.25)")].join(" | "));

/* ------------------------------------------------------ a small made site */
const INK = "rgb(26, 15, 11)", RED = "rgb(210, 60, 52)", SUN = "rgb(243, 212, 64)";
const parts = [
  { id: "a", colour: { text: INK }, content: "Words", font: { face: "Luckiest Guy", stack: "\"Luckiest Guy\", Impact, sans-serif", size: 2 } },
  { id: "b", colour: { bg: RED, surface: RED, accent: RED, text: INK }, content: "Buy", edge: { width: 4, style: "solid", colour: INK, shadow: `${INK} 5px 5px 0px 0px` }, font: { face: "Fredoka" } },
  { id: "c", colour: { text: SUN }, content: [{ text: "one " }, { text: "green", colour: "rgb(166, 216, 111)" }], art: { textStroke: { w: 3, color: INK }, textShadow: `${INK} 6px 6px 0px, ${RED} 10px 10px 0px` }, font: { face: "VT323" } },
  { id: "d", colour: null, art: { background: `linear-gradient(160deg, rgb(74, 81, 112), ${SUN} 60%)` } },
  { id: "e", colour: { bg: "surface" }, content: "" },
];
const pal = { bg: "rgb(29, 34, 51)", surface: "rgb(41, 47, 68)", text: INK };
const t = C.tallyColours(parts, pal);
const find = (use, v) => t.byUse[use].find((c) => c.key === C.colourKey(v));
check("the near-black is Text on 2 parts, a Border on 2 (edge + outline on words), a Shadow on 2", find("text", INK)?.by.text === 2 && find("border", INK)?.by.border === 2 && find("shadow", INK)?.by.shadow === 2,
  JSON.stringify(t.all.find((c) => c.key === INK)?.by));
check("a run of words' colour is Text", !!find("text", "rgb(166, 216, 111)"));
check("a gradient's stops are Fills", !!find("fill", "rgb(74, 81, 112)") && !!find("fill", SUN), t.byUse.fill.map((c) => c.key).join(", "));
check("an accent slot that is only the fill again adds no accent spot", !find("accent", RED)?.spots.some((x) => x.use === "accent"), JSON.stringify(find("accent", RED)?.spots));
check("the accents are the colours that are colours, wherever worn; greys are not", !!find("accent", RED) && !!find("accent", SUN) && !find("accent", INK) && !find("accent", pal.bg), t.byUse.accent.map((c) => c.key).join(", "));
check("the page's own colour is a Fill, worn by the page", find("fill", pal.bg)?.spots.some((s) => s.id === C.PAGE_ID));
check("a role name reads as the colour it shows now", find("fill", pal.surface)?.spots.some((s) => s.id === "e" && s.role === "surface"));

/* swap-all, scoped to a use */
const sw = C.swapColour(parts, pal, INK, "#ffffff", { use: "text" });
check("recolouring the Text near-black touches the 2 parts whose words wore it", sw.changed.sort().join(",") === "a,b", sw.changed.join(","));
check("…and leaves its border and shadow alone", sw.nodes[1].edge.colour === INK && sw.nodes[1].edge.shadow.startsWith(INK) && sw.nodes[2].art.textStroke.color === INK);
check("…and parts that never wore it are the same objects", sw.nodes[3] === parts[3] && sw.nodes[4] === parts[4]);
const all = C.swapColour(parts, pal, INK, "#ffffff");
const left = C.tallyColours(all.nodes, pal).all.find((c) => c.key === INK);
check("recolouring every use leaves no part in the old colour", !left && all.changed.length === 3, `${all.changed.join(",")}; left ${left?.parts ?? 0}`);
check("…inside a shadow list only the matching colour changes", all.nodes[2].art.textShadow === `#ffffff 6px 6px 0px, ${RED} 10px 10px 0px`, all.nodes[2].art.textShadow);
const role = C.swapColour(parts, pal, pal.surface, "#123456");
check("a part that named a role gets the literal, the role itself does not move", role.nodes[4].colour.bg === "#123456" && role.pageBg === null, JSON.stringify(role.nodes[4].colour));
check("the page is recoloured when it wore the colour", C.swapColour(parts, pal, pal.bg, "#000000").pageBg === "#000000");

/* faces */
const faces = C.tallyFonts(parts);
check("every face with its parts", faces.map((f) => `${f.key}:${f.parts}`).join(",") === "Fredoka:1,Luckiest Guy:1,VT323:1", faces.map((f) => `${f.key || "site's"}:${f.parts}`).join(","));
const ff = C.swapFont(parts, "Luckiest Guy", { face: "Fredoka" });
check("swap a face: the part is in the new face, and the page's stack naming the old one is gone", ff.nodes[0].font.face === "Fredoka" && !ff.nodes[0].font.stack && ff.nodes[0].font.size === 2 && ff.changed.join() === "a", JSON.stringify(ff.nodes[0].font));

/* ---------------------------------------------------- the real capture */
const SINK = process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa", "sites", "trumpmorty-fun");
const docPath = join(SINK, "site", "document.json");
let ran = false;
if (existsSync(docPath)) {
  ran = true;
  const doc = JSON.parse(readFileSync(docPath, "utf8"));
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const nodes = landed.nodes, palette = landed.palette;
  const T = C.tallyColours(nodes, palette);
  /* Every colour literal anywhere in a part's colours, edges, art and runs. */
  const raw = new Set();
  const walk = (v, k = "") => {
    if (typeof v === "string") { if (/colou?r|shadow|stroke|background|^bg$|^text$|surface|accent|highlight|muted/i.test(k)) for (const x of C.coloursIn(v)) raw.add(C.colourKey(x)); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
    else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) if (!["motion", "from", "prompt", "picture", "vector", "work"].includes(kk)) walk(x, kk);
  };
  for (const n of doc.nodes) walk({ colour: n.colour, edge: n.edge, art: n.art, content: n.content, aura: n.aura });
  const missing = [...raw].filter((k) => !T.all.some((c) => c.key === k));
  check(`every colour the site wears is listed (${raw.size} in the capture)`, missing.length === 0 && T.all.length >= raw.size, missing.slice(0, 6).join("; ") || `${T.all.length} listed`);
  const counts = Object.fromEntries(C.COLOUR_USES.map((u) => [u, T.byUse[u].length]));
  check("each use has its own colours: text, fills, borders, shadows, accents", C.COLOUR_USES.every((u) => counts[u] > 0), JSON.stringify(counts));
  const ink = T.all.find((c) => c.key === "rgb(26, 15, 11)");
  check("the near-black is shown for all it does, not just as a Text role", !!ink && ink.by.text > 50 && ink.by.border > 5 && ink.by.shadow > 5, JSON.stringify(ink?.by));
  check("parts that are pictures are counted, their colours being in the picture", T.pictures === doc.nodes.filter((n) => n.picture).length && T.pictures > 0, `${T.pictures}`);

  const sun = "rgb(243, 212, 64)";
  const before = C.whoWears(nodes, palette, sun, "text").map((s) => s.id);
  const swapped = C.swapColour(nodes, palette, sun, "#00ffcc", { use: "text" });
  check("swap-all on the site's yellow words recolours exactly the parts shown for it", [...new Set(before)].sort().join() === swapped.changed.sort().join() && before.length > 0,
    `${new Set(before).size} shown, ${swapped.changed.length} changed`);
  const untouched = nodes.filter((n, i) => !swapped.changed.includes(n.id) && swapped.nodes[i] !== n);
  check("…and no other part is so much as copied", untouched.length === 0, `${untouched.length}`);

  const F = C.tallyFonts(nodes);
  const f = (k) => F.find((x) => x.key === k)?.parts ?? 0;
  check("its three faces, each with its parts", f("Luckiest Guy") >= 50 && f("Fredoka") >= 20 && f("VT323") >= 15, F.map((x) => `${x.key || "site's type"} ${x.parts}`).join(", "));
  const vt = C.swapFont(nodes, "VT323", { face: "Fredoka" });
  check("swap-all VT323 → Fredoka: every VT323 part moves, and none is left", vt.changed.length === f("VT323") && !C.tallyFonts(vt.nodes).some((x) => x.key === "VT323"), `${vt.changed.length} moved`);

  const follow = C.roleFollowers(nodes);
  check("role counts are recounted from the parts, and match the import's", Object.entries(landed.from).every(([r, s]) => s.shows || follow[r] === s.parts), JSON.stringify(follow));
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}${ran ? "" : " (the trumpmorty capture was not found; its half did not run)"}`);
process.exit(bad ? 1 : 0);
