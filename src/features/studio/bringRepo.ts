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
import { useStudio } from "./store";
import { readRepo, repoName } from "./repoImport";
import { clearImportLine } from "./FromASite";

/** Where a request waits for the board: this tab only, and taken once. */
const KEPT = "builder.bring";

/** Is there a board here to land on, with its document loaded? */
export function boardIsHere(): boolean {
  if (typeof document === "undefined") return false;
  return !!document.querySelector("[data-studio-pane]") && useStudio.persist.hasHydrated();
}

/** Make the space, hand it the repository, pick it. Returns the space. */
export function placeBring(want: string): string | null {
  const repo = readRepo(want);
  if (!repo) return null;
  /* Every press starts from a clear strip: the last press's ending is not this one's. */
  clearImportLine();
  const st = useStudio.getState();
  const id = st.addSpace({
    pageId: st.activePageId,
    boundary: [[240, 160], [1240, 160], [1240, 860], [240, 860]],
    prompt: "",
    label: repoName(repo),
  });
  st.setBringRepo({ space: id, repo: want });
  /* Picked, because the importer lives on the space's own panel and that
     panel only mounts for a picked space. */
  st.setSelection([id]);
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
