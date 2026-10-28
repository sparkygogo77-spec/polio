/**
 * The lines the Agents dock's "Set up the helper" shows (AGENTS-PANEL-PROPOSAL.md,
 * section 2, "Install once"). Each runs a script straight from the polio
 * repo's base branch: the same address opens it to read first.
 *
 * `& ([scriptblock]::Create((irm …)))` runs the text as a script block, so it
 * needs no change to the execution policy and leaves PowerShell open when the
 * script stops on a missing Node or Git.
 */
export const BASE_BRANCH = "claude/template-ui-website-builder-11bfgl";
export const RAW = `https://raw.githubusercontent.com/sparkygogo77-spec/polio/${BASE_BRANCH}/helper/install`;
export const INSTALL_URL = `${RAW}/install.ps1`;
export const UNINSTALL_URL = `${RAW}/uninstall.ps1`;

const run = (url: string) => `& ([scriptblock]::Create((irm '${url}')))`;
export const INSTALL_LINE = run(INSTALL_URL);
export const UNINSTALL_LINE = run(UNINSTALL_URL);
/** The links the Builder may use: start the helper, or bring up its dock. Nothing else. */
export const LINKS = { start: "polio-helper://start", open: "polio-helper://open" } as const;
