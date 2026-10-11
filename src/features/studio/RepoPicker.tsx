"use client";
/**
 * THE REPO MENU: one place for repositories, in two parts.
 *
 * HIS COMPLAINT: there were two places doing overlapping things. This sheet
 * ("Bring a repository in", a searchable list) and the GitHub button's
 * panel ("The repo this site goes to", "Bring in one of your repos", "Make
 * a new repo", "Bring a repo in" with an owner/name field). And a branch, or
 * a site kept in a folder, had to be typed as `owner/sink@branch/sites/name`.
 *
 * So there is one menu, and every way in opens it: the board's door, the
 * GitHub button, the new site's offer and the command palette. It has two
 * sections, in the order a site is made:
 *
 *   · BRING IN. His repos, searchable. Picking one opens it out to its
 *     branches (the default one already chosen) and the sites kept in its
 *     `sites/<name>` folders, read from `/api/studio/repo/choices`. Nothing
 *     to type; the typed owner/name field stays underneath as a fallback.
 *   · PUBLISH TO. Where this site's own publishes go: one of his repos, or a
 *     new one made by name, each with a branch, so a new site can publish
 *     to a branch that is not main first. The edit branch and the branch list
 *     of the repo it publishes to are here too.
 *
 * THE RULES ARE THE SAME ONES. A site never publishes into the repo any site
 * was brought in from (polio never writes to a capture repository). A site
 * brought in from one repo brings in that one and no other. Bringing into a
 * site that has parts asks first, and offers a new site for it.
 *
 * There is no second import path here. The press goes through `bringRepoIn`,
 * the one door. His token is read in his browser and rides with each call,
 * exactly as a publish reads it.
 */
import * as React from "react";
import { Camera, Loader2, Lock, Search } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Dialog } from "@/core/ui/dialog";
import { cn } from "@/core/lib/cn";
import { useActions } from "@/core/actions";
import { useRouter } from "next/navigation";
import { heldKeys, useKeys } from "@/features/keys/store";
import { activeProject, allSources, repoFrom, repoLabel, sharedTargetSays, sourceOf, sourceWords, targetKey, targetTakenBy, useBuilds } from "@/features/builds/store";
import { staleBuild, staleSays } from "@/core/shell/BuildGuard";
import type { BranchRow } from "@/app/api/studio/branches/route";
import { bringRepoIn } from "./bringRepo";
import { nameRefusal, repoNameFor } from "./repoName";
import { useStudio } from "./board/store";
import { RecapturePanel, openRecapture, useRecapture } from "./Recapture";
import { StyleLayerSection } from "./StyleLayerPanel";

interface Mine { name: string; private: boolean; branch?: string }
interface Choices { base: string; ref: string; branches: string[]; sites: string[] }

/** The token rides with the call, out of the Keys panel, in his browser. */
export const token = (): Record<string, string> => {
  const t = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  return t ? { "x-github-token": t } : {};
};

/*
 * ASK THE BUILDER'S OWN ROUTE, AND SAY WHICH SIDE FAILED.
 *
 * Every call here goes to the Builder's server, which asks GitHub. A 500
 * with no JSON used to throw at `res.json()` and land in the catch that said
 * "GitHub could not be reached from this browser": the browser never asks
 * GitHub, and GitHub was fine. A server that failed says so, with its status;
 * a fetch that never got an answer says the Builder's server was not reached.
 */
type Said = { ok?: boolean; message?: string };
export function serverFailed(status: number): string {
  return `The Builder's server failed (status ${status}), so GitHub was not asked. Try again in a minute.`;
}
export async function askRoute<T>(url: string, init?: RequestInit): Promise<T & Said> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, message: "The Builder's server could not be reached from this browser. Check the connection and try again." } as T & Said;
  }
  const data = (await res.json().catch(() => null)) as (T & Said) | null;
  if (res.status >= 500 && (!data || data.ok !== false || !data.message)) return { ...(data ?? {}), ok: false, message: serverFailed(res.status) } as T & Said;
  return data ?? ({ ok: false, message: `The Builder's server answered ${res.status} with nothing GitHub said.` } as T & Said);
}

const head = "text-small font-medium uppercase tracking-[0.12em] text-fg-faint";
const warn = { borderColor: "oklch(0.7 0.15 18 / 0.45)", background: "oklch(0.7 0.15 18 / 0.08)" };
const red = { borderColor: "oklch(0.72 0.17 18)", color: "oklch(0.8 0.16 18)" };

export function RepoPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mine, setMine] = React.useState<Mine[] | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const unlocked = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);

  /* A list read with his key, so that when the key locks again the list is taken down with the reason. */
  const listedWithKey = React.useRef(false);

  /*
   * The list, asked for when the menu opens and again when the key changes.
   * With his key held it is read with it; without, the route falls back to
   * the server's token, as a publish does, and says in words when there is
   * none. The Keys panel relocks after five idle minutes, and a list that
   * went stale under a button that says there is no token is worse than
   * none, so a list read with the key is taken down when it locks.
   */
  React.useEffect(() => {
    if (!open) return;
    if (!unlocked && listedWithKey.current) {
      listedWithKey.current = false;
      setMine(null);
      setSaid("The key is locked again after five minutes idle. Open Keys to unlock it, and the list comes back.");
      return;
    }
    let alive = true;
    setSaid(null);
    setMine(null);
    void askRoute<{ repos?: Mine[] }>("/api/studio/repo", { headers: token(), cache: "no-store" })
      .then((a) => {
        if (!alive) return;
        if (a.ok && a.repos) { setMine(a.repos); listedWithKey.current = unlocked; }
        else setSaid(a.message ?? "GitHub did not answer with a list.");
      });
    return () => { alive = false; };
  }, [open, unlocked]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Your repos"
      description="Bring one in to build from, and choose where this site publishes."
    >
      <div data-repo-picker="" data-repo-menu="" data-repo-panel="" className="flex max-h-[70vh] w-full flex-col gap-3 overflow-y-auto pr-1">
        <BringIn mine={mine} said={said} onDone={() => onOpenChange(false)} />
        <div className="h-px shrink-0 bg-border" />
        <PublishTo mine={mine} />
        <StyleLayerSection />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Bring in                                                            */
/* ------------------------------------------------------------------ */

function BringIn({ mine, said, onDone }: { mine: Mine[] | null; said: string | null; onDone: () => void }) {
  const [find, setFind] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [choices, setChoices] = React.useState<Choices | null>(null);
  const [choicesSaid, setChoicesSaid] = React.useState<string | null>(null);
  const [branch, setBranch] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [typed, setTyped] = React.useState("");
  const [pulling, setPulling] = React.useState(false);
  const [refused, setRefused] = React.useState<string | null>(null);
  /* What a Bring is waiting on his word for, while the line saying what goes is up. */
  /* `other`: a folder of the same repository that is not where this site came from, allowed once he says so. */
  const [asking, setAsking] = React.useState<{ want: string; path: string | null; other: boolean } | null>(null);
  const pages = useStudio((s) => s.pages);
  const pageNames = React.useMemo(() => pages.map((p) => p.name), [pages]);
  const partCount = useStudio((s) => s.nodes.length);
  const pageCount = useStudio((s) => s.pages.length);
  const ctx = useActions();
  const router = useRouter();
  /* Where this site was brought in from: the only repo it may bring in again. Where it publishes is not this. */
  const source = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.source);
  const from = repoLabel(source);
  const fromRepo = source ? `${source.owner}/${source.name}` : null;
  const [againSays, setAgainSays] = React.useState<string | null>(null);

  const read = React.useCallback((name: string, ref?: string) => {
    setChoicesSaid(null);
    const q = `repo=${encodeURIComponent(name)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;
    void askRoute<Partial<Choices>>(`/api/studio/repo/choices?${q}`, { headers: token(), cache: "no-store" })
      .then((a) => {
        if (!a.ok) { setChoicesSaid(a.message ?? "GitHub would not say what is in it."); return; }
        setChoices({ base: a.base ?? "main", ref: a.ref ?? a.base ?? "main", branches: a.branches ?? [], sites: a.sites ?? [] });
        setFolder((f) => ((a.sites ?? []).includes(f) ? f : ""));
      });
  }, []);

  const pick = (name: string) => {
    setRefused(null);
    if (picked === name) { setPicked(null); return; }
    setPicked(name);
    setChoices(null);
    setFolder("");
    setBranch(mine?.find((r) => r.name === name)?.branch ?? "");
    read(name);
  };
  const chooseBranch = (b: string) => {
    setBranch(b);
    if (picked) read(picked, b);
  };

  const run = (want: string, path: string | null, own: string | null = from, keep = false) => {
    setPulling(true);
    try {
      /* One door, shared by every way in: the stale check, the refusals, the space, the toast and the navigation all live there. */
      const out = bringRepoIn(want, {
        own,
        path,
        say: (n) => ctx.publish({ ...n, level: "info", source: "studio", toast: { durationMs: 5000 } }),
        toBoard: () => router.push("/builder"),
        stale: () => !!staleBuild(),
        staleSays,
        hasToken: () => !!heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN,
        keep,
      });
      if (!out.ok) { setRefused(out.says ?? "It could not be brought in."); return; }
      onDone();
    } finally {
      setPulling(false);
    }
  };

  /*
   * SAY WHAT GOES, ONCE, BEFORE IT GOES. A Bring replaces the site's whole
   * board. An empty board has nothing to lose and is not asked; a repo the
   * lock refuses is refused in words at once, not asked about first.
   */
  const ask = (want: string, path: string | null) => {
    if (!want || pulling) return;
    setRefused(null);
    const [repoPart] = want.split("@");
    const bits = repoPart!.split("/");
    const repoOf = bits.slice(0, 2).join("/").toLowerCase();
    const dirOf = (path ?? (bits.slice(2).join("/") || null))?.replace(/^\/+|\/+$/g, "") || null;
    /* The same repository, another of its folders (or its root): a different source, which he may take over this one once he has said so. */
    const other = !!source && repoOf === fromRepo!.toLowerCase() && (dirOf ?? "").toLowerCase() !== (source.dir ?? "").toLowerCase();
    if (!other && (partCount === 0 || (fromRepo && repoOf !== fromRepo.toLowerCase()))) { run(want, path); return; }
    setAsking({ want, path, other });
  };

  /*
   * BRING IT IN AGAIN: what this site came from, whole — the repository, the
   * branch and the folder — and never, in silence, the root of the default
   * branch. It did exactly that: the folder was not recorded, and the press
   * read sink main's root (SOLCINERATOR) over a trumpmorty.fun board. A site
   * recorded before the folder was kept has no folder to reuse, so the
   * picker opens on its repository and branch and he chooses.
   */
  /* A recapture that has finished is offered through this section's own Replace prompt, whenever the menu is next open. */
  const recaptureAt = useRecapture((s) => s.stage.at);
  React.useEffect(() => {
    const st = useRecapture.getState().stage;
    if (st.at !== "ready" || asking || pulling) return;
    useRecapture.getState().set({ at: "idle" });
    ask(st.want, st.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recaptureAt]);

  const bringAgain = () => {
    if (!source) return;
    setRefused(null);
    const name = `${source.owner}/${source.name}`;
    if (source.dir) { ask(`${name}@${source.branch}`, source.dir); return; }
    /* A builder-ready repository says its own folder: where its builder.json is (`look.styleSource.manifest`), so the record's missing folder is no question. */
    const code = (useStudio.getState().look as { styleSource?: { repo?: string; manifest?: { file?: string } } }).styleSource;
    const manifestFile = code?.repo?.toLowerCase() === name.toLowerCase() ? code.manifest?.file : undefined;
    if (manifestFile) { const dir = manifestFile.includes("/") ? manifestFile.slice(0, manifestFile.lastIndexOf("/")) : null; ask(`${name}@${source.branch}`, dir); return; }
    setPicked(name);
    setChoices(null);
    setFolder("");
    setBranch(source.branch);
    read(name, source.branch);
    setAgainSays(`This site's record says ${name} on ${source.branch}, not which folder of it. Choose the folder it came from, or "the whole repo" if it was the root.`);
  };

  /* A new site for it: the site being left keeps its parts, and the repo comes into the new one. */
  const intoNewSite = (want: string, path: string | null) => {
    setAgainSays(null);
    setAsking(null);
    const name = want.split("@")[0]!.split("/")[1] ?? "";
    const id = useBuilds.getState().create(name);
    let done = false;
    const go = () => { if (done) return; done = true; off(); window.setTimeout(() => run(want, path, null), 60); };
    const off = useBuilds.subscribe((s) => { if (s.activeId === id) go(); });
    window.setTimeout(go, 4000);
  };

  const bringChosen = () => {
    if (!picked) return;
    const base = choices?.base ?? mine?.find((r) => r.name === picked)?.branch ?? "";
    const want = branch && branch !== base ? `${picked}@${branch}` : picked;
    ask(want, folder || null);
  };

  const rows = (mine ?? []).filter((r) => !find.trim() || r.name.toLowerCase().includes(find.trim().toLowerCase()));
  const whole = (s: string) => `${asking?.path ? `${asking.want.split("@")[0]}/${asking.path}` : asking?.want.split("@")[0]} on ${s || (choices?.base ? choices.base : "its default branch")}`;
  const listPages = (n: string[]) => (n.length <= 4 ? n.join(", ") : `${n.slice(0, 3).join(", ")} and ${n.length - 3} more`);

  return (
    <section data-repo-section="bring" className="flex flex-col gap-2">
      <div>
        <p className={head}>Bring in</p>
        {from
          ? <p data-repo-source={from} className="text-small text-fg-muted">This site was brought in from <span className="text-fg">{from}</span>, which it never publishes to. It can bring that one in again; another repo needs a new site.</p>
          : <p className="text-small text-fg-muted">Pick one of your repos to build from. Its page lands on the board as parts you can change.</p>}
        {from && source ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {/* The source is named in the line above; the button says what it does and on which branch, and fits the menu. */}
            <Button size="sm" variant="outline" data-repo-bring-own="" disabled={pulling} onClick={bringAgain} title={source.dir ? `Bring ${from} in again, from ${source.branch}` : `Bring ${from} in again: choose its folder`}>
              {source.dir ? `Bring in again, from ${source.branch}` : "Bring in again: choose its folder"}
            </Button>
            {/* A site brought in from a capture folder can be captured again from its address. */}
            {source.dir ? (
              <Button size="sm" variant="outline" data-repo-recapture="" disabled={pulling || recaptureAt === "running"} onClick={() => void openRecapture(source)}>
                <Camera /> Recapture
              </Button>
            ) : null}
          </div>
        ) : null}
        {source?.dir ? <RecapturePanel source={source} say={(title, body) => ctx.publish({ key: `studio:recapture:${source.dir}`, title, body, level: "info", source: "studio", toast: { durationMs: 8000 } })} /> : null}
        {againSays ? <p data-repo-again-says="" className="mt-1 text-small text-fg-muted">{againSays}</p> : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" />
        <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a repo" aria-label="Find a repository" spellCheck={false} className="h-8 pl-7 text-xs" />
      </div>

      {said ? <p data-repo-picker-said="" className="text-plain text-fg-muted">{said}</p> : null}
      {mine === null && !said ? (
        <p className="flex items-center gap-1.5 text-plain text-fg-muted"><Loader2 className="size-3 animate-spin" /> Asking GitHub for your repos…</p>
      ) : null}
      {mine && rows.length === 0 ? (
        <p data-repo-picker-empty="" className="text-plain text-fg-muted">{mine.length ? "None of yours match that." : "GitHub listed no repos for this token."}</p>
      ) : null}

      {rows.length ? (
        <ul data-repo-picker-list="" className="max-h-[280px] shrink-0 overflow-y-auto rounded-md border border-border">
          {rows.map((r) => {
            /* A site is one repository. One already brought in is the only one it may bring in, and the rest say why. */
            const own = fromRepo;
            const barred = !!own && r.name.toLowerCase() !== own.toLowerCase();
            const isOpen = picked === r.name;
            return (
              <li key={r.name} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  data-repo-pick={r.name}
                  aria-expanded={isOpen}
                  disabled={barred || pulling}
                  onClick={() => pick(r.name)}
                  title={barred ? `This site was brought in from ${own}. Make a new site to bring ${r.name} in.` : `Choose what to bring in from ${r.name}`}
                  className="tactile flex w-full items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-plain text-fg">{r.name}</span>
                  {r.private ? <Lock aria-label="Private" className="size-3 shrink-0 text-fg-faint" /> : null}
                </button>
                {isOpen ? (
                  <div data-repo-choices={r.name} className="flex flex-col gap-1.5 border-t border-border bg-bg-subtle/40 px-2 py-2">
                    {choicesSaid ? <p className="text-small text-fg-muted">{choicesSaid}</p> : null}
                    <label className="flex items-center gap-2 text-small text-fg-muted">
                      <span className="w-14 shrink-0">Branch</span>
                      <select
                        data-repo-branch-pick=""
                        aria-label="Branch"
                        value={branch || choices?.base || ""}
                        onChange={(e) => chooseBranch(e.target.value)}
                        className="h-6 min-w-0 flex-1 rounded-sm border border-border bg-bg px-1 font-mono text-plain text-fg"
                      >
                        {(choices?.branches.length ? choices.branches : [branch || "main"]).map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </label>
                    <div className="flex items-start gap-2 text-small text-fg-muted">
                      <span className="w-14 shrink-0 pt-0.5">Bring</span>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                        {["", ...(choices?.sites ?? [])].map((f) => (
                          <button
                            key={f || "whole"}
                            type="button"
                            data-repo-folder={f}
                            aria-pressed={folder === f}
                            onClick={() => setFolder(f)}
                            className={cn("tactile rounded-sm border px-1.5 py-0.5 font-mono text-plain", folder === f ? "border-accent text-fg" : "border-border text-fg-muted hover:text-fg")}
                          >
                            {f ? f.replace(/^sites\//, "") : "the whole repo"}
                          </button>
                        ))}
                        {choices && !choices.sites.length ? <span className="py-0.5 text-fine text-fg-faint">no sites/ folders on this branch</span> : null}
                      </div>
                    </div>
                    <Button size="sm" variant="primary" data-repo-bring-chosen="" disabled={pulling} onClick={bringChosen}>
                      {pulling ? "Reading…" : "Bring it in"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {asking ? (
        <div data-repo-bring-confirm="" className="rounded-md border px-2 py-1.5" style={warn}>
          <p className="text-small text-fg">
            Replacing this site takes away its {partCount} part{partCount === 1 ? "" : "s"} on {pageCount} page{pageCount === 1 ? "" : "s"} ({listPages(pageNames)}) and brings in <span className="font-mono">{whole(asking.want.split("@")[1] ?? "")}</span>. One Ctrl+Z puts this board back. Or bring it into a new site and keep this one.
          </p>
          {!asking.other && from ? (
            <p data-repo-bring-keepsays="" className="mt-1 text-small text-fg">
              Or bring it in over this board and keep what you changed by hand since it was last brought in: parts you moved or edited, feature settings, words, parts you added or deleted. Everything else takes the new capture.
            </p>
          ) : null}
          {asking.other ? (
            <p data-repo-bring-other="" className="mt-1 text-small text-fg">
              That is not where this site came from ({from}{source ? ` on ${source.branch}` : ""}). Replacing makes it this site&apos;s source from now on.
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" data-repo-bring-newsite="" onClick={() => intoNewSite(asking.want, asking.path)}>Make a new site for it</Button>
            {/* The same source brought in again (a new capture of it): laid over the board, what he changed since kept (`reimport.ts`). */}
            {!asking.other && from ? <Button size="sm" variant="outline" data-repo-bring-keepmine="" onClick={() => { const a = asking; setAsking(null); setAgainSays(null); run(a.want, a.path, from, true); }}>Bring it in, keep my changes</Button> : null}
            <Button size="sm" variant="outline" data-repo-bring-go="" onClick={() => { const a = asking; setAsking(null); setAgainSays(null); run(a.want, a.path, a.other ? null : from); }}>Replace this one</Button>
            <Button size="sm" variant="ghost" data-repo-bring-keep="" onClick={() => setAsking(null)}>Keep my board</Button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-small text-fg-faint">Or type one, as owner/name</p>
        <div className="flex items-center gap-1.5">
          <Input
            inputSize="sm"
            data-repo-bring=""
            value={typed}
            aria-label="The repo to bring in"
            placeholder="owner/name"
            className="h-6 text-plain"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(typed.trim(), null); } }}
          />
          <Button size="sm" variant="outline" data-repo-pull="" disabled={pulling || !typed.trim()} onClick={() => ask(typed.trim(), null)}>
            {pulling ? "Reading…" : "Bring it"}
          </Button>
        </div>
      </div>
      {refused ? <p data-repo-said="" className="text-small text-fg">{refused}</p> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Publish to                                                          */
/* ------------------------------------------------------------------ */

function PublishTo({ mine }: { mine: Mine[] | null }) {
  const project = useBuilds((s) => s.projects.find((p) => p.id === s.activeId) ?? null);
  const own = project?.repo ? `${project.repo.owner}/${project.repo.name}` : null;
  const ownBranch = project?.repo?.branch ?? "main";
  const siteName = useStudio((s) => s.brief?.name ?? "");
  const siteBranch = useStudio((s) => s.siteBranch);
  const shared = useBuilds((s) => sharedTargetSays(s.projects, s.activeId));
  const allProjects = useBuilds((s) => s.projects);
  const canPush = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  const [branch, setBranch] = React.useState(ownBranch);
  React.useEffect(() => { setBranch(ownBranch); }, [ownBranch]);
  const [name, setName] = React.useState(() => repoNameFor(siteName));
  const [making, setMaking] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const [merging, setMerging] = React.useState(false);
  const [branches, setBranches] = React.useState<{ base: string; rows: BranchRow[]; more: number } | null>(null);
  const [branchSaid, setBranchSaid] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const onBranch = branch.trim() || "main";

  /*
   * POINTING PUBLISHING WRITES THE BUILDS STORE, and nothing else, with the
   * branch. A repo any site was brought in from, this one included, is
   * never a publish target. Moving a bound site to another repo asks first.
   */
  /*
   * THE ASK IS ON THE PANEL, NOT A BROWSER DIALOG. It was `window.confirm`,
   * and a confirm the browser does not show (dialogs blocked for the tab, or
   * dismissed by whatever is driving it) answers "no" in silence: pressing a
   * repo under "Or move it to another of your repos" did nothing at all, and a
   * repo made for a site that already published was made and never pointed
   * at. A site that has not published yet moves at once; one that has asks
   * here, in words, with the two answers as keys (`tests/publish-target.mjs`).
   */
  const [moving, setMoving] = React.useState<{ full: string; how: "connected" | "made"; from: string } | null>(null);
  const [asking, setAsking] = React.useState<{ name: string; from: string | null } | null>(null);
  const owner = mine?.find((r) => r.name.includes("/"))?.name.split("/")[0] ?? null;

  const connect = (full: string, how: "connected" | "made" = "connected", confirmed = false): boolean => {
    const repo = repoFrom(full, onBranch);
    if (!repo) { setSaid(`${full} is not an owner/name, so it cannot be published to.`); return false; }
    let p = activeProject();
    if (!p) { useBuilds.getState().adopt(); p = activeProject(); }
    if (!p) { setSaid("There is no site open to point."); return false; }
    const theirs = sourceOf(full);
    if (theirs) { setSaid(`${full} is where ${theirs.id === p.id ? "this site" : `the site ${theirs.name}`} was brought in from, and a site never publishes into that.`); return false; }
    const current = p.repo ? `${p.repo.owner}/${p.repo.name}` : null;
    const published = !!p.live || !!p.pending;
    if (current && current.toLowerCase() !== full.toLowerCase() && published && !confirmed) {
      setMoving({ full, how, from: current });
      setSaid(null);
      return false;
    }
    setMoving(null);
    const holder = targetTakenBy(p.id, repo);
    if (holder) { setSaid(`${holder.name} already publishes to ${full} on ${onBranch}. Two sites on one repository and branch replace each other's live site, so choose another repository or branch.`); return false; }
    const ok = useBuilds.getState().setRepo(p.id, repo, how);
    if (ok) setSaid(current && current.toLowerCase() !== full.toLowerCase()
      ? `This site publishes to ${full} on ${onBranch} now, not ${current}. ${current} is left as it is, and the board is as it was.`
      : `This site publishes to ${full} on ${onBranch} now. The board is as it was.`);
    else setSaid(`${full} could not be made this site's publish target.`);
    return ok;
  };

  /*
   * ONE ASK BEFORE A REPO IS MADE, WITH THE NAME IT WILL HAVE. The name box
   * comes filled in, and a click into it followed by typing put the typing
   * in the middle of that name: one press of Make it made a private repo
   * with a garbled name. The box selects itself on focus, and Make it first
   * shows the whole name and where the site will publish, and asks.
   */
  const askMake = () => {
    const final = name.trim();
    const refusal = nameRefusal(final);
    if (refusal) { setSaid(refusal); return; }
    const p = activeProject();
    setAsking({ name: final, from: p?.repo ? `${p.repo.owner}/${p.repo.name}` : null });
    setSaid(null);
  };

  const make = async (final: string) => {
    setAsking(null);
    const refusal = nameRefusal(final);
    if (refusal) { setSaid(refusal); return; }
    setMaking(true);
    setSaid(null);
    try {
      const a = await askRoute<{ name?: string }>("/api/studio/repo", { method: "POST", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ name: final }) });
      if (!a.ok) { setSaid(a.message ?? "GitHub would not make it."); return; }
      /* He said yes to the name and to publishing there, so the switch is not asked again. */
      if (connect(String(a.name), "made", true)) setSaid(`Made ${a.name}. This site publishes to it on ${onBranch}.`);
    } catch {
      setSaid("The Builder's server could not be reached from this browser.");
    } finally {
      setMaking(false);
    }
  };

  /* The branch list of the repo it publishes to: what each branch has that main has not. */
  const listBranches = React.useCallback(async () => {
    if (!own) { setBranches(null); return; }
    setBranchSaid(null);
    try {
      const a = await askRoute<{ base?: string; branches?: BranchRow[]; more?: number }>(`/api/studio/branches?repo=${encodeURIComponent(own)}&branch=${encodeURIComponent(ownBranch)}`, { headers: token(), cache: "no-store" });
      if (!a.ok) { setBranches(null); setBranchSaid(a.message ?? "GitHub would not list the branches."); return; }
      setBranches({ base: String(a.base ?? "main"), rows: (a.branches ?? []) as BranchRow[], more: Number(a.more ?? 0) });
    } catch {
      setBranches(null);
      setBranchSaid("The Builder's server could not be reached from this browser.");
    }
  }, [own, ownBranch]);
  React.useEffect(() => { void listBranches(); }, [listBranches]);

  /* Main moves here and nowhere else, by his hand, and it asks first: it cannot be undone. */
  /* Only a site that truly publishes to a branch other than the repository's main one has anything to merge. */
  const base = branches?.base ?? "main";
  const mergeFrom = own && ownBranch.toLowerCase() !== base.toLowerCase() ? ownBranch : null;
  const merge = async () => {
    if (!own || !mergeFrom || merging) return;
    setMerging(true);
    setSaid(null);
    try {
      const a = await askRoute("/api/studio/merge", { method: "POST", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ repo: own, branch: mergeFrom, sources: allSources() }) });
      if (!a.ok) { setSaid(a.message ?? "GitHub would not merge it."); return; }
      setSaid(a.message ?? `Merged ${mergeFrom} into ${base}.`);
      void listBranches();
    } catch {
      setSaid("The Builder's server could not be reached from this browser.");
    } finally {
      setMerging(false);
    }
  };

  const remove = async (row: BranchRow) => {
    if (!own || removing) return;
    const asks = row.updates > 0
      ? `Delete ${row.name}? Its ${row.updates} update${row.updates === 1 ? "" : "s"} (+${row.added} −${row.removed}) are not in ${branches?.base ?? "main"} and go with it.`
      : `Delete ${row.name}? Everything in it is already in ${branches?.base ?? "main"}.`;
    if (!window.confirm(asks)) return;
    setRemoving(row.name);
    setBranchSaid(null);
    try {
      const a = await askRoute("/api/studio/branches", { method: "DELETE", headers: { "content-type": "application/json", ...token() }, body: JSON.stringify({ repo: own, branch: row.name, sources: allSources() }) });
      if (!a.ok) { setBranchSaid(a.message ?? `GitHub would not delete ${row.name}.`); return; }
      if (row.name === siteBranch) useStudio.getState().setSiteBranch(null);
      setBranches((b) => (b ? { ...b, rows: b.rows.filter((r) => r.name !== row.name) } : b));
      setBranchSaid(a.message ?? `Deleted ${row.name}.`);
    } catch {
      setBranchSaid("The Builder's server could not be reached from this browser.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section data-repo-section="publish" data-repo-panel-publish="" className="flex flex-col gap-2">
      <div>
        <p className={head}>Publish to</p>
        {/*
          ONE LINE, THE SAME WORDS AS BUILDS, REPOS (`targetWords`). There was
          a big repository name, a line under it, and a red box saying "Edits
          are on a branch edit/<site>-<date>… Merge into main" while Update
          live site wrote to main all along: the edit branch was never where a
          publish went. A site with none says so in words, never a blank.
        */}
        <p data-repo-line="" className="text-plain text-fg">
          {own ? (
            <>Update live site writes to <span data-repo-points="" data-repo-own={own} className="font-mono font-medium">{own}</span> on <span className="font-mono font-medium">{ownBranch}</span>.</>
          ) : (
            <><span data-repo-points="" data-repo-own="" className="font-medium">No repo of its own yet</span>. The first Update live site makes a private repository named after this site, unless you choose one below.</>
          )}
        </p>
        {project?.source ? <p data-repo-line-source="" className="text-small text-fg-muted">{sourceWords(project)}</p> : null}
        {own && !canPush ? <p className="text-small text-fg-muted">No GitHub key in this browser, so Update live site cannot write yet.</p> : null}
        {shared ? <p data-repo-shared="" className="mt-1 rounded-md border px-2 py-1.5 text-small text-fg" style={warn}>{shared}</p> : null}
      </div>

      <label className="flex items-center gap-2 text-small text-fg-muted">
        <span className="shrink-0">Branch to publish to</span>
        <Input inputSize="sm" data-repo-publish-branch="" aria-label="Branch to publish to" value={branch} placeholder="main" className="h-6 font-mono text-plain" onChange={(e) => setBranch(e.target.value)} />
      </label>

      <div>
        <p className="text-small text-fg-faint">{own ? "Or move it to another of your repos" : "Choose one of your repos"}</p>
        {moving ? (
          <div data-repo-move-confirm={moving.full} className="my-1 rounded-md border px-2 py-1.5" style={warn}>
            <p className="text-small text-fg">
              This site has published to <span className="font-mono">{moving.from}</span>. Publish to <span className="font-mono">{moving.full}</span> from now on? {moving.from} is left as it is.
            </p>
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="primary" data-repo-move-go="" onClick={() => void connect(moving.full, moving.how, true)}>Move to {moving.full.split("/")[1]}</Button>
              <Button size="sm" variant="ghost" data-repo-move-keep="" onClick={() => setMoving(null)}>Keep {moving.from.split("/")[1]}</Button>
            </div>
          </div>
        ) : null}
        {mine === null ? (
          <p className="text-small text-fg-muted">Your repos are listed once GitHub answers.</p>
        ) : (
          <ul className="max-h-[160px] overflow-y-auto">
            {mine.map((r) => {
              const brought = sourceOf(r.name);
              /* Taken: another site already publishes to this repository on this branch. */
              const taken = !brought ? allProjects.find((p) => p.id !== project?.id && targetKey(p.repo) === `${r.name}@${onBranch}`.toLowerCase()) ?? null : null;
              return (
                <li key={r.name}>
                  <button
                    type="button"
                    data-repo-publish-pick={r.name}
                    disabled={!!brought || !!taken}
                    onClick={() => { setAsking(null); void connect(r.name); }}
                    title={brought ? `${r.name} is where ${brought.name} was brought in from, and a site never publishes into that` : taken ? `${taken.name} already publishes to ${r.name} on ${onBranch}: choose another repository or branch` : `Publish this site to ${r.name} on ${onBranch}`}
                    className={cn("tactile flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-plain disabled:opacity-40", own === r.name ? "text-fg" : "text-fg-muted hover:text-fg")}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-fine text-fg-faint">{brought ? "brought in from" : taken ? `used by ${taken.name}` : own === r.name ? "publishes here" : r.private ? "private" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <p className="text-small text-fg-faint">Or make a new repo for it</p>
        <div className="flex items-center gap-1.5">
          <Input
            inputSize="sm"
            data-repo-new=""
            value={name}
            aria-label="Name for the new repo"
            placeholder="a-name"
            className="h-6 text-plain"
            /* The whole name is selected on the way in, by a click as much as by Tab: the mouse-up that would put the caret mid-name is the one that is stopped. */
            onFocus={(e) => { e.currentTarget.select(); e.currentTarget.dataset.fresh = "1"; }}
            onMouseUp={(e) => { if (e.currentTarget.dataset.fresh) { e.preventDefault(); e.currentTarget.select(); delete e.currentTarget.dataset.fresh; } }}
            onChange={(e) => { delete e.currentTarget.dataset.fresh; setName(e.target.value); setAsking(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); askMake(); } }}
          />
          <Button size="sm" variant="outline" data-repo-make="" disabled={making || !!asking} onClick={askMake}>
            {making ? "Making…" : "Make it"}
          </Button>
        </div>
        {asking ? (
          <div data-repo-make-confirm={asking.name} className="mt-1 rounded-md border px-2 py-1.5" style={warn}>
            <p className="text-small text-fg">
              Make a private repo named <span data-repo-make-final="" className="font-mono">{owner ? `${owner}/` : ""}{asking.name}</span>
              {asking.from ? <>, and publish this site there instead of <span className="font-mono">{asking.from}</span>?</> : ", and publish this site there?"}
            </p>
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="primary" data-repo-make-go="" onClick={() => void make(asking.name)}>Make {asking.name}</Button>
              <Button size="sm" variant="ghost" data-repo-make-cancel="" onClick={() => setAsking(null)}>Not now</Button>
            </div>
          </div>
        ) : null}
        <p className="mt-0.5 text-small text-fg-muted">Private, on your own account, with a first commit so a publish has somewhere to land.</p>
      </div>

      {own ? (
        <div data-repo-branches="">
          <p className="text-small text-fg-faint">Branches of {own} besides {branches?.base ?? "main"}</p>
          {branches === null ? (
            <p className="text-small text-fg-muted">{branchSaid ?? "Asking GitHub…"}</p>
          ) : branches.rows.length === 0 ? (
            <p className="text-small text-fg-muted">None. Every edit branch has been merged or removed.</p>
          ) : (
            <ul className="max-h-[152px] overflow-y-auto">
              {branches.rows.map((r) => {
                const unmerged = r.updates > 0;
                return (
                  <li key={r.name} data-repo-branch-row={r.name} data-repo-branch-unmerged={unmerged ? "1" : "0"} className="flex items-center gap-1.5 py-0.5">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: unmerged ? "oklch(0.8 0.15 75)" : "oklch(0.6 0.02 260 / 0.5)" }} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate font-mono text-small", unmerged ? "text-fg" : "text-fg-muted")} title={r.name}>{r.name}{r.name === ownBranch ? " · Update live site writes here" : ""}</span>
                      <span className="block text-small text-fg-faint">
                        {r.updates < 0
                          ? "GitHub would not compare it"
                          : unmerged
                            ? <>{r.updates} update{r.updates === 1 ? "" : "s"} not in {branches.base} · <span style={{ color: "oklch(0.78 0.16 145)" }}>+{r.added}</span> <span style={{ color: "oklch(0.75 0.17 25)" }}>−{r.removed}</span></>
                            : `everything in ${branches.base}`}
                      </span>
                    </span>
                    {r.name === mergeFrom && unmerged ? (
                      <Button size="xs" variant="outline" data-repo-merge="" disabled={merging} className="shrink-0" onClick={() => { if (window.confirm(`Merge ${mergeFrom} into ${base}? What ${own} shows on ${base} changes.`)) void merge(); }}>
                        {merging ? "Merging…" : `Merge into ${base}`}
                      </Button>
                    ) : null}
                    <Button size="xs" variant="outline" data-repo-branch-delete={r.name} disabled={removing !== null} className="shrink-0" style={red} onClick={() => void remove(r)}>
                      {removing === r.name ? "Deleting…" : "Delete"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {branches && branches.more > 0 ? <p className="text-small text-fg-faint">And {branches.more} more on GitHub.</p> : null}
          {branches !== null && branchSaid ? <p data-repo-branch-said="" className="text-small text-fg">{branchSaid}</p> : null}
        </div>
      ) : null}

      {said ? <p data-repo-said="" className="text-small text-fg">{said}</p> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Every way in opens this one                                          */
/* ------------------------------------------------------------------ */

/** Opened from the board's door, the GitHub button, the new site's offer and the command palette. */
export function openRepoPicker(): void {
  window.dispatchEvent(new CustomEvent("studio:bring-repo"));
}

export function useRepoPickerDoor(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("studio:bring-repo", on);
    return () => window.removeEventListener("studio:bring-repo", on);
  }, []);
  return [open, setOpen];
}

/** The one menu, mounted once, in the top bar, on every page. */
export function RepoMenuHost() {
  const [open, setOpen] = useRepoPickerDoor();
  return <RepoPicker open={open} onOpenChange={setOpen} />;
}
