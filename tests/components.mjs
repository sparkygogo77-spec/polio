#!/usr/bin/env node
/**
 * A BUTTON AND ITS LAYERS ARE ONE THING: RECOGNISED ON THREE CAPTURED BOARDS.
 *
 * The owner: "make sure the builder properly understands and associates a
 * button, its outline, its shadow, its animations and the text within it all
 * as one thing, so it is not just stacked parts in capture order."
 * `components.ts` reads components back from the stacked parts. Held here on
 * sink's trumpmorty.fun, parasiteonsol.fun and gotchi.gg, landed as Bring
 * lands them (`docTake.ts`):
 *
 *   · how many of each kind are recognised (buttons, tabs, copy-address
 *     bars, badges, cards, panels, tickers), within what each board has;
 *   · every part a button holds is one of its layers (or a component of its
 *     own inside it), and no part is in two components;
 *   · trumpmorty's BUY $TRORTY is one button: the box paints the fill, the
 *     outline and the shadow and carries the link and the hover, the gloss is
 *     its lighting bar, the words are its words;
 *   · resized, every layer keeps its place on the host;
 *   · recolouring a job changes the part that paints it and nothing else: the
 *     fill on the host, the words on the words, the light keeps its
 *     transparency, an inset light is left alone when the shadow is recoloured;
 *   · counted as one: the colour roles say "N buttons" for N components, not
 *     for the parts that paint them; and a component written out as data for
 *     a library carries every job.
 *
 *   node tests/components.mjs [the capture folder]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
let SINK = process.argv[2] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
if (!existsSync(join(SINK, "sites")) && existsSync(join(SINK, "..", "..", "sites"))) SINK = join(SINK, "..", "..");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { takeDoc } = await src("docTake.ts");
const { readComponents, holdsPart, recolour, resizedWith, countAsOne, componentSpec, componentsOf } = await src("components.ts");
const { siteRoles } = await src("siteRoles.ts");

const land = (site) => {
  const at = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(at)) return null;
  const doc = JSON.parse(readFileSync(at, "utf8"));
  const took = takeDoc({ pages: [{ id: "page_home" }], nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 }, doc, { format: () => ({}), look: () => ({}) });
  return { nodes: took.nodes, palette: took.look?.palette ?? {} };
};
const boards = { trumpmorty: land("trumpmorty-fun"), parasite: land("parasiteonsol-fun"), gotchi: land("gotchi-gg") };
if (Object.values(boards).some((b) => !b)) { console.error(`no capture folder with the three sites at ${SINK}`); process.exit(2); }

/* ------------------------------------------------------------ counts by kind */
const EXPECT = {
  trumpmorty: { button: [15, 30], "copy-bar": [3, 3], ticker: [2, 2], badge: [15, 40], card: [8, 20], panel: [3, 10] },
  parasite: { button: [300, 450], tab: [14, 14], badge: [300, 450], card: [60, 120], panel: [20, 50] },
  gotchi: { button: [100, 200], tab: [22, 22], badge: [60, 120], card: [50, 100], panel: [30, 60] },
};
const read = {};
for (const [name, b] of Object.entries(boards)) {
  const t = Date.now();
  const c = readComponents(b.nodes, b.palette);
  const ms = Date.now() - t;
  read[name] = c;
  const by = Object.fromEntries(Object.keys(EXPECT[name]).map((k) => [k, c.list.filter((x) => x.kind === k).length]));
  const off = Object.entries(EXPECT[name]).filter(([k, [lo, hi]]) => by[k] < lo || by[k] > hi);
  check(`${name}: components recognised by kind`, off.length === 0, `${J(by)} in ${ms} ms, ${c.of.size} of ${b.nodes.length} parts in a component`);

  // Every part a button holds is its layer, or a component of its own inside it.
  const nodes = new Map(b.nodes.map((n) => [n.id, n]));
  const stray = [];
  for (const comp of c.list.filter((x) => ["button", "tab", "copy-bar"].includes(x.kind))) {
    const host = nodes.get(comp.id);
    const inside = new Set([...comp.parts, ...comp.children.flatMap((k) => c.byId.get(k)?.parts ?? [])]);
    for (const n of b.nodes) if (holdsPart(host, n) && J(n.state ?? null) === J(host.state ?? null) && !n.loose && !inside.has(n.id) && !c.byId.has(n.id) && c.of.get(n.id) !== comp.id) {
      // A part held by a smaller component inside this one belongs to that one.
      const owner = c.of.get(n.id);
      if (!owner || !holdsPart(host, nodes.get(owner))) stray.push(`${comp.id}>${n.id}`);
    }
  }
  check(`${name}: every button's layers are grouped with it`, stray.length === 0, stray.slice(0, 4).join(" "));
  const seen = new Map();
  let twice = 0;
  for (const comp of c.list) for (const p of comp.parts) { if (seen.has(p)) twice++; seen.set(p, comp.id); }
  check(`${name}: no part is in two components`, twice === 0, `${twice}`);
}

/* ------------------------------------------------------------ BUY $TRORTY */
const tm = boards.trumpmorty, tc = read.trumpmorty;
const byId = new Map(tm.nodes.map((n) => [n.id, n]));
const buy = tc.list.find((c) => c.kind === "button" && /BUY \$TRORTY/.test(c.name));
check("trumpmorty: BUY $TRORTY is one button", !!buy, buy?.name);
check("…its box paints the fill, the outline and the shadow, and carries the link and the hover", buy && buy.paints.fill === buy.id && buy.paints.outline === buy.id && buy.paints.shadow === buy.id && buy.paints.link === buy.id && buy.paints.hover.includes(buy.id), J(buy?.paints));
check("…the gloss over it is its lighting bar, the words its words", buy && buy.layers.some((l) => l.role === "lighting") && buy.layers.some((l) => l.role === "words" && /BUY/.test(String(byId.get(l.id)?.content))), J(buy?.layers));
const ticker = tc.list.filter((c) => c.kind === "ticker");
check("trumpmorty: both ribbons are tickers, each holding its running words", ticker.length === 2 && ticker.every((t) => t.paints.motion.length > 0), J(ticker.map((t) => [t.name, t.paints.motion])));
const bars = tc.list.filter((c) => c.kind === "copy-bar");
check("trumpmorty: the three contract-address bars are copy-address bars", bars.length === 3 && bars.every((b) => b.layers.some((l) => l.role === "words")), J(bars.map((b) => b.name)));

/* ------------------------------------------------------------ resize keeps layers on the host */
{
  let bad = [];
  for (const [name, b] of Object.entries(boards)) {
    const nodes = new Map(b.nodes.map((n) => [n.id, n]));
    for (const comp of read[name].list.filter((x) => x.kind === "button").slice(0, 60)) {
      const h = nodes.get(comp.id);
      const to = { x: h.x + 17, y: h.y - 9, w: Math.round(h.w * 1.3), h: Math.round(h.h * 1.4) };
      for (const l of comp.layers) {
        const n = nodes.get(l.id);
        const r = resizedWith(h, to, n);
        const relX = (n.x - h.x) / h.w, relY = (n.y - h.y) / h.h, nx = (r.x - to.x) / to.w, ny = (r.y - to.y) / to.h;
        if (Math.abs(relX - nx) > 0.02 || Math.abs(relY - ny) > 0.02 || Math.abs(n.w / h.w - r.w / to.w) > 0.02) bad.push(`${name}:${l.id}`);
      }
    }
  }
  check("resized, every layer of every button keeps its place and share on the host", bad.length === 0, bad.slice(0, 3).join(" "));
}

/* ------------------------------------------------------------ recolour hits the right layer */
{
  const fill = recolour(tm.nodes, buy, "fill", "rgb(10, 200, 30)");
  check("recolour the fill: only the part that paints the fill changes", J(Object.keys(fill)) === J([buy.id]) && fill[buy.id].colour.bg === "rgb(10, 200, 30)", J(fill));
  const words = recolour(tm.nodes, buy, "words", "rgb(250, 0, 0)");
  check("recolour the words: only its words change", Object.keys(words).length >= 1 && Object.keys(words).every((id) => buy.paints.words.includes(id) && words[id].colour.text === "rgb(250, 0, 0)"), J(Object.keys(words)));
  const light = recolour(tm.nodes, buy, "lighting", "rgb(255, 230, 0)");
  const lid = Object.keys(light)[0];
  check("recolour the lighting bar: its layer, keeping its transparency", lid && byId.get(lid) && /rgba\(255, 230, 0, 0\.4\)/.test(light[lid].colour.bg), J(light));
  const shadow = recolour(tm.nodes, buy, "shadow", "rgb(0, 0, 255)");
  check("recolour the shadow: the outer shadow's colour on the box", /rgb\(0, 0, 255\)/.test(shadow[buy.id]?.edge?.shadow ?? ""), shadow[buy.id]?.edge?.shadow);
  const tv = tc.list.find((c) => (byId.get(c.id)?.edge?.shadow ?? "").includes("rgba(255, 255, 255, 0.25) 0px 8px 0px 0px inset"));
  if (tv) {
    const s = recolour(tm.nodes, tv, "shadow", "rgb(0, 0, 255)")[tv.id]?.edge?.shadow ?? "";
    check("…an inset light on the same part is left as it was", /rgba\(255, 255, 255, 0\.25\) 0px 8px 0px 0px inset/.test(s) && /rgb\(0, 0, 255\)/.test(s), s);
  }
}

/* ------------------------------------------------------------ counted as one */
{
  const three = tc.list.filter((c) => c.kind === "button").slice(0, 3);
  const all = three.flatMap((c) => c.parts);
  check("countAsOne: three buttons' parts count as three", countAsOne(tm.nodes, all, tm.palette).count === 3, `${all.length} parts`);
  const comps = componentsOf(tm.nodes, tm.palette);
  const counted = { countAs: (id) => comps.of.get(id) ?? id, kindOf: (id) => { const h = comps.of.get(id); return h ? comps.byId.get(h)?.kind ?? null : null; } };
  const plain = siteRoles(tm.nodes, tm.palette, 1440);
  const once = siteRoles(tm.nodes, tm.palette, 1440, undefined, undefined, counted);
  const swatches = (r) => [...r.short.flatMap((x) => x.swatches), ...r.more].filter((s) => s.role === "buttons");
  const lead = swatches(once)[0];
  const ids = new Set(lead.spots.map((s) => comps.of.get(s.id) ?? s.id));
  check("the colour roles count a button once: the swatch's count is its components", lead.parts === ids.size && /buttons: \d+ button/.test(lead.says), `${lead.says} (${lead.spots.length} spots on ${new Set(lead.spots.map((s) => s.id)).size} parts)`);
  check("…and without components the colour roles read exactly as before", J(siteRoles(tm.nodes, tm.palette, 1440)) === J(plain));
  const spec = componentSpec(tm.nodes, buy, tm.palette);
  check("a component as data for a library: kind, layers by job, fill, outline, shadow, light, words, link, hover", spec.kind === "button" && spec.fill && spec.outline?.width === 4 && /10px 10px/.test(spec.shadow) && spec.lighting && spec.words && spec.link && spec.hover.length > 0 && spec.layers.every((l) => l.x >= -0.1 && l.x <= 1.1), J({ ...spec, layers: spec.layers.length }));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
