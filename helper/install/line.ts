/**
 * The lines the Agents dock's "Set up the helper" shows (AGENTS-PANEL-PROPOSAL.md,
 * section 2, "Install once"). Each runs a script straight from the polio repo
 * at ONE NAMED COMMIT (audit helper-install.md, risk 4): the same address
 * opens it to read first, and the helper it installs is held at that commit,
 * so a later merge to the base branch never changes a helper already
 * installed. The Builder fills in the commit it was built from (/api/version).
 *
 * `& ([scriptblock]::Create((irm …))) -Commit <id>` runs the text as a script
 * block with that parameter, so it needs no change to the execution policy
 * and leaves PowerShell open when the script stops on a missing Node or Git.
 *
 * src/features/agents/context.ts keeps a copy of installLine for the Builder
 * (the helper is not part of the Next build); tests/helper-install-fixes.mjs
 * checks the two agree.
 */
export const BASE_BRANCH = "claude/template-ui-website-builder-11bfgl";
export const REPO_RAW = "https://raw.githubusercontent.com/sparkygogo77-spec/polio";
export const COMMIT = /^[0-9a-f]{7,40}$/;

const run = (url: string, args: string) => `& ([scriptblock]::Create((irm '${url}')))${args}`;

/** The install line at one commit. Without a commit (a local Builder) it falls back to the branch tip, and says so in `pinned`. */
export function installLine(commit: string | null | undefined): { line: string; pinned: boolean } {
  const c = typeof commit === "string" && COMMIT.test(commit) ? commit : null;
  return c
    ? { line: run(`${REPO_RAW}/${c}/helper/install/install.ps1`, ` -Commit ${c}`), pinned: true }
    : { line: run(`${REPO_RAW}/${BASE_BRANCH}/helper/install/install.ps1`, ""), pinned: false };
}

/** The uninstall line: the same shape. Uninstall changes nothing it can't name, so the branch tip is fine; a commit is used when known. */
export function uninstallLine(commit: string | null | undefined): string {
  const c = typeof commit === "string" && COMMIT.test(commit) ? commit : BASE_BRANCH;
  return run(`${REPO_RAW}/${c}/helper/install/uninstall.ps1`, "");
}

/** The links the Builder may use: start the helper, or bring up its dock. Nothing else. */
export const LINKS = { start: "polio-helper://start", open: "polio-helper://open" } as const;
