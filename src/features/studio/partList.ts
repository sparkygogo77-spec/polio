/**
 * THE PAGE'S ELEMENTS AS ONE FLAT LIST, IN THE ORDER A VISITOR SEES THEM.
 *
 * The owner's words about the tree this replaces: nested rows ("Page body >
 * Section > Box in …"), names that repeat the site's title, and four
 * identical "status: CA copied!" rows. He asked for "a flat, static list of
 * every element on the page from top to bottom, one row each", each with a
 * plain name from its words or role ("Button: BUY ON PUMP.FUN", "Picture:
 * TV", "Copy bar: CA") and where it sits ("in header", "in How to buy"); a
 * state that only appears after a press shown once, indented under the
 * control that shows it, marked as such; never a row twice.
 *
 * So, from the page's parts:
 *
 *   · a ROW is a thing a visitor sees: words, a picture, a control (a link,
 *     a button, a copy bar), a field, a video, an embedded page, a drawing,
 *     or a painted shape with nothing inside it;
 *   · a box that only HOLDS others is not a row: it is where they sit, said
 *     after each name ("in header", "in How to buy");
 *   · a CONTROL is one row: the words and icon inside a button are its label,
 *     never rows of their own ("one button = one component");
 *   · a part only a PRESS shows (`node.state`) is listed under the control
 *     whose Show on press names it (`press-shows`), once, marked
 *     `after`; the same thing shown by several presses, or the same words in
 *     the same place, is one row that holds every id;
 *   · the order is the page's, top to bottom, then left to right.
 *
 * Pure: no store, no DOM, so `tests/element-list.mjs` reads it on sink's
 * own captures. `partTree.ts` is kept for "Show nesting".
 */
import { partTree } from "./partTree.ts";
import { computedAs, isMachineLabel, kindOf, sectionOf, wordsOf, type Named } from "./partNames.ts";

export interface ListPart extends Named {
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: { group: string; option: number } | null;
  work?: { id: string; inputs?: Record<string, string>; off?: boolean; also?: { id: string; inputs?: Record<string, string>; off?: boolean }[] } | null;
  colour?: { bg?: string | null } | Record<string, unknown> | null;
  texture?: unknown;
}

export interface ListRow {
  /** The part a press on the row picks. */
  id: string;
  /** Every part the row stands for: the same thing shown by several presses is one row. */
  ids: string[];
  kind: string;
  /** "Button: BUY ON PUMP.FUN" */
  name: string;
  /** "in header", "in How to buy", or null when the page gives it no place to name. */
  where: string | null;
  /** 1 for a part only a press shows, under its control. */
  depth: 0 | 1;
  /** Shows only after a press on `control`. */
  after: boolean;
  control: string | null;
}

const clip = (s: string, max = 44) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const usesOf = (n: ListPart) => (n.work ? [n.work, ...(n.work.also ?? [])].filter((u) => u && !u.off) : []);
const uses = (n: ListPart, id: string) => usesOf(n).some((u) => u.id === id);
const idList = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const CONTROL_KINDS = new Set(["Button", "Link"]);
const PLACE_KINDS = new Set(["Header", "Footer", "Menu"]);
/** Kinds that are a thing to see even with no words or picture. */
const SEEN_KINDS = new Set(["Field", "Video", "Embedded page", "Drawing", "Picture", "Heading", "Form"]);

/** The kind a row is named by: a part that copies its words is a copy bar, whatever box it is. */
function rowKind(n: ListPart, featureName?: (id: string) => string | undefined): string {
  if (uses(n, "copy-toast")) return "Copy bar";
  const k = kindOf(n, featureName);
  if (k === "Box" && n.link) return "Link";
  return k;
}

const isControl = (n: ListPart, kind: string) => CONTROL_KINDS.has(kind) || kind === "Copy bar" || !!n.link || uses(n, "press-shows");

const painted = (n: ListPart) => {
  const bg = (n.colour as { bg?: unknown } | null | undefined)?.bg;
  return (typeof bg === "string" && bg.trim() !== "" && !/transparent|rgba\([^)]*,\s*0\)/.test(bg)) || !!n.texture;
};

/** The words a control is labelled with: its own, else the first words inside it, else the name the browser gave it. */
function labelOf(n: ListPart, inside: readonly ListPart[]): string {
  const own = wordsOf(n);
  if (own) return own;
  const kid = inside.map((k) => wordsOf(k)).find(Boolean);
  if (kid) return kid;
  const as = computedAs(n.prompt)?.name;
  if (as) return as;
  const alt = n.picture?.alt?.trim() || inside.map((k) => k.picture?.alt?.trim()).find(Boolean);
  if (alt) return alt;
  return isMachineLabel(n.label) ? "" : (n.label ?? "").trim();
}

/** A capture's own role word in front of a name ("image “Trump & Morty”", "paragraph: …", "cell “…”") is the kind again: the name is what follows. */
const ROLE_LEAD = /^(?:image|img|picture|link|button|heading|paragraph|cell|text|label|status|figure|graphic)\s*(?::\s*|\s+(?=“))“?(.+?)”?$/i;

/** "Button: BUY ON PUMP.FUN", "Picture: TV", "Copy bar: CA", or the kind alone. */
export function rowName(kind: string, text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  const lead = ROLE_LEAD.exec(t);
  if (lead) t = lead[1]!.trim();
  /* A file's machine name ("svg-425f8e432c51", "img_3fa9c2e1") says nothing to a person. */
  if (/^[a-z]{2,6}[-_][0-9a-f]{6,}$/i.test(t)) t = "";
  return t ? `${kind}: ${clip(t)}` : kind;
}

export function partList(all: readonly ListPart[], opts: { siteName?: string; featureName?: (id: string) => string | undefined } = {}): ListRow[] {
  const nodes = all.slice();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const tree = partTree(nodes);
  const site = (opts.siteName ?? "").trim().toLowerCase();
  const kindMemo = new Map<string, string>();
  const kind = (n: ListPart) => { let k = kindMemo.get(n.id); if (!k) { k = rowKind(n, opts.featureName); kindMemo.set(n.id, k); } return k; };
  const descendants = (id: string): ListPart[] => {
    const out: ListPart[] = [];
    const walk = (at: string) => { for (const k of tree.kids.get(at) ?? []) { const n = byId.get(k); if (n) { out.push(n); walk(k); } } };
    walk(id);
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  };
  const holders = (id: string): ListPart[] => {
    const out: ListPart[] = [];
    for (let at = tree.parent.get(id) ?? null; at; at = tree.parent.get(at) ?? null) { const n = byId.get(at); if (n) out.push(n); }
    return out;
  };

  /* Which control shows each part a press shows. */
  const shownBy = new Map<string, string>();
  const controlsInOrder = nodes.filter((n) => uses(n, "press-shows")).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of controlsInOrder) {
    for (const u of usesOf(c).filter((u) => u.id === "press-shows")) {
      for (const id of idList(u.inputs?.shows)) if (!shownBy.has(id)) shownBy.set(id, c.id);
    }
  }
  /* A part whose holder a press shows is shown by that press too. */
  const controlOf = (n: ListPart): string | null => {
    if (shownBy.has(n.id)) return shownBy.get(n.id)!;
    for (const h of holders(n.id)) if (shownBy.has(h.id)) return shownBy.get(h.id)!;
    return null;
  };

  /** Is this part a row, and if so its kind and words. Null when it is a holder, or a control's own label. */
  const asRow = (n: ListPart): { kind: string; text: string } | null => {
    const k = kind(n);
    /* Inside a control: the control's label, not a row. */
    if (holders(n.id).some((h) => isControl(h, kind(h)))) return null;
    const inside = descendants(n.id);
    /* A header, section or list holding parts is where they sit; one placed whole, drawing its own insides, is a thing a visitor sees. */
    if (PLACE_KINDS.has(k) || k === "Page body" || k === "Section" || k === "List") {
      if (inside.length) return null;
      return { kind: k, text: wordsOf(n) || computedAs(n.prompt)?.name || (n.featureId ? opts.featureName?.(n.featureId) : "") || "" };
    }
    if (isControl(n, k)) return { kind: k, text: labelOf(n, inside) };
    const words = wordsOf(n);
    const alt = n.picture?.alt?.trim() ?? "";
    if (words) return { kind: k === "Box" || k === "Decoration" ? "Words" : k, text: words };
    if (n.picture) return { kind: "Picture", text: alt || (isMachineLabel(n.label) ? "" : (n.label ?? "")) };
    if (SEEN_KINDS.has(k)) return { kind: k, text: computedAs(n.prompt)?.name ?? "" };
    /* A part placed from the drawer is named by what it is ("Card grid") and draws its own insides. */
    if (!inside.length && k !== "Box" && k !== "Decoration") return { kind: k, text: computedAs(n.prompt)?.name ?? "" };
    /* A box holding others is where they sit; a painted one with nothing inside is a shape a visitor sees. */
    if (inside.length) return null;
    if (painted(n)) return { kind: "Shape", text: "" };
    return null;
  };

  /** Where a part sits, in words: a header, footer or menu by name, else the heading of its section. */
  const whereOf = (n: ListPart, own: string): string | null => {
    for (const h of holders(n.id)) {
      const k = kind(h);
      if (k === "Header") return "in header";
      if (k === "Footer") return "in footer";
      if (k === "Menu") return "in menu";
    }
    /* Places are read off the page as it opens: a heading only a press shows is nobody's section. */
    const section = sectionOf(n, n.state ? nodes : opening);
    if (!section) return null;
    const s = section.replace(/\s+/g, " ").trim();
    if (!s || own.toLowerCase().includes(s.toLowerCase())) return null;
    /* The page's first heading is the site's title on its first screen: never repeated as a place. */
    if (s.toLowerCase() === site || s.toLowerCase() === firstTitle) return "in first screen";
    return `in ${clip(s, 32)}`;
  };

  const opening = nodes.filter((n) => !n.state);
  /* The page's first heading, which is its title: the first big words a visitor reads. */
  const firstTitle = (() => {
    const top = nodes.filter((n) => !n.state && kind(n) === "Heading" && wordsOf(n)).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    return top ? clip(wordsOf(top)).toLowerCase() : "";
  })();

  const make = (n: ListPart, after: boolean, control: string | null): ListRow | null => {
    const r = asRow(n);
    if (!r) return null;
    const name = rowName(r.kind, r.text);
    return { id: n.id, ids: [n.id], kind: r.kind, name, where: after ? null : whereOf(n, r.text), depth: after ? 1 : 0, after, control };
  };

  const order = (a: ListPart, b: ListPart) => a.y - b.y || a.x - b.x;
  const base = nodes.filter((n) => !n.state).sort(order);
  const hidden = nodes.filter((n) => !!n.state).sort(order);

  /* What each control shows, as rows, the same thing once. */
  const under = new Map<string, ListRow[]>();
  const orphans: ListRow[] = [];
  const seenHidden = new Map<string, ListRow>();
  for (const n of hidden) {
    const c = controlOf(n);
    const row = make(n, true, c);
    if (!row) continue;
    /* The same words shown in the same place by another press is the same thing. */
    const key = `${row.name}|${Math.round(n.x / 4)}|${Math.round(n.y / 4)}`;
    const sameUnder = (c ? under.get(c) : orphans)?.find((r) => r.name === row.name);
    const twin = seenHidden.get(key) ?? sameUnder;
    if (twin) { twin.ids.push(n.id); continue; }
    seenHidden.set(key, row);
    if (c) under.set(c, [...(under.get(c) ?? []), row]);
    else orphans.push(row);
  }

  const out: ListRow[] = [];
  const seenBase = new Map<string, ListRow>();
  for (const n of base) {
    const row = make(n, false, null);
    if (row) {
      /* Two parts drawing the same thing in the same place (a capture's twin) are one row. */
      const key = `${row.name}|${Math.round(n.x / 4)}|${Math.round(n.y / 4)}|${Math.round(n.w / 4)}`;
      const twin = seenBase.get(key);
      if (twin) twin.ids.push(n.id);
      else { seenBase.set(key, row); out.push(row); }
    }
    const shown = under.get(n.id);
    if (shown) {
      /* A control that is itself not a row (a box someone made pressable) still leads its states. */
      if (!row) {
        const r = { id: n.id, ids: [n.id], kind: kind(n), name: rowName(kind(n) === "Box" ? "Button" : kind(n), labelOf(n, descendants(n.id))), where: whereOf(n, ""), depth: 0 as const, after: false, control: null };
        out.push(r);
      }
      out.push(...shown);
      under.delete(n.id);
    }
  }
  /* States whose control is not on this page's base, or not found: at the foot, still once each. */
  for (const rows of under.values()) out.push(...rows);
  out.push(...orphans);
  /*
   * Neighbours that read the same. A run of painted bars, unnamed pictures
   * in one place, or one state shown again: one row holding them all. Any
   * other part a visitor sees is its own row, numbered ("Card grid",
   * "Card grid 2") so no two rows read the same.
   */
  const folded: ListRow[] = [];
  let run = 1;
  for (const r of out) {
    const prev = folded[folded.length - 1];
    const same = prev && prev.where === r.where && prev.depth === r.depth && prev.after === r.after && prev.control === r.control && !under.has(r.id);
    if (same && prev.name === r.name && (r.after || r.name === "Shape" || r.name === "Picture")) {
      prev.ids.push(...r.ids);
      continue;
    }
    if (same && (run > 1 ? prev.name.replace(/ \d+$/, "") : prev.name) === r.name) {
      run += 1;
      folded.push({ ...r, name: `${r.name} ${run}` });
      continue;
    }
    run = 1;
    folded.push(r);
  }
  return folded;
}

/** The rows a search keeps: its words in the name or the place, any case. */
export function filterRows<T extends ListRow>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows.slice();
  return rows.filter((r) => r.name.toLowerCase().includes(q) || (r.where ?? "").toLowerCase().includes(q));
}

/**
 * COMPONENTS, ONE ROW EACH (`components.ts`). A captured button is a stack
 * of parts: the box that paints it and its layers (its words, its lighting
 * bar, its shadow). The list above already folds a control's insides into
 * it; a layer stacked beside its host rather than inside it would still be
 * a row of its own ("Words: BUY", "Shape"). Folded here: every row standing
 * for a component's host or layer becomes the component's one row, where
 * the first of them stood, named by the component's kind ("Button: BUY
 * $TRORTY"), holding every part of it so hovering outlines the whole thing.
 * A press on it picks the host alone; the host carries its layers with it.
 */
export interface ListComponent {
  id: string;
  /** "Button", "Copy-address bar". */
  kindWord: string;
  /** The component's plain name, `Button “BUY $TRORTY”`. */
  name: string;
  /** The host and every layer. */
  parts: readonly string[];
}

export interface ComponentRow extends ListRow {
  /** The component's host, when the row is one. */
  component?: string;
}

export function foldComponentRows(rows: readonly ListRow[], comps: readonly ListComponent[]): ComponentRow[] {
  const owner = new Map<string, ListComponent>();
  for (const c of comps) for (const id of c.parts) if (!owner.has(id)) owner.set(id, c);
  const made = new Map<string, ComponentRow>();
  const out: ComponentRow[] = [];
  for (const r of rows) {
    const c = owner.get(r.id);
    if (!c) { out.push(r); continue; }
    const had = made.get(c.id);
    if (had) {
      for (const id of r.ids) if (!had.ids.includes(id)) had.ids.push(id);
      continue;
    }
    /* Its words as the list said them, else the ones the component was named by. */
    const said = r.name.includes(": ") ? r.name.slice(r.name.indexOf(": ") + 2) : "";
    const named = /“(.+)”/.exec(c.name)?.[1] ?? "";
    const row: ComponentRow = { ...r, id: c.id, ids: [...new Set([c.id, ...c.parts, ...r.ids])], kind: c.kindWord, name: rowName(c.kindWord, said || named), component: c.id };
    made.set(c.id, row);
    out.push(row);
  }
  return out;
}
