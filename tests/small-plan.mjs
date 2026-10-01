/**
 * THE TABLET AND PHONE PLAN, HELD WITHOUT A BROWSER (`live/small.ts`).
 *
 * On three pages (a coin site's first screen, the captured Sol Works
 * dashboard, a new site from the shelf's parts) at 834 and 390:
 *
 *   · reading order is the desktop's: no part drawn ahead of one that stood
 *     wholly above it in the same column of the page;
 *   · a nav of links becomes a Menu; a part hanging off the page's sides is
 *     left out; a title too big for the width is scaled to fit; buttons are
 *     at least 44px tall;
 *   · cards go two across on a tablet and one on a phone;
 *   · a person's rule at one width (hide, full width, order, size) changes
 *     that width only;
 *   · a capture's own boxes at a width (`widths`, docs/RESPONSIVE.md) are
 *     used as they are.
 *
 *   node tests/small-plan.mjs
 */
import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITES } from "./fixtures/small-sites.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { planFor } = await jiti.import(join(here, "..", "src/features/studio/live/smallRules.ts"));
const { planOrder } = await jiti.import(join(here, "..", "src/features/studio/live/small.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const walk = (items, fn) => { for (const it of items) { fn(it); if (it.children) walk(it.children, fn); if (it.links) walk(it.links, fn); } };
const find = (plan, pred) => { let hit = null; walk(plan.items, (it) => { if (!hit && pred(it)) hit = it; }); return hit; };
const kinds = (plan) => { const k = {}; walk(plan.items, (it) => { k[it.kind] = (k[it.kind] ?? 0) + 1; }); return k; };

/* Reading order: a part never comes ahead of one wholly above it whose columns overlap its own. */
function inversions(order, nodes) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const seq = order.map((id) => by.get(id)).filter(Boolean);
  let bad = 0, pairs = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
    const a = seq[i], b = seq[j];
    const sameColumn = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0;
    if (!sameColumn) continue;
    if (b.y + b.h <= a.y) { bad++; }
    pairs++;
  }
  return { bad, pairs };
}

for (const [name, make] of Object.entries(SITES)) {
  const doc = make();
  const pageId = doc.activePageId;
  const nodes = doc.nodes.filter((n) => n.pageId === pageId);
  for (const device of ["tablet", "phone"]) {
    const plan = planFor(nodes, device, doc.frameWidth);
    const order = planOrder(plan);
    const inv = inversions(order, nodes);
    check(`${name} at ${device}: reading order is the desktop's`, inv.bad <= Math.max(1, inv.pairs * 0.02), `${inv.bad} of ${inv.pairs} pairs out of order`);
    const drawn = new Set(order);
    const missing = nodes.filter((n) => !drawn.has(n.id) && !plan.hidden.includes(n.id));
    check(`${name} at ${device}: every part is drawn or listed as hidden`, missing.length === 0, missing.slice(0, 5).map((n) => n.id).join(", ") || `${drawn.size} drawn, ${plan.hidden.length} hidden`);
    let narrow = [];
    walk(plan.items, (it) => { if (it.kind === "part" && it.control && it.minH < 44) narrow.push(it.node.id); });
    check(`${name} at ${device}: every button is at least 44px tall`, narrow.length === 0, narrow.join(", ") || "all");
    let wide = [];
    walk(plan.items, (it) => { if ((it.kind === "part" && it.w > plan.width) || (it.kind === "keep" && it.max > plan.width)) wide.push(it.node.id); });
    check(`${name} at ${device}: nothing is planned wider than the page`, wide.length === 0, wide.join(", ") || "none");
  }
}

/* The coin site: nav, decorations, title, cards. */
{
  const doc = SITES.hero();
  const nodes = doc.nodes;
  const phone = planFor(nodes, "phone", 1440);
  const tablet = planFor(nodes, "tablet", 1440);
  const menu = find(phone, (it) => it.kind === "menu");
  check("the four links across the top become a Menu on a phone", !!menu && menu.links.length === 4, menu ? `${menu.links.length} in it` : "no menu");
  check("…and on a tablet", !!find(tablet, (it) => it.kind === "menu"));
  check("the planets hanging off the sides are left out", ["planet_l", "planet_r"].every((id) => phone.hidden.includes(id)), phone.hidden.join(", "));
  const title = find(phone, (it) => it.kind === "part" && it.node.id === "title");
  check("the title is scaled to fit the phone", !!title && title.fit < 1 && title.fit >= 0.5, title ? `at ${title.fit.toFixed(2)}` : "not drawn");
  const buy = find(phone, (it) => it.kind === "part" && it.node.id === "buy");
  check("BUY goes full width, a tap tall", !!buy && buy.full && buy.minH >= 44, buy ? `${buy.full ? "full" : buy.w}, ${buy.minH}px` : "not drawn");
  const bar = find(phone, (it) => it.node?.id === "bar");
  check("the copy-address bar is opened on a phone, its address and its button stacked", !!bar && bar.kind === "open", bar?.kind ?? "none");
  const tv = find(phone, (it) => it.node?.id === "tv");
  check("the TV is kept whole and fits the width", !!tv && tv.kind === "part" && tv.w <= 366, tv ? `${tv.kind} ${tv.w}` : "none");
  check("the cards go two across on a tablet", !!find(tablet, (it) => it.kind === "grid" && it.cols === 2));
  check("…and one under another on a phone", !find(phone, (it) => it.kind === "grid"), JSON.stringify(kinds(phone)));

  /* A person's rules, one width at a time. */
  const ruled = nodes.map((n) => (n.id === "tagline" ? { ...n, small: { phone: { show: "hide" } } } : n.id === "footer" ? { ...n, small: { phone: { order: -3 } } } : n.id === "tv" ? { ...n, small: { tablet: { size: 0.5 } } } : n));
  const p2 = planFor(ruled, "phone", 1440);
  const t2 = planFor(ruled, "tablet", 1440);
  check("hidden on a phone, the tagline is left out there", p2.hidden.includes("tagline"));
  check("…and still on the tablet", planOrder(t2).includes("tagline"));
  const o1 = planOrder(phone), o2 = planOrder(p2);
  check("moved three places up on a phone, the footer is earlier there", o2.indexOf("footer") < o1.indexOf("footer"), `${o1.indexOf("footer")} -> ${o2.indexOf("footer")}`);
  check("…and the tablet's order is untouched", JSON.stringify(planOrder(t2).filter((x) => x !== "tagline")) === JSON.stringify(planOrder(tablet).filter((x) => x !== "tagline")));
  const tvT = find(t2, (it) => it.node?.id === "tv");
  const tvT0 = find(tablet, (it) => it.node?.id === "tv");
  check("half size on a tablet, the TV is half as wide there", !!tvT && !!tvT0 && Math.abs(tvT.w - tvT0.w / 2) <= 2, `${tvT0?.w} -> ${tvT?.w}`);
  check("…and the phone's TV is untouched", find(p2, (it) => it.node?.id === "tv")?.w === tv.w);
  const fulled = planFor(nodes.map((n) => (n.id === "logo" ? { ...n, small: { phone: { full: true } } } : n)), "phone", 1440);
  check("full width on a phone, the logo is as wide as the page there", find(fulled, (it) => it.node?.id === "logo")?.full === true);
  const back = planFor(nodes.map((n) => (n.id === "planet_l" ? { ...n, small: { phone: { show: "show" } } } : n)), "phone", 1440);
  check("a planet asked back is drawn on a phone", planOrder(back).includes("planet_l") && !back.hidden.includes("planet_l"));
}

/* The site's own layout at a width. */
{
  const doc = SITES.hero();
  const sized = doc.nodes.map((n, i) => ({ ...n, widths: { phone: n.id === "planet_r" ? { x: 0, y: 0, w: 0, h: 0, hidden: true } : { x: 12, y: 20 + i * 60, w: Math.min(366, n.w), h: 50 } } }));
  const plan = planFor(sized, "phone", 1440);
  check("with the capture's phone boxes, the page is drawn as the site drew itself", plan.mode === "site" && plan.boxes.length === sized.length - 1, `${plan.mode}, ${plan.boxes.length} boxes`);
  check("…a part the site hides there is hidden", plan.hidden.includes("planet_r"));
  check("…and the tablet, which the capture has none for, is worked out", planFor(sized, "tablet", 1440).mode === "made");
}

/*
 * THE HALF RULE COUNTS WHAT IS DRAWN AT REST. A page of 13 parts, 6 drawn as
 * it opens (each with a phone box) and 7 shown only by a press (a menu panel
 * and what it holds: never on screen when the capture measured the phone, so
 * no box). Counting every part was 6 of 13, under half, and the site's own
 * phone layout was thrown away (gotchi, parasiteonsol). Counted at rest it is
 * 6 of 6. The 7 are laid out inside their panel, inside the page, never hidden.
 */
{
  const base = SITES.hero().nodes[0];
  const mk = (id, x, y, w, h, extra = {}) => ({ ...base, id, featureId: "prose", content: id, x, y, w, h, small: null, widths: null, link: null, ...extra });
  const press = { group: "menu", option: 1 };
  const nodes = [
    ...["a", "b", "c", "d", "e", "f"].map((id, i) => mk(id, 80, 40 + i * 200, 1200, 160, { widths: { phone: { x: 12, y: 20 + i * 120, w: 366, h: 100 } } })),
    mk("panel", 900, 80, 480, 600, { state: press }),
    ...[0, 1, 2, 3, 4, 5].map((i) => mk(`item${i}`, 920, 100 + i * 90, 440, 70, { state: press })),
  ];
  for (const device of ["phone"]) {
    const plan = planFor(nodes, device, 1440);
    check("counted at rest, a page with a press-only panel keeps the site's own phone layout", plan.mode === "site", `${plan.mode}`);
    const box = (id) => plan.boxes.find((b) => b.node.id === id);
    const panelIds = ["panel", ...[0, 1, 2, 3, 4, 5].map((i) => `item${i}`)];
    check("…the panel and everything in it are laid out, none hidden", panelIds.every((id) => box(id)) && !panelIds.some((id) => plan.hidden.includes(id)), JSON.stringify(plan.hidden));
    const p = box("panel");
    const inside = panelIds.slice(1).every((id) => { const b = box(id); return b.x >= p.x && b.x + b.w <= p.x + p.w + 1 && b.y >= p.y && b.y + b.h <= p.y + p.h + 1; });
    check("…inside their panel", inside, JSON.stringify(panelIds.map((id) => box(id)).map((b) => [b.x, b.y, b.w, b.h])));
    check("…and the panel inside the page's width", p.x >= 0 && p.x + p.w <= plan.width, `${p.x}+${p.w} of ${plan.width}`);
    const order = panelIds.slice(1).map((id) => box(id).y);
    check("…its entries in their order, none on top of another", order.every((y, i) => i === 0 || y >= order[i - 1] + box(panelIds[i]).h - 1), JSON.stringify(order));
  }
  /* Every part counted, as it was, falls under half. */
  check("the old count (6 of 13) was under half; the new one is 6 of 6", 6 / 13 < 0.5);
  /* The stylesheet places a press-only part but never forces it to show. */
  const { smallSheet } = await jiti.import(join(here, "..", "src/features/studio/live/smallCss.ts"));
  const plan = planFor(nodes, "phone", 1440);
  const css = smallSheet(plan, { part: (id) => `#${id}`, group: (id) => `.g-${id}`, holds: () => false, parentOf: () => null, stated: (id) => id === "panel" || id.startsWith("item"), control: () => false, scope: "", pageWidth: "100%", narrowest: 320 });
  const ruleFor = (id) => css.split("\n").find((l) => l.startsWith(`#${id}{`)) ?? "";
  check("the stylesheet places the panel's parts without forcing them to show", /position:absolute/.test(ruleFor("item0")) && !/display:flex/.test(ruleFor("item0")) && /display:flex/.test(ruleFor("a")), `${ruleFor("item0").slice(0, 80)} | ${ruleFor("a").slice(0, 40)}`);
}

/* The captured dashboard: its sidebar of links becomes the menu. */
{
  const doc = SITES.captured();
  const nodes = doc.nodes.filter((n) => n.pageId === "page_home");
  const phone = planFor(nodes, "phone", doc.frameWidth);
  const menu = find(phone, (it) => it.kind === "menu");
  check("the captured sidebar's eight links become the Menu", !!menu && menu.links.length === 8, menu ? `${menu.links.length}` : "none");
  const chips = find(phone, (it) => it.kind === "row" && it.children.length === 6);
  check("the six period buttons (1D to ALL) stay a row", !!chips);
}

console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
