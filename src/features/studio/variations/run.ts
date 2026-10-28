"use client";
/**
 * MAKING, KEEPING AND THROWING AWAY VARIATIONS, in this browser.
 *
 * Every variation is a site of its own in Builds, a Duplicate of the
 * original (`versionOf`), written straight into its own slot without the
 * Builder opening it. The original is read, never written, and its board is
 * never touched: not by a take, not by a token, not by a move.
 *
 *   makeVariations   a batch: rolled locally (free, instant), or one Claude
 *                    call that returns several specs at once
 *   again            the shown variation rolled again: locked layers kept,
 *                    the rest re-rolled, written over the same site
 *   keep             it stays as a site (it already is one); opened
 *   discard          the site and its record go
 *   acceptWord       one of Claude's word suggestions put in
 *
 * Each variation's System goes into the shared library, as its own System:
 * a token of it can be changed later in the System tab like any other site's.
 */
import { useBuilds, type Project } from "@/features/builds/store";
import { readDoc, unpackDocText, writeDocNow } from "../docStore";
import { resolvePalette } from "../shelf/run";
import { useSystems } from "../system/store";
import type { FormatValues } from "../format";
import type { Look } from "../look";
import { keyHeader } from "../loop/agent";
import { build, prepare, type Prepared, type VarDoc } from "./make";
import { directionName, emptySpec, rollSpec, type Aim, type Layer, type Variation } from "./model";
import { useVariations } from "./store";
import type { BetterVariant } from "../better/prompt";
import { askFor } from "./ask";

const LIVE = "builder.studio";
const slot = (id: string) => `builder.doc:${id}`;

type Envelope = { state: VarDoc & { format?: FormatValues; look?: Look }; version?: number };

/** A site's stored document, the open one read from the live key. */
async function readEnvelope(id: string): Promise<Envelope | null> {
  const active = useBuilds.getState().activeId === id;
  const raw = await readDoc(active ? LIVE : slot(id));
  if (!raw) return null;
  try {
    const env = JSON.parse(unpackDocText(raw)) as Envelope;
    return env?.state && Array.isArray(env.state.nodes) ? env : null;
  } catch {
    return null;
  }
}

const prepared = new Map<string, { at: number; p: Prepared; version: number }>();

/** The original, its System taken once (kept for the session, taken again when the original has changed since). */
export async function original(of: string): Promise<{ p: Prepared; version: number } | null> {
  const proj = useBuilds.getState().projects.find((x) => x.id === of);
  if (!proj) return null;
  const at = proj.editedAt ?? proj.updatedAt;
  const had = prepared.get(of);
  if (had && had.at === at) return had;
  const env = await readEnvelope(of);
  if (!env) return null;
  const palette = resolvePalette((env.state.format ?? {}) as FormatValues, env.state.look as Look | undefined);
  const p = prepare(env.state, palette, { name: proj.name });
  const got = { at, p, version: env.version ?? 0 };
  prepared.set(of, got);
  return got;
}

const nameFor = (from: Project, n: number) => `${from.name}, variation ${n}`;

/** Write one variation's document into a site's slot: a new site, or over `into`. */
async function writeOne(of: string, v: Variation, o: { into?: string; n: number }): Promise<string | null> {
  const got = await original(of);
  const from = useBuilds.getState().projects.find((x) => x.id === of);
  if (!got || !from) return null;
  const accepted = (v.words ?? []).filter((w) => v.accepted?.includes(w.id));
  const made = build(got.p, v.spec, { name: nameFor(from, o.n), words: accepted });
  const raw = JSON.stringify({ state: made.doc, version: got.version });
  useSystems.getState().put(made.system);
  let id = o.into ?? null;
  if (id) {
    await writeDocNow(slot(id), raw);
    useBuilds.setState((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)) }));
  } else {
    const copy: Omit<Project, "id"> = {
      ...from, name: nameFor(from, o.n), updatedAt: Date.now(), versionOf: { project: from.id, made: Date.now() },
      live: undefined, pending: undefined, published: undefined, repo: undefined, bound: undefined, backedUpAt: undefined, nudged: undefined,
    } as Omit<Project, "id">;
    delete (copy as { id?: string }).id;
    id = await useBuilds.getState().restore(copy, raw);
  }
  useVariations.getState().put(id, v);
  return id;
}

/** How many variations of `of` there are already: the next one's number. */
const nextNumber = (of: string) => {
  const from = useBuilds.getState().projects.find((p) => p.id === of);
  const nums = useBuilds.getState().projects.filter((p) => p.versionOf?.project === of).map((p) => Number(/variation (\d+)$/.exec(p.name)?.[1]) || 0);
  return from ? 1 + Math.max(0, ...nums) : 1;
};

export interface MakeOptions {
  of: string;
  count: number;
  aims: Aim[];
  locks?: Layer[];
  /** The variation whose locked layers are kept. */
  from?: Variation | null;
  like?: string | null;
  /** Ask Claude for the specs (one call, several at once) rather than rolling them here. */
  claude?: boolean;
  seed?: number;
}

export type MakeResult = { ok: true; ids: string[]; note?: string } | { ok: false; says: string };

/** A seed: anything, as long as two batches in a row differ. */
const newSeed = () => (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0;

export async function makeVariations(o: MakeOptions): Promise<MakeResult> {
  await useBuilds.getState().save();
  const got = await original(o.of);
  if (!got) return { ok: false, says: "That site's document could not be read." };
  const base = o.seed ?? newSeed();
  let specs: { v: Omit<Variation, "of" | "made"> }[] = [];
  if (o.claude) {
    const asked = await askClaude(o, got.p);
    if (!asked.ok) return asked;
    specs = asked.variants.map((x) => {
      /* Locked layers stay as the variation they were locked on has them; Claude's choice fills the rest. */
      const spec = { ...x.spec };
      for (const l of o.locks ?? []) if (o.from) (spec as Record<Layer, unknown>)[l] = o.from.spec[l];
      return { v: { spec, seeds: { colours: null, type: null, space: null, layout: null, order: null, motion: null, ...(o.from ? Object.fromEntries((o.locks ?? []).map((l) => [l, o.from!.seeds[l]])) : {}) }, aims: o.aims, locks: o.locks ?? [], by: "claude" as const, name: x.name || directionName(spec), note: x.note, like: o.like ?? null, words: x.words, accepted: [] } };
    });
  } else {
    for (let i = 0; i < Math.max(1, Math.min(8, o.count)); i++) {
      const r = rollSpec({ seed: base + i * 104729, aims: o.aims, shape: got.p.shape, prev: o.from ?? null, locks: o.locks });
      specs.push({ v: { spec: r.spec, seeds: r.seeds, aims: o.aims, locks: o.locks ?? [], by: "local", name: directionName(r.spec), like: o.like ?? null, words: [], accepted: [] } });
    }
  }
  const ids: string[] = [];
  let n = nextNumber(o.of);
  for (const s of specs) {
    const id = await writeOne(o.of, { ...s.v, of: o.of, made: Date.now() }, { n: n++ });
    if (id) ids.push(id);
  }
  return ids.length ? { ok: true, ids } : { ok: false, says: "No variation could be written. The browser's storage may be full." };
}

/** The shown variation rolled again: its locked layers kept, the rest new. Written over the same site. */
export async function again(id: string, locks: Layer[], seed = newSeed()): Promise<MakeResult> {
  const v = useVariations.getState().byId[id];
  if (!v) return { ok: false, says: "That is not a variation this browser made." };
  const got = await original(v.of);
  if (!got) return { ok: false, says: "The original's document could not be read." };
  const r = rollSpec({ seed, aims: v.aims, shape: got.p.shape, prev: v, locks });
  const name = useBuilds.getState().projects.find((p) => p.id === id)?.name ?? "";
  const n = Number(/variation (\d+)$/.exec(name)?.[1]) || nextNumber(v.of);
  /* Words he accepted stay, where the part still says what they replaced. */
  const next: Variation = { ...v, spec: r.spec, seeds: r.seeds, locks, by: "local", name: directionName(r.spec), note: null, made: Date.now() };
  await writeOne(v.of, next, { into: id, n });
  return { ok: true, ids: [id] };
}

/** It stays: a site like any other now. Opened in the Builder. */
export async function keep(id: string): Promise<void> {
  useVariations.getState().drop(id);
  await useBuilds.getState().open(id);
}

export async function discard(id: string): Promise<void> {
  useVariations.getState().drop(id);
  await useBuilds.getState().remove(id);
}

/** One word suggestion put in (or taken out again). */
export async function acceptWord(id: string, wordId: string, on = true): Promise<void> {
  const v = useVariations.getState().byId[id];
  if (!v) return;
  const accepted = on ? [...new Set([...(v.accepted ?? []), wordId])] : (v.accepted ?? []).filter((x) => x !== wordId);
  const name = useBuilds.getState().projects.find((p) => p.id === id)?.name ?? "";
  await writeOne(v.of, { ...v, accepted }, { into: id, n: Number(/variation (\d+)$/.exec(name)?.[1]) || 1 });
}

/* ------------------------------------------------------------------ */
/* Claude                                                               */
/* ------------------------------------------------------------------ */

/** Pictures of the original's pages, from the server's browser (the screenshot route), at most `limit`. */
async function pictures(p: Prepared, limit: number): Promise<{ data: string; label: string }[]> {
  const out: { data: string; label: string }[] = [];
  const pages = (p.doc.pages ?? []) as { id: string; name?: string; path?: string }[];
  for (const page of pages.slice(0, limit)) {
    try {
      const res = await fetch("/api/studio/screenshot", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ doc: { ...p.doc, activePageId: page.id }, path: "/builder/preview" + (!page.path || page.path === "/" ? "" : page.path), device: "desktop", width: 1280 }),
      });
      if (!(res.headers.get("content-type") ?? "").startsWith("image/")) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      out.push({ data: btoa(bin), label: `Page "${page.name ?? page.id}", desktop width:` });
    } catch { /* a page the server could not photograph is left out */ }
  }
  return out;
}

async function askClaude(o: MakeOptions, p: Prepared): Promise<{ ok: true; variants: BetterVariant[] } | { ok: false; says: string }> {
  const name = useBuilds.getState().projects.find((x) => x.id === o.of)?.name ?? "the site";
  const ask = askFor(p, { aims: o.aims, like: o.like, count: o.count, locks: o.locks }, name);
  const shots = await pictures(p, 3);
  try {
    const res = await fetch("/api/studio/better", { method: "POST", headers: { "content-type": "application/json", ...keyHeader() }, body: JSON.stringify({ ask, pictures: shots, shape: p.shape }) });
    const data = (await res.json()) as { ok: boolean; variants?: BetterVariant[]; message?: string };
    if (!data.ok || !data.variants?.length) return { ok: false, says: data.message ?? "Claude gave no variations." };
    /* Read again here: the route reads them strictly, and so does this side. */
    return { ok: true, variants: data.variants.map((x) => ({ name: String(x.name ?? ""), note: String(x.note ?? ""), spec: { ...emptySpec(), ...x.spec }, words: Array.isArray(x.words) ? x.words : [] })) };
  } catch (e) {
    return { ok: false, says: `The call did not go through (${e instanceof Error ? e.message : "no answer"}).` };
  }
}
