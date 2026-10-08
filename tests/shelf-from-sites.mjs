#!/usr/bin/env node
/**
 * THE SHELF FROM YOUR SITES, AND FINISHED OR SKETCH (the audit, item 10).
 *
 * J: the shelf did not hold the pieces a real site was made of. Held here,
 * pure, on a board shaped like PonsStars (a TV box with two state faces, a
 * player card, a lone hooked button, a page wrapper, the TV again on a
 * second screen):
 *
 *   · an import keeps the hooked panels (TV box, its screen, player card),
 *     each once, from the screen where it holds the most, and not the
 *     wrapper or the lone button;
 *   · a kept panel placed on a new site's board keeps its hooks, its state
 *     faces and its keyframes, with fresh ids;
 *   · bringing the site in again replaces its kept panels, forgetting it
 *     removes them, and what the person saved by hand stays;
 *   · every shelf card is finished or a sketch, and a box is finished while
 *     a pop-up with nothing behind its press is a sketch;
 *   · a picture frame saved to the shelf comes back as a frame to wear.
 *
 *   node tests/shelf-from-sites.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const src = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const { sitePanels, withSitePanels, fromYourSites, frameComponent, savedFrames, FRAME_KIND } = await src("library/fromSites.ts");
const { placeComponent } = await src("library/components.ts");
const { withoutSite } = await src("library/learned.ts");
const { isFinished, onShelf } = await src("shelfPlan.ts");
const { SHELF_GROUPS } = await src("shelfGroups.ts");
const { newFrame } = await src("frame.ts");

const HOST = "ponsstars.test";
const part = (id, pageId, sel, x, y, w, h, extra = {}) => ({ id, pageId, x, y, w, h, featureId: "box", from: { host: HOST, selector: sel }, ...extra });
const hook = (h) => ({ hooks: { "data-hook": h } });
const nodes = [
  part("n_wrap", "p_play", "body > main", 0, 0, 1440, 2000, hook("page-play")),
  part("n_tv", "p_play", "body > main > div.tv", 40, 40, 800, 500, { ...hook("tv-box"), motion: { animation: [{ name: "tv-glow" }] } }),
  part("n_screen", "p_play", "body > main > div.tv > div.screen", 60, 60, 700, 400, hook("tv-screen")),
  part("n_idle", "p_play", "body > main > div.tv > div.screen > div.idle", 70, 70, 300, 100, { ...hook("tv-idle"), state: { group: "tv", option: 0 } }),
  part("n_live", "p_play", "body > main > div.tv > div.screen > div.live", 70, 70, 300, 100, { ...hook("tv-live"), state: { group: "tv", option: 1 } }),
  part("n_card", "p_play", "body > main > div.card", 900, 40, 300, 200, hook("player-card")),
  part("n_avatar", "p_play", "body > main > div.card > img", 910, 50, 60, 60, hook("player-avatar")),
  part("n_name", "p_play", "body > main > div.card > span", 980, 50, 200, 30, { ...hook("player-name"), content: "Player one" }),
  part("n_btn", "p_play", "body > main > button", 40, 600, 160, 40, hook("join-button")),
  part("n_btn_w", "p_play", "body > main > button > span", 50, 610, 100, 20, { content: "Join" }),
  part("n_pad1", "p_play", "body > main > div.pad1", 40, 700, 10, 10),
  part("n_pad2", "p_play", "body > main > div.pad2", 60, 700, 10, 10),
  part("n_pad3", "p_play", "body > main > div.pad3", 80, 700, 10, 10),
  part("n_pad4", "p_play", "body > main > div.pad4", 100, 700, 10, 10),
  /* The TV again on another screen, with less in it. */
  part("n_tv2", "p_lobby", "body > main > div.tv", 40, 40, 800, 500, hook("tv-box")),
  part("n_screen2", "p_lobby", "body > main > div.tv > div.screen", 60, 60, 700, 400, hook("tv-screen")),
  part("n_x1", "p_lobby", "body > main > div.a", 0, 900, 10, 10),
  part("n_x2", "p_lobby", "body > main > div.b", 0, 920, 10, 10),
  part("n_x3", "p_lobby", "body > main > div.c", 0, 940, 10, 10),
  part("n_x4", "p_lobby", "body > main > div.d", 0, 960, 10, 10),
];
const look = { keyframes: [{ name: "tv-glow", frames: [{ key: "0%", style: { opacity: "0.5" } }] }, { name: "unused", frames: [] }], fonts: [] };

/* ---------------------------------------------------------------- kept panels */
const panels = sitePanels({ nodes, look }, HOST, 1000);
const names = panels.map((c) => c.name).sort();
check("the TV box, its screen and the player card are kept, not the wrapper or the lone button", JSON.stringify(names) === JSON.stringify(["Player card", "Tv box", "Tv screen"]), names.join(", "));
const tv = panels.find((c) => c.name === "Tv box");
check("the TV box is kept once, from the screen where it holds the most", tv?.nodes.length === 4 && tv.nodes[0].pageId === "p_play", `${tv?.nodes.length} parts`);
check("kept panels are marked as the site's, filed on their own shelf", panels.every((c) => c.auto === true && c.site === HOST && c.category === "sites"));
check("its keyframes travel with it, and only the ones it names", JSON.stringify(tv?.frames.map((k) => k.name)) === JSON.stringify(["tv-glow"]));

/* ---------------------------------------------------------------- placed on a new site */
let n = 0;
const placed = placeComponent(tv, { x: 100, y: 200 }, "p_new_site", () => `n_fresh_${++n}`);
check("placed on a new board, every part has a fresh id and the new page", placed.every((p) => p.id.startsWith("n_fresh_") && p.pageId === "p_new_site"));
check("placed, its hooks are kept", JSON.stringify(placed.map((p) => p.hooks?.["data-hook"]).sort()) === JSON.stringify(["tv-box", "tv-idle", "tv-live", "tv-screen"]));
check("placed, its state faces are kept", placed.filter((p) => p.state?.group === "tv").length === 2);
check("placed where it was put, shape kept", placed[0].x === 100 && placed[0].y === 200 && placed[0].w === 800);

/* ---------------------------------------------------------------- re-import, forget, hand-saved */
const mine = { ...tv, id: "comp_mine", auto: undefined, site: HOST, name: "My TV" };
let lib = { kind: "polio-learned-library", version: 1, sites: { [HOST]: {} }, components: [mine] };
lib = withSitePanels(lib, HOST, panels);
check("kept panels join the library beside what was saved by hand", lib.components.length === 4);
lib = withSitePanels(lib, HOST, panels.slice(0, 1));
check("bringing the site in again replaces its kept panels", lib.components.length === 2 && lib.components.some((c) => c.id === "comp_mine"));
const bands = fromYourSites([...lib.components, { ...mine, id: "comp_x", site: null, name: "Loose" }]);
check("the shelf lists them by site, the hand-saved with no site last", bands.length === 2 && bands[0].site === HOST && bands[1].site === null);
lib = withoutSite(lib, HOST);
check("forgetting the site removes its kept panels, never the hand-saved", lib.components.length === 1 && lib.components[0].id === "comp_mine");

/* ---------------------------------------------------------------- finished or sketch */
const keys = Object.values(SHELF_GROUPS).flatMap((gs) => gs.flatMap((g) => g.items)).filter(onShelf);
const sketch = keys.filter((k) => !isFinished(k));
check("a plain box is finished, a pop-up with nothing behind its press is a sketch", isFinished("box") && !isFinished("modal"));
check("every library feature is finished: it ships its own script", keys.filter((k) => k.startsWith("work:")).every(isFinished));
check("the shelf has both, so hiding sketches leaves a real shelf", sketch.length > 0 && keys.length - sketch.length >= 40, `${keys.length - sketch.length} finished, ${sketch.length} sketches`);

/* ---------------------------------------------------------------- picture frames */
const frame = newFrame("data:image/png;base64,AAAA", 300, 200);
const kept = frameComponent({ ...nodes[5], art: { tint: "x" } }, frame, "Frame 1", 2000);
check("a framed part saved to the shelf is a one-part picture frame, without its site's hooks", kept.kind === FRAME_KIND && kept.nodes.length === 1 && !kept.nodes[0].hooks && kept.nodes[0].art.tint === "x");
const back = savedFrames([kept, tv]);
check("the frame comes back to wear on another part", back.length === 1 && JSON.stringify(back[0].frame) === JSON.stringify(frame));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
