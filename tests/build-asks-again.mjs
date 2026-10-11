#!/usr/bin/env node
/**
 * A BOARD CHANGE IS ASKED AGAIN WHEN J CHANGES IT, AND ASKED OUT WHEN HE TURNS IT OFF.
 *
 * Audit 2026-10-11 (build-asks-keyed-once): each polio/NEXT.md line J's
 * board asks for was keyed only by what it was about
 * (`build-format-pages.transition`, `build-part-<id>`), and once that key
 * was sent or built it was never asked again. So on PonsStars, page
 * transitions set to slide went out once, and curtain wipe after it went
 * nowhere; dark and light versions switched on reached the code, switched
 * off they did not; a part he made, moved after the first Publish, stayed
 * where the code first put it. Now a key holds what it asks
 * (`what~value`): changed, it is a new line, the older one is ticked
 * "(replaced by a later line)" in NEXT.md and dropped from the loop; what a
 * line asked for and J turns off asks to come out. Run on the saved PST
 * board's document, with GitHub as plain strings (no browser):
 *
 *   node tests/build-asks-again.mjs
 *
 * Covers: src/features/studio/codeAsks.ts, src/features/studio/fixLoop.ts, src/features/studio/publishAsks.ts, src/features/studio/CodeSiteButtons.tsx
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const studio = (f) => join(here, "..", "src", "features", "studio", f);
const A = await jiti.import(studio("codeAsks.ts"));
const L = await jiti.import(studio("fixLoop.ts"));
const S = await jiti.import(studio("shelfFacts.ts"));
const { FORMAT_FIELDS } = await jiti.import(studio("format.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const says = (xs) => xs.map((i) => `${i.key}: ${i.says}`).join(" | ");

const saved = JSON.parse(gunzipSync(readFileSync(join(here, "fixtures", "boards", "pst.json.gz"))).toString("utf8"));
const doc = JSON.parse(saved.idb["builder.docs"].stores.docs.find((r) => r.key === "builder.studio").value).state;
const source = doc.look.styleSource;
const coded = new Set(source.files.map((f) => f.pageId));
const field = new Map(FORMAT_FIELDS.map((f) => [f.id, f]));
const switches = S.formatSwitches().map((s) => ({ key: s.key, on: s.on, off: s.off, label: field.get(s.key)?.label ?? s.key, def: field.get(s.key)?.default }));
const board = { nodes: doc.nodes, pages: doc.pages, format: doc.format, switches, coded, effect: () => null };

/* The loop as Publish (merged) and Refresh (the code chat ticked everything) leave it, and what it hands codeAsks (`publishAsks.ts#asksNow`). */
const askedOf = (loop) => [...loop.sent, ...(loop.pending ?? [])].map((i) => i.key).concat(loop.done ?? []);
const asks = (loop, patch) => A.codeAsks({ ...board, ...patch, asked: askedOf(loop) });
const publish = (loop, patch) => { const adding = L.asksToSend(loop, asks(loop, patch)); return { loop: L.sentMerged(loop, adding), adding }; };
const built = (loop) => ({ ...loop, sent: [], done: [...new Set([...(loop.done ?? []), ...loop.sent.map((i) => i.key)])] });
const fmt = (patch) => ({ format: { ...doc.format, ...patch } });

/* 1. A Format switch: another value is another line; back where the site came in, it is asked back. */
let loop = L.NO_LOOP;
const slide = publish(loop, fmt({ "pages.transition": "slide" }));
check("Page transitions set to slide go out", slide.adding.length === 1 && slide.adding[0].key === "build-format-pages.transition~slide", says(slide.adding));
loop = built(slide.loop);
const wipe = publish(loop, fmt({ "pages.transition": "curtain wipe" }));
check("…built, then set to curtain wipe: asked again, as a new line about the same thing", wipe.adding.length === 1 && wipe.adding[0].key === "build-format-pages.transition~curtain-wipe" && L.baseOf(wipe.adding[0].key) === L.baseOf(slide.adding[0].key) && /\(curtain wipe\)/.test(wipe.adding[0].says), says(wipe.adding));
check("…and the slide line it replaces leaves the loop, built or not", !askedOf(wipe.loop).includes(slide.adding[0].key) && askedOf(wipe.loop).includes(wipe.adding[0].key), JSON.stringify(wipe.loop));
check("…the same value again asks nothing", L.asksToSend(wipe.loop, asks(wipe.loop, fmt({ "pages.transition": "curtain wipe" }))).length === 0);

loop = L.NO_LOOP;
const dark = publish(loop, fmt({ "build.darkLight": true }));
loop = built(dark.loop);
const light = publish(loop, fmt({ "build.darkLight": false }));
check("Dark and light versions built, then switched off: asked to come out", light.adding.length === 1 && light.adding[0].key === "build-format-build.darkLight~off" && /J switched off "Dark and light versions"/.test(light.adding[0].says) && /Take it out of the code\./.test(light.adding[0].says), says(light.adding));
check("…while a board that never asked for them asks nothing (only what J changed is asked)", A.codeAsks({ ...board, ...fmt({ "build.darkLight": false }) }).length === 0);
const back = publish(built(light.loop), fmt({ "build.darkLight": true }));
check("…and switched on again, asked again", back.adding.length === 1 && back.adding[0].key === dark.adding[0].key && /switched on/.test(back.adding[0].says), says(back.adding));

/* 2. NEXT.md: the older open line is ticked as replaced; a value he goes back to is written again after it. */
const md1 = L.nextMd(slide.adding, { site: "PonsStars", when: "2026-10-11" });
const md2 = L.nextMd(wipe.adding, { site: "PonsStars", when: "2026-10-11", prev: md1 });
const lineOf = (md, k) => md.split("\n").filter((l) => l.includes(`<!-- fix:${k} -->`));
check("The slide line, still open, is ticked as replaced; curtain wipe is the open line", /^- \[x\] .*<!-- fix:build-format-pages\.transition~slide --> \(replaced by a later line\)$/.test(lineOf(md2, slide.adding[0].key)[0] ?? "") && /^- \[ \] /.test(lineOf(md2, wipe.adding[0].key)[0] ?? ""), md2.split("\n").slice(-3).join(" | "));
check("…and the header tells the code chat a replaced line needs nothing", /ticked "\(replaced by a later line\)" needs nothing/.test(md2));
check("Refresh reads a replaced line as no fix, and the open one as open", L.fixedIn([...slide.adding, ...wipe.adding], md2).length === 0);
const ticked1 = md1.replace("- [ ]", "- [x]");
check("A line the code chat already ticked is left as it is", lineOf(L.nextMd(wipe.adding, { site: "PonsStars", when: "2026-10-11", prev: ticked1 }), slide.adding[0].key)[0] === lineOf(ticked1, slide.adding[0].key)[0]);
const md3 = L.nextMd(slide.adding, { site: "PonsStars", when: "2026-10-11", prev: md2 });
const slides3 = lineOf(md3, slide.adding[0].key);
check("Back to slide: written again after the curtain wipe line, which is now the replaced one", slides3.length === 2 && /^- \[ \] /.test(slides3[1]) && md3.lastIndexOf(slides3[1]) > md3.indexOf(`fix:${wipe.adding[0].key}`) && /\(replaced by a later line\)$/.test(lineOf(md3, wipe.adding[0].key)[0]), md3.split("\n").slice(-3).join(" | "));
check("…open until the code chat ticks the new line", L.fixedIn(slide.adding, md3).length === 0 && L.fixedIn(slide.adding, md3.replace(/- \[ \](?=[^\n]*fix:build-format-pages\.transition~slide -->$)/m, "- [x]")).length === 1);
check("…and written once only: the same Publish again adds nothing", lineOf(L.nextMd(slide.adding, { site: "PonsStars", when: "2026-10-11", prev: md3 }), slide.adding[0].key).length === 2);
check("Other lines are never replaced (their keys are their own)", L.baseOf("link:n2:https://x.test/~a") === "link:n2:https://x.test/~a" && L.nextMd([{ key: "link:n2:https://x.test/~b", kind: "link", hook: null, page: "Play", says: "b" }], { site: "PonsStars", when: "2026-10-11", prev: L.nextMd([{ key: "link:n2:https://x.test/~a", kind: "link", hook: null, page: "Play", says: "a" }], { site: "PonsStars", when: "2026-10-11" }) }).match(/\[ \]/g)?.length === 2);

/* 3. Unmerged pull requests. */
const pend = L.sentUnmerged({ ...L.NO_LOOP, pending: wipe.adding }, slide.adding);
check("Sent unmerged, it replaces a pending line about the same thing", pend.pending.length === 1 && pend.pending[0].key === slide.adding[0].key, JSON.stringify(pend.pending.map((i) => i.key)));
check("Refresh does not take an older line with its key for its own (before the line that changed it)", L.promotePending(pend, md2).pending?.length === 1 && L.promotePending(pend, md3).pending?.length === 0 && L.promotePending(pend, md3).sent.some((i) => i.key === slide.adding[0].key));

/* 4. A part made in the Builder, changed after it went out. */
const home = doc.pages.find((p) => p.path === "/");
const star = { id: "n_star", pageId: home.id, featureId: "box", label: "", content: "Play now", x: 120, y: 4000, w: 120, h: 120 };
const taken = source.files.flatMap((f) => f.hooks.map((h) => h.value));
const withStar = (s) => { const nodes = [...doc.nodes, s]; return { nodes, fresh: A.freshHooks(nodes, coded, taken, { pages: doc.pages }) }; };
const made = publish(L.NO_LOOP, withStar(star));
check("The part goes out as made", made.adding.length === 1 && made.adding[0].key.startsWith("build-part-n_star~") && /^J made a new part in the Builder: a box/.test(made.adding[0].says), says(made.adding));
check("…untouched, it asks nothing again", L.asksToSend(made.loop, asks(made.loop, withStar(star))).length === 0);
const moved = publish(built(made.loop), withStar({ ...star, x: 160, w: 200 }));
check("…moved and widened, asked again as changed, never as a new part made twice", moved.adding.length === 1 && L.baseOf(moved.adding[0].key) === "build-part-n_star" && moved.adding[0].key !== made.adding[0].key && /^J changed the part he made in the Builder with data-hook="[^"]+"\. It is now a box, .*200 by 120px\./.test(moved.adding[0].says) && /Change it in the code to match/.test(moved.adding[0].says) && !/J made a new part/.test(moved.adding[0].says), says(moved.adding));

/* 5. Effects on parts the code has: set differently, turned off. */
const hooked = doc.nodes.filter((n) => n.source?.hook?.attr === "data-hook" && coded.has(n.pageId));
const [p1, p2] = hooked;
const wear = (map) => ({ nodes: doc.nodes.map((n) => (map[n.id] !== undefined ? { ...n, work: map[n.id] } : n)) });
const tilt8 = publish(L.NO_LOOP, wear({ [p1.id]: { id: "tilt-hover", inputs: { strength: "8" } } }));
const tilt12 = publish(built(tilt8.loop), wear({ [p1.id]: { id: "tilt-hover", inputs: { strength: "12" } } }));
check("An effect set differently is asked again with its new setting", tilt12.adding.length === 1 && L.baseOf(tilt12.adding[0].key) === L.baseOf(tilt8.adding[0].key) && tilt12.adding[0].key !== tilt8.adding[0].key && /set to strength 12/.test(tilt12.adding[0].says), says(tilt12.adding));
const tiltOff = publish(built(tilt12.loop), wear({ [p1.id]: { id: "tilt-hover", inputs: { strength: "12" }, off: true } }));
check("…turned off in the Motion panel, asked to come out of that part", tiltOff.adding.length === 1 && tiltOff.adding[0].key === `build-effect-${p1.id}-tilt-hover~off` && tiltOff.adding[0].hook === p1.source.hook.value && /J turned off the "tilt-hover" effect on this part/.test(tiltOff.adding[0].says) && /Take it out of the code on this element\./.test(tiltOff.adding[0].says), says(tiltOff.adding));
check("…but one never asked for asks nothing when turned off", A.codeAsks({ ...board, ...wear({ [p1.id]: { id: "tilt-hover", inputs: {}, off: true } }) }).length === 0);
check("…nor one gone with a Clear and bring in (the code keeps what it built)", L.asksToSend(built(tilt12.loop), asks(built(tilt12.loop), {})).length === 0);
const both = publish(L.NO_LOOP, wear({ [p1.id]: { id: "tilt-hover", inputs: {} }, [p2.id]: { id: "tilt-hover", inputs: {} } }));
const one = asks(built(both.loop), wear({ [p1.id]: { id: "tilt-hover", inputs: {}, off: true }, [p2.id]: { id: "tilt-hover", inputs: {} } }));
const out1 = one.filter((i) => /turned off/.test(i.says));
check("Off on one of a group's parts asks it out of that part alone", out1.length === 1 && out1[0].key.startsWith(`${both.adding[0].key}~off-`) && out1[0].hook === p1.source.hook.value && /on this part/.test(out1[0].says), says(one));

/* 6. Push on press, a frame, pages and the site's head. */
const tv = doc.nodes.find((n) => n.source?.hook?.value === "chart-tv-panel");
const press = (work, link = null) => ({ nodes: doc.nodes.map((n) => (n.id === tv.id ? { ...n, work, link } : n)) });
const btn = publish(L.NO_LOOP, press({ id: "press-push", inputs: {} }));
const linked = publish(built(btn.loop), press({ id: "press-push", inputs: {} }, { kind: "page", target: "page_leaderboard" }));
check("Push on press: a button, then a place picked, is asked again as a link", btn.adding[0]?.key === `build-press-${tv.id}~button` && linked.adding.length === 1 && /real link/.test(linked.adding[0].says) && /Leaderboard page/.test(linked.adding[0].says), says([...btn.adding, ...linked.adding]));
const unpressed = publish(built(btn.loop), press({ id: "press-push", inputs: {}, off: true }));
check("…turned off where a line made it a button, asked to be plain again", unpressed.adding.length === 1 && unpressed.adding[0].key === `build-press-${tv.id}~off` && /Make it a plain element again/.test(unpressed.adding[0].says), says(unpressed.adding));
check("…but kept as a link while it still leads somewhere", asks(built(linked.loop), press({ id: "press-push", inputs: {}, off: true }, { kind: "page", target: "page_leaderboard" })).length === 0);

const framed = (embed) => ({ nodes: doc.nodes.map((n) => (n.id === p1.id ? { ...n, embed } : n)) });
const frame = publish(L.NO_LOOP, framed({ src: "https://dexscreener.com/solana?embed=1", was: "https://dexscreener.com/?embed=1" }));
const frameBack = publish(built(frame.loop), framed({ src: "https://dexscreener.com/?embed=1", was: "https://dexscreener.com/?embed=1" }));
check("A frame set back to the address the code gave it is asked back", frameBack.adding.length === 1 && L.baseOf(frameBack.adding[0].key) === `build-embed-${p1.id}` && /back to https:\/\/dexscreener\.com\/\?embed=1/.test(frameBack.adding[0].says), says(frameBack.adding));
check("…and never asked when no line asked for another", A.codeAsks({ ...board, ...framed({ src: "https://dexscreener.com/?embed=1", was: "https://dexscreener.com/?embed=1" }) }).length === 0);

const hall = (name, path) => ({ pages: [...doc.pages, { id: "page_hall", name, path, scroll: "inherit" }] });
const added = publish(L.NO_LOOP, hall("Hall", "/hall"));
const renamedAdded = publish(built(added.loop), hall("Hall of fame", "/hall-of-fame"));
check("A page he added, renamed after it went out, is asked as changed, not added twice", renamedAdded.adding.length === 1 && /J changed the page he added in the Builder: it is now "Hall of fame" at \/hall-of-fame/.test(renamedAdded.adding[0].says) && !/J added/.test(renamedAdded.adding[0].says), says(renamedAdded.adding));
const profile = doc.pages.find((p) => p.path === "/profile");
const prof = (patch) => ({ pages: doc.pages.map((p) => (p.id === profile.id ? { ...p, ...patch, came: { name: "Profile", path: "/profile" } } : p)) });
const ren = publish(L.NO_LOOP, prof({ name: "My profile" }));
const ren2 = publish(built(ren.loop), prof({ name: "Me" }));
const renBack = publish(built(ren2.loop), prof({ name: "Profile" }));
check("A page the code has, renamed twice, asks each name; renamed back, asks it back", ren2.adding.length === 1 && /to "Me"/.test(ren2.adding[0].says) && renBack.adding.length === 1 && /renamed the page back to "Profile"/.test(renBack.adding[0].says), says([...ren2.adding, ...renBack.adding]));
const named = publish(L.NO_LOOP, { site: { name: "PonsStars" } });
const renamedSite = publish(built(named.loop), { site: { name: "Pons Stars" } });
check("The site's name typed again is asked again", renamedSite.adding.length === 1 && /J named the site "Pons Stars"/.test(renamedSite.adding[0].says) && L.baseOf(renamedSite.adding[0].key) === "build-head-name", says(renamedSite.adding));

/* 7. Every key reads back from NEXT.md, and Publish hands codeAsks the loop. */
const every = [...slide.adding, ...wipe.adding, ...light.adding, ...made.adding, ...moved.adding, ...tilt12.adding, ...tiltOff.adding, ...out1, ...unpressed.adding, ...frameBack.adding, ...renamedAdded.adding, ...renBack.adding, ...renamedSite.adding];
const mdAll = L.nextMd(every, { site: "PonsStars", when: "2026-10-11" });
check("Every key is one word that Refresh reads back", every.every((i) => /^\S+$/.test(i.key) && mdAll.includes(`<!-- fix:${i.key} -->`)) && L.fixedIn(every, mdAll).length === 0, every.map((i) => i.key).join(" "));
const { useStudio } = await jiti.import(studio("board/store.ts"));
const P = await jiti.import(studio("publishAsks.ts"));
useStudio.setState({ nodes: doc.nodes, pages: doc.pages, look: { ...doc.look, fixLoop: { ticked: [], sent: [], done: [dark.adding[0].key] } }, brief: { ...doc.brief }, format: { ...doc.format, "build.darkLight": false } });
const viaPublish = P.asksNow(source);
useStudio.setState({ look: { ...doc.look } });
check("Publish passes the lines already out: dark and light, built, then off, is asked out", viaPublish.some((i) => i.key === "build-format-build.darkLight~off") && P.asksNow(source).length === 0, says(viaPublish));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
