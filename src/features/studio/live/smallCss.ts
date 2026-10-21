/**
 * A TABLET OR PHONE PLAN, AS RULES ON THE ONE PAGE.
 *
 * The page is drawn once, at every width (`LiveSite`, nested: each part that
 * holds others stands in a box of its own, `.sm-g`, with what it holds,
 * where on the desktop that box is `display: contents` and changes nothing).
 * A plan (`small.ts`) becomes per-part rules here: where each part goes in
 * the flow (`order`), how wide it is, whether it is shown, and how a block
 * is drawn (opened round what it holds, or kept whole and scaled). The
 * Builder's Tablet and Phone views scope the rules to the page drawn at that
 * width; the published page puts them under media queries. So there is one
 * element per part, every script and every motion runs at every width, and
 * what the board shows at 390 is what a phone is served.
 *
 * Pure: no React, no browser. The caller says how a part and a group are
 * found (`#id` on the published page, the Builder's own attribute on the
 * board).
 */
import { SMALL_GAP, TAP, type SmallItem, type SmallNode, type SmallPlan } from "./small";

export interface SmallSheetOptions {
  /** A part's element. */
  part: (id: string) => string;
  /** The box a holder stands in with what it holds (`.sm-g`). */
  group: (id: string) => string;
  /** Does this part stand in a box of its own (it holds others)? */
  holds: (id: string) => boolean;
  /** Each part's holder, or null at the top of the page. */
  parentOf: (id: string) => string | null;
  /** Something a visitor presses: a button, a link. */
  control?: (id: string) => boolean;
  /** A part a press shows (`Show on press`): its own script shows and hides it, never these rules. */
  stated?: (id: string) => boolean;
  /** Put before every selector: the Builder's page at that width. Empty under a media query. */
  scope: string;
  /** The page's width: the window's (`100%`) on the published page, the plan's on the board. */
  pageWidth: string;
  /** The least the page is tall: the device's screen in the Preview, the window when published. A page shorter than that is still painted to its foot, as a browser paints its body's ground (PST's Profile on a phone: white to the bottom of the screen, not a 320px card). */
  pageMinHeight?: string;
  /** The narrowest window this layout is shown in, for the press areas of a block kept whole. */
  narrowest: number;
}

/** What every small page starts from: parts not in the plan are not drawn. */
const GAP = SMALL_GAP;
const PRESS = ":is(a[href],button,[role=button],summary)";

/** A string safe inside a CSS attribute value or after `#` / `.`. */
export function cssIdent(s: string): string {
  return s.replace(/^(\d)/, "\\3$1 ").replace(/[^\w-]/g, (c) => `\\${c}`);
}

export function smallSheet<N extends SmallNode>(plan: SmallPlan<N>, o: SmallSheetOptions): string {
  const out: string[] = [];
  const rule = (sels: string | string[], decl: string) => {
    const list = (Array.isArray(sels) ? sels : [sels]).filter(Boolean);
    if (list.length) out.push(`${list.map((s) => `${o.scope}${s}`).join(",")}{${decl}}`);
  };
  const P = o.part, G = o.group;
  const inner = (id: string) => `${G(id)}>.sm-gi`;
  /* Where a part's own drawing is, beside what it holds. */
  const own = (id: string) => `${P(id)}>:not(.sm-p):not(.sm-g):not(.sm-hold):not(.sm-br):not(style)`;
  const unplace = "position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;";

  /* The page's own box is the scoped element itself on the board. */
  const pageSel = o.scope.trim() || ".sm-page";
  out.push(`${pageSel}{width:${o.pageWidth}!important;height:auto!important;min-height:${o.pageMinHeight ?? "320px"}!important;min-width:0!important;overflow-x:clip!important;overflow-y:visible!important;zoom:1!important}`);
  rule(".sm-root", `${unplace}inset:auto!important;width:100%!important;height:auto!important;box-sizing:border-box;container-type:inline-size;display:block!important;padding:0!important`);
  /* Not in the plan at this width: not drawn. A part a press shows is its script's to show. */
  rule([":where(.sm-p:not(.sm-state))", ":where(.sm-g)"], "display:none!important");
  rule(".sm-hold", "display:contents!important");

  if (plan.mode === "site") {
    /* The site's own layout at this width, as the capture measured it: each part where the site put it. */
    rule(".sm-root", `height:${plan.height}px!important;position:relative!important`);
    rule(".sm-g", "display:contents!important");
    /*
     * A part the published page carries inside a moving box (`exportSite.ts`,
     * `carryOwned`: thesolface's community links, which lift on hover) is
     * placed against that box, not the page: each box hands its own place at
     * this width to what is inside it (`--sm-ox`, `--sm-oy`), and a part
     * takes it off. Placed against the page, the words ran 10 000 px down a
     * phone page. Nothing is carried on the board, where both are 0.
     */
    for (const b of plan.boxes) {
      const k = (v: number) => +(v / plan.width).toFixed(5);
      /* A part a press shows is placed but not drawn: its press shows it. Forced to show here, a menu stood open on every phone. */
      const show = o.stated?.(b.node.id) ? "" : "display:flex!important;";
      rule(P(b.node.id), `${show}position:absolute!important;left:calc(${k(b.x)} * 100cqw - var(--sm-ox, 0px))!important;top:calc(${b.y}px - var(--sm-oy, 0px))!important;width:calc(${k(b.w)} * 100cqw)!important;min-height:${b.h}px!important;height:auto!important;margin:0!important;right:auto!important;bottom:auto!important`);
      rule(`${P(b.node.id)}>*`, `--sm-ox:calc(${k(b.x)} * 100cqw);--sm-oy:${b.y}px`);
      /*
       * Its box here is where the site showed it, its own transform in it; the
       * desktop's move is not made again (thesolface's hero frog, centred by
       * translateX(-50%): 345 px left of its phone box, off the page). A turn
       * or a scale stays. Only its own drawing: not a part carried inside it.
       */
      const tm = /^matrix\(([^)]+)\)$/.exec(((b.node as { art?: { transform?: string } }).art?.transform ?? "").trim());
      const tv = tm?.[1] ? tm[1].split(",").map(Number) : null;
      if (tv && tv.length === 6 && tv.every(Number.isFinite) && (Math.abs(tv[4]!) > 1 || Math.abs(tv[5]!) > 1)) {
        rule(`${P(b.node.id)} [style*="matrix("]:not(${P(b.node.id)} .sm-p *):not(${P(b.node.id)} .sm-p)`, `transform:matrix(${tv.slice(0, 4).join(", ")}, 0, 0)!important`);
      }
      /* Taller here than at full width and narrower: the site set its words on more lines here (PST's intro, one line at 1440, two at 390), so a line held whole there is let wrap. */
      /* Its type at the size the site set it here (PST's "Tuning in" box, 11px on a phone): the part's own words, not the parts inside it. */
      if (b.px) rule([own(b.node.id), `${own(b.node.id)} [style*="font-size"]`], `font-size:${b.px}px!important`);
      if (b.h > b.node.h + 4 && b.w < b.node.w) rule(`${P(b.node.id)} [style*="white-space: nowrap"]`, "white-space:normal!important");
    }
    return out.join("\n");
  }

  rule(".sm-root", `display:flex!important;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;column-gap:${GAP}px;row-gap:0;padding:0 ${GAP}px ${GAP}px!important`);
  rule(".sm-br", "display:block!important;flex:0 0 100%;height:0;margin:0;order:0");

  let seq = 1;
  /* Groups given a look of their own here; every other group a drawn part stands in is see-through (`contents`). */
  const styled = new Set<string>();
  const drawn: string[] = [];
  const words: string[] = [];
  const presses: string[] = [];
  const breakers = new Map<string, number>();
  const last = new Map<string, "one" | "many">();

  /* Room at a window width, for a container: what the window gives less the gutters and pads around it. */
  type Room = (V: number) => number;
  const containerSel = (c: string | null) => (c === null ? ".sm-root" : inner(c));
  /* A row or a grid after another starts on a line of its own: a zero-height breaker before it. */
  const breakBefore = (c: string | null) => {
    if (last.get(c ?? "") !== "many") return;
    const k = (breakers.get(c ?? "") ?? 0) + 1;
    breakers.set(c ?? "", k);
    rule(`${containerSel(c)}>i.sm-br:nth-of-type(${k})`, `order:${seq++}`);
  };

  interface Slot { width?: string; standalone: boolean; first?: boolean }
  /* Where a unit stands in its container: its place in the order, its width, and a line of its own when it is alone. */
  const place = (width: string, slot: Slot, bleed: boolean, mt = GAP) => {
    const top = slot.first && bleed ? 0 : mt;
    const margin = bleed ? `${top}px -${GAP}px 0 -${GAP}px` : `${top}px ${slot.standalone && width !== "100%" ? `calc(100% - ${width})` : "0px"} 0 0`;
    return `${unplace}order:${seq++};width:${width}!important;max-width:${bleed ? "none" : "100%"}!important;margin:${margin}!important;flex:0 0 auto!important;box-sizing:border-box;`;
  };
  const widthOf = (slot: Slot, bleed: boolean, natural: string) => slot.width ?? (bleed ? `calc(100% + ${GAP * 2}px)` : natural);

  const emit = (it: SmallItem<N>, c: string | null, room: Room, slot: Slot): void => {
    switch (it.kind) {
      case "part": {
        const id = it.node.id;
        const h = it.control ? Math.max(TAP, it.minH) : it.minH;
        const bleed = !!it.bleed;
        const width = widthOf(slot, bleed, it.full ? "100%" : `min(100%, ${it.w}px)`);
        const look = `display:flex!important;flex-direction:column!important;height:auto!important;min-height:${h}px!important;${it.control ? `min-width:${TAP}px!important;` : ""}`;
        const fit = it.fit < 1 ? `zoom:${+it.fit.toFixed(4)};` : "";
        drawn.push(id);
        if (o.holds(id)) {
          /* Words with what is pressed in them: the words a line of their own, the presses after them. */
          styled.add(id);
          rule(G(id), `display:block!important;${place(width, slot, bleed)}`);
          rule(inner(id), `display:flex!important;flex-wrap:wrap;align-items:flex-start;column-gap:${GAP}px;width:100%`);
          rule(P(id), `${look}${unplace}order:${seq++};width:100%!important;flex:0 0 100%!important;margin:0!important;${fit}`);
        } else if (fit) {
          /* A heading scaled to fit: under `zoom`, a width of 100% is the room it is given, and it lays out at that over the factor. */
          rule(P(id), `${look}${place("100%", slot, false, Math.round(GAP / it.fit))}${fit}`);
        } else {
          rule(P(id), `${look}${place(width, slot, bleed)}`);
        }
        if (it.control) presses.push(P(id));
        else words.push(P(id));
        last.set(c ?? "", "one");
        return;
      }
      case "keep": {
        const id = it.node.id;
        const bleed = !!it.bleed;
        const width = widthOf(slot, bleed, `min(100%, ${it.max}px)`);
        drawn.push(id);
        styled.add(id);
        /* Kept whole: a box of the block's shape, and the block inside it at its desktop size, scaled by the box's own width. */
        rule(G(id), `display:block!important;${place(width, slot, bleed)}aspect-ratio:${it.w}/${it.h};container-type:inline-size;overflow:clip;overflow-clip-margin:${TAP / 2}px;${it.tap ? `min-height:${TAP}px;min-width:${TAP}px;` : ""}`);
        rule(inner(id), `display:block!important;position:absolute!important;left:0;top:0;width:${it.w}px;height:${it.h}px;zoom:tan(atan2(100cqw, ${it.w}px))`);
        for (const m of it.members) {
          drawn.push(m.node.id);
          if (m.node.id !== id && o.holds(m.node.id)) { styled.add(m.node.id); rule(G(m.node.id), "display:contents!important"); }
          rule(P(m.node.id), `display:flex!important;position:absolute!important;left:${m.x}px!important;top:${m.y}px!important;width:${m.w}px!important;min-height:${m.h}px!important;height:auto!important;margin:0!important;right:auto!important;bottom:auto!important`);
        }
        /* A button's own words and icon, kept whole with it: a press on them is a press on it. */
        const onPress = it.members.filter((m) => { for (let p = o.parentOf(m.node.id); p; p = o.parentOf(p)) { if (o.control?.(p)) return true; if (p === id) break; } return false; }).map((m) => P(m.node.id));
        if (onPress.length) rule(onPress, "pointer-events:none!important");
        /*
         * Whatever is pressed in it is a tap each way, at the scale it is
         * drawn at in the narrowest window, with its look untouched: an
         * invisible area round it takes the press (the ticker chip in a
         * header, drawn 25px tall).
         */
        const at = Math.min(it.max, room(o.narrowest)) / Math.max(1, it.w);
        const n = Math.ceil(TAP / Math.max(0.05, at));
        rule(`${inner(id)} ${PRESS}:not([style*="position"])`, "position:relative");
        rule(`${inner(id)} ${PRESS}::after`, `content:"";position:absolute;left:50%;top:50%;width:max(100%, ${n}px);height:max(100%, ${n}px);transform:translate(-50%,-50%)`);
        last.set(c ?? "", "one");
        return;
      }
      case "open": {
        const id = it.node.id;
        const bleed = !!it.bleed;
        const pad = Math.max(it.pad, bleed ? GAP : 0);
        const width = widthOf(slot, bleed, "100%");
        drawn.push(id);
        styled.add(id);
        /* Opened: its own drawing behind (first in its box, so under what follows it), what it holds in the flow inside it. */
        rule(G(id), `display:block!important;${place(width, slot, bleed)}`);
        rule(inner(id), `display:flex!important;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;column-gap:${GAP}px;padding:0 ${pad}px ${pad}px;box-sizing:border-box;width:100%;min-height:${GAP}px`);
        /* What it holds stands over its drawing. */
        rule(`${inner(id)}>:is(.sm-p,.sm-g)`, "position:relative");
        rule(P(id), "display:contents!important");
        rule(own(id), "position:absolute!important;inset:0!important;width:auto!important;height:auto!important;min-height:0!important;margin:0!important;overflow:hidden;pointer-events:none");
        const w = slot.width;
        const inside: Room = (V) => (w ? (room(V) - GAP) / 2 : room(V) + (bleed ? GAP * 2 : 0)) - pad * 2;
        last.set(c ?? "", "one");
        lay(it.children, id, inside);
        return;
      }
      case "row":
      case "grid": {
        breakBefore(c);
        /* Words with the presses in them: the presses stand in the words' own box. */
        const head = it.children[0];
        const inWords = it.kind === "row" && head?.kind === "part" && o.holds(head.node.id) && it.children.slice(1).every((x) => "node" in x && within(x.node.id, head.node.id));
        if (inWords) {
          emit(head!, c, room, slot);
          for (const x of it.children.slice(1)) emit(x, head!.node.id, room, { standalone: false });
          return;
        }
        const cell: Slot = it.kind === "grid" ? { width: `calc(50% - ${GAP / 2}px)`, standalone: false } : { standalone: false };
        for (const x of it.children) emit(x, c, it.kind === "grid" ? (V) => (room(V) - GAP) / 2 : room, cell);
        last.set(c ?? "", "many");
        return;
      }
      case "menu":
        menu(it);
        return;
    }
  };
  const within = (id: string, holder: string): boolean => { for (let p = o.parentOf(id); p; p = o.parentOf(p)) if (p === holder) return true; return false; };
  const lay = (items: SmallItem<N>[], c: string | null, room: Room) => {
    items.forEach((x, i) => emit(x, c, room, { standalone: true, first: i === 0 && c === null && x === plan.items[0] }));
  };

  /*
   * THE MENU. A key at the top of the page and a panel under it; the nav's
   * own links, wherever they stand in the page, are laid in the panel while
   * the key is pressed. A checkbox in the key holds it open: no script.
   */
  const OPEN = ".sm-root:has(.sm-menu-toggle:checked)";
  const menu = (it: Extract<SmallItem<N>, { kind: "menu" }>) => {
    /* The glyphs are real elements (BUILDER-RULES.md rule 7: no pictures drawn by CSS alone); the key swaps them. */
    rule(".sm-glyph-close", "display:none");
    rule(".sm-menu-toggle:checked ~ .sm-glyph .sm-glyph-open", "display:none");
    rule(".sm-menu-toggle:checked ~ .sm-glyph .sm-glyph-close", "display:inline");
    rule(".sm-menu-button:has(:focus-visible)", "outline:2px solid currentColor;outline-offset:2px");
    rule(".sm-menu-button", `display:inline-flex!important;order:${seq++};width:112px;margin:${GAP}px calc(100% - 112px) 0 0;min-height:${TAP}px;box-sizing:border-box`);
    let top = GAP + TAP + 8 + GAP;
    const at: string[] = [];
    for (const l of it.links) {
      if (l.kind !== "part" && l.kind !== "keep") continue;
      const id = l.node.id;
      drawn.push(id);
      const h = l.kind === "part" ? Math.max(TAP, l.minH) : Math.max(TAP, Math.round((l.h * l.max) / Math.max(1, l.w)));
      const fixed = `position:fixed!important;top:${top}px!important;left:${GAP * 2}px!important;right:auto!important;bottom:auto!important;margin:0!important;z-index:21;`;
      if (l.kind === "part") {
        rule(`${OPEN} ${P(id)}`, `display:flex!important;flex-direction:column!important;${fixed}width:calc(100% - ${GAP * 4}px)!important;min-height:${h}px!important;height:auto!important`);
        presses.push(P(id));
      } else {
        styled.add(id);
        rule(`${OPEN} ${G(id)}`, `display:block!important;${fixed}width:min(calc(100% - ${GAP * 4}px), ${l.max}px)!important;aspect-ratio:${l.w}/${l.h};container-type:inline-size;overflow:hidden;min-height:${TAP}px`);
        rule(inner(id), `display:block!important;position:absolute!important;left:0;top:0;width:${l.w}px;height:${l.h}px;zoom:tan(atan2(100cqw, ${l.w}px))`);
        for (const m of l.members) {
          drawn.push(m.node.id);
          if (m.node.id !== id && o.holds(m.node.id)) { styled.add(m.node.id); rule(G(m.node.id), "display:contents!important"); }
          rule(P(m.node.id), `display:flex!important;position:absolute!important;left:${m.x}px!important;top:${m.y}px!important;width:${m.w}px!important;min-height:${m.h}px!important;margin:0!important`);
        }
      }
      at.push(id);
      top += h + 8;
    }
    rule(`${OPEN}>.sm-menu-panel`, `display:block!important;position:fixed;top:${GAP + TAP + 8}px;left:${GAP}px;right:${GAP}px;height:${top - (GAP + TAP + 8) + 4}px;z-index:20`);
    /* What held only the nav (the list round it) is the panel now: its own drawing goes, the links in it stay. */
    for (const hId of it.holders) {
      styled.add(hId);
      rule(P(hId), "display:contents!important");
      rule(own(hId), "display:none!important");
      if (o.holds(hId)) rule([G(hId), inner(hId)], "display:contents!important");
    }
    menuLinks.push(...at);
  };
  const menuLinks: string[] = [];

  lay(plan.items, null, (V) => V - GAP * 2);

  /* Every box a drawn part stands in, up to its place in the flow, is see-through. */
  const through = new Set<string>();
  for (const id of drawn) for (let p = o.parentOf(id); p; p = o.parentOf(p)) if (!styled.has(p) && o.holds(p)) through.add(p);
  /* A box that is see-through but whose own part is not drawn: its part stays hidden, what it holds shows. */
  if (through.size) rule([...through].map(G), "display:contents!important");

  /* Words wrap at a small width, whatever the capture measured; a row of links in them wraps rather than crushing each to a sliver. */
  if (words.length) {
    const W = `:is(${words.join(",")})`;
    rule(`${W} *`, "white-space:normal!important;overflow-wrap:anywhere");
    rule(`${W} :is(:has(> ${PRESS} ~ ${PRESS}),:has(> * > ${PRESS} ~ ${PRESS}))`, "flex-wrap:wrap;row-gap:4px");
    rule(`${W} :has(> ${PRESS} ~ ${PRESS}) > ${PRESS}`, "overflow-wrap:normal;flex-shrink:0");
  }
  /* Whatever a visitor presses in the flow is a tap tall and wide. */
  const flow = [...words, ...presses];
  if (flow.length) {
    rule(`:is(${flow.join(",")}) ${PRESS}`, `min-height:${TAP}px;min-width:${TAP}px;box-sizing:border-box`);
    rule(`:is(${flow.join(",")}) a[href]`, "display:inline-flex;align-items:center");
  }
  return out.join("\n");
}

/** How many breakers each box needs (`.sm-br`), at the most of the widths: the renderer draws that many, hidden on the desktop. */
export function breakersFor<N extends SmallNode>(plans: readonly SmallPlan<N>[], holds: (id: string) => boolean): Map<string, number> {
  const most = new Map<string, number>();
  for (const plan of plans) {
    if (plan.mode !== "made") continue;
    const count = new Map<string, number>();
    const last = new Map<string, "one" | "many">();
    const walk = (items: SmallItem<N>[], c: string) => {
      for (const it of items) {
        if (it.kind === "row" || it.kind === "grid") {
          if (last.get(c) === "many") count.set(c, (count.get(c) ?? 0) + 1);
          const head = it.children[0];
          if (it.kind === "row" && head?.kind === "part" && holds(head.node.id)) { last.set(c, "one"); continue; }
          last.set(c, "many");
          for (const x of it.children) if (x.kind === "open") walk(x.children, x.node.id);
        } else if (it.kind === "open") { last.set(c, "one"); walk(it.children, it.node.id); }
        else if (it.kind !== "menu") last.set(c, "one");
      }
    };
    walk(plan.items, "");
    for (const [c, n] of count) most.set(c, Math.max(most.get(c) ?? 0, n));
  }
  return most;
}
