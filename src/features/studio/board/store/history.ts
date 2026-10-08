"use client";
import { boardShows, type ScreenRead } from "../../states";
import { readStepKey, stateFrames, stepKey } from "../../states";
import { setBrought } from "../../shelf";
import { Boxes } from "lucide-react";
import { formatDefaults } from "../../format";
import { emptyLook } from "../../look";
import type { DrawKind } from "../../drawKinds";
import { type ThreadDoc } from "../../threads";
import { inheritedFrom, spaceOf } from "../../space";
import type { Space } from "../../space";
import { type Reassembly, type Slimming } from "../../reassemble";
import { type Painted } from "../../repaint";
import { type Twin } from "../../twins";
import { type Grown } from "../../owns";
import type { StateCreator } from "zustand";
import { BroughtPart, BroughtRepo, Doc, StudioNode, StudioPage, TrailTarget } from "./model";
import type { StudioState } from "./state";

export type SetStudio = Parameters<StateCreator<StudioState>>[0];
export type GetStudio = Parameters<StateCreator<StudioState>>[1];

export const HISTORY_LIMIT = 60;
/** Writes to the same field closer together than this are one edit, and one undo. */
export const EDIT_RUN_MS = 1500;
/** The fields a person types into on a part. A write to only these is an edit; anything else is a step of its own. */
export const TYPED_FIELDS = new Set(["prompt", "content", "data", "label"]);
/** A crate's settings that are typed or dragged: a run of writes to one is one edit. The rest (on or off, how it plays) is a step each. */
export const MOTION_RUNS = new Set(["name", "duration", "hold", "gaps", "use"]);

/**
 * An updated thread forms again.
 *
 * Only a finished one: a thread still being worked on is already forming
 * and its updates are its progress. Once it has landed, any change to it —
 * a pass, a cost, a line — bumps the generation and the box plays its
 * formation from nothing to where it stands. See `formation.ts`.
 */
export function reformed(t: { state?: string; form?: { p: number; gen: number } }): { p: number; gen: number } {
  const had = t.form ?? { p: 1, gen: 0 };
  if ((t.state ?? "done") === "running") return had;
  return { p: 1, gen: had.gen + 1 };
}
export const HUES = [265, 200, 160, 30, 340, 90, 240, 15];

/* The kinds a drawing can be declared as: `drawKinds.ts`, which has no
   imports so a check can read it without the app's aliases. */

export const TRAIL_LIMIT = 400;

/** Which prompt a revision is about, from the name the brief printed for it. */
export function resolveTarget(s: Pick<StudioState, "brief" | "pages" | "nodes" | "groups">, target: string): TrailTarget {
  const t = target.trim();
  const low = t.toLowerCase();
  if (!t || low === "site" || low === "the site" || low === "master" || low === "the idea") return { kind: "site", id: "site", label: s.brief.name.trim() || "The site" };
  const pm = /^page\s*[:—–-]\s*(.+)$/i.exec(t);
  if (pm) {
    const want = pm[1]!.trim().toLowerCase();
    const page = s.pages.find((p) => p.name.trim().toLowerCase() === want || p.path.toLowerCase() === want);
    if (page) return { kind: "page", id: page.id, label: page.name };
  }
  const exact = (label: string) => label.trim().toLowerCase() === low;
  const node = s.nodes.find((n) => exact(n.label)) ?? s.nodes.find((n) => n.label.trim().length > 2 && low.includes(n.label.trim().toLowerCase()));
  if (node) return { kind: "node", id: node.id, label: node.label };
  const group = s.groups.find((g) => exact(g.label));
  if (group) return { kind: "group", id: group.id, label: group.label };
  const page = s.pages.find((p) => exact(p.name));
  if (page) return { kind: "page", id: page.id, label: page.name };
  return { kind: "loose", id: `loose:${low}`, label: t };
}

/** The prompt that target carries right now. */
export function promptOf(s: Pick<StudioState, "brief" | "pages" | "nodes" | "groups">, t: TrailTarget): string {
  switch (t.kind) {
    case "site": return s.brief.master.trim();
    case "page": return s.pages.find((p) => p.id === t.id)?.prompt.trim() ?? "";
    case "node": return s.nodes.find((n) => n.id === t.id)?.prompt.trim() ?? "";
    case "group": return s.groups.find((g) => g.id === t.id)?.prompt.trim() ?? "";
    default: return "";
  }
}

/**
 * The document out of a thread, and nothing else.
 *
 * A thread's `doc` is a snapshot, but one that has been through
 * localStorage — a published document carries keys a snapshot does not
 * (`companion`, `activePageId`, `hiddenFeatures`) — and spreading whatever
 * it happens to hold straight into the state sets fields nobody meant to
 * set. `companion: null` arriving that way took the pinned preview down
 * with it. Only the document's own eight fields are applied, the way
 * `loadDoc` applies them.
 */
export function docPatch(doc: ThreadDoc | undefined): Partial<StudioState> {
  if (!doc) return {};
  const d = doc as Partial<Doc>;
  const patch: Partial<StudioState> = {};
  if (Array.isArray(d.pages) && d.pages.length) patch.pages = d.pages;
  if (Array.isArray(d.nodes)) patch.nodes = d.nodes;
  if (Array.isArray(d.groups)) patch.groups = d.groups;
  if (Array.isArray(d.shapes)) patch.shapes = d.shapes;
  if (Array.isArray(d.spaces)) patch.spaces = d.spaces;
  if (d.format) patch.format = { ...formatDefaults(), ...d.format };
  if (d.brief) patch.brief = d.brief;
  if (d.look) patch.look = { ...emptyLook(), ...d.look };
  if (Array.isArray(d.motion)) patch.motion = d.motion;
  if (patch.pages && !patch.pages.some((p) => p.id === undefined)) {
    // Standing on a thread whose pages no longer include the open one.
    patch.activePageId = patch.pages[0]!.id;
  }
  return patch;
}

/**
 * What a part inherits from the open space it is landing in, if it is.
 *
 * The space's plan and, when the part has nothing to say for itself, the
 * space's prompt. Nothing when it lands on bare page, which is every part
 * placed before any of this existed.
 */
export function inherit(
  s: { spaces: Space[]; activePageId: string },
  at: { x: number; y: number },
  w: number,
  h: number,
  patch?: Partial<StudioNode>,
): Partial<StudioNode> {
  if (!s.spaces.length) return {};
  const space = spaceOf(s.spaces, { ...at, w, h, pageId: patch?.pageId ?? s.activePageId }, Date.now());
  const had = inheritedFrom(space);
  return {
    ...(had.plan && !patch?.plan ? { plan: had.plan } : {}),
    ...(had.prompt && !patch?.prompt?.trim() ? { prompt: had.prompt } : {}),
  };
}

/** The document as a step in the history holds it: what undo puts back. */
export function snapshot(s: StudioState): Doc {
  return {
    pages: s.pages,
    nodes: s.nodes,
    groups: s.groups,
    shapes: s.shapes,
    spaces: s.spaces,
    format: s.format,
    brief: s.brief,
    look: s.look,
    motion: s.motion,
    taken: s.taken ?? null,
  };
}

/**
 * The nodes a set of rebuilt sentences leaves behind.
 *
 * Pure and shared, because the palette command and the sweep on open must
 * never drift: one of them quietly doing something different to a document
 * is exactly the kind of thing nobody notices until a board is wrong.
 */
export function withJoins(nodes: StudioNode[], done: readonly Reassembly[]): StudioNode[] {
  const dropped = new Set(done.flatMap((d) => d.drop));
  const by = new Map(done.map((d) => [d.keep, d]));
  return nodes
    .filter((n) => !dropped.has(n.id))
    .map((n) => {
      const d = by.get(n.id);
      if (!d) return n;
      /* The box is the capture's composite now, not where he dragged a piece
         of it, so it stops being marked his and the healing may lay what
         follows under it again. */
      const { byHand: _was, ...rest } = n;
      return { ...rest, content: d.spans, x: d.x, y: d.y, w: d.w, h: d.h };
    });
}

/**
 * The nodes with each adrift wrapper put back round what it owns.
 *
 * Out, never in: every one of these lifts a box or makes it bigger, and the
 * guard against a rule that could shrink is in `grownTo` rather than here,
 * because the shrinking rule is the one that strips padding from 29 wrappers
 * in 31.
 */
export function withGrown(nodes: StudioNode[], done: readonly Grown[]): StudioNode[] {
  const by = new Map(done.map((g) => [g.id, g]));
  return nodes.map((n) => {
    const g = by.get(n.id);
    return g ? { ...n, x: g.x, y: g.y, w: g.w, h: g.h } : n;
  });
}

/**
 * The nodes with each duplicated box's spare copy taken out.
 *
 * SAFE FOR ONE REASON ONLY: an identical twin remains in its place, which
 * `twins` proves rather than assumes. This is deliberately NOT the
 * empty-wrapper rule and shares no code with it: an empty wrapper that has
 * slid below its contents must be repositioned and must never be removed.
 */
export function withoutTwins(nodes: StudioNode[], done: readonly Twin[]): StudioNode[] {
  const going = new Set(done.map((t) => t.id));
  const staying = new Set(nodes.map((n) => n.id));
  /* The twin has to actually be here. If it is not, nothing goes. */
  if (done.some((t) => !staying.has(t.keeps) || going.has(t.keeps))) return nodes;
  /*
   * AND THE ONE THAT STAYS KEEPS WHAT THE CAPTURE SAID ABOUT THEIR BOX. Two
   * parts in one box share its placement, so a spare taken out that was out of
   * the flow (`from.position`) leaves that fact on the part that remains. His
   * SOL WORKS badge carries the flag on its wrapper, not on the image; the
   * wrapper goes as the image's twin, and without this the next sweep over the
   * saved document — or his board published and brought back — met an
   * unflagged image and grew the header round it again (`tests/twin-flag.mjs`).
   */
  const flagOf = new Map<string, "absolute" | "fixed" | "sticky">();
  for (const t of done) {
    const gone = nodes.find((n) => n.id === t.id)?.from?.position;
    if (gone) flagOf.set(t.keeps, gone);
  }
  return nodes
    .filter((n) => !going.has(n.id))
    .map((n) => {
      const flag = flagOf.get(n.id);
      return flag && n.from && !n.from.position ? { ...n, from: { ...n.from, position: flag } } : n;
    });
}

/**
 * The nodes with the active controls' dropped tint put back.
 *
 * The colour goes in `bg`, which is the role the WRAPPER fills from, so it
 * reaches the node's edge rather than stopping at the words — see the note in
 * `repaint.ts`, which measures the two routes against each other. Nothing
 * else about the node is touched: not its accent, which is still the tint's
 * own colour and its border's, and not its variant.
 */
export function withPaint(nodes: StudioNode[], done: readonly Painted[]): StudioNode[] {
  const by = new Map(done.map((d) => [d.id, d]));
  return nodes.map((n) => {
    const d = by.get(n.id);
    return d ? { ...n, colour: { ...(n.colour ?? {}), bg: d.paint } } : n;
  });
}

/**
 * The nodes a set of fitted wrappers leaves behind.
 *
 * Nothing is removed. A box that holds nothing is misplaced rather than junk
 * — see `emptyWrappers` — so this only ever changes a height, and only ever
 * downward from what the capture recorded.
 */
export function withFits(nodes: StudioNode[], done: readonly Slimming[]): StudioNode[] {
  const fit = new Map(done.map((d) => [d.id, d.h]));
  return nodes.map((n) => { const h = fit.get(n.id); return h === undefined ? n : { ...n, h }; });
}

export function firstPage(): StudioPage {
  return { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
}

export function starterDoc(): Doc {
  return {
    pages: [firstPage()],
    nodes: [],
    groups: [],
    shapes: [],
    spaces: [],
    format: formatDefaults(),
    brief: { name: "", gimmick: "", master: "" },
    look: emptyLook(),
    motion: [],
  };
}

/** Storage moved from the old name; carry a saved document across once. */
export function migrateKey(from: string, to: string) {
  if (typeof localStorage === "undefined") return;
  try {
    if (!localStorage.getItem(to) && localStorage.getItem(from)) {
      localStorage.setItem(to, localStorage.getItem(from)!);
    }
  } catch {
    /* private mode */
  }
}

/*
 * Whether the saved document has been read yet. Until it has, the store is
 * holding nothing but its defaults and must not write them out — see the
 * note on `storage` below.
 */
export const pen = { read: false, swapping: false };

/*
 * Whether a swap between sites is in flight.
 *
 * `swapDoc` replaces the whole document in one synchronous go, and while it
 * does the store passes through states that belong to neither site. Nothing
 * of that may reach the live key, because the live key is what the projects
 * store copies into a site's own slot — and one site's work landing in
 * another site's slot is the fault this exists to make impossible, not a
 * cosmetic one. So the pen is held for the length of the swap and the caller
 * writes the live key itself, once, with the document it means.
 */
/* `pen.swapping`, on the same object. */

/**
 * Hand the catalogue what the connected repositories brought.
 *
 * The document is the truth and the catalogue is the reader, so this runs
 * on every change and on hydration, and nothing anywhere keeps a second
 * copy. A brought part is a preset — `basedOn` names the real library part
 * that draws it — so the shelf, the wheel, the search box and "add here"
 * all work on it without knowing where it came from.
 */
export function shelve(repos: BroughtRepo[], parts: BroughtPart[]): void {
  setBrought(
    repos.map((r) => ({ id: r.id, label: r.label, icon: Boxes, blurb: `Brought in from ${r.from}.`, hue: r.hue })),
    parts.map((p) => ({
      id: p.id,
      name: p.label,
      category: p.categoryId,
      icon: Boxes,
      blurb: p.blurb,
      w: p.w,
      h: p.h,
      basedOn: p.basedOn,
      from: repos.find((r) => r.id === p.categoryId)?.from,
      tags: ["repo", "imported"],
      preset: { content: p.content, options: p.options, colour: p.colour, font: p.font, prompt: p.prompt, label: p.label },
    })),
  );
}

/*
 * WHEN THE BOARD WAS LAST CHANGED BY A PERSON, told to whoever asks.
 *
 * Every edit takes a checkpoint (`push`) or rides one (`pushEdit`), and undo,
 * redo and a jump in the history change the board too; each of those calls
 * this. What the board does to itself (a settle, a quiet write) does not,
 * so "changed since it was published" means a person changed it. The Builds
 * page reads the time off the site (`builds/edits.ts`), never the document.
 */
export const editListeners = new Set<() => void>();
export function onBoardEdit(fn: () => void): () => void {
  editListeners.add(fn);
  return () => { editListeners.delete(fn); };
}
export const edited = () => { for (const fn of editListeners) { try { fn(); } catch { /* a listener's trouble is its own */ } } };


/** The states to switch on so every picked part is drawn: nothing when they all are. */
export function pickedStates(s: StudioState, ids: string[]): { statesOn?: string[] } {
  if (!ids.length) return {};
  const on = s.statesOn ?? [];
  /* A panel isolated on the board draws its own parts: picking one switches nothing on that would stay when it lets go. */
  if (on.some((k) => k.startsWith("isolate:"))) return {};
  const source = (s.look as { styleSource?: { files?: { file: string; pageId: string }[]; screens?: ScreenRead[] } } | undefined)?.styleSource;
  const pageOf = (file: string) => source?.files?.find((f) => f.file === file)?.pageId ?? null;
  const frames = on.some((k) => k.startsWith("step:")) ? stateFrames(s.nodes) : null;
  const shows = boardShows(on, source?.screens, pageOf, frames, null, s.nodes);
  const want = new Set<string>();
  let kept = on;
  for (const id of ids) {
    const n = s.nodes.find((x) => x.id === id);
    if (!n || shows(n)) continue;
    /* A face its frame's timeline is not on: the timeline turns to that face. */
    const f = frames?.inFrame.get(id);
    if (f && kept.some((k) => readStepKey(k)?.frame === f)) { kept = [...kept.filter((k) => readStepKey(k)?.frame !== f), stepKey(f, frames!.stepOf.get(id)!)]; continue; }
    if (n.state?.group) want.add(n.state.group);
  }
  return want.size || kept !== on ? { statesOn: [...kept, ...want] } : {};
}
