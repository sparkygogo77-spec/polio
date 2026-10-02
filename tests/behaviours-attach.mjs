#!/usr/bin/env node
/**
 * WHAT A CAPTURED PAGE'S SCRIPTS DID, ATTACHED ON IMPORT.
 *
 * The owner published trumpmorty.fun through the Builder and it came out
 * still: no loader, no marquee, nothing revealed as it scrolled, the
 * landscape deaf to the pointer, the header never taking its yellow bar,
 * the LIVE dots dark. sink now records what the page's scripts do
 * (`doc.behaviours`, sink `docs/behaviours.md`), by part. Taking the
 * document in attaches the library feature that does each, to the part it
 * was recorded on, with the settings measured:
 *
 *   · the CRT loader, on the part showing the loader's picture, with its
 *     title, ticker, channel, label and how long it stood;
 *   · Reveal on scroll on every part the page revealed, and on the parts
 *     inside it (a card's words come in with the card), with the distance,
 *     scale, stagger, duration and curve measured; the hero's intro the
 *     same, waiting for the loader;
 *   · Marquee loop on both ribbons' words, left and right, at the page's
 *     0.6 px a frame (36 px a second), never pausing;
 *   · Follow the pointer, as a layer, on the five landscape layers, with the
 *     factor per layer across, down and with the scroll;
 *   · Header bar on scroll on the header: the yellow and the black edge
 *     once the page is past 40 px;
 *   · Blink on the three lights, taking over the captured blink so the
 *     switch in the Element panel really stops it.
 *
 * A document without `behaviours` comes in exactly as before. Pure: the
 * importer's own `takeDoc`, run on sink's document as written.
 *
 *   node --experimental-strip-types tests/behaviours-attach.mjs [the capture folder]
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { takeDoc } from "../src/features/studio/docTake.ts";
import { usesOf, pageFeatures, getWork, inputsOf, withWork } from "../src/features/studio/library/works.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SINK = process.argv[2] ?? process.env.SINK ?? join(here, "..", "capture", "versions", "sink-0ee06fa");
const DOCFILE = join(SINK, "sites", "trumpmorty-fun", "site", "document.json");
if (!existsSync(DOCFILE)) { console.error(`no sink document at ${DOCFILE}`); process.exit(2); }
const raw = readFileSync(DOCFILE, "utf8");
const doc = JSON.parse(raw);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const near = (a, b, tol) => Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= tol;

const prev = { pages: [{ id: "page_home" }], nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 };
const took = takeDoc(prev, doc, { format: () => ({}), look: () => ({}) });
const nodes = took.nodes;
const byId = new Map(nodes.map((n) => [n.id, n]));
const use = (id, work) => usesOf(byId.get(id)?.work).find((u) => u.id === work);
const inputs = (id, work) => { const u = use(id, work); return u ? inputsOf(getWork(work).manifest, u.inputs) : null; };
const B = doc.behaviours;
check("the document carries sink's behaviours section", B?.version === 1, J(Object.keys(B ?? {})));

/* The library has the two new ones. */
for (const [id, name] of [["scroll-header", "Header bar on scroll"], ["blink", "Blink"]]) {
  const w = getWork(id);
  check(`${name}: in the library`, w?.manifest.name === name && w.manifest.needs === "none" && w.script.includes(`define(${J(id)}`), w ? w.manifest.name : "missing");
  check(`${name}: asks whether the visitor wants less motion`, /prefers-reduced-motion/.test(w?.script ?? ""));
}

/* ----------------------------------------------------------- the loader */
const crt = nodes.filter((n) => usesOf(n.work).some((u) => u.id === "crt-loader"));
check("one part carries the CRT loader", crt.length === 1, crt.map((n) => n.id).join());
const crtIn = crt[0] ? inputs(crt[0].id, "crt-loader") : null;
check("…the part showing the loader's picture (trorty, on the TV)", crt[0]?.featureId === "picture" && /trorty/.test(crt[0]?.data ?? ""), crt[0] ? `${crt[0].id} ${crt[0].data}` : "");
check("…with the loader's words: title, ticker, channel, label", crtIn?.title === "TRUMP & MORTY" && crtIn?.ticker === "$TRORTY" && crtIn?.channel === "CH 47" && crtIn?.label === "TUNING", J(crtIn));
check("…standing as long as the page's did before it switched off", near(crtIn?.hold, B.loader.off.afterMs / 1000, 0.06), `${crtIn?.hold} s, recorded ${B.loader.off.afterMs} ms`);

/* ----------------------------------------------------------- reveal */
const recorded = B.reveal.filter((r) => r.part && !r.folded);
const revealed = recorded.filter((r) => use(r.part, "reveal"));
check("every part the page revealed carries Reveal on scroll", recorded.length === 25 && revealed.length === recorded.length, `${revealed.length}/${recorded.length}`);
const card = B.reveal.find((r) => byId.get(r.part)?.from?.selector?.endsWith("article:nth-of-type(2)") && /section:nth-of-type\(3\)/.test(byId.get(r.part)?.from?.selector ?? ""));
const cardIn = card ? inputs(card.part, "reveal") : null;
check("…from 46 px below, at 0.96, as the page's rest state was", cardIn?.direction === "up" && near(cardIn?.distance, 46, 0.5) && near(cardIn?.scale, 0.96, 0.001), J(cardIn));
check("…with its stagger, duration and curve", cardIn?.delay === String(card?.delayMs) && cardIn?.duration === "800" && /cubic-bezier\(0\.2, 0\.9, 0\.25, 1\.2\)/.test(cardIn?.ease ?? ""), J(cardIn));
check("…each part its own stagger (0, 90, 180, 270 ms across the four cards)", ["1", "2", "3", "4"].map((k) => { const r = B.reveal.find((x) => /section:nth-of-type\(3\)/.test(x.selector ?? "") && x.selector.endsWith(`article:nth-of-type(${k})`)); return r ? inputs(r.part, "reveal")?.delay : null; }).join() === "0,90,180,270");
const inside = card ? nodes.filter((n) => n.from?.selector?.startsWith(`${byId.get(card.part).from.selector} > `)) : [];
check("…and the parts inside a revealed card come in with it, the same way", inside.length >= 3 && inside.every((n) => { const i = inputs(n.id, "reveal"); return i && i.delay === cardIn.delay && i.distance === cardIn.distance && i.scale === cardIn.scale; }), inside.map((n) => `${n.id}:${J(inputs(n.id, "reveal"))}`).join(" ").slice(0, 400));
check("…scaling about the card's centre, not each its own", inside.filter((n) => !n.art?.transform).every((n) => /px .*px/.test(inputs(n.id, "reveal")?.origin ?? "")), inside.map((n) => inputs(n.id, "reveal")?.origin).join(" | "));
const tilted = B.reveal.find((r) => /article:nth-of-type\(3\)$/.test(r.selector ?? "") && /section:nth-of-type\(5\)/.test(r.selector ?? ""));
check("a part whose rest state is its own tilt only fades (no move, no scale)", tilted && inputs(tilted.part, "reveal")?.direction === "none" && inputs(tilted.part, "reveal")?.scale === "1", J(tilted && inputs(tilted.part, "reveal")));

/* ----------------------------------------------------------- the intro */
const intro = B.intro.filter((a) => a.part);
const introIn = intro.map((a) => inputs(a.part, "reveal"));
check("the hero's intro: its six parts carry Reveal, after the loader", intro.length === 6 && introIn.every((i) => i?.after === "loader"), J(introIn.map((i) => i?.after)));
check("…from 40 px below at 0.9, 800 ms, 110 ms apart", introIn.every((i, k) => i?.direction === "up" && near(i.distance, 40, 0.5) && near(i.scale, 0.9, 0.001) && i.duration === "800" && i.delay === String(150 + k * 110)), J(introIn.map((i) => [i?.distance, i?.scale, i?.delay])));

/* ----------------------------------------------------------- the marquees */
const [red, navy] = B.loops;
const redIn = inputs(red.part, "marquee"), navyIn = inputs(navy.part, "marquee");
check("the red ribbon's words run left, the navy one's right", redIn?.direction === "left" && navyIn?.direction === "right", J([redIn, navyIn]));
check("…at the page's own step, 0.6 px a frame, 36 px a second at 60 Hz", redIn?.speed === "36" && navyIn?.speed === "36", J([redIn?.speed, navyIn?.speed]));
check("…never pausing under the mouse, and no gap (the words already repeat)", redIn?.pause === "no" && redIn?.gap === "0" && navyIn?.pause === "no", J(redIn));

/* ----------------------------------------------------------- parallax */
const layers = B.pointer.filter((p) => p.kind === "move");
const layerIn = layers.map((p) => inputs(p.part, "follow-pointer"));
check("the five landscape layers follow the pointer, as layers", layers.length === 5 && layerIn.every((i) => i?.how === "layer"), J(layerIn.map((i) => i?.how)));
check("…each with the factor measured across, down and with the scroll", layers.every((p, k) => near(layerIn[k]?.x, p.perX, 0.01) && near(layerIn[k]?.y, p.perY, 0.01) && near(layerIn[k]?.scroll, p.perScroll, 0.001)), J(layerIn.map((i) => [i?.x, i?.y, i?.scroll])));
/* The TV's turn: once sink sampled it under the pointer (`motion.hover`), a Tilt carrying its screen, knobs and words, so it turns whole (tests/motion-sampled.mjs); before, nothing, since its box alone would tear away from them. */
const tvPart = B.pointer.find((p) => p.kind === "turn")?.part;
const tvTilt = (B.motion?.hover ?? []).find((h) => h.kind === "tilt" && h.part === tvPart);
const tvIn = inputs(tvPart, "tilt");
if (tvTilt) check("the TV's turn is attached as a Tilt carrying the parts on it, so it turns whole", !!tvIn && (tvIn.parts ?? "").split(",").filter(Boolean).length >= 5, J(tvIn));
else check("the TV's turn is not attached: its screen, knobs and words are parts of their own and would not turn with it", !usesOf(byId.get(tvPart)?.work).some((u) => u.id === "tilt"));

/* ----------------------------------------------------------- header */
const hdr = B.scrollClass[0];
const hdrIn = inputs(hdr.part, "scroll-header");
check("the header carries Header bar on scroll", !!hdrIn, hdr.part);
check("…turning on past 40 px", hdrIn?.at === "40", J(hdrIn));
/* As the page's rule wrote them (`#f3d440`, `0 4px 0 #1a0f0b`) or as computed: the same colours. */
check("…the yellow bar and the black bottom edge", /^(rgb\(243, 212, 64\)|#f3d440)$/i.test(hdrIn?.background ?? "") && /(rgb\(26, 15, 11\) 0px 4px 0px|0 4px 0 #1a0f0b)/i.test(hdrIn?.edge ?? ""), J(hdrIn));
check("…at the page's own pace (0.3 s)", hdrIn?.duration === "300", J(hdrIn));

/* ----------------------------------------------------------- blink */
/* Found by what sink recorded, not by id: a new capture numbers its parts afresh. */
const blinks = B.idle.filter((i) => i.name === "blink" && i.part && !i.folded && !i.pseudo);
const lights = [...new Set(blinks.map((i) => i.part))];
check("the three lights blink (the hero badge's dot, the TV's LIVE, the remote's LED)", lights.length === 3 && lights.every((id) => use(id, "blink")), lights.map((id) => `${id}:${!!use(id, "blink")}`).join(" "));
check("…at their own rate, in two steps", blinks.length >= 3 && blinks.every((i) => inputs(i.part, "blink")?.every === String(i.duration / 1000) && inputs(i.part, "blink")?.how === "steps") && blinks.some((i) => i.duration === 1400), J(lights.map((id) => inputs(id, "blink"))));
check("…and the captured blink is handed to the feature, so switching it off stops it", lights.every((id) => !(byId.get(id)?.motion?.animation ?? []).some((a) => a.name === "blink") && byId.get(id)?.art?.animation !== "blink"), J(lights.map((id) => byId.get(id)?.motion)));
const planet = B.idle.find((i) => i.name === "spin" && i.part)?.part, screen = B.idle.find((i) => i.name === "screenJit" && i.part)?.part;
check("control: the other captured loops stay as captured (the planet's spin, the screen's flicker)", (byId.get(planet)?.motion?.animation ?? []).some((a) => a.name === "spin") && (byId.get(screen)?.motion?.animation ?? []).some((a) => a.name === "screenJit"), J({ planet, screen }));

/* ----------------------------------------------------------- a switch per feature */
const one = byId.get(red.part);
const off = { ...one, work: { ...one.work, off: true } };
check("a feature switched off is kept, with its settings, and ships nothing", usesOf(off.work)[0]?.off === true && usesOf(off.work)[0]?.inputs?.speed === "36" && pageFeatures([off]).bindings.length === 0, J(pageFeatures([off])));
check("…switched on again it ships", pageFeatures([one]).bindings.some((b) => b.feature === "marquee"));
check("…and a second feature added to a part keeps the first one's switch", usesOf(withWork(off.work, { id: "blink", inputs: {} })).find((u) => u.id === "marquee")?.off === true);

/* ----------------------------------------------------------- nothing else moves */
const plain = JSON.parse(raw); delete plain.behaviours;
const tookPlain = takeDoc(prev, plain, { format: () => ({}), look: () => ({}) });
check("control: without a behaviours section, every part comes in exactly as written", J(tookPlain.nodes) === J(JSON.parse(raw).nodes));
check("control: the section itself is not kept on the board, only what it attached", !("behaviours" in took));
/* The one part attaching may add: a layer at a repainted canvas's box carrying Dust (sink's `motion.canvases`, tests/motion-sampled.mjs). */
const rawIds = new Set(JSON.parse(raw).nodes.map((x) => x.id));
const added = nodes.filter((n) => !rawIds.has(n.id));
const particles = (B.motion?.canvases ?? []).filter((c) => c.kind === "particles").length;
check("control: the only parts added are the Dust layers, one for each repainted canvas", added.length === particles && added.every((n) => usesOf(n.work).some((u) => u.id === "dust-canvas") && n.inert === true), J(added.map((n) => n.id)));
const moved = nodes.filter((n) => rawIds.has(n.id)).filter((n) => { const o = JSON.parse(raw).nodes.find((x) => x.id === n.id); const { work, motion, art, ...a } = n; const { work: w2, motion: m2, art: a2, ...b } = o; if (lights.includes(n.id) && !("opacity" in a)) delete b.opacity; return J(a) !== J(b); });
/* A light's captured opacity is read mid-blink, so attaching drops it (library/captured.ts, "A LOOP'S STOPS ARE THE RULE'S"): dropped is allowed, changed is not. */
check("control: attaching changes nothing about a part but its features (and a light's handed-over blink and mid-blink opacity)", moved.length === 0, moved.map((n) => n.id).join());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
