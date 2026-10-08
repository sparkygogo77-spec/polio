"use client";
import * as React from "react";
import { Anchor, Code, EyeOff, Files, Heading, Image, ImageOff, LayoutPanelTop, Link, Loader2, MousePointerClick, Shapes, SquareCheck, SquareDashed, TextCursorInput, Type, X, type LucideIcon } from "lucide-react";
import { type ReportChip } from "../pageParts";
import { Tooltip } from "@/core/ui/tooltip";
import { VOID } from "@/core/ui/void";
import { repoName, type Repo } from "../repoImport";
import { type RepoCopy } from "../repoRun";
import { put as putPicture } from "../pictures";
import { useBuilds } from "@/features/builds/store";
import type { ScreenRead } from "../states";
import { type StyleSource } from "../styleLayer";
import { READ_DEADLINE_MS } from "../siteFetch";
import { type Space } from "../space";
import { landPalette } from "../paletteFrom";
import { useStudio, type StudioNode } from "../board/store";
import { type MergeDoc, type MergeNode as MergeNodeOf, type Taken } from "../reimport";
import { type Block } from "../zipImport";
import { Details } from "./bits";
import { followsStateRules, sceneScreens } from "../states";
import { FromASite } from "./FromASite";

export type Source =
  /* A site read at its address. `repo` is set when the address stood in
     for a repository of sources, so what lands goes into that
     repository's own category exactly as its files would have. */
  | { kind: "site"; url: string; host: string; repo?: Repo; read?: { why: "site" | "root"; isMadeHere: boolean } }
  | { kind: "zip"; file: File; name: string; entry: string }
  /* A repository is a zip once it is here: its files were fetched by this
     browser with his own token and packed on the way in, so everything
     past that point is the zip path, unchanged. What it keeps beyond a
     zip is which repository it was, because its elements go into a
     category named after it. */
  | { kind: "repo"; repo: Repo; file: File; name: string; entry: string };

export type Picking = { at: "picking"; source: Source; page: { width: number; height: number; shot: string }; candidates: Block[]; scripts: boolean };
export type Stage =
  | { at: "nothing" }
  | { at: "busy"; says: string }
  | Picking
  | { at: "said"; says: string; details?: string; chips?: ReportChip[] };

/** Ask a route, with a deadline of our own and a sentence for every ending. */
async function ask(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), READ_DEADLINE_MS);
  try {
    const res = await fetch(url, { ...init, signal: stop.signal });
    // A gateway's own error page is not JSON. Read it as the status it is.
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, message: `The server answered ${res.status} rather than an answer.` };
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, message: aborted ? `Nothing came back within ${Math.round(READ_DEADLINE_MS / 1000)} seconds.` : "The page could not be reached from here." };
  } finally {
    clearTimeout(timer);
  }
}

export const askSite = (body: Record<string, unknown>) =>
  ask("/api/studio/element", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** The zip goes with every call: the route keeps nothing between them. */
export const askZip = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.set("zip", file, file.name);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return ask("/api/studio/zip", { method: "POST", body: form });
};

export const nameOf = (s: Source) => (s.kind === "site" ? (s.repo ? repoName(s.repo) : s.host.replace(/^www\./, "")) : s.name);
/** The repository a source stands for, whether its files or its address were read. */
export const repoOf = (s: Source): Repo | null => (s.kind === "repo" ? s.repo : s.kind === "site" ? (s.repo ?? null) : null);

/**
 * Where this Builder itself put that repository, if it did.
 *
 * A site published from here records the address it went live at, beside
 * the repository it went to. Bringing that repository back in, this
 * Builder's own included, reads the page there when GitHub's About line
 * does not say.
 */
export function deployedBy(r: Repo): string | null {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return useBuilds.getState().projects.find((p) => p.repo && same(p.repo.owner, r.owner) && same(p.repo.name, r.name) && p.live?.url)?.live?.url ?? null;
}

/*
 * THE STAGE LIVES OUTSIDE THE PANEL, keyed by the space it belongs to.
 *
 * It was component state, and component state dies with the component:
 * anything that re-mounts this panel mid-import, a pick, a re-fit, a
 * layout change, threw away the line that said what was happening, and
 * the import ended in silence on a panel that read "nothing in it yet".
 * Kept here, the line is there whenever the panel is, and the same line
 * is what the toast from the board says.
 */
export const NOTHING: Stage = { at: "nothing" };
const STAGES = new Map<string, Stage>();
const stageListeners = new Set<() => void>();
export const stageOf = (spaceId: string): Stage => STAGES.get(spaceId) ?? NOTHING;
/** The most recent import anywhere on the board, for the strip that is never hidden. */
export let latest: { spaceId: string; stage: Stage; when: number } | null = null;
export const putStage = (spaceId: string, stage: Stage) => {
  STAGES.set(spaceId, stage);
  latest = stage.at === "nothing" ? (latest?.spaceId === spaceId ? null : latest) : { spaceId, stage, when: Date.now() };
  for (const l of stageListeners) l();
};
export const subscribeStages = (l: () => void) => { stageListeners.add(l); return () => { stageListeners.delete(l); }; };
/**
 * A NEW PRESS CLEARS THE STRIP. Driven by hand: the strip kept the previous
 * press's line, naming the wrong repository, through the whole of the next
 * press, which read as silence. Every Bring it starts from a clear strip.
 */
export function clearImportLine(): void {
  latest = null;
  for (const l of stageListeners) l();
}
/** How long one step may go without a word before the import is told to stop and say so. */
export const STEP_PATIENCE_MS = 90_000;

/**
 * THE IMPORT'S LINE, WHERE IT CANNOT BE HIDDEN.
 *
 * Driven by hand, three times: a repository brought in, a space named
 * after it, and "nothing". Reproduced: the ending fired within a second,
 * the no-page refusal, and sat in this panel's import section, which the
 * space's aside keeps below its fold on a short window, 736 pixels down
 * in a 640 pixel one, with nothing saying to scroll. With toasts off, that
 * was every word there was. So the latest import's line is drawn here
 * too, across the top of the board, in the same words, until he dismisses
 * it or starts another.
 */
const CHIP_ICONS: Record<string, LucideIcon> = {
  pages: Files, section: LayoutPanelTop, slot: SquareDashed, heading: Heading, text: Type, code: Code, button: MousePointerClick,
  link: Link, field: TextCursorInput, check: SquareCheck, picture: Image, shape: Shapes, hidden: EyeOff, hooks: Anchor, placeholders: ImageOff,
};
const CHIP_GREEN = "oklch(0.82 0.17 150)";

/** The counts an import landed, as green icon-and-number chips; each says what it counts in a hover label (and on keyboard focus). */
export function ReportChips({ chips }: { chips: ReportChip[] }) {
  return (
    <span data-import-chips="" className="mr-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {chips.map((c) => {
        const Icon = CHIP_ICONS[c.k] ?? Shapes;
        return (
          <Tooltip key={c.k} content={c.label} side="bottom">
          <span data-import-chip={c.k} aria-label={c.label} tabIndex={0} className="inline-flex items-center gap-0.5 rounded-full border px-1.5 text-small tabular-nums" style={{ color: CHIP_GREEN, borderColor: "oklch(0.72 0.17 150 / 0.45)", background: "oklch(0.72 0.17 150 / 0.1)" }}>
            <Icon className="size-3" aria-hidden />
            {c.n}
          </span>
          </Tooltip>
        );
      })}
    </span>
  );
}

export function ImportStrip() {
  const it = React.useSyncExternalStore(subscribeStages, () => latest, () => null);
  if (!it || it.stage.at === "nothing" || it.stage.at === "picking") return null;
  const busyNow = it.stage.at === "busy";
  const says = it.stage.says;
  const refused = /^[\w.-]+\/[\w.-]+: /.test(says) && !busyNow && !/landed|carried|copied|real parts|arrived/.test(says);
  return (
    <div
      data-import-strip={busyNow ? "busy" : refused ? "refused" : "done"}
      role="status"
      className="relative z-[1] flex shrink-0 items-start gap-2 border-b px-3 py-1.5 text-plain"
      style={{ borderColor: refused ? "oklch(0.72 0.17 18 / 0.6)" : VOID.rim, background: refused ? "oklch(0.72 0.17 18 / 0.08)" : VOID.box, color: VOID.text }}
    >
      {busyNow ? <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" /> : null}
      <span className="min-w-0 flex-1">
        {it.stage.at === "said" && it.stage.chips?.length ? <ReportChips chips={it.stage.chips} /> : null}
        {says}
        {it.stage.at === "said" && it.stage.details ? <Details text={it.stage.details} /> : null}
      </span>
      {!busyNow ? (
        <button type="button" data-import-strip-dismiss="" aria-label="Dismiss" onClick={() => putStage(it.spaceId, NOTHING)} className="tactile shrink-0 rounded px-1" style={{ color: VOID.muted }}>
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/** The id a repository's import runs under: no space in the store, and no panel on screen. */
export const HEADLESS = "bring_";
export const isHeadless = (space: Space) => space.id.startsWith(HEADLESS);

/**
 * A document laid on the board as an import lays it: loaded, swept once in
 * the sweep's order, its palette landed. The board it leaves is the board
 * "as brought in", which `reimport.ts` records.
 */
/** The page whose hooks a screen carries most of. */
function pageCarrying(shows: string[], files: StyleSource["files"]): string {
  let best = "", most = 0;
  for (const f of files) {
    const mine = new Set(f.hooks.filter((h) => h.attr === "data-hook").map((h) => h.value));
    const n = shows.filter((h) => mine.has(h)).length;
    if (n > most) { most = n; best = f.file; }
  }
  return best;
}

/**
 * The pictures its scripts draw (`/api/studio/zip`, pictures): the page is
 * read without its scripts, so an <img> its code fills came in as a stand-in.
 * Each is put on its part as the picture it shows, without an undo step of
 * its own; one the board already holds a picture for keeps it.
 */
export async function readPicturesOf(file: File, pages: string[], repo: string): Promise<void> {
  if (!pages.length) return;
  const form = new FormData();
  form.set("zip", file, file.name);
  form.set("pictures", JSON.stringify(pages));
  const got = await fetch("/api/studio/zip", { method: "POST", body: form, signal: AbortSignal.timeout(240_000) }).then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => null);
  const byFile = (got?.ok && got.pictures && typeof got.pictures === "object" ? got.pictures : {}) as Record<string, Record<string, string>>;
  const source = (useStudio.getState().look as { styleSource?: StyleSource }).styleSource;
  if (!source || source.repo !== repo) return;
  await fillPictures(new Map(Object.entries(byFile).flatMap(([f, hooks]) => { const id = source.files.find((x) => x.file === f)?.pageId; return id ? [[id, hooks] as const] : []; })));
}

/** Stand-ins its code fills, by page and hook, given the pictures it drew there. */
async function fillPictures(byPage: Map<string, Record<string, string>>): Promise<void> {
  const put = new Map<string, Awaited<ReturnType<typeof putPicture>>>();
  for (const [pageId, hooks] of byPage) {
    for (const n of useStudio.getState().nodes) {
      const hook = n.pageId === pageId && n.featureId === "picture" && !(n as { picture?: unknown }).picture ? n.hooks?.["data-hook"] : undefined;
      const src = hook ? hooks[hook] : undefined;
      if (!src) continue;
      try { put.set(n.id, await putPicture(await (await fetch(src)).blob(), { alt: hook!, from: "upload" })); } catch { /* no file storage here: it stays a stand-in */ }
    }
  }
  if (!put.size) return;
  useStudio.setState({ nodes: useStudio.getState().nodes.map((n) => (put.has(n.id) ? ({ ...n, picture: put.get(n.id) } as typeof n) : n)) });
}

/** A repository's preview screens, read off its preview page and kept on the site it came in as, without an undo step of their own. */
export async function readScreensOf(file: File, ask: { page: string | null; list: { name: string; src: string }[] }, repo: string, width?: number): Promise<void> {
  /* Its own deadline: the preview builds every screen before it lists them, and nobody waits on this. */
  const form = new FormData();
  form.set("zip", file, file.name);
  form.set("screens", JSON.stringify(ask));
  /* At the board's own width, as the page was read: where a screen draws its parts lines up with where the board has them (`boardStates.ts#screenPlaces`). */
  if (width) form.set("width", String(width));
  const got = await fetch("/api/studio/zip", { method: "POST", body: form, signal: AbortSignal.timeout(240_000) }).then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => null);
  const read = got?.ok && Array.isArray(got.screens) ? (got.screens as ScreenRead[]) : [];
  const st = useStudio.getState();
  const source = (st.look as { styleSource?: StyleSource }).styleSource;
  if (!read.length || !source || source.repo !== repo) return;
  /* A screen read off the preview's own copy names no page: it is the page whose hooks it carries most of. */
  const placed = read.map((x) => (x.page ? x : { ...x, page: pageCarrying(x.shows, source.files) })).filter((x) => x.page);
  /* What its code drew into its pictures, in these screens: onto the stand-ins it fills (`fillPictures`), and not kept on the screens. */
  const drawn = new Map<string, Record<string, string>>();
  for (const x of placed as (ScreenRead & { pictures?: Record<string, string> })[]) {
    const id = source.files.find((f) => f.file === x.page)?.pageId;
    if (id && x.pictures) drawn.set(id, { ...x.pictures, ...(drawn.get(id) ?? {}) });
  }
  /*
   * What a part with a still draws in each screen (PST's chart: the match's
   * candles in "match live", the final chart in the result), kept on the
   * screen as a picture of its own, so a step shows its own chart and not
   * the sample's (J, 2026-10-05). Pictures that are the same are put once.
   */
  const stilled = new Set(st.nodes.filter((n) => (n as { picture?: unknown }).picture && n.hooks?.["data-hook"]).map((n) => n.hooks!["data-hook"]!));
  const putOnce = new Map<string, Promise<unknown>>();
  const screens = await Promise.all(placed.map(async ({ pictures, ...x }: ScreenRead & { pictures?: Record<string, string> }) => {
    const stills: Record<string, unknown> = {};
    for (const [hook, src] of Object.entries(pictures ?? {})) {
      if (!stilled.has(hook)) continue;
      if (!putOnce.has(src)) putOnce.set(src, fetch(src).then((r) => r.blob()).then((b) => putPicture(b, { alt: `${hook} in ${x.name}`, from: "upload" })).catch(() => null));
      const pic = await putOnce.get(src);
      if (pic) stills[hook] = pic;
    }
    return Object.keys(stills).length ? { ...x, stills } : x;
  }));
  const now = useStudio.getState();
  const was = (now.look as { styleSource?: StyleSource }).styleSource ?? source;
  /* A site that follows the state rules keeps its declared scenes; the captures only lend places and words, and say where live differs (`stateRules.ts`). */
  const declared = was.scenes?.length && followsStateRules(now.nodes) ? sceneScreens(now.nodes, was.files ?? [], was.scenes, screens) : null;
  useStudio.setState({ look: { ...now.look, styleSource: { ...was, ...(declared ? { screens: declared, captured: screens } : { screens }) } } as typeof now.look });
  if (drawn.size) await fillPictures(drawn);
}

export function landAsBrought(doc: Record<string, unknown>): void {
  useStudio.getState().loadDoc(doc as Parameters<ReturnType<typeof useStudio.getState>["loadDoc"]>[0]);
  /*
   * PUT RIGHT BY THE SWEEP, IN THE SWEEP'S ORDER, AND BY NOTHING ELSE.
   *
   * Measured through this door with sink's document: the sweep never ran
   * on an import. The empty site it lands on had been opened, and a board
   * with nothing captured on it is marked swept; `loadDoc` kept the mark,
   * so the imported document arrived "already swept" and the grow step,
   * the duplicate pass and the repaint never reached it. What ran instead
   * were a sentence join and `fitWrappers`, called here on their own.
   *
   * And those two cannot simply run first. Fitting before the sweep shrank
   * his rail to the box of the nav inside it, and the sweep's duplicate
   * pass — which reads the document AS SAVED so it only ever deletes for
   * something the capture said — then read a height this code had chosen
   * as a twin and deleted the nav. So the mark the document came with is
   * the only one it keeps (a published document carries none), and the
   * sweep does all of it. Its sentence is said here, in this import's own
   * line, rather than a second time under "put right when it opened".
   */
  useStudio.setState({ swept: (doc as { swept?: number | null }).swept ?? null });
  useStudio.getState().sweepDocument();
  /*
   * THE SITE'S OWN COLOURS, AND HIS PARTS TIED TO THEM (`paletteFrom.ts`).
   *
   * After the sweep, never before it: the sweep's repaint reads a
   * control's ink as a colour to mix, and a role's name is not one. So the
   * six roles are picked off the board as the sweep left it, and each part
   * colour that is exactly a role's colour is written as the role's name.
   * The board draws the same; moving a role now moves what wore it.
   */
  {
    const now = useStudio.getState();
    const captured = (doc as { look?: { palette?: Record<string, string> } }).look?.palette ?? {};
    const landed = landPalette(now.nodes, captured);
    useStudio.setState({ nodes: landed.nodes, look: { ...now.look, palette: landed.palette, paletteFrom: landed.from } });
  }
}

/** The board's document as the merge reads it. */
export function boardNow(): MergeDoc<StudioNode & MergeNodeOf> {
  const s = useStudio.getState();
  return { nodes: s.nodes, format: s.format, brief: s.brief, look: s.look };
}

/** What a "keep my changes" import keeps from: the board's own record, or the document it was brought in from. */
export interface KeepFrom { taken: Taken | null; base: RepoCopy | null; from: string | null }

/**
 * A REPOSITORY COMES IN WITHOUT A SPACE.
 *
 * The importer lives in this component, and this component lived only on a
 * space's panel, so every Bring drew a square space on the board, picked
 * it, and opened its panel on the right: a drawing tool's box and menu the
 * owner never asked for, left locked round the page afterwards
 * (`docs/audits/drawing-and-import-sequence.md`, B). Here the same importer
 * runs out of sight, over a surface that is the page itself — the whole
 * width from the top, exactly the box the space was stretched to before —
 * so every part lands where it did. What it is doing is said in the toast
 * and the strip across the top of the board, as it already was.
 * `tests/bring-no-space.mjs`.
 */
export function BringHost() {
  const handed = useStudio((st) => st.bringRepo);
  const [host, setHost] = React.useState<Space | null>(null);
  React.useEffect(() => {
    if (!handed || !handed.space.startsWith(HEADLESS) || host?.id === handed.space) return;
    const st = useStudio.getState();
    const fw = st.frameWidth || 1440;
    const h = Math.round(fw * 0.625);
    setHost({ id: handed.space, pageId: handed.pageId ?? st.activePageId, boundary: [[0, 0], [fw, 0], [fw, h], [0, h]], at: Date.now(), since: null, prompt: "", label: "" });
  }, [handed, host?.id]);
  if (!host) return null;
  return <div hidden data-bring-host={host.id}><FromASite key={host.id} space={host} /></div>;
}
