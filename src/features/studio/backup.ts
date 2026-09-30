"use client";
/**
 * A SITE AS ONE FILE: DOWNLOAD A BACKUP, LOAD A BACKUP.
 *
 * A board lives only in this browser (IndexedDB and localStorage), so
 * clearing the browser, or opening another one, loses it. A backup is one
 * file holding everything needed to put the site back: its document exactly
 * as the Builder stores it, the few facts the site list keeps about it, and
 * the bytes of every picture it points at. Loading one always makes a new
 * site beside the others; it never writes over the one that is open.
 *
 * THE FORMAT IS VERSIONED AND SAYS WHAT IT IS, so that a later home for
 * boards (saved on a server, per person) can read the same file:
 *
 *   {
 *     "kind": "polio-board-backup",
 *     "version": 1,
 *     "savedAt": "2026-09-30T12:04:00.000Z",
 *     "site": { "name", "editedAt", "repo", "source", "live", "published" },
 *     "document": { "state": { …pages, nodes, format, look… }, "version": 0 },
 *     "pictures": [{ "id", "path", "type", "bytes", "data": "<base64>" }],
 *     "missingPictures": ["pic_…"]
 *   }
 *
 * `document` is the envelope the Builder's store persists, whole, so
 * anything added to the document later rides along without this file
 * changing. A newer `version` than this code knows is refused in words
 * rather than half read. No key, token or setting from the Keys panel is
 * ever in it: those live under their own names and are not the site.
 *
 * `tests/board-backup.mjs`.
 */
import { flushDocs, readDoc, unpackDocText } from "./docStore";
import { base64, bytesFor, keepAll, type Picture } from "./pictures";
import { targetTakenBy, sourceOf, useBuilds, type Project } from "@/features/builds/store";

export const BACKUP_KIND = "polio-board-backup";
export const BACKUP_VERSION = 1;
/** A picture larger than this in a backup is not taken in: no site's picture is, and a file that says so is not a picture. */
const PICTURE_MAX = 40 * 1024 * 1024;

export interface BackupPicture { id: string; path: string; type: string; bytes: number; data: string }
export interface BoardBackup {
  kind: typeof BACKUP_KIND;
  version: number;
  savedAt: string;
  site: Pick<Project, "name" | "editedAt" | "repo" | "source" | "live" | "published">;
  document: { state: Record<string, unknown>; version?: number };
  pictures: BackupPicture[];
  missingPictures: string[];
}

const LIVE = "builder.studio";
const slot = (id: string) => `builder.doc:${id}`;

/** Every picture record anywhere in a document: parts, heads, share pictures, whatever holds one. */
export function picturesIn(state: unknown): Picture[] {
  const found = new Map<string, Picture>();
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 40) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    const o = v as Record<string, unknown>;
    /* A picture record by its shape (`Picture`): an id, where it is published, what it is, and its size. Head pictures and a captured video's file are the same record. */
    if (typeof o.id === "string" && typeof o.path === "string" && typeof o.type === "string" && /^(image|video)\//.test(o.type) && (typeof o.bytes === "number" || typeof o.w === "number")) {
      if (!found.has(o.id)) found.set(o.id, o as unknown as Picture);
    }
    for (const k in o) walk(o[k], depth + 1);
  };
  walk(state, 0);
  return [...found.values()];
}

/** A file name a person recognises: the site's name and the day. */
export function backupFileName(name: string, at = new Date()): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";
  return `${slug}-backup-${at.toISOString().slice(0, 10)}.polio.json`;
}

/** The backup of one site, as an object. Null when there is no document to back up. */
export async function makeBackup(projectId: string): Promise<BoardBackup | null> {
  const { projects, activeId } = useBuilds.getState();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  /* Whatever the Builder has written and not yet put in IndexedDB goes there first. */
  await flushDocs();
  const raw = await readDoc(projectId === activeId ? LIVE : slot(projectId));
  if (!raw) return null;
  let document: BoardBackup["document"];
  try {
    document = JSON.parse(unpackDocText(raw)) as BoardBackup["document"];
  } catch {
    return null;
  }
  if (!document?.state) return null;
  const pictures: BackupPicture[] = [];
  const missingPictures: string[] = [];
  for (const pic of picturesIn(document.state)) {
    const blob = await bytesFor(pic);
    if (!blob) { missingPictures.push(pic.id); continue; }
    pictures.push({ id: pic.id, path: pic.path, type: blob.type || pic.type, bytes: blob.size, data: await base64(blob) });
  }
  const { name, editedAt, repo, source, live, published } = project;
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    savedAt: new Date().toISOString(),
    site: { name, editedAt, repo, source, live, published },
    document,
    pictures,
    missingPictures,
  };
}

/** Download the backup of one site as a file. Says what it did, in words. */
export async function downloadBackup(projectId: string): Promise<{ ok: boolean; says: string }> {
  const backup = await makeBackup(projectId);
  if (!backup) return { ok: false, says: "There is nothing saved for this site yet, so there is nothing to back up." };
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName(backup.site.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  useBuilds.getState().setBackedUp(projectId);
  const pics = backup.pictures.length;
  const lost = backup.missingPictures.length;
  return {
    ok: true,
    says: `Downloaded ${a.download}${pics ? `, with ${pics} picture${pics === 1 ? "" : "s"}` : ""}.${lost ? ` ${lost} picture${lost === 1 ? " was" : "s were"} no longer in this browser and could not go in it.` : ""}`,
  };
}

/** Read a backup file's words into a checked backup, or say why it is not one. */
export function readBackup(text: string): { ok: true; backup: BoardBackup } | { ok: false; says: string } {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return { ok: false, says: "That file is not a backup: it is not the kind of file Download a backup makes." }; }
  const b = v as Partial<BoardBackup>;
  if (!b || typeof b !== "object" || b.kind !== BACKUP_KIND) return { ok: false, says: "That file is not a backup of a site from this Builder." };
  if (typeof b.version !== "number" || b.version < 1) return { ok: false, says: "That backup has no version the Builder can read." };
  if (b.version > BACKUP_VERSION) return { ok: false, says: `That backup was made by a newer Builder (format ${b.version}; this one reads up to ${BACKUP_VERSION}). Open it in the newer Builder.` };
  const state = b.document?.state as Record<string, unknown> | undefined;
  if (!state || typeof state !== "object" || !Array.isArray(state.pages) || !Array.isArray(state.nodes)) return { ok: false, says: "That backup has no site in it: its pages are missing." };
  const pictures = (Array.isArray(b.pictures) ? b.pictures : []).filter((p): p is BackupPicture =>
    !!p && typeof p.id === "string" && /^[\w.-]{1,160}$/.test(p.id) && typeof p.type === "string" && /^(image|video)\//.test(p.type) && typeof p.data === "string" && p.data.length <= PICTURE_MAX * 1.4);
  const site = (b.site && typeof b.site === "object" ? b.site : {}) as BoardBackup["site"];
  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      version: b.version,
      savedAt: typeof b.savedAt === "string" ? b.savedAt : "",
      site: { ...site, name: typeof site.name === "string" && site.name.trim() ? site.name.trim().slice(0, 120) : "Site from a backup" },
      document: { state, version: typeof b.document?.version === "number" ? b.document.version : 0 },
      pictures,
      missingPictures: Array.isArray(b.missingPictures) ? b.missingPictures.filter((x): x is string => typeof x === "string") : [],
    },
  };
}

const blobOf = (p: BackupPicture): Blob => {
  const bin = atob(p.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: p.type });
};

/**
 * Put a backup back as a new site beside the others. Its pictures are kept
 * under the ids its document names; its publish target comes with it only
 * when no other site here publishes there and it is not a repository a site
 * was brought in from, so a loaded backup never takes another site's live
 * address from it.
 */
export async function loadBackup(text: string): Promise<{ ok: boolean; says: string; id?: string }> {
  const read = readBackup(text);
  if (!read.ok) return read;
  const { backup } = read;
  const list: { pic: Picture; blob: Blob }[] = [];
  for (const p of backup.pictures) {
    try { list.push({ pic: { id: p.id, path: p.path, type: p.type, w: 0, h: 0, bytes: p.bytes, alt: "", from: "upload" }, blob: blobOf(p) }); } catch { /* one bad picture costs only itself */ }
  }
  const kept = await keepAll(list);
  const s = backup.site;
  const repoFree = !!s.repo && !sourceOf(`${s.repo.owner}/${s.repo.name}`) && !targetTakenBy("", s.repo);
  const meta: Omit<Project, "id"> = {
    name: s.name,
    updatedAt: Date.now(),
    editedAt: typeof s.editedAt === "number" ? s.editedAt : undefined,
    backedUpAt: Date.now(),
    source: s.source,
    ...(repoFree ? { repo: s.repo, bound: "connected" as const, live: s.live, published: s.published } : {}),
  };
  const id = await useBuilds.getState().restore(meta, JSON.stringify({ state: backup.document.state, version: backup.document.version ?? 0 }));
  const lost = backup.pictures.length - kept + backup.missingPictures.length;
  return {
    ok: true,
    id,
    says: `${s.name} is back, as a new site beside the others${kept ? `, with ${kept} picture${kept === 1 ? "" : "s"}` : ""}.${lost ? ` ${lost} picture${lost === 1 ? " was" : "s were"} not in the backup.` : ""}${s.repo && !repoFree ? " It has no publish target yet: another site here already publishes where it did." : ""}`,
  };
}

/** Ask for a backup file and load it. Resolves with what happened, or null when nothing was chosen. */
export function pickAndLoadBackup(): Promise<{ ok: boolean; says: string; id?: string } | null> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.setAttribute("data-backup-input", "");
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) { done(null); return; }
      done(await loadBackup(await file.text()));
    };
    input.addEventListener("cancel", () => { input.remove(); done(null); });
    document.body.appendChild(input);
    input.click();
  });
}
