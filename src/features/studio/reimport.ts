/**
 * BRINGING A SITE IN AGAIN, KEEPING WHAT THE OWNER CHANGED.
 *
 * A capture is taken again when the capture gets better (a hover no longer
 * read as the resting look, a corner cut to its box's curve, a loader timed
 * from the navigation). Bringing the new document in replaced the board
 * whole, and with it everything the owner had set by hand since: on
 * trumpmorty.fun, his ribbons' "Centre in its band" and their text size.
 * So trumpmorty.fun was never brought in again, and kept every old fault.
 *
 * This lays the new document over the board and keeps, field by field, what
 * the owner changed. What counts as changed is decided against the board as
 * it stood the moment it was brought in — after the sweep and the palette,
 * which rewrite parts on every import, so the machine's own rewrites are
 * never mistaken for his:
 *
 *   · `fingerprint` reads that board into `Taken`: each part, by the element
 *     it was read from, as its facets — a field, one key of an object field
 *     (`colour.bg`, `options.size`), one setting of a feature it carries
 *     (`work/marquee/middle`) — each as a short hash. Saved with the
 *     document at every import.
 *   · `keepOwnerEdits` takes the board now, that record, and the new
 *     document as imported. A facet whose value on the board no longer
 *     hashes to the record is the owner's, and stands; every other facet is
 *     the new document's. A part he added is kept; a captured part he
 *     deleted stays deleted; a part the new capture no longer has goes,
 *     unless he had changed it.
 *
 * A board brought in before the record existed has none. The importer then
 * rebuilds it from the document the board was brought in from (its source
 * commit), swept the same way. With neither, the merge is careful: a part
 * he moved keeps its box, a feature's settings on the board stand over the
 * capture's (the ribbons), a prompt or a lock he wrote stands, and nothing
 * else is guessed.
 *
 * Pure: no store, no React. `tests/reimport-keeps.mjs` holds it.
 */

type Rec = Record<string, unknown>;
export interface MergeNode { id: string; pageId?: string; from?: { selector?: string } | null; byHand?: boolean; work?: unknown; label?: unknown }
export interface MergeDoc<N extends MergeNode = MergeNode> { nodes: N[]; format?: object; brief?: object; look?: object }

/** The board as it was brought in: each part's facets and the document's, as hashes. */
export interface Taken {
  v: 1;
  /** When it was recorded, and from what (repository@commit), for the note. */
  at?: number;
  from?: string | null;
  nodes: Record<string, Record<string, string>>;
  doc: Record<string, string>;
}

/** What the merge did, for the line it says. */
export interface Kept {
  /** Parts where something of the owner's stood over the new capture: the part, and which facets. */
  edited: { id: string; label: string; facets: string[] }[];
  /** Parts he added, kept. */
  added: string[];
  /** Captured parts he had deleted, left deleted. */
  stayDeleted: number;
  /** Parts the new capture no longer has, gone with it. */
  gone: number;
  /** Parts the new capture has that the old did not. */
  fresh: number;
  /** Facets of the document itself (format, brief, look) kept. */
  doc: string[];
  /** How the owner's changes were told apart. */
  by: "record" | "careful";
}

/* ------------------------------------------------------------------ */
/* Facets and their hashes                                             */
/* ------------------------------------------------------------------ */

/** Never a facet: who the part is, and where it was read from, are how it is matched. */
const SKIP = new Set(["id", "pageId", "from"]);
/** Object fields merged key by key: the owner can change a fill and the capture a font. */
const DEEP = new Set(["options", "colour", "font", "art", "text", "layout", "edge", "pad", "motion", "picture", "link"]);

const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
/** Nothing there: not stored, and equal to any other nothing. */
const empty = (v: unknown) => v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && !v.length) || (isRec(v) && !Object.keys(v).length);

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isRec(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null) ?? "null";
}
/** A value's fingerprint: FNV-1a over its stable JSON, base 36. Nothing is "". */
export function print(v: unknown): string {
  if (empty(v)) return "";
  const s = stable(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(36)}${(s.length % 1296).toString(36)}`;
}

interface Use { id: string; inputs?: Record<string, string>; off?: boolean; also?: Use[] }
function uses(work: unknown): Use[] {
  if (!isRec(work) || typeof work.id !== "string") return [];
  const w = work as unknown as Use;
  return [w, ...(Array.isArray(w.also) ? w.also : [])].map((u) => ({ id: u.id, inputs: isRec(u.inputs) ? (u.inputs as Record<string, string>) : {}, ...(u.off ? { off: true } : {}) }));
}
function stackUses(list: Use[]): Use | null {
  const [first, ...rest] = list;
  if (!first) return null;
  return rest.length ? { ...first, also: rest } : first;
}

/** A part as its facets: path → value. */
export function facets(n: MergeNode): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [k, v] of Object.entries(n as object)) {
    if (SKIP.has(k) || v === undefined) continue;
    if (k === "work") {
      for (const u of uses(v)) {
        out.set(`work/${u.id}`, true);
        if (u.off) out.set(`work/${u.id}/off`, true);
        for (const [i, x] of Object.entries(u.inputs ?? {})) out.set(`work/${u.id}/${i}`, x);
      }
      continue;
    }
    if (DEEP.has(k) && isRec(v)) { for (const [s, x] of Object.entries(v)) if (x !== undefined) out.set(`${k}.${s}`, x); continue; }
    out.set(k, v);
  }
  return out;
}

/** The part back from its facets; `shape` is a node whose field shapes are known (the new one, else the board's). */
function unfacet(base: MergeNode, f: Map<string, unknown>): MergeNode {
  const b = base as MergeNode & Rec;
  const out: MergeNode & Rec = { id: base.id, ...(base.pageId !== undefined ? { pageId: base.pageId } : {}), ...(base.from !== undefined ? { from: base.from } : {}) };
  const deep: Record<string, Rec> = {};
  const work = new Map<string, Use>();
  const order: string[] = [];
  for (const [p, v] of f) {
    if (p.startsWith("work/")) {
      const [, id, input] = p.split("/");
      if (!id) continue;
      if (!work.has(id)) { work.set(id, { id, inputs: {} }); order.push(id); }
      const u = work.get(id)!;
      if (input === "off") { if (v) u.off = true; } else if (input !== undefined) u.inputs![input] = String(v);
      continue;
    }
    const dot = p.indexOf(".");
    if (dot > 0 && DEEP.has(p.slice(0, dot))) { (deep[p.slice(0, dot)] ??= {})[p.slice(dot + 1)] = v; continue; }
    out[p] = v;
  }
  for (const k of Object.keys(deep)) out[k] = deep[k];
  /* A DEEP field the part had as null or with nothing in it stays so, rather than vanishing. */
  /* A DEEP field the part had as null, or empty, stays so rather than vanishing. */
  for (const k of DEEP) if (!(k in out) && k in b) out[k] = isRec(b[k]) ? {} : b[k];
  out.work = stackUses(order.map((id) => work.get(id)!).filter((u) => f.get(`work/${u.id}`) === true));
  if (out.work === null && !("work" in b)) delete out.work;
  /* In the part's own field order, so it reads (and serialises) as it came. */
  const ordered: Rec = {};
  for (const k of Object.keys(b)) if (k in out) ordered[k] = out[k];
  for (const k of Object.keys(out)) if (!(k in ordered)) ordered[k] = out[k];
  return ordered as unknown as MergeNode;
}

/* ------------------------------------------------------------------ */
/* Matching parts across two documents                                 */
/* ------------------------------------------------------------------ */

/** Each part's key: its page and the element it was read from, numbered when two share one; a part drawn by hand by its id. */
export function keysOf(nodes: readonly MergeNode[]): string[] {
  const seen = new Map<string, number>();
  return nodes.map((n) => {
    const sel = n.from?.selector?.trim();
    if (!sel) return `#${n.id}`;
    const k = `${n.pageId ?? ""}|${sel}`;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    return i ? `${k}~${i}` : k;
  });
}

const DOC_PARTS = ["format", "brief", "look"] as const;
function docFacets(d: Partial<MergeDoc>): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const part of DOC_PARTS) { const o = d[part]; if (isRec(o)) for (const [k, v] of Object.entries(o)) if (v !== undefined) out.set(`${part}.${k}`, v); }
  return out;
}

/** The board as brought in, recorded. */
export function fingerprint(doc: MergeDoc, from: string | null = null, at = Date.now()): Taken {
  const keys = keysOf(doc.nodes);
  const nodes: Taken["nodes"] = {};
  doc.nodes.forEach((n, i) => {
    const rec: Record<string, string> = {};
    for (const [p, v] of facets(n)) { const h = print(v); if (h) rec[p] = h; }
    nodes[keys[i]!] = rec;
  });
  const d: Record<string, string> = {};
  for (const [p, v] of docFacets(doc)) { const h = print(v); if (h) d[p] = h; }
  return { v: 1, at, from, nodes, doc: d };
}

/** Is this a record the merge can read? */
export function isTaken(v: unknown): v is Taken {
  return isRec(v) && v.v === 1 && isRec(v.nodes) && isRec(v.doc);
}

/* ------------------------------------------------------------------ */
/* The merge                                                           */
/* ------------------------------------------------------------------ */

/** With no record: the facets the owner alone writes, or that are his once he has moved the part. */
function carefulEdited(p: string, board: MergeNode, v: unknown, next: unknown): boolean {
  if (p.startsWith("work/")) return !empty(v) && print(v) !== print(next);
  if (p === "x" || p === "y" || p === "w" || p === "h" || p === "byHand") return !!board.byHand && print(v) !== print(next);
  if (p === "prompt" || p === "locked" || p === "priority" || p === "groupId") return !empty(v) && print(v) !== print(next);
  return false;
}

/**
 * The new document laid over the board, the owner's changes kept.
 * `taken` is the record of the board as brought in, or null for the careful
 * merge. The new document is as imported (attached, swept, its palette
 * landed); what comes back is the document to load.
 */
export function keepOwnerEdits<N extends MergeNode>(board: MergeDoc<N>, taken: Taken | null, next: MergeDoc<N>): { doc: MergeDoc<N>; kept: Kept } {
  const kept: Kept = { edited: [], added: [], stayDeleted: 0, gone: 0, fresh: 0, doc: [], by: taken ? "record" : "careful" };
  const bKeys = keysOf(board.nodes), nKeys = keysOf(next.nodes);
  const onBoard = new Map(board.nodes.map((n, i) => [bKeys[i]!, n]));
  const inNext = new Set(nKeys);
  const ids = new Set<string>();
  const out: N[] = [];
  const edited = (key: string, p: string, n: MergeNode, v: unknown, nv: unknown) =>
    taken ? print(v) !== (taken.nodes[key]?.[p] ?? "") : carefulEdited(p, n, v, nv);

  next.nodes.forEach((nn, i) => {
    const key = nKeys[i]!;
    const bn = onBoard.get(key);
    if (!bn) {
      /* Recorded, and not on the board: he deleted it. With no record, a part that is new to him is simply new. */
      if (taken && taken.nodes[key]) { kept.stayDeleted++; return; }
      kept.fresh++;
      out.push(nn as N); ids.add(nn.id);
      return;
    }
    const bf = facets(bn), nf = facets(nn);
    const merged = new Map(nf);
    const mine: string[] = [];
    for (const p of new Set([...bf.keys(), ...nf.keys(), ...(taken ? Object.keys(taken.nodes[key] ?? {}) : [])])) {
      const v = bf.get(p);
      if (!edited(key, p, bn, v, nf.get(p))) continue;
      if (print(v) === print(nf.get(p))) continue;
      if (empty(v)) merged.delete(p); else merged.set(p, v);
      mine.push(p);
    }
    /* A feature he kept switched on stays on even where the new capture dropped it; one he took off stays off. */
    for (const p of mine) if (p.startsWith("work/") && p.split("/").length === 3 && merged.has(p)) merged.set(`work/${p.split("/")[1]}`, true);
    /* The board's id stands, so everything that names the part (a group, a thread, a feature's list of parts) still does. */
    const node = unfacet({ ...nn, id: bn.id }, merged) as unknown as N;
    if (mine.length) kept.edited.push({ id: bn.id, label: String(bn.label ?? nn.label ?? bn.id), facets: mine });
    out.push(node); ids.add(node.id);
  });

  /* On the board and not in the new document: his own, or captured and gone from the capture. */
  board.nodes.forEach((bn, i) => {
    const key = bKeys[i]!;
    if (inNext.has(key)) return;
    const his = taken ? !taken.nodes[key] : !bn.from?.selector;
    const changed = taken
      ? [...facets(bn)].some(([p, v]) => print(v) !== (taken.nodes[key]?.[p] ?? "")) || Object.keys(taken.nodes[key] ?? {}).some((p) => !facets(bn).has(p))
      : !!bn.byHand;
    if (his || changed) {
      if (ids.has(bn.id)) return;
      if (his) kept.added.push(bn.id);
      else kept.edited.push({ id: bn.id, label: String(bn.label ?? bn.id), facets: ["(the new capture has no such part)"] });
      out.push(bn); ids.add(bn.id);
      return;
    }
    kept.gone++;
  });

  /* The document's own: its format, brief and look, key by key. */
  const bd = docFacets(board), nd = docFacets(next);
  const doc: Rec = {};
  for (const part of DOC_PARTS) if (isRec(next[part]) || isRec(board[part])) doc[part] = { ...((next[part] as Rec | undefined) ?? {}) };
  for (const p of new Set([...bd.keys(), ...nd.keys()])) {
    const v = bd.get(p);
    const his = taken ? print(v) !== (taken.doc[p] ?? "") : p.startsWith("format.") || p.startsWith("brief.");
    if (!his || print(v) === print(nd.get(p))) continue;
    const [part, ...rest] = p.split(".");
    const k = rest.join(".");
    const o = (doc[part!] ??= {}) as Rec;
    if (v === undefined) delete o[k]; else o[k] = v;
    kept.doc.push(p);
  }
  return { doc: { ...next, ...doc, nodes: out } as MergeDoc<N>, kept };
}

/** One line saying what was kept, for the import's toast and strip. */
export function keptSays(k: Kept): string {
  const parts: string[] = [];
  if (k.edited.length) {
    const named = k.edited.slice(0, 4).map((e) => `${e.label} (${e.facets.slice(0, 3).map((f) => f.replace(/^work\//, "").replace(/\//g, " ")).join(", ")}${e.facets.length > 3 ? ", …" : ""})`).join("; ");
    parts.push(`kept your changes on ${k.edited.length} part${k.edited.length === 1 ? "" : "s"}: ${named}${k.edited.length > 4 ? `, and ${k.edited.length - 4} more` : ""}`);
  }
  if (k.added.length) parts.push(`kept ${k.added.length} part${k.added.length === 1 ? "" : "s"} you added`);
  if (k.stayDeleted) parts.push(`left ${k.stayDeleted} part${k.stayDeleted === 1 ? "" : "s"} you deleted deleted`);
  if (k.doc.length) parts.push(`kept your ${[...new Set(k.doc.map((d) => d.split(".")[0]))].join(", ")} settings (${k.doc.length})`);
  if (k.fresh) parts.push(`${k.fresh} part${k.fresh === 1 ? " is" : "s are"} new in this capture`);
  if (k.gone) parts.push(`${k.gone} the new capture no longer has ${k.gone === 1 ? "is" : "are"} gone`);
  const how = k.by === "record" ? "" : " (no record of the board as first brought in, so only moved parts, feature settings, prompts and locks were told apart as yours)";
  return parts.length ? `${parts.join("; ")}${how}.` : `nothing on the board had been changed by hand${how}.`;
}
