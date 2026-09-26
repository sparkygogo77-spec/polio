"use client";
/**
 * Choose a repository, and choosing it brings it in.
 *
 * HIS RULING: typing an exact repository name into a field is the wrong
 * shape. He wants to CHOOSE from the ones he has, from inside the Builder,
 * and the act of choosing is what brings it in.
 *
 * That is also the repair for the way in. Before this there were two repo
 * controls and neither did what he expected from the Builder: the Builds
 * page's field binds where Publish pushes and imports nothing, and the
 * GitHub control — which does import, and has since "attaching is
 * importing" landed — draws nothing at all until a site already has a
 * repository or a token, so a fresh site showed no door anywhere. He looked
 * for one, searched the palette for "import" and for "site", and found
 * nothing. He was right: there wasn't one.
 *
 * There is no second import path here. The list is the same `/api/studio/repo`
 * the GitHub panel lists, and the press goes through `bringRepoIn`, the one
 * door both controls now call. A private copy of a shared thing is the bug
 * this repository names most often, and an importer is the worst thing to
 * have two of.
 *
 * His token is read in his browser by the importer and never reaches our
 * server, exactly as a publish reads it.
 */
import * as React from "react";
import { Boxes, Loader2, Lock, Search } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Dialog } from "@/core/ui/dialog";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";
import { useRouter } from "next/navigation";
import { heldKeys, useKeys } from "@/features/keys/store";
import { activeSource } from "@/features/builds/store";
import { staleBuild, staleSays } from "@/core/shell/BuildGuard";
import { bringRepoIn } from "./bringRepo";
import { useStudio } from "./store";

interface Mine { name: string; private: boolean; branch?: string }

/** The token rides with the call, out of the Keys panel, in his browser. */
const token = (): Record<string, string> => {
  const t = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  return t ? { "x-github-token": t } : {};
};

export function RepoPicker({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mine, setMine] = React.useState<Mine[] | null>(null);
  const [said, setSaid] = React.useState<string | null>(null);
  const [find, setFind] = React.useState("");
  const [pulling, setPulling] = React.useState("");
  const ctx = useActions();
  const router = useRouter();
  const unlocked = useKeys((s) => s.unlocked && !!s.values.GITHUB_TOKEN);
  /* The repository a Bring is waiting on his word for, and what it would replace. */
  const [asking, setAsking] = React.useState<string | null>(null);
  const partCount = useStudio((s) => s.nodes.length);
  const pageCount = useStudio((s) => s.pages.length);
  React.useEffect(() => { if (!open) setAsking(null); }, [open]);

  /* The list, asked for when the sheet opens and again if the key is
     unlocked while it is open: the Keys panel relocks after five idle
     minutes, and a list that went stale under a button is worse than none. */
  React.useEffect(() => {
    if (!open) return;
    if (!unlocked) { setMine(null); setSaid("No GitHub token in this browser yet. Open Keys, put one in, and your repositories are listed here."); return; }
    let alive = true;
    setSaid(null);
    setMine(null);
    void fetch("/api/studio/repo", { headers: token(), cache: "no-store" })
      .then((r) => r.json())
      .then((a: { ok?: boolean; repos?: Mine[]; message?: string }) => {
        if (!alive) return;
        if (a.ok && a.repos) setMine(a.repos);
        else setSaid(a.message ?? "GitHub did not answer with a list.");
      })
      .catch(() => { if (alive) setSaid("GitHub could not be reached from this browser."); });
    return () => { alive = false; };
  }, [open, unlocked]);

  /* Where this site was brought in from: the only repository it may bring
     in again. Where it publishes is not this, and is not read here. */
  const own = activeSource();
  const rows = (mine ?? []).filter((r) => !find.trim() || r.name.toLowerCase().includes(find.trim().toLowerCase()));

  /*
   * SAY WHAT GOES, ONCE, BEFORE IT GOES, as the GitHub panel's Bring does.
   * This door had no such line: measured on 3e14749, choosing sink here on
   * a board of 3 parts replaced them with 245 and said nothing
   * (`tests/publish-source.mjs`). An empty board has nothing to lose and is
   * not asked.
   */
  const ask = (name: string) => {
    if (pulling) return;
    if (partCount === 0) { choose(name); return; }
    setSaid(null);
    setAsking(name);
  };

  const choose = (name: string) => {
    if (pulling) return;
    setAsking(null);
    setPulling(name);
    const out = bringRepoIn(name, {
      own,
      say: (n) => ctx.publish({ ...n, level: "info", source: "studio", toast: { durationMs: 5000 } }),
      toBoard: () => router.push("/builder"),
      stale: () => !!staleBuild(),
      staleSays,
      hasToken: () => !!heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN,
    });
    setPulling("");
    if (out.ok) { onOpenChange(false); return; }
    setSaid(out.says ?? "It could not be brought in.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bring a repository in"
      description="Choose one of yours. Choosing it reads the site and lands its page on the board as real parts."
    >
      <div data-repo-picker="" className="flex w-full flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" />
          <Input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a repository"
            aria-label="Find a repository"
            spellCheck={false}
            className="h-8 pl-7 text-xs"
          />
        </div>

        {said ? <p data-repo-picker-said="" className="text-plain text-fg-muted">{said}</p> : null}

        {mine === null && !said ? (
          <p className="flex items-center gap-1.5 text-plain text-fg-muted"><Loader2 className="size-3 animate-spin" /> Asking GitHub for your repositories…</p>
        ) : null}

        {mine && rows.length === 0 ? (
          <p data-repo-picker-empty="" className="text-plain text-fg-muted">
            {mine.length ? "None of yours match that." : "GitHub listed no repositories for this token."}
          </p>
        ) : null}

        {rows.length ? (
          <ul data-repo-picker-list="" className="max-h-[320px] overflow-y-auto rounded-md border border-border">
            {rows.map((r) => {
              /* A site is one repository. One already bound is the only one
                 it may bring in, and the rest say why rather than failing
                 under his hand after the press. */
              const barred = !!own && r.name.toLowerCase() !== own.toLowerCase();
              return (
                <li key={r.name} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    data-repo-pick={r.name}
                    disabled={barred || !!pulling}
                    onClick={() => ask(r.name)}
                    title={barred ? `This site was brought in from ${own}. Make a new site to bring ${r.name} in.` : `Bring ${r.name} in`}
                    className="tactile flex w-full items-center gap-2 px-2 py-1.5 text-left disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-plain text-fg">{r.name}</span>
                    {r.private ? <Lock aria-label="Private" className="size-3 shrink-0 text-fg-faint" /> : null}
                    {pulling === r.name ? <Loader2 className="size-3 shrink-0 animate-spin" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {asking ? (
          <div data-repo-bring-confirm="" className="rounded-md border px-2 py-1.5" style={{ borderColor: "oklch(0.7 0.15 18 / 0.45)", background: "oklch(0.7 0.15 18 / 0.08)" }}>
            <p className="text-small text-fg">Bringing {asking} in replaces this whole site: its {partCount} part{partCount === 1 ? "" : "s"} on {pageCount} page{pageCount === 1 ? "" : "s"} go, and the repo&apos;s come in their place.</p>
            <div className="mt-1 flex gap-1.5">
              <Button size="sm" variant="outline" data-repo-bring-go="" onClick={() => choose(asking)}>Replace it</Button>
              <Button size="sm" variant="ghost" data-repo-bring-keep="" onClick={() => setAsking(null)}>Keep my board</Button>
            </div>
          </div>
        ) : null}

        {/* Said plainly, because the two are different actions and one of
            them used to stand in for the other. It was not true until the
            source had a field of its own: the import wrote the very field
            the Builds page edits. */}
        <p className="text-small leading-snug text-fg-faint">
          This reads the repository and puts its page on the board. It never changes where Publish pushes: a site publishes to a repository of its own, set on the Builds page, and never back into the one it was brought in from.
        </p>
      </div>
    </Dialog>
  );
}

/** Opened from the Builder's own control and from the command palette. */
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

/**
 * The way in, on the board itself.
 *
 * Quiet and always there rather than clever about when to appear: the fault
 * being fixed is that he went looking for a door and there wasn't one, and a
 * door that hides itself once a board has parts on it would bring the same
 * fault back the next time. One thin row, furniture rather than an
 * invitation, and the command palette opens the same sheet.
 */
export function BringRepoDoor() {
  const [open, setOpen] = useRepoPickerDoor();
  return (
    <>
      <Tooltip content="Bring a repository in: choose one of yours and its page lands on the board as real parts.">
        <Button
          variant="ghost"
          size="iconXs"
          data-bring-repo=""
          aria-label="Bring a repository in"
          onClick={() => setOpen(true)}
        >
          <Boxes />
        </Button>
      </Tooltip>
      <RepoPicker open={open} onOpenChange={setOpen} />
    </>
  );
}
