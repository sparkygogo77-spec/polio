/**
 * A new site's sample page, built from generic parts and dressed by its
 * theme (`siteTheme.ts`).
 *
 * One coherent page, top to bottom: a header (the site's name as a word
 * mark, links to the page's own sections), a first screen (a title, a short
 * line, a bar holding an address with a working Copy, two buttons), a row of
 * cards, and a footer (links, a row of social marks, small print). Nothing
 * captured: no pictures, no site's own art, every part an ordinary box,
 * paragraph or button from the library.
 *
 * Every part says how it looks on itself, the way a captured part does
 * (`colour`, `font`, `edge`, `radius`, `pad`, `motion`), so the board, the
 * preview and the published page draw the same thing from the same record.
 * The six colour roles are named by role where a part wears one, so the
 * Look panel's palette still repaints them.
 *
 * Ids are fixed by slot (`st_hero_title`), so a new roll restyles the same
 * parts: the words and links a person changed are kept, a part they deleted
 * stays deleted, and only the theme's choices move.
 *
 * Pure: no React, no store. The parts to try (`tryThese.ts`) are handed in.
 */
import {
  borderWidth, motionOf, pairingOf, radii, shadowCss, space, themeColours, typeSize,
  type CoherentPart, type SiteTheme, type ThemeColours,
} from "./siteTheme.ts";

/** The parts of a node this writes: everything else is the store's default. */
export interface StarterNode {
  id: string;
  pageId: string;
  featureId: string;
  label: string;
  prompt: string;
  content: string;
  data: string;
  x: number; y: number; w: number; h: number;
  groupId: null;
  options: Record<string, string>;
  priority: "must";
  custom: false;
  glyph: null; hue: null; locked: false;
  link: { kind: "page" | "url" | "node"; target: string } | null;
  colour: Record<string, string> | null;
  font: { face?: string; stack: string; px: number; weight: number; size?: number; leading?: number } | null;
  anim: null; animSpeed: 1; animDelay: 0; animEase: "smooth";
  shape: null; outline: null; kind: null; cube: null; mesh: null; vector: null; role: null; code: null;
  aura: null; auraSize: 1; auraStyle: "glow"; texture: null; sketch: null; plan: null;
  byHand: true;
  edge?: { width: number; style: "solid" | "none"; colour?: string; shadow?: string } | null;
  radius?: number | null;
  pad?: { top: number; right: number; bottom: number; left: number } | null;
  text?: { align?: "left" | "center" | "right"; transform?: "uppercase" } | null;
  layout?: { display: "flex"; direction: "row" | "column"; align?: string; justify?: string; gap?: number } | null;
  motion?: { transition?: { property: string; duration: string; timing: string; delay: string }[]; hover?: { self: true; style: Record<string, string> }[]; active?: { self: true; style: Record<string, string> }[] } | null;
  work?: { id: string; inputs: Record<string, string> } | null;
}

/** A part from the shelf to try, as `tryThese.ts` hands it over. */
export interface TryItem { featureId: string; name: string; does: string; category: string; w: number; h: number }

export interface StarterOptions {
  pageId: string;
  frameWidth?: number;
  siteName?: string;
  /** Shelf parts to try, two or three; none leaves the section out. */
  tryThese?: readonly TryItem[];
  /** The page's nodes before, for a re-roll: their words and links are kept, and a starter part they deleted stays deleted. */
  prev?: readonly { id: string; content?: unknown; link?: unknown; label?: string }[] | null;
  /** Starter parts the person deleted (the last build made them, the page no longer has them): never put back. */
  deleted?: ReadonlySet<string>;
}

export interface Starter {
  nodes: StarterNode[];
  /** The six roles, for `look.palette`. */
  palette: { bg: string; surface: string; text: string; muted: string; accent: string; highlight: string };
  /** The Format fields the theme drives, so the library's own parts follow it too. */
  format: Record<string, string | number | boolean>;
  /** Height of the page as built. */
  height: number;
  /** What coherence reads: each part's words, radius, shadow, spaces and fills, resolved. */
  parts: CoherentPart[];
}

export const STARTER_PREFIX = "st_";
/** A button's words in its middle, however tall the theme makes it. */
const CENTRE = { display: "flex" as const, direction: "row" as const, align: "center", justify: "center", gap: 0 };
export const isStarter = (id: string) => id.startsWith(STARTER_PREFIX);

/**
 * The page. Every length is a whole number of the theme's spacing step, so
 * the spaces are on one scale; every radius is from the theme's family;
 * every shadow falls the one way the light allows.
 */
export function buildStarter(t: SiteTheme, o: StarterOptions): Starter {
  const W = o.frameWidth ?? 1440;
  const c = themeColours(t);
  const pair = pairingOf(t.fonts.pairing);
  const r = radii(t);
  const bw = borderWidth(t);
  const mo = motionOf(t);
  const name = (o.siteName ?? "").trim() || "Your site";
  const S = (n: number) => space(t, n);
  /* How wide words come out, read generously, so a box is never narrower than what it holds. */
  const caps = !!pair.caps;
  const wide = (stack: string, upper = false, weight = 400) => (/monospace/.test(stack) ? 0.62 : /Impact|Narrow/.test(stack) ? 0.5 : /Verdana|Tahoma|Arial Black/.test(stack) ? 0.68 : 0.62) * (upper ? 1.18 : 1) * (weight >= 700 ? 1.1 : 1);
  const measure = (text: string, px: number, stack: string, upper = false, weight = 400) => Math.ceil(text.length * px * wide(stack, upper, weight));
  const linesOf = (text: string, px: number, stack: string, w: number, upper = false, weight = 400) => Math.max(1, Math.ceil((measure(text, px, stack, upper, weight) * 1.08) / Math.max(1, w)));
  const snap = (v: number) => Math.ceil(v / t.layout.step) * t.layout.step;
  const nodes: StarterNode[] = [];
  const parts: CoherentPart[] = [];
  const prev = new Map((o.prev ?? []).map((n) => [n.id, n]));

  const role = (v: string): string => ({ [c.bg]: "bg", [c.surface]: "surface", [c.text]: "text", [c.muted]: "muted", [c.accent]: "accent", [c.highlight]: "highlight" } as Record<string, string>)[v] ?? v;
  const heading = (px: number) => ({ stack: pair.heading, px, weight: pair.headingWeight, leading: 1.15 });
  const body = (px: number, weight = 400) => ({ stack: pair.body, px, weight, leading: 1.5 });
  const edge = (shadow: string, colour = c.text) => (bw || shadow ? { width: bw, style: bw ? "solid" as const : "none" as const, ...(bw ? { colour: role(colour) } : {}), ...(shadow ? { shadow } : {}) } : null);
  const moves = (lift = true) => ({
    transition: [{ property: "transform", duration: mo.duration, timing: mo.timing, delay: "0s" }, { property: "box-shadow", duration: mo.duration, timing: mo.timing, delay: "0s" }],
    ...(lift ? { hover: [{ self: true as const, style: { transform: mo.lift } }] } : {}),
    active: [{ self: true as const, style: { transform: mo.press } }],
  });

  const add = (n: Partial<StarterNode> & { id: string; featureId: string; x: number; y: number; w: number; h: number }, check: Omit<CoherentPart, "id"> = {}) => {
    const had = prev.get(n.id);
    if (o.deleted?.has(n.id)) return null;
    const node: StarterNode = {
      pageId: o.pageId, label: n.id.slice(STARTER_PREFIX.length).replace(/_/g, " "), prompt: "", content: "", data: "",
      groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null,
      colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
      shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null,
      aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null, byHand: true,
      ...n,
      x: Math.round(n.x), y: Math.round(n.y), w: Math.round(n.w), h: Math.round(n.h),
      // What a person wrote stays theirs across rolls.
      ...(had && typeof had.content === "string" ? { content: had.content } : {}),
      ...(had && had.link !== undefined ? { link: had.link as StarterNode["link"] } : {}),
    };
    nodes.push(node);
    parts.push({ id: node.id, ...check });
    return node;
  };
  const words = (colour: string, on: string) => ({ words: { colour, on } });

  /* ------------------------------------------------ header */
  const side = S(10);
  const linkPx = typeSize(t, 0);
  const navLinks = [["Home", "st_hero_title"], ["What it does", "st_cards"], ["Contact", "st_footer"]] as const;
  // The name gets a third of the header (half when centred), and a size that fits it with room to spare.
  const logoBox = t.layout.header === "centred" ? Math.round(W / 2) : Math.round(W / 3);
  let logoPx = typeSize(t, 2);
  while (logoPx > 14 && measure(name, logoPx, pair.heading, caps, pair.headingWeight) * 1.25 > logoBox) logoPx -= 2;
  const logoW = logoBox;
  const logoH = Math.round(logoPx * 1.3), linkH = Math.round(linkPx * 1.5);
  const headH = t.layout.header === "centred" ? snap(S(2) + logoH + S(2) + linkH + S(2)) : snap(Math.max(S(9), logoH + S(4)));
  add({ id: "st_header", featureId: "box", label: "Header", x: 0, y: 0, w: W, h: headH, colour: { bg: role(c.surface) }, edge: bw ? { width: 0, style: "none", shadow: `inset 0 -${bw}px 0 0 ${c.line}` } : null }, { spaces: [headH] });
  const linkW = (s: string) => Math.round(measure(s, linkPx, pair.body, false, 600) * 1.15) + 12;
  const navW = navLinks.reduce((s, [l]) => s + linkW(l), 0) + S(4) * (navLinks.length - 1);
  const v = t.layout.header;
  const logoY = v === "centred" ? S(2) : (headH - logoH) / 2;
  const logoX = v === "split" ? side : v === "reversed" ? W - side - logoW : (W - logoW) / 2;
  add({ id: "st_logo", featureId: "prose", label: "Site name", content: name, x: logoX, y: logoY, w: logoW, h: logoH, font: heading(logoPx), colour: { text: role(c.text) }, text: { align: v === "centred" ? "center" : v === "reversed" ? "right" : "left", ...(pair.caps ? { transform: "uppercase" as const } : {}) }, link: { kind: "node", target: "st_hero_title" } }, words(c.text, c.surface));
  let nx = v === "split" ? W - side - navW : v === "reversed" ? side : (W - navW) / 2;
  const navY = v === "centred" ? S(2) + logoH + S(2) : (headH - linkH) / 2;
  navLinks.forEach(([label, target], i) => {
    add({ id: `st_nav_${i + 1}`, featureId: "prose", label: `Link: ${label}`, content: label, x: nx, y: navY, w: linkW(label), h: Math.round(linkPx * 1.5), font: body(linkPx, 600), colour: { text: role(c.muted) }, link: { kind: "node", target } }, words(c.muted, c.surface));
    nx += linkW(label) + S(4);
  });

  /* ------------------------------------------------ first screen */
  const heroY = headH + S(12);
  const contentW = W - side * 2;
  const hv = t.layout.hero;
  const textW = hv === "split" ? Math.round(contentW * 0.55) : hv === "centred" ? Math.min(contentW, 880) : Math.min(contentW, 820);
  const textX = hv === "centred" ? (W - textW) / 2 : side;
  const align = hv === "centred" ? "center" as const : "left" as const;
  const TITLE = "Say the one thing this site is for";
  let titlePx = typeSize(t, t.layout.scale >= 1.4 ? 4 : 5);
  while (titlePx > 28 && linesOf(TITLE, titlePx, pair.heading, textW, caps, pair.headingWeight) > 3) titlePx -= 2;
  const titleH = Math.round(titlePx * 1.15 * linesOf(TITLE, titlePx, pair.heading, textW, caps, pair.headingWeight)) + S(1);
  add({ id: "st_hero_title", featureId: "prose", label: "Title", content: TITLE, x: textX, y: heroY, w: textW, h: titleH, font: heading(titlePx), colour: { text: role(c.text) }, text: { align, ...(pair.caps ? { transform: "uppercase" as const } : {}) } }, words(c.text, c.bg));
  const linePx = typeSize(t, 1);
  const lineY = heroY + titleH + S(3);
  const LINE = "A sentence or two that says who it is for and what they get.";
  const lineH = Math.round(linePx * 1.5 * linesOf(LINE, linePx, pair.body, Math.min(textW, 640)));
  add({ id: "st_hero_line", featureId: "prose", label: "Short line", content: LINE, x: textX, y: lineY, w: Math.min(textW, 640), h: lineH, font: body(linePx), colour: { text: role(c.muted) }, text: { align }, ...(hv === "centred" ? { x: (W - Math.min(textW, 640)) / 2 } : {}) }, words(c.muted, c.bg));

  // The bar with an address in it and a Copy that works on the published page.
  const barY = lineY + lineH + S(4);
  const btnPx = { small: typeSize(t, -1), medium: typeSize(t, 0), large: typeSize(t, 1) }[t.shapes.buttonSize];
  const btnH = S({ small: 5, medium: 6, large: 7 }[t.shapes.buttonSize]);
  const barW = Math.min(textW, 560);
  const barX = hv === "centred" ? (W - barW) / 2 : textX;
  const barShadow = shadowCss(t, c, 1);
  add({ id: "st_copy_bar", featureId: "box", label: "Address bar", x: barX, y: barY, w: barW, h: btnH, colour: { bg: role(c.surface) }, edge: edge(barShadow, c.line), radius: r.small }, { radius: r.small, shadow: barShadow, spaces: [btnH] });
  const copyW = snap(Math.max(S(10), measure("Copy", btnPx, pair.body, false, 700) + S(4)));
  add({ id: "st_copy_text", featureId: "prose", label: "Address", content: "your-address-goes-here", x: barX + S(2), y: barY + (btnH - btnPx * 1.4) / 2, w: barW - copyW - S(4), h: Math.round(btnPx * 1.4), font: { stack: "ui-monospace, Menlo, Consolas, 'Courier New', monospace", px: btnPx, weight: 500 }, colour: { text: role(c.text) } }, words(c.text, c.surface));
  add({ id: "st_copy_button", featureId: "cta-primary", label: "Copy", content: "Copy", layout: CENTRE, text: { align: "center" }, x: barX + barW - copyW, y: barY, w: copyW, h: btnH, options: { variant: "solid", shape: "square", size: "small" }, colour: { bg: role(c.accent), accent: role(c.accent), text: c.onAccent }, font: body(btnPx, 700), radius: r.small, motion: moves(false), work: { id: "copy-toast", inputs: { text: "your-address-goes-here", toast: "Copied" } } }, { ...words(c.onAccent, c.accent), radius: r.small, fills: [c.accent] });

  // Two buttons: the main one in the accent, the other drawn in the words' colour.
  const btnY = barY + btnH + S(4);
  const btnShadow = shadowCss(t, c, 2);
  const pad = { top: 0, right: S(3), bottom: 0, left: S(3) };
  const b1W = snap(Math.max(S(16), measure("Get started", btnPx, pair.body, false, 700) + pad.left * 2 + 8));
  const b2W = snap(Math.max(S(14), measure("Learn more", btnPx, pair.body, false, 700) + pad.left * 2 + 8));
  const bx = hv === "centred" ? (W - b1W - S(2) - b2W) / 2 : textX;
  add({ id: "st_button_main", featureId: "cta-primary", label: "Main button", content: "Get started", layout: CENTRE, text: { align: "center" }, x: bx, y: btnY, w: b1W, h: btnH, options: { variant: "solid", shape: "square", size: t.shapes.buttonSize }, colour: { bg: role(c.accent), accent: role(c.accent), text: c.onAccent }, font: body(btnPx, 700), radius: r.button, edge: edge(btnShadow, c.text), pad, motion: moves(), link: { kind: "node", target: "st_cards" } }, { ...words(c.onAccent, c.accent), radius: r.button, shadow: btnShadow, spaces: [pad.left, btnH], fills: [c.accent] });
  add({ id: "st_button_other", featureId: "cta-primary", label: "Second button", content: "Learn more", layout: CENTRE, text: { align: "center" }, x: bx + b1W + S(2), y: btnY, w: b2W, h: btnH, options: { variant: "solid", shape: "square", size: t.shapes.buttonSize }, colour: { bg: role(c.bg), accent: role(c.bg), text: role(c.text) }, font: body(btnPx, 700), radius: r.button, edge: { width: Math.max(1, bw), style: "solid", colour: role(c.text), ...(btnShadow ? { shadow: btnShadow } : {}) }, pad, motion: moves(), link: { kind: "node", target: "st_footer" } }, { ...words(c.text, c.bg), radius: r.button, shadow: btnShadow, spaces: [pad.left, btnH] });
  let heroBottom = btnY + btnH;
  if (hv === "split") {
    // The other half: a panel in the second colour of the harmony, with a line in it. No picture.
    const px = side + textW + S(8), pw = W - side - px, ph = heroBottom - heroY;
    const sh = shadowCss(t, c, 3);
    const card = c.cards[1]!;
    add({ id: "st_hero_panel", featureId: "box", label: "Panel", x: px, y: heroY, w: pw, h: ph, colour: { bg: card.fill }, edge: edge(sh), radius: r.box }, { radius: r.box, shadow: sh, fills: [card.fill] });
    add({ id: "st_hero_panel_words", featureId: "prose", label: "Panel words", content: "Three numbers, a quote, or what is new: whatever proves the title.", x: px + S(4), y: heroY + S(4), w: pw - S(8), h: Math.max(S(6), ph - S(8)), font: heading(typeSize(t, 2)), colour: { text: card.text } }, words(card.text, card.fill));
  }
  heroBottom += S(12);

  /* ------------------------------------------------ cards */
  const cardsY = heroBottom;
  const n = t.layout.cards;
  const gap = S(3);
  const cw = Math.floor((contentW - gap * (n - 1)) / n);
  const kickPx = typeSize(t, -1);
  add({ id: "st_cards", featureId: "prose", label: "Cards heading", content: "What it does", x: side, y: cardsY, w: contentW, h: Math.round(typeSize(t, 3) * 1.3), font: heading(typeSize(t, 3)), colour: { text: role(c.text) }, text: { align: hv === "centred" ? "center" : "left", ...(pair.caps ? { transform: "uppercase" as const } : {}) } }, words(c.text, c.bg));
  const cardTop = cardsY + Math.round(typeSize(t, 3) * 1.3) + S(4);
  const titlePx2 = typeSize(t, 2);
  const CARD_WORDS = [["First thing", "One line on what a visitor gets from it."], ["Second thing", "Keep it short: a card is read at a glance."], ["Third thing", "Say what happens next, or why it matters."], ["Fourth thing", "A detail that makes the other three believable."]];
  const inner = cw - S(8);
  const titleLines = Math.max(...CARD_WORDS.slice(0, n).map(([a]) => linesOf(a!, titlePx2, pair.heading, inner, caps, pair.headingWeight)));
  const bodyLines = Math.max(...CARD_WORDS.slice(0, n).map(([, b]) => linesOf(b!, typeSize(t, 0), pair.body, inner)));
  const cardTitleH = Math.round(titlePx2 * 1.3 * titleLines), cardLineH = Math.round(typeSize(t, 0) * 1.5 * bodyLines);
  const cardH = S(4) * 2 + Math.round(kickPx * 1.4) + cardTitleH + S(1) + cardLineH;
  const cardSh = shadowCss(t, c, 2);
  for (let i = 0; i < n; i++) {
    const x = side + i * (cw + gap);
    const fill = c.cards[i]!;
    add({ id: `st_card_${i + 1}`, featureId: "box", label: `Card ${i + 1}`, x, y: cardTop, w: cw, h: cardH, colour: { bg: fill.fill }, edge: edge(cardSh), radius: r.box, motion: moves() }, { radius: r.box, shadow: cardSh, spaces: [gap], fills: [fill.fill] });
    add({ id: `st_card_${i + 1}_kicker`, featureId: "prose", label: `Card ${i + 1} number`, content: String(i + 1).padStart(2, "0"), x: x + S(4), y: cardTop + S(4) - kickPx * 0.2, w: S(8), h: Math.round(kickPx * 1.4), font: body(kickPx, 700), colour: { text: fill.text } }, words(fill.text, fill.fill));
    add({ id: `st_card_${i + 1}_title`, featureId: "prose", label: `Card ${i + 1} title`, content: CARD_WORDS[i]![0]!, x: x + S(4), y: cardTop + S(4) + Math.round(kickPx * 1.4), w: inner, h: cardTitleH, font: heading(titlePx2), colour: { text: fill.text }, ...(caps ? { text: { transform: "uppercase" as const } } : {}) }, words(fill.text, fill.fill));
    add({ id: `st_card_${i + 1}_line`, featureId: "prose", label: `Card ${i + 1} line`, content: CARD_WORDS[i]![1]!, x: x + S(4), y: cardTop + S(4) + Math.round(kickPx * 1.4) + cardTitleH + S(1), w: inner, h: cardLineH, font: body(typeSize(t, 0)), colour: { text: fill.text } }, words(fill.text, fill.fill));
  }
  let y = cardTop + cardH + S(12);

  /* ------------------------------------------------ parts to try */
  const tries = (o.tryThese ?? []).slice(0, 3);
  if (tries.length) {
    add({ id: "st_try", featureId: "prose", label: "Try these heading", content: "Try these", x: side, y, w: contentW, h: Math.round(typeSize(t, 2) * 1.3), font: heading(typeSize(t, 2)), colour: { text: role(c.text) } }, words(c.text, c.bg));
    y += Math.round(typeSize(t, 2) * 1.3) + S(1);
    const NOTE = "Parts from the shelf that work on the published site, in this theme. Press one to see its options; delete what you do not want.";
    const noteH = Math.round(typeSize(t, 0) * 1.5 * linesOf(NOTE, typeSize(t, 0), pair.body, contentW));
    add({ id: "st_try_note", featureId: "prose", label: "Try these note", content: NOTE, x: side, y, w: contentW, h: noteH, font: body(typeSize(t, 0)), colour: { text: role(c.muted) } }, words(c.muted, c.bg));
    y += noteH + S(3);
    const tw = Math.floor((contentW - gap * (tries.length - 1)) / tries.length);
    let rowH = 0;
    tries.forEach((it, i) => {
      const x = side + i * (tw + gap);
      const labelPx = typeSize(t, 1);
      add({ id: `st_try_${i + 1}_name`, featureId: "prose", label: `${it.name}: what it is`, content: it.name, x, y, w: tw, h: Math.round(labelPx * 1.3), font: heading(labelPx), colour: { text: role(c.text) } }, words(c.text, c.bg));
      const howH = Math.round(typeSize(t, -1) * 1.5 * Math.max(...tries.map((x) => linesOf(x.does, typeSize(t, -1), pair.body, tw))));
      add({ id: `st_try_${i + 1}_how`, featureId: "prose", label: `${it.name}: how it is used`, content: it.does, x, y: y + Math.round(labelPx * 1.3) + S(1), w: tw, h: howH, font: body(typeSize(t, -1)), colour: { text: role(c.muted) } }, words(c.muted, c.bg));
      const top = y + Math.round(labelPx * 1.3) + S(1) + howH + S(2);
      // As tall as the part draws itself at this width, so nothing it holds runs into what follows.
      const h = snap(Math.max(S(10), Math.min(560, Math.max(it.h, Math.round((it.h * tw) / Math.max(1, it.w))))));
      add({ id: `st_try_${i + 1}`, featureId: it.featureId, label: it.name, x, y: top, w: tw, h, radius: r.box }, { radius: r.box });
      rowH = Math.max(rowH, top + h - y);
    });
    y += rowH + S(12);
  }

  /* ------------------------------------------------ footer */
  const fv = t.layout.footer;
  const footY = y;
  const smallPx = typeSize(t, -1);
  const lines = fv === "columns" ? 4 : fv === "stacked" ? 5 : 2;
  const footH = S(8) * 2 + Math.round(smallPx * 1.6 * lines) + S(6);
  add({ id: "st_footer", featureId: "box", label: "Footer", x: 0, y: footY, w: W, h: footH, colour: { bg: role(c.surface) }, edge: bw ? { width: 0, style: "none", shadow: `inset 0 ${bw}px 0 0 ${c.line}` } : null });
  const fLinks = ["About", "Privacy", "Contact"];
  const socials = ["X", "Telegram", "GitHub"];
  const socialW = snap(Math.max(...socials.map((x) => measure(x, smallPx, pair.body, false, 700))) + S(3)), socialH = S(5);
  const socialRowW = socials.length * socialW + (socials.length - 1) * S(1);
  const fY = footY + S(8);
  const fx = side;
  const fRow = (list: string[], at: number, x0: number, centre: boolean) => {
    const widths = list.map((l) => measure(l, smallPx, pair.body, false, 600) + 12);
    const total = widths.reduce((s, w) => s + w, 0) + S(3) * (list.length - 1);
    let x = centre ? (W - total) / 2 : x0;
    list.forEach((l, i) => {
      add({ id: `st_footer_link_${i + 1}`, featureId: "prose", label: `Footer link: ${l}`, content: l, x, y: at, w: widths[i]!, h: Math.round(smallPx * 1.5), font: body(smallPx, 600), colour: { text: role(c.text) } }, words(c.text, c.surface));
      x += widths[i]! + S(3);
    });
    return total;
  };
  const socialRow = (x0: number, at: number) => socials.forEach((s, i) => {
    add({ id: `st_social_${i + 1}`, featureId: "cta-primary", label: `Social: ${s}`, content: s, layout: CENTRE, text: { align: "center" }, x: x0 + i * (socialW + S(1)), y: at, w: socialW, h: socialH, options: { variant: "solid", shape: "square", size: "small" }, colour: { bg: role(c.bg), accent: role(c.bg), text: role(c.text) }, font: body(smallPx, 700), radius: r.button, edge: { width: Math.max(1, bw), style: "solid", colour: role(c.line) }, motion: moves() }, { ...words(c.text, c.bg), radius: r.button });
  });
  const smallPrint = `© ${new Date().getFullYear()} ${name}. Every word here is yours to change.`;
  if (fv === "columns") {
    add({ id: "st_footer_name", featureId: "prose", label: "Footer name", content: name, x: fx, y: fY, w: S(40), h: Math.round(typeSize(t, 1) * 1.4), font: heading(typeSize(t, 1)), colour: { text: role(c.text) } }, words(c.text, c.surface));
    fRow(fLinks, fY, W / 2 - S(10), false);
    socialRow(W - side - socialRowW, fY);
    add({ id: "st_footer_small", featureId: "prose", label: "Small print", content: smallPrint, x: fx, y: fY + Math.round(smallPx * 1.6 * 2) + S(4), w: contentW, h: Math.round(smallPx * 1.5), font: body(smallPx), colour: { text: role(c.muted) } }, words(c.muted, c.surface));
  } else if (fv === "line") {
    const used = fRow(fLinks, fY + (socialH - smallPx * 1.5) / 2, fx, false);
    socialRow(fx + used + S(6), fY);
    add({ id: "st_footer_small", featureId: "prose", label: "Small print", content: smallPrint, x: W - side - S(60), y: fY + (socialH - smallPx * 1.5) / 2, w: S(60), h: Math.round(smallPx * 1.5), font: body(smallPx), colour: { text: role(c.muted) }, text: { align: "right" } }, words(c.muted, c.surface));
  } else {
    add({ id: "st_footer_name", featureId: "prose", label: "Footer name", content: name, x: side, y: fY, w: contentW, h: Math.round(typeSize(t, 1) * 1.4), font: heading(typeSize(t, 1)), colour: { text: role(c.text) }, text: { align: "center" } }, words(c.text, c.surface));
    fRow(fLinks, fY + Math.round(typeSize(t, 1) * 1.4) + S(2), 0, true);
    socialRow((W - socialRowW) / 2, fY + Math.round(typeSize(t, 1) * 1.4) + S(2) + Math.round(smallPx * 1.5) + S(2));
    add({ id: "st_footer_small", featureId: "prose", label: "Small print", content: smallPrint, x: side, y: footY + footH - S(8) - Math.round(smallPx * 1.5), w: contentW, h: Math.round(smallPx * 1.5), font: body(smallPx), colour: { text: role(c.muted) }, text: { align: "center" } }, words(c.muted, c.surface));
  }

  return {
    nodes,
    palette: { bg: c.bg, surface: c.surface, text: c.text, muted: c.muted, accent: c.accent, highlight: c.highlight },
    format: formatOf(t, c),
    height: footY + footH,
    parts,
  };
}

/** The Format fields a theme sets, so a part from the library put on the page later follows it too. */
export function formatOf(t: SiteTheme, c: ThemeColours): Record<string, string | number | boolean> {
  const pair = pairingOf(t.fonts.pairing);
  const fam = (stack: string) => (/monospace/.test(stack) ? "monospace" : /serif$/.test(stack.trim()) && !/sans-serif/.test(stack) ? "serif" : /Impact|Narrow/.test(stack) ? "condensed" : "geometric sans");
  const body = (stack: string) => (/monospace/.test(stack) ? "monospace" : /serif$/.test(stack.trim()) && !/sans-serif/.test(stack) ? "serif" : /Trebuchet|Segoe UI', 'Trebuchet/.test(stack) ? "humanist sans" : "system sans");
  void c;
  return {
    "palette.accentHue": t.colours.hue,
    "palette.mode": t.colours.mode === "dark" ? "dark" : "light",
    "type.headingFamily": fam(pair.heading),
    "type.bodyFamily": body(pair.body),
    "type.scale": ({ 1.2: "1.2 minor third", 1.25: "1.25 major third", 1.333: "1.333 perfect fourth", 1.414: "1.414 augmented fourth", 1.5: "1.5 perfect fifth" } as Record<number, string>)[t.layout.scale] ?? "1.25 major third",
    "type.baseSize": typeSize(t, 0),
    "type.headingCase": pair.caps ? "UPPERCASE" : "sentence case",
    "layout.radius": radii(t).box,
    "layout.density": t.layout.density,
    "layout.gap": space(t, 3),
    "layout.borders": t.shapes.border === "bold" ? "heavy" : t.shapes.border,
    "layout.shadow": t.shapes.shadow,
    "motion.easing": t.motion.style === "bouncy" ? "springy" : t.motion.style === "snappy" ? "snappy" : "gentle",
    "motion.duration": Math.round(parseFloat(motionOf(t).duration) * 1000),
  };
}
