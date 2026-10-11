"use client";
/**
 * Bringing a repository in, from wherever the GitHub control was pressed.
 *
 * DRIVEN BY HAND ON THE LIVE SITE: a fresh site made on the Builds page,
 * the GitHub control opened from that page's own top bar, a repository
 * named, Bring it pressed, and nothing: no parts, no refusal, and the
 * view still on the Builds page. The control put a space into the studio
 * store and picked it, and on the Builds page that store is not loaded and
 * there is no board, so nothing was saved and no panel existed to run the
 * import or say a word about it.
 *
 * So the request is kept here until there is a board to land on. Pressed
 * on the Builder, it is placed at once. Pressed anywhere else, it is kept
 * for the board and the Builder is opened, and the Builder places it the
 * moment its document has loaded. Either way the same three things happen
 * in the same order: a space is made for it, the request is handed to that
 * space, and the space is picked so its panel mounts and runs the import.
 */
import { holdImportMark, useStudio } from "./board/store";
import { readRepo, repoName, sameSource, withPath, REPO_REFUSAL_SAYS } from "./bring-in";
import { HEADLESS, clearImportLine } from "./bring-in/ui";

/** Where a request waits for the board: this tab only, and taken once. */
const KEPT = "builder.bring";

/** Is there a board here to land on, with its document loaded? */
export function boardIsHere(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[data-studio-pane]") && useStudio.persist.hasHydrated();
}

/**
 * Hand the repository to the importer. Returns the id it runs under.
 *
 * It made a space for it, handed the request to that space and picked it,
 * because the importer lived on a space's panel: every Bring drew a square
 * box on the board and opened its panel on the right. The importer runs
 * out of sight now (`BringHost` in `FromASite.tsx`), so nothing is drawn,
 * nothing is picked, and what lands on the page is what landed before.
 */
/*
 * `at`: a commit to read the files at while the site stays on its branch,
 * so "Read again with the latest builder" reads the very code the board came
 * in from with this build's reader, not whatever the branch holds now.
 */
export function placeBring(want: string, keep = false, at?: string | null): string | null {
  const repo = readRepo(want);
  if (!repo) return null;
  /* Every press starts from a clear strip: the last press's ending is not this one's. */
  clearImportLine();
  const st = useStudio.getState();
  holdImportMark(st.historyMark());
  const id = `${HEADLESS}${Date.now().toString(36)}`;
  st.setBringRepo({ space: id, repo: want, pageId: st.activePageId, ...(keep ? { keep: true } : {}), ...(at ? { at } : {}) });
  return id;
}

export function keepBringForBoard(want: string): void {
  try { sessionStorage.setItem(KEPT, want); } catch { /* private mode: the Builder will simply have nothing kept */ }
}

export function takeKeptBring(): string | null {
  try {
    const it = sessionStorage.getItem(KEPT);
    if (it) sessionStorage.removeItem(KEPT);
    return it?.trim() || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The one door                                                        */
/* ------------------------------------------------------------------ */

/**
 * Bring a repository in, from wherever it was chosen.
 *
 * ATTACHING IS IMPORTING — his ruling, and it shipped once, in the GitHub
 * control's own panel. It never reached the Builds page, which has a
 * repository field of its own whose button binds where Publish pushes and
 * brings nothing in. So the ruling was true in one place and not in the
 * place he used, and a fresh site made on the Builds page had no way in at
 * all: the GitHub control draws nothing until a site has a repository or a
 * token, and the importer itself lives on a drawn space's panel.
 *
 * So the decision lives here, once, and every door calls it. The checks are
 * in the order that tells him the most useful thing first: a stale page
 * before anything else, because nothing that follows would work; then
 * whether it reads as a repository at all; then whether the site is already
 * bound to a different one; then the token, which is the one a person can
 * fix on the spot.
 *
 * Nothing about the token reaches our server. It is read in his browser by
 * the importer, exactly as a publish reads it.
 */
export interface Bringing {
  /** The repository this site was brought in from, if any. Never its publish target. */
  own?: string | null;
  /** How this surface says things out loud. */
  say: (n: { key: string; title: string; body: string }) => void;
  /** Take him to the board, when he is not on it. */
  toBoard: () => void;
  /** True when the page is older than the build the server is serving. */
  stale: () => boolean;
  /** What to say about that. */
  staleSays: () => string;
  /** Has he a GitHub token in this browser? */
  hasToken: () => boolean;
  /** A folder of the repository holding the site (`sites/<name>`, the Capture dialog's), when it is not at the root. */
  path?: string | null;
  /** Bring it in over the board, keeping what the owner changed since it was last brought in (`reimport.ts`). On the board only. */
  keep?: boolean;
}

export function bringRepoIn(want: string, o: Bringing): { ok: boolean; says?: string } {
  const asked = want.trim();
  if (!asked) return { ok: false, says: "Name a repository first." };
  if (o.stale()) return { ok: false, says: o.staleSays() };
  const named = readRepo(asked);
  if (!named) return { ok: false, says: REPO_REFUSAL_SAYS["not-a-repo"] };
  /* With a folder beside it, the site is read there: the name placed for the board carries the folder (`owner/name/sites/<name>@ref`), which `readRepo` reads back. */
  const repo = withPath(named, o.path);
  const placed = o.path ? repoName(repo) : asked;
  const full = `${repo.owner}/${repo.name}${repo.dir ? `/${repo.dir}` : ""}`;
  /* A site brought in from a repository — a folder of one included — brings in
     that one and no other: bringing a second in would quietly replace the
     first, and aim its Go live at the first's repository. */
  if (!sameSource(o.own, repo)) {
    return { ok: false, says: `This site was brought in from ${o.own}. Make a new site to bring ${full} in.` };
  }
  if (!o.hasToken()) return { ok: false, says: REPO_REFUSAL_SAYS["no-token"] };
  /*
   * On the board, or on the way to it. A press somewhere without a board
   * used to put a space into a store that was not loaded, with no panel to
   * run the import and nothing said. The request is kept for the board
   * instead, and the Builder opened.
   */
  if (boardIsHere()) {
    placeBring(placed, !!o.keep);
    o.say({ key: `studio:repo:${repo.name}`, title: `Reading ${repoName(repo)}`, body: "It lands on the page; this message and the line across the top of the board say how it is going." });
  } else {
    keepBringForBoard(placed);
    o.say({ key: `studio:repo:${repo.name}`, title: `Opening the board to bring ${repoName(repo)} in`, body: "It lands on the page there; the line across the top of the board says how it is going." });
    o.toBoard();
  }
  return { ok: true };
}
