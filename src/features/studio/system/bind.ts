/**
 * INSTANCES FOLLOW THEIR COMPONENT (the parts-bind lane, proposal (c): "The
 * Element panel says 'Button / primary' and offers 'Edit the component' or
 * 'Change just this one' … 'Reset to the component' removes the override").
 *
 * An instance is the part a take matched to a component's variant
 * (`node.sys.c`, on the component's host). Its look is spread over the parts
 * the Builder reads as that component (`components.ts#paints`): the fill on
 * whichever part paints it, the words on each words layer, the outline, the
 * shadow, the host's corners. A variant's slot (`LookRefs`) names what each
 * of those holds: a token, or a value of its own.
 *
 *   · `setVariantSlot`: a variant's slot points at another token or holds
 *     another value. Only the System changes here.
 *   · `rebind(nodes, before, after)`: every instance of a variant whose slot
 *     changed between the two Systems has the fields that slot paints
 *     written again: pointed at the new token (`sys.f`, `sys.v`, the same
 *     record a take writes) or let go of the old one and given the value. Run
 *     in the same step as the System change on the open site, and when a
 *     site that shares the System takes the library's newer copy
 *     (`api.ts#reconcile`), with the copy it held as `before`.
 *   · AN OVERRIDE IS KEPT. A field follows its slot only while it shows what
 *     the slot gave it (the old slot's value, colour roles read through the
 *     palette). One changed by hand ("change just this one", the Element
 *     panel's own fields) shows something else, and is passed by. An
 *     instance marked as holding its own look (`sys.c.own`, "Change just
 *     this one" on the whole part) is passed by on those slots.
 *   · `resetInstance`: the instance wears its variant again, every slot, and
 *     holds nothing of its own.
 *
 * Only a slot whose REF changed is written: a token's value changing reaches
 * the fields pointing at it already (`resolve.ts#materialise`), and a field
 * that let go of that token keeps passing it by.
 *
 * Pure: no React, no store, every import ends in .ts.
 */
import { colourKey, ROLES } from "../look/index.ts";
import { componentsOf, type CompNode, type Component } from "../components.ts";
import { LOOK_SLOT_NAMES, kindOfField, kindOfToken, tokenById, valueOf, type FieldPath, type LookRef, type LookSlot, type NodeSys, type System, type TokenKind, type TokenValue } from "./model.ts";
import { fieldValue, sameValue, withField, type SysNode } from "./resolve.ts";

export const LOOK_SLOTS = LOOK_SLOT_NAMES;

/** The kind of value a slot holds, by the ref it has (a shadow slot holds a colour where a layer paints the shadow). */
export function slotKind(slot: LookSlot, r: LookRef | undefined): TokenKind {
  if (r && "token" in r) { const k = kindOfToken(r.token); if (k) return k; }
  if (slot === "fill" || slot === "words" || slot === "outline") return "colour";
  if (slot === "radius") return "radius";
  if (slot === "face") return "face";
  if (slot === "size") return "type";
  /* A bare colour (a layer painting the shadow); anything more ("rgba(0, 0, 0, 0.4) 0 4px 8px") is a shadow. */
  return r && "value" in r && typeof r.value === "string" && !!colourKey(r.value.trim()) ? "colour" : "shadow";
}

/** What a slot draws in a System: its token's value (and a face's name), or its own value. */
export function slotValue(s: System, r: LookRef | undefined): { value: TokenValue; face?: string } | null {
  if (!r) return null;
  if ("token" in r) {
    const t = tokenById(s, r.token);
    return t ? { value: valueOf(t), ...("stack" in t && t.face ? { face: t.face } : {}) } : null;
  }
  return r.value === "" ? null : { value: r.value };
}

/** A part's field and what it is for. `main` is the one a person reads the slot from (the panel's swatch, the take's variant). */
export interface SlotField {
  node: string;
  field: FieldPath;
  main: boolean;
  /** Written only along with this field of the same part: a fill's surface goes with its background. */
  with?: FieldPath;
}

/**
 * The fields one slot paints on an instance, by the parts the Builder reads
 * it as. Fields the part does not hold (words drawn in the page's own text
 * colour) are not the slot's to write.
 */
export function slotFields(byId: ReadonlyMap<string, SysNode>, comp: Component, slot: LookSlot): SlotField[] {
  const p = comp.paints;
  const out: SlotField[] = [];
  const add = (id: string | null | undefined, field: FieldPath, main: boolean, along?: FieldPath) => {
    const n = id ? byId.get(id) : undefined;
    if (n && fieldValue(n, field) !== undefined) out.push({ node: n.id, field, main, ...(along ? { with: along } : {}) });
  };
  if (slot === "fill" && p.fill) {
    const n = byId.get(p.fill);
    const bg = n?.colour?.bg;
    add(p.fill, bg !== undefined ? "colour.bg" : "colour.surface", true);
    if (bg !== undefined) add(p.fill, "colour.surface", false, "colour.bg");
  }
  if (slot === "words") p.words.forEach((id, i) => add(id, "colour.text", i === 0));
  if (slot === "outline") add(p.outline, "edge.colour", true);
  /* The host or a layer casting it (`edge.shadow`), else a dark layer standing in for it (its fill). */
  if (slot === "shadow" && p.shadow) add(p.shadow, byId.get(p.shadow)?.edge?.shadow ? "edge.shadow" : "colour.bg", true);
  if (slot === "radius") add(comp.id, "radius", true);
  if (slot === "face") p.words.forEach((id, i) => add(id, "font.stack", i === 0));
  if (slot === "size") p.words.forEach((id, i) => add(id, "font.px", i === 0));
  return out;
}

type Palette = Readonly<Record<string, string | undefined>> | null | undefined;
/** A field's value as it draws: a colour role read through the palette. */
const shown = (kind: TokenKind, v: TokenValue | undefined, palette: Palette) => (kind === "colour" && typeof v === "string" ? palette?.[v] ?? v : v);

/** Does a part's field show this value, as it draws (by the field's own kind)? */
function shows(n: SysNode, field: FieldPath, v: TokenValue | undefined, palette: Palette): boolean {
  const kind = kindOfField(field);
  return !!kind && sameValue(kind, shown(kind, fieldValue(n, field), palette), shown(kind, v, palette));
}

/** Can this field take what the slot now holds: a token of its own kind, or a value of it. */
function fits(field: FieldPath, r: LookRef, v: TokenValue): boolean {
  const kind = kindOfField(field);
  if (!kind) return false;
  if ("token" in r) return kindOfToken(r.token) === kind;
  return kind === "colour" ? typeof v === "string" && !!colourKey(v) : kind === "type" || kind === "space" || kind === "radius" ? typeof v === "number" : typeof v === "string";
}

/** The part with one field written from a slot: pointed at its token, or holding the value as its own. */
function writeField<N extends SysNode>(n: N, s: System, field: FieldPath, r: LookRef, to: { value: TokenValue; face?: string }): N {
  const out = withField(n, field, to.value, to.face);
  const had: NodeSys = n.sys?.s === s.id ? n.sys : { s: s.id };
  const f = { ...(had.f ?? {}) };
  const v = { ...(had.v ?? {}) };
  if ("token" in r) { f[field] = r.token; v[field] = to.value; } else { delete f[field]; delete v[field]; }
  const sys: NodeSys = { s: had.s, ...(Object.keys(f).length ? { f } : {}), ...(Object.keys(v).length ? { v } : {}), ...(had.c ? { c: had.c } : {}) };
  if (!sys.f && !sys.c) { const { sys: _s, ...rest } = out; void _s; return rest as N; }
  return { ...out, sys };
}

/** The instances of a System on these parts: host id → its component and variant. */
function instancesOf(nodes: readonly SysNode[], s: System): Map<string, NonNullable<NodeSys["c"]>> {
  const out = new Map<string, NonNullable<NodeSys["c"]>>();
  for (const n of nodes) if (n.sys?.s === s.id && n.sys.c) out.set(n.id, n.sys.c);
  return out;
}

/** The slots that changed what they point at, per variant, between two copies of one System. */
function changedSlots(before: System, after: System): Map<string, { slot: LookSlot; was: LookRef | undefined; now: LookRef }[]> {
  const out = new Map<string, { slot: LookSlot; was: LookRef | undefined; now: LookRef }[]>();
  for (const c of after.components) {
    const old = before.components.find((x) => x.id === c.id);
    for (const v of c.variants) {
      const ov = old?.variants.find((x) => x.id === v.id);
      if (!ov) continue;
      const list = LOOK_SLOTS.flatMap((slot) => {
        const now = v.look[slot], was = ov.look[slot];
        return now && JSON.stringify(now) !== JSON.stringify(was ?? null) ? [{ slot, was, now }] : [];
      });
      if (list.length) out.set(`${c.id}\u0000${v.id}`, list);
    }
  }
  return out;
}

/**
 * Every instance of a variant whose slot changed between `before` and
 * `after`, written as `after` has it, overrides kept (see the header). The
 * parts that changed, by id, and the list (the same array when none did).
 */
export function rebind<N extends SysNode>(nodes: readonly N[], before: System | null | undefined, after: System, palette?: Palette): { nodes: readonly N[]; changed: string[] } {
  if (!before || before.id !== after.id) return { nodes, changed: [] };
  const slots = changedSlots(before, after);
  if (!slots.size) return { nodes, changed: [] };
  const inst = [...instancesOf(nodes, after)].filter(([, c]) => slots.has(`${c.component}\u0000${c.variant}`));
  if (!inst.length) return { nodes, changed: [] };
  const comps = componentsOf(nodes as unknown as readonly CompNode[], palette as Record<string, string> | null);
  const byId = new Map<string, N>(nodes.map((n) => [n.id, n]));
  const changed = new Set<string>();
  for (const [host, c] of inst) {
    const comp = comps.byId.get(host);
    if (!comp) continue;
    const own = new Set(byId.get(host)?.sys?.c?.own ?? []);
    for (const { slot, was, now } of slots.get(`${c.component}\u0000${c.variant}`)!) {
      if (own.has(slot)) continue;
      const from = slotValue(before, was);
      const to = slotValue(after, now);
      if (!from || !to) continue;
      const wrote = new Set<string>();
      for (const { node, field, with: along } of slotFields(byId, comp, slot)) {
        const n = byId.get(node)!;
        /* Showing something else than the slot gave it: changed by hand, kept. */
        if (!fits(field, now, to.value) || !shows(n, field, from.value, palette)) continue;
        if (along && !wrote.has(`${node}\u0000${along}`)) continue;
        wrote.add(`${node}\u0000${field}`);
        const next = writeField(n, after, field, now, to);
        if (next !== n) { byId.set(node, next); changed.add(node); }
      }
    }
  }
  if (!changed.size) return { nodes, changed: [] };
  return { nodes: nodes.map((n) => byId.get(n.id) ?? n), changed: [...changed] };
}

/** A part's instance, read: its component, variant and the parts the Builder reads it as. Null for a part that is no instance of `s`. */
export function instanceOf(nodes: readonly SysNode[], s: System, partId: string, palette?: Palette): { host: string; component: System["components"][number]; variant: System["components"][number]["variants"][number]; comp: Component | null } | null {
  const comps = componentsOf(nodes as unknown as readonly CompNode[], palette as Record<string, string> | null);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  /* A layer picked on its own stands for its component's host. */
  const host = byId.get(partId)?.sys?.c ? partId : comps.of.get(partId) ?? null;
  const c = host ? byId.get(host)?.sys : null;
  if (!host || !c?.c || c.s !== s.id) return null;
  const component = s.components.find((x) => x.id === c.c!.component);
  const variant = component?.variants.find((v) => v.id === c.c!.variant);
  if (!component || !variant) return null;
  return { host, component, variant, comp: comps.byId.get(host) ?? null };
}

/** The slots where an instance shows something other than its variant: each slot's main field, colour roles read through the palette, and every slot it holds as its own. */
export function overridesOf(nodes: readonly SysNode[], s: System, partId: string, palette?: Palette): LookSlot[] {
  const it = instanceOf(nodes, s, partId, palette);
  if (!it) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = new Set(byId.get(it.host)?.sys?.c?.own ?? []);
  return LOOK_SLOTS.filter((slot) => {
    const r = it.variant.look[slot];
    const want = slotValue(s, r);
    if (!r || !want) return false;
    if (own.has(slot)) return true;
    if (!it.comp) return false;
    /* The main field, and what goes with it (a fill's surface, which some parts paint from). */
    const ones = slotFields(byId, it.comp, slot).filter((x) => x.main || x.with);
    return ones.some((f) => fits(f.field, r, want.value) && !shows(byId.get(f.node)!, f.field, want.value, palette));
  });
}

/** The instance wearing its variant again: every slot's fields written as the variant has them, and nothing held as its own. */
export function resetInstance<N extends SysNode>(nodes: readonly N[], s: System, partId: string, palette?: Palette): { nodes: readonly N[]; changed: string[] } {
  const it = instanceOf(nodes, s, partId, palette);
  if (!it) return { nodes, changed: [] };
  const byId = new Map<string, N>(nodes.map((n) => [n.id, n]));
  const changed = new Set<string>();
  const host = byId.get(it.host)!;
  if (host.sys?.c?.own) {
    const { own: _o, ...c } = host.sys.c;
    void _o;
    byId.set(host.id, { ...host, sys: { ...host.sys, c } });
    changed.add(host.id);
  }
  if (it.comp) for (const slot of LOOK_SLOTS) {
    const r = it.variant.look[slot];
    const want = slotValue(s, r);
    if (!r || !want) continue;
    /* The main field and what goes with it, and any other the slot paints that already shows what the main one does (a second words layer in the same colour). */
    const fields = slotFields(byId, it.comp, slot);
    const main = fields.find((x) => x.main);
    if (!main) continue;
    const mainNow = fieldValue(byId.get(main.node)!, main.field);
    for (const f of fields) {
      const n = byId.get(f.node)!;
      if (!fits(f.field, r, want.value) || (!f.main && !f.with && !shows(n, f.field, mainNow, palette))) continue;
      /* Already showing it (a colour role the palette paints the same counts): left as it is. */
      if (shows(n, f.field, want.value, palette)) continue;
      const role = siblingsRole(nodes, s, it, slot, f, want.value, palette);
      byId.set(f.node, role ? withRole(n, f.field, role) : writeField(n, s, f.field, r, want));
      changed.add(f.node);
    }
  }
  if (!changed.size) return { nodes, changed: [] };
  return { nodes: nodes.map((n) => byId.get(n.id) ?? n), changed: [...changed] };
}

/**
 * The palette role the other instances of the variant name for this field,
 * when most of them name one that paints the slot's value: a reset instance
 * then names it too, and keeps following the palette with them. Null when
 * they hold the value itself.
 */
function siblingsRole(nodes: readonly SysNode[], s: System, it: NonNullable<ReturnType<typeof instanceOf>>, slot: LookSlot, f: SlotField, want: TokenValue, palette: Palette): string | null {
  if (!palette || kindOfField(f.field) !== "colour") return null;
  const comps = componentsOf(nodes as unknown as readonly CompNode[], palette as Record<string, string> | null);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const said = new Map<string, number>();
  for (const [host, c] of instancesOf(nodes, s)) {
    if (host === it.host || c.component !== it.component.id || c.variant !== it.variant.id || c.own?.includes(slot)) continue;
    const comp = comps.byId.get(host);
    const same = comp ? slotFields(byId, comp, slot).find((x) => x.field === f.field && x.main === f.main) : undefined;
    const n = same ? byId.get(same.node) : undefined;
    const raw = n && same ? fieldValue(n, same.field) : undefined;
    if (n && same && raw !== undefined && shows(n, same.field, want, palette)) said.set(String(raw), (said.get(String(raw)) ?? 0) + 1);
  }
  const top = [...said].sort((a, b) => b[1] - a[1])[0];
  return top && (ROLES as readonly string[]).includes(top[0]) ? top[0] : null;
}

/** The part with a colour field naming a palette role: its own, pointing at no token (a role follows the site's palette). */
function withRole<N extends SysNode>(n: N, field: FieldPath, role: string): N {
  const out = withField(n, field, role);
  if (!out.sys?.f?.[field]) return out;
  const f = { ...out.sys.f };
  const v = { ...(out.sys.v ?? {}) };
  delete f[field];
  delete v[field];
  const sys: NodeSys = { s: out.sys.s, ...(Object.keys(f).length ? { f } : {}), ...(Object.keys(v).length ? { v } : {}), ...(out.sys.c ? { c: out.sys.c } : {}) };
  return { ...out, sys };
}

/** The instance holding its own look on every slot its variant has ("Change just this one", on the whole part): component edits pass it by until Reset. */
export function holdOwn<N extends SysNode>(n: N, s: System): N {
  const c = n.sys?.s === s.id ? n.sys.c : null;
  const v = c && s.components.find((x) => x.id === c.component)?.variants.find((x) => x.id === c.variant);
  if (!c || !v) return n;
  const own = LOOK_SLOTS.filter((slot) => v.look[slot]);
  if (JSON.stringify(c.own ?? []) === JSON.stringify(own)) return n;
  return { ...n, sys: { ...n.sys!, c: { ...c, own } } };
}
