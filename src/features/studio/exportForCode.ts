"use client";
/**
 * Export for code, from the open board (`kitExport.ts` does the work).
 *
 * The regular export, rewritten into a builder-ready repository, with
 * `hooks.json` made and the contract checked by the kit's own check on our
 * server (`/api/studio/kit-map`, `kitMap.ts`), then handed back as files, or
 * downloaded as one zip a code chat starts from (kit/PIPELINE.md, route 1).
 */
import { exportSite } from "./send-out/run";
import { homeFor } from "./homePage";
import { pageFile } from "./staticSite";
import { useStudio } from "./board/store";
import { finishKit, pullPictures, toKit, type KitExport, type KitFile, type KitPart } from "./kitExport";
import { hookChanges, readHookMap, sendDesign, type ChangeNode, type HookChanges, type HookMap } from "./send-out";
import { designRecord, type RecordNode } from "./designRecord";
import type { StyleSource } from "./send-out";
import { heldKeys } from "@/features/keys/store";
import { defaultBranch, fileAt, kitMapOnServer } from "./kitRun";
import { DEFAULT_OFFSITE } from "./shelf";
import { zipFiles } from "./send-out";
import { partRoles } from "./partRoles";
import type { CompNode } from "./components";

export async function exportForCode(): Promise<{ ok: boolean; files: KitFile[]; problems: string[]; says: string; kit?: KitExport }> {
  const s = useStudio.getState();
  if (!s.pages.length) return { ok: false, files: [], problems: [], says: "There is nothing on the board to export yet." };
  /* With the hooks the pages carry: the words and list choices a brought-in page's code finds its way by. */
  const files = (await exportSite(undefined, { hooks: true })) as KitFile[];
  const home = homeFor(s.pages);
  const name = s.brief.name?.trim() || "Site";
  const pages = s.pages.map((p) => ({ file: pageFile(p, home), title: p.name?.trim() || name }));
  /* A part with no source was made here: it is named for what it is called, and listed as new. Only on a site that came from code: elsewhere every part is the Builder's. */
  const fromCode = !!(s.look as { styleSource?: unknown }).styleSource;
  const roles = partRoles(s.nodes as unknown as CompNode[]);
  const parts: Record<string, KitPart> = Object.fromEntries(s.nodes.map((n) => {
    const hook = (n as { hooks?: Record<string, string> | null }).hooks?.["data-hook"];
    const fresh = fromCode && !hook && !(n as { source?: unknown }).source;
    const role = roles.get(n.id);
    return [n.id, { label: n.label, hook, ...(fresh ? { fresh: true, kind: n.featureId } : {}), ...(role ? { role } : {}) }];
  }));
  const raw = toKit({ files, name, pages, parts, links: String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE) });
  /* Pictures written inside the pages and styles become files of their own: the text stays small enough to check and to read. */
  const made = { ...raw, files: pullPictures(raw.files).files };
  const kit = await finishKit(made, kitMapOnServer);
  const says = kit.problems.length ? `${kit.says} The kit's check found ${kit.problems.length} problem${kit.problems.length === 1 ? "" : "s"}: ${kit.problems.slice(0, 3).join("; ")}.` : `${kit.says} kit:check passes on it.`;
  return { ok: !kit.problems.length, files: kit.files, problems: kit.problems, says, kit: made };
}

/**
 * Export for code to a branch of the repository the site came from
 * (`designBranch.ts`): the same export, under `design/` on a new
 * `design/<site>-<date>` branch, with a draft pull request listing the hooks
 * moved, added and removed. Only for a site brought in from a repository,
 * and only once the kit's check passes on it.
 */
export async function exportForCodeToBranch(opts: { fetch?: typeof fetch; date?: Date; onProgress?: (says: string) => void } = {}): Promise<{ ok: boolean; says: string; branch?: string; pull?: string | null; changes?: HookChanges; sent?: number; reused?: number }> {
  const s = useStudio.getState();
  const source = (s.look as { styleSource?: StyleSource & { onBoard?: string[] } }).styleSource;
  if (!source?.repo) return { ok: false, says: "This site did not come from a repository, so there is no branch to send it to. Export for code as a zip instead." };
  const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
  if (!token) return { ok: false, says: "A GitHub key is needed to write the branch. Add it under Keys." };
  const say = opts.onProgress ?? (() => {});
  /* The key first, before the slow part: a key GitHub refuses (401) is said now, not after the export. */
  say(`Asking GitHub for ${source.repo}…`);
  const main = await defaultBranch(opts.fetch ?? fetch, token, source.repo);
  if (!main.ok) return { ok: false, says: main.says };
  say(`Exporting ${s.nodes.length} parts on ${s.pages.length} page${s.pages.length === 1 ? "" : "s"} and running the kit's check…`);
  const got = await exportForCode();
  if (!got.files.length || !got.kit) return { ok: false, says: got.says };
  if (got.problems.length) return { ok: false, says: `Nothing was sent: the kit's check found ${got.problems.length} problem${got.problems.length === 1 ? "" : "s"}: ${got.problems.slice(0, 3).join("; ")}.` };
  /* The code that finds each hook, from its hooks.json as it came in: a removed hook is listed with it, for the code chat to delete. */
  const mapPath = source.kit?.hooks ?? null;
  const map = mapPath ? readHookMap(await fileAt(opts.fetch ?? fetch, token, source.repo, source.ref || "HEAD", mapPath).catch(() => null)) : {};
  const changes = hookChanges(s.nodes as unknown as ChangeNode[], source, { files: got.files, fresh: got.kit.fresh, renamed: got.kit.renamed }, map);
  const site = s.brief.name?.trim() || source.repo.split("/").pop() || "site";
  /* The design record beside it (design/record.json): what a code chat builds from and checks the build against. */
  const made = readHookMap(got.files.find((f) => /(^|\/)hooks\.json$/.test(f.path))?.content);
  const record = boardRecord({ ...made, ...map }, opts.date, Object.fromEntries(got.kit.fresh.map((f) => [f.part, f.hook])));
  const sent = await sendDesign([...got.files, { path: "record.json", content: record }], changes, source.repo, token, { site, date: opts.date, fetch: opts.fetch, onProgress: say });
  if (!sent.ok) return { ok: false, says: sent.says, changes };
  return { ok: true, says: `${sent.says} kit:check passes on it.`, branch: sent.branch, pull: sent.pull, changes, sent: sent.sent, reused: sent.reused };
}

/**
 * The board as a design record (`designRecord.ts`, PST's kit/DESIGN-RECORD.md),
 * as JSON: every page's parts with their hooks, names, the part each sits
 * in (from the repository's hooks.json), hidden states, and which values are
 * the site's tokens, with the owner's settings over them.
 */
export function boardRecord(map: HookMap = {}, date?: Date, fresh: Record<string, string> = {}): string {
  const s = useStudio.getState();
  const source = (s.look as { styleSource?: StyleSource | null }).styleSource ?? null;
  const tokens: Record<string, string> = {};
  for (const f of source?.files ?? []) for (const v of f.vars) if (v.token && !(v.name in tokens)) tokens[v.name] = v.value;
  Object.assign(tokens, source?.varsSet ?? {});
  const parents = Object.fromEntries(Object.entries(map).map(([h, m]) => [h, m.parent ?? null]));
  const files = new Map((source?.files ?? []).map((f) => [f.pageId, f.file]));
  const rec = designRecord(s.nodes as unknown as RecordNode[], s.pages, {
    site: s.brief.name?.trim() || source?.repo.split("/").pop() || "site",
    width: s.frameWidth,
    palette: s.look.palette as Record<string, string>,
    tokens,
    parents,
    pageFile: (id) => files.get(id) ?? null,
    when: (date ?? new Date()).toISOString(),
    fresh,
  });
  return `${JSON.stringify(rec, null, 1)}\n`;
}

/** The export as a zip, downloaded. */
export async function downloadForCode(): Promise<{ ok: boolean; says: string }> {
  const got = await exportForCode();
  if (!got.files.length) return { ok: false, says: got.says };
  const enc = new TextEncoder();
  const bytes = zipFiles(got.files.map((f) => ({ path: f.path, bytes: f.encoding === "base64" ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)) : enc.encode(f.content) })));
  const slug = (useStudio.getState().brief.name || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-for-code.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: got.ok, says: got.says };
}
