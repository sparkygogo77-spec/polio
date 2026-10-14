"use client";
import * as React from "react";
import { Box, Camera, Download, FolderOpen, Grid3x3, LayoutGrid, RefreshCw, RotateCw, Search, Upload } from "lucide-react";
import type { RouteProps } from "@/core/types";
import { Button, EmptyState, Input, Segmented, VirtualList } from "@/core/ui";
import { cn } from "@/core/lib/cn";
import { heldKeys, keysReady } from "@/features/keys/store";
import type { ModelFile } from "@/app/api/models/route";
import { MODEL_DEFAULTS } from "./defaults";
import { BACKGROUNDS, VIEWS, Viewer, type Background, type ModelInfo } from "./viewer";

/**
 * /models: the Blender and Blockbench models of a repository, in 3D.
 *
 * Made so a model hand-off can be looked at without opening Blender or the
 * game: the list is every .glb, .gltf and .bbmodel under the folders in the
 * address, newest hand-off first, and the address says everything about what
 * is open, so a link is the whole review:
 *
 *   /models?ref=<branch>&dir=docs/handoff/<day>&model=<path>&view=front&bg=sky
 *
 * `sheet=1` lays the nine views of J's concept sheets out at once. A file can
 * also be dropped on the canvas from this computer, which reads it here and
 * sends it nowhere.
 *
 * The page answers a headless browser too: `window.__modelViewer` says when a
 * model is ready and hands out PNGs (`scripts/model-shots.mjs` drives it).
 */

interface Source { repo: string; ref: string; dirs: string[] }

const read = (): { source: Source; model: string | null; view: string | null; bg: Background; sheet: boolean } => {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const bg = q.get("bg") as Background | null;
  return {
    source: {
      repo: q.get("repo") || MODEL_DEFAULTS.repo,
      ref: q.get("ref") || MODEL_DEFAULTS.ref,
      dirs: q.get("dir") ? q.get("dir")!.split(",").map((d) => d.trim()).filter(Boolean) : MODEL_DEFAULTS.dirs,
    },
    model: q.get("model"),
    view: q.get("view"),
    bg: bg && bg in BACKGROUNDS ? bg : "dark",
    sheet: q.get("sheet") === "1",
  };
};

/** Keep the address in step with what is open, without a navigation. */
function write(patch: Record<string, string | null>) {
  const u = new URL(window.location.href);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === "") u.searchParams.delete(k);
    else u.searchParams.set(k, v);
  }
  window.history.replaceState(window.history.state, "", u.toString());
}

const auth = (): Record<string, string> => {
  const t = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  return t ? { "x-github-token": t } : {};
};

const sourceQuery = (s: Source) => `repo=${encodeURIComponent(s.repo)}&ref=${encodeURIComponent(s.ref)}`;

async function ask<T>(url: string): Promise<T> {
  await keysReady().catch(() => {});
  const res = await fetch(url, { headers: auth(), cache: "no-store" });
  const body = (await res.json().catch(() => ({ message: `The server answered ${res.status}.` }))) as T & { ok?: boolean; message?: string };
  if (!res.ok || body.ok === false) throw new Error(body.message ?? `The server answered ${res.status}.`);
  return body;
}

const kb = (n: number) => (n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const folderOf = (p: string) => p.slice(0, p.lastIndexOf("/"));
const fileOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);

type Row = { kind: "folder"; folder: string } | { kind: "file"; file: ModelFile };

declare global {
  interface Window {
    __modelViewer?: {
      ready: boolean;
      error: string | null;
      info: ModelInfo | null;
      open: (path: string) => Promise<void>;
      view: (label: string, yaw?: number, pitch?: number) => void;
      sheet: (cell?: number) => string;
      snapshot: () => string;
      background: (b: Background) => void;
    };
  }
}

export function ModelsPage(_: RouteProps) {
  const initial = React.useMemo(read, []);
  const [source, setSource] = React.useState<Source>(initial.source);
  const [draft, setDraft] = React.useState({ repo: initial.source.repo, ref: initial.source.ref, dirs: initial.source.dirs.join(", ") });
  const [files, setFiles] = React.useState<ModelFile[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(initial.model);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<ModelInfo | null>(null);
  const [bg, setBg] = React.useState<Background>(initial.bg);
  const [spin, setSpin] = React.useState(false);
  const [grid, setGrid] = React.useState(true);
  const [wire, setWire] = React.useState(false);
  const [sheet, setSheet] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const host = React.useRef<HTMLDivElement>(null);
  const viewer = React.useRef<Viewer | null>(null);
  const picker = React.useRef<HTMLInputElement>(null);
  const opener = React.useRef<(path: string) => Promise<void>>(async () => {});
  const settings = React.useRef({ grid, wire, wantSheet: initial.sheet, view: initial.view });
  settings.current.grid = grid;
  settings.current.wire = wire;

  React.useEffect(() => {
    if (!host.current) return;
    const v = new Viewer(host.current);
    viewer.current = v;
    // The headless browser's handle on the page, made once with the viewer.
    window.__modelViewer = {
      ready: false,
      error: null,
      info: null,
      open: (p) => opener.current(p),
      view: (l, y, p) => v.view(l, y, p),
      sheet: (c) => v.sheet(c),
      snapshot: () => v.snapshot(),
      background: (b) => setBg(b),
    };
    // The model in the address opens once the viewer is up.
    if (initial.model) void opener.current(initial.model);
    return () => { v.dispose(); viewer.current = null; delete window.__modelViewer; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => { viewer.current?.setBackground(bg); }, [bg]);
  React.useEffect(() => { if (viewer.current) viewer.current.spin = spin; }, [spin]);
  React.useEffect(() => { viewer.current?.setGrid(grid); }, [grid, info]);
  React.useEffect(() => { viewer.current?.setWireframe(wire); }, [wire, info]);

  const list = React.useCallback(async (s: Source) => {
    setFiles(null);
    setListError(null);
    try {
      const r = await ask<{ files: ModelFile[] }>(`/api/models?${sourceQuery(s)}&dir=${encodeURIComponent(s.dirs.join(","))}`);
      setFiles(r.files);
    } catch (e) {
      setListError((e as Error).message);
      setFiles([]);
    }
  }, []);
  React.useEffect(() => { void list(source); }, [list, source]);

  const show = React.useCallback(async (name: string, bytes: () => Promise<ArrayBuffer>) => {
    const v = viewer.current;
    if (!v) return;
    setLoading(true);
    setError(null);
    setSheet(null);
    const api = window.__modelViewer;
    if (api) { api.ready = false; api.error = null; api.info = null; }
    try {
      const got = await v.load(name, await bytes());
      // A viewer torn down while this loaded (a remount) is not the one on screen.
      if (v !== viewer.current) return;
      v.setGrid(settings.current.grid);
      v.setWireframe(settings.current.wire);
      if (settings.current.view) { v.view(settings.current.view); settings.current.view = null; }
      setInfo(got);
      if (api) { api.info = got; api.ready = true; }
      if (settings.current.wantSheet) { settings.current.wantSheet = false; setSheet(v.sheet()); }
    } catch (e) {
      const m = (e as Error).message || String(e);
      setError(m);
      if (api) api.error = m;
    } finally {
      setLoading(false);
    }
  }, []);

  const openPath = React.useCallback(async (path: string, s: Source = source) => {
    setOpen(path);
    write({ model: path });
    await show(path, async () => {
      const r = await ask<{ url: string }>(`/api/models?${sourceQuery(s)}&path=${encodeURIComponent(path)}`);
      const res = await fetch(r.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`GitHub's download link answered ${res.status}.`);
      return res.arrayBuffer();
    });
  }, [show, source]);

  opener.current = openPath;

  const openFile = React.useCallback((file: File) => {
    setOpen(null);
    write({ model: null });
    void show(file.name, () => file.arrayBuffer());
  }, [show]);



  const rows = React.useMemo<Row[]>(() => {
    const f = filter.trim().toLowerCase();
    const shown = (files ?? []).filter((x) => !f || x.path.toLowerCase().includes(f));
    // Newest hand-off first: their folders are named by day.
    const folders = [...new Set(shown.map((x) => folderOf(x.path)))].sort((a, b) => {
      const ha = a.startsWith("docs/handoff"), hb = b.startsWith("docs/handoff");
      if (ha !== hb) return ha ? -1 : 1;
      return ha ? b.localeCompare(a) : a.localeCompare(b);
    });
    return folders.flatMap((folder): Row[] => [
      { kind: "folder", folder },
      ...shown.filter((x) => folderOf(x.path) === folder).sort((a, b) => a.path.localeCompare(b.path)).map((file): Row => ({ kind: "file", file })),
    ]);
  }, [files, filter]);

  const apply = () => {
    const s: Source = { repo: draft.repo.trim() || MODEL_DEFAULTS.repo, ref: draft.ref.trim() || MODEL_DEFAULTS.ref, dirs: draft.dirs.split(",").map((d) => d.trim()).filter(Boolean) };
    write({ repo: s.repo === MODEL_DEFAULTS.repo ? null : s.repo, ref: s.ref === MODEL_DEFAULTS.ref ? null : s.ref, dir: s.dirs.join(",") === MODEL_DEFAULTS.dirs.join(",") ? null : s.dirs.join(",") });
    setSource(s);
  };

  const save = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };
  const base = (info?.name ? fileOf(info.name) : "model").replace(/\.[^.]+$/, "");

  return (
    <div className="absolute inset-0 flex min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-panel">
        <div className="flex flex-col gap-1.5 border-b border-border p-2">
          <div className="text-plain font-medium text-fg-muted">Models from</div>
          <Input mono value={draft.repo} onChange={(e) => setDraft({ ...draft, repo: e.target.value })} placeholder="owner/repo" aria-label="Repository" />
          <Input mono value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} placeholder="branch" aria-label="Branch" />
          <Input mono value={draft.dirs} onChange={(e) => setDraft({ ...draft, dirs: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") apply(); }} placeholder="folders, comma separated" aria-label="Folders" />
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1" onClick={apply}><RefreshCw />Load list</Button>
            <Button size="sm" onClick={() => picker.current?.click()} title="Open a .glb or .bbmodel from this computer"><Upload />File</Button>
          </div>
          <input ref={picker} type="file" accept=".glb,.gltf,.bbmodel" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ""; }} />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" left={<Search className="size-3 text-fg-muted" />} aria-label="Filter models" />
        </div>
        {listError ? (
          <EmptyState icon={FolderOpen} title="No list" body={listError} />
        ) : files === null ? (
          <div className="p-3 text-plain text-fg-muted">Asking GitHub…</div>
        ) : (
          <VirtualList
            className="min-h-0 flex-1"
            items={rows}
            estimateSize={28}
            getKey={(r) => (r.kind === "folder" ? `d:${r.folder}` : r.file.path)}
            empty={<EmptyState icon={Box} title="No models here" body="No .glb, .gltf or .bbmodel files under these folders." />}
            renderItem={(r) =>
              r.kind === "folder" ? (
                <div className="truncate px-2 pb-1 pt-3 font-mono text-plain text-fg-muted" title={r.folder}>{r.folder}</div>
              ) : (
                <button
                  type="button"
                  onClick={() => void openPath(r.file.path)}
                  className={cn("flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-hover", open === r.file.path && "bg-accent-soft text-accent")}
                  title={r.file.path}
                >
                  <span className="min-w-0 flex-1 truncate">{fileOf(r.file.path)}</span>
                  <span className="shrink-0 text-plain text-fg-muted">{kb(r.file.size)}</span>
                </button>
              )
            }
          />
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-2">
          <Segmented
            size="xs"
            value="__"
            onChange={(v) => viewer.current?.view(v)}
            options={VIEWS.map(([l]) => ({ value: l, label: l }))}
            aria-label="View"
          />
          <Segmented size="xs" value={bg} onChange={(v) => { setBg(v as Background); write({ bg: v === "dark" ? null : v }); }} options={Object.keys(BACKGROUNDS).map((b) => ({ value: b, label: b }))} aria-label="Background" />
          <Button size="sm" variant={spin ? "subtle" : "default"} onClick={() => setSpin(!spin)}><RotateCw />Spin</Button>
          <Button size="sm" variant={grid ? "subtle" : "default"} onClick={() => setGrid(!grid)}><Grid3x3 />Blocks</Button>
          <Button size="sm" variant={wire ? "subtle" : "default"} onClick={() => setWire(!wire)}>Wire</Button>
          <Button size="sm" disabled={!info} onClick={() => viewer.current && setSheet(viewer.current.sheet())}><LayoutGrid />Nine views</Button>
          <Button size="sm" disabled={!info} onClick={() => viewer.current && save(viewer.current.snapshot(), `${base}.png`)}><Camera />PNG</Button>
        </div>
        <div
          className="relative min-h-0 flex-1"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) openFile(f); }}
        >
          <div ref={host} className="absolute inset-0" />
          {!info && !loading && !error ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <EmptyState icon={Box} title="Pick a model" body="Choose one from the list, or drop a .glb or .bbmodel here." />
            </div>
          ) : null}
          {loading ? <div className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Loading…</div> : null}
          {error ? <div className="absolute left-3 top-3 max-w-md rounded bg-down/80 px-2 py-1 text-xs text-white">{error}</div> : null}
          {dragging ? <div className="pointer-events-none absolute inset-2 rounded-lg border-2 border-dashed border-accent" /> : null}
          {info ? (
            <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 font-mono text-plain text-white">
              {fileOf(info.name)} · {info.size.map((n) => n.toFixed(2)).join(" × ")} blocks · {Math.round(info.triangles).toLocaleString()} tris
              {info.cubes !== undefined ? ` · ${info.cubes} cubes` : ""}
            </div>
          ) : null}
          {sheet ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-4">
              <img src={sheet} alt={`Nine views of ${base}`} className="max-h-[calc(100%-3rem)] max-w-full rounded" />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => save(sheet, `${base}-sheet.png`)}><Download />Save</Button>
                <Button size="sm" onClick={() => setSheet(null)}>Close</Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
