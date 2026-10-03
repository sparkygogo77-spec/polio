/**
 * A SITE FROM A CODE REPOSITORY GOES LIVE AS A STILL COPY, AND IS TOLD SO.
 *
 * A site brought in from a code repository (`look.styleSource.repo`) is drawn
 * on the board from its pages as they first render. Go live and Update live
 * site publish that drawing: the pages as still pictures of themselves, with
 * none of the repository's scripts, so nothing on them works the way the real
 * site does. The design goes back to the code by Send the design back, in the
 * repo menu (`StyleLayerPanel.tsx`). So `goLive` asks first, every press, and
 * publishes the still only on an explicit yes (`PublishCheck.tsx`).
 * `tests/still-copy.mjs`.
 */
import { create } from "zustand";

/** The repository a site was brought in from, or null when it was made on the board. */
export function codeSourceOf(look: { styleSource?: { repo?: string | null } | null } | null | undefined): string | null {
  const repo = look?.styleSource?.repo;
  return typeof repo === "string" && repo.trim() ? repo.trim() : null;
}

/** What the question says, in plain words. */
export function stillCopyWords(repo: string): string {
  return `This site was brought in from ${repo}. Going live here publishes a still copy of its pages, without the repository's scripts: buttons, live numbers and anything the code draws will not work. To put the new design on the real site, use Send the design back in the repo menu: it opens a pull request on ${repo} with the style layer only.`;
}

/** The open question: whose repository, and what a yes publishes. */
export const useStillCopy = create<{ repo: string | null; go: (() => void) | null }>(() => ({ repo: null, go: null }));

/** Ask before publishing a still copy of a site from code; `go` runs only on Publish the still copy. */
export function askStillCopy(repo: string, go: () => void): void {
  useStillCopy.setState({ repo, go });
}
