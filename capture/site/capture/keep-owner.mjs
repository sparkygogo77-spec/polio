#!/usr/bin/env node
/**
 * A SITE TAKEN AGAIN KEEPS WHAT ITS OWNER SET ON ITS DOCUMENT.
 *
 * A document here is the converter's, and then sometimes the owner's: on
 * trumpmorty.fun's he set both ribbons' words to run centred in their band
 * at 36px and 42px (`node.work`, polio's marquee "Centre in its band" and
 * "Text size", b587d89). Taking the site again wrote a new document over
 * it, and his settings went with the old one. So trumpmorty.fun was never
 * taken again, and kept every fault the capture has since lost.
 *
 * What the converter never writes is his: a feature on a part (`work`), a
 * part he placed by hand (`byHand`, and then its box), a lock, a part with
 * no element behind it (drawn on the board). A prompt is not among them: the
 * converter writes one on every part. Each is carried from
 * the document as it was onto the new one, part by part, matched by page
 * and element (the same key polio's re-import uses, `reimport.ts`); a
 * feature's settings stand over any the new document gives it. Nothing the
 * converter writes is touched, so every fix the capture made reaches the
 * new document.
 *
 *   node capture/site/capture/keep-owner.mjs <document as it was> <new document> [--write]
 *
 * Prints what it carried; `--write` writes the new document with it.
 * `capture-site.mjs` runs it on every site it takes again.
 */
import { readFileSync, writeFileSync } from "node:fs";

const isRec = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const empty = (v) => v === undefined || v === null || v === "" || v === false;

/** Each part's key: its page and element, numbered when two share one; a drawn part by its id. */
export function keysOf(nodes) {
  const seen = new Map();
  return nodes.map((n) => {
    const sel = n.from?.selector?.trim();
    if (!sel) return `#${n.id}`;
    const k = `${n.pageId ?? ""}|${sel}`;
    const i = seen.get(k) ?? 0;
    seen.set(k, i + 1);
    return i ? `${k}~${i}` : k;
  });
}

const uses = (w) => (isRec(w) && typeof w.id === "string" ? [w, ...(Array.isArray(w.also) ? w.also : [])].map((u) => ({ id: u.id, inputs: isRec(u.inputs) ? u.inputs : {}, ...(u.off ? { off: true } : {}) })) : []);
const stack = (list) => { const [first, ...rest] = list; return first ? (rest.length ? { ...first, also: rest } : first) : null; };

/** The new document with the owner's own fields carried from the old one. */
export function keepOwner(old, next) {
  const kept = [];
  const oldKeys = keysOf(old.nodes ?? []), newKeys = keysOf(next.nodes ?? []);
  const byKey = new Map((old.nodes ?? []).map((n, i) => [oldKeys[i], n]));
  const nodes = (next.nodes ?? []).map((n, i) => {
    const was = byKey.get(newKeys[i]);
    if (!was) return n;
    const out = { ...n };
    const what = [];
    /* A feature's settings: his over the new document's, key by key. */
    const mine = uses(was.work);
    if (mine.length) {
      const theirs = uses(n.work);
      const merged = theirs.map((u) => { const h = mine.find((m) => m.id === u.id); return h ? { ...u, inputs: { ...u.inputs, ...h.inputs }, ...(h.off ? { off: true } : {}) } : u; });
      for (const h of mine) if (!merged.some((u) => u.id === h.id)) merged.push(h);
      out.work = stack(merged);
      what.push(...mine.map((u) => `${u.id} ${Object.entries(u.inputs).map(([k, v]) => `${k}=${v}`).join(" ")}`.trim()));
    }
    if (was.byHand) { for (const k of ["x", "y", "w", "h"]) if (was[k] !== undefined) out[k] = was[k]; out.byHand = true; what.push("placed by hand"); }
    for (const k of ["locked"]) if (!empty(was[k]) && was[k] !== n[k]) { out[k] = was[k]; what.push(k); }
    if (what.length) kept.push({ id: n.id, selector: n.from?.selector ?? null, what });
    return out;
  });
  /* A part drawn on the board, with no element behind it: his, kept. */
  const drawn = (old.nodes ?? []).filter((n, i) => oldKeys[i].startsWith("#") && !(next.nodes ?? []).some((m) => m.id === n.id));
  for (const n of drawn) kept.push({ id: n.id, selector: null, what: ["drawn on the board"] });
  return { doc: { ...next, nodes: [...nodes, ...drawn] }, kept };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [oldPath, newPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!oldPath || !newPath) { console.error("usage: node capture/site/capture/keep-owner.mjs <document as it was> <new document> [--write]"); process.exit(2); }
  const { doc, kept } = keepOwner(JSON.parse(readFileSync(oldPath, "utf8")), JSON.parse(readFileSync(newPath, "utf8")));
  for (const k of kept) console.log(`kept on ${k.id}${k.selector ? ` (${k.selector})` : ""}: ${k.what.join("; ")}`);
  if (!kept.length) console.log("nothing of the owner's to keep");
  if (process.argv.includes("--write")) writeFileSync(newPath, JSON.stringify(doc, null, 2) + "\n");
}
