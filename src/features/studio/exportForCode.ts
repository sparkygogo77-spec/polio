"use client";
/**
 * Export for code, from the open board (`kitExport.ts` does the work).
 *
 * The regular export, rewritten into a builder-ready repository, with
 * `hooks.json` made and the contract checked by the kit's own check on our
 * server (`/api/studio/kit-map`, `kitMap.ts`), then handed back as files, or
 * downloaded as one zip a code chat starts from (kit/PIPELINE.md, route 1).
 */
import { exportSite } from "./exportSite";
import { homeFor } from "./homePage";
import { pageFile } from "./staticSite";
import { useStudio } from "./store";
import { finishKit, toKit, type KitFile } from "./kitExport";
import { kitMapOnServer } from "./kitRun";
import { DEFAULT_OFFSITE } from "./parts/offsite";
import { zipFiles } from "./zipWrite";

export async function exportForCode(): Promise<{ ok: boolean; files: KitFile[]; problems: string[]; says: string }> {
  const s = useStudio.getState();
  if (!s.pages.length) return { ok: false, files: [], problems: [], says: "There is nothing on the board to export yet." };
  const files = (await exportSite()) as KitFile[];
  const home = homeFor(s.pages);
  const name = s.brief.name?.trim() || "Site";
  const pages = s.pages.map((p) => ({ file: pageFile(p, home), title: p.name?.trim() || name }));
  const parts = Object.fromEntries(s.nodes.map((n) => [n.id, { label: n.label, hook: (n as { hooks?: Record<string, string> | null }).hooks?.["data-hook"] }]));
  const kit = await finishKit(toKit({ files, name, pages, parts, links: String(s.format?.["links.offsite"] ?? DEFAULT_OFFSITE) }), kitMapOnServer);
  const says = kit.problems.length ? `${kit.says} The kit's check found ${kit.problems.length} problem${kit.problems.length === 1 ? "" : "s"}: ${kit.problems.slice(0, 3).join("; ")}.` : `${kit.says} kit:check passes on it.`;
  return { ok: !kit.problems.length, files: kit.files, problems: kit.problems, says };
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
