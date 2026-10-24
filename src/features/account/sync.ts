"use client";
/**
 * THIS BROWSER'S WORK AND THE ACCOUNT'S, KEPT TOGETHER.
 *
 * A sync is three steps, always in this order and never destructive:
 *
 * 1. **Shelf things** (`data/prefs.json`): saved textures, what the shelf
 *    learned, and the capture runs this browser remembers (with the capturer
 *    it was set to), so a run started in one browser is listed in the
 *    Capture dialog of every other. The account's are merged into this browser's (union, nothing
 *    dropped), then the merged set is saved back.
 * 2. **Sites from the account**: a site this browser does not have yet comes
 *    in as a new site beside the others. A site it has, changed elsewhere and
 *    not here, is brought up to date, unless it is the one open (then it
 *    waits). Changed in both places: the account's copy comes in as a new
 *    site and this browser's stays, so neither is lost.
 * 3. **Sites from here**: every site new or edited since its last save goes
 *    up, as its backup (`studio/backup.ts`) with the picture bytes saved
 *    once each beside it.
 *
 * So the first sign-in copies everything in this browser into the account,
 * and the account never deletes anything this browser holds.
 *
 * Which local site is which account site is kept in `builder.account.links`.
 *
 * **A picture the account refuses does not fail its site.** When the server
 * answers a picture with a refusal (a 4xx that is about that file: a type it
 * does not keep, a drawing it cannot read, too big), that one picture is
 * skipped, the site and everything else are saved, and the refusal is
 * remembered in `builder.account.refused` with the server's own reason. It is
 * said once, when it first happens; it is not tried again every minute, only
 * when the picture itself changes or "Save and bring in now" is pressed. A
 * refusal that is about the key or the moment (401, 403, 408, 429, 5xx) is
 * not about the file and still stops the sync, as before.
 */
import { upload } from "@vercel/blob/client";
import { useBuilds, type Project } from "@/features/builds/store";
import { loadBackup, makeBackup, readBackup, type BoardBackup, type BackupPicture } from "@/features/studio/backup";
import { flushDocs, writeDocNow } from "@/features/studio/docStore";
import { keepAll } from "@/features/studio/pictures";
import { keepAllRuns, mergeRemembered, readRuns, type CaptureRun } from "@/features/studio/captureRuns";
import { learnedNow, useLearned } from "@/features/studio/shelf/ui";
import { libraryList, mergeLibrary } from "@/features/studio/system/store";

export const LINKS_KEY = "builder.account.links";
const TEXTURES_KEY = "builder.savedTextures";
const CAPTURER_KEY = "builder.capturer.v2";
const PUT_MAX = 4 * 1024 * 1024;
export const SITE_KIND = "polio-account-site";
export const REFUSED_KEY = "builder.account.refused";

/** A picture the account refused: what it was, in which site, and the server's reason. `sig` changes when the picture does. */
export type Refused = Record<string, { sig: string; says: string; site: string }>;

export function readRefused(): Refused {
  try {
    const v = JSON.parse(localStorage.getItem(REFUSED_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Refused) : {};
  } catch { return {}; }
}
const writeRefused = (r: Refused) => { try { localStorage.setItem(REFUSED_KEY, JSON.stringify(r)); } catch { /* said again next sync */ } };

/** A refusal about the file itself, not about the key, the clock or the server. */
const aboutTheFile = (e: unknown): e is AccountError => e instanceof AccountError && e.status >= 400 && e.status < 500 && ![401, 403, 408, 429].includes(e.status);

/** Type, size and a quick hash of the bytes: the same picture gives the same signature. */
function sigOf(p: BackupPicture): string {
  let h = 2166136261;
  for (let i = 0; i < p.data.length; i++) h = Math.imul(h ^ p.data.charCodeAt(i), 16777619);
  return `${p.type}:${p.bytes}:${(h >>> 0).toString(16)}`;
}

/** Local site id → the account's id for it, the version last seen there, and the edit it matched. */
export type Links = Record<string, { aid: string; etag: string; edited: number }>;

export function readLinks(): Links {
  try {
    const v = JSON.parse(localStorage.getItem(LINKS_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Links) : {};
  } catch { return {}; }
}
const writeLinks = (l: Links) => { try { localStorage.setItem(LINKS_KEY, JSON.stringify(l)); } catch { /* next sync tries again */ } };

const safeId = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
const randomId = () => `s${Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
const sitePath = (aid: string) => `data/sites/${aid}.json`;
const picPath = (id: string) => `data/pictures/${id}`;
const PIC_OK = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,159}$/;
const editedOf = (p: Project) => p.editedAt ?? p.updatedAt ?? 0;

export class AccountError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) { super(message); this.status = status; this.code = code; }
}

/** What the server said went wrong, and what to do; when it said nothing (a crash page), what the status means. */
export function reasonOf(b: { says?: string; todo?: string } | null | undefined, status: number): string {
  if (b?.says) return b.todo ? `${b.says} ${b.todo}` : b.says;
  if (status >= 500) return "The server had a problem and did not say why. Try again in a moment.";
  if (status === 404) return "The server has no such place. This page may be newer or older than the server.";
  return `The server refused this (${status}). Try again in a moment.`;
}

export function api(key: string) {
  const auth = { authorization: `Bearer ${key}` };
  const fail = async (res: Response) => {
    const b = (await res.json().catch(() => ({}))) as { says?: string; todo?: string; code?: string };
    return new AccountError(reasonOf(b, res.status), res.status, b.code ?? null);
  };
  return {
    async manifest(): Promise<Map<string, { etag: string; size: number }>> {
      const res = await fetch("/api/account/data", { headers: auth, cache: "no-store" });
      if (!res.ok) throw await fail(res);
      const b = (await res.json()) as { items: { path: string; etag: string; size: number }[] };
      return new Map(b.items.map((i) => [i.path, { etag: i.etag, size: i.size }]));
    },
    async get(path: string): Promise<Blob | null> {
      const res = await fetch(`/api/account/data?path=${encodeURIComponent(path)}`, { headers: auth, cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw await fail(res);
      return res.blob();
    },
    async put(path: string, body: Blob, type: string): Promise<string> {
      if (body.size <= PUT_MAX) {
        const res = await fetch(`/api/account/data?path=${encodeURIComponent(path)}`, { method: "PUT", headers: { ...auth, "content-type": type }, body });
        /* A picture is written once; already there is as good as saved. */
        if (res.status === 409 && path.startsWith("data/pictures/")) return "";
        if (!res.ok) throw await fail(res);
        return ((await res.json()) as { etag: string }).etag;
      }
      const r = await upload(path, body, { access: "private", handleUploadUrl: "/api/account/upload", headers: auth, contentType: type });
      return r.etag;
    },
  };
}
type Api = ReturnType<typeof api>;

const blobOf = (p: BackupPicture): Blob => {
  const bin = atob(p.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: p.type });
};
const base64Of = async (b: Blob): Promise<string> => {
  const u = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/* ── 1. shelf things ─────────────────────────────────────────────── */

interface Prefs { kind: "polio-account-prefs"; version: 1; textures: { key: string }[]; learned?: unknown; captureRuns?: CaptureRun[]; capturer?: string; /** The library of Systems (`studio/system/store.ts`): merged by id, the later copy of each kept. */ systems?: unknown[] }

async function syncPrefs(a: Api, man: Map<string, { etag: string }>): Promise<void> {
  let theirs: Prefs | null = null;
  if (man.has("data/prefs.json")) {
    try { theirs = JSON.parse(await (await a.get("data/prefs.json"))!.text()) as Prefs; } catch { theirs = null; }
  }
  let mine: { key: string }[] = [];
  try { const v = JSON.parse(localStorage.getItem(TEXTURES_KEY) ?? "[]"); if (Array.isArray(v)) mine = v; } catch { /* none here */ }
  const textures = [...mine];
  for (const t of Array.isArray(theirs?.textures) ? theirs!.textures : []) {
    if (t && typeof t.key === "string" && !textures.some((m) => m.key === t.key)) textures.push(t);
  }
  if (textures.length !== mine.length) { try { localStorage.setItem(TEXTURES_KEY, JSON.stringify(textures)); } catch { /* kept in the account */ } }
  if (theirs?.learned && typeof theirs.learned === "object") {
    try { useLearned.getState().take(theirs.learned as Parameters<ReturnType<typeof useLearned.getState>["take"]>[0]); } catch { /* the shelf keeps its own */ }
  }
  mergeLibrary(theirs?.systems);
  const mineRuns = readRuns();
  const runs = mergeRemembered(mineRuns, theirs?.captureRuns);
  if (JSON.stringify(runs) !== JSON.stringify(mineRuns)) keepAllRuns(runs);
  let capturer = "";
  try { capturer = localStorage.getItem(CAPTURER_KEY) ?? ""; } catch { /* none here */ }
  if (!capturer && typeof theirs?.capturer === "string" && /^[\w.-]+\/[\w.-]+$/.test(theirs.capturer)) {
    capturer = theirs.capturer;
    try { localStorage.setItem(CAPTURER_KEY, capturer); } catch { /* kept in the account */ }
  }
  const next: Prefs = { kind: "polio-account-prefs", version: 1, textures, learned: learnedNow(), captureRuns: runs, ...(capturer ? { capturer } : {}), systems: libraryList() };
  const text = JSON.stringify(next);
  if (theirs && JSON.stringify(theirs) === text) return;
  await a.put("data/prefs.json", new Blob([text], { type: "application/json" }), "application/json");
}

/* ── 2. sites from the account ───────────────────────────────────── */

type SavedSite = Omit<BoardBackup, "kind" | "pictures"> & { kind: typeof SITE_KIND; aid: string; pictures: Omit<BackupPicture, "data">[] };

async function backupFrom(a: Api, site: SavedSite): Promise<BoardBackup> {
  const pictures: BackupPicture[] = [];
  const missing = [...(site.missingPictures ?? [])];
  for (const p of site.pictures ?? []) {
    const b = PIC_OK.test(p.id) ? await a.get(picPath(p.id)).catch(() => null) : null;
    if (!b) { missing.push(p.id); continue; }
    pictures.push({ ...p, data: await base64Of(b) });
  }
  const { aid: _aid, kind: _kind, ...rest } = site;
  void _aid; void _kind;
  /* Read as strictly as a backup file: whoever holds a key wrote this. Pictures must be pictures, and a site from the account never brings a publish target with it. */
  const checked = readBackup(JSON.stringify({ ...rest, kind: "polio-board-backup", pictures, missingPictures: missing }));
  if (!checked.ok) throw new Error(checked.says);
  const { name, editedAt, source } = checked.backup.site;
  return { ...checked.backup, site: { name, editedAt: typeof editedAt === "number" ? editedAt : undefined, source } as BoardBackup["site"] };
}

/** Bring the account's newer copy over a site this browser has not changed. */
async function takeInto(localId: string, backup: BoardBackup): Promise<void> {
  await keepAll(backup.pictures.map((p) => ({ pic: { id: p.id, path: p.path, type: p.type, w: 0, h: 0, bytes: p.bytes, alt: "", from: "upload" as const }, blob: blobOf(p) })));
  await writeDocNow(`builder.doc:${localId}`, JSON.stringify({ state: backup.document.state, version: backup.document.version ?? 0 }));
  useBuilds.setState((s) => ({
    projects: s.projects.map((p) => (p.id === localId ? { ...p, name: backup.site.name || p.name, editedAt: backup.site.editedAt ?? p.editedAt, updatedAt: Date.now() } : p)),
  }));
}

export interface SyncReport { up: number; down: number; updated: number; both: number; waiting: string[]; failed: string[]; /** Pictures refused for the first time in this sync (earlier refusals are not repeated). */ skipped: { id: string; site: string; says: string }[] }

async function pullSites(a: Api, man: Map<string, { etag: string }>, links: Links, report: SyncReport): Promise<void> {
  const { projects } = useBuilds.getState();
  const byAid = new Map(Object.entries(links).filter(([id]) => projects.some((p) => p.id === id)).map(([id, l]) => [l.aid, { id, ...l }]));
  for (const [path, { etag }] of man) {
    const m = /^data\/sites\/([A-Za-z0-9_-]+)\.json$/.exec(path);
    if (!m) continue;
    const aid = m[1]!;
    const here = byAid.get(aid);
    if (here && here.etag === etag) continue;
    const project = here ? projects.find((p) => p.id === here.id) : undefined;
    try {
      const text = await (await a.get(path))?.text();
      if (!text) continue;
      const site = JSON.parse(text) as SavedSite;
      if (site.kind !== SITE_KIND) continue;
      const backup = await backupFrom(a, site);
      /* Downloads take a while: what is open and what changed is read again now, not trusted from before them. */
      const nowState = useBuilds.getState();
      const fresh = here ? nowState.projects.find((p) => p.id === here.id) : undefined;
      if (here && fresh && editedOf(fresh) === here.edited) {
        if (fresh.id === nowState.activeId) { report.waiting.push(fresh.name); continue; }
        await takeInto(fresh.id, backup);
        const after = useBuilds.getState().projects.find((p) => p.id === fresh.id);
        links[fresh.id] = { aid, etag, edited: after ? editedOf(after) : 0 };
        report.updated++;
        continue;
      }
      /* New here, or changed in both places: the account's copy comes in beside, and this browser's own copy (if any) becomes its own account site. */
      if (here && fresh) {
        backup.site = { ...backup.site, name: `${backup.site.name} (account copy)` };
        links[fresh.id] = { aid: randomId(), etag: "", edited: -1 };
        report.both++;
      }
      const r = await loadBackup(JSON.stringify(backup));
      if (r.ok && r.id) {
        const now = useBuilds.getState().projects.find((p) => p.id === r.id);
        links[r.id] = { aid, etag, edited: now ? editedOf(now) : 0 };
        report.down++;
      } else report.failed.push(site.site?.name ?? aid);
    } catch {
      report.failed.push(project?.name ?? aid);
    }
    writeLinks(links);
  }
}

/* ── 3. sites from here ──────────────────────────────────────────── */

async function pushSites(a: Api, man: Map<string, { etag: string }>, links: Links, report: SyncReport): Promise<void> {
  await flushDocs();
  const refused = readRefused();
  for (const p of useBuilds.getState().projects) {
    const link = links[p.id];
    /* Changed here means its edit stamp is not the one last saved or taken: compared for sameness, never order, so two browsers' clocks never decide. */
    if (link && link.etag && editedOf(p) === link.edited) continue;
    const aid = link?.aid ?? (safeId(p.id) || randomId());
    /* Saved elsewhere since this browser last saw it: step 2 deals with that first. */
    const there = man.get(sitePath(aid));
    if (link?.etag && there && there.etag !== link.etag) continue;
    try {
      const backup = await makeBackup(p.id);
      if (!backup) continue;
      for (const pic of backup.pictures) {
        if (!PIC_OK.test(pic.id) || man.has(picPath(pic.id))) continue;
        const sig = sigOf(pic);
        const before = refused[pic.id];
        if (before?.sig === sig) continue;
        try {
          const etag = await a.put(picPath(pic.id), blobOf(pic), pic.type);
          man.set(picPath(pic.id), { etag });
          if (before) { delete refused[pic.id]; writeRefused(refused); }
        } catch (err) {
          if (!aboutTheFile(err)) throw err;
          refused[pic.id] = { sig, says: err.message, site: p.name };
          writeRefused(refused);
          report.skipped.push({ id: pic.id, site: p.name, says: err.message });
        }
      }
      const site: SavedSite = { ...backup, kind: SITE_KIND, aid, pictures: backup.pictures.map(({ data: _d, ...rest }) => { void _d; return rest; }) };
      const etag = await a.put(sitePath(aid), new Blob([JSON.stringify(site)], { type: "application/json" }), "application/json");
      man.set(sitePath(aid), { etag });
      links[p.id] = { aid, etag, edited: editedOf(p) };
      writeLinks(links);
      report.up++;
    } catch {
      report.failed.push(p.name);
    }
  }
}

let running: Promise<SyncReport> | null = null;

/** One whole sync. Two at once never run: the second waits for the first's answer. */
export function syncAll(key: string, o: { retryRefused?: boolean } = {}): Promise<SyncReport> {
  if (running) return running;
  running = (async () => {
    await useBuilds.persist.rehydrate();
    const a = api(key);
    const report: SyncReport = { up: 0, down: 0, updated: 0, both: 0, waiting: [], failed: [], skipped: [] };
    if (o.retryRefused) writeRefused({});
    const man = await a.manifest();
    await syncPrefs(a, man);
    const links = readLinks();
    await pullSites(a, man, links, report);
    await pushSites(a, man, links, report);
    writeLinks(links);
    return report;
  })().finally(() => { running = null; });
  return running;
}

export function reportSays(r: SyncReport): string {
  const bits: string[] = [];
  if (r.up) bits.push(`${r.up} site${r.up === 1 ? "" : "s"} saved to the account`);
  if (r.down) bits.push(`${r.down} brought here from the account`);
  if (r.updated) bits.push(`${r.updated} brought up to date`);
  if (r.both) bits.push(`${r.both} changed in two places, so the account's copy is beside yours`);
  let s = bits.length ? `${bits.join(", ")}.` : "Everything here is already in the account.";
  if (r.waiting.length) s += ` ${r.waiting.join(", ")} has a newer copy in the account: open another site to bring it here.`;
  for (const k of r.skipped) s += ` The picture ${k.id} in ${k.site} was not saved, and the rest was: ${k.says}`;
  if (r.failed.length) s += ` Could not save ${r.failed.join(", ")}; the next sync tries again.`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
