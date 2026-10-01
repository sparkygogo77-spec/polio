/**
 * Pages to hold the tablet and phone layouts to (`live/small.ts`).
 *
 *   · hero: a coin site's first screen, the shape the owner reported on
 *     Trump & Morty: a nav of links across the top, a title far too big for
 *     a phone, a BUY button, a copy-address bar, a TV picture beside them,
 *     two planets hanging off the page's sides, a row of three cards and a
 *     footer. Made here, from catalogue parts.
 *   · captured: the Sol Works dashboard as a capture landed it
 *     (`sink-pages.json`, committed): a fixed sidebar of links, a header
 *     bar, stat cards, chart panels, a footer.
 *   · fresh: a new site's page, built from the shelf's own parts (a sticky
 *     top bar, a split hero, a card grid, a footer).
 *
 * None of this reads sink; the captured page is the committed fixture.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SWEEP } from "../../src/features/studio/reassemble.ts";

const here = dirname(fileURLToPath(import.meta.url));

export const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const page = (id, name, path) => ({ id, name, path, prompt: "", scroll: "inherit" });

export function heroSite() {
  const nodes = [
    node("logo", "value-prop", "MORTYCOIN", 60, 24, 220, 40, { font: { size: 24 } }),
    node("nav_home", "cta-primary", "Home", 860, 24, 110, 40, { link: { kind: "page", target: "p0" } }),
    node("nav_lore", "cta-primary", "Lore", 990, 24, 110, 40, { link: { kind: "page", target: "p1" } }),
    node("nav_map", "cta-primary", "Roadmap", 1120, 24, 130, 40, { link: { kind: "page", target: "p1" } }),
    node("nav_buy", "cta-primary", "How to buy", 1270, 24, 140, 40, { link: { kind: "page", target: "p1" } }),
    node("planet_l", "picture", "", -210, 140, 320, 320, { data: "image, named planet" }),
    node("planet_r", "picture", "", 1330, 520, 320, 320, { data: "image, named planet" }),
    node("title", "prose", "TRUMP & MORTY", 120, 140, 1200, 140, { font: { size: 120, weight: 800 } }),
    node("tagline", "prose", "The coin from the other dimension. Buy it before the portal closes.", 120, 300, 640, 60, { font: { size: 22 } }),
    node("buy", "cta-primary", "BUY ON PUMP.FUN", 120, 390, 360, 64, { link: { kind: "url", target: "https://example.test/buy" } }),
    node("bar", "box", "", 120, 480, 640, 56, { data: "group" }),
    node("bar_addr", "prose", "4kQ9xR2mZ7pL1vB8nT3sW6yH5jD0cF9gA2eK7uM1pump", 136, 492, 500, 32, { font: { size: 16 } }),
    node("bar_copy", "cta-primary", "COPY", 650, 488, 96, 40, { data: "button, named COPY" }),
    node("tv", "picture", "", 820, 300, 520, 400, { data: "image, named TV" }),
    node("card1", "box", "", 120, 760, 380, 260),
    node("card1_t", "prose", "Phase one", 140, 780, 340, 40, { font: { size: 28 } }),
    node("card1_b", "prose", "Launch on the curve, the portal opens, the first holders arrive.", 140, 830, 340, 120),
    node("card2", "box", "", 530, 760, 380, 260),
    node("card2_t", "prose", "Phase two", 550, 780, 340, 40, { font: { size: 28 } }),
    node("card2_b", "prose", "Listing, the lore grows, the community writes the next chapter.", 550, 830, 340, 120),
    node("card3", "box", "", 940, 760, 380, 260),
    node("card3_t", "prose", "Phase three", 960, 780, 340, 40, { font: { size: 28 } }),
    node("card3_b", "prose", "The multiverse: every holder gets a dimension of their own.", 960, 830, 340, 120),
    node("footer", "prose", "Not financial advice. A meme with no promise of anything.", 120, 1080, 1200, 40),
  ];
  return {
    pages: [page("p0", "Home", "/"), page("p1", "Lore", "/lore")],
    nodes, groups: [], shapes: [], format: {}, brief: { name: "MORTYCOIN", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
  };
}

export function capturedSite() {
  const d = JSON.parse(readFileSync(join(here, "sink-pages.json"), "utf8"));
  return { ...d, activePageId: "page_home", trail: [], swept: SWEEP };
}

export function freshSite() {
  const nodes = [
    node("top", "sticky-header", "Home, Work, About, Contact", 0, 0, 1440, 72),
    node("hero", "hero-split", "Make something people want", 0, 96, 1440, 560),
    node("pitch", "value-prop", "Fast by design: move at the speed of the network", 160, 690, 1120, 80),
    node("grid", "card-grid", "Fast by design, Built to last, Yours to keep", 120, 800, 1200, 460),
    node("go", "cta-primary", "Get started", 560, 1300, 320, 64, { link: { kind: "page", target: "p0" } }),
    node("foot", "footer", "", 0, 1420, 1440, 220),
  ];
  return {
    pages: [page("p0", "Home", "/")],
    nodes, groups: [], shapes: [], format: {}, brief: { name: "NEW SITE", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
  };
}

export const SITES = { hero: heroSite, captured: capturedSite, fresh: freshSite };
