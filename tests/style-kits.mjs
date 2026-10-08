#!/usr/bin/env node
/**
 * STYLE KITS, READ OFF THREE CAPTURED BOARDS, AND THE DRAWING BASICS.
 *
 * `styleKits.ts` lifts a site's own way of dressing a button, a card, a
 * panel and a badge off its real parts, so a shape drawn with the space
 * tool can wear it. Held here on sink's trumpmorty.fun, parasiteonsol.fun
 * and gotchi.gg, as captured:
 *
 *   · each board gives kits in every role it has, named plainly after the
 *     site ("Trorty button"), never the same name twice, at most four a role;
 *   · parts that differ only in their fill are one kit, their colours kept
 *     as its swatches (trumpmorty's eight remote keys are one "Trorty
 *     button"), and no two kits of a role are the same look;
 *   · every kit's shadows are exactly its first source part's outer
 *     shadows, offset, blur, spread and colour, hard when unblurred;
 *   · the lighting bars match their source: the remote keys' gloss (a
 *     `::before` of white at 0.35, 10px down, 12px in, 25px deep), the
 *     television's inset light (white at 0.25, 8px from the top),
 *     parasite's buttons (white at 0.5, 3px) with their 2px press, and
 *     gotchi's cards (white at 0.22, 5px);
 *   · each board's captured motions are listed by what they do.
 *
 * And `wornShape.ts`, without a browser: a rough circle, cone, box and star
 * snap clean and a blob does not; the line as drawn is kept so the snap can
 * be undone; a line whose end comes back near its start is closed; a light
 * band turns with a shape's long axis; the stylesheet a worn shape carries
 * holds its motion back for a visitor who asked for less.
 *
 *   node --experimental-strip-types tests/style-kits.mjs [the capture folder]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { kitsFromDoc, motionsFromDoc, parseShadows, KITS_PER_ROLE, siteShortName } from "../src/features/studio/look/styleKits.ts";
import { bandOffset, closeLine, glossFrame, motionFrames, nearlyClosed, shapeFromLine, snapOutline, toBox, wornCss, wornFor } from "../src/features/studio/wornShape.ts";

const here = dirname(fileURLToPath(import.meta.url));
let SINK = process.argv[2] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
// Handed a site folder (sites/trumpmorty-fun), take the checkout it is in.
if (!existsSync(join(SINK, "sites")) && existsSync(join(SINK, "..", "..", "sites"))) SINK = join(SINK, "..", "..");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const board = (site) => {
  const at = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(at)) return null;
  const d = JSON.parse(readFileSync(at, "utf8"));
  const doc = { nodes: d.nodes, palette: d.look?.palette ?? null, name: d.brief?.name, host: d.head?.url ? new URL(d.head.url).host : null, keyframes: d.keyframes ?? d.look?.keyframes, behaviours: d.behaviours };
  return { d, doc, kits: kitsFromDoc(doc), byId: new Map(d.nodes.map((n) => [n.id, n])) };
};

const boards = { trumpmorty: board("trumpmorty-fun"), parasite: board("parasiteonsol-fun"), gotchi: board("gotchi-gg") };
if (Object.values(boards).some((b) => !b)) { console.error(`no capture folder with the three sites at ${SINK}`); process.exit(2); }

/* ------------------------------------------------------------ every board */
for (const [name, b] of Object.entries(boards)) {
  const roles = new Set(b.kits.map((k) => k.role));
  const names = b.kits.map((k) => k.name);
  check(`${name}: kits in every role, at most ${KITS_PER_ROLE} a role`, ["button", "card", "panel", "badge"].every((r) => roles.has(r)) && ["button", "card", "panel", "badge"].every((r) => b.kits.filter((k) => k.role === r).length <= KITS_PER_ROLE), `${b.kits.length} kits: ${J(names)}`);
  check(`${name}: named after the site, plainly, never twice`, new Set(names).size === names.length && names.every((n) => n.startsWith(b.kits[0].site) && !/[<>{}]|undefined|null/.test(n)), J(names));
  // Dedupe: one kit stands for many parts, and no two kits of a role look the same.
  const looks = b.kits.map((k) => J([k.role, k.fill.kind, k.border, k.shadows, k.bar, k.shade, k.rim, k.radiusShare >= 0.9 ? "pill" : Math.round(k.radiusShare * 4), k.hover && [Math.sign(k.hover.dx), Math.sign(k.hover.dy)], !!k.press]));
  check(`${name}: near-identical parts are one kit (more parts than kits, no two kits alike)`, b.kits.reduce((s, k) => s + k.count, 0) > b.kits.length && new Set(looks).size === looks.length, `${b.kits.reduce((s, k) => s + k.count, 0)} parts in ${b.kits.length} kits`);
  // Shadows as the source part wrote them.
  const bad = b.kits.filter((k) => {
    const src = b.byId.get(k.from[0]);
    const want = parseShadows(src?.edge?.shadow).filter((s) => !s.inset && s.colour.a > 0.02).map((s) => [s.dx, s.dy, s.blur, s.spread]);
    return J(k.shadows.map((s) => [s.dx, s.dy, s.blur, s.spread])) !== J(want) || k.shadows.some((s) => s.hard !== (s.blur === 0));
  });
  check(`${name}: every kit's shadows are its source part's, offset, blur and spread`, bad.length === 0, J(bad.map((k) => k.name)));
  check(`${name}: its motions are named by what they do`, motionsFromDoc(b.doc).length >= 3 && motionsFromDoc(b.doc).every((m) => m.frames.length && m.duration > 0 && /^[A-Z]/.test(m.name)), J(motionsFromDoc(b.doc).map((m) => m.name)));
}

/* ------------------------------------------------------------ trumpmorty.fun */
{
  const b = boards.trumpmorty;
  check("the site's short name is its ticker: Trorty", siteShortName(b.doc.name) === "Trorty", siteShortName(b.doc.name));
  const button = b.kits.find((k) => k.name === "Trorty button");
  check("Trorty button: the remote keys, one kit, their colours kept as swatches", !!button && button.count >= 8 && button.swatches.length >= 6 && button.from.every((id) => b.byId.get(id)?.featureId === "cta-primary"), J(button && { count: button.count, swatches: button.swatches.length }));
  const s = button?.shadows[0];
  check("…hard shadow 0 10px in the site's near-black", s && s.dx === 0 && s.dy === 10 && s.blur === 0 && s.hard && s.colour === "rgb(26, 15, 11)", J(s));
  check("…a 4px border, corners about half its height, Luckiest Guy, lifts 3px under the hand", button?.border?.width === 4 && button.radius === 22 && button.text?.face === "Luckiest Guy" && button.hover?.dy === -3, J(button && { border: button.border, radius: button.radius, face: button.text?.face, hover: button.hover }));
  // Its lighting bar is the gloss the page lays inside each key.
  const key = b.byId.get(button.from[0]);
  const gloss = b.d.nodes.find((m) => m.label.startsWith("::before") && m.x >= key.x && m.y >= key.y && m.x + m.w <= key.x + key.w && m.y + m.h <= key.y + key.h);
  const bar = button.bar;
  check("…its lighting bar is the key's own gloss, as measured", bar?.kind === "gloss" && bar.opacity === 0.35 && bar.colour === "rgb(255, 255, 255)" && bar.edge === gloss.y - key.y && bar.ends === gloss.x - key.x && bar.size === gloss.h && bar.radius === gloss.radius, J({ bar, gloss: { dx: gloss.x - key.x, dy: gloss.y - key.y, h: gloss.h, bg: gloss.colour?.bg, r: gloss.radius } }));
  const tv = b.kits.find((k) => k.role === "panel" && k.bar);
  const body = tv && b.byId.get(tv.from[0]);
  check("the television's inset light is a panel's lighting bar: white at 0.25, 8px from the top", tv?.bar?.kind === undefined && tv.bar.dx === 0 && tv.bar.dy === 8 && tv.bar.opacity === 0.25 && tv.bar.angle === 90 && /rgba\(255, 255, 255, 0\.25\) 0px 8px 0px 0px inset/.test(body?.edge?.shadow ?? ""), J(tv?.bar));
  check("…and its shade below: black at 0.12, 10px from the bottom", tv?.shade?.dy === -10 && tv.shade.opacity === 0.12, J(tv?.shade));
  check("…and its gradient fill, as the page wrote it", tv?.fill.kind === "linear" && tv.fill.angle === 160 && tv.fill.stops?.length === 3, J(tv?.fill));
  const blink = motionsFromDoc(b.doc).find((m) => /^Blink/.test(m.name));
  check("the LIVE light's blink is a motion a shape can take", !!blink && blink.frames.some((f) => f.style.opacity === "0") && blink.timing === "steps(2)", J(blink));
  check("the ribbons' marquee is a slide", motionsFromDoc(b.doc).some((m) => /^Slide/.test(m.name) && m.timing === "linear"));
}

/* ------------------------------------------------------------ parasiteonsol.fun and gotchi.gg */
{
  const b = boards.parasite;
  const lit = b.kits.find((k) => k.role === "button" && k.bar);
  const src = lit && b.byId.get(lit.from[0]);
  check("parasite: its lit buttons carry the page's inset light, white at 0.5, 3px", lit?.bar?.dy === 3 && lit.bar.opacity === 0.5 && /rgba\(255, 255, 255, 0\.5\) 0px 3px 0px 0px inset/.test(src?.edge?.shadow ?? ""), J(lit?.bar));
  check("…a border drawn as an inset ring is read as the border", lit?.border?.width === 3 && lit.border.colour === "rgb(43, 24, 56)", J(lit?.border));
  check("…and they press 2px down, as the page's :active does", lit?.press?.dy === 2, J(lit?.press));
  const g = boards.gotchi;
  const card = g.kits.find((k) => k.role === "card" && k.bar);
  check("gotchi: a card's inset light, white at 0.22, 5px", card?.bar?.dy === 5 && card.bar.opacity === 0.22, J(card?.bar));
  const btn = g.kits.find((k) => k.name === "gotchi button");
  check("gotchi: its buttons are pills with a hard 0 3px shadow", btn?.radiusShare === 1 && btn.shadows[0]?.dy === 3 && btn.shadows[0].hard, J(btn && { r: btn.radiusShare, s: btn.shadows }));
}

/* ------------------------------------------------------------ drawing basics */
const wob = (i) => 1 + Math.sin(i * 1.9) * 0.04;
const seg = (a, c, n) => Array.from({ length: n }, (_, i) => [a[0] + ((c[0] - a[0]) * i) / n + Math.sin(i * 3.1) * 1.5, a[1] + ((c[1] - a[1]) * i) / n + Math.cos(i * 2.7) * 1.5]);
const circle = Array.from({ length: 60 }, (_, i) => { const a = (i / 59) * Math.PI * 2 * 0.97; return [200 + Math.cos(a) * 80 * wob(i), 200 + Math.sin(a) * 76 * wob(i)]; });
const cone = [...seg([140, 60], [260, 60], 20), ...seg([260, 60], [200, 300], 20), ...seg([200, 300], [146, 70], 20)];
const box = [...seg([100, 100], [300, 100], 20), ...seg([300, 100], [300, 200], 10), ...seg([300, 200], [100, 200], 20), ...seg([100, 200], [100, 108], 10)];
const star = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, c = -Math.PI / 2 + ((i + 1) * Math.PI) / 5, r1 = i % 2 ? 40 : 100, r2 = i % 2 ? 100 : 40; star.push(...seg([200 + Math.cos(a) * r1, 200 + Math.sin(a) * r1], [200 + Math.cos(c) * r2, 200 + Math.sin(c) * r2], 8)); }
const blob = Array.from({ length: 60 }, (_, i) => { const a = (i / 59) * Math.PI * 2; const r = 80 + 30 * Math.sin(a * 3); return [200 + Math.cos(a) * r, 200 + Math.sin(a) * r]; });

check("a rough circle snaps to a circle", snapOutline(circle)?.snap === "circle");
check("a rough cone snaps to a triangle of three corners", snapOutline(cone)?.snap === "triangle" && snapOutline(cone).pts.length === 3);
check("a rough box snaps to a box", snapOutline(box)?.snap === "rectangle");
check("a rough star snaps to a five-pointed star", snapOutline(star)?.snap === "star" && snapOutline(star).pts.length === 10);
check("a blob is left as drawn", snapOutline(blob) === null);
const drawn = shapeFromLine(cone, { snap: true });
check("snapped, the line as drawn is kept for undo", drawn.snap === "triangle" && drawn.raw.length > 12 && drawn.raw.every(([x, y]) => x >= 130 && x <= 275 && y >= 50 && y <= 310), `${drawn.raw.length} points`);
const raw = toBox(drawn.raw);
const w = wornFor(boards.trumpmorty.kits[0], { ...toBox(drawn.pts), smooth: drawn.smooth, snap: drawn.snap }, raw, null);
const undone = { ...w, pts: w.raw.pts, smooth: true, snap: null, raw: null };
check("undo gives the raw line back, in its own box", undone.pts.length === raw.pts.length && undone.snap === null && w.raw.box.w > 100);
check("with snap off the line stays as drawn", shapeFromLine(cone, { snap: false }).snap === null);
check("a line ending near its start is closed; an open C is not", nearlyClosed(cone) && !nearlyClosed(circle.slice(0, 40)));
const over = [...circle, ...circle.slice(0, 8)];
check("an overshoot past the start is trimmed back", closeLine(over).length <= circle.length + 1, `${over.length} → ${closeLine(over).length}`);

/* ------------------------------------------------------------ light and motion on a shape */
const tall = [[100, 0], [150, 300], [50, 300]], wide = [[0, 100], [300, 50], [300, 150]];
check("an inset light along the top of a wide part runs down the side of a tall shape, lit from the left", J(bandOffset({ dx: 0, dy: 8 }, { w: 200, h: 80 }, tall)) === J([8, 0]) || bandOffset({ dx: 0, dy: 8 }, { w: 200, h: 80 }, tall)[0] > 7.9, J(bandOffset({ dx: 0, dy: 8 }, { w: 200, h: 80 }, tall)));
check("…and stays along the top of a wide one", bandOffset({ dx: 0, dy: 8 }, { w: 200, h: 80 }, [[0, 0], [300, 0], [300, 100], [0, 100]])[1] === 8);
const gf = glossFrame({ kind: "gloss", dx: 0, dy: 25, size: 25, blur: 0, angle: 90, colour: "rgb(255, 255, 255)", opacity: 0.35, edge: 10, ends: 12, share: 0.26, radius: 14 }, tall);
check("a gloss on a tall shape faces the light on its left", gf.n[0] < -0.9 && Math.abs(gf.n[1]) < 0.2, J(gf.n));
const k = boards.trumpmorty.kits[0];
const m = motionsFromDoc(boards.trumpmorty.doc).find((x) => /^Pulse/.test(x.name));
const worn = { ...wornFor(k, { pts: [[0.5, 0], [1, 1], [0, 1]], smooth: false, snap: "triangle" }, null, null), motion: { ...m, speed: 2, strength: 2 } };
const css = wornCss("n_test", worn, 200, 300);
check("a worn shape's stylesheet carries its motion, held back for less motion, at double speed", /@keyframes wk-n_test-move/.test(css) && /prefers-reduced-motion: no-preference/.test(css) && css.includes(`${Math.round(m.duration / 2)}ms`), css.split("\n").slice(-2).join(" "));
check("…scaled by its strength", J(motionFrames(worn.motion, 200, 300)).includes("scale(1.1)"), J(motionFrames(worn.motion, 200, 300)));
check("…and its hover lifts as the kit's parts did", css.includes(".wk-n_test:hover .wk-lift { transform: translate(0px, -3px)"), css.split("\n")[1]);
check("the board draws it still", !/@keyframes|:hover/.test(wornCss("n_test", worn, 200, 300, { still: true })));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
