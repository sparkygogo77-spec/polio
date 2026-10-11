/**
 * WHAT THE BOARD ASKS THE CODE FOR, GATHERED FOR ANY WAY THE DESIGN GOES OUT.
 *
 * Publish (`CodeSiteButtons.tsx`) and "Send the design back"
 * (`StyleLayerPanel.tsx`) both run `codeSend.ts#sendDesign`. Until now only
 * Publish worked out the parts made in the Builder (`codeAsks.ts#freshHooks`),
 * gave each its data-hook, and wrote polio/NEXT.md with the ticked issues and
 * the board changes CSS cannot carry; Send the design back sent the style
 * layer alone, so a new part, an effect or a Format switch went nowhere from
 * it (J, 2026-10-10). Both now take their asks from here.
 */
import { useStudio } from "./board/store";
import { changedDeclarations, lookOf, type LayerNode, type StyleSource } from "./send-out";
import { fileOrGone } from "./kitRun";
import { NEXT_PATH, asksToSend, nextMd, toSend, type FixIssue } from "./fixLoop";
import { codeAsks, freshHooks } from "./codeAsks";
import { RUN_MOTIONS, formatSwitches } from "./shelfFacts";
import { FORMAT_FIELDS } from "./format";
import { getFeature, getWork } from "./shelf";
import { fixLoopOf, issuesNow } from "./useFixLoop";

/** The data-hook each part made in the Builder goes by (`codeAsks.ts#freshHooks`), by part id. */
export function freshNow(source: StyleSource): Record<string, string> {
  const st = useStudio.getState();
  const taken = source.files.flatMap((f) => f.hooks.map((h) => h.value));
  return freshHooks(st.nodes as never, new Set(source.files.map((f) => f.pageId)), taken, { part: (id) => getFeature(id)?.name ?? null, skip: RUN_MOTIONS, pages: st.pages });
}

/** What the board holds that the style layer cannot write (effects, Format switches, pages, parts made here), as NEXT.md lines (`codeAsks.ts`). */
export function asksNow(source: StyleSource, fresh: Record<string, string> = freshNow(source)): FixIssue[] {
  const st = useStudio.getState();
  const label = new Map(FORMAT_FIELDS.map((f) => [f.id, f.label]));
  const def = new Map(FORMAT_FIELDS.map((f) => [f.id, f.default]));
  const palette = st.look.palette as Record<string, string> | undefined;
  return codeAsks({
    fresh,
    part: (id) => getFeature(id)?.name ?? null,
    siteMotions: RUN_MOTIONS,
    kit: !!source.kit,
    lookCss: (n) => { const now = lookOf(n as unknown as LayerNode, palette); return changedDeclarations({ box: now.box, words: "" }, now, { dx: 0, dy: 0 }).filter((d) => !/^(width|min-height|max-width|box-sizing):/.test(d)); },
    nodes: st.nodes as never,
    pages: st.pages,
    format: st.format,
    switches: formatSwitches().map((s) => ({ key: s.key, on: s.on, off: s.off, label: label.get(s.key) ?? s.key, def: def.get(s.key) })),
    coded: new Set(source.files.map((f) => f.pageId)),
    effect: (id) => { const m = getWork(id)?.manifest; return m ? { name: m.name, blurb: m.blurb } : null; },
  });
}

export interface AsksOut {
  /** Each part made in the Builder, by id, with the hook it is asked for by. */
  fresh: Record<string, string>;
  /** The NEXT.md lines going out this time: ticked issues not yet sent, and the board's own asks. */
  adding: FixIssue[];
  /** polio/NEXT.md, added to what the repository already holds; empty when nothing is asked. */
  extra: { path: string; content: string }[];
  /** The parts to send, each made in the Builder carrying its hook, so the style layer and record name it. */
  nodes: LayerNode[];
  /** Set when polio/NEXT.md could not be read: nothing may go out, or the lines it holds would be written over. */
  says?: string;
}

/**
 * Everything a send-out carries besides the style layer. Each part made in
 * the Builder keeps the data-hook it is asked for by, on the board too, so
 * the next send names it the same and its record carries it.
 */
export async function gatherAsks(nodes: readonly LayerNode[], source: StyleSource, token: string, site: string): Promise<AsksOut> {
  const fresh = freshNow(source);
  for (const [id, hook] of Object.entries(fresh)) {
    const n = useStudio.getState().nodes.find((x) => x.id === id);
    if (n && n.hooks?.["data-hook"] !== hook) useStudio.getState().updateNode(id, { hooks: { ...(n.hooks ?? {}), "data-hook": hook } });
  }
  const loop = fixLoopOf(useStudio.getState().look);
  const adding: FixIssue[] = [...(loop.ticked.length ? toSend(loop, await issuesNow()) : []), ...asksToSend(loop, asksNow(source, fresh))];
  /* Only a 404 means there is no NEXT.md yet; any other failed read stops the send, so the open lines are not lost (and then read back as fixed). */
  const prev = adding.length ? await fileOrGone(fetch, token, source.repo, source.ref || "HEAD", NEXT_PATH) : { ok: true as const, text: null };
  if (!prev.ok) return { fresh, adding: [], extra: [], nodes: [...nodes], says: prev.says };
  const extra = adding.length ? [{ path: NEXT_PATH, content: nextMd(adding, { site, when: new Date().toISOString().slice(0, 10), prev: prev.text }) }] : [];
  const withHooks = nodes.map((n) => (fresh[n.id] && (n as { hooks?: Record<string, string> | null }).hooks?.["data-hook"] !== fresh[n.id] ? { ...n, hooks: { ...((n as { hooks?: Record<string, string> | null }).hooks ?? {}), "data-hook": fresh[n.id]! } } : n)) as LayerNode[];
  return { fresh, adding, extra, nodes: withHooks };
}
