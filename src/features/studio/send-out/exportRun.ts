/**
 * THE EXPORT, RUN FROM THE OPEN BOARD (the Export dialog, `ExportDialog.tsx`).
 *
 * Both ways of exporting start from what Go live already writes: the
 * published pages (`exportSite`, the preview's own markup) and the pictures.
 * Then:
 *
 *   · Exact look: the published pages as a Next.js app (`exactOut.ts`);
 *   · Clean code: the layout tree as flex and grid, sections as components,
 *     every style a Tailwind class, and the component library
 *     (`pagesOut.ts`, `libraryOut.ts`).
 *
 * Both carry the four token files (`tokensOut.ts`), POLIO.md with the System
 * and what is still placed by hand, design/record.json with token and
 * component ids, polio/export.json, and the app's setup (package.json with
 * Tailwind, vercel.json saying Next.js). To a repository it goes through Go
 * live (one commit, then Vercel), sending only what `exportSync.ts` says
 * Polio may write: a file edited in the repository is kept.
 */
import { sentBoard, useStudio, type StudioNode } from "../board/store";
import { activeProject } from "@/features/builds/store";
import { heldKeys } from "@/features/keys/store";
import { exportSite, type ExportFile } from "./exportSite";
import { goLive, pushTo } from "./goLive";
import { exactOut } from "./exactOut";
import { pagesOut, stillPlacedMd, type PagesReport } from "./pagesOut";
import { libraryOut } from "./libraryOut";
import { tokenNames, tokenCss, tokensOut, TOKEN_FILES } from "./tokensOut";
import { gitBlobSha } from "./designBranch";
import { zipFiles } from "./zipWrite";
import { EXPORT_RECORD, appSetup, readRecord, recordFile, syncPlan, systemMd, type ExportMode, type ExportRecord, type SyncPlan } from "./exportSync";
import { appFiles } from "../scaffolding/app";
import { homeFor } from "../homePage";
import { POLIO_MD, polioMd } from "../polioMd";
import { designRecord, type RecordNode, type RecordPart } from "../designRecord";
import { siteSystem } from "../system/api";
import { takeSystem, type TakeNode } from "../system/take";
import { allTokens, type System } from "../system/model";
import { resolvePalette } from "../shelf/run";
import { fileAt } from "../kitRun";
import { publisherHeader, type GeneratedFile } from "../loop/agent";
import type { ScaffoldInput } from "../scaffolding/types";

export interface ExportChoice {
  mode: ExportMode;
  /** Clean code: the component library, and its gallery page. Exact look has neither. */
  library: boolean;
  gallery: boolean;
}

export interface Exported {
  files: GeneratedFile[];
  mode: ExportMode;
  system: System;
  report: PagesReport | null;
  /** How many of each it wrote. */
  counts: { tokens: number; components: number; pages: number; placed: number };
}

/** The site's System as the board links it, or, for a site that has not taken one, one taken now without changing the board. */
export function exportSystem(): { system: System; nodes: StudioNode[] } {
  const s = sentBoard(useStudio.getState());
  const own = siteSystem();
  if (own) return { system: own, nodes: s.nodes };
  /* As the System tab's "Take from this site" reads it (`api.ts#takeFromSite`), without writing it to the board. */
  const t = takeSystem({ nodes: s.nodes as unknown as TakeNode[], palette: resolvePalette(s.format, s.look), frameWidth: s.frameWidth, name: s.brief.name?.trim() || "This site" });
  return { system: t.system, nodes: s.nodes.map((n) => (t.links.has(n.id) ? ({ ...n, sys: t.links.get(n.id) } as StudioNode) : n)) };
}

const isBinary = (f: ExportFile) => "encoding" in f && f.encoding === "base64";
const toBase64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const generated = (f: { path: string; content: string | Uint8Array }): GeneratedFile => (typeof f.content === "string" ? { path: f.path, content: f.content } : { path: f.path, content: toBase64(f.content), encoding: "base64" });

/** design/record.json, as Export for code writes it, with each part's tokens and component from the System. */
function recordWithSystem(system: System, nodes: StudioNode[], pages: { id: string; name: string; path?: string }[], width: number, palette: Record<string, string>): string {
  const names = tokenNames(system);
  const tokens = Object.fromEntries(allTokens(system).map(({ kind, token }) => [names.get(token.id)!.css, tokenCss(kind, token)]));
  const home = homeFor(pages);
  const rec = designRecord(nodes as unknown as RecordNode[], pages, { site: useStudio.getState().brief.name?.trim() || "site", width, palette, tokens, pageFile: (id) => { const p = pages.find((x) => x.id === id); return p ? home.file(p) : null; }, when: new Date().toISOString() });
  const comp = new Map(system.components.map((c) => [c.id, c]));
  const sysOf = new Map(nodes.map((n) => [n.id, (n as unknown as { sys?: { f?: Record<string, string>; c?: { component: string; variant: string } | null } }).sys]));
  const walk = (p: RecordPart) => {
    const id = p.hook?.replace(/^#/, "");
    const sys = id ? sysOf.get(id) : undefined;
    if (sys?.c) { const c = comp.get(sys.c.component); const v = c?.variants.find((x) => x.id === sys.c!.variant); if (c) (p as RecordPart & { component?: string }).component = `${c.name}${v ? ` / ${v.name}` : ""}`; }
    if (sys?.f) p.tokens = { ...(p.tokens ?? {}), ...Object.fromEntries(Object.entries(sys.f).map(([field, t]) => [field, names.get(t)?.css ?? t])) };
    for (const k of p.kids ?? []) walk(k);
  };
  for (const pg of rec.pages) walk(pg.tree);
  return `${JSON.stringify(rec, null, 2)}\n`;
}

/** Every file of the export, written from the open board. */
export async function buildExport(choice: ExportChoice): Promise<Exported> {
  const s = sentBoard(useStudio.getState());
  const { system, nodes } = exportSystem();
  const site = await exportSite();
  const byPath = new Map(site.map((f) => [f.path.replace(/^\/+/, ""), f]));
  const home = homeFor(s.pages);
  const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
  const published = new Map(s.pages.flatMap((p) => { const f = byPath.get(home.file(p)); return f && !isBinary(f) ? [[p.id, parse(f.content)] as const] : []; }));
  const siteCss = byPath.get("assets/site.css")?.content ?? "";
  const name = s.brief.name?.trim() || activeProject()?.name?.trim() || "Site";
  const palette = s.look.palette as Record<string, string>;
  const files: { path: string; content: string | Uint8Array }[] = [...tokensOut(system)];
  let report: PagesReport | null = null;
  let components = 0;
  if (choice.mode === "exact") {
    const assets = site.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: isBinary(f) ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)) : f.content }));
    files.push(...exactOut({ name, pages: s.pages, published, assets, system }).files);
  } else {
    const lib = choice.library ? libraryOut(system, { gallery: choice.gallery }) : null;
    components = lib ? system.components.length : 0;
    const out = pagesOut({ name, description: s.brief.description ?? "", pages: s.pages, nodes: nodes as never, frameWidth: s.frameWidth, system, palette, published, siteCss, library: lib?.names });
    report = out.report;
    files.push(...(lib?.files ?? []), ...out.files);
    for (const f of site) if (f.path.replace(/^\/+/, "").startsWith("assets/pictures/")) files.push({ path: `public/${f.path.replace(/^\/+/, "")}`, content: isBinary(f) ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)) : f.content });
  }
  /* What both carry: the app's setup, POLIO.md with the System, the design record. */
  files.push(...appSetup(appFiles({ name, parts: [] } as unknown as ScaffoldInput)));
  const md = polioMd({ brief: s.brief, pages: s.pages, nodes: s.nodes as never, format: s.format as Record<string, unknown>, look: s.look as never, frameWidth: s.frameWidth });
  const sysMd = systemMd({ mode: choice.mode, tokens: allTokens(system).length, components: (choice.mode === "clean" && choice.library ? system.components : []).map((c) => ({ name: c.name, variants: c.variants.length })), tokenFiles: Object.values(TOKEN_FILES) });
  files.push({ path: POLIO_MD, content: `${md.trimEnd()}\n\n${sysMd}\n${report ? stillPlacedMd(report) : ""}` });
  files.push({ path: "design/record.json", content: recordWithSystem(system, nodes, s.pages, s.frameWidth, palette) });
  return {
    files: files.map(generated), mode: choice.mode, system, report,
    counts: { tokens: allTokens(system).length, components, pages: s.pages.length, placed: report?.placed.length ?? 0 },
  };
}

/** The branch's files by blob sha, and its export record, read with the key this browser holds (nothing, when it cannot be read: everything is then somebody's or new). */
export async function readBranch(repo: string, branch: string): Promise<{ onBranch: Map<string, string>; record: ExportRecord | null }> {
  let onBranch = new Map<string, string>();
  try {
    const res = await fetch(`/api/studio/publish?tree=1&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`, { headers: publisherHeader(), cache: "no-store" });
    const a = (await res.json()) as { ok?: boolean; tree?: { path: string; sha: string }[] };
    if (a.ok) onBranch = new Map((a.tree ?? []).map((e) => [e.path, e.sha]));
  } catch { /* unreadable: every file is new */ }
  let record: ExportRecord | null = null;
  const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
  if (onBranch.has(EXPORT_RECORD) && token) record = readRecord(await fileAt(fetch, token, repo, branch, EXPORT_RECORD).catch(() => null));
  return { onBranch, record };
}

/** What this export may write over the branch, and the record it carries. */
export async function planExport(ex: Exported, onBranch: ReadonlyMap<string, string>, was: ExportRecord | null): Promise<SyncPlan> {
  const now = await Promise.all(ex.files.map(async (f) => ({ path: f.path, sha: await gitBlobSha(f) })));
  return syncPlan(was, now, onBranch, { mode: ex.mode, target: "next-tailwind", at: new Date().toISOString(), system: { id: ex.system.id, rev: ex.system.rev } });
}

/** Where Go live would push this site: its repository and branch, as the Builds page says. */
export function exportTarget(): { repo: string | null; branch: string | null } {
  const name = useStudio.getState().brief.name?.trim() || activeProject()?.name?.trim() || "site";
  const t = pushTo(name);
  return { repo: t.repo ?? null, branch: t.branch ?? null };
}

/** The export as one zip (the record says every file is Polio's: nothing was there before). */
export async function exportZip(ex: Exported): Promise<Uint8Array> {
  const plan = await planExport(ex, new Map(), null);
  const all = [...ex.files, recordFile(plan.record)];
  const bytes = (f: GeneratedFile) => (f.encoding === "base64" ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)) : new TextEncoder().encode(f.content));
  return zipFiles(all.map((f) => ({ path: f.path, bytes: bytes(f) })));
}

/** The export to the site's repository through Go live: only the files the plan writes, and the record; then Vercel when asked. */
export async function exportToRepo(ex: Exported, plan: SyncPlan, o: { deploy: boolean; say: Parameters<typeof goLive>[0]["say"] }): Promise<void> {
  const going = new Set(plan.write);
  const files = [...ex.files.filter((f) => going.has(f.path)), recordFile(plan.record)];
  const siteName = useStudio.getState().brief.name?.trim() || activeProject()?.name?.trim() || "site";
  /* `still`: Go live's question for a site from code ("this publishes a still copy, without its scripts") is about its own static pages; an export writes the site as code on purpose, from a dialog that already said what it writes. */
  await goLive({ message: `Export from Polio: ${ex.mode === "exact" ? "exact look" : "clean code"}${plan.keep.length ? ` (${plan.keep.length} file${plan.keep.length === 1 ? "" : "s"} edited in the repo kept)` : ""}`, siteName, say: o.say, files, deploy: o.deploy, still: true });
}
