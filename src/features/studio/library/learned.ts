/**
 * THE LEARNED LIBRARY: WHAT EVERY IMPORTED SITE TAUGHT THE BUILDER.
 *
 * THE OWNER'S ASK: "it needs to learn and categorize from every site
 * imported." Each import (or re-import) of a capture is read for what can
 * be used again on any other board, and kept builder-wide, not in that
 * board:
 *
 *   · its versions of shelf items: the library features sink's behaviours
 *     attached (marquee, blink, reveal, tilt, copy, dust, …), its embeds,
 *     and the stylesheet motion that is the site's own Spin, Float, Blink
 *     or Lift on hover (`siteVersions.ts`). Filed under the shelf item each
 *     is a version of, so the same effect is one item and each site's look
 *     is a variation of it ("Trorty version"), with the settings measured
 *     on that site as its editable options;
 *   · its style kits and its motions (`styleKits.ts`), so a drawn shape on
 *     any board can wear them;
 *   · its font pairing, with the font files, and its palette as painted.
 *
 * Nothing that would do nothing on another board is kept: a feature tied
 * to that site's own parts (what a press shows, where a link glides to), a
 * motion whose keyframes were not captured, an effect with no working
 * feature behind it. Each of those is listed as skipped, with why.
 *
 * Re-importing a site replaces its entry; removing a board leaves it, and
 * forgetting a site is the person's choice. The library is one versioned
 * record (`LEARNED_KIND`, `LEARNED_VERSION`) so a backup carries it and a
 * later home on a server can read it.
 *
 * Pure: no store, no browser. `tests/learned-library.mjs` reads every
 * capture in sink through it.
 */
import { siteVersions, type SiteVersion } from "./siteVersions.ts";
import { getWork } from "./works.ts";
import { kitsFromDoc, motionsFromDoc, siteShortName, type BoardMotion, type KitDoc, type StyleKit } from "../look/index.ts";
import { SHELF_GROUPS } from "../shelfGroups.ts";
import { statusOf, type Status } from "../shelfFacts.ts";
import { readSiteFormat } from "../siteFormat.ts";
import { paintedPalette, type PaintedPart } from "../shelfTheme.ts";
import type { SavedComponent } from "./components.ts";

export const LEARNED_KIND = "polio-learned-library";
export const LEARNED_VERSION = 1;

interface Frames { name: string; frames: { key: string; style: Record<string, string> }[] }

/** One site's version of a shelf item, as kept: what taking it puts on a part, and what it needs to work there. */
export interface LearnedVersion {
  /** The shelf item it is a version of (a catalogue id or `work:<id>`). */
  item: string;
  take: SiteVersion["take"];
  /** The keyframes a motion names, carried so it moves on a board that never had them. */
  frames?: Frames[];
  /** "Trorty version". */
  label: string;
  /** The shelf category it is filed in ("motion"), and the group in it ("Moves on its own"). */
  category: string;
  group: string;
  /** The badge, true of it: works when published, needs a build, needs a key or a backend. */
  status: Status;
  /** How many parts on the site carried it. */
  parts: number;
}

export interface LearnedFont { family: string; weight?: string; style?: string; source?: unknown; from?: unknown; id?: string }

export interface LearnedSite {
  host: string;
  /** The site's short name ("Trorty") and its full one. */
  name: string;
  title: string;
  /** When it was last learned, ms. */
  at: number;
  versions: LearnedVersion[];
  kits: StyleKit[];
  motions: BoardMotion[];
  fonts: { heading: string | null; body: string | null; files: LearnedFont[] };
  palette: { bg: string; surface: string; text: string; muted: string; accent: string; highlight: string } | null;
  skipped: { what: string; why: string }[];
}

export interface LearnedLibrary {
  kind: typeof LEARNED_KIND;
  version: number;
  sites: Record<string, LearnedSite>;
  /** Things the person saved whole (the TV, a styled button): `components.ts`. Kept beside the sites, never forgotten with one. */
  components?: SavedComponent[];
}

export const emptyLibrary = (): LearnedLibrary => ({ kind: LEARNED_KIND, version: LEARNED_VERSION, sites: {} });

/** A board as the import left it: parts with their features attached, its look, its brief. */
export interface LearnBoard {
  nodes: readonly Record<string, unknown>[];
  look?: { palette?: Record<string, string | undefined>; keyframes?: readonly Frames[]; fonts?: readonly LearnedFont[] } | null;
  brief?: { name?: string } | null;
  pages?: readonly { id: string }[];
}

/** The shelf category and group an item is filed in, read off the shelf's own plan. */
export function placeOf(item: string): { category: string; group: string } | null {
  for (const [category, groups] of Object.entries(SHELF_GROUPS) as [string, { label: string; items: readonly string[] }[]][]) {
    for (const g of groups) if (g.items.includes(item)) return { category, group: g.label };
  }
  return null;
}

/** A part id from the site it came from, inside a feature's settings: that feature means nothing on another board. */
const PART_ID = /\bn_[a-z]+_\d+\b/;
/** Features that read data only the site's own part carries (a canvas world's characters): nothing to run on another board. */
const NEEDS_ITS_PART = new Set(["world-dialogs"]);
/**
 * A use as it can travel: a setting naming the site's parts is dropped when
 * the feature does its job without it (an advanced one, or what it
 * "Carries" along: a tilt still tilts, a header bar still changes), and
 * the use is tied (null) when the part ids are its point (what a press
 * shows, where a link goes) or it reads data only that part has.
 */
function travelling(u: { id: string; inputs?: Record<string, string> }): { id: string; inputs: Record<string, string> } | null {
  if (NEEDS_ITS_PART.has(u.id)) return null;
  const spec = getWork(u.id)?.manifest.inputs ?? [];
  const inputs: Record<string, string> = {};
  for (const [k, v] of Object.entries(u.inputs ?? {})) {
    if (!PART_ID.test(String(v))) { inputs[k] = v; continue; }
    const i = spec.find((x) => x.id === k);
    if (i && (i.advanced || /^carries\b/i.test(i.label))) continue;
    return null;
  }
  return { id: u.id, inputs };
}
const tied = (u: { id: string; inputs?: Record<string, string> }) => travelling(u) === null;

/** What a site's parts carried that nothing else turns into a feature: behaviours sink recorded, by group. */
const GROUP_GIVES: Record<string, string[]> = {
  reveal: ["reveal"], intro: ["reveal"], scrollClass: ["scroll-header"], pointer: ["follow-pointer", "tilt"], loops: ["marquee"],
  idle: ["blink", "spin", "float"], loader: ["crt-loader"], states: ["press-shows"], presses: ["copy-toast"], glide: ["glide"],
  worlds: ["world-dialogs"],
};
const GROUP_WORDS: Record<string, string> = {
  reveal: "Reveal on scroll", intro: "The opening animation", scrollClass: "The header changing on scroll", pointer: "Things following the pointer",
  loops: "Ribbons and tickers", idle: "Loops that run on their own", loader: "The loading screen", states: "What a press shows",
  presses: "What a press copies", glide: "How a link scrolls to its place", worlds: "A canvas world's characters",
};

/**
 * What one imported board teaches: its versions of shelf items, its kits,
 * its motions, its fonts and palette, and what was skipped and why. Null
 * for a board that was not brought in from a site.
 */
export function learnFromBoard(board: LearnBoard, behaviours?: Record<string, unknown> | null, now = Date.now()): LearnedSite | null {
  const nodes = board.nodes as readonly ({ id: string; from?: { host?: string } | null; work?: unknown; pageId?: string } & Record<string, unknown>)[];
  const host = nodes.find((n) => n.from?.host)?.from?.host ?? null;
  if (!host) return null;
  const title = board.brief?.name?.trim() || host;
  const name = siteShortName(title, host);
  const frames = (board.look?.keyframes ?? []) as Frames[];
  const byName = new Map<string, Frames>();
  for (const k of frames) { byName.set(k.name, k); byName.set(`cap-${k.name}`, k); }
  const skipped: { what: string; why: string }[] = [];

  /* ---------------------------------------------------------------- versions of shelf items */
  const versions: LearnedVersion[] = [];
  const counts = new Map<string, number>();
  /*
   * A feature tied to the site's own parts is set aside before the versions
   * are read, so an item the site also carries cleanly elsewhere (the
   * cards' tilt beside the TV's) is learned from the clean one; an item
   * with only tied versions is listed as skipped.
   */
  const tiedOnly = new Map<string, string>();
  const clean = nodes.map((n) => {
    const uses = [n.work as { id: string; inputs?: Record<string, string>; also?: unknown[] } | null | undefined].filter(Boolean).flatMap((w) => [w!, ...((w!.also ?? []) as { id: string; inputs?: Record<string, string> }[])]);
    if (!uses.some((u) => tied(u) || JSON.stringify(travelling(u)?.inputs) !== JSON.stringify(u.inputs ?? {}))) return n;
    for (const u of uses) if (tied(u)) tiedOnly.set(u.id, getWork(u.id)?.manifest.name ?? u.id);
    /* Each use on its own, as it can travel, without the list it was stacked in, so a tied one cannot ride back in. */
    const keep = uses.map(travelling).filter((u): u is { id: string; inputs: Record<string, string> } => !!u);
    const [first, ...also] = keep;
    return { ...n, work: first ? { ...first, ...(also.length ? { also } : {}) } : null };
  });
  for (const v of siteVersions(clean as Parameters<typeof siteVersions>[0], frames, title)) {
    if (v.host !== host) continue;
    const place = placeOf(v.item);
    const label = `${name} version`;
    const what = v.take.kind === "work" ? (getWork(v.take.id)?.manifest.name ?? v.take.id) : place?.group ? `${place.group}: ${v.item.replace(/^work:/, "")}` : v.item;
    if (!place) { skipped.push({ what, why: "it is not on the shelf, so there is nowhere to offer it" }); continue; }
    let take = v.take;
    let carried: Frames[] | undefined;
    if (take.kind === "work") {
      if (!getWork(take.id)) { skipped.push({ what, why: "no working feature in the library does it" }); continue; }
      tiedOnly.delete(take.id);
    }
    if (take.kind === "motion") {
      const names = ((take.motion as { animation?: { name: string }[] }).animation ?? []).map((a) => a.name);
      const found = names.map((n) => byName.get(n)).filter((k): k is Frames => !!k);
      if (names.length && found.length < names.length) { skipped.push({ what, why: "its keyframes were not captured, so it would not move anywhere else" }); continue; }
      if (found.length) carried = found;
      take = { kind: "motion", motion: JSON.parse(JSON.stringify(take.motion)) };
    }
    const status = take.kind === "work" ? statusOf(`work:${take.id}`, getWork(take.id)?.manifest.needs) : "works";
    if (status === "note") { skipped.push({ what, why: "it is a note for the builder, not something a page does" }); continue; }
    versions.push({ item: v.item, take, ...(carried ? { frames: carried } : {}), label, category: place.category, group: place.group, status, parts: v.parts.length });
    if (take.kind === "work") counts.set(take.id, (counts.get(take.id) ?? 0) + 1);
  }

  /* The effects that were one part's, read for any part (`effects.ts`): the screen, the switch-on, the press. */
  for (const v of effectVersions(nodes, behaviours ?? null, name)) {
    if (versions.some((x) => x.item === v.item)) continue;
    versions.push(v);
  }
  for (const what of tiedOnly.values()) skipped.push({ what, why: `it is tied to ${name}'s own parts (what it shows, hides, carries or goes to), so it would do nothing on another board` });

  /* ---------------------------------------------------------------- recorded behaviours that came to nothing */
  const attached = new Set<string>();
  for (const n of nodes) {
    const w = n.work as { id?: string; also?: { id?: string }[] } | null | undefined;
    if (w?.id) attached.add(w.id);
    for (const a of w?.also ?? []) if (a?.id) attached.add(a.id);
  }
  for (const [group, gives] of Object.entries(GROUP_GIVES)) {
    const rec = behaviours?.[group];
    const has = Array.isArray(rec) ? rec.length > 0 : !!rec && typeof rec === "object";
    if (!has) continue;
    if (!gives.some((id) => attached.has(id))) skipped.push({ what: GROUP_WORDS[group] ?? group, why: "recorded on the site, but no part could carry it as a feature" });
  }

  /* ---------------------------------------------------------------- kits and motions */
  const kitDoc: KitDoc = {
    nodes: nodes as unknown as KitDoc["nodes"],
    palette: board.look?.palette ?? null,
    name: title,
    host,
    keyframes: frames,
    behaviours: (behaviours as KitDoc["behaviours"]) ?? null,
  };
  /* The parts a kit was read from are that board's; elsewhere only its look is kept. */
  const kits = kitsFromDoc(kitDoc).map((k) => ({ ...k, from: [] as string[] }));
  const motions = motionsFromDoc(kitDoc);

  /* ---------------------------------------------------------------- fonts and palette */
  const reads = readSiteFormat({ nodes: nodes as Parameters<typeof readSiteFormat>[0]["nodes"], look: { paletteFrom: true } } as Parameters<typeof readSiteFormat>[0], board.look?.palette?.bg ?? null);
  const heading = reads["type.headingFamily"]?.shows ?? null;
  const body = reads["type.bodyFamily"]?.shows ?? null;
  const files = (board.look?.fonts ?? []).filter((f) => f.family === heading || f.family === body);
  const pageCounts = new Map<string, number>();
  for (const n of nodes) pageCounts.set(n.pageId ?? "", (pageCounts.get(n.pageId ?? "") ?? 0) + 1);
  const firstPage = board.pages?.[0]?.id ?? [...pageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const painted = paintedPalette(nodes.filter((n) => (n.pageId ?? "") === firstPage) as unknown as PaintedPart[], {}, board.look?.palette?.bg ?? null);
  const palette = painted ? { bg: painted.bg, surface: painted.surface, text: painted.text, muted: painted.muted, accent: painted.accent, highlight: painted.highlight } : null;
  if ((heading || body) && !files.length) skipped.push({ what: `The fonts ${[heading, body].filter(Boolean).join(" and ")}`, why: "the capture did not carry their files, so only their names are known" });

  return { host, name, title, at: now, versions, kits, motions, fonts: { heading, body, files }, palette, skipped };
}

/** The library with this site learned (again): a re-import replaces the site's entry whole. */
export function withSite(lib: LearnedLibrary, site: LearnedSite): LearnedLibrary {
  return { ...lib, version: LEARNED_VERSION, sites: { ...lib.sites, [site.host]: site } };
}

/** The library without a site: only ever the person's choice. */
export function withoutSite(lib: LearnedLibrary, host: string): LearnedLibrary {
  const { [host]: _gone, ...rest } = lib.sites;
  void _gone;
  /* The panels kept from it go with it (`fromSites.ts`); what the person saved by hand stays. */
  const components = (lib.components ?? []).filter((c) => !(c.auto && c.site === host));
  return { ...lib, sites: rest, ...(lib.components ? { components } : {}) };
}

/** A stored library read back, or an empty one: a newer format than this code knows is not half read. */
export function readLibrary(raw: unknown): LearnedLibrary {
  const r = raw as Partial<LearnedLibrary> | null;
  if (!r || r.kind !== LEARNED_KIND || typeof r.version !== "number" || r.version > LEARNED_VERSION || !r.sites || typeof r.sites !== "object") return emptyLibrary();
  const components = Array.isArray(r.components) ? r.components.filter((c) => c && typeof c.id === "string" && Array.isArray(c.nodes) && c.nodes.length) : [];
  return { kind: LEARNED_KIND, version: LEARNED_VERSION, sites: r.sites as Record<string, LearnedSite>, ...(components.length ? { components } : {}) };
}

/** Two libraries as one: the newer learning of each site wins (a backup brought in never rolls a site back). */
export function mergeLibraries(a: LearnedLibrary, b: LearnedLibrary): LearnedLibrary {
  const sites = { ...a.sites };
  for (const [host, s] of Object.entries(b.sites)) if (!sites[host] || (s.at ?? 0) > (sites[host]!.at ?? 0)) sites[host] = s;
  /* Saved components: one of each, the newer save winning. */
  const comps = new Map((a.components ?? []).map((c) => [c.id, c]));
  for (const c of b.components ?? []) { const was = comps.get(c.id); if (!was || (c.at ?? 0) > (was.at ?? 0)) comps.set(c.id, c); }
  return { ...emptyLibrary(), sites, ...(comps.size ? { components: [...comps.values()] } : {}) };
}

/** The library with a component saved (one of the same id replaced). */
export function withComponent(lib: LearnedLibrary, c: SavedComponent): LearnedLibrary {
  return { ...lib, components: [...(lib.components ?? []).filter((x) => x.id !== c.id), c] };
}

/** The library without a component. */
export function withoutComponent(lib: LearnedLibrary, id: string): LearnedLibrary {
  return { ...lib, components: (lib.components ?? []).filter((x) => x.id !== id) };
}

/**
 * Every site's versions, by shelf item: one item however many sites have
 * it, and one version per site. The open board's own site is left out
 * (the shelf reads that one live, off the board).
 */
export function learnedVersions(lib: LearnedLibrary, except?: string | null): Map<string, (LearnedVersion & { host: string })[]> {
  const out = new Map<string, (LearnedVersion & { host: string })[]>();
  for (const site of Object.values(lib.sites)) {
    if (except && site.host === except) continue;
    for (const v of site.versions) out.set(v.item, [...(out.get(v.item) ?? []), { ...v, host: site.host }]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The effects any part can wear, read off a site                       */
/* ------------------------------------------------------------------ */

const fnum = (v: number) => String(Math.round(v * 1000) / 1000);
const mostOf = <T,>(xs: T[]): T | null => {
  const m = new Map<string, { v: T; n: number }>();
  for (const x of xs) { const k = JSON.stringify(x); m.set(k, { v: x, n: (m.get(k)?.n ?? 0) + 1 }); }
  return [...m.values()].sort((a, b) => b.n - a.n)[0]?.v ?? null;
};

/**
 * A site's own settings for the effects any part can wear (`effects.ts`):
 *   · Screen filter, from the filter its pictures wear (stonkfun's
 *     saturate(0.8)) and the scanlines laid over them (a repeating stripe
 *     of see-through dark: trumpmorty.fun's TV), with the jitter its screen
 *     made (a sideways stepping loop on the picture);
 *   · Switch on, from the loading screen it opened with;
 *   · Push on press, from what its parts do while held down (`:active`).
 */
export function effectVersions(nodes: readonly Record<string, unknown>[], behaviours: Record<string, unknown> | null, name: string): LearnedVersion[] {
  type N = { id: string; x?: number; y?: number; w?: number; h?: number; pageId?: string; featureId?: string; picture?: unknown; art?: { filter?: string; background?: string } | null; motion?: { active?: { style?: Record<string, string> }[] } | null };
  const ns = nodes as readonly N[];
  const out: LearnedVersion[] = [];
  const label = `${name} version`;
  const put = (item: string, id: string, inputs: Record<string, string>, parts: number) => {
    const place = placeOf(item);
    if (!place || !getWork(id)) return;
    out.push({ item, take: { kind: "work", id, inputs }, label, category: place.category, group: place.group, status: statusOf(item, getWork(id)?.manifest.needs), parts });
  };

  /* Screen filter */
  const pics = ns.filter((n) => n.picture || n.featureId === "picture");
  const filters = pics.map((n) => n.art?.filter?.trim()).filter((f): f is string => !!f && !/drop-shadow/.test(f));
  const covers = (o: N, p: N) => (o.pageId === p.pageId) && (o.x ?? 0) <= (p.x ?? 0) + 4 && (o.y ?? 0) <= (p.y ?? 0) + 4 && (o.x ?? 0) + (o.w ?? 0) >= (p.x ?? 0) + (p.w ?? 0) - 4 && (o.y ?? 0) + (o.h ?? 0) >= (p.y ?? 0) + (p.h ?? 0) - 4;
  const stripes = ns.filter((n) => /repeating-linear-gradient/.test(n.art?.background ?? ""));
  const onPicture = stripes.filter((st) => pics.some((p) => covers(st, p) || covers(p, st)));
  const stripe = (onPicture[0] ?? null)?.art?.background ?? "";
  let scan: { dark: number; lines: number } | null = null;
  if (stripe) {
    const alpha = /rgba\([^)]*,\s*([\d.]+)\)/.exec(stripe);
    const px = [...stripe.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1])).filter((v) => v > 0);
    scan = { dark: alpha ? Math.min(1, Number(alpha[1])) : 0.14, lines: px.length ? Math.max(2, Math.max(...px)) : 3 };
  }
  const motion = (behaviours?.motion ?? null) as { float?: { part?: string; axis?: string; travel?: number; period?: number; easing?: string }[] } | null;
  const jit = (motion?.float ?? []).find((f) => f.axis === "x" && /steps/.test(f.easing ?? "") && pics.some((p) => p.id === f.part));
  const css = mostOf(filters);
  if (css || scan || jit) {
    put("work:screen-filter", "screen-filter", {
      ...(css ? { css } : {}),
      scanlines: fnum(scan?.dark ?? 0), ...(scan ? { lines: fnum(scan.lines) } : {}),
      static: scan ? "0.06" : "0",
      ...(jit ? { jitter: fnum((jit.travel ?? 6) / 2), every: fnum((jit.period ?? 6000) / 1000) } : {}),
    }, Math.max(filters.length, onPicture.length, jit ? 1 : 0));
  }

  /* Switch on */
  const loader = behaviours?.loader as { lastedMs?: number; animations?: string[] } | undefined;
  if (loader && (loader.animations ?? []).length) {
    put("work:switch-on", "switch-on", { duration: fnum(Math.min(2400, Math.max(400, (loader.lastedMs ?? 900) / 3))), flash: "yes" }, 1);
  }

  /* Push on press */
  const presses = ns.flatMap((n) => (n.motion?.active ?? []).map((a) => a.style ?? {})).map((st) => {
    const t = st.transform ?? st.translate ?? "";
    const ty = /translateY\(\s*(-?[\d.]+)px/.exec(t)?.[1] ?? /translate\(\s*-?[\d.]+px,\s*(-?[\d.]+)px/.exec(t)?.[1] ?? /^\s*-?[\d.]+px\s+(-?[\d.]+)px/.exec(t)?.[1];
    const tx = /translateX\(\s*(-?[\d.]+)px/.exec(t)?.[1] ?? /translate\(\s*(-?[\d.]+)px/.exec(t)?.[1];
    const sc = /scale\(\s*([\d.]+)/.exec(t)?.[1] ?? st.scale;
    return { down: ty ?? "0", x: tx ?? "0", scale: sc ?? "1", shadow: st["box-shadow"] ?? st.boxShadow ?? "" };
  }).filter((p) => p.down !== "0" || p.x !== "0" || p.scale !== "1");
  const press = mostOf(presses);
  if (press) put("work:press-push", "press-push", { down: press.down, x: press.x, scale: press.scale, ...(press.shadow ? { shadow: press.shadow } : {}) }, presses.length);
  return out;
}
